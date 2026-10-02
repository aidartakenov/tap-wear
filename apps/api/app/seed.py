"""Load the demo catalog into the database.

    python -m app.seed [path/to/demo_catalog.json]
    python -m app.seed --reference-only

The file is produced by scripts/import_demo_catalog.py. Loading is repeatable:
ids are derived from the source ids, so running it again updates the same rows.
Demo stores are flagged is_demo and must not be presented as live offers. With
--reference-only nothing but the reference lists is loaded: the right choice
for a real installation.
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy import delete, select

from app import storage
from app.catalog.models import (
    Availability,
    Product,
    ProductImage,
    ProductStatus,
    ProductVariant,
)
from app.database import SessionLocal, engine
from app.errors import ApiError
from app.reference.models import Category, City, Color
from app.stores.models import Store, StoreAudience, StoreStatus

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "seed" / "demo_catalog.json"
# Avatars of the demo stores: monograms drawn by scripts/make_demo_avatars.py.
AVATARS_DIR = DEFAULT_PATH.parent / "avatars"

# Fixed namespace so that the same demo id always maps to the same UUID.
NAMESPACE = uuid.UUID("6f1c2f0e-6a3b-4c58-9f0d-7d1e5b0a9c11")

CITIES = {"Бишкек": "bishkek"}

CATEGORY_NAMES_RU = {
    "jackets": "Куртки",
    "coats": "Пальто и тренчи",
    "suits": "Костюмы",
    "hoodies": "Худи и свитшоты",
    "knitwear": "Свитеры и кардиганы",
    "blazers": "Пиджаки и жакеты",
    "shirts": "Рубашки и блузы",
    "dresses": "Платья и юбки",
    "shorts": "Шорты",
    "trousers": "Брюки",
    "tshirts": "Футболки",
    "fur": "Шубы и дублёнки",
    "vests": "Жилеты",
    "sportswear": "Спортивная одежда",
    "underwear": "Бельё и носки",
    "shoes": "Обувь",
    "bags": "Сумки и рюкзаки",
    "headwear": "Головные уборы",
    "accessories": "Аксессуары",
    "national": "Национальная одежда",
}

# Kyrgyz display names. Machine-drafted: they need review by a native speaker
# before a public release.
CITY_NAMES_KY = {"bishkek": "Бишкек"}
CATEGORY_NAMES_KY = {
    "jackets": "Курткалар",
    "coats": "Пальто жана тренчтер",
    "suits": "Костюмдар",
    "hoodies": "Худи жана свитшоттор",
    "knitwear": "Свитерлер жана кардигандар",
    "blazers": "Пиджактар жана жакеттер",
    "shirts": "Рубашкалар жана блузкалар",
    "dresses": "Көйнөктөр жана юбкалар",
    "shorts": "Шортылар",
    "trousers": "Шымдар",
    "tshirts": "Футболкалар",
    "fur": "Тондор",
    "vests": "Жилеттер",
    "sportswear": "Спорттук кийим",
    "underwear": "Ич кийим жана байпак",
    "shoes": "Бут кийим",
    "bags": "Сумкалар жана рюкзактар",
    "headwear": "Баш кийимдер",
    "accessories": "Аксессуарлар",
    "national": "Улуттук кийим",
}
COLOR_NAMES_KY = {
    "black": "Кара",
    "white": "Ак",
    "blue": "Көк",
    "green": "Жашыл",
    "brown": "Күрөң",
    "orange": "Кызгылт сары",
    "pink": "Кызгылт",
    "burgundy": "Кочкул кызыл",
    "red": "Кызыл",
    "beige": "Беж",
    "gray": "Боз",
    "light_blue": "Ачык көк",
    "yellow": "Сары",
    "purple": "Кызгылт көк",
    "khaki": "Хаки",
    "multicolor": "Ар түстүү",
}

COLORS = {
    "Черный": "black",
    "Белый": "white",
    "Синий": "blue",
    "Зеленый": "green",
    "Коричневый": "brown",
    "Оранжевый": "orange",
    "Розовый": "pink",
    "Бордовый": "burgundy",
    "Красный": "red",
    "Бежевый": "beige",
    "Серый": "gray",
    "Голубой": "light_blue",
    "Желтый": "yellow",
    "Фиолетовый": "purple",
    "Хаки": "khaki",
    "Разноцветный": "multicolor",
}


async def demo_avatar_key(store_id: uuid.UUID, slug: str) -> str | None:
    """Upload the demo store's avatar (seed/avatars/<slug>.png), if there is one."""
    file = AVATARS_DIR / f"{slug}.png"
    if not file.exists():
        return None
    try:
        image = storage.process_image(file.read_bytes(), square_side=storage.AVATAR_SIDE)
        return await storage.store_avatar(store_id, image, name=f"demo-{image.content_hash[:12]}")
    except ApiError as error:
        print(f"Avatar of {slug} was not loaded: {error.message}")
        return None


def demo_uuid(*parts: object) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, ":".join(str(part) for part in parts))


