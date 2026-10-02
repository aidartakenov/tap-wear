"""A store's sales book: what was sold, how much of it, and for how much.

Online orders are counted from the moment they are paid (refunded ones are
shown apart). A sale made in the shop itself is recorded with one tap on the
size that was sold, so the report covers everything without any form to fill.
"""

import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app import storage
from app.accounts.deps import CurrentUser
from app.accounts.models import User
from app.catalog.availability import effective_availability, set_availability
from app.catalog.models import Availability, Product, ProductStatus, ProductVariant, StockMode
from app.database import get_session
from app.errors import ApiError, not_found
from app.locale import display_name
from app.merchant.access import membership
from app.merchant.router import product_out, reload_product
from app.merchant.schemas import MerchantProductOut
from app.orders import sales_pdf as sales_pdf_file
from app.orders.models import Order, OrderStatus, ShopSale
from app.orders.router import close, hold
from app.stores.models import Store

router = APIRouter(prefix="/merchant", tags=["merchant"])

Db = Annotated[AsyncSession, Depends(get_session)]

SOLD = (OrderStatus.PAID, OrderStatus.ACCEPTED, OrderStatus.SHIPPED, OrderStatus.COMPLETED)
ZONE = ZoneInfo("Asia/Bishkek")
MAX_LINES = 5000


class Summary(BaseModel):
    revenue_minor: int
    # Pieces of clothing, not orders.
    pieces: int
    # Separate purchases: online orders plus sales written down in the shop.
    sales: int
    average_minor: int
    site_revenue_minor: int
    site_pieces: int
    shop_revenue_minor: int
    shop_pieces: int
    refunds: int
    refunds_minor: int
    delivery_orders: int
    pickup_orders: int


class DayOut(BaseModel):
    date: date
    revenue_minor: int
    pieces: int


class VariantSold(BaseModel):
    size_label: str | None
    color_name: str | None
    pieces: int


class ProductSold(BaseModel):
    product_id: uuid.UUID | None
    title: str
    image_url: str | None
    pieces: int
    revenue_minor: int
    variants: list[VariantSold]


class Share(BaseModel):
    key: str
    pieces: int
    revenue_minor: int


class Line(BaseModel):
    """One row of the sales book."""

    id: uuid.UUID
    channel: Literal["site", "shop"]
    sold_at: datetime
    order_number: int | None
    product_id: uuid.UUID | None
    title: str
    size_label: str | None
    color_name: str | None
    quantity: int
    price_minor: int
    total_minor: int
    buyer: str | None
    status: str | None
    note: str | None


class StockRow(BaseModel):
    variant_id: uuid.UUID
    product_id: uuid.UUID
    title: str
    size_label: str | None
    color_name: str | None
    # None when the store does not count this size.
    quantity: int | None
    availability: Availability
    price_minor: int
    # Pieces of this size and colour sold in the chosen period.
    sold: int


class SalesReport(BaseModel):
    days: int
    summary: Summary
    by_day: list[DayOut]
    products: list[ProductSold]
    categories: list[Share]
    sizes: list[Share]
    colors: list[Share]
    lines: list[Line]
    stock: list[StockRow]


class SoldOut(BaseModel):
    # The record just made; pass it to DELETE /merchant/sales/{id} to undo.
    sale_id: uuid.UUID
    product: MerchantProductOut


def period_start(days: int) -> tuple[date, datetime]:
    first_day = datetime.now(ZONE).date() - timedelta(days=days - 1)
    return first_day, datetime.combine(first_day, datetime.min.time(), tzinfo=ZONE).astimezone(UTC)


