import re
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.accounts.deps import CurrentUser
from app.accounts.models import User
from app.catalog.availability import Confirmation, confirmation_state, set_availability
from app.catalog.models import (
    Availability,
    Product,
    ProductImage,
    ProductStatus,
    ProductVariant,
    StockMode,
)
from app.catalog.schemas import CategoryOut, ColorOut
from app.config import get_settings
from app.database import get_session
from app.errors import ApiError, not_found
from app.merchant.access import (
    PRODUCT_LOADING,
    ensure_editable,
    membership,
    owner_membership,
    product_for,
    store_for,
    variant_for,
)
from app.merchant.schemas import (
    MemberIn,
    MemberOut,
    MerchantImageOut,
    MerchantProductList,
    MerchantProductOut,
    MerchantStoreOut,
    MerchantVariantOut,
    ProductIn,
    ProductUpdate,
    StoreIn,
    VariantIn,
    VariantUpdate,
)
from app.moderation.models import ModerationLog
from app.rate_limit import rate_limit
from app.reference.models import Category, City, Color
from app.stores.models import MemberRole, Store, StoreMember, StoreStatus

router = APIRouter(prefix="/merchant", tags=["merchant"])
settings = get_settings()

Db = Annotated[AsyncSession, Depends(get_session)]

TRANSLIT = dict(
    zip(
        "абвгдеёжзийклмнопрстуфхцчшщъыьэюяңөү",
        [
            "a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "y", "k", "l", "m", "n", "o",
            "p", "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "sch", "", "y", "", "e", "yu",
            "ya", "n", "o", "u",
        ],
        strict=True,
    )
)  # fmt: skip


def slugify(name: str) -> str:
    latin = "".join(TRANSLIT.get(char, char) for char in name.lower())
    return re.sub(r"[^a-z0-9]+", "-", latin).strip("-")[:60] or "store"


async def unique_slug(db: AsyncSession, name: str) -> str:
    base = slugify(name)
    slug, suffix = base, 2
    while await db.scalar(select(Store.id).where(Store.slug == slug)):
        slug, suffix = f"{base}-{suffix}", suffix + 1
    return slug


async def check_reference(db: AsyncSession, model, code: str | None, label: str) -> None:
    """Unknown reference codes are rejected rather than written to the database."""
    if code is not None and await db.get(model, code) is None:
        raise ApiError(422, "unknown_value", f"Unknown {label}: {code}")


def store_out(store: Store, role: str) -> MerchantStoreOut:
    return MerchantStoreOut(
        id=store.id,
        slug=store.slug,
        status=store.status,
        review_note=store.review_note,
        role=role,
        name=store.name,
        description=store.description,
        city_code=store.city_code,
        address=store.address,
        market=store.market,
        sector=store.sector,
        container=store.container,
        working_hours=store.working_hours,
        phone=store.phone,
        whatsapp=store.whatsapp,
        instagram=store.instagram,
        website=store.website,
    )


def product_out(product: Product) -> MerchantProductOut:
    return MerchantProductOut(
        id=product.id,
        store_id=product.store_id,
        title=product.title,
        description=product.description,
        category=CategoryOut(code=product.category.code, name=product.category.name_ru),
        audience=product.audience,
        base_price_minor=product.base_price_minor,
        currency=product.currency,
        brand=product.brand,
        sku=product.sku,
        status=product.status,
        version=product.version,
        review_note=product.review_note,
        images=[
            MerchantImageOut(
                id=image.id,
                url=storage.image_url(image.object_key, image.external_url),
                color=image.color_code,
                position=image.position,
            )
            for image in product.images
        ],
        variants=[
            MerchantVariantOut(
                id=variant.id,
                size_system=variant.size_system,
                size_label=variant.size_label,
                color=(
                    ColorOut(code=variant.color.code, name=variant.color.name_ru)
                    if variant.color
                    else None
                ),
                price_override_minor=variant.price_override_minor,
                availability=variant.availability_status,
                quantity=variant.quantity,
                availability_confirmed_at=variant.availability_confirmed_at,
                confirmation=(
                    confirmation_state(variant)
                    if variant.availability_status == Availability.IN_STOCK
                    else Confirmation.FRESH
                ),
            )
            for variant in product.variants
        ],
        updated_at=product.updated_at,
    )


async def reload_product(db: AsyncSession, product_id: uuid.UUID) -> Product:
    statement = (
        select(Product)
        .where(Product.id == product_id)
        .options(*PRODUCT_LOADING)
        .execution_options(populate_existing=True)
    )
    return (await db.execute(statement)).unique().scalar_one()


# --- Stores -----------------------------------------------------------------


