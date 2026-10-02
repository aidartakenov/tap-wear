"""Step 2a: compute the vector of every catalog photo once and save them.

Computing vectors is the slow part, so it is done once and stored. Searching
afterwards only compares numbers, which is fast.

    python embed_catalog.py
"""

import csv
from pathlib import Path

import numpy as np
from PIL import Image
from sentence_transformers import SentenceTransformer

DATA = Path(__file__).parent / "data"
MODEL = "clip-ViT-B-32"

with open(DATA / "catalog.csv", encoding="utf-8") as table:
    rows = list(csv.DictReader(table))

model = SentenceTransformer(MODEL)
images = [Image.open(DATA / "images" / row["file"]).convert("RGB") for row in rows]

# normalize_embeddings=True makes every vector length 1. Then the cosine
# similarity of two photos is simply their dot product.
vectors = model.encode(images, batch_size=16, normalize_embeddings=True, show_progress_bar=True)

np.save(DATA / "vectors.npy", vectors)
print(f"Saved {vectors.shape[0]} vectors of length {vectors.shape[1]} to {DATA / 'vectors.npy'}")
