"""Step 4: run several ready models on the same test set and compare Recall@K.

    python compare_models.py                 # all models
    python compare_models.py clip-b32 dinov2-s

Writes data/model_comparison.csv.
"""

import csv
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

from embedders import MODELS, load
from evaluate import recall_at_k
from harder import screenshot

DATA = Path(__file__).parent / "data"


def read(table: str) -> list[dict]:
    with open(DATA / table, encoding="utf-8") as source:
        return list(csv.DictReader(source))


def places_of_right_products(catalog_vectors, query_vectors, catalog, queries) -> list[int]:
    position = {row["product_id"]: index for index, row in enumerate(catalog)}
    places = []
    for row, query in zip(queries, query_vectors, strict=True):
        order = np.argsort(-(catalog_vectors @ query))
        places.append(int(np.where(order == position[row["product_id"]])[0][0]) + 1)
    return places


def main() -> None:
    names = sys.argv[1:] or list(MODELS)
    catalog, queries = read("catalog.csv"), read("queries.csv")
    catalog_images = [Image.open(DATA / "images" / row["file"]) for row in catalog]
    query_images = [Image.open(DATA / "queries" / row["file"]) for row in queries]
    # The same queries as they would arrive in a phone screenshot: a harder test.
    hard_images = [screenshot(image) for image in query_images]

    results = []
    for name in names:
        embed = load(name)
        started = time.perf_counter()
        catalog_vectors = embed(catalog_images)
        query_vectors = embed(query_images)
        per_image = (time.perf_counter() - started) / (len(catalog_images) + len(query_images))
        places = places_of_right_products(catalog_vectors, query_vectors, catalog, queries)
        hard = places_of_right_products(catalog_vectors, embed(hard_images), catalog, queries)
        results.append(
            {
                "model": name,
                "dimensions": catalog_vectors.shape[1],
                "recall@1": round(recall_at_k(places, 1), 3),
                "recall@5": round(recall_at_k(places, 5), 3),
                "recall@10": round(recall_at_k(places, 10), 3),
                "worst_place": max(places),
                "screenshot_recall@1": round(recall_at_k(hard, 1), 3),
                "screenshot_recall@5": round(recall_at_k(hard, 5), 3),
                "screenshot_recall@10": round(recall_at_k(hard, 10), 3),
                "ms_per_image": round(per_image * 1000),
            }
        )
        print(results[-1], flush=True)

    with open(DATA / "model_comparison.csv", "w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=list(results[0]))
        writer.writeheader()
        writer.writerows(results)

    print(f"\n{len(queries)} queries against {len(catalog)} catalog photos")
    print(f"{'':<14}{'':>6}{'clean photos':^24}{'as screenshots':^24}")
    print(f"{'model':<14}{'dims':>6}{'R@1':>8}{'R@5':>8}{'R@10':>8}{'R@1':>8}{'R@5':>8}{'R@10':>8}{'ms/img':>8}")
    for row in sorted(results, key=lambda item: -item["screenshot_recall@5"]):
        print(
            f"{row['model']:<14}{row['dimensions']:>6}{row['recall@1']:>8.1%}{row['recall@5']:>8.1%}"
            f"{row['recall@10']:>8.1%}{row['screenshot_recall@1']:>8.1%}"
            f"{row['screenshot_recall@5']:>8.1%}{row['screenshot_recall@10']:>8.1%}"
            f"{row['ms_per_image']:>8}"
        )


if __name__ == "__main__":
    main()
