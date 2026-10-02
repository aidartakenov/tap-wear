"""Step 2b: find the catalog photos closest to a query photo.

    python search.py a.jpg

Prints the closest products and saves result.jpg: the query on the left, the
five closest catalog photos next to it, so the result can be judged by eye.
"""

import csv
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from sentence_transformers import SentenceTransformer

HERE = Path(__file__).parent
DATA = HERE / "data"
MODEL = "clip-ViT-B-32"  # must be the model that made vectors.npy
TOP = 5

query_file = Path(sys.argv[1] if len(sys.argv) > 1 else "a.jpg")

with open(DATA / "catalog.csv", encoding="utf-8") as table:
    rows = list(csv.DictReader(table))
catalog = np.load(DATA / "vectors.npy")  # one row per catalog photo

model = SentenceTransformer(MODEL)
query = model.encode(Image.open(query_file).convert("RGB"), normalize_embeddings=True)

# Nearest-neighbour search: one similarity number per catalog photo,
# then take the highest ones. With unit-length vectors this is a dot product.
scores = catalog @ query
best = np.argsort(-scores)[:TOP]

for place, index in enumerate(best, start=1):
    row = rows[index]
    print(f"{place}. {scores[index]:.3f}  {row['title']}  ({row['store']}, {row['category']})")

# A picture of the result: query first, then the matches in order.
tiles = [Image.open(query_file)] + [Image.open(DATA / "images" / rows[i]["file"]) for i in best]
sheet = Image.new("RGB", (220 * len(tiles), 300), "white")
for position, tile in enumerate(tiles):
    sheet.paste(ImageOps.fit(tile.convert("RGB"), (210, 290)), (220 * position + 5, 5))
sheet.save(HERE / "result.jpg")
print(f"Saved {HERE / 'result.jpg'}")
