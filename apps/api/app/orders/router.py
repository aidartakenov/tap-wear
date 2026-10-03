"""Buying: a cart is checked, an order is made for one store, then it is paid.

The payment itself belongs to a payment provider. Until one is connected the
"test" provider stands in for it: the buyer confirms on a page that imitates the
bank's app, and no money moves. With PAYMENT_PROVIDER=none buying is switched off.

Counted stock is held from the moment an order is made. An order that is not
paid within PENDING_MINUTES is cancelled and its pieces go back on sale.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, StringConstraints, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app import storage
from app.accounts.deps import CurrentUser
from app.accounts.models import User
from app.catalog import pricing
from app.catalog.availability import effective_availability, set_availability
from app.catalog.models import Availability, Product, ProductStatus, ProductVariant, StockMode
from app.config import get_settings
from app.database import get_session
from app.errors import ApiError, not_found
from app.locale import display_name
from app.merchant.access import membership
from app.orders import emails
from app.orders.models import (
    NEXT_STATUS,
    DeliveryMethod,
    Order,
    OrderEvent,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from app.rate_limit import rate_limit
from app.stores.models import Store, StorePolicy, StoreStatus

router = APIRouter(tags=["orders"])
settings = get_settings()

Db = Annotated[AsyncSession, Depends(get_session)]

METHOD_NAMES = {
    PaymentMethod.MBANK: "MBank",
    PaymentMethod.OPTIMA: "Optima Bank",
    PaymentMethod.OBANK: "O!Bank",
}
# How long an unpaid order keeps its pieces before it is cancelled.
PENDING_MINUTES = 30
MAX_PER_LINE = 10


class MethodOut(BaseModel):
    code: PaymentMethod
    name: str


class PaymentOptions(BaseModel):
    enabled: bool
    # True while payments are simulated and no money moves.
    test_mode: bool
    methods: list[MethodOut]


class LineIn(BaseModel):
    variant_id: uuid.UUID
    quantity: Annotated[int, Field(ge=1, le=MAX_PER_LINE)] = 1


class CartIn(BaseModel):
    items: Annotated[list[LineIn], Field(max_length=50)]


class CartLine(BaseModel):
    variant_id: uuid.UUID
    product_id: uuid.UUID
    title: str
    size_label: str | None
    color_name: str | None
    image_url: str | None
    # Price of one piece, as it is in the catalog right now.
    price_minor: int
    quantity: int
    # False when this size and colour cannot be bought now; `problem` says why.
    available: bool
    problem: str | None
    # How many pieces can be bought at most (counted stock), if the store counts.
    max_quantity: int | None


class CartStore(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    avatar_url: str | None
    pickup_available: bool
    delivery_available: bool
    # None: the store names the delivery price itself. 0: free.
    delivery_fee_minor: int | None
    delivery_areas: str | None
    delivery_time: str | None
    address: str | None
    lines: list[CartLine]
    # Sum of the lines that can be bought.
    items_minor: int


class CartOut(BaseModel):
    stores: list[CartStore]
    # Lines that no longer exist in the catalog; the browser drops them.
    missing: list[uuid.UUID]


class OrderIn(BaseModel):
    items: Annotated[list[LineIn], Field(min_length=1, max_length=20)]
    payment_method: PaymentMethod
    phone: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[\d\s()-]{9,20}$")]
    delivery_method: DeliveryMethod = DeliveryMethod.PICKUP
    address: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=300)]
        | None
    ) = None

    @model_validator(mode="after")
    def address_goes_with_delivery(self):
        if self.delivery_method is DeliveryMethod.DELIVERY and not self.address:
            raise ValueError("An address is required for delivery")
        if self.delivery_method is DeliveryMethod.PICKUP:
            self.address = None
        return self


class ItemOut(BaseModel):
    product_id: uuid.UUID | None
    title: str
    size_label: str | None
    color_name: str | None
    image_url: str | None
    price_minor: int
    quantity: int


class OrderOut(BaseModel):
    id: uuid.UUID
    number: int
    status: OrderStatus
    items: list[ItemOut]
    items_minor: int
    delivery_method: DeliveryMethod
    delivery_address: str | None
    # None: the store names the delivery price when it contacts the buyer.
    delivery_fee_minor: int | None
    total_minor: int
    store_name: str
    store_slug: str
    payment_method: PaymentMethod
    payment_method_name: str
    test_mode: bool
    created_at: datetime
    paid_at: datetime | None
    # Why a paid order was called off, if it was.
    closing_note: str | None
    # The buyer may still back out: before paying, or before the store accepts.
    can_cancel: bool


class StatusIn(BaseModel):
    status: OrderStatus


class RefuseIn(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


class MerchantOrderOut(OrderOut):
    buyer_name: str
    buyer_phone: str


def order_out(order: Order, store: Store) -> dict:
    payment = order.payments[-1]
    return {
        "id": order.id,
        "number": order.number,
        "status": order.status,
        "items": [
            ItemOut(
                product_id=item.product_id,
                title=item.title,
                size_label=item.size_label,
                color_name=item.color_name,
                image_url=item.image_url,
                price_minor=item.price_minor,
                quantity=item.quantity,
            )
            for item in order.items
        ],
        "items_minor": order.items_minor,
        "delivery_method": order.delivery_method,
        "delivery_address": order.delivery_address,
        "delivery_fee_minor": order.delivery_fee_minor,
        "total_minor": order.total_minor,
        "store_name": store.name,
        "store_slug": store.slug,
        "payment_method": payment.method,
        "payment_method_name": METHOD_NAMES[PaymentMethod(payment.method)],
        "test_mode": payment.provider == "test",
        "created_at": order.created_at,
        "paid_at": order.paid_at,
        "closing_note": order.closing_note,
        "can_cancel": order.status in (OrderStatus.PENDING_PAYMENT, OrderStatus.PAID),
    }


def record(db: AsyncSession, order: Order, actor: User | None, note: str | None = None) -> None:
    db.add(
        OrderEvent(
            order_id=order.id, status=order.status, actor_id=actor.id if actor else None, note=note
        )
    )


# --- Counted stock --------------------------------------------------------------


def hold(variant: ProductVariant, quantity: int) -> bool:
    """Take pieces out of counted stock for an order. Returns whether stock is counted."""
    if variant.stock_mode != StockMode.EXACT or variant.quantity is None:
        return False
    if variant.quantity < quantity:
        raise ApiError(
            409,
            "out_of_stock",
            "Not enough pieces left",
            [{"variant_id": str(variant.id), "left": variant.quantity}],
        )
    variant.quantity -= quantity
    if variant.quantity == 0:
        set_availability(variant, Availability.OUT_OF_STOCK)
    return True


def close(variant: ProductVariant) -> bool:
    """Switch off a size whose pieces are not counted: it was just sold.

    The store has no number for it, so one sale means "sold" until the seller
    says it is there again. Returns whether this call switched it off.
    """
    if variant.stock_mode == StockMode.EXACT and variant.quantity is not None:
        return False
    if variant.availability_status == Availability.OUT_OF_STOCK:
        return False
    set_availability(variant, Availability.OUT_OF_STOCK)
    return True


async def release(db: AsyncSession, order: Order) -> None:
    """Put an order's held pieces back on sale (cancelled, expired or refunded)."""
    for item in order.items:
        if item.closed_stock and item.variant_id is not None:
            variant = await db.scalar(
                select(ProductVariant)
                .where(ProductVariant.id == item.variant_id)
                .with_for_update(of=ProductVariant)
            )
            if variant is not None and variant.stock_mode != StockMode.EXACT:
                set_availability(variant, Availability.IN_STOCK)
            item.closed_stock = False
        if not item.reserved or item.variant_id is None:
            continue
        # "OF product_variants": the variant's colour is joined in, and only the
        # variant row itself is to be locked.
        variant = await db.scalar(
            select(ProductVariant)
            .where(ProductVariant.id == item.variant_id)
            .with_for_update(of=ProductVariant)
        )
        if variant is not None and variant.stock_mode == StockMode.EXACT:
            variant.quantity = (variant.quantity or 0) + item.quantity
            set_availability(variant, Availability.IN_STOCK)
        item.reserved = False


