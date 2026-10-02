import base64
import binascii
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Select, and_, distinct, func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.catalog.models import Availability, Product, ProductStatus, ProductVariant
from app.errors import ApiError
from app.reference.models import Category
from app.stores.models import Store, StoreStatus


class Sort(StrEnum):
    NEWEST = "newest"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"


@dataclass
class ProductFilter:
    q: str | None = None
    category: str | None = None
    audience: str | None = None
    size_system: str | None = None
    size_label: str | None = None
    color: str | None = None
    price_min_minor: int | None = None
    price_max_minor: int | None = None
    store_id: uuid.UUID | None = None
    store: str | None = None
    city_id: str | None = None
    in_stock: bool = False
    ids: list[uuid.UUID] = field(default_factory=list)


# A variant's price: its own override, otherwise the product's base price.
EFFECTIVE_PRICE = func.coalesce(ProductVariant.price_override_minor, Product.base_price_minor)


def visible_products() -> list[Any]:
    """Only published products of active stores are ever shown to buyers."""
    return [Product.status == ProductStatus.PUBLISHED, Store.status == StoreStatus.ACTIVE]


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def matching_variants(filters: ProductFilter) -> Select:
    """One row per product that has at least one variant satisfying every filter.

    All variant conditions (size, colour, stock, price) are applied to the same
    variant row, so "black" and "L" only match when one variant is both. The
    price is the lowest among the matching variants.
    """
    conditions = visible_products()

    if filters.category:
        conditions.append(Product.category_code == filters.category)
    if filters.audience:
        conditions.append(Product.audience == filters.audience)
    if filters.store_id:
        conditions.append(Product.store_id == filters.store_id)
    if filters.store:
        conditions.append(Store.slug == filters.store)
    if filters.city_id:
        conditions.append(Store.city_code == filters.city_id)
    if filters.ids:
        conditions.append(Product.id.in_(filters.ids))
    for word in (filters.q or "").split():
        pattern = f"%{escape_like(word)}%"
        conditions.append(
            or_(
                Product.title.ilike(pattern),
                Product.brand.ilike(pattern),
                Store.name.ilike(pattern),
                Category.name_ru.ilike(pattern),
            )
        )

    if filters.size_label:
        conditions.append(ProductVariant.size_label == filters.size_label)
    if filters.size_system:
        conditions.append(ProductVariant.size_system == filters.size_system)
    if filters.color:
        conditions.append(ProductVariant.color_code == filters.color)
    if filters.in_stock:
        conditions.append(ProductVariant.availability_status == Availability.IN_STOCK)
    if filters.price_min_minor is not None:
        conditions.append(EFFECTIVE_PRICE >= filters.price_min_minor)
    if filters.price_max_minor is not None:
        conditions.append(EFFECTIVE_PRICE <= filters.price_max_minor)

    return (
        select(
            ProductVariant.product_id.label("product_id"),
            func.min(EFFECTIVE_PRICE).label("price_minor"),
            (func.count(distinct(EFFECTIVE_PRICE)) > 1).label("price_varies"),
        )
        .join(Product, Product.id == ProductVariant.product_id)
        .join(Store, Store.id == Product.store_id)
        .join(Category, Category.code == Product.category_code)
        .where(*conditions)
        .group_by(ProductVariant.product_id)
    )


def encode_cursor(value: Any, product_id: uuid.UUID) -> str:
    if isinstance(value, datetime):
        value = value.isoformat()
    raw = json.dumps([value, str(product_id)]).encode()
    return base64.urlsafe_b64encode(raw).decode()


def decode_cursor(cursor: str, sort: Sort) -> tuple[Any, uuid.UUID]:
    try:
        value, product_id = json.loads(base64.urlsafe_b64decode(cursor.encode()))
        if sort is Sort.NEWEST:
            value = datetime.fromisoformat(value)
        elif not isinstance(value, int):
            raise ValueError("price cursor must be an integer")
        return value, uuid.UUID(product_id)
    except (ValueError, TypeError, binascii.Error) as error:
        raise ApiError(400, "invalid_cursor", "The cursor is not valid for this request") from error


PRODUCT_LOADING = (
    selectinload(Product.variants),
    selectinload(Product.images),
    joinedload(Product.store),
    joinedload(Product.category),
)


async def list_products(
    session: AsyncSession, filters: ProductFilter, sort: Sort, cursor: str | None, limit: int
) -> tuple[list[tuple[Product, int, bool]], int, str | None]:
    matched = matching_variants(filters).subquery()
    total = await session.scalar(select(func.count()).select_from(matched)) or 0

    statement = (
        select(Product, matched.c.price_minor, matched.c.price_varies)
        .join(matched, matched.c.product_id == Product.id)
        .options(*PRODUCT_LOADING)
    )

    # Every ordering ends with the id, so equal prices or timestamps keep a stable order
    # and the cursor (last sort value, last id) always points at one exact position.
    price = matched.c.price_minor
    if sort is Sort.PRICE_ASC:
        statement = statement.order_by(price, Product.id)
    elif sort is Sort.PRICE_DESC:
        statement = statement.order_by(price.desc(), Product.id)
    else:
        statement = statement.order_by(Product.created_at.desc(), Product.id)

    if cursor:
        value, last_id = decode_cursor(cursor, sort)
        if sort is Sort.PRICE_ASC:
            statement = statement.where(tuple_(price, Product.id) > (value, last_id))
        else:
            column = price if sort is Sort.PRICE_DESC else Product.created_at
            statement = statement.where(
                or_(column < value, and_(column == value, Product.id > last_id))
            )

    rows = (await session.execute(statement.limit(limit + 1))).unique().all()
    page = [(row[0], row[1], row[2]) for row in rows[:limit]]

    next_cursor = None
    if len(rows) > limit:
        last_product, last_price, _ = page[-1]
        value = last_product.created_at if sort is Sort.NEWEST else last_price
        next_cursor = encode_cursor(value, last_product.id)
    return page, total, next_cursor


async def get_product(session: AsyncSession, product_id: uuid.UUID) -> Product | None:
    statement = (
        select(Product)
        .join(Store, Store.id == Product.store_id)
        .where(Product.id == product_id, *visible_products())
        .options(*PRODUCT_LOADING)
    )
    return (await session.execute(statement)).unique().scalar_one_or_none()
