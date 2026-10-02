"""The signed-in person's own data: profile, password and saved products."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.deps import CurrentUser, require_session
from app.accounts.models import Favorite, Session
from app.accounts.router import MeOut, me_out
from app.accounts.security import hash_password, verify_password
from app.catalog.models import Product
from app.catalog.queries import visible_products
from app.database import get_session
from app.errors import ApiError, not_found
from app.stores.models import Store

router = APIRouter(tags=["account"])

Db = Annotated[AsyncSession, Depends(get_session)]

MAX_FAVORITES = 500


class ProfileIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class PasswordIn(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


class FavoriteIds(BaseModel):
    # Newest first.
    ids: list[uuid.UUID]


class MergeIn(BaseModel):
    ids: Annotated[list[uuid.UUID], Field(max_length=MAX_FAVORITES)]


async def favorite_ids(db: AsyncSession, user_id: uuid.UUID) -> FavoriteIds:
    ids = await db.scalars(
        select(Favorite.product_id)
        .where(Favorite.user_id == user_id)
        .order_by(Favorite.created_at.desc(), Favorite.product_id)
    )
    return FavoriteIds(ids=list(ids))


async def visible_ids(db: AsyncSession, ids: list[uuid.UUID]) -> list[uuid.UUID]:
    """Only products a buyer can actually see may be saved."""
    if not ids:
        return []
    found = await db.scalars(
        select(Product.id)
        .join(Store, Store.id == Product.store_id)
        .where(Product.id.in_(ids), *visible_products())
    )
    return list(found)


async def add_favorites(db: AsyncSession, user_id: uuid.UUID, ids: list[uuid.UUID]) -> None:
    count = len((await favorite_ids(db, user_id)).ids)
    ids = (await visible_ids(db, ids))[: max(0, MAX_FAVORITES - count)]
    if ids:
        # Saving the same product twice is not an error.
        await db.execute(
            insert(Favorite)
            .values([{"user_id": user_id, "product_id": product_id} for product_id in ids])
            .on_conflict_do_nothing()
        )
    await db.commit()


@router.patch("/auth/me")
async def update_profile(
    body: ProfileIn, session: Annotated[Session, Depends(require_session)], db: Db
) -> MeOut:
    session.user.name = body.name
    await db.commit()
    return await me_out(db, session)


@router.post("/auth/password", status_code=204)
async def change_password(
    body: PasswordIn, session: Annotated[Session, Depends(require_session)], db: Db
) -> None:
    user = session.user
    if not verify_password(body.current_password, user.password_hash):
        raise ApiError(403, "wrong_password", "The current password is wrong")
    user.password_hash = hash_password(body.new_password)
    # Sign out every other device; this session stays.
    await db.execute(
        update(Session)
        .where(Session.user_id == user.id, Session.id != session.id, Session.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()


@router.get("/me/favorites")
async def list_favorites(user: CurrentUser, db: Db) -> FavoriteIds:
    return await favorite_ids(db, user.id)


@router.put("/me/favorites/{product_id}")
async def add_favorite(product_id: uuid.UUID, user: CurrentUser, db: Db) -> FavoriteIds:
    if not await visible_ids(db, [product_id]):
        raise not_found("Product not found")
    await add_favorites(db, user.id, [product_id])
    return await favorite_ids(db, user.id)


@router.delete("/me/favorites/{product_id}")
async def remove_favorite(product_id: uuid.UUID, user: CurrentUser, db: Db) -> FavoriteIds:
    await db.execute(
        delete(Favorite).where(Favorite.user_id == user.id, Favorite.product_id == product_id)
    )
    await db.commit()
    return await favorite_ids(db, user.id)


@router.post("/me/favorites/merge")
async def merge_favorites(body: MergeIn, user: CurrentUser, db: Db) -> FavoriteIds:
    """Add the list a guest saved on this device to the account.

    Unknown or hidden products are skipped.
    """
    await add_favorites(db, user.id, body.ids)
    return await favorite_ids(db, user.id)
