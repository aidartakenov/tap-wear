"""Build a first test set for search quality, automatically.

Many products have several photos. The search catalog (data/images) uses the
first one. Here the SECOND photo of each product is saved as a "query": a
different picture of the same item, for which the right answer is known.

Writes data/queries/<product id>.jpg and data/queries.csv. Needs the local API
(http://localhost:8000) and data/catalog.csv from export_catalog.py.

    python export_queries.py
"""

import csv
import json
from pathlib import Path

from export_catalog import API, DATA, fetch

QUERIES = DATA / "queries"


def main() -> None:
    QUERIES.mkdir(parents=True, exist_ok=True)
    with open(DATA / "catalog.csv", encoding="utf-8") as table:
        catalog = list(csv.DictReader(table))

    rows = []
    for item in catalog:
        product = json.loads(fetch(f"{API}/products/{item['product_id']}"))
        if len(product["images"]) < 2:
            continue  # only one photo: nothing to ask with
        file = QUERIES / f"{item['product_id']}.jpg"
        if not file.exists():
            try:
                file.write_bytes(fetch(product["images"][1]))
            except Exception as error:
                print(f"skipped {item['title']}: {error}")
                continue
        rows.append({"file": file.name, "product_id": item["product_id"], "title": item["title"]})

    with open(DATA / "queries.csv", "w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=["file", "product_id", "title"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} query photos in {QUERIES}. Table: {DATA / 'queries.csv'}")


if __name__ == "__main__":
    main()
