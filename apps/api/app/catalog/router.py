import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.catalog.availability import effective_availability
from app.catalog.models import Audience, Availability, Product, ProductImage, ProductVariant
from app.catalog.queries import (
    EFFECTIVE_PRICE,
    ProductFilter,
    Sort,
    get_product,
    list_products,
    visible_products,
)
from app.catalog.schemas import (
    AudienceFacet,
    CatalogFilters,
    CategoryAudienceCount,
    CategoryFacet,
    CategoryOut,
    ColorOut,
    ProductDetail,
    ProductList,
    ProductListItem,
    SizeFacet,
    VariantOut,
)
from app.database import get_session
from app.errors import not_found
from app.locale import display_name, name_column
from app.reference.models import Category, Color
from app.stores.models import Store, StoreStatus
from app.stores.router import to_store_out
from app.stores.schemas import StoreBrief

router = APIRouter(tags=["catalog"])


def image_url(image: ProductImage) -> str | None:
    return storage.image_url(image.object_key, image.external_url)


def overall_availability(variants: list[ProductVariant]) -> Availability:
    statuses = {effective_availability(variant) for variant in variants}
    if Availability.IN_STOCK in statuses:
        return Availability.IN_STOCK
    # Without confirmed stock the product is "needs checking", never "in stock".
    if Availability.UNKNOWN in statuses:
        return Availability.UNKNOWN
    return Availability.OUT_OF_STOCK


def list_item_fields(product: Product, price_minor: int, price_varies: bool) -> dict:
    available = [
        variant
        for variant in product.variants
        if effective_availability(variant) != Availability.OUT_OF_STOCK
    ]
    colors = {
        variant.color.code: ColorOut(code=variant.color.code, name=display_name(variant.color))
        for variant in product.variants
        if variant.color
    }
    return {
        "id": product.id,
        "store": StoreBrief(
            id=product.store.id,
            slug=product.store.slug,
            name=product.store.name,
            is_demo=product.store.is_demo,
            avatar_url=storage.avatar_url(product.store.avatar_key),
        ),
        "title": product.title,
        "category": CategoryOut(code=product.category.code, name=display_name(product.category)),
        "audience": product.audience,
        "price_minor": price_minor,
        "price_varies": price_varies,
        "currency": product.currency,
        "brand": product.brand,
        "colors": list(colors.values()),
        "size_system": next((v.size_system for v in product.variants if v.size_system), None),
        "sizes": list(dict.fromkeys(v.size_label for v in available if v.size_label)),
        "availability": overall_availability(product.variants),
        "image_url": image_url(product.images[0]) if product.images else None,
    }


# Exact numbers are shown to buyers only when stock is running low.
FEW_LEFT = 5


def few_left(variant) -> int | None:
    if variant.stock_mode != "exact" or variant.quantity is None:
        return None
    return variant.quantity if 0 < variant.quantity <= FEW_LEFT else None


def product_filter(
    q: Annotated[str | None, Query(max_length=100, description="Words to search for")] = None,
    category: str | None = None,
    audience: Audience | None = None,
    size_system: str | None = None,
    size_label: str | None = None,
    color: str | None = None,
    price_min_minor: Annotated[int | None, Query(ge=0)] = None,
    price_max_minor: Annotated[int | None, Query(ge=0)] = None,
    store_id: uuid.UUID | None = None,
    store: Annotated[str | None, Query(description="Store slug")] = None,
    city_id: str | None = None,
    in_stock: bool = False,
    height_cm: Annotated[int | None, Query(ge=50, le=250)] = None,
    ids: Annotated[list[uuid.UUID] | None, Query(max_length=100)] = None,
) -> ProductFilter:
    return ProductFilter(
        q=q,
        category=category,
        audience=audience,
        size_system=size_system,
        size_label=size_label,
        color=color,
        price_min_minor=price_min_minor,
        price_max_minor=price_max_minor,
        store_id=store_id,
        store=store,
        city_id=city_id,
        in_stock=in_stock,
        height_cm=height_cm,
        ids=ids or [],
    )


@router.get("/products")
async def get_products(
    filters: Annotated[ProductFilter, Depends(product_filter)],
    sort: Sort = Sort.NEWEST,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    session: AsyncSession = Depends(get_session),
) -> ProductList:
    page, total, next_cursor = await list_products(session, filters, sort, cursor, limit)
    items = [
        ProductListItem(**list_item_fields(product, price_minor, price_varies))
        for product, price_minor, price_varies in page
    ]
    return ProductList(items=items, total=total, next_cursor=next_cursor)


