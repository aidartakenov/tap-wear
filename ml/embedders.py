"""Ready-made image models behind one interface, so they can be compared fairly.

Every entry turns a list of pictures into unit-length vectors. Nothing here is
trained: these are published models used as they are.
"""

from collections.abc import Callable

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModel

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"

# Short name -> (Hugging Face id, what kind of model it is).
MODELS = {
    # General image-text models (trained on pictures with captions).
    "clip-b32": ("openai/clip-vit-base-patch32", "clip"),
    "clip-b16": ("openai/clip-vit-base-patch16", "clip"),
    "siglip-b16": ("google/siglip-base-patch16-224", "clip"),
    # CLIP fine-tuned on fashion product photos and their descriptions.
    "fashion-clip": ("patrickjohncyh/fashion-clip", "clip"),
    # Image-only models (trained without captions); strong on visual detail.
    "dinov2-s": ("facebook/dinov2-small", "dino"),
    "dinov2-b": ("facebook/dinov2-base", "dino"),
}


def load(name: str) -> Callable[[list[Image.Image]], np.ndarray]:
    """A function that embeds pictures with the named model."""
    model_id, kind = MODELS[name]
    # Only the picture side is needed; the text tokenizer some models ship is not loaded.
    processor = AutoImageProcessor.from_pretrained(model_id)
    model = AutoModel.from_pretrained(model_id).to(DEVICE).eval()

    @torch.no_grad()
    def embed(images: list[Image.Image], batch_size: int = 16) -> np.ndarray:
        parts = []
        for start in range(0, len(images), batch_size):
            batch = [image.convert("RGB") for image in images[start : start + batch_size]]
            inputs = processor(images=batch, return_tensors="pt").to(DEVICE)
            if kind == "clip":
                output = model.get_image_features(**inputs)
                # Newer library versions wrap the result; older ones return the tensor.
                features = getattr(output, "pooler_output", output)
            else:
                # DINOv2: the first token summarises the whole picture.
                features = model(**inputs).last_hidden_state[:, 0]
            features = torch.nn.functional.normalize(features.float(), dim=-1)
            parts.append(features.cpu().numpy())
        return np.concatenate(parts)

    return embed
