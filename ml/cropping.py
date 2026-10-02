"""Ways to cut a photo down to what matters before it is embedded.

A photo of a person in a street, or a shop photo with black bars, contains much
that is not the garment. Each function here takes a picture and returns a
(possibly) smaller one; if nothing is found the picture is returned unchanged.
"""

from functools import lru_cache

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForObjectDetection

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"

# A small detector trained on everyday objects (COCO); class "person" is used.
PERSON_DETECTOR = "hustvl/yolos-tiny"
# The same detector family trained on Fashionpedia: finds garments themselves.
GARMENT_DETECTOR = "valentinafevu/yolos-fashionpedia"
# Parts of garments and accessories are not what a buyer searches for.
GARMENT_CLASSES = {
    "shirt, blouse", "top, t-shirt, sweatshirt", "sweater", "cardigan", "jacket", "vest",
    "pants", "shorts", "skirt", "coat", "dress", "jumpsuit", "cape",
}  # fmt: skip


def trim_bars(image: Image.Image, tolerance: int = 12) -> Image.Image:
    """Remove solid black or white bands around a photo (letterboxing)."""
    pixels = np.asarray(image.convert("L"), dtype=np.int16)
    for edge_value in (0, 255):
        content = np.abs(pixels - edge_value) > tolerance
        rows, columns = np.where(content.any(axis=1))[0], np.where(content.any(axis=0))[0]
        if len(rows) and len(columns):
            box = (columns[0], rows[0], columns[-1] + 1, rows[-1] + 1)
            # Only accept a trim that removes a real band, not a pixel of noise.
            if (box[2] - box[0]) * (box[3] - box[1]) < 0.97 * image.width * image.height:
                image = image.crop(box)
                pixels = np.asarray(image.convert("L"), dtype=np.int16)
    return image


@lru_cache
def _detector(model_id: str):
    processor = AutoImageProcessor.from_pretrained(model_id)
    model = AutoModelForObjectDetection.from_pretrained(model_id).to(DEVICE).eval()
    return processor, model


@torch.no_grad()
def detect(image: Image.Image, model_id: str, threshold: float) -> list[dict]:
    """Boxes found in the picture: [{"label", "score", "box": (x0, y0, x1, y1)}, ...]."""
    processor, model = _detector(model_id)
    rgb = image.convert("RGB")
    outputs = model(**processor(images=rgb, return_tensors="pt").to(DEVICE))
    found = processor.post_process_object_detection(
        outputs, threshold=threshold, target_sizes=torch.tensor([[rgb.height, rgb.width]])
    )[0]
    return [
        {
            "label": model.config.id2label[int(label)],
            "score": float(score),
            "box": tuple(float(value) for value in box),
        }
        for score, label, box in zip(found["scores"], found["labels"], found["boxes"], strict=True)
    ]


def _crop(image: Image.Image, box: tuple[float, float, float, float], margin: float) -> Image.Image:
    x0, y0, x1, y1 = box
    dx, dy = (x1 - x0) * margin, (y1 - y0) * margin
    return image.crop(
        (max(0, int(x0 - dx)), max(0, int(y0 - dy)), min(image.width, int(x1 + dx)), min(image.height, int(y1 + dy)))
    )


def _area(box) -> float:
    return max(0.0, box[2] - box[0]) * max(0.0, box[3] - box[1])


def crop_person(image: Image.Image) -> Image.Image:
    """Cut to the largest person, dropping the background around them."""
    image = trim_bars(image)
    people = [found for found in detect(image, PERSON_DETECTOR, 0.8) if found["label"] == "person"]
    if not people:
        return image
    return _crop(image, max(people, key=lambda found: _area(found["box"]))["box"], margin=0.03)


def crop_garments(image: Image.Image) -> Image.Image:
    """Cut to the area covered by all garments found (the outfit, without background)."""
    image = trim_bars(image)
    garments = [f for f in detect(image, GARMENT_DETECTOR, 0.5) if f["label"] in GARMENT_CLASSES]
    if not garments:
        return image
    boxes = np.array([found["box"] for found in garments])
    union = (boxes[:, 0].min(), boxes[:, 1].min(), boxes[:, 2].max(), boxes[:, 3].max())
    return _crop(image, union, margin=0.03)


def crop_main_garment(image: Image.Image) -> Image.Image:
    """Cut to the single largest garment found."""
    image = trim_bars(image)
    garments = [f for f in detect(image, GARMENT_DETECTOR, 0.5) if f["label"] in GARMENT_CLASSES]
    if not garments:
        return image
    return _crop(image, max(garments, key=lambda found: _area(found["box"]))["box"], margin=0.03)


CROPS = {
    "full": lambda image: image,
    "trim-bars": trim_bars,
    "person": crop_person,
    "garments": crop_garments,
    "main-garment": crop_main_garment,
}
