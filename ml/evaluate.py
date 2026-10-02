"""Step 3: measure search quality with Recall@K.

For every test query the right product is known (data/queries.csv). The script
searches the catalog with each query and notes at which place the right product
came. Recall@K is the share of queries where that place is K or better.

    python evaluate.py
"""

import csv
from pathlib import Path

import numpy as np
from PIL import Image
from sentence_transformers import SentenceTransformer

DATA = Path(__file__).parent / "data"
MODEL = "clip-ViT-B-32"  # must be the model that made vectors.npy


def recall_at_k(places: list[int], k: int) -> float:
    """The share of queries whose right product came at place k or better.

    `places` has one number per query: 1 means the right product was first,
    2 means second, and so on. Example: recall_at_k([1, 3, 7, 2], k=3) is 0.75,
    because three of the four places (1, 3 and 2) are 3 or better.
    """
    return sum(place <= k for place in places) / len(places)


def main() -> None:
    with open(DATA / "catalog.csv", encoding="utf-8") as table:
        catalog = list(csv.DictReader(table))
    with open(DATA / "queries.csv", encoding="utf-8") as table:
        queries = list(csv.DictReader(table))
    vectors = np.load(DATA / "vectors.npy")
    # Where each product sits in the catalog table (and so in vectors.npy).
    position = {row["product_id"]: index for index, row in enumerate(catalog)}

    model = SentenceTransformer(MODEL)
    images = [Image.open(DATA / "queries" / row["file"]).convert("RGB") for row in queries]
    query_vectors = model.encode(images, batch_size=16, normalize_embeddings=True)

    places = []
    for row, query in zip(queries, query_vectors):
        scores = vectors @ query
        order = np.argsort(-scores)  # catalog positions, best first
        right = position[row["product_id"]]
        places.append(int(np.where(order == right)[0][0]) + 1)

    print(f"{len(places)} queries against {len(catalog)} catalog photos, model {MODEL}")
    for k in (1, 5, 10):
        print(f"Recall@{k}: {recall_at_k(places, k):.1%}")
    print(f"Worst place of a right product: {max(places)}")


if __name__ == "__main__":
    main()
