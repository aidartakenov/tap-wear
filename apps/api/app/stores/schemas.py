import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.stores.models import StoreAudience


class CityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str


class PolicyIn(BaseModel):
    pickup_available: bool = False
    delivery_available: bool = False
    delivery_areas: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None
    ) = None
    # Minor units (tyiyn). None: the fee must be asked. 0: free delivery.
    delivery_fee_minor: Annotated[int, Field(ge=0, le=1_000_000_00)] | None = None
    delivery_time: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None
    ) = None
    try_on_at_delivery: bool = False
    payment_methods: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None
    ) = None
    return_days: Annotated[int, Field(ge=0, le=365)] | None = None
    return_terms: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)] | None
    ) = None


class PolicyOut(PolicyIn):
    version: int
    updated_at: datetime


class StoreBrief(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    # Demo stores are imported samples, not real participants; the UI must say so.
    is_demo: bool
    # The store's own picture; null when the store has not uploaded one.
    avatar_url: str | None = None


class StoreOut(StoreBrief):
    # Who the store sells for: "women", "men", "kids".
    audiences: list[StoreAudience]
    description: str | None
    city: CityOut
    address: str | None
    market: str | None
    sector: str | None
    container: str | None
    working_hours: str | None
    phone: str | None
    whatsapp: str | None
    instagram: str | None
    website: str | None
    # Delivery, payment and return conditions as stated by the seller; null if not filled in.
    policy: PolicyOut | None
    product_count: int
    categories: list[str]
    # A few product photos, used as a preview on store cards.
    preview_images: list[str]


class StoreList(BaseModel):
    items: list[StoreOut]
