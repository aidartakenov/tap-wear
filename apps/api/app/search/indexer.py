"""Computes vectors for product photos that do not have one yet.

"Not indexed" is derived from the data: a photo of a published product without
a vector for the current model version, or whose source changed. So running the
indexer twice does nothing the second time, and a crash loses no work.

    python -m app.search.indexer                 # index everything that is missing, once
    python -m app.search.indexer --watch         # keep checking every few seconds
    python -m app.search.indexer --retry-failed  # also try again photos that failed before
"""

import asyncio
import io
import logging
import ssl
import sys
import urllib.request
import uuid
from functools import lru_cache

from PIL import Image
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.catalog.models import Product, ProductImage, ProductStatus
from app.config import get_settings
from app.database import SessionLocal, engine
from app.search.embedder import get_embedder
from app.search.models import ProductEmbedding

logger = logging.getLogger(__name__)
settings = get_settings()

BATCH = 20
WATCH_SECONDS = 15
DOWNLOAD_TIMEOUT = 20


def source_of(image: ProductImage) -> str:
    return image.content_hash or image.object_key or image.external_url or ""


# The SQL twin of source_of().
SOURCE = func.coalesce(
    ProductImage.content_hash, ProductImage.object_key, ProductImage.external_url, ""
)


@lru_cache
def _tls() -> ssl.SSLContext:
    """Certificate checking for downloads. Some Python installs ship without
    root certificates; the certifi bundle is used when it is installed."""
    try:
        import certifi
    except ImportError:
        return ssl.create_default_context()
    return ssl.create_default_context(cafile=certifi.where())


def _read(image: ProductImage) -> bytes:
    """The photo's bytes: from object storage, or from the store's site for demo photos."""
    if image.object_key:
        response = storage.client().get_object(storage.ensure_assets_bucket(), image.object_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()
    request = urllib.request.Request(  # noqa: S310 - the address comes from our own catalog
        image.external_url, headers={"User-Agent": "TapWear indexer"}
    )
    with urllib.request.urlopen(  # noqa: S310
        request, timeout=DOWNLOAD_TIMEOUT, context=_tls()
    ) as response:
        return response.read(settings.upload_max_bytes + 1)


def _embed(image: ProductImage) -> list[float]:
    raw = _read(image)
    if len(raw) > settings.upload_max_bytes:
        raise ValueError("The photo is too large")
    with Image.open(io.BytesIO(raw)) as picture:
        return get_embedder().embed(picture.convert("RGB"))


def pending(product_id: uuid.UUID | None = None):
    """Photos of published products with no up-to-date vector for the current model."""
    version = get_embedder().version
    query = (
        select(ProductImage)
        .join(Product, Product.id == ProductImage.product_id)
        .outerjoin(
            ProductEmbedding,
            and_(
                ProductEmbedding.image_id == ProductImage.id,
                ProductEmbedding.model_version == version,
            ),
        )
        .where(
            Product.status == ProductStatus.PUBLISHED,
            or_(ProductEmbedding.id.is_(None), ProductEmbedding.source != SOURCE),
        )
        .order_by(ProductImage.created_at)
    )
    if product_id:
        query = query.where(ProductImage.product_id == product_id)
    return query


async def index_batch(session: AsyncSession, product_id: uuid.UUID | None = None) -> int:
    """Index up to BATCH photos. Returns how many were tried; 0 means nothing is left."""
    embedder = get_embedder()
    images = (await session.scalars(pending(product_id).limit(BATCH))).all()
    for image in images:
        try:
            vector = await asyncio.to_thread(_embed, image)
        except Exception as error:  # noqa: BLE001 - one bad photo must not stop the rest
            logger.warning("Photo %s was not indexed: %s", image.id, error)
            # Saved without a vector, so the same broken photo is not retried
            # on every pass; it is tried again when its source changes.
            vector = None
        statement = insert(ProductEmbedding).values(
            image_id=image.id,
            model_version=embedder.version,
            dimensions=embedder.dimensions,
            vector=vector,
            source=source_of(image),
        )
        await session.execute(
            statement.on_conflict_do_update(
                index_elements=["image_id", "model_version"],
                set_={"vector": statement.excluded.vector, "source": statement.excluded.source},
            )
        )
    await session.commit()
    return len(images)


async def index_product(product_id: uuid.UUID) -> None:
    """Index one product's photos; called right after the product is approved."""
    try:
        async with SessionLocal() as session:
            while await index_batch(session, product_id):
                pass
    except Exception:  # noqa: BLE001 - search indexing must never break moderation
        logger.exception("Could not index product %s", product_id)


async def remove_other_versions(session: AsyncSession) -> None:
    await session.execute(
        delete(ProductEmbedding).where(ProductEmbedding.model_version != get_embedder().version)
    )
    await session.commit()


async def forget_failed(session: AsyncSession) -> None:
    """Drop the records of photos that could not be read, so they are tried again."""
    await session.execute(
        delete(ProductEmbedding).where(
            ProductEmbedding.model_version == get_embedder().version,
            ProductEmbedding.vector.is_(None),
        )
    )
    await session.commit()


async def main(watch: bool, retry_failed: bool) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logger.info("Model version: %s", get_embedder().version)
    if retry_failed:
        async with SessionLocal() as session:
            await forget_failed(session)
    while True:
        async with SessionLocal() as session:
            total = 0
            while count := await index_batch(session):
                total += count
                logger.info("Indexed %s photos", total)
        if not watch:
            break
        await asyncio.sleep(WATCH_SECONDS)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(watch="--watch" in sys.argv, retry_failed="--retry-failed" in sys.argv))
