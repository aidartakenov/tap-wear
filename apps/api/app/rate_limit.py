"""Request limits per client address, to slow down password guessing and spam.

Counters live in this process's memory, which is enough while the API runs as a
single process. With several API processes this needs a shared store (Redis).
"""

import math
import time
from collections import defaultdict, deque

from fastapi import Request

from app.config import get_settings
from app.errors import ApiError

settings = get_settings()

# (limit name, client address) -> times of recent requests
_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def reset() -> None:
    _hits.clear()


def rate_limit(name: str, limit: int, per_seconds: int = 60):
    """Dependency allowing `limit` requests per `per_seconds` from one address."""

    async def check(request: Request) -> None:
        if not settings.rate_limit_enabled:
            return
        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        hits = _hits[(name, client)]
        while hits and hits[0] <= now - per_seconds:
            hits.popleft()
        if len(hits) >= limit:
            retry_after = max(1, math.ceil(hits[0] + per_seconds - now))
            raise ApiError(
                429,
                "rate_limited",
                "Too many requests. Try again later",
                {"retry_after_seconds": retry_after},
            )
        hits.append(now)

    return check