@router.get("/sales")
async def sales_report(
    store_id: uuid.UUID,
    user: CurrentUser,
    db: Db,
    days: Annotated[int, Query(ge=1, le=366)] = 30,
) -> SalesReport:
    await membership(db, user, store_id)
    first_day, since = period_start(days)

    order_rows = await db.execute(
        select(Order, User.name)
        .join(User, User.id == Order.user_id)
        .where(Order.store_id == store_id, Order.paid_at >= since)
        .where(Order.status.in_([*SOLD, OrderStatus.REFUNDED]))
        .options(selectinload(Order.items))
    )
    shop_sales = await db.scalars(
        select(ShopSale).where(ShopSale.store_id == store_id, ShopSale.sold_at >= since)
    )

    lines: list[Line] = []
    refunds = refunds_minor = delivery_orders = pickup_orders = site_sales = 0
    for order, buyer in order_rows.unique():
        if order.status == OrderStatus.REFUNDED:
            refunds += 1
            refunds_minor += order.total_minor
            continue
        site_sales += 1
        if order.delivery_method == "delivery":
            delivery_orders += 1
        else:
            pickup_orders += 1
        for item in order.items:
            lines.append(
                Line(
                    id=item.id,
                    channel="site",
                    sold_at=order.paid_at,
                    order_number=order.number,
                    product_id=item.product_id,
                    title=item.title,
                    size_label=item.size_label,
                    color_name=item.color_name,
                    quantity=item.quantity,
                    price_minor=item.price_minor,
                    total_minor=item.price_minor * item.quantity,
                    buyer=buyer,
                    status=order.status,
                    note=None,
                )
            )
    shop_count = 0
    for sale in shop_sales:
        shop_count += 1
        lines.append(
            Line(
                id=sale.id,
                channel="shop",
                sold_at=sale.sold_at,
                order_number=None,
                product_id=sale.product_id,
                title=sale.title,
                size_label=sale.size_label,
                color_name=sale.color_name,
                quantity=sale.quantity,
                price_minor=sale.price_minor,
                total_minor=sale.price_minor * sale.quantity,
                buyer=None,
                status=None,
                note=sale.note,
            )
        )
    lines.sort(key=lambda line: line.sold_at, reverse=True)

    # Category and photo of each sold product, as they are in the catalog now.
    product_ids = {line.product_id for line in lines if line.product_id}
    catalog = {}
    if product_ids:
        found = await db.scalars(
            select(Product)
            .where(Product.id.in_(product_ids))
            .options(selectinload(Product.images), joinedload(Product.category))
        )
        catalog = {product.id: product for product in found.unique()}

    by_day: dict[date, list[int]] = defaultdict(lambda: [0, 0])
    products: dict[tuple, dict] = {}
    categories: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    sizes: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    colors: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    sold_by_variant: dict[tuple, int] = defaultdict(int)
    channel = {"site": [0, 0], "shop": [0, 0]}
    for line in lines:
        day = line.sold_at.astimezone(ZONE).date()
        for bucket in (by_day[day], channel[line.channel]):
            bucket[0] += line.total_minor
            bucket[1] += line.quantity
        product = catalog.get(line.product_id)
        key = (line.product_id, line.title)
        entry = products.setdefault(
            key,
            {
                "product_id": line.product_id,
                "title": line.title,
                "image_url": (
                    storage.image_url(product.images[0].object_key, product.images[0].external_url)
                    if product and product.images
                    else None
                ),
                "pieces": 0,
                "revenue_minor": 0,
                "variants": defaultdict(int),
            },
        )
        entry["pieces"] += line.quantity
        entry["revenue_minor"] += line.total_minor
        entry["variants"][(line.size_label, line.color_name)] += line.quantity
        sold_by_variant[(line.product_id, line.size_label, line.color_name)] += line.quantity
        for group, name in (
            (categories, display_name(product.category) if product else "—"),
            (sizes, line.size_label or "—"),
            (colors, line.color_name or "—"),
        ):
            group[name][0] += line.total_minor
            group[name][1] += line.quantity

    def shares(group: dict[str, list[int]]) -> list[Share]:
        return sorted(
            (
                Share(key=key, pieces=pieces, revenue_minor=revenue)
                for key, (revenue, pieces) in group.items()
            ),
            key=lambda share: (-share.pieces, share.key),
        )

    revenue = channel["site"][0] + channel["shop"][0]
    sales = site_sales + shop_count

    # What is on the shelves now, for every product that is not archived.
    variants = await db.scalars(
        select(ProductVariant)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(Product.store_id == store_id, Product.status != ProductStatus.ARCHIVED)
        .options(joinedload(ProductVariant.product))
        .order_by(Product.title, ProductVariant.position)
    )
    stock = []
    for variant in variants.unique():
        color = display_name(variant.color) if variant.color else None
        stock.append(
            StockRow(
                variant_id=variant.id,
                product_id=variant.product_id,
                title=variant.product.title,
                size_label=variant.size_label,
                color_name=color,
                quantity=variant.quantity if variant.stock_mode == StockMode.EXACT else None,
                availability=effective_availability(variant),
                price_minor=variant.price_override_minor or variant.product.base_price_minor,
                sold=sold_by_variant.get((variant.product_id, variant.size_label, color), 0),
            )
        )

    return SalesReport(
        days=days,
        summary=Summary(
            revenue_minor=revenue,
            pieces=channel["site"][1] + channel["shop"][1],
            sales=sales,
            average_minor=revenue // sales if sales else 0,
            site_revenue_minor=channel["site"][0],
            site_pieces=channel["site"][1],
            shop_revenue_minor=channel["shop"][0],
            shop_pieces=channel["shop"][1],
            refunds=refunds,
            refunds_minor=refunds_minor,
            delivery_orders=delivery_orders,
            pickup_orders=pickup_orders,
        ),
        by_day=[
            DayOut(date=day, revenue_minor=by_day[day][0], pieces=by_day[day][1])
            for day in (first_day + timedelta(days=offset) for offset in range(days))
        ],
        products=sorted(
            (
                ProductSold(
                    product_id=entry["product_id"],
                    title=entry["title"],
                    image_url=entry["image_url"],
                    pieces=entry["pieces"],
                    revenue_minor=entry["revenue_minor"],
                    variants=sorted(
                        (
                            VariantSold(size_label=size, color_name=color, pieces=pieces)
                            for (size, color), pieces in entry["variants"].items()
                        ),
                        key=lambda variant: -variant.pieces,
                    ),
                )
                for entry in products.values()
            ),
            key=lambda product: (-product.pieces, product.title),
        ),
        categories=shares(categories),
        sizes=shares(sizes),
        colors=shares(colors),
        lines=lines[:MAX_LINES],
        stock=stock,
    )


