import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.reference.models import City


class StoreStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    ACTIVE = "active"
    # Sent back to the owner with a reason; editing the profile resubmits it.
    REJECTED = "rejected"
    BLOCKED = "blocked"


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
