"""A stand-in for the real image model.

It is NOT a neural network and does not understand clothes: it only compares
overall colours and where they sit in the frame. It exists so that indexing,
storage and search can be built and tested end to end. Results are rough by
design; replace it through the EMBEDDER setting (see embedder.py).
"""

import math

from PIL import Image

GRID = 4  # the picture is reduced to GRID x GRID cells of average colour
BINS = 4  # colour histogram: BINS levels per channel


class PlaceholderEmbedder:
    version = "placeholder-colour-v1"
    dimensions = GRID * GRID * 3 + BINS**3

    def embed(self, image: Image.Image) -> list[float]:
        rgb = image.convert("RGB")
        # Average colour of each cell, in reading order.
        cells = rgb.resize((GRID, GRID), Image.BOX)
        layout = [channel / 255 for channel in cells.tobytes()]

        # How much of the picture each colour takes, regardless of position.
        small = rgb.resize((32, 32), Image.BOX)
        histogram = [0.0] * BINS**3
        pixels = small.tobytes()
        for red, green, blue in zip(pixels[0::3], pixels[1::3], pixels[2::3], strict=True):
            index = (
                (red * BINS // 256) * BINS * BINS
                + (green * BINS // 256) * BINS
                + blue * BINS // 256
            )
            histogram[index] += 1 / (32 * 32)

        vector = layout + histogram
        # Centre and normalise, so that cosine distance compares the pattern
        # rather than the overall brightness.
        mean = sum(vector) / len(vector)
        centred = [value - mean for value in vector]
        length = math.sqrt(sum(value * value for value in centred)) or 1.0
        return [value / length for value in centred]
