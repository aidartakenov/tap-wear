"""Imports every model so that Base.metadata is complete for Alembic."""

from app.accounts.models import Session, User
from app.catalog.models import Product, ProductImage, ProductVariant
from app.moderation.models import ModerationLog, Report
from app.reference.models import Category, City, Color
from app.stores.models import Store, StoreMember

__all__ = [
    "Category",
    "City",
    "Color",
    "ModerationLog",
    "Product",
    "ProductImage",
    "ProductVariant",
    "Report",
    "Session",
    "Store",
    "StoreMember",
    "User",
]