async def expire_unpaid(db: AsyncSession) -> None:
    """Cancel orders nobody paid in time, so their pieces can be bought by others."""
    deadline = datetime.now(UTC) - timedelta(minutes=PENDING_MINUTES)
    stale = await db.scalars(
        select(Order)
        .where(Order.status == OrderStatus.PENDING_PAYMENT, Order.created_at < deadline)
        .with_for_update(skip_locked=True)
    )
    changed = False
    for order in stale:
        order.status = OrderStatus.CANCELLED
        order.payments[-1].status = PaymentStatus.CANCELLED
        await release(db, order)
        record(db, order, None, "Не оплачен вовремя")
        changed = True
    if changed:
        await db.commit()


async def refund(db: AsyncSession, order: Order, note: str) -> None:
    """Call off a paid order. With the test provider nothing was charged, so the
    refund is only recorded; a real provider must be asked to return the money."""
    order.status = OrderStatus.REFUNDED
    order.closing_note = note
    order.payments[-1].status = PaymentStatus.REFUNDED
    await release(db, order)


# --- Reading the catalog for a cart or an order ----------------------------------


def require_payments() -> None:
    if settings.payment_provider == "none":
        raise ApiError(503, "payments_unavailable", "Online payment is not connected yet")


async def load_variants(
    db: AsyncSession, ids: list[uuid.UUID], lock: bool = False
) -> dict[uuid.UUID, ProductVariant]:
    query = (
        select(ProductVariant)
        .where(ProductVariant.id.in_(ids))
        .options(
            joinedload(ProductVariant.product).selectinload(Product.images),
            joinedload(ProductVariant.product).joinedload(Product.store),
        )
    )
    if lock:
        # Two buyers of the last piece are served one after the other.
        query = query.with_for_update(of=ProductVariant)
    return {variant.id: variant for variant in (await db.scalars(query)).unique()}


