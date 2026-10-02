import hmac
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.models import Session, User
from app.accounts.security import token_hash
from app.config import get_settings
from app.database import get_session
from app.errors import ApiError

CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def current_session(
    request: Request, db: AsyncSession = Depends(get_session)
) -> Session | None:
    token = request.cookies.get(get_settings().session_cookie_name)
    if not token:
        return None
    session = await db.scalar(select(Session).where(Session.token_hash == token_hash(token)))
    if session is None or session.revoked_at or session.expires_at <= datetime.now(UTC):
        return None
    if not session.user.is_active:
        return None
    return session


async def require_session(
    request: Request, session: Annotated[Session | None, Depends(current_session)]
) -> Session:
    if session is None:
        raise ApiError(401, "unauthorized", "Sign in to continue")
    # The session cookie is sent automatically by the browser, so a changing
    # request must also carry the CSRF token, which another site cannot read.
    if request.method not in SAFE_METHODS:
        sent = request.headers.get(CSRF_HEADER, "")
        if not hmac.compare_digest(sent, session.csrf_token):
            raise ApiError(403, "csrf_failed", "Missing or invalid CSRF token")
    return session


async def require_user(session: Annotated[Session, Depends(require_session)]) -> User:
    return session.user


async def require_admin(user: Annotated[User, Depends(require_user)]) -> User:
    if not user.is_admin:
        raise ApiError(403, "forbidden", "Administrator access required")
    return user


CurrentUser = Annotated[User, Depends(require_user)]
AdminUser = Annotated[User, Depends(require_admin)]
