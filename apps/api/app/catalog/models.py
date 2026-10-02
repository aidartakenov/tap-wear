import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.reference.models import Category, Color
from app.stores.models import Store


class Audience(StrEnum):
    MEN = "men"
    WOMEN = "women"
    UNISEX = "unisex"
    KIDS = "kids"


class ProductStatus(StrEnum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    BLOCKED = "blocked"


class Availability(StrEnum):
    IN_STOCK = "in_stock"
    OUT_OF_STOCK = "out_of_stock"
    # No confirmed stock information: shown as "availability needs checking".
    UNKNOWN = "unknown"


class StockMode(StrEnum):
    # The seller marks availability by hand.
    MANUAL = "manual"
    # The seller tracks an exact quantity.
    EXACT = "exact"


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("base_price_minor > 0", name="base_price_positive"),
        CheckConstraint("audience IN ('men', 'women', 'unisex', 'kids')", name="audience_valid"),
        CheckConstraint(
            "status IN ('draft', 'pending_review', 'published', 'archived', 'blocked')",
            name="status_valid",
        ),
        UniqueConstraint("store_id", "external_id"),
        Index("ix_products_listing", "status", "category_code", "audience"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), index=True)
    # Identifier of the product in the system it was imported from, if any.
    external_id: Mapped[str | None] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    category_code: Mapped[str] = mapped_column(ForeignKey("categories.code"))
    audience: Mapped[str] = mapped_column(String(10))
    # Money is an integer in the currency's minor unit (tyiyn for KGS), never a float.
    base_price_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="KGS")
    brand: Mapped[str | None] = mapped_column(String(100))
    sku: Mapped[str | None] = mapped_column(String(100))
    source_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default=ProductStatus.DRAFT)
    # The administrator's reason for the latest rejection or block, shown to the seller.
    review_note: Mapped[str | None] = mapped_column(Text)
    # Incremented on every edit; an edit must name the version it was based on.
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    store: Mapped[Store] = relationship(lazy="raise")
    category: Mapped[Category] = relationship(lazy="raise")
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="ProductVariant.position",
    )
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="ProductImage.position",
    )


class ProductVariant(Base):
    """One sellable combination of colour and size, with its own price and stock."""

    __tablename__ = "product_variants"
    __table_args__ = (
        CheckConstraint(
            "price_override_minor IS NULL OR price_override_minor > 0",
            name="price_override_positive",
        ),
        CheckConstraint("quantity IS NULL OR quantity >= 0", name="quantity_not_negative"),
        CheckConstraint(
            "availability_status IN ('in_stock', 'out_of_stock', 'unknown')",
            name="availability_valid",
        ),
        CheckConstraint("stock_mode IN ('manual', 'exact')", name="stock_mode_valid"),
        # The same colour, size and size system may not repeat within a product.
        # NULLs count as equal, so a product has at most one "no size, no colour" variant.
        UniqueConstraint(
            "product_id",
            "color_code",
            "size_system",
            "size_label",
            name="uq_product_variants_combination",
            postgresql_nulls_not_distinct=True,
        ),
        Index("ix_product_variants_filter", "size_label", "color_code", "availability_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    # The seller's own marking, e.g. system "TR" with label "38". NULL when not given.
    size_system: Mapped[str | None] = mapped_column(String(20))
    size_label: Mapped[str | None] = mapped_column(String(30))
    color_code: Mapped[str | None] = mapped_column(ForeignKey("colors.code"))
    sku: Mapped[str | None] = mapped_column(String(100))
    price_override_minor: Mapped[int | None] = mapped_column(BigInteger)
    stock_mode: Mapped[str] = mapped_column(String(10), default=StockMode.MANUAL)
    quantity: Mapped[int | None] = mapped_column()
    availability_status: Mapped[str] = mapped_column(String(20), default=Availability.UNKNOWN)
    # Set only when the seller explicitly confirms stock; separate from updated_at.
    availability_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    position: Mapped[int] = mapped_column(default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    product: Mapped[Product] = relationship(back_populates="variants", lazy="raise")
    color: Mapped[Color | None] = relationship(lazy="joined")


class ProductImage(Base):
    __tablename__ = "product_images"
    __table_args__ = (
        CheckConstraint("object_key IS NOT NULL OR external_url IS NOT NULL", name="has_location"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    color_code: Mapped[str | None] = mapped_column(ForeignKey("colors.code"))
    # Key of the stored file in object storage. Signed URLs are generated on
    # request and never stored here.
    object_key: Mapped[str | None] = mapped_column(String(300))
    # Demo products link to the photo on the store's own site instead.
    external_url: Mapped[str | None] = mapped_column(String(500))
    content_hash: Mapped[str | None] = mapped_column(String(64))
    position: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped[Product] = relationship(back_populates="images", lazy="raise")