def problem_of(variant: ProductVariant, quantity: int) -> str | None:
    """Why this line cannot be bought now, as an error code, or None if it can."""
    product = variant.product
    if product.status != ProductStatus.PUBLISHED or product.store.status != StoreStatus.ACTIVE:
        return "not_found"
    if product.store.is_demo:
        return "demo_product"
    if effective_availability(variant) == Availability.OUT_OF_STOCK:
        return "out_of_stock"
    if variant.stock_mode == StockMode.EXACT and (variant.quantity or 0) < quantity:
        return "out_of_stock"
    return None


async def policy_of(db: AsyncSession, store_id: uuid.UUID) -> StorePolicy | None:
    return await db.scalar(
        select(StorePolicy)
        .where(StorePolicy.store_id == store_id)
        .order_by(StorePolicy.version.desc())
        .limit(1)
    )


def delivery_options(policy: StorePolicy | None) -> tuple[bool, bool, int | None]:
    """(pickup offered, delivery offered, delivery fee). A store that has not
    described its conditions, or offers neither, is taken to hand goods over in person."""
    pickup = policy.pickup_available if policy else True
    delivery = policy.delivery_available if policy else False
    if not pickup and not delivery:
        pickup = True
    return pickup, delivery, policy.delivery_fee_minor if policy else None


def unit_price(variant: ProductVariant) -> int:
    # The price is taken from the catalog on the server, never from the browser.
    return pricing.price(variant, variant.product)


def first_image(product: Product) -> str | None:
    image = product.images[0] if product.images else None
    return storage.image_url(image.object_key, image.external_url) if image else None


async def own_order(db: AsyncSession, user: User, order_id: uuid.UUID, lock: bool = False) -> Order:
    query = select(Order).where(Order.id == order_id, Order.user_id == user.id)
    if lock:
        query = query.with_for_update()
    order = await db.scalar(query)
    if order is None:
        # Someone else's order looks the same as a missing one.
        raise not_found("Order not found")
    return order


# --- Endpoints --------------------------------------------------------------------


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


@router.post("/cart", dependencies=[Depends(rate_limit("cart", limit=120))])
async def check_cart(body: CartIn, db: Db) -> CartOut:
    """The cart as it stands now: current prices, what can be bought, grouped by store.

    The cart itself lives in the buyer's browser; this only reads the catalog.
    """
    await expire_unpaid(db)
    variants = await load_variants(db, [line.variant_id for line in body.items])
    stores: dict[uuid.UUID, CartStore] = {}
    missing = []
    for line in body.items:
        variant = variants.get(line.variant_id)
        if variant is None or problem_of(variant, 1) == "not_found":
            missing.append(line.variant_id)
            continue
        product, store = variant.product, variant.product.store
        if store.id not in stores:
            pickup, delivery, fee = delivery_options(policy := await policy_of(db, store.id))
            stores[store.id] = CartStore(
                id=store.id,
                slug=store.slug,
                name=store.name,
                avatar_url=storage.avatar_url(store.avatar_key),
                pickup_available=pickup,
                delivery_available=delivery,
                delivery_fee_minor=fee,
                delivery_areas=policy.delivery_areas if policy else None,
                delivery_time=policy.delivery_time if policy else None,
                address=store.address,
                lines=[],
                items_minor=0,
            )
        problem = problem_of(variant, line.quantity)
        stores[store.id].lines.append(
            CartLine(
                variant_id=variant.id,
                product_id=product.id,
                title=product.title,
                size_label=variant.size_label,
                color_name=display_name(variant.color) if variant.color else None,
                image_url=first_image(product),
                price_minor=unit_price(variant),
                quantity=line.quantity,
                available=problem is None,
                problem=problem,
                max_quantity=variant.quantity if variant.stock_mode == StockMode.EXACT else None,
            )
        )
        if problem is None:
            stores[store.id].items_minor += unit_price(variant) * line.quantity
    return CartOut(stores=list(stores.values()), missing=missing)


