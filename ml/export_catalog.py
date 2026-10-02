"""Copy the catalog's photos from the local TapWear site into ml/data/.

This is plumbing, not ML: it gives the experiments a folder of pictures and a
table saying which product each picture belongs to. The local API must be
running (http://localhost:8000). Run it again any time; photos already saved
are skipped.

    python export_catalog.py
"""

import csv
import json
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

import certifi

API = "http://localhost:8000/api/v1"
DATA = Path(__file__).parent / "data"
IMAGES = DATA / "images"
TLS = ssl.create_default_context(cafile=certifi.where())


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "TapWear ML export"})
    context = TLS if url.startswith("https") else None
    with urllib.request.urlopen(request, timeout=30, context=context) as response:
        return response.read()


def products():
    """Every published product, page by page."""
    cursor = None
    while True:
        query = {"limit": 100} | ({"cursor": cursor} if cursor else {})
        page = json.loads(fetch(f"{API}/products?{urllib.parse.urlencode(query)}"))
        yield from page["items"]
        cursor = page["next_cursor"]
        if not cursor:
            return


def main() -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)
    rows, failed = [], 0
    for product in products():
        if not product["image_url"]:
            continue
        file = IMAGES / f"{product['id']}.jpg"
        if not file.exists():
            try:
                file.write_bytes(fetch(product["image_url"]))
            except Exception as error:  # one slow shop site must not stop the rest
                failed += 1
                print(f"skipped {product['title']}: {error}")
                continue
        rows.append(
            {
                "product_id": product["id"],
                "file": file.name,
                "title": product["title"],
                "category": product["category"]["code"],
                "audience": product["audience"],
                "store": product["store"]["name"],
            }
        )
    with open(DATA / "catalog.csv", "w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} photos in {IMAGES}, {failed} skipped. Table: {DATA / 'catalog.csv'}")


if __name__ == "__main__":
    main()
