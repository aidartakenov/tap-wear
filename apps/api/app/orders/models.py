import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderStatus(StrEnum):
    # Created, the buyer has not paid yet.
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    # The buyer backed out before paying.
    CANCELLED = "cancelled"


class PaymentMethod(StrEnum):
    """The bank app the buyer chose to pay from."""

    MBANK = "mbank"
    OPTIMA = "optima"
    OBANK = "obank"


class PaymentStatus(StrEnum):
    CREATED = "created"
    SUCCEEDED = "succeeded"
    CANCELLED = "cancelled"


class Order(Base):
    """One item bought from one store.

    Title, size, colour and price are copied from the catalog when the order is
    made, so later edits to the product do not change what was bought.
    """

    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("status IN ('pending_payment', 'paid', 'cancelled')", name="status_valid"),
        CheckConstraint("price_minor > 0", name="price_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # A short number people can read out to each other.
    number: Mapped[int] = mapped_column(Identity(start=1001), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
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
    image_url: Mapped[str | None] = mapped_column(String(1000))
    # Integer amount in minor units (tyiyn), fixed at the moment of ordering.
    price_minor: Mapped[int] = mapped_column()
    # How the store can reach the buyer about delivery or pickup.
    buyer_phone: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default=OrderStatus.PENDING_PAYMENT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    payments: Mapped[list["Payment"]] = relationship(
        back_populates="order", order_by="Payment.created_at", lazy="selectin"
    )


class Payment(Base):
    """One attempt to pay for an order through a payment provider."""

    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("status IN ('created', 'succeeded', 'cancelled')", name="status_valid"),
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
