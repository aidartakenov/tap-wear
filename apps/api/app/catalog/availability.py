"""How fresh a stock confirmation must be before buyers are told "in stock".

A seller's "in stock" is only shown as such while it has been confirmed
recently. After `availability_stale_hours` without a confirmation the variant
is shown as "availability needs checking" and no longer matches the "in stock"
filter. After `availability_reminder_hours` the seller is reminded to confirm.
"""

from datetime import UTC, datetime, timedelta
from enum import StrEnum

from sqlalchemy import and_

from app.catalog.models import Availability, ProductVariant
from app.config import get_settings

settings = get_settings()


class Confirmation(StrEnum):
    FRESH = "fresh"
    # Old enough that the seller should confirm it again.
    DUE = "due"
    # Too old to be trusted; buyers no longer see "in stock".
    STALE = "stale"


def stale_before(now: datetime | None = None) -> datetime:
    return (now or datetime.now(UTC)) - timedelta(hours=settings.availability_stale_hours)


def confirmation_state(variant: ProductVariant, now: datetime | None = None) -> Confirmation:
    now = now or datetime.now(UTC)
    confirmed = variant.availability_confirmed_at
    if confirmed is None or confirmed < stale_before(now):
        return Confirmation.STALE
    if confirmed < now - timedelta(hours=settings.availability_reminder_hours):
        return Confirmation.DUE
    return Confirmation.FRESH


def effective_availability(variant: ProductVariant, now: datetime | None = None) -> Availability:
    """What a buyer is told. "Out of stock" and "unknown" are shown as they are."""
    if (
        variant.availability_status == Availability.IN_STOCK
        and confirmation_state(variant, now) is Confirmation.STALE
    ):
        return Availability.UNKNOWN
    return Availability(variant.availability_status)


def confirmed_in_stock():
    """SQL condition matching the same rule, for the "in stock" filter."""
    return and_(
        ProductVariant.availability_status == Availability.IN_STOCK,
        ProductVariant.availability_confirmed_at >= stale_before(),
    )


def set_availability(variant: ProductVariant, status: Availability) -> None:
    """Record a stock status given by the seller.

    Stating a new status is itself a confirmation. Saving a variant without
    changing its status is not: the confirmation time stays where it was.
    """
    if variant.availability_status != status or variant.availability_confirmed_at is None:
        variant.availability_confirmed_at = datetime.now(UTC)
    variant.availability_status = status
