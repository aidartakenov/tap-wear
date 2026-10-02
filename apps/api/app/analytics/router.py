import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import case, distinct, func, literal_column, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.deps import CurrentUser
from app.analytics.models import Event
from app.catalog.availability import stale_before
from app.catalog.models import Availability, Product, ProductStatus, ProductVariant
from app.catalog.queries import visible_products
from app.database import get_session
from app.merchant.access import membership
from app.stores.models import Store

Db = Annotated[AsyncSession, Depends(get_session)]

events_router = APIRouter(tags=["events"])
analytics_router = APIRouter(prefix="/merchant", tags=["merchant"])

# An event may be reported a little late (offline, slow network) but not arbitrarily.
MAX_EVENT_AGE = timedelta(days=1)


class EventIn(BaseModel):
    event_id: uuid.UUID
    session_id: uuid.UUID
    type: Literal["product_view", "store_view", "contact_click"]
    product_id: uuid.UUID | None = None
    # Used for store_view; for product events the store is taken from the product.
    store_slug: Annotated[str, StringConstraints(max_length=100)] | None = None
    variant_id: uuid.UUID | None = None
    channel: Literal["whatsapp", "phone", "instagram", "website"] | None = None
    source: Annotated[str, StringConstraints(max_length=50, pattern=r"^[a-z0-9_.-]+$")] | None = (
        None
    )
    occurred_at: datetime | None = None


class EventsIn(BaseModel):
    events: Annotated[list[EventIn], Field(min_length=1, max_length=20)]


class EventsOut(BaseModel):
    accepted: int


@events_router.post("/events", status_code=202)
async def record_events(body: EventsIn, db: Db) -> EventsOut:
    """Record visitor events. Sending the same event_id again has no effect."""
    product_ids = {event.product_id for event in body.events if event.product_id}
    slugs = {event.store_slug for event in body.events if event.store_slug}

    # Only events about products and stores a buyer can see are kept, and the
    # store always comes from our own data, never from what the browser claims.
    product_stores = {}
    if product_ids:
        rows = await db.execute(
            select(Product.id, Product.store_id)
            .join(Store, Store.id == Product.store_id)
            .where(Product.id.in_(product_ids), *visible_products())
        )
        product_stores = dict(rows.all())
    store_ids = {}
    if slugs:
        rows = await db.execute(
            select(Store.slug, Store.id).where(Store.slug.in_(slugs), visible_products()[1])
        )
        store_ids = dict(rows.all())

    now = datetime.now(UTC)
    values = []
    for event in body.events:
        if event.product_id and event.type != "store_view":
            store_id, product_id = product_stores.get(event.product_id), event.product_id
        else:
            # A storefront view, or a contact click made on the storefront itself.
            store_id, product_id = store_ids.get(event.store_slug), None
        if store_id is None:
            continue
        occurred = event.occurred_at or now
        if occurred.tzinfo is None:
            occurred = occurred.replace(tzinfo=UTC)
        if not now - MAX_EVENT_AGE <= occurred <= now + timedelta(minutes=5):
            occurred = now
        values.append(
            {
                "id": event.event_id,
                "session_id": event.session_id,
                "type": event.type,
                "store_id": store_id,
                "product_id": product_id,
                "variant_id": event.variant_id,
                "channel": event.channel if event.type == "contact_click" else None,
                "source": event.source,
                "occurred_at": occurred,
            }
        )

    accepted = 0
    if values:
        result = await db.execute(
            insert(Event).values(values).on_conflict_do_nothing(index_elements=[Event.id])
        )
        accepted = result.rowcount
        await db.commit()
    return EventsOut(accepted=accepted)


class TopProduct(BaseModel):
    id: uuid.UUID
    title: str
    views: int
    contacts: int


class Count(BaseModel):
    key: str
    count: int


class DayCount(BaseModel):
    date: str
    product_views: int
    contact_clicks: int


class Freshness(BaseModel):
    # "In stock" variants of published products, and how many of them have a
    # confirmation recent enough for buyers to be told "in stock".
    in_stock_variants: int
    confirmed_recently: int
    needs_confirmation: int