@router.get("/products/{product_id}")
async def get_product_detail(
    product_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ProductDetail:
    product = await get_product(session, product_id)
    if product is None:
        raise not_found("Product not found")

    prices = [v.price_override_minor or product.base_price_minor for v in product.variants]
    fields = list_item_fields(product, min(prices), len(set(prices)) > 1)
    fields["store"] = await to_store_out(session, product.store)
    return ProductDetail(
        **fields,
        description=product.description,
        sku=product.sku,
        source_url=product.source_url,
        images=[url for image in product.images if (url := image_url(image))],
        image_colors=[image.color_code for image in product.images if image_url(image)],
        variants=[
            VariantOut(
                id=variant.id,
                size_system=variant.size_system,
                size_label=variant.size_label,
                color=(
                    ColorOut(code=variant.color.code, name=display_name(variant.color))
                    if variant.color
                    else None
                ),
                height_min_cm=variant.height_min_cm,
                height_max_cm=variant.height_max_cm,
                price_minor=variant.price_override_minor or product.base_price_minor,
                availability=effective_availability(variant),
                availability_confirmed_at=variant.availability_confirmed_at,
                left=few_left(variant),
            )
            for variant in product.variants
        ],
    )


@router.get("/catalog/filters")
async def get_catalog_filters(
    store: str | None = None, session: AsyncSession = Depends(get_session)
) -> CatalogFilters:
    """What the catalog can be filtered by. With `store` (a slug) it describes
    that store's own range, for the store's page."""
    visible_query = (
        select(Product.id).join(Store, Store.id == Product.store_id).where(*visible_products())
    )
    if store:
        visible_query = visible_query.where(Store.slug == store)
    visible = visible_query.subquery()
    in_catalog = Product.id.in_(select(visible.c.id))

    # First photo of the newest product in each group, used as the group's cover.
    def cover_query(group_column):
        return (
            select(group_column, ProductImage.object_key, ProductImage.external_url)
            .join(ProductImage, ProductImage.product_id == Product.id)
            .where(in_catalog, ProductImage.position == 0)
            .ext(distinct_on(group_column))
            .order_by(group_column, Product.created_at.desc(), Product.id)
        )

    async def covers(group_column) -> dict[str, str | None]:
        rows = await session.execute(cover_query(group_column))
        return {group: storage.image_url(key, url) for group, key, url in rows}

    audience_covers = await covers(Product.audience)
    category_covers = await covers(Product.category_code)

    counts = (
        await session.execute(
            select(Product.category_code, Product.audience, func.count())
            .where(in_catalog)
            .group_by(Product.category_code, Product.audience)
        )
    ).all()
    category_names = dict(
        (await session.execute(select(Category.code, name_column(Category)))).all()
    )

    audience_totals: dict[str, int] = {}
    by_category: dict[str, list[CategoryAudienceCount]] = {}
    for category_code, audience, count in counts:
        audience_totals[audience] = audience_totals.get(audience, 0) + count
        by_category.setdefault(category_code, []).append(
            CategoryAudienceCount(audience=audience, count=count)
        )

    categories = [
        CategoryFacet(
            code=code,
            name=category_names[code],
            count=sum(entry.count for entry in entries),
            cover_image=category_covers.get(code),
            by_audience=entries,
        )
        for code, entries in by_category.items()
    ]
    categories.sort(key=lambda category: (-category.count, category.name))

    colors = await session.execute(
        select(Color.code, name_column(Color))
        .join(ProductVariant, ProductVariant.color_code == Color.code)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(in_catalog)
        .group_by(Color.code)
        .order_by(name_column(Color))
    )
    sizes = await session.execute(
        select(ProductVariant.size_system, ProductVariant.size_label)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(in_catalog, ProductVariant.size_label.is_not(None))
        .distinct()
    )
    stores = await session.execute(
        select(Store.id, Store.slug, Store.name, Store.is_demo)
        .where(Store.status == StoreStatus.ACTIVE)
        .order_by(Store.name)
    )
    price_max = await session.scalar(
        select(func.max(EFFECTIVE_PRICE))
        .select_from(ProductVariant)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(in_catalog)
    )

    # Fixed audience order for menus: women, men, kids, unisex.
    audience_order = [Audience.WOMEN, Audience.MEN, Audience.KIDS, Audience.UNISEX]
    return CatalogFilters(
        audiences=[
            AudienceFacet(
                code=audience,
                count=audience_totals[audience],
                cover_image=audience_covers.get(audience),
            )
            for audience in audience_order
            if audience in audience_totals
        ],
        categories=categories,
        colors=[ColorOut(code=code, name=name) for code, name in colors],
        sizes=sorted(
            (SizeFacet(system=system, label=label) for system, label in sizes),
            # Numeric labels in numeric order, then letter sizes.
            key=lambda size: (not size.label.isdigit(), size.label.zfill(8)),
        ),
        stores=[
            StoreBrief(id=id_, slug=slug, name=name, is_demo=is_demo)
            for id_, slug, name, is_demo in stores
        ],
        price_max_minor=price_max or 0,
        product_count=sum(audience_totals.values()),
    )
