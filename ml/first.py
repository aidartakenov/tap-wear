"""Step 1: see that similar pictures give close vectors.

Put three photos next to this file: a.jpg and b.jpg of similar things (two
jackets), c.jpg of something different (a T-shirt or a dress). Then run:

    python first.py
"""

from pathlib import Path

from PIL import Image
from sentence_transformers import SentenceTransformer, util

HERE = Path(__file__).parent
NAMES = ("a.jpg", "b.jpg", "c.jpg")

missing = [name for name in NAMES if not (HERE / name).exists()]
if missing:
    raise SystemExit(f"Put these photos into {HERE} first: {', '.join(missing)}")

# A ready-made model that turns a picture into 512 numbers.
# The first run downloads it (about 600 MB); later runs are fast.
model = SentenceTransformer("clip-ViT-B-32")
vectors = model.encode([Image.open(HERE / name) for name in NAMES])

print("length of one vector:", len(vectors[0]))
# Cosine similarity: close to 1 means "looks alike", lower means "different".
print("a vs b:", float(util.cos_sim(vectors[0], vectors[1])))
print("a vs c:", float(util.cos_sim(vectors[0], vectors[2])))
