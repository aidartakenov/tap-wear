"""Product photo validation, re-encoding and object storage."""

import asyncio
import hashlib
import io
import json
import uuid
from dataclasses import dataclass
from functools import lru_cache

from minio import Minio
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import get_settings
from app.errors import ApiError

settings = get_settings()

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
# Longest side of the stored photo. Larger uploads are scaled down.
MAX_SIDE = 2000


@dataclass
class ProcessedImage:
    data: bytes
    content_hash: str
    width: int
    height: int


def process_image(raw: bytes) -> ProcessedImage:
    """Validate an upload and return a clean JPEG.

    The file name and the declared content type are never trusted: the bytes
    must decode as a JPEG, PNG or WebP image. The picture is re-encoded, which
    drops EXIF data (camera, GPS position) and anything else hidden in the file.
    """
    if len(raw) > settings.upload_max_bytes:
        limit_mb = settings.upload_max_bytes // (1024 * 1024)
        raise ApiError(413, "file_too_large", f"The file is larger than {limit_mb} MB")

    unsupported = ApiError(
        422, "unsupported_image", "Upload a JPEG, PNG or WebP image. HEIC is not supported yet"
    )
    try:
        image = Image.open(io.BytesIO(raw))
        if image.format not in ALLOWED_FORMATS:
            raise unsupported
        if image.width * image.height > settings.upload_max_pixels:
            megapixels = settings.upload_max_pixels // 1_000_000
            raise ApiError(413, "image_too_large", f"The image is larger than {megapixels} MP")
        image.load()
        # Apply the EXIF rotation to the pixels before the EXIF data is dropped.
        image = ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise unsupported from error

    image.thumbnail((MAX_SIDE, MAX_SIDE))
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=85, optimize=True)
    data = output.getvalue()
    return ProcessedImage(
        data=data,
        content_hash=hashlib.sha256(data).hexdigest(),
        width=image.width,
        height=image.height,
    )


@lru_cache
def client() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key.get_secret_value(),
        secret_key=settings.minio_secret_key.get_secret_value(),
        secure=settings.minio_secure,
        region=settings.minio_region,
    )


@lru_cache
def ensure_assets_bucket() -> str:
    """Create the public product-photo bucket on first use."""
    bucket = settings.minio_bucket_assets
    if not client().bucket_exists(bucket):
        client().make_bucket(bucket)
    # Product photos are public by design; anyone may read, only the API may write.
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{bucket}/*"],
            }
        ],
    }
    client().set_bucket_policy(bucket, json.dumps(policy))
    return bucket


def _put(key: str, data: bytes) -> None:
    client().put_object(
        ensure_assets_bucket(), key, io.BytesIO(data), len(data), content_type="image/jpeg"
    )


def _remove(key: str) -> None:
    client().remove_object(ensure_assets_bucket(), key)


async def store_product_image(product_id: uuid.UUID, image: ProcessedImage) -> str:
    """Save a processed photo and return its object key. The key is generated here,
    never taken from the uploaded file name."""
    key = f"products/{product_id}/{uuid.uuid4()}.jpg"
    try:
        await asyncio.to_thread(_put, key, image.data)
    except Exception as error:
        raise ApiError(503, "storage_unavailable", "Photo storage is unavailable") from error
    return key


async def remove_object(key: str) -> None:
    try:
        await asyncio.to_thread(_remove, key)
    except Exception:  # noqa: BLE001 - a leftover file is harmless; the database row is the source of truth
        pass


def public_url(object_key: str) -> str:
    return f"{settings.storage_public_url}/{settings.minio_bucket_assets}/{object_key}"


def image_url(object_key: str | None, external_url: str | None) -> str | None:
    """Where a browser can load a product photo from.

    Uploaded photos live in object storage; demo products link to the store's own site.
    """
    return public_url(object_key) if object_key else external_url
