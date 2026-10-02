import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field, StringConstraints, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app import storage
from app.accounts.deps import AdminUser
from app.catalog.models import Product, ProductStatus
from app.catalog.queries import visible_products
from app.database import get_session
from app.errors import ApiError, not_found
from app.moderation.models import ModerationLog, Report
from app.rate_limit import rate_limit
from app.search.indexer import index_product
from app.stores.models import Store, StoreStatus

Db = Annotated[AsyncSession, Depends(get_session)]

admin_router = APIRouter(prefix="/admin", tags=["admin"])
reports_router = APIRouter(tags=["reports"])


class Decision(StrEnum):
    APPROVE = "approve"
    REJECT = "reject"
    BLOCK = "block"


class DecisionIn(BaseModel):
    decision: Decision
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None = None

    @model_validator(mode="after")
    def reason_required_unless_approving(self):
        # The author must be told why; an approval needs no explanation.
        if self.decision is not Decision.APPROVE and not self.reason:
            raise ValueError("A reason is required when rejecting or blocking")
        return self


class DecisionOut(BaseModel):
    id: uuid.UUID
    status: str


class QueueStore(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str | None
    address: str | None
    phone: str | None
    instagram: str | None
    website: str | None


class QueueProduct(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    store_name: str
    category: str
    audience: str
    base_price_minor: int
    images: list[str]
    variant_count: int


class Queue(BaseModel):
    stores: list[QueueStore]
    products: list[QueueProduct]


class ReportIn(BaseModel):
    product_id: uuid.UUID
    reason: Literal["wrong_price", "not_available", "wrong_photo", "inappropriate", "other"]
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None = None


class ReportOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_title: str
    store_name: str
    reason: str
    comment: str | None
    status: str
    resolution: str | None
    created_at: datetime


class ResolveIn(BaseModel):
    resolution: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
    ]


LOG_ACTIONS = {
    Decision.APPROVE: "approved",
    Decision.REJECT: "rejected",
    Decision.BLOCK: "blocked",
}


def log(target_type: str, target_id: uuid.UUID, action: str, admin, reason: str | None):
    return ModerationLog(
        target_type=target_type,
        target_id=target_id,
        action=action,
        reason=reason,
        actor_id=admin.id,
    )


@admin_router.get("/queue")
async def review_queue(admin: AdminUser, db: Db) -> Queue:
    """Everything waiting for a decision."""
    stores = await db.scalars(
        select(Store).where(Store.status == StoreStatus.PENDING_REVIEW).order_by(Store.created_at)
    )
    products = await db.scalars(
        select(Product)
        .where(Product.status == ProductStatus.PENDING_REVIEW)
        .options(
            selectinload(Product.images),
            selectinload(Product.variants),
            joinedload(Product.store),
            joinedload(Product.category),
        )
        .order_by(Product.updated_at)
    )
    return Queue(
        stores=[
            QueueStore(
                id=store.id,
                slug=store.slug,
                name=store.name,
                description=store.description,
                address=store.address,
                phone=store.phone,
                instagram=store.instagram,
                website=store.website,
            )
            for store in stores.unique()
        ],
        products=[
            QueueProduct(
                id=product.id,
                title=product.title,
                description=product.description,
                store_name=product.store.name,
                category=product.category.name_ru,
                audience=product.audience,
                base_price_minor=product.base_price_minor,
                images=[
                    url
                    for image in product.images
                    if (url := storage.image_url(image.object_key, image.external_url))
                ],
                variant_count=len(product.variants),
            )
            for product in products.unique()
        ],
    )


@admin_router.post("/stores/{store_id}/decision")
async def decide_store(
    store_id: uuid.UUID, body: DecisionIn, admin: AdminUser, db: Db
) -> DecisionOut:
    store = await db.get(Store, store_id)
    if store is None:
        raise not_found("Store not found")
    store.status = {
        Decision.APPROVE: StoreStatus.ACTIVE,
        Decision.REJECT: StoreStatus.REJECTED,
        Decision.BLOCK: StoreStatus.BLOCKED,
    }[body.decision]
    store.review_note = None if body.decision is Decision.APPROVE else body.reason
    db.add(log("store", store.id, LOG_ACTIONS[body.decision], admin, body.reason))
    await db.commit()
    return DecisionOut(id=store.id, status=store.status)


@admin_router.post("/products/{product_id}/decision")
async def decide_product(
    product_id: uuid.UUID,
    body: DecisionIn,
    admin: AdminUser,
    db: Db,
    background: BackgroundTasks,
) -> DecisionOut:
    product = await db.get(Product, product_id)
    if product is None:
        raise not_found("Product not found")
    if body.decision is Decision.APPROVE and product.status != ProductStatus.PENDING_REVIEW:
        raise ApiError(409, "not_pending", "Only a product waiting for review can be approved")
    product.status = {
        Decision.APPROVE: ProductStatus.PUBLISHED,
        # A rejected product goes back to the seller as a draft, with the reason attached.
        Decision.REJECT: ProductStatus.DRAFT,
        Decision.BLOCK: ProductStatus.BLOCKED,
    }[body.decision]
    product.review_note = None if body.decision is Decision.APPROVE else body.reason
    db.add(
        log(
            "product",
            product.id,
            LOG_ACTIONS[body.decision],
            admin,
            body.reason,
        )
    )
    await db.commit()
    if body.decision is Decision.APPROVE:
        # After the response is sent: the product is public at once, and joins
        # photo search as soon as its photos are indexed.
        background.add_task(index_product, product.id)
    return DecisionOut(id=product.id, status=product.status)


@admin_router.get("/reports")
async def list_reports(
    admin: AdminUser, db: Db, status: Literal["open", "resolved"] = "open"
) -> list[ReportOut]:
    rows = await db.execute(
        select(Report, Product.title, Store.name)
        .join(Product, Product.id == Report.product_id)
        .join(Store, Store.id == Product.store_id)
        .where(Report.status == status)
        .order_by(Report.created_at.desc())
        .limit(200)
    )
    return [
        ReportOut(
            id=report.id,
            product_id=report.product_id,
            product_title=title,
            store_name=store_name,
            reason=report.reason,
            comment=report.comment,
            status=report.status,
            resolution=report.resolution,
            created_at=report.created_at,
        )
        for report, title, store_name in rows.unique()
    ]


@admin_router.post("/reports/{report_id}/resolve", status_code=204)
async def resolve_report(report_id: uuid.UUID, body: ResolveIn, admin: AdminUser, db: Db) -> None:
    report = await db.get(Report, report_id)
    if report is None:
        raise not_found("Report not found")
    report.status = "resolved"
    report.resolution = body.resolution
    report.resolved_by = admin.id
    report.resolved_at = datetime.now(UTC)
    await db.commit()


class ReportCreated(BaseModel):
    id: uuid.UUID = Field(description="Reference number of the report")


@reports_router.post(
    "/reports", status_code=201, dependencies=[Depends(rate_limit("reports", limit=5))]
)
async def create_report(body: ReportIn, db: Db) -> ReportCreated:
    """A buyer reports a problem with a product. No account is needed."""
    visible = await db.scalar(
        select(Product.id)
        .join(Store, Store.id == Product.store_id)
        .where(Product.id == body.product_id, *visible_products())
    )
    if visible is None:
        raise not_found("Product not found")
    report = Report(product_id=body.product_id, reason=body.reason, comment=body.comment)
    db.add(report)
    await db.commit()
    return ReportCreated(id=report.id)
