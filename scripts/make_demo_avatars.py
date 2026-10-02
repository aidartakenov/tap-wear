"""Draw the avatars of the four demo stores.

These are monograms designed for TapWear's demo data, not the stores' real
logos: the demo stores have not agreed to take part, so their trademarks are
not used. The pictures are written to apps/api/seed/avatars/<store id>.png and
loaded into object storage by `python -m app.seed`.

Usage (needs Pillow and the macOS system fonts; run with the API's environment):

    apps/api/.venv/bin/python scripts/make_demo_avatars.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUTPUT = Path(__file__).resolve().parent.parent / "apps/api/seed/avatars"
FONTS = Path("/System/Library/Fonts")
SIDE = 512
# Drawn larger and scaled down, so edges come out smooth.
SCALE = 3
S = SIDE * SCALE


def font(name: str, size: float, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), round(size * SCALE), index=index)


def canvas(color: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (S, S), color)
    return image, ImageDraw.Draw(image)


def px(value: float) -> int:
    return round(value * SCALE)


def centered(draw, text, face, y, fill, spacing: float = 0) -> None:
    """Draw text centred horizontally, with optional letter spacing, baseline-anchored at y."""
    widths = [draw.textlength(char, font=face) for char in text]
    total = sum(widths) + px(spacing) * (len(text) - 1)
    x = (S - total) / 2
    for char, width in zip(text, widths, strict=True):
        draw.text((x, px(y)), char, font=face, fill=fill, anchor="ls")
        x += width + px(spacing)


def gergert_sport() -> Image.Image:
    # Sporty: a red field, slanted heavy letters, a speed stripe underneath.
    image, draw = canvas("#d81f26")
    draw.polygon([(0, px(360)), (S, px(250)), (S, S), (0, S)], fill="#b3141b")
    centered(draw, "GS", font("Supplemental/Arial Bold Italic.ttf", 250), 330, "#ffffff", -6)
    draw.polygon(
        [(px(128), px(376)), (px(404), px(376)), (px(392), px(396)), (px(116), px(396))],
        fill="#ffffff",
    )
    centered(draw, "SPORT", font("Supplemental/Arial Bold Italic.ttf", 40), 452, "#ffffff", 12)
    return image


def dresscode() -> Image.Image:
    # Fashion boutique: warm paper, a fine serif initial inside a thin ring.
    image, draw = canvas("#f1ebe1")
    draw.ellipse([px(40), px(40), px(472), px(472)], outline="#1f1b16", width=px(2))
    centered(draw, "D", font("Supplemental/Didot.ttc", 300, index=2), 338, "#1f1b16")
    centered(draw, "DRESSCODE", font("Supplemental/Didot.ttc", 30), 412, "#1f1b16", 9)
    return image


def lirus() -> Image.Image:
    # Classic clothing: deep green with a gold serif letter and fine rules.
    image, draw = canvas("#14382c")
    gold = "#d9b56a"
    # A ring rather than a square frame: avatars are shown cropped to a circle.
    draw.ellipse([px(40), px(40), px(472), px(472)], outline=gold, width=px(2))
    centered(draw, "Л", font("Supplemental/Georgia Bold.ttf", 270), 330, gold)
    draw.line([(px(176), px(368)), (px(336), px(368))], fill=gold, width=px(2))
    centered(draw, "ЛИРУС", font("Supplemental/Georgia.ttf", 38), 428, gold, 14)
    return image


def adidas_kg() -> Image.Image:
    # Minimal black and white: a geometric lowercase monogram.
    image, draw = canvas("#0b0b0c")
    centered(draw, "a", font("Supplemental/Futura.ttc", 330, index=2), 318, "#ffffff")
    draw.ellipse([px(344), px(82), px(392), px(130)], fill="#ffffff")
    centered(draw, "KYRGYZSTAN", font("Supplemental/Futura.ttc", 30, index=0), 420, "#ffffff", 13)
    return image


AVATARS = {
    "gergert-sport": gergert_sport,
    "dresscode": dresscode,
    "lirus": lirus,
    "adidas-kg": adidas_kg,
}


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for store, draw in AVATARS.items():
        picture = draw().resize((SIDE, SIDE), Image.LANCZOS)
        picture.save(OUTPUT / f"{store}.png", optimize=True)
        print(f"Wrote {OUTPUT / f'{store}.png'}")


if __name__ == "__main__":
    main()