@router.get("/stores")
async def my_stores(user: CurrentUser, db: Db) -> list[MerchantStoreOut]:
    rows = await db.execute(
        select(Store, StoreMember.role)
        .join(StoreMember, StoreMember.store_id == Store.id)
        .where(StoreMember.user_id == user.id)
        .order_by(Store.name)
    )
    return [store_out(store, role) for store, role in rows.unique()]


@router.post("/stores", status_code=201)
async def create_store(body: StoreIn, user: CurrentUser, db: Db) -> MerchantStoreOut:
    await check_reference(db, City, body.city_code, "city")
    # A new store is not public until an administrator has reviewed it.
    store = Store(
        **body.model_dump(),
        slug=await unique_slug(db, body.name),
        status=StoreStatus.PENDING_REVIEW,
    )
    db.add(store)
    await db.flush()
    db.add(StoreMember(store_id=store.id, user_id=user.id, role=MemberRole.OWNER))
    db.add(
        ModerationLog(target_type="store", target_id=store.id, action="submitted", actor_id=user.id)
    )
    await db.commit()
    return store_out(store, MemberRole.OWNER)


@router.patch("/stores/{store_id}")
async def update_store(
    store_id: uuid.UUID, body: StoreIn, user: CurrentUser, db: Db
) -> MerchantStoreOut:
    await owner_membership(db, user, store_id)
    store = await db.get(Store, store_id)
    if store.status == StoreStatus.BLOCKED:
        raise ApiError(403, "store_blocked", "This store was blocked by an administrator")
    await check_reference(db, City, body.city_code, "city")
    for field, value in body.model_dump().items():
        setattr(store, field, value)
    # A corrected profile goes back to the administrator.
    if store.status == StoreStatus.REJECTED:
        store.status = StoreStatus.PENDING_REVIEW
        db.add(
            ModerationLog(
                target_type="store", target_id=store.id, action="submitted", actor_id=user.id
            )
        )
    await db.commit()
    return store_out(store, MemberRole.OWNER)


@router.get("/stores/{store_id}/members")
async def list_members(store_id: uuid.UUID, user: CurrentUser, db: Db) -> list[MemberOut]:
    await membership(db, user, store_id)
    rows = await db.execute(
        select(User.id, User.email, User.name, StoreMember.role)
        .join(StoreMember, StoreMember.user_id == User.id)
        .where(StoreMember.store_id == store_id)
        .order_by(StoreMember.created_at)
    )
    return [
        MemberOut(user_id=user_id, email=email, name=name, role=role)
        for user_id, email, name, role in rows
    ]


@router.post("/stores/{store_id}/members", status_code=201)
async def add_member(store_id: uuid.UUID, body: MemberIn, user: CurrentUser, db: Db) -> MemberOut:
    """The owner adds an existing account as staff. Staff can never be added as owner here."""
    await owner_membership(db, user, store_id)
    invited = await db.scalar(select(User).where(User.email == body.email, User.is_active))
    if invited is None:
        raise ApiError(
            404, "user_not_found", "No account with this email. Ask the person to register first"
        )
    db.add(
        StoreMember(
            store_id=store_id, user_id=invited.id, role=MemberRole.STAFF, invited_by=user.id
        )
    )
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise ApiError(409, "already_member", "This person already has access") from error
    return MemberOut(
        user_id=invited.id, email=invited.email, name=invited.name, role=MemberRole.STAFF
    )


@router.delete("/stores/{store_id}/members/{user_id}", status_code=204)
async def remove_member(store_id: uuid.UUID, user_id: uuid.UUID, user: CurrentUser, db: Db) -> None:
    """Revoke access. The history of what the person did stays in place."""
    await owner_membership(db, user, store_id)
    member = await db.scalar(
        select(StoreMember).where(StoreMember.store_id == store_id, StoreMember.user_id == user_id)
    )
    if member is None:
        raise not_found("Member not found")
    if member.role == MemberRole.OWNER:
        raise ApiError(409, "cannot_remove_owner", "The owner cannot be removed")
    await db.delete(member)
    await db.commit()


# --- Products ---------------------------------------------------------------


async def apply_variants(db: AsyncSession, product: Product, incoming: list[VariantIn]) -> None:
    """Make the product's variants equal to the given list: update, add, remove."""
    existing = {variant.id: variant for variant in product.variants}
    kept: list[ProductVariant] = []
    for position, item in enumerate(incoming):
        await check_reference(db, Color, item.color, "colour")
        variant = existing.get(item.id) if item.id else None
        if item.id and variant is None:
            raise ApiError(422, "unknown_variant", "A variant does not belong to this product")
        if variant is None:
            variant = ProductVariant(product_id=product.id)
        variant.size_system = item.size_system or None
        variant.size_label = item.size_label or None
        variant.color_code = item.color
        variant.price_override_minor = item.price_override_minor
        variant.quantity = item.quantity
        variant.stock_mode = StockMode.EXACT if item.quantity is not None else StockMode.MANUAL
        # With exact stock the status follows the quantity.
        if item.quantity is not None:
            status = Availability.IN_STOCK if item.quantity > 0 else Availability.OUT_OF_STOCK
        else:
            status = item.availability
        set_availability(variant, status)
        variant.position = position
        kept.append(variant)
    product.variants = kept


