"""Display language of reference names (categories, colours, cities).

The language comes from the request's Accept-Language header. Russian is the
default and the fallback for any name that has no Kyrgyz translation yet.
"""

from contextvars import ContextVar

from fastapi import Request
from sqlalchemy import func

SUPPORTED = ("ru", "ky")
_locale: ContextVar[str] = ContextVar("locale", default="ru")


async def use_request_locale(request: Request) -> None:
    header = request.headers.get("accept-language", "")
    first = header.split(",")[0].split("-")[0].strip().lower()
    _locale.set(first if first in SUPPORTED else "ru")


def current_locale() -> str:
    return _locale.get()


def display_name(item) -> str:
    """Name of a reference row (City, Category, Color) in the request's language."""
    if current_locale() == "ky" and item.name_ky:
        return item.name_ky
    return item.name_ru


def name_column(model):
    """The same choice as display_name, as an SQL expression."""
    if current_locale() == "ky":
        return func.coalesce(model.name_ky, model.name_ru)
    return model.name_ru
