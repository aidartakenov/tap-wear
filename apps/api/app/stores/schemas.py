import uuid

from pydantic import BaseModel, ConfigDict


class CityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str


class StoreBrief(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    # Demo stores are imported samples, not real participants; the UI must say so.
    is_demo: bool


class StoreOut(StoreBrief):
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
    product_count: int
    categories: list[str]
    # A few product photos, used as a preview on store cards.
    preview_images: list[str]


class StoreList(BaseModel):
    items: list[StoreOut]