async def seed(path: Path | None) -> None:
    # Without a file only the reference lists (cities, categories, colours) are loaded.
    catalog = json.loads(path.read_text()) if path else {"stores": [], "products": []}
    generated_at = datetime.fromisoformat(catalog["generatedAt"]) if path else None

    async with SessionLocal() as session:
        for name, code in CITIES.items():
            await session.merge(City(code=code, name_ru=name, name_ky=CITY_NAMES_KY.get(code)))
        for name, code in COLORS.items():
            await session.merge(Color(code=code, name_ru=name, name_ky=COLOR_NAMES_KY.get(code)))
        categories = CATEGORY_NAMES_RU | {
            p["category"]: p["categoryLabel"] for p in catalog["products"]
        }
        for position, (code, label) in enumerate(sorted(categories.items(), key=lambda c: c[1])):
            await session.merge(
                Category(
                    code=code,
                    name_ru=label,
                    name_ky=CATEGORY_NAMES_KY.get(code),
                    position=position,
                )
            )
        await session.flush()

        store_ids = {}
        for item in catalog["stores"]:
            store_ids[item["id"]] = demo_uuid("store", item["id"])
            # Whoever the store's products are for.
            audiences = [
                audience
                for audience in StoreAudience
                if any(
                    p["storeId"] == item["id"] and p["audience"] == audience
                    for p in catalog["products"]
                )
            ]
            store = await session.merge(
                Store(
                    id=store_ids[item["id"]],
                    slug=item["id"],
                    name=item["name"],
                    description=item["description"],
                    city_code=CITIES[item["city"]],
                    audiences=audiences,
                    address=item["address"],
                    working_hours=item["workingHours"],
                    phone=item["phone"],
                    whatsapp=item["whatsapp"],
                    instagram=item["instagram"],
                    website=item["website"],
                    status=StoreStatus.ACTIVE,
                    is_demo=True,
                )
            )
            # Keeps the current avatar when storage is unreachable.
            if key := await demo_avatar_key(store.id, item["id"]):
                store.avatar_key = key
        await session.flush()

        product_ids = []
        for item in catalog["products"]:
            product_id = demo_uuid("product", item["id"])
            product_ids.append(product_id)
            color_code = COLORS.get(item["color"]) if item["color"] else None
            if item["color"] and color_code is None:
                print(f"Unknown colour {item['color']!r} on {item['id']}; stored without colour")

            await session.merge(
                Product(
                    id=product_id,
                    store_id=store_ids[item["storeId"]],
                    external_id=item["id"],
                    title=item["title"],
                    description=item["description"],
                    category_code=item["category"],
                    audience=item["audience"],
                    base_price_minor=item["priceMinor"],
                    currency=item["currency"],
                    brand=item["brand"],
                    sku=item["sku"],
                    source_url=item["sourceUrl"],
                    status=ProductStatus.PUBLISHED,
                )
            )

            # One variant per size; a product without size data gets a single
            # variant with no size, so that it still has a price and availability.
            sizes = item["sizes"] or [None]
            variant_ids = []
            for position, size in enumerate(sizes):
                variant_id = demo_uuid("variant", item["id"], size)
                variant_ids.append(variant_id)
                await session.merge(
                    ProductVariant(
                        id=variant_id,
                        product_id=product_id,
                        size_system=item["sizeSystem"] if size else None,
                        size_label=size,
                        color_code=color_code,
                        availability_status=Availability(item["availability"]),
                        # The store's site showed this stock when the file was generated.
                        availability_confirmed_at=generated_at,
                        position=position,
                    )
                )
            image_ids = []
            for position, url in enumerate(item["images"]):
                image_id = demo_uuid("image", item["id"], url)
                image_ids.append(image_id)
                await session.merge(
                    ProductImage(
                        id=image_id,
                        product_id=product_id,
                        color_code=color_code,
                        external_url=url,
                        position=position,
                    )
                )
            await session.flush()

            # Drop variants and images that are no longer in the source.
            await session.execute(
                delete(ProductVariant).where(
                    ProductVariant.product_id == product_id, ProductVariant.id.not_in(variant_ids)
                )
            )
            await session.execute(
                delete(ProductImage).where(
                    ProductImage.product_id == product_id, ProductImage.id.not_in(image_ids)
                )
            )

        # Demo products that disappeared from the source are removed entirely.
        if path:
            demo_store_ids = select(Store.id).where(Store.is_demo)
            await session.execute(
                delete(Product).where(
                    Product.store_id.in_(demo_store_ids), Product.id.not_in(product_ids)
                )
            )
        await session.commit()

    await engine.dispose()
    print(f"Loaded {len(catalog['stores'])} stores and {len(catalog['products'])} products")


if __name__ == "__main__":
    argument = sys.argv[1] if len(sys.argv) > 1 else None
    if argument == "--reference-only":
        asyncio.run(seed(None))
    else:
        asyncio.run(seed(Path(argument) if argument else DEFAULT_PATH))
