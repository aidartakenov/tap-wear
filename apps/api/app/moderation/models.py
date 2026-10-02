import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ModerationLog(Base):
    """Append-only history of review decisions and other administrative actions."""

    __tablename__ = "moderation_log"
    __table_args__ = (
        CheckConstraint("target_type IN ('store', 'product')", name="target_type_valid"),
        Index("ix_moderation_log_target", "target_type", "target_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    target_type: Mapped[str] = mapped_column(String(10))
    target_id: Mapped[uuid.UUID] = mapped_column()
    # submitted, approved, rejected, blocked, archived
    action: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    """A buyer's complaint about a product: wrong price, not available, bad content."""

    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint(
            "reason IN ('wrong_price', 'not_available', 'wrong_photo', 'inappropriate', 'other')",
            name="reason_valid",
        ),
        CheckConstraint("status IN ('open', 'resolved')", name="status_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    reason: Mapped[str] = mapped_column(String(20))
    comment: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="open")
    resolution: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