class StoreAnalytics(BaseModel):
    days: int
    # Visits to the store's own page.
    store_views: int
    # Times a product card of this store was opened.
    product_views: int
    # Distinct visitors (browser sessions) who opened the store page or a product.
    visitors: int
    # Clicks on WhatsApp, phone, Instagram or the store's site. A click is not a sale.
    contact_clicks: int
    # Distinct visitors who clicked a contact button.
    contacting_visitors: int
    contacts_by_channel: list[Count]
    sources: list[Count]
    top_products: list[TopProduct]
    daily: list[DayCount]
    freshness: Freshness


@analytics_router.get("/analytics")
async def store_analytics(
    store_id: uuid.UUID,
    user: CurrentUser,
    db: Db,
    days: Annotated[int, Query(ge=1, le=90)] = 7,
) -> StoreAnalytics:
    """Views and contact clicks of one store. Only its own members may see them."""
    await membership(db, user, store_id)
    since = datetime.now(UTC) - timedelta(days=days)
    in_period = (Event.store_id == store_id) & (Event.occurred_at >= since)

    def count_of(event_type: str):
        return func.count().filter(Event.type == event_type)

    totals = (
        await db.execute(
            select(
                count_of("store_view"),
                count_of("product_view"),
                count_of("contact_click"),
                func.count(distinct(Event.session_id)),
                func.count(distinct(Event.session_id)).filter(Event.type == "contact_click"),
            ).where(in_period)
        )
    ).one()

    channels = await db.execute(
        select(Event.channel, func.count())
        .where(in_period, Event.type == "contact_click", Event.channel.is_not(None))
        .group_by(Event.channel)
        .order_by(func.count().desc())
    )
    # A visitor counts once per source, however many pages they opened.
    # Constants are written into the SQL text (not sent as parameters), so that
    # the SELECT and GROUP BY expressions are recognised as the same.
    source = func.coalesce(Event.source, literal_column("'direct'"))
    sources = await db.execute(
        select(source, func.count(distinct(Event.session_id)))
        .where(in_period)
        .group_by(source)
        .order_by(func.count(distinct(Event.session_id)).desc())
        .limit(10)
    )
    top = await db.execute(
        select(
            Product.id,
            Product.title,
            count_of("product_view").label("views"),
            count_of("contact_click").label("contacts"),
        )
        .join(Event, Event.product_id == Product.id)
        .where(in_period)
        .group_by(Product.id)
        .order_by(count_of("product_view").desc(), Product.title)
        .limit(10)
    )
    # Days are counted in Bishkek time, which is what the seller sees on the clock.
    day = func.to_char(
        func.timezone(literal_column("'Asia/Bishkek'"), Event.occurred_at),
        literal_column("'YYYY-MM-DD'"),
    )
    daily = await db.execute(
        select(day, count_of("product_view"), count_of("contact_click"))
        .where(in_period)
        .group_by(day)
        .order_by(day)
    )

    fresh = case((ProductVariant.availability_confirmed_at >= stale_before(), 1), else_=0)
    in_stock, confirmed = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(fresh), 0))
            .select_from(ProductVariant)
            .join(Product, Product.id == ProductVariant.product_id)
            .where(
                Product.store_id == store_id,
                Product.status == ProductStatus.PUBLISHED,
                ProductVariant.availability_status == Availability.IN_STOCK,
            )
        )
    ).one()

    return StoreAnalytics(
        days=days,
        store_views=totals[0],
        product_views=totals[1],
        contact_clicks=totals[2],
        visitors=totals[3],
        contacting_visitors=totals[4],
        contacts_by_channel=[Count(key=key, count=count) for key, count in channels],
        sources=[Count(key=key, count=count) for key, count in sources],
        top_products=[
            TopProduct(id=id_, title=title, views=views, contacts=contacts)
            for id_, title, views, contacts in top
        ],
        daily=[
            DayCount(date=date, product_views=views, contact_clicks=contacts)
            for date, views, contacts in daily
        ],
        freshness=Freshness(
            in_stock_variants=in_stock,
            confirmed_recently=confirmed,
            needs_confirmation=in_stock - confirmed,
        ),
    )
