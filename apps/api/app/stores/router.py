from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Product, ProductImage, ProductStatus
from app.database import get_session
from app.errors import not_found
from app.locale import display_name, name_column
from app.reference.models import Category
from app.storage import image_url
from app.stores.models import Store, StoreStatus
from app.stores.schemas import CityOut, StoreList, StoreOut

router = APIRouter(prefix="/stores", tags=["stores"])

PREVIEW_IMAGES = 3


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
        product_count=product_count or 0,
        categories=list(categories),
        preview_images=[
            url for key, external in preview_images if (url := image_url(key, external))
        ],
    )


@router.get("")
async def list_stores(session: AsyncSession = Depends(get_session)) -> StoreList:
    stores = await session.scalars(
        select(Store).where(Store.status == StoreStatus.ACTIVE).order_by(Store.name)
    )
    return StoreList(items=[await to_store_out(session, store) for store in stores.unique()])


@router.get("/{slug}")
async def get_store(slug: str, session: AsyncSession = Depends(get_session)) -> StoreOut:
    store = await session.scalar(
        select(Store).where(Store.slug == slug, Store.status == StoreStatus.ACTIVE)
    )
    if store is None:
        raise not_found("Store not found")
    return await to_store_out(session, store)
