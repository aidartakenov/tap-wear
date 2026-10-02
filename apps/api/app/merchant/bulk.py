"""Adding many products at once from a spreadsheet saved as CSV.

One row is one product; its sizes and colours are multiplied into variants.
Every row is checked first and nothing is created unless all rows are valid, so
a file never ends up half-loaded. Products are created as drafts: photos are
added afterwards, then each product is sent for review as usual.
"""

import csv
import io
import uuid
from decimal import Decimal, InvalidOperation
from typing import Annotated

from fastapi import APIRouter, Depends, UploadFile
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.deps import CurrentUser
from app.catalog.models import Product, ProductStatus
from app.database import get_session
from app.errors import ApiError
from app.merchant.access import store_for
from app.merchant.router import apply_variants
from app.merchant.schemas import ProductIn, VariantIn
from app.rate_limit import rate_limit
from app.reference.models import Category, Color
from app.stores.models import StoreStatus

router = APIRouter(prefix="/merchant", tags=["merchant"])

Db = Annotated[AsyncSession, Depends(get_session)]

MAX_BYTES = 1024 * 1024
MAX_ROWS = 200
MAX_VARIANTS = 60

# Column names as a seller sees them, and the names used here.
COLUMNS = {
    "название": "title",
    "категория": "category",
    "для кого": "audience",
    "цена": "price",
    "бренд": "brand",
    "описание": "description",
    "система размеров": "size_system",
    "размеры": "sizes",
    "цвета": "colors",
    "количество": "quantity",
}
REQUIRED = ("title", "category", "audience", "price")
AUDIENCES = {
    "женщинам": "women", "женское": "women", "женский": "women", "women": "women",
    "мужчинам": "men", "мужское": "men", "мужской": "men", "men": "men",
    "детям": "kids", "детское": "kids", "детский": "kids", "kids": "kids",
    "унисекс": "unisex", "unisex": "unisex",
}  # fmt: skip
SIZE_SYSTEMS = {"INT", "RU", "EU", "TR", "HEIGHT"}


class RowResult(BaseModel):
    # The row's number in the file, counting the header as row 1.
    row: int
    title: str
    errors: list[str]


class ImportResult(BaseModel):
    created: int
    rows: list[RowResult]


def read_table(raw: bytes) -> list[dict[str, str]]:
    """Rows of the file as dictionaries keyed by our column names."""
    if len(raw) > MAX_BYTES:
        raise ApiError(413, "file_too_large", "The file is larger than 1 MB")
    # Excel saves CSV either as UTF-8 (with a mark at the start) or in the Windows encoding.
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1251", errors="replace")
    first_line = text.splitlines()[0] if text.strip() else ""
    delimiter = max(";,\t", key=first_line.count)
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        header = [COLUMNS.get(cell.strip().lower()) for cell in next(reader)]
    except StopIteration:
        raise ApiError(422, "empty_file", "The file is empty") from None
    missing = [name for name in REQUIRED if name not in header]
    if missing:
        wanted = [russian for russian, name in COLUMNS.items() if name in missing]
        raise ApiError(
            422, "missing_columns", "Columns are missing: " + ", ".join(wanted), {"missing": wanted}
        )
    rows = []
    for cells in reader:
        if not any(cell.strip() for cell in cells):
            continue
        rows.append(
            {
                name: cell.strip()
                for name, cell in zip(header, cells, strict=False)
                if name is not None
            }
        )
    if len(rows) > MAX_ROWS:
        raise ApiError(422, "too_many_rows", f"At most {MAX_ROWS} products per file")
    if not rows:
        raise ApiError(422, "empty_file", "The file has no products")
    return rows


def split(cell: str) -> list[str]:
    """ "S, M ,L" -> ["S", "M", "L"], without repeats."""
    return list(
        dict.fromkeys(part.strip() for part in cell.replace(";", ",").split(",") if part.strip())
    )


def price_minor(cell: str) -> int | None:
    try:
        amount = Decimal(cell.replace(" ", "").replace(" ", "").replace(",", "."))
    except InvalidOperation:
        return None
    minor = amount * 100
    return int(minor) if amount > 0 and minor == minor.to_integral_value() else None


