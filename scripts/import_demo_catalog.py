"""Build the demo catalog from the public sites of four Bishkek stores.

The output is DEMO data for local development only: these stores have not agreed
to take part in TapWear. Images are referenced by URL on the stores' own servers
and are not copied into the repository.

Usage (standard library only):

    python3 scripts/import_demo_catalog.py

Writes apps/api/seed/demo_catalog.json. Load it into the database with
`python -m app.seed` from apps/api.
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "apps/api/seed/demo_catalog.json"
PER_STORE = 30
DELAY_SECONDS = 0.6
USER_AGENT = "Mozilla/5.0 (TapWear demo catalog import; local development)"

STORES = [
    {
        "id": "gergert-sport",
        "name": "Gergert Sport",
        "description": "Спортивный магазин в Бишкеке: одежда и обувь Nike, Salomon, "
        "La Sportiva, Rossignol и других брендов, снаряжение для гор, велоспорта и тенниса.",
        "city": "Бишкек",
        "address": "ул. Горького, 182",
        "workingHours": "Ежедневно с 10:00 до 20:00",
        "phone": "+996 772 921 002",
        "whatsapp": "996772921002",
        "instagram": "gergertsport",
        "website": "https://gergert.kg",
    },
    {
        "id": "dresscode",
        "name": "Dresscode",
        "description": "Магазин мужской одежды в Бишкеке: куртки, худи, джинсы, "
        "спортивные костюмы и обувь.",
        "city": "Бишкек",
        "address": "ул. Суеркулова, 20/12",
        "workingHours": None,
        "phone": "+996 557 595 599",
        "whatsapp": "996557595599",
        "instagram": None,
        "website": "https://dresscode.kg",
    },
    {
        "id": "lirus",
        "name": "ЛИРУС",
        "description": "Магазин мужской и женской одежды из Турции, работает в Бишкеке "
        "с 1999 года. Размеры указаны в турецкой системе.",
        "city": "Бишкек",
        "address": "ул. Московская, 58 / Ибраимова",
        "workingHours": None,
        "phone": "+996 555 486 557",
        "whatsapp": "996555486557",
        "instagram": "lirus.kg",
        "website": "https://lirus.kg",
    },
    {
        "id": "adidas-kg",
        "name": "adidas Кыргызстан",
        "description": "Интернет-магазин adidas в Кыргызстане: спортивная одежда, обувь "
        "и аксессуары с доставкой по стране.",
        "city": "Бишкек",
        "address": "ул. Игембердиева, 1а/8",
        "workingHours": None,
        "phone": "+996 778 988 988",
        "whatsapp": None,
        "instagram": None,
        "website": "https://adidas.kg",
    },
]

# Garment type by keyword in the product title; first match wins. Titles that
# match nothing (shoes, bags, accessories) are skipped: R1 covers clothing only.
CATEGORIES = [
    ("coats", "Пальто и тренчи", ("пальто", "тренч", "дублен", "мантия")),
    ("suits", "Костюмы", ("костюм", "двойк", "комплект")),
    (
        "jackets",
        "Куртки",
        ("куртк", "пуховик", "парка", "ветровк", "бомбер", "анорак", "жилет"),
    ),
    ("hoodies", "Худи и свитшоты", ("худи", "толстовк", "свитшот", "олимпийк")),
    ("knitwear", "Свитеры и кардиганы", ("свитер", "кардиган", "водолазк", "джемпер")),
    ("blazers", "Пиджаки и жакеты", ("пиджак", "жакет")),
    ("shirts", "Рубашки и блузы", ("рубашк", "блуз", "туник")),
    ("dresses", "Платья и юбки", ("плать", "юбк", "сарафан")),
    ("shorts", "Шорты", ("шорт",)),
    (
        "trousers",
        "Брюки",
        ("брюк", "джинс", "джоггер", "штан", "легинс", "леггинс", "слакс", "капри"),
    ),
    ("tshirts", "Футболки", ("футболк", "поло", "майк", "топ", "лонгслив", "джерси")),
]

AUDIENCE_WORDS = [
    ("kids", ("детск", "дети", "мальчик", "девочк", "подростк")),
    ("women", ("женск", "женщин")),
    ("men", ("мужск", "мужчин")),
]


def fetch(url: str, referer: str | None = None) -> str:
    headers = {"User-Agent": USER_AGENT}
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    for attempt in range(3):
        time.sleep(DELAY_SECONDS * (attempt + 1))
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8", errors="ignore")
        except OSError:
            if attempt == 2:
                raise
    raise AssertionError("unreachable")


def clean_text(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    fragment = html.unescape(fragment).replace("\xa0", " ")
    # Some pages carry a broken entity ("nbsp;" without the ampersand).
    fragment = re.sub(r"&?nbsp;", " ", fragment)
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in fragment.split("\n")]
    return "\n".join(line for line in lines if line)


def categorize(title: str) -> tuple[str, str] | None:
    lowered = title.lower()
    for code, label, keywords in CATEGORIES:
        if any(keyword in lowered for keyword in keywords):
            return code, label
    return None


def audience_from(text: str, default: str) -> str:
    lowered = text.lower()
    for audience, keywords in AUDIENCE_WORDS:
        if any(keyword in lowered for keyword in keywords):
            return audience
    return default


def to_minor(price: str) -> int:
    """Convert a price in soms ("12295.0000", "14 300") to tyiyn without floats."""
    digits = re.sub(r"[^\d.]", "", price)
    soms, _, fraction = digits.partition(".")
    return int(soms) * 100 + int((fraction + "00")[:2])


def json_ld(page: str, kind: str) -> dict | None:
    blocks = re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', page, re.S)
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") == kind:
            return data
    return None


def product(store_id, source_id, title, price_minor, images, source_url, **extra) -> dict | None:
    category = categorize(extra.pop("category_hint", "") + " " + title)
    if category is None or price_minor <= 0 or not images:
        return None
    return {
        "id": f"{store_id}-{source_id}",
        "storeId": store_id,
        "title": title,
        "description": extra.get("description") or None,
        "category": category[0],
        "categoryLabel": category[1],
        "audience": extra.get("audience", "unisex"),
        "priceMinor": price_minor,
        "currency": "KGS",
        "color": extra.get("color"),
        "brand": extra.get("brand"),
        "sku": extra.get("sku"),
        "sizeSystem": extra.get("size_system"),
        "sizes": extra.get("sizes", []),
        "availability": extra.get("availability", "unknown"),
        "images": images[:5],
        "sourceUrl": source_url,
    }


def import_gergert() -> list[dict]:
    api = "https://store.tildaapi.one/api/getproductslist/"
    query = "?storepartuid=804196908111&recid=531378847&getparts=true&getoptions=true&size=36"
    items, seen_titles, slice_number = [], set(), 1
    while len(items) < PER_STORE and slice_number:
        data = json.loads(fetch(f"{api}{query}&slice={slice_number}", "https://gergert.kg/"))
        for raw in data.get("products", []):
            title = raw["title"].strip()
            if title in seen_titles:
                continue
            seen_titles.add(title)
            images = [entry["img"] for entry in json.loads(raw.get("gallery") or "[]")]
            item = product(
                "gergert-sport",
                raw["uid"],
                title,
                to_minor(raw["price"]),
                images,
                raw["url"],
                description=clean_text(raw.get("text") or ""),
                audience=audience_from(title, "unisex"),
                brand=raw.get("brand") or None,
                sku=raw.get("sku") or None,
            )
            if item:
                items.append(item)
        slice_number = data.get("nextslice")
    return items[:PER_STORE]


def import_dresscode() -> list[dict]:
    home = fetch("https://dresscode.kg/")
    categories = sorted(set(re.findall(r'href="(https://dresscode\.kg/clothes/[\w-]+/)"', home)))
    candidates = []
    for category_url in categories:
        page = fetch(category_url)
        heading = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
        hint = clean_text(heading.group(1)) if heading else ""
        links = re.findall(r'<h4 class="product-name"><a href="([^"]+)">', page)
        candidates.extend((link, hint) for link in links[:3])

    items, seen = [], set()
    for url, hint in candidates:
        if len(items) >= PER_STORE:
            break
        if url in seen:
            continue
        seen.add(url)
        page = fetch(url)
        data = json_ld(page, "Product")
        if not data:
            continue
        product_id = re.search(r"product_id\D{0,20}(\d+)", page)
        images = list(
            dict.fromkeys(
                re.findall(r'"(https://dresscode\.kg/image/cache/[^"]+-800x1019\.\w+)"', page)
            )
        )
        images = [urllib.parse.quote(image, safe=":/%") for image in images]
        description = re.search(r'id="tab-description"[^>]*>(.*?)</div>', page, re.S)
        in_stock = data["offers"].get("availability", "").endswith("InStock")
        item = product(
            "dresscode",
            product_id.group(1) if product_id else len(seen),
            data["name"].strip(),
            to_minor(data["offers"]["price"]),
            images,
            url,
            category_hint=hint,
            description=clean_text(description.group(1)) if description else None,
            audience="men",
            sku=data.get("model") or None,
            availability="in_stock" if in_stock else "out_of_stock",
        )
        if item:
            items.append(item)
    return items


def import_lirus() -> list[dict]:
    items = []
    for listing, audience in (("genskaya_odegda", "women"), ("mugskaya_odegda", "men")):
        links = []
        for page_number in (1, 2):
            suffix = "" if page_number == 1 else f"/{page_number}"
            page = fetch(f"https://lirus.kg/{listing}{suffix}")
            links.extend(
                re.findall(
                    r'<a href="(https://lirus\.kg/item/[^"]+)" title="[^"]*" class="product-image"',
                    page,
                )
            )
        for url in list(dict.fromkeys(links))[: PER_STORE // 2]:
            page = fetch(url)
            crumbs = re.search(r'class="breadcrumbs">(.*?)</ul>', page, re.S)
            crumb_names = re.findall(r"<li>(?:<a[^>]*>)?([^<]+)", crumbs.group(1)) if crumbs else []
            crumb_names = [clean_text(name) for name in crumb_names]
            heading = clean_text(re.search(r"<h1>(.*?)</h1>", page, re.S).group(1))
            # Titles look like "пальто 0918110590001": a garment name plus the store's code.
            match = re.match(r"(.*?)\s*(\d{6,})?$", heading)
            name, code = match.group(1).strip(), match.group(2)
            price = re.search(r'<span class="price">([\d\s]+)сом', page)
            sizes = re.findall(r'name="razmer"[^>]*><label[^>]*>([^<]+)</label>', page)
            images = re.findall(
                r"watermark\.php\?image=(https://lirus\.kg/sources/goods/[^\"'&]+)", page
            )
            description = re.search(r'<meta name="description" content="([^"]*)"', page)
            if not price:
                continue
            item = product(
                "lirus",
                url.rsplit("_", 1)[-1],
                name[:1].upper() + name[1:],
                to_minor(price.group(1)),
                list(dict.fromkeys(images)),
                url,
                category_hint=" ".join(crumb_names[1:3]),
                description=clean_text(description.group(1)) if description else None,
                audience=audience,
                sku=code,
                size_system="TR",
                sizes=list(dict.fromkeys(size.strip() for size in sizes)),
                availability="in_stock" if sizes else "unknown",
            )
            if item:
                items.append(item)
    return items


def import_adidas() -> list[dict]:
    items: list[dict] = []
    for listing in ADIDAS_LISTINGS:
        _import_adidas_listing(listing, items)
    return items


ADIDAS_LISTINGS = ("muzhchiny/odezhda", "zhenshhiny/odezhda", "deti/odezhda")


def _import_adidas_listing(listing: str, items: list[dict]) -> None:
    # The category listing shows the current range; product links end in the article number.
    page = fetch(f"https://adidas.kg/{listing}")
    slugs = list(dict.fromkeys(re.findall(r'href="/([a-z0-9-]+-[a-z]{2}\d{4})"', page)))
    _import_adidas_products(slugs, items, limit=len(items) + PER_STORE // 2)


def _import_adidas_products(slugs: list[str], items: list[dict], limit: int) -> None:
    per_category: dict[str, int] = {}
    for slug in slugs[:60]:
        if len(items) >= limit:
            return
        url = f"https://adidas.kg/{slug}"
        try:
            page = fetch(url)
        except OSError:
            continue
        data = json_ld(page, "Product")
        crumbs = json_ld(page, "BreadcrumbList")
        if not data:
            continue
        # The server-rendered page marks every size as "notify me", so stock is
        # not known from here: record the size range and leave availability unknown.
        in_stock = data.get("offers", {}).get("availability", "").endswith("InStock")
        crumb_names = [entry["name"] for entry in crumbs["itemListElement"]] if crumbs else []
        sku = data["sku"]
        files = dict.fromkeys(re.findall(rf"apparel/{sku}/([\w.-]+?)\.(?:WebP|webp|jpg|png)", page))
        cloud = "https://res.cloudinary.com/dyyxplsts/image/upload/w_800/q_auto,f_auto"
        images = [f"{cloud}/apparel/{sku}/{name}.jpg" for name in files]
        sizes = []
        for _classes, label in re.findall(
            r'<div class="size([^"]*)"[^>]*><div class="size__name"[^>]*>(.*?)</div>', page, re.S
        ):
            label = clean_text(label)
            if label not in sizes:
                sizes.append(label)
        description = re.search(r'id="description"[^>]*>(.*?)</section>', page, re.S)
        item = product(
            "adidas-kg",
            sku,
            data["name"].strip(),
            to_minor(data["offers"]["price"]),
            images,
            url,
            category_hint=" ".join(crumb_names[3:4]),
            description=clean_text(description.group(1))[:800] if description else None,
            audience=audience_from(" ".join(crumb_names[1:2]), "unisex"),
            color=(data.get("color") or "").capitalize() or None,
            brand="adidas",
            sku=sku,
            # Kids' sizes on this site are the child's height in cm.
            size_system="HEIGHT" if sizes and all(size.isdigit() for size in sizes) else "INT",
            sizes=sizes,
            availability="in_stock" if in_stock else "unknown",
        )
        # At most four per garment type, so the sample is not all t-shirts.
        if item and per_category.get(item["category"], 0) < 4 and item not in items:
            items.append(item)
            per_category[item["category"]] = per_category.get(item["category"], 0) + 1


IMPORTERS = {
    "gergert-sport": import_gergert,
    "dresscode": import_dresscode,
    "lirus": import_lirus,
    "adidas-kg": import_adidas,
}


def main() -> int:
    only = set(sys.argv[1:])
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {"products": []}
    products = []
    for store in STORES:
        if only and store["id"] not in only:
            items = [p for p in previous["products"] if p["storeId"] == store["id"]]
        else:
            items = IMPORTERS[store["id"]]()
        print(f"{store['id']}: {len(items)} products")
        products.extend(items)

    catalog = {
        "isDemo": True,
        "generatedAt": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stores": STORES,
        "products": products,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(products)} products to {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
