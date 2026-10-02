"""Telegram messages to stores, through a bot.

A store connects by opening the bot with a one-time code (https://t.me/<bot>?start=<code>)
and pressing Start; "check connection" in the cabinet then finds that message and
remembers the chat. No public address is needed for this: the bot's recent
messages are read on request.

Without TELEGRAM_BOT_TOKEN nothing is sent anywhere: messages are written to
the log and kept in `outbox`, and connecting succeeds at once, so the flow can
be tried locally.
"""

import asyncio
import json
import logging
import ssl
import urllib.parse
import urllib.request
from collections import deque
from dataclasses import dataclass
from functools import lru_cache

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

API = "https://api.telegram.org"
TIMEOUT = 15
# The chat recorded when no bot is configured.
CONSOLE_CHAT = "console"


@dataclass
class SentMessage:
    chat_id: str
    text: str


# The most recent messages when no bot is configured, newest last.
outbox: deque[SentMessage] = deque(maxlen=50)


def configured() -> bool:
    return settings.telegram_bot_token is not None


@lru_cache
def _tls() -> ssl.SSLContext:
    try:
        import certifi
    except ImportError:
        return ssl.create_default_context()
    return ssl.create_default_context(cafile=certifi.where())


def _call(method: str, **params) -> dict:
    token = settings.telegram_bot_token.get_secret_value()
    request = urllib.request.Request(  # noqa: S310 - a fixed https address
        f"{API}/bot{token}/{method}",
        data=urllib.parse.urlencode(params).encode(),
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT, context=_tls()) as response:  # noqa: S310
        return json.loads(response.read())


async def send(chat_id: str, text: str) -> None:
    """Send a message. A failure is logged and never breaks what caused the message."""
    if not configured() or chat_id == CONSOLE_CHAT:
        outbox.append(SentMessage(chat_id=chat_id, text=text))
        logger.info("Telegram (no bot configured) to %s:\n%s", chat_id, text)
        return
    try:
        await asyncio.to_thread(_call, "sendMessage", chat_id=chat_id, text=text)
    except Exception:  # noqa: BLE001
        logger.exception("Could not send a Telegram message to %s", chat_id)


def link(code: str) -> str | None:
    """The address a store owner opens to start the bot with their code."""
    if not configured() or not settings.telegram_bot_username:
        return None
    return f"https://t.me/{settings.telegram_bot_username}?start={code}"


async def chat_that_sent(code: str) -> str | None:
    """The chat that started the bot with this code, if one did recently."""
    if not configured():
        return CONSOLE_CHAT
    try:
        updates = await asyncio.to_thread(_call, "getUpdates", timeout=0)
    except Exception:  # noqa: BLE001
        logger.exception("Could not read the Telegram bot's messages")
        return None
    for update in reversed(updates.get("result", [])):
        message = update.get("message") or {}
        if message.get("text", "").strip() == f"/start {code}":
            return str(message["chat"]["id"])
    return None
