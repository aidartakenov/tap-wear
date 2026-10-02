"""Imports every model so that Base.metadata is complete for Alembic."""

from app.accounts.models import AccountToken, Favorite, Session, User
from app.analytics.models import Event
from app.catalog.models import Product, ProductImage, ProductVariant
from app.moderation.models import ModerationLog, Report
from app.reference.models import Category, City, Color
from app.stores.models import Store, StoreMember, StorePolicy

__all__ = [
    "AccountToken",
    "Category",
    "City",
    "Color",
    "Event",
    "Favorite",
    "ModerationLog",
    "Product",
    "ProductImage",
    "ProductVariant",
    "Report",
    "Session",
    "Store",
    "StoreMember",
    "StorePolicy",
    "User",
]