@router.post("/orders", status_code=201, dependencies=[Depends(rate_limit("orders", limit=20))])
async def create_order(body: OrderIn, user: CurrentUser, db: Db) -> OrderOut:
    require_payments()
    await expire_unpaid(db)

    # The same size and colour listed twice counts as one line.
    wanted: dict[uuid.UUID, int] = {}
    for line in body.items:
        wanted[line.variant_id] = min(wanted.get(line.variant_id, 0) + line.quantity, MAX_PER_LINE)
    variants = await load_variants(db, list(wanted), lock=True)
    if len(variants) != len(wanted):
        raise not_found("Product not found")
    store_ids = {variant.product.store_id for variant in variants.values()}
    if len(store_ids) != 1:
        raise ApiError(422, "several_stores", "One order can hold items of one store only")
    for variant_id, quantity in wanted.items():
        problem = problem_of(variants[variant_id], quantity)
        if problem == "not_found":
            raise not_found("Product not found")
        if problem == "demo_product":
            raise ApiError(409, "demo_product", "Demo products cannot be bought")
        if problem:
            raise ApiError(409, "out_of_stock", "This size or colour is out of stock")

    store = next(iter(variants.values())).product.store
    pickup, delivery, fee = delivery_options(await policy_of(db, store.id))
    if body.delivery_method is DeliveryMethod.DELIVERY and not delivery:
        raise ApiError(409, "no_delivery", "This store does not deliver")
    if body.delivery_method is DeliveryMethod.PICKUP and not pickup:
        raise ApiError(409, "no_pickup", "This store does not offer pickup")
    delivery_fee = fee if body.delivery_method is DeliveryMethod.DELIVERY else 0

    items = []
    for position, (variant_id, quantity) in enumerate(wanted.items()):
        variant = variants[variant_id]
        counted = hold(variant, quantity)
        items.append(
            OrderItem(
                product_id=variant.product_id,
                variant_id=variant.id,
                title=variant.product.title,
                size_label=variant.size_label,
                color_name=display_name(variant.color) if variant.color else None,
                image_url=first_image(variant.product),
                price_minor=unit_price(variant),
                quantity=quantity,
                reserved=counted,
                closed_stock=not counted and close(variant),
                position=position,
            )
        )
    items_minor = sum(item.price_minor * item.quantity for item in items)
    total = items_minor + (delivery_fee or 0)
    order = Order(
        user_id=user.id,
        store_id=store.id,
        items_minor=items_minor,
        delivery_fee_minor=delivery_fee,
        total_minor=total,
        delivery_method=body.delivery_method,
        delivery_address=body.address,
        buyer_phone=body.phone,
        status=OrderStatus.PENDING_PAYMENT,
    )
    order.items = items
    order.payments = [
        Payment(
            provider=settings.payment_provider,
            method=body.payment_method,
            amount_minor=total,
            status=PaymentStatus.CREATED,
        )
    ]
    db.add(order)
    await db.flush()
    record(db, order, user)
    await db.commit()
    await db.refresh(order)
    return OrderOut(**order_out(order, store))


