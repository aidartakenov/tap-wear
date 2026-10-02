"""A real image model for photo search, loaded from Hugging Face.

Used when EMBEDDER=app.search.hf_embedder:HFEmbedder. Which model is set by
EMBEDDER_MODEL. The default, SigLIP B/16 with solid bars trimmed off the photo
first, scored best in ml/compare_models.py and ml/compare_crops.py (see
ml/README.md). Needs the packages in requirements-ml.txt.

The model is loaded once per process, on first use (a few seconds, and about
1 GB of memory). It runs on Apple's GPU when there is one, otherwise on the CPU.
"""

import threading

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModel

from app.config import get_settings


def trim_bars(image: Image.Image, tolerance: int = 12) -> Image.Image:
    """Remove solid black or white bands around a photo (letterboxing, screenshot margins).

    Must stay identical to ml/cropping.py: the measurements were made with it.
    """
    pixels = np.asarray(image.convert("L"), dtype=np.int16)
    for edge_value in (0, 255):
        content = np.abs(pixels - edge_value) > tolerance
        rows, columns = np.where(content.any(axis=1))[0], np.where(content.any(axis=0))[0]
        if len(rows) and len(columns):
            box = (int(columns[0]), int(rows[0]), int(columns[-1]) + 1, int(rows[-1]) + 1)
            # Only accept a trim that removes a real band, not a pixel of noise.
            if (box[2] - box[0]) * (box[3] - box[1]) < 0.97 * image.width * image.height:
                image = image.crop(box)
                pixels = np.asarray(image.convert("L"), dtype=np.int16)
    return image


class HFEmbedder:
    def __init__(self) -> None:
        settings = get_settings()
        model_id = settings.embedder_model
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.model = AutoModel.from_pretrained(model_id).to(self.device).eval()
        # Image-text models (CLIP, SigLIP) have a dedicated image branch;
        # image-only models (DINOv2) are summarised by their first token.
        self.has_image_branch = hasattr(self.model, "get_image_features")
        # Only the picture side is needed; a model's text tokenizer is not loaded.
        self.processor = AutoImageProcessor.from_pretrained(model_id)
        # One picture at a time: the model is shared by all requests of the process.
        self.lock = threading.Lock()
        # Changing the model or the preparation of pictures must change this name,
        # so that old and new vectors are never compared with each other.
        self.version = f"{model_id}:{settings.embedder_revision}"[:100]
        self.dimensions = len(self.embed(Image.new("RGB", (64, 64), "white")))

    @torch.no_grad()
    def embed(self, image: Image.Image) -> list[float]:
        with self.lock:
            picture = trim_bars(image.convert("RGB"))
            inputs = self.processor(images=picture, return_tensors="pt").to(self.device)
            if self.has_image_branch:
                output = self.model.get_image_features(**inputs)
                features = getattr(output, "pooler_output", output)
            else:
                features = self.model(**inputs).last_hidden_state[:, 0]
            features = torch.nn.functional.normalize(features.float(), dim=-1)
            return features[0].cpu().tolist()
