# Photo search experiments

Experiments that decided which image model TapWear's "Найти по фото" uses.
Nothing here runs in the product: the product side is `apps/api/app/search/`.

## What was measured

- **Catalog:** the first photo of 125 published products (`data/images/`).
- **Queries:** the second photo of 86 of those products (`data/queries/`), so the
  right answer is known. Each query was also tested as a fake phone screenshot
  and with the person placed on an unrelated busy background (`harder.py`).
- **Metric:** Recall@K, the share of queries whose right product came in the
  top K results.

Limits of this test: query and catalog photo come from the same shop and usually
the same shoot, so it is easier than a real buyer's street photo. The harder
versions are imitations made by code. A test set of real photos, collected by
hand, is the next thing this work needs.

## Result (3 October 2026, MacBook Air, 86 queries, 125 catalog photos)

Ready-made models, full photo:

| Model | Clean R@1 | Clean R@5 | Screenshot R@1 | Screenshot R@5 | ms per photo |
|---|---|---|---|---|---|
| SigLIP B/16 | 88.4% | 100% | 81.4% | 98.8% | 53 |
| FashionCLIP | 86.0% | 100% | 75.6% | 96.5% | 21 |
| CLIP ViT-B/16 | 82.6% | 95.3% | 53.5% | 88.4% | 52 |
| DINOv2 base | 77.9% | 93.0% | 65.1% | 90.7% | 65 |
| DINOv2 small | 72.1% | 94.2% | 59.3% | 96.5% | 30 |
| CLIP ViT-B/32 | 68.6% | 94.2% | 59.3% | 86.0% | 28 |

What is cut from the photo before embedding, SigLIP B/16 (R@1 / R@5):

| Cut | Clean | Screenshot | Busy background |
|---|---|---|---|
| Nothing | 88.4 / 100 | 81.4 / 98.8 | 77.9 / 97.7 |
| Solid bars trimmed | **90.7 / 100** | **87.2 / 100** | **81.4 / 97.7** |
| Cut to the person | 84.9 / 96.5 | 83.7 / 97.7 | 77.9 / 95.3 |
| Cut to all garments | 68.6 / 87.2 | 75.6 / 89.5 | 70.9 / 91.9 |
| Cut to the largest garment | 67.4 / 86.0 | 74.4 / 89.5 | 69.8 / 89.5 |

**Chosen:** SigLIP B/16 with solid bars trimmed. Cutting to detected garments
lowered recall in every test here, so it is not used. One likely reason: the
detector may pick a different garment in the query than in the catalog photo
(trousers in one, the top in the other). Cropping to the garment that matches
the product's category has not been tried.

## Files

| File | What it does |
|---|---|
| `export_catalog.py`, `export_queries.py` | Copy photos and tables from the local TapWear API into `data/` |
| `first.py` | Three photos, two similarity numbers: the idea in ten lines |
| `embed_catalog.py`, `search.py` | Embed the catalog once, then search it with one photo |
| `evaluate.py` | Recall@K for one model |
| `embedders.py` | Six ready models behind one interface |
| `compare_models.py` | The first table above |
| `cropping.py`, `compare_crops.py` | The second table above |
| `harder.py` | The screenshot and busy-background versions of the queries |

## Running

```bash
cd ml
uv venv --python 3.11
uv pip install --python .venv/bin/python -r requirements.txt
source .venv/bin/activate
python export_catalog.py && python export_queries.py   # needs the local API
python compare_models.py
python compare_crops.py siglip-b16
```

Run one experiment at a time: two using the Mac's GPU at once gave a wrong
number during this work. Models download once to `~/.cache/huggingface/`.

Licences as published on the model pages on the day of the test: SigLIP and
DINOv2 Apache-2.0, FashionCLIP MIT, the Fashionpedia garment detector MIT, the
YOLOS person detector Apache-2.0. The OpenAI CLIP pages state no licence in
their metadata. Check each page again before a commercial launch.
