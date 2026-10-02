"""Where the image model plugs in.

An embedder turns a picture into a list of numbers; similar pictures give
similar lists. Everything else in app/search (storing, indexing, searching with
filters) only depends on this interface.

To use a real model, write a class with the same three members and point the
EMBEDDER setting at it, for example EMBEDDER=app.search.my_model:MyEmbedder.
Give it a new `version` whenever the model or its preprocessing changes: the
catalog is then indexed again and old vectors are no longer used.
"""

from functools import lru_cache
from importlib import import_module
from typing import Protocol

from PIL import Image

from app.config import get_settings


class Embedder(Protocol):
    # Names the model and its preprocessing, e.g. "siglip-base-224-v1".
    version: str
    # Length of the returned list.
    dimensions: int

    def embed(self, image: Image.Image) -> list[float]:
        """An RGB picture in, a normalised vector of `dimensions` numbers out."""
        ...


@lru_cache
def get_embedder() -> Embedder:
    """The embedder named in the settings, created once per process."""
    module_name, _, attribute = get_settings().embedder.partition(":")
    embedder = getattr(import_module(module_name), attribute)()
    return embedder
