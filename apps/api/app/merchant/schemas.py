import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator

from app.catalog.availability import Confirmation
from app.catalog.models import Audience, Availability, ProductStatus
from app.catalog.schemas import CategoryOut, ColorOut
from app.stores.models import CabinetTheme, MemberRole, StoreAudience, StoreStatus

Text100 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
Text200 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Text300 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]
PriceMinor = Annotated[int, Field(gt=0, le=10_000_000_00)]
# "Скидка −30%": a whole number of percent.
DiscountPercent = Annotated[int, Field(ge=1, le=90)]


class StoreIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    description: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None
    ) = None
    city_code: str
    # Who the store sells for; at least one.
    audiences: Annotated[list[StoreAudience], Field(min_length=1)]
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

    @field_validator("audiences")
    @classmethod
    def unique_in_fixed_order(cls, chosen: list[StoreAudience]) -> list[StoreAudience]:
        return [audience for audience in StoreAudience if audience in chosen]


class MerchantStoreOut(StoreIn):
    # Stores opened before the field existed may still have none.
    audiences: list[StoreAudience]
    id: uuid.UUID
    slug: str
    status: StoreStatus
    review_note: str | None
    role: MemberRole
    avatar_url: str | None
    # Colours of this store's cabinet, chosen by the owner.
    cabinet_theme: CabinetTheme


class CabinetThemeIn(BaseModel):
    theme: CabinetTheme


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
    # Optional recommended height of the person for this size, in cm. Give both
    # or neither; the same number twice means a single height.
    height_min_cm: Annotated[int, Field(ge=50, le=250)] | None = None
    height_max_cm: Annotated[int, Field(ge=50, le=250)] | None = None

    @model_validator(mode="after")
    def height_range_is_complete_and_ordered(self):
        low, high = self.height_min_cm, self.height_max_cm
        if (low is None) != (high is None):
            raise ValueError("Give both height_min_cm and height_max_cm, or neither")
        if low is not None and low > high:
            raise ValueError("height_min_cm cannot be greater than height_max_cm")
        return self


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
    discount_percent: DiscountPercent | None = None
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
    # Sent as null, the discount is removed; left out, it stays as it is.
    discount_percent: DiscountPercent | None = None
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
    height_min_cm: int | None
    height_max_cm: int | None
    availability_confirmed_at: datetime | None
    # For "in stock" variants: whether the confirmation is fresh, due for a
    # reminder, or so old that buyers no longer see "in stock".
    confirmation: Confirmation


class MerchantImageOut(BaseModel):
    id: uuid.UUID
    url: str | None
    color: str | None
    position: int


class ImageUpdate(BaseModel):
    # The colour this photo shows; null for a photo that suits every colour.
    color: str | None


class MerchantProductOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    title: str
    description: str | None
    category: CategoryOut
    audience: Audience
    base_price_minor: int
    discount_percent: int | None
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
