"""Search by photo: the buyer's picture is compared with the catalog's photos."""

import asyncio
import io
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, UploadFile
from PIL import Image
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app import storage
from app.catalog.models import Product, ProductImage, ProductStatus
from app.catalog.queries import PRODUCT_LOADING, ProductFilter, matching_variants
from app.catalog.router import list_item_fields, product_filter
from app.catalog.schemas import ProductList, ProductListItem
from app.config import get_settings
from app.database import get_session
from app.rate_limit import rate_limit
from app.search.embedder import get_embedder
from app.search.models import ProductEmbedding

router = APIRouter(prefix="/search", tags=["search"])
settings = get_settings()

Db = Annotated[AsyncSession, Depends(get_session)]


class SearchStatus(BaseModel):
    model_version: str
    # True while the colour-only stand-in is used instead of a real model.
    placeholder: bool
    indexed_photos: int
    # Photos of published products still waiting for a vector.
    pending_photos: int


@router.get("/visual/status")
async def visual_status(db: Db) -> SearchStatus:
    version = get_embedder().version
    indexed = await db.scalar(
        select(func.count())
        .select_from(ProductEmbedding)
        .where(ProductEmbedding.model_version == version, ProductEmbedding.vector.is_not(None))
    )
    photos = await db.scalar(
        select(func.count())
        .select_from(ProductImage)
        .join(Product, Product.id == ProductImage.product_id)
        .where(Product.status == ProductStatus.PUBLISHED)
    )
    done = await db.scalar(
        select(func.count())
        .select_from(ProductEmbedding)
        .join(ProductImage, ProductImage.id == ProductEmbedding.image_id)
        .join(Product, Product.id == ProductImage.product_id)
        .where(ProductEmbedding.model_version == version, Product.status == ProductStatus.PUBLISHED)
    )
    return SearchStatus(
        model_version=version,
        placeholder=version.startswith("placeholder"),
        indexed_photos=indexed or 0,
        pending_photos=max((photos or 0) - (done or 0), 0),
    )


@router.post("/visual", dependencies=[Depends(rate_limit("visual-search", limit=30))])
async def visual_search(
    file: UploadFile,
    filters: Annotated[ProductFilter, Depends(product_filter)],
    db: Db,
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
) -> ProductList:
    """Products whose photos look most like the uploaded picture.

    The same filters as in the catalog apply first (published, store active,
    audience, size, price, stock…); only what passes them is ranked. The
    uploaded picture is used for this one request and is not stored.
    """
    raw = await file.read(settings.upload_max_bytes + 1)
    # The same checks as for product photos: real image, size limits, EXIF dropped.
    cleaned = storage.process_image(raw)
    with Image.open(io.BytesIO(cleaned.data)) as picture:
        # In a worker thread: a real model takes a noticeable moment, and other
        # requests must not wait for it.
        query_vector = await asyncio.to_thread(get_embedder().embed, picture.convert("RGB"))

    matched = matching_variants(filters).subquery()
    # A product is as close as its closest photo.
    distance = func.min(ProductEmbedding.vector.cosine_distance(query_vector)).label("distance")
    closest = (
        select(ProductImage.product_id, distance)
        .join(ProductEmbedding, ProductEmbedding.image_id == ProductImage.id)
        .where(
            ProductEmbedding.model_version == get_embedder().version,
            ProductEmbedding.vector.is_not(None),
            ProductImage.product_id.in_(select(matched.c.product_id)),
        )
        .group_by(ProductImage.product_id)
        .order_by(distance, ProductImage.product_id)
        .limit(limit)
        .subquery()
    )
    rows = await db.execute(
        select(Product, matched.c.price_minor, matched.c.price_varies)
        .join(closest, closest.c.product_id == Product.id)
        .join(matched, matched.c.product_id == Product.id)
        .options(*PRODUCT_LOADING)
        .order_by(closest.c.distance, Product.id)
    )
    items = [
        ProductListItem(**list_item_fields(product, price_minor, price_varies))
        for product, price_minor, price_varies in rows.unique()
    ]
    # How alike two pictures are is never shown as a number or a percentage.
    return ProductList(items=items, total=len(items), next_cursor=None)


@router.get("/similar/{product_id}")
async def similar_products(
    product_id: uuid.UUID, db: Db, limit: Annotated[int, Query(ge=1, le=24)] = 10
) -> ProductList:
    """Products that look most like the given one, by their photos.

    Any of the product's photos may match any photo of another product; the
    closest pair decides. Only products a buyer may see are returned.
    """
    version = get_embedder().version
    own = aliased(ProductEmbedding)
    other = aliased(ProductEmbedding)
    own_image = aliased(ProductImage)
    other_image = aliased(ProductImage)
    matched = matching_variants(ProductFilter()).subquery()

    distance = func.min(other.vector.cosine_distance(own.vector)).label("distance")
    closest = (
        select(other_image.product_id, distance)
        .select_from(own)
        .join(own_image, own_image.id == own.image_id)
        .join(other, other.model_version == own.model_version)
        .join(other_image, other_image.id == other.image_id)
        .where(
            own_image.product_id == product_id,
            own.model_version == version,
            own.vector.is_not(None),
            other.vector.is_not(None),
            other_image.product_id != product_id,
            other_image.product_id.in_(select(matched.c.product_id)),
        )
        .group_by(other_image.product_id)
        .order_by(distance, other_image.product_id)
        .limit(limit)
        .subquery()
    )
    rows = await db.execute(
        select(Product, matched.c.price_minor, matched.c.price_varies)
        .join(closest, closest.c.product_id == Product.id)
        .join(matched, matched.c.product_id == Product.id)
        .options(*PRODUCT_LOADING)
        .order_by(closest.c.distance, Product.id)
    )
    items = [
        ProductListItem(**list_item_fields(product, price_minor, price_varies))
        for product, price_minor, price_varies in rows.unique()
    ]
    return ProductList(items=items, total=len(items), next_cursor=None)
