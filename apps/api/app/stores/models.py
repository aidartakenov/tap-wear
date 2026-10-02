import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.reference.models import City


class StoreStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    ACTIVE = "active"
    # Sent back to the owner with a reason; editing the profile resubmits it.
    REJECTED = "rejected"
    BLOCKED = "blocked"


class StoreAudience(StrEnum):
    """Who a store sells for. A store may pick several."""

    WOMEN = "women"
    MEN = "men"
    KIDS = "kids"


class CabinetTheme(StrEnum):
    """Colours of a store's cabinet (the seller's pages); the owner picks one."""

    BLACK = "black"
    PINK = "pink"
    GREEN = "green"
    BLUE = "blue"
    ORANGE = "orange"
    RAINBOW = "rainbow"


class Store(Base):
    __tablename__ = "stores"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending_review', 'active', 'rejected', 'blocked')", name="status_valid"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    city_code: Mapped[str] = mapped_column(ForeignKey("cities.code"), index=True)
    # StoreAudience codes; buyers filter the store list by them.
    audiences: Mapped[list[str]] = mapped_column(
        ARRAY(String(10)), default=list, server_default=text("'{}'")
    )
    # A CabinetTheme code. Only the store's own people see it, in the cabinet.
    cabinet_theme: Mapped[str] = mapped_column(String(10), default="black", server_default="black")
    address: Mapped[str | None] = mapped_column(String(300))
    # Dordoi and other markets: these help a buyer find the stall.
    market: Mapped[str | None] = mapped_column(String(100))
    sector: Mapped[str | None] = mapped_column(String(100))
    container: Mapped[str | None] = mapped_column(String(100))
    working_hours: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    whatsapp: Mapped[str | None] = mapped_column(String(50))
    instagram: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(300))
    # The Telegram chat that gets this store's order notices, once connected,
    # and the one-time code the owner starts the bot with.
    telegram_chat_id: Mapped[str | None] = mapped_column(String(40))
    telegram_code: Mapped[str | None] = mapped_column(String(40))
    # Object key of the store's avatar (a square picture); NULL when none was uploaded.
    avatar_key: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20), default=StoreStatus.PENDING_REVIEW)
    # The administrator's reason for the latest rejection or block, shown to the owner.
    review_note: Mapped[str | None] = mapped_column(Text)
    # Demo stores come from the import script and are not real participants.
    is_demo: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    city: Mapped[City] = relationship(lazy="joined")


class MemberRole(StrEnum):
    OWNER = "owner"
    STAFF = "staff"


class StoreMember(Base):
    """Gives one account access to one store. Checked on every merchant request."""

    __tablename__ = "store_members"
    __table_args__ = (
        UniqueConstraint("store_id", "user_id"),
        CheckConstraint("role IN ('owner', 'staff')", name="role_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(10))
    invited_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StorePolicy(Base):
    """A store's delivery, payment and return conditions as stated by the seller.

    Every save adds a new version; older versions are never changed, so it stays
    known which conditions were shown at any moment.
    """

    __tablename__ = "store_policies"
    __table_args__ = (
        UniqueConstraint("store_id", "version"),
        CheckConstraint(
            "delivery_fee_minor IS NULL OR delivery_fee_minor >= 0", name="fee_not_negative"
        ),
        CheckConstraint("return_days IS NULL OR return_days >= 0", name="return_days_not_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column()
    pickup_available: Mapped[bool] = mapped_column(default=False)
    delivery_available: Mapped[bool] = mapped_column(default=False)
    # Where the store delivers, in the seller's words: "Бишкек", "по всему Кыргызстану".
    delivery_areas: Mapped[str | None] = mapped_column(String(300))
    # NULL means the fee is not fixed and must be asked; 0 means free delivery.
    delivery_fee_minor: Mapped[int | None] = mapped_column()
    delivery_time: Mapped[str | None] = mapped_column(String(200))
    # The buyer may try the item on when the courier brings it.
    try_on_at_delivery: Mapped[bool] = mapped_column(default=False)
    payment_methods: Mapped[str | None] = mapped_column(String(300))
    # Days within which the store accepts a return or exchange; NULL when not stated.
    return_days: Mapped[int | None] = mapped_column()
    return_terms: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