async def commit_product(db: AsyncSession, product_id: uuid.UUID) -> MerchantProductOut:
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        if "uq_product_variants_combination" in str(error.orig):
            raise ApiError(
                409, "duplicate_variant", "The same colour and size is listed twice"
            ) from error
        raise
    return product_out(await reload_product(db, product_id))


@router.get("/products")
async def my_products(
    store_id: uuid.UUID, user: CurrentUser, db: Db, status: ProductStatus | None = None
) -> MerchantProductList:
    await membership(db, user, store_id)
    statement = (
        select(Product)
        .where(Product.store_id == store_id)
        .options(*PRODUCT_LOADING)
        .order_by(Product.updated_at.desc(), Product.id)
    )
    if status:
        statement = statement.where(Product.status == status)
    products = (await db.execute(statement)).unique().scalars()
    return MerchantProductList(items=[product_out(product) for product in products])


@router.post("/products", status_code=201)
async def create_product(body: ProductIn, user: CurrentUser, db: Db) -> MerchantProductOut:
    """Create a draft. The store comes from the user's verified membership."""
    store, _ = await store_for(db, user, body.store_id)
    if store.status == StoreStatus.BLOCKED:
        raise ApiError(403, "store_blocked", "This store was blocked by an administrator")
    await check_reference(db, Category, body.category, "category")

    product = Product(
        store_id=store.id,
        title=body.title,
        description=body.description,
        category_code=body.category,
        audience=body.audience,
        base_price_minor=body.base_price_minor,
        brand=body.brand,
        sku=body.sku,
        status=ProductStatus.DRAFT,
        variants=[],
        images=[],
    )
    db.add(product)
    await db.flush()
    await apply_variants(db, product, body.variants)
    return await commit_product(db, product.id)


@router.get("/products/{product_id}")
async def my_product(product_id: uuid.UUID, user: CurrentUser, db: Db) -> MerchantProductOut:
    return product_out(await product_for(db, user, product_id))


@router.patch("/products/{product_id}")
async def update_product(
    product_id: uuid.UUID, body: ProductUpdate, user: CurrentUser, db: Db
) -> MerchantProductOut:
    product = await product_for(db, user, product_id, lock=True)
    ensure_editable(product)
    if body.expected_version != product.version:
        raise ApiError(
            409,
            "version_conflict",
            "Someone else changed this product. Reload it and apply your changes again",
            {"current_version": product.version},
        )

    changes = body.model_dump(exclude_unset=True, exclude={"expected_version", "variants"})
    if "category" in changes:
        await check_reference(db, Category, changes["category"], "category")
        product.category_code = changes.pop("category")
    for field in ("title", "audience", "base_price_minor"):
        if field in changes and changes[field] is None:
            raise ApiError(422, "validation_error", f"{field} cannot be empty")
    for field, value in changes.items():
        setattr(product, field, value)
    if body.variants is not None:
        await apply_variants(db, product, body.variants)
    product.version += 1
    return await commit_product(db, product.id)


@router.post(
    "/products/{product_id}/images",
    status_code=201,
    dependencies=[Depends(rate_limit("uploads", limit=30))],
)
async def upload_image(
    product_id: uuid.UUID,
    file: UploadFile,
    user: CurrentUser,
    db: Db,
    color: Annotated[str | None, Form()] = None,
) -> MerchantProductOut:
    product = await product_for(db, user, product_id, lock=True)
    ensure_editable(product)
    if len(product.images) >= settings.product_max_images:
        raise ApiError(
            409, "too_many_images", f"A product can have {settings.product_max_images} photos"
        )
    await check_reference(db, Color, color or None, "colour")

    # Read one byte more than the limit, so an oversized file is detected
    # without loading all of it into memory.
    raw = await file.read(settings.upload_max_bytes + 1)
    image = storage.process_image(raw)
    key = await storage.store_product_image(product.id, image)
    db.add(
        ProductImage(
            product_id=product.id,
            color_code=color or None,
            object_key=key,
            content_hash=image.content_hash,
            position=max((item.position for item in product.images), default=-1) + 1,
        )
    )
    product.version += 1
    return await commit_product(db, product.id)


