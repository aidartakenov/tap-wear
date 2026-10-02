"""Who may touch what. Every merchant endpoint goes through these checks."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.accounts.models import User
from app.catalog.models import Product, ProductStatus, ProductVariant
from app.errors import ApiError, not_found
from app.stores.models import MemberRole, Store, StoreMember


async def membership(db: AsyncSession, user: User, store_id: uuid.UUID) -> StoreMember:
    """The user's membership in the store.

    A store the user does not belong to is reported as "not found", the same as a
    store that does not exist, so ids of other stores cannot be probed.
    """
    member = await db.scalar(
        select(StoreMember).where(StoreMember.store_id == store_id, StoreMember.user_id == user.id)
    )
    if member is None:
        raise not_found("Store not found")
    return member


async def owner_membership(db: AsyncSession, user: User, store_id: uuid.UUID) -> StoreMember:
    member = await membership(db, user, store_id)
    if member.role != MemberRole.OWNER:
        raise ApiError(403, "forbidden", "Only the store owner can do this")
    return member


async def store_for(db: AsyncSession, user: User, store_id: uuid.UUID) -> tuple[Store, StoreMember]:
    member = await membership(db, user, store_id)
    store = await db.get(Store, store_id)
    return store, member


PRODUCT_LOADING = (
    selectinload(Product.variants),
    selectinload(Product.images),
    joinedload(Product.category),
)


async def product_for(
    db: AsyncSession, user: User, product_id: uuid.UUID, *, lock: bool = False
) -> Product:
    """A product of one of the user's stores, in any status."""
    statement = select(Product).where(Product.id == product_id).options(*PRODUCT_LOADING)
    if lock:
        # Serialises concurrent edits of the same product, so the version check is reliable.
        statement = statement.with_for_update(of=Product)
    product = (await db.execute(statement)).unique().scalar_one_or_none()
    if product is None:
        raise not_found("Product not found")
    try:
        await membership(db, user, product.store_id)
    except ApiError as error:
        raise not_found("Product not found") from error
    return product


def ensure_editable(product: Product) -> None:
    if product.status == ProductStatus.BLOCKED:
        raise ApiError(403, "product_blocked", "This product was blocked by an administrator")


async def variant_for(db: AsyncSession, user: User, variant_id: uuid.UUID) -> ProductVariant:
    variant = await db.scalar(
        select(ProductVariant)
        .where(ProductVariant.id == variant_id)
        .options(joinedload(ProductVariant.product))
    )
    if variant is None:
        raise not_found("Variant not found")
    try:
        await membership(db, user, variant.product.store_id)
    except ApiError as error:
        raise not_found("Variant not found") from error
    ensure_editable(variant.product)
    return variant
