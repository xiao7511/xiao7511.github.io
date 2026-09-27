"""Regenerate committed iOS PNGs from the NOBI favicon geometry.

Requires Pillow. The app build does not run this script.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ICON = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
SPLASH_DIR = ROOT / "ios/App/App/Assets.xcassets/Splash.imageset"


def cubic(a, b, c, d, steps=80):
    points = []
    for index in range(steps + 1):
        t = index / steps
        u = 1 - t
        points.append(
            (
                u**3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t**3 * d[0],
                u**3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t**3 * d[1],
            )
        )
    return points


def mark_mask(canvas, scale, origin):
    ox, oy = origin
    point = lambda x, y: (ox + x * scale, oy + y * scale)
    outer = [point(18, 15), point(33, 15)]
    outer += cubic(point(33, 15), point(44, 15), point(51, 21), point(51, 32))[1:]
    outer += cubic(point(51, 32), point(51, 43), point(44, 49), point(33, 49))[1:]
    outer += [point(18, 49)]
    inner = [point(28, 24), point(28, 40), point(33, 40)]
    inner += cubic(point(33, 40), point(39, 40), point(42, 37), point(42, 32))[1:]
    inner += cubic(point(42, 32), point(42, 27), point(39, 24), point(33, 24))[1:]

    mask = Image.new("L", canvas, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(outer, fill=255)
    draw.polygon(inner, fill=0)
    return mask


def gradient(size, start=(255, 118, 200), end=(110, 193, 255)):
    image = Image.new("RGB", (size, size))
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            amount = (x + y) / (2 * (size - 1))
            pixels[x, y] = tuple(round(start[i] * (1 - amount) + end[i] * amount) for i in range(3))
    return image


def build_icon():
    image = gradient(1024)
    image.paste((255, 255, 255), mask=mark_mask((1024, 1024), 16, (0, 0)))
    image.save(ICON, optimize=True)


def build_splash():
    size = 2732
    image = Image.new("RGB", (size, size), (16, 19, 27))
    logo_gradient = gradient(size)
    scale = 15
    origin = ((size - 69 * scale) / 2, (size - 64 * scale) / 2)
    image.paste(logo_gradient, mask=mark_mask((size, size), scale, origin))
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        image.save(SPLASH_DIR / name, optimize=True)


if __name__ == "__main__":
    build_icon()
    build_splash()
