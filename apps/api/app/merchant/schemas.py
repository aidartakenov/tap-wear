import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.catalog.availability import Confirmation
from app.catalog.models import Audience, Availability, ProductStatus
from app.catalog.schemas import CategoryOut, ColorOut
from app.stores.models import MemberRole, StoreStatus

Text100 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
Text200 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Text300 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]
PriceMinor = Annotated[int, Field(gt=0, le=10_000_000_00)]


class StoreIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    description: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None
    ) = None
    city_code: str
    address: Text300 | None = None
    market: Text100 | None = None
    sector: Text100 | None = None
    container: Text100 | None = None
    working_hours: Text200 | None = None
    phone: Phone | None = None
    # Digits only, with country code, as used in wa.me links.
    whatsapp: Annotated[str, StringConstraints(pattern=r"^\d{9,15}$")] | None = None
    instagram: Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9._]{1,30}$")] | None = None
    website: Annotated[str, StringConstraints(pattern=r"^https?://\S+$", max_length=300)] | None = (
        None
    )


class MerchantStoreOut(StoreIn):
    id: uuid.UUID
    slug: str
    status: StoreStatus
    review_note: str | None
    role: MemberRole


class MemberIn(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=254)]


class MemberOut(BaseModel):
    user_id: uuid.UUID
    email: str
    name: str
    role: MemberRole


class VariantIn(BaseModel):
    # Present when editing an existing variant; absent for a new one.
    id: uuid.UUID | None = None
    size_system: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] | None = (
        None
    )
    size_label: Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)] | None = (
        None
    )
    color: str | None = None
    price_override_minor: PriceMinor | None = None
    availability: Availability = Availability.UNKNOWN
    quantity: Annotated[int, Field(ge=0)] | None = None


class ProductIn(BaseModel):
    store_id: uuid.UUID
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    description: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] | None
    ) = None
    category: str
    audience: Audience
    # A public price is mandatory; "price on request" is not allowed.
    base_price_minor: PriceMinor
    brand: Text100 | None = None
    sku: Text100 | None = None
    variants: Annotated[list[VariantIn], Field(max_length=200)] = []


class ProductUpdate(BaseModel):
    # The version the seller was looking at. If someone else saved in between,
    # the update is refused instead of silently overwriting their change.
    expected_version: int
    title: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
        | None
    ) = None
    description: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] | None
    ) = None
    category: str | None = None
    audience: Audience | None = None
    base_price_minor: PriceMinor | None = None
    brand: Text100 | None = None
    sku: Text100 | None = None
    # When given, replaces the full set of variants.
    variants: Annotated[list[VariantIn], Field(max_length=200)] | None = None


class VariantUpdate(BaseModel):
    """Quick change of price or stock for one variant, without touching the rest."""

    price_override_minor: PriceMinor | None = None
    clear_price_override: bool = False
    availability: Availability | None = None
    quantity: Annotated[int, Field(ge=0)] | None = None
    # True when the seller explicitly confirms the stock status is current.
    confirm_availability: bool = False


class MerchantVariantOut(BaseModel):
    id: uuid.UUID
    size_system: str | None
    size_label: str | None
    color: ColorOut | None
    price_override_minor: int | None
    availability: Availability
    quantity: int | None
    availability_confirmed_at: datetime | None
    # For "in stock" variants: whether the confirmation is fresh, due for a
    # reminder, or so old that buyers no longer see "in stock".
    confirmation: Confirmation


class MerchantImageOut(BaseModel):
    id: uuid.UUID
    url: str | None
    color: str | None
    position: int


class MerchantProductOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    title: str
    description: str | None
    category: CategoryOut
    audience: Audience
    base_price_minor: int
    currency: str
    brand: str | None
    sku: str | None
    status: ProductStatus
    version: int
    review_note: str | None
    images: list[MerchantImageOut]
    variants: list[MerchantVariantOut]
    updated_at: datetime


class MerchantProductList(BaseModel):
    items: list[MerchantProductOut]


class ReferenceItem(BaseModel):
    code: str
    name: str


class Reference(BaseModel):
    cities: list[ReferenceItem]
    categories: list[ReferenceItem]
    colors: list[ReferenceItem]