def to_product(
    row: dict[str, str],
    store_id: uuid.UUID,
    categories: dict[str, str],
    colors: dict[str, str],
) -> tuple[ProductIn | None, list[str]]:
    """The row as a product, or the reasons it cannot be one (in Russian, for the seller)."""
    errors = []
    category = categories.get(row.get("category", "").lower())
    if category is None:
        errors.append(f"Нет такой категории: «{row.get('category', '')}»")
    audience = AUDIENCES.get(row.get("audience", "").lower())
    if audience is None:
        errors.append("«Для кого» должно быть: женщинам, мужчинам, детям или унисекс")
    price = price_minor(row.get("price", ""))
    if price is None:
        errors.append("Цена должна быть числом в сомах, например 4500")

    size_system = row.get("size_system", "").upper() or None
    sizes = split(row.get("sizes", ""))
    if size_system and size_system not in SIZE_SYSTEMS:
        errors.append("Система размеров: INT, RU, EU, TR или HEIGHT")
    if sizes and not size_system:
        size_system = "INT"
    color_codes = []
    for name in split(row.get("colors", "")):
        code = colors.get(name.lower())
        if code is None:
            errors.append(f"Нет такого цвета: «{name}»")
        else:
            color_codes.append(code)
    quantity = None
    if row.get("quantity"):
        if row["quantity"].isdigit():
            quantity = int(row["quantity"])
        else:
            errors.append("Количество должно быть целым числом")

    combinations = [(size, color) for size in sizes or [None] for color in color_codes or [None]]
    if len(combinations) > MAX_VARIANTS:
        errors.append(f"Слишком много сочетаний размеров и цветов (больше {MAX_VARIANTS})")
    if errors:
        return None, errors
    try:
        return (
            ProductIn(
                store_id=store_id,
                title=row.get("title", ""),
                description=row.get("description") or None,
                category=category,
                audience=audience,
                base_price_minor=price,
                brand=row.get("brand") or None,
                variants=[
                    VariantIn(
                        size_system=size_system if size else None,
                        size_label=size,
                        color=color,
                        availability="in_stock",
                        quantity=quantity,
                    )
                    for size, color in combinations
                ],
            ),
            [],
        )
    except ValidationError as error:
        problems = {str(item["loc"][0]) for item in error.errors()}
        known = {
            "title": "Название: от 2 до 200 символов",
            "base_price_minor": "Цена слишком большая",
        }
        return None, [known.get(problem, f"Неверное значение: {problem}") for problem in problems]


@router.post("/stores/{store_id}/import", dependencies=[Depends(rate_limit("import", limit=20))])
async def import_products(
    store_id: uuid.UUID, file: UploadFile, user: CurrentUser, db: Db, dry_run: bool = False
) -> ImportResult:
    """Create draft products from a CSV file. With dry_run the file is only checked."""
    store, _ = await store_for(db, user, store_id)
    if store.status == StoreStatus.BLOCKED:
        raise ApiError(403, "store_blocked", "This store was blocked by an administrator")
    rows = read_table(await file.read(MAX_BYTES + 1))

    # Categories and colours may be written by their Russian or Kyrgyz name, or by code.
    categories, colors = {}, {}
    for model, names in ((Category, categories), (Color, colors)):
        for item in await db.scalars(select(model)):
            for name in (item.code, item.name_ru, item.name_ky):
                if name:
                    names[name.lower()] = item.code

    results, products = [], []
    for number, row in enumerate(rows, start=2):
        product, errors = to_product(row, store.id, categories, colors)
        results.append(RowResult(row=number, title=row.get("title", ""), errors=errors))
        if product:
            products.append(product)

    if dry_run or any(result.errors for result in results):
        return ImportResult(created=0, rows=results)

    for body in products:
        product = Product(
            store_id=store.id,
            title=body.title,
            description=body.description,
            category_code=body.category,
            audience=body.audience,
            base_price_minor=body.base_price_minor,
            brand=body.brand,
            status=ProductStatus.DRAFT,
            variants=[],
            images=[],
        )
        db.add(product)
        await db.flush()
        await apply_variants(db, product, body.variants)
    await db.commit()
    return ImportResult(created=len(products), rows=results)