@router.delete("/products/{product_id}/images/{image_id}")
async def delete_image(
    product_id: uuid.UUID, image_id: uuid.UUID, user: CurrentUser, db: Db
) -> MerchantProductOut:
    product = await product_for(db, user, product_id, lock=True)
    ensure_editable(product)
    image = next((item for item in product.images if item.id == image_id), None)
    if image is None:
        raise not_found("Photo not found")
    if product.status == ProductStatus.PUBLISHED and len(product.images) == 1:
        raise ApiError(409, "last_image", "A published product must keep at least one photo")

    product.images.remove(image)
    # Keep positions contiguous, so the first photo is always position 0.
    for position, item in enumerate(product.images):
        item.position = position
    product.version += 1
    result = await commit_product(db, product.id)
    if image.object_key:
        await storage.remove_object(image.object_key)
    return result


@router.post("/products/{product_id}/submit")
async def submit_product(product_id: uuid.UUID, user: CurrentUser, db: Db) -> MerchantProductOut:
    """Send a draft to the administrator. Publishing requires a price, a variant and a photo."""
    product = await product_for(db, user, product_id, lock=True)
    ensure_editable(product)
    if product.status in (ProductStatus.PUBLISHED, ProductStatus.PENDING_REVIEW):
        raise ApiError(409, "already_submitted", "This product is already submitted or published")

    missing = []
    if not product.variants:
        missing.append({"field": "variants", "problem": "Add at least one size or variant"})
    if not product.images:
        missing.append({"field": "images", "problem": "Add at least one photo"})
    if missing:
        raise ApiError(422, "not_ready", "The product is not ready for publication", missing)

    product.status = ProductStatus.PENDING_REVIEW
    product.review_note = None
    db.add(
        ModerationLog(
            target_type="product", target_id=product.id, action="submitted", actor_id=user.id
        )
    )
    return await commit_product(db, product.id)


@router.post("/products/{product_id}/archive")
async def archive_product(product_id: uuid.UUID, user: CurrentUser, db: Db) -> MerchantProductOut:
    """Take a product out of the catalog. Nothing is deleted."""
    product = await product_for(db, user, product_id, lock=True)
    ensure_editable(product)
    product.status = ProductStatus.ARCHIVED
    db.add(
        ModerationLog(
            target_type="product", target_id=product.id, action="archived", actor_id=user.id
        )
    )
    return await commit_product(db, product.id)


@router.post("/products/{product_id}/copy", status_code=201)
async def copy_product(product_id: uuid.UUID, user: CurrentUser, db: Db) -> MerchantProductOut:
    """Start a new draft from an existing product. Photos are not copied."""
    source = await product_for(db, user, product_id)
    copy = Product(
        store_id=source.store_id,
        title=source.title,
        description=source.description,
        category_code=source.category_code,
        audience=source.audience,
        base_price_minor=source.base_price_minor,
        brand=source.brand,
        status=ProductStatus.DRAFT,
        images=[],
        variants=[
            ProductVariant(
                size_system=variant.size_system,
                size_label=variant.size_label,
                color_code=variant.color_code,
                price_override_minor=variant.price_override_minor,
                position=variant.position,
            )
            for variant in source.variants
        ],
    )
    db.add(copy)
    await db.flush()
    return await commit_product(db, copy.id)


@router.post("/products/{product_id}/confirm-availability")
async def confirm_product_availability(
    product_id: uuid.UUID, user: CurrentUser, db: Db
) -> MerchantProductOut:
    """The seller confirms that the stock status of every variant is still correct."""
    product = await product_for(db, user, product_id, lock=True)
    ensure_editable(product)
    now = datetime.now(UTC)
    for variant in product.variants:
        variant.availability_confirmed_at = now
    return await commit_product(db, product.id)


@router.patch("/variants/{variant_id}")
async def update_variant(
    variant_id: uuid.UUID, body: VariantUpdate, user: CurrentUser, db: Db
) -> MerchantProductOut:
    variant = await variant_for(db, user, variant_id)
    if body.clear_price_override:
        variant.price_override_minor = None
    elif body.price_override_minor is not None:
        variant.price_override_minor = body.price_override_minor
    if body.quantity is not None:
        variant.quantity = body.quantity
        variant.stock_mode = StockMode.EXACT
        set_availability(
            variant, Availability.IN_STOCK if body.quantity > 0 else Availability.OUT_OF_STOCK
        )
    elif body.availability is not None:
        set_availability(variant, body.availability)
    # Otherwise the confirmation time moves only when the seller confirms explicitly.
    if body.confirm_availability:
        variant.availability_confirmed_at = datetime.now(UTC)
    return await commit_product(db, variant.product_id)
