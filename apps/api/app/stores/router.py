from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Product, ProductImage, ProductStatus
from app.catalog.queries import escape_like
from app.database import get_session
from app.errors import not_found
from app.locale import display_name, name_column
from app.reference.models import Category
from app.storage import avatar_url, image_url
from app.stores.models import Store, StoreAudience, StorePolicy, StoreStatus
from app.stores.schemas import CityOut, PolicyOut, StoreList, StoreOut

router = APIRouter(prefix="/stores", tags=["stores"])

PREVIEW_IMAGES = 3


async def current_policy(session: AsyncSession, store_id) -> PolicyOut | None:
    """The latest version of the store's conditions."""
    policy = await session.scalar(
        select(StorePolicy)
        .where(StorePolicy.store_id == store_id)
        .order_by(StorePolicy.version.desc())
        .limit(1)
    )
    if policy is None:
        return None
    return PolicyOut(
        version=policy.version,
        updated_at=policy.created_at,
        pickup_available=policy.pickup_available,
        delivery_available=policy.delivery_available,
        delivery_areas=policy.delivery_areas,
        delivery_fee_minor=policy.delivery_fee_minor,
        delivery_time=policy.delivery_time,
        try_on_at_delivery=policy.try_on_at_delivery,
        payment_methods=policy.payment_methods,
        return_days=policy.return_days,
        return_terms=policy.return_terms,
    )


async def to_store_out(session: AsyncSession, store: Store) -> StoreOut:
    published = (Product.store_id == store.id) & (Product.status == ProductStatus.PUBLISHED)

    product_count = await session.scalar(select(func.count()).select_from(Product).where(published))
    categories = await session.scalars(
        select(name_column(Category))
        .join(Product, Product.category_code == Category.code)
        .where(published)
        .group_by(Category.code)
        .order_by(func.count().desc(), name_column(Category))
    )
    preview_images = await session.execute(
        select(ProductImage.object_key, ProductImage.external_url)
        .join(Product, Product.id == ProductImage.product_id)
        .where(published, ProductImage.position == 0)
        .order_by(Product.created_at.desc(), Product.id)
        .limit(PREVIEW_IMAGES)
    )

    return StoreOut(
        policy=await current_policy(session, store.id),
        id=store.id,
        slug=store.slug,
        name=store.name,
        description=store.description,
        city=CityOut(code=store.city.code, name=display_name(store.city)),
        address=store.address,
        market=store.market,
        sector=store.sector,
        container=store.container,
        working_hours=store.working_hours,
        phone=store.phone,
        whatsapp=store.whatsapp,
        instagram=store.instagram,
        website=store.website,
        is_demo=store.is_demo,
        audiences=store.audiences,
        avatar_url=avatar_url(store.avatar_key),
        product_count=product_count or 0,
        categories=list(categories),
        preview_images=[
            url for key, external in preview_images if (url := image_url(key, external))
        ],
    )


@router.get("")
async def list_stores(
    audience: StoreAudience | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    session: AsyncSession = Depends(get_session),
) -> StoreList:
    query = select(Store).where(Store.status == StoreStatus.ACTIVE).order_by(Store.name)
    if audience:
        query = query.where(Store.audiences.contains([audience.value]))
    if q and (words := q.split()):
        # Every word must occur in the name, the description or the address.
        for word in words:
            pattern = f"%{escape_like(word)}%"
            query = query.where(
                or_(
                    Store.name.ilike(pattern),
                    Store.description.ilike(pattern),
                    Store.address.ilike(pattern),
                    Store.market.ilike(pattern),
                )
            )
    stores = await session.scalars(query)
    return StoreList(items=[await to_store_out(session, store) for store in stores.unique()])


@router.get("/{slug}")
async def get_store(slug: str, session: AsyncSession = Depends(get_session)) -> StoreOut:
    store = await session.scalar(
        select(Store).where(Store.slug == slug, Store.status == StoreStatus.ACTIVE)
    )
    if store is None:
        raise not_found("Store not found")
    return await to_store_out(session, store)
