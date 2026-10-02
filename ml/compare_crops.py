"""Step 5: does cutting the photo down before embedding improve search?

Each way of cropping (see cropping.py) is applied to the catalog photos and to
the queries, then Recall@K is measured, on clean queries and on screenshots.

    python compare_crops.py fashion-clip                  # every way of cropping
    python compare_crops.py fashion-clip full trim-bars   # only these

Writes data/crop_comparison_<model>.csv.
"""

import csv
import sys
from pathlib import Path

from PIL import Image

from compare_models import places_of_right_products, read
from cropping import CROPS
from embedders import load
from evaluate import recall_at_k
from harder import new_background, screenshot

DATA = Path(__file__).parent / "data"


def main() -> None:
    model_name = sys.argv[1]
    embed = load(model_name)
    catalog, queries = read("catalog.csv"), read("queries.csv")
    catalog_images = [Image.open(DATA / "images" / row["file"]).convert("RGB") for row in catalog]
    clean = [Image.open(DATA / "queries" / row["file"]).convert("RGB") for row in queries]
    # Three versions of the same queries, from easy to hard.
    sets = {
        "clean": clean,
        "screenshot": [screenshot(image) for image in clean],
        "busy": [new_background(image) for image in clean],
    }

    results = []
    chosen = sys.argv[2:] or list(CROPS)
    for name in chosen:
        crop = CROPS[name]
        catalog_vectors = embed([crop(image) for image in catalog_images])
        row = {"model": model_name, "crop": name}
        for label, images in sets.items():
            vectors = embed([crop(image) for image in images])
            places = places_of_right_products(catalog_vectors, vectors, catalog, queries)
            for k in (1, 5, 10):
                row[f"{label}_recall@{k}"] = round(recall_at_k(places, k), 3)
        results.append(row)
        print(row, flush=True)

    with open(DATA / f"crop_comparison_{model_name}.csv", "w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=list(results[0]))
        writer.writeheader()
        writer.writerows(results)

    print(f"\nmodel {model_name}")
    print(f"{'':<14}{'clean photos':^24}{'as screenshots':^24}{'busy background':^24}")
    print(f"{'crop':<14}" + f"{'R@1':>8}{'R@5':>8}{'R@10':>8}" * 3)
    for row in results:
        print(
            f"{row['crop']:<14}"
            + "".join(f"{row[f'{label}_recall@{k}']:>8.1%}" for label in sets for k in (1, 5, 10))
        )

if __name__ == "__main__":
    main()
