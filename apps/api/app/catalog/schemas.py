import uuid
from datetime import datetime

from pydantic import BaseModel

from app.catalog.models import Audience, Availability
from app.stores.schemas import StoreBrief, StoreOut


class CategoryOut(BaseModel):
    code: str
    name: str


class ColorOut(BaseModel):
    code: str
    name: str


class VariantOut(BaseModel):
    id: uuid.UUID
    size_system: str | None
    size_label: str | None
    color: ColorOut | None
    # The seller's recommended height for this size, in cm; null when not given.
    height_min_cm: int | None
    height_max_cm: int | None
    price_minor: int
    availability: Availability
    availability_confirmed_at: datetime | None


class ProductListItem(BaseModel):
    id: uuid.UUID
    store: StoreBrief
    title: str
    category: CategoryOut
    audience: Audience
    # Lowest price among the variants that match the request's filters, in minor units.
    price_minor: int
    # True when matching variants have different prices, so the UI shows "from ...".
    price_varies: bool
    currency: str
    brand: str | None
    colors: list[ColorOut]
    size_system: str | None
    # Sizes of the variants that are not marked out of stock.
    sizes: list[str]
    availability: Availability
    image_url: str | None


class ProductList(BaseModel):
    items: list[ProductListItem]
    total: int
    next_cursor: str | None


class ProductDetail(ProductListItem):
    description: str | None
    sku: str | None
    source_url: str | None
    images: list[str]
    variants: list[VariantOut]
    store: StoreOut


class AudienceFacet(BaseModel):
    code: Audience
    count: int
    cover_image: str | None


class CategoryAudienceCount(BaseModel):
    audience: Audience
    count: int


class CategoryFacet(BaseModel):
    code: str
    name: str
    count: int
    cover_image: str | None
    by_audience: list[CategoryAudienceCount]


class SizeFacet(BaseModel):
    system: str | None
    label: str


class CatalogFilters(BaseModel):
    """What the catalog currently contains, for building filter controls and menus."""

    audiences: list[AudienceFacet]
    categories: list[CategoryFacet]
    colors: list[ColorOut]
    sizes: list[SizeFacet]
    stores: list[StoreBrief]
    price_max_minor: int
    product_count: int
