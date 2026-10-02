import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderStatus(StrEnum):
    # Created, the buyer has not paid yet.
    PENDING_PAYMENT = "pending_payment"
    # Paid; the store has not reacted yet.
    PAID = "paid"
    # The store confirmed it has the item and will hand it over.
    ACCEPTED = "accepted"
    # Given to a courier, or ready for pickup.
    SHIPPED = "shipped"
    # The buyer has the item.
    COMPLETED = "completed"
    # The buyer backed out before paying.
    CANCELLED = "cancelled"
    # Paid, then called off by the buyer or the store; the money goes back.
    REFUNDED = "refunded"


# What the store may do next, step by step.
NEXT_STATUS = {
    OrderStatus.PAID: OrderStatus.ACCEPTED,
    OrderStatus.ACCEPTED: OrderStatus.SHIPPED,
    OrderStatus.SHIPPED: OrderStatus.COMPLETED,
}
ORDER_STATUSES = ", ".join(f"'{status.value}'" for status in OrderStatus)


class PaymentMethod(StrEnum):
    """The bank app the buyer chose to pay from."""

    MBANK = "mbank"
    OPTIMA = "optima"
    OBANK = "obank"


class PaymentStatus(StrEnum):
    CREATED = "created"
    SUCCEEDED = "succeeded"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class DeliveryMethod(StrEnum):
    PICKUP = "pickup"
    DELIVERY = "delivery"


class Order(Base):
    """What one buyer buys from one store in one go: one or more items.

    Titles, sizes, colours and prices are copied from the catalog when the order
    is made, so later edits to the products do not change what was bought.
    """

    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(f"status IN ({ORDER_STATUSES})", name="status_valid"),
        CheckConstraint("total_minor > 0", name="total_positive"),
        CheckConstraint("delivery_method IN ('pickup', 'delivery')", name="delivery_method_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # A short number people can read out to each other.
    number: Mapped[int] = mapped_column(Identity(start=1001), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), index=True)
    # Integer amounts in minor units (tyiyn), fixed at the moment of ordering.
    items_minor: Mapped[int] = mapped_column()
    # NULL: the store names the delivery price when it contacts the buyer.
    delivery_fee_minor: Mapped[int | None] = mapped_column()
    # What is paid online: the items plus the delivery fee when it is known.
    total_minor: Mapped[int] = mapped_column()
    delivery_method: Mapped[str] = mapped_column(String(10), default=DeliveryMethod.PICKUP)
    delivery_address: Mapped[str | None] = mapped_column(String(300))
    # How the store can reach the buyer about delivery or pickup.
    buyer_phone: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default=OrderStatus.PENDING_PAYMENT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Why a paid order was called off, in the words of whoever did it.
    closing_note: Mapped[str | None] = mapped_column(String(500))

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", order_by="OrderItem.position", lazy="selectin"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="order", order_by="Payment.created_at", lazy="selectin"
    )


class OrderItem(Base):
    """One line of an order: a size and colour of a product, and how many."""

    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("price_minor > 0", name="price_positive"),
        CheckConstraint("quantity BETWEEN 1 AND 20", name="quantity_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL")
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(200))
    size_label: Mapped[str | None] = mapped_column(String(30))
    color_name: Mapped[str | None] = mapped_column(String(100))
    image_url: Mapped[str | None] = mapped_column(String(1000))
    # Price of one piece.
    price_minor: Mapped[int] = mapped_column()
    quantity: Mapped[int] = mapped_column(default=1)
    # True while this line holds pieces out of the variant's counted stock.
    reserved: Mapped[bool] = mapped_column(default=False)
    # True while this line keeps an uncounted size switched off ("sold").
    closed_stock: Mapped[bool] = mapped_column(default=False, server_default="false")
    position: Mapped[int] = mapped_column(default=0)

    order: Mapped[Order] = relationship(back_populates="items")


class Payment(Base):
    """One attempt to pay for an order through a payment provider."""

    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('created', 'succeeded', 'cancelled', 'refunded')", name="status_valid"
        ),
        CheckConstraint("method IN ('mbank', 'optima', 'obank')", name="method_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    # Which integration handled it: "test" simulates the bank, no money moves.
    provider: Mapped[str] = mapped_column(String(20))
    method: Mapped[str] = mapped_column(String(20))
    amount_minor: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default=PaymentStatus.CREATED)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    order: Mapped[Order] = relationship(back_populates="payments")


class OrderEvent(Base):
    """Every change of an order's status: when, to what, and by whom."""

    __tablename__ = "order_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(20))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ShopSale(Base):
    """A sale made in the shop itself, not through the site, written down by the seller.

    Kept next to online orders so that the store's sales report covers everything
    it sold, the way its own notebook or spreadsheet would.
    """

    __tablename__ = "shop_sales"
    __table_args__ = (
        CheckConstraint("price_minor > 0", name="price_positive"),
        CheckConstraint("quantity BETWEEN 1 AND 1000", name="quantity_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), index=True)
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL")
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(200))
    size_label: Mapped[str | None] = mapped_column(String(30))
    color_name: Mapped[str | None] = mapped_column(String(100))
    # What one piece was actually sold for (the seller may have given a discount).
    price_minor: Mapped[int] = mapped_column()
    quantity: Mapped[int] = mapped_column(default=1)
    # True when the pieces were taken out of the variant's counted stock.
    reserved: Mapped[bool] = mapped_column(default=False)
    # True when recording this sale also marked the size "out of stock" (it was
    # the last piece), so undoing the sale puts the size back on sale.
    closed_stock: Mapped[bool] = mapped_column(default=False, server_default="false")
    note: Mapped[str | None] = mapped_column(String(300))
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
