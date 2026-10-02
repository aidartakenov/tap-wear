"""Buying one item: an order, then its payment.

The payment itself belongs to a payment provider. Until one is connected the
"test" provider stands in for it: the buyer confirms on a page that imitates the
bank's app, and no money moves. With PAYMENT_PROVIDER=none buying is switched off.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app import storage
from app.accounts.deps import CurrentUser
from app.accounts.models import User
from app.catalog.availability import effective_availability
from app.catalog.models import Availability, Product, ProductStatus, ProductVariant
from app.config import get_settings
from app.database import get_session
from app.errors import ApiError, not_found
from app.locale import display_name
from app.merchant.access import membership
from app.orders.models import Order, OrderStatus, Payment, PaymentMethod, PaymentStatus
from app.rate_limit import rate_limit
from app.stores.models import Store, StoreStatus

router = APIRouter(tags=["orders"])
settings = get_settings()

Db = Annotated[AsyncSession, Depends(get_session)]

METHOD_NAMES = {
    PaymentMethod.MBANK: "MBank",
    PaymentMethod.OPTIMA: "Optima Bank",
    PaymentMethod.OBANK: "O!Bank",
}


class MethodOut(BaseModel):
    code: PaymentMethod
    name: str


class PaymentOptions(BaseModel):
    enabled: bool
    # True while payments are simulated and no money moves.
    test_mode: bool
    methods: list[MethodOut]


class OrderIn(BaseModel):
    variant_id: uuid.UUID
    payment_method: PaymentMethod
    phone: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[\d\s()-]{9,20}$")]


class OrderOut(BaseModel):
    id: uuid.UUID
    number: int
    status: OrderStatus
    title: str
    size_label: str | None
    color_name: str | None
    image_url: str | None
    price_minor: int
    product_id: uuid.UUID | None
    store_name: str
    store_slug: str
    payment_method: PaymentMethod
    payment_method_name: str
    test_mode: bool
    created_at: datetime
    paid_at: datetime | None


class MerchantOrderOut(OrderOut):
    buyer_name: str
    buyer_phone: str


def order_out(order: Order, store: Store) -> dict:
    payment = order.payments[-1]
    return {
        "id": order.id,
        "number": order.number,
        "status": order.status,
        "title": order.title,
        "size_label": order.size_label,
        "color_name": order.color_name,
        "image_url": order.image_url,
        "price_minor": order.price_minor,
        "product_id": order.product_id,
        "store_name": store.name,
        "store_slug": store.slug,
        "payment_method": payment.method,
        "payment_method_name": METHOD_NAMES[PaymentMethod(payment.method)],
        "test_mode": payment.provider == "test",
        "created_at": order.created_at,
        "paid_at": order.paid_at,
    }


def require_payments() -> None:
    if settings.payment_provider == "none":
        raise ApiError(503, "payments_unavailable", "Online payment is not connected yet")


async def own_order(db: AsyncSession, user: User, order_id: uuid.UUID, lock: bool = False) -> Order:
    query = select(Order).where(Order.id == order_id, Order.user_id == user.id)
    if lock:
        query = query.with_for_update()
    order = await db.scalar(query)
    if order is None:
        # Someone else's order looks the same as a missing one.
        raise not_found("Order not found")
    return order


@router.get("/payments/options")
async def payment_options() -> PaymentOptions:
    enabled = settings.payment_provider != "none"
    return PaymentOptions(
        enabled=enabled,
        test_mode=settings.payment_provider == "test",
        methods=[MethodOut(code=code, name=name) for code, name in METHOD_NAMES.items()]
        if enabled
        else [],
    )


@router.post("/orders", status_code=201, dependencies=[Depends(rate_limit("orders", limit=20))])
async def create_order(body: OrderIn, user: CurrentUser, db: Db) -> OrderOut:
    require_payments()
    variant = await db.scalar(
        select(ProductVariant)
        .where(ProductVariant.id == body.variant_id)
        .options(
            joinedload(ProductVariant.color),
            joinedload(ProductVariant.product).selectinload(Product.images),
            joinedload(ProductVariant.product).joinedload(Product.store),
        )
    )
    product = variant.product if variant else None
    if (
        variant is None
        or product.status != ProductStatus.PUBLISHED
        or product.store.status != StoreStatus.ACTIVE
    ):
        raise not_found("Product not found")
    if product.store.is_demo:
        raise ApiError(409, "demo_product", "Demo products cannot be bought")
    if effective_availability(variant) == Availability.OUT_OF_STOCK:
        raise ApiError(409, "out_of_stock", "This size or colour is out of stock")

    # The price is taken from the catalog on the server, never from the browser.
    price = variant.price_override_minor or product.base_price_minor
    image = product.images[0] if product.images else None
    order = Order(
        user_id=user.id,
        store_id=product.store_id,
        product_id=product.id,
        variant_id=variant.id,
        title=product.title,
        size_label=variant.size_label,
        color_name=display_name(variant.color) if variant.color else None,
        image_url=storage.image_url(image.object_key, image.external_url) if image else None,
        price_minor=price,
        buyer_phone=body.phone,
        status=OrderStatus.PENDING_PAYMENT,
    )
    order.payments = [
        Payment(
            provider=settings.payment_provider,
            method=body.payment_method,
            amount_minor=price,
            status=PaymentStatus.CREATED,
        )
    ]
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return OrderOut(**order_out(order, product.store))


@router.get("/me/orders")
async def my_orders(user: CurrentUser, db: Db) -> list[OrderOut]:
    rows = await db.execute(
        select(Order, Store)
        .join(Store, Store.id == Order.store_id)
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .limit(100)
    )
    return [OrderOut(**order_out(order, store)) for order, store in rows.unique()]


@router.get("/orders/{order_id}")
async def get_order(order_id: uuid.UUID, user: CurrentUser, db: Db) -> OrderOut:
    order = await own_order(db, user, order_id)
    return OrderOut(**order_out(order, await db.get(Store, order.store_id)))


@router.post("/orders/{order_id}/test-pay")
async def confirm_test_payment(order_id: uuid.UUID, user: CurrentUser, db: Db) -> OrderOut:
    """Stands in for the bank's confirmation while the test provider is used.

    A real provider confirms through its own signed notification instead; this
    endpoint does not exist for it.
    """
    if settings.payment_provider != "test":
        raise not_found("Order not found")
    order = await own_order(db, user, order_id, lock=True)
    payment = order.payments[-1]
    if order.status == OrderStatus.CANCELLED:
        raise ApiError(409, "order_cancelled", "This order was cancelled")
    # Confirming twice changes nothing: the order is already paid.
    if order.status == OrderStatus.PENDING_PAYMENT:
        now = datetime.now(UTC)
        payment.status = PaymentStatus.SUCCEEDED
        payment.confirmed_at = now
        order.status = OrderStatus.PAID
        order.paid_at = now
        await db.commit()
        await db.refresh(order)
    return OrderOut(**order_out(order, await db.get(Store, order.store_id)))


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: uuid.UUID, user: CurrentUser, db: Db) -> OrderOut:
    order = await own_order(db, user, order_id, lock=True)
    if order.status == OrderStatus.PAID:
        raise ApiError(409, "order_paid", "A paid order cannot be cancelled here")
    if order.status == OrderStatus.PENDING_PAYMENT:
        order.status = OrderStatus.CANCELLED
        order.payments[-1].status = PaymentStatus.CANCELLED
        await db.commit()
        await db.refresh(order)
    return OrderOut(**order_out(order, await db.get(Store, order.store_id)))


@router.get("/merchant/orders")
async def store_orders(store_id: uuid.UUID, user: CurrentUser, db: Db) -> list[MerchantOrderOut]:
    """Paid orders of a store, with how to reach the buyer."""
    await membership(db, user, store_id)
    store = await db.get(Store, store_id)
    rows = await db.execute(
        select(Order, User)
        .join(User, User.id == Order.user_id)
        .where(Order.store_id == store_id, Order.status == OrderStatus.PAID)
        .options(selectinload(Order.payments))
        .order_by(Order.paid_at.desc())
        .limit(200)
    )
    return [
        MerchantOrderOut(
            **order_out(order, store), buyer_name=buyer.name, buyer_phone=order.buyer_phone
        )
        for order, buyer in rows.unique()
    ]