@router.get("/me/orders")
async def my_orders(user: CurrentUser, db: Db) -> list[OrderOut]:
    await expire_unpaid(db)
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
    await expire_unpaid(db)
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
    await expire_unpaid(db)
    order = await own_order(db, user, order_id, lock=True)
    payment = order.payments[-1]
    if order.status == OrderStatus.CANCELLED:
        raise ApiError(409, "order_cancelled", "This order was cancelled")
    store = await db.get(Store, order.store_id)
    # Confirming twice changes nothing: the order is already paid.
    if order.status == OrderStatus.PENDING_PAYMENT:
        now = datetime.now(UTC)
        payment.status = PaymentStatus.SUCCEEDED
        payment.confirmed_at = now
        order.status = OrderStatus.PAID
        order.paid_at = now
        record(db, order, user)
        await db.commit()
        await db.refresh(order)
        await emails.tell_store(db, order, store, emails.STORE_NEW)
        await emails.tell_buyer(db, order, store)
    return OrderOut(**order_out(order, store))


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: uuid.UUID, user: CurrentUser, db: Db) -> OrderOut:
    """The buyer backs out: freely before paying, with a refund before the store accepts."""
    order = await own_order(db, user, order_id, lock=True)
    store = await db.get(Store, order.store_id)
    if order.status == OrderStatus.PENDING_PAYMENT:
        order.status = OrderStatus.CANCELLED
        order.payments[-1].status = PaymentStatus.CANCELLED
        await release(db, order)
        record(db, order, user)
        await db.commit()
    elif order.status == OrderStatus.PAID:
        await refund(db, order, "Отменён покупателем")
        record(db, order, user, order.closing_note)
        await db.commit()
        await db.refresh(order)
        await emails.tell_store(db, order, store, emails.STORE_CANCELLED)
        await emails.tell_buyer(db, order, store)
    elif order.status not in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
        raise ApiError(
            409, "order_in_progress", "The store already accepted this order; contact the store"
        )
    await db.refresh(order)
    return OrderOut(**order_out(order, store))


async def store_order(db: AsyncSession, user: User, order_id: uuid.UUID) -> tuple[Order, Store]:
    """An order of a store the user works in, locked for a status change."""
    order = await db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise not_found("Order not found")
    # Not a member: reported as missing, like any other store's data.
    await membership(db, user, order.store_id)
    return order, await db.get(Store, order.store_id)


def merchant_out(order: Order, store: Store, buyer: User) -> MerchantOrderOut:
    return MerchantOrderOut(
        **order_out(order, store), buyer_name=buyer.name, buyer_phone=order.buyer_phone
    )


@router.get("/merchant/orders")
async def store_orders(store_id: uuid.UUID, user: CurrentUser, db: Db) -> list[MerchantOrderOut]:
    """A store's orders from payment onwards, with how to reach the buyer."""
    await membership(db, user, store_id)
    store = await db.get(Store, store_id)
    rows = await db.execute(
        select(Order, User)
        .join(User, User.id == Order.user_id)
        .where(
            Order.store_id == store_id,
            Order.status.not_in([OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED]),
        )
        .options(selectinload(Order.payments), selectinload(Order.items))
        .order_by(Order.paid_at.desc())
        .limit(200)
    )
    return [merchant_out(order, store, buyer) for order, buyer in rows.unique()]


@router.post("/merchant/orders/{order_id}/status")
async def advance_order(
    order_id: uuid.UUID, body: StatusIn, user: CurrentUser, db: Db
) -> MerchantOrderOut:
    """Move an order one step forward: accepted, then shipped, then completed."""
    order, store = await store_order(db, user, order_id)
    # Sending the same step twice changes nothing.
    if order.status != body.status:
        if NEXT_STATUS.get(OrderStatus(order.status)) != body.status:
            raise ApiError(409, "wrong_order_step", "This order cannot be moved to that step")
        order.status = body.status
        record(db, order, user)
        await db.commit()
        await db.refresh(order)
        await emails.tell_buyer(db, order, store)
    return merchant_out(order, store, await db.get(User, order.user_id))


@router.post("/merchant/orders/{order_id}/refuse")
async def refuse_order(
    order_id: uuid.UUID, body: RefuseIn, user: CurrentUser, db: Db
) -> MerchantOrderOut:
    """The store cannot fulfil the order; the buyer gets the money back."""
    order, store = await store_order(db, user, order_id)
    if order.status not in (OrderStatus.PAID, OrderStatus.ACCEPTED):
        raise ApiError(409, "wrong_order_step", "This order can no longer be refused")
    await refund(db, order, body.reason)
    record(db, order, user, body.reason)
    await db.commit()
    await db.refresh(order)
    await emails.tell_buyer(db, order, store)
    return merchant_out(order, store, await db.get(User, order.user_id))