@router.get("/sales/pdf")
async def sales_pdf(
    store_id: uuid.UUID,
    user: CurrentUser,
    db: Db,
    days: Annotated[int, Query(ge=1, le=366)] = 30,
) -> Response:
    """The same sales book as a PDF file, to print or send."""
    report = await sales_report(store_id=store_id, user=user, db=db, days=days)
    store = await db.get(Store, store_id)
    content = await run_in_threadpool(sales_pdf_file.render, store.name, report)
    name = f"tapwear-prodazhi-{report.by_day[0].date}_{report.by_day[-1].date}.pdf"
    return Response(
        content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.post("/variants/{variant_id}/sold", status_code=201)
async def mark_sold(variant_id: uuid.UUID, user: CurrentUser, db: Db) -> SoldOut:
    """One tap: one piece of this size and colour was sold in the shop itself.

    The sale is written into the sales book at the catalog price, dated now.
    Counted stock goes down by one; an uncounted size is switched off, the
    same as when it is bought through the site.
    """
    variant = await db.scalar(
        select(ProductVariant)
        .where(ProductVariant.id == variant_id)
        .options(joinedload(ProductVariant.product))
        .with_for_update(of=ProductVariant)
    )
    if variant is None:
        raise not_found("Product not found")
    # Not this store's worker: reported as missing, like any other store's data.
    await membership(db, user, variant.product.store_id)
    if variant.availability_status == Availability.OUT_OF_STOCK:
        raise ApiError(409, "out_of_stock", "This size is already marked as out of stock")

    counted = hold(variant, 1)
    closed = not counted and close(variant)
    sale = ShopSale(
        store_id=variant.product.store_id,
        product_id=variant.product_id,
        variant_id=variant.id,
        title=variant.product.title,
        size_label=variant.size_label,
        color_name=display_name(variant.color) if variant.color else None,
        price_minor=variant.price_override_minor or variant.product.base_price_minor,
        quantity=1,
        reserved=counted,
        closed_stock=closed,
        recorded_by=user.id,
    )
    db.add(sale)
    await db.commit()
    return SoldOut(
        sale_id=sale.id, product=product_out(await reload_product(db, variant.product_id))
    )


@router.delete("/sales/{sale_id}", status_code=204)
async def remove_shop_sale(sale_id: uuid.UUID, user: CurrentUser, db: Db) -> None:
    """Take back a sale written down by mistake; its pieces return to the stock count."""
    sale = await db.get(ShopSale, sale_id)
    if sale is None:
        raise not_found("Sale not found")
    await membership(db, user, sale.store_id)
    if sale.reserved and sale.variant_id:
        variant = await db.scalar(
            select(ProductVariant)
            .where(ProductVariant.id == sale.variant_id)
            .with_for_update(of=ProductVariant)
        )
        if variant is not None and variant.stock_mode == StockMode.EXACT:
            variant.quantity = (variant.quantity or 0) + sale.quantity
            set_availability(variant, Availability.IN_STOCK)
    elif sale.closed_stock and sale.variant_id:
        # The size was marked "out of stock" by this sale; it is on sale again.
        variant = await db.scalar(
            select(ProductVariant)
            .where(ProductVariant.id == sale.variant_id)
            .with_for_update(of=ProductVariant)
        )
        if variant is not None and variant.stock_mode != StockMode.EXACT:
            set_availability(variant, Availability.IN_STOCK)
    await db.delete(sale)
    await db.commit()
