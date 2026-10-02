"""Make test queries harder, the way real ones are.

The test queries are clean studio photos. Real buyers send screenshots: the
photo is smaller, sits inside an app's interface, and has been compressed.
screenshot() imitates that, the same way every time, so models can be compared
on it. It is a stand-in for real street photos, not a replacement for them.
"""

import io

from PIL import Image, ImageDraw


def screenshot(image: Image.Image) -> Image.Image:
    """The photo as it would look inside a phone screenshot of a social app."""
    width, height = 720, 1280
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)
    # A header with an avatar and a name line, and a row of buttons below.
    draw.ellipse((24, 60, 88, 124), fill="#c9ccd1")
    draw.rectangle((108, 76, 380, 96), fill="#1f2937")
    draw.rectangle((108, 104, 260, 116), fill="#9ca3af")
    photo = image.convert("RGB")
    photo.thumbnail((width, 860))
    top = 150
    canvas.paste(photo, ((width - photo.width) // 2, top))
    bottom = top + photo.height + 24
    for x in (36, 110, 184):
        draw.ellipse((x, bottom, x + 44, bottom + 44), outline="#1f2937", width=4)
    draw.rectangle((36, bottom + 70, 560, bottom + 86), fill="#1f2937")
    draw.rectangle((36, bottom + 100, 420, bottom + 112), fill="#9ca3af")
    # Messengers and social apps compress what they show.
    buffer = io.BytesIO()
    canvas.save(buffer, format="JPEG", quality=45)
    return Image.open(io.BytesIO(buffer.getvalue())).convert("RGB")


def new_background(image: Image.Image) -> Image.Image:
    """The person from the photo, placed in front of an unrelated busy background.

    In the test set the query and the catalog photo come from the same shoot, so
    a model can match them by the studio wall instead of the clothes. Here the
    surroundings are replaced, which removes that shortcut. Photos without a
    person (a product lying flat) are placed whole.
    """
    import random

    from cropping import PERSON_DETECTOR, _area, detect, trim_bars

    image = trim_bars(image.convert("RGB"))
    people = [found for found in detect(image, PERSON_DETECTOR, 0.8) if found["label"] == "person"]
    subject = image
    if people:
        box = max(people, key=lambda found: _area(found["box"]))["box"]
        subject = image.crop(tuple(int(value) for value in box))

    width, height = 720, 960
    # The same "street" for every run: blocks of muted colours, like walls and signs.
    rng = random.Random(7)
    canvas = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(canvas)
    for _ in range(140):
        x, y = rng.randrange(width), rng.randrange(height)
        w, h = rng.randrange(40, 260), rng.randrange(40, 260)
        shade = tuple(rng.randrange(40, 215) for _ in range(3))
        draw.rectangle((x - w // 2, y - h // 2, x + w // 2, y + h // 2), fill=shade)
    subject = subject.copy()
    subject.thumbnail((int(width * 0.62), int(height * 0.9)))
    canvas.paste(subject, ((width - subject.width) // 2, height - subject.height - 20))
    return canvas
