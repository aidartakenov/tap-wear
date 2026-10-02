"""The administrator's overview of the site, and managing accounts."""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import Date, cast, func, literal_column, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.deps import AdminUser
from app.accounts.models import Session, User
from app.catalog.models import Product, ProductStatus
from app.catalog.queries import escape_like
from app.database import get_session
from app.errors import ApiError, not_found
from app.orders.models import Order, OrderStatus
from app.stores.models import Store, StoreMember, StoreStatus

router = APIRouter(prefix="/admin", tags=["admin"])

Db = Annotated[AsyncSession, Depends(get_session)]

# Orders that brought money and were not called off afterwards.
SOLD = (OrderStatus.PAID, OrderStatus.ACCEPTED, OrderStatus.SHIPPED, OrderStatus.COMPLETED)
# Days are counted in the site's own time zone.
SITE_TIME_ZONE = "Asia/Bishkek"


class Day(BaseModel):
    day: date
    orders: int
    turnover_minor: int
    new_users: int
    new_stores: int


class Overview(BaseModel):
    users: int
    stores_active: int
    stores_pending: int
    products_published: int
    products_pending: int
    # Over the chosen period.
    orders: int
    turnover_minor: int
    refunded: int
    days: list[Day]


def local_day(column):
    # The zone is written into the query text, so SELECT and GROUP BY are the same expression.
    return cast(func.timezone(literal_column(f"'{SITE_TIME_ZONE}'"), column), Date)


@router.get("/overview")
async def overview(_: AdminUser, db: Db, days: Annotated[int, Query(ge=1, le=90)] = 30) -> Overview:
    zone = ZoneInfo(SITE_TIME_ZONE)
    today = datetime.now(zone).date()
    first_day = today - timedelta(days=days - 1)
    # From the start of the first day, in the site's time.
    since = datetime.combine(first_day, datetime.min.time(), tzinfo=zone).astimezone(UTC)

    async def count(query) -> int:
        return await db.scalar(query) or 0

    async def per_day(column, *conditions, value=None) -> dict[date, int]:
        rows = await db.execute(
            select(local_day(column), value if value is not None else func.count())
            .where(column >= since, *conditions)
            .group_by(local_day(column))
        )
        return dict(rows.all())

    sold = Order.status.in_(SOLD)
    orders = await per_day(Order.paid_at, sold)
    turnover = await per_day(Order.paid_at, sold, value=func.sum(Order.total_minor))
    new_users = await per_day(User.created_at)
    new_stores = await per_day(Store.created_at, Store.is_demo.is_(False))

    series = [
        Day(
            day=day,
            orders=orders.get(day, 0),
            turnover_minor=int(turnover.get(day, 0)),
            new_users=new_users.get(day, 0),
            new_stores=new_stores.get(day, 0),
        )
        for day in (first_day + timedelta(days=offset) for offset in range(days))
    ]

    return Overview(
        users=await count(select(func.count()).select_from(User)),
        stores_active=await count(
            select(func.count()).select_from(Store).where(Store.status == StoreStatus.ACTIVE)
        ),
        stores_pending=await count(
            select(func.count())
            .select_from(Store)
            .where(Store.status == StoreStatus.PENDING_REVIEW)
        ),
        products_published=await count(
            select(func.count())
            .select_from(Product)
            .where(Product.status == ProductStatus.PUBLISHED)
        ),
        products_pending=await count(
            select(func.count())
            .select_from(Product)
            .where(Product.status == ProductStatus.PENDING_REVIEW)
        ),
        orders=sum(orders.values()),
        turnover_minor=int(sum(turnover.values())),
        refunded=await count(
            select(func.count())
            .select_from(Order)
            .where(Order.status == OrderStatus.REFUNDED, Order.paid_at >= since)
        ),
        days=series,
    )


# --- Accounts -----------------------------------------------------------------------


class UserRow(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    is_admin: bool
    is_active: bool
    email_verified: bool
    created_at: datetime
    stores: list[str]
    orders: int


class UserList(BaseModel):
    items: list[UserRow]
    total: int


class UserChange(BaseModel):
    # Only what is given changes.
    is_active: bool | None = None
    is_admin: bool | None = None


async def user_row(db: AsyncSession, user: User) -> UserRow:
    stores = await db.scalars(
        select(Store.name)
        .join(StoreMember, StoreMember.store_id == Store.id)
        .where(StoreMember.user_id == user.id)
        .order_by(Store.name)
    )
    orders = await db.scalar(
        select(func.count()).select_from(Order).where(Order.user_id == user.id)
    )
    return UserRow(
        id=user.id,
        email=user.email,
        name=user.name,
        is_admin=user.is_admin,
        is_active=user.is_active,
        email_verified=user.email_verified_at is not None,
        created_at=user.created_at,
        stores=list(stores),
        orders=orders or 0,
    )


@router.get("/users")
async def list_users(
    _: AdminUser,
    db: Db,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> UserList:
    query = select(User)
    if q and q.strip():
        pattern = f"%{escape_like(q.strip())}%"
        query = query.where(or_(User.email.ilike(pattern), User.name.ilike(pattern)))
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    users = await db.scalars(
        query.order_by(User.created_at.desc(), User.id).limit(limit).offset(offset)
    )
    return UserList(items=[await user_row(db, user) for user in users], total=total or 0)


@router.patch("/users/{user_id}")
async def change_user(user_id: uuid.UUID, body: UserChange, admin: AdminUser, db: Db) -> UserRow:
    """Block or unblock an account, or give or take administrator rights."""
    user = await db.get(User, user_id)
    if user is None:
        raise not_found("Account not found")
    if user.id == admin.id:
        # Otherwise the last administrator could lock everyone out, themselves included.
        raise ApiError(409, "own_account", "You cannot change your own account here")
    if body.is_admin is not None:
        user.is_admin = body.is_admin
    if body.is_active is not None:
        user.is_active = body.is_active
        if not body.is_active:
            # A blocked account is signed out everywhere at once.
            await db.execute(
                update(Session)
                .where(Session.user_id == user.id, Session.revoked_at.is_(None))
                .values(revoked_at=datetime.now(UTC))
            )
    await db.commit()
    await db.refresh(user)
    return await user_row(db, user)
