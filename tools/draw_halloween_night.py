"""Draws the island's one October background: the island's own night art, untouched, under a Halloween
night sky (deep violet to plum, the island's clouds kept and tinted lilac, stars) with a big full moon
and its glow, a few bats crossing it, and the sea picking up the moon's violet light.

The same picture is shown all day in October (sanctuary/season.ts), so it's written to
public/garden/terrace-23.0/halloween/night.webp (+ night-poster.webp, the small picture shown while
the island loads). Where the moon is goes to src/game/data/halloweenIsland.ts so the island can glow it.

Run: python3 tools/draw_halloween_night.py   (add --preview FILE to also save a half-size PNG)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'garden', 'terrace-23.0')
OUT = os.path.join(SRC, 'halloween')
TS_OUT = os.path.join(ROOT, 'src', 'game', 'data', 'halloweenIsland.ts')


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB')).astype(float) / 255.0


def soft(mask, radius):
    return np.asarray(Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))).astype(float) / 255.0


def masks(night, afternoon):
    """Sky and sea, from the afternoon map (its blue sky and sea are easy to find) and the night map."""
    H, W, _ = night.shape
    r, g, b = afternoon[..., 0], afternoon[..., 1], afternoon[..., 2]
    blue = (b > r + 0.08) & (b > g - 0.02)
    whiteish = (afternoon.min(-1) > 0.78)
    rows = np.arange(H)[:, None].repeat(W, 1)
    land = ~(blue | whiteish)
    land = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(11))) > 0
    # The sea line sits about 53% down at the sides; above it, blue or white that isn't land is sky.
    horizon = int(H * 0.53)
    nr, ng, nb = night[..., 0], night[..., 1], night[..., 2]
    night_sky = (nb > ng + 0.06) & (nb > nr + 0.04)
    sky = (rows < horizon) & ~land & night_sky
    sky = np.asarray(Image.fromarray((sky * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))) > 0
    sea = (rows >= int(H * 0.45)) & ~land & ~sky
    return sky, sea


def gradient(H, W, stops):
    ys = np.linspace(0, 1, H)
    out = np.zeros((H, 3))
    for i in range(len(stops) - 1):
        (y0, c0), (y1, c1) = stops[i], stops[i + 1]
        t = np.clip((ys - y0) / (y1 - y0), 0, 1)[:, None]
        sel = (ys >= y0) & (ys <= y1)
        out[sel] = (np.array(c0) * (1 - t) + np.array(c1) * t)[sel] / 255.0
    return np.repeat(out[:, None, :], W, axis=1)


def remove_old_moon(sky_img, night, grad):
    """The night map has a small moon up on the left; paint it out with the sky around it."""
    H, W, _ = night.shape
    # The biggest bright blob (blurred, so a star can't win), up on the left.
    v = np.asarray(Image.fromarray((night.mean(-1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(12))).astype(float)
    v[int(H * 0.2):, :] = 0
    v[:, int(W * 0.3):] = 0
    my, mx = np.unravel_index(np.argmax(v), v.shape)
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt((xx - mx) ** 2 + (yy - my) ** 2)
    hole = soft((d < 115).astype(float), 18)[..., None]
    return sky_img * (1 - hole) + grad * hole


def moon(img, sky, cx, cy, r):
    H, W, _ = img.shape
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    skyf = soft(sky.astype(float), 2)[..., None]
    # Halo first: a wide warm glow, then a tighter bright ring.
    halo = (np.clip(1 - (d - r) / (r * 3.2), 0, 1) ** 2.2) * (d > r * 0.9)
    ring = (np.clip(1 - (d - r) / (r * 0.7), 0, 1) ** 2) * (d > r * 0.9)
    glow = np.array([255, 196, 140]) / 255.0 * halo[..., None] * 0.42 + np.array([255, 232, 190]) / 255.0 * ring[..., None] * 0.35
    img = img + glow * skyf
    # The disc: creamy gold, lit a touch more on the upper left, soft craters (maria), a crisp edge.
    disc = np.clip(r + 0.8 - d, 0, 1)[..., None]
    nx, ny = (xx - cx) / r, (yy - cy) / r
    shade = np.clip(1.02 - 0.18 * (nx * 0.6 + ny * 0.8) - 0.12 * np.clip(nx * nx + ny * ny, 0, 1), 0, 1.1)[..., None]
    base = np.array([255, 236, 190]) / 255.0
    rng = np.random.default_rng(31)
    maria = np.zeros((H, W))
    for _ in range(7):
        ox, oy = rng.uniform(-0.55, 0.55), rng.uniform(-0.55, 0.55)
        rr = rng.uniform(0.12, 0.3)
        md = np.sqrt((nx - ox) ** 2 + (ny - oy) ** 2)
        maria = np.maximum(maria, np.clip(1 - md / rr, 0, 1) ** 0.8 * rng.uniform(0.45, 0.75))
    craters = np.zeros((H, W))
    for _ in range(14):
        ox, oy = rng.uniform(-0.7, 0.7), rng.uniform(-0.7, 0.7)
        if ox * ox + oy * oy > 0.6:
            continue
        rr = rng.uniform(0.04, 0.09)
        md = np.sqrt((nx - ox) ** 2 + (ny - oy) ** 2)
        craters = np.maximum(craters, (np.abs(md - rr) < 0.018) * 0.6 + (md < rr) * 0.25)
    maria = soft(maria, 3)
    mar = np.array([232, 196, 150]) / 255.0
    face = base * (1 - maria[..., None] * 0.55) + mar * maria[..., None] * 0.55
    face = np.clip(face * shade, 0, 1)
    return img * (1 - disc) + face * disc


def bat(draw, x, y, s, color):
    """A little bat silhouette, wings out: two scalloped wings and a round body with ears."""
    wing = [(0, 0), (-4, -3), (-9, -4), (-14, -2), (-18, 1), (-15, 1), (-13, 3), (-10, 2), (-8, 4), (-5, 2), (-2, 3)]
    for side in (1, -1):
        draw.polygon([(x + side * -px * s, y + py * s) for px, py in wing], fill=color)
    draw.ellipse([x - 2.6 * s, y - 3 * s, x + 2.6 * s, y + 3.6 * s], fill=color)
    draw.polygon([(x - 2.4 * s, y - 2 * s), (x - 1.8 * s, y - 5.2 * s), (x - 0.6 * s, y - 2.6 * s)], fill=color)
    draw.polygon([(x + 2.4 * s, y - 2 * s), (x + 1.8 * s, y - 5.2 * s), (x + 0.6 * s, y - 2.6 * s)], fill=color)


def main():
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    night, afternoon = load('night.webp'), load('afternoon.webp')
    H, W, _ = night.shape
    sky, sea = masks(night, afternoon)

    # Sky: the night art's own light (clouds, stars) mapped onto a violet-to-plum gradient.
    lum = (night * np.array([0.3, 0.5, 0.2])).sum(-1)
    base_lum = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(60))).astype(float) / 255.0
    grad = gradient(H, W, [(0, (18, 8, 44)), (0.22, (40, 16, 78)), (0.42, (92, 38, 108)), (0.56, (128, 56, 108))])
    lilac = np.array([196, 160, 226]) / 255.0
    lift = np.clip((lum - base_lum) * 2.6, -0.2, 1)[..., None]
    sky_img = np.clip(grad * (1 + np.minimum(lift, 0)) + lilac * np.maximum(lift, 0) * 0.85, 0, 1)
    sky_img = remove_old_moon(sky_img, night, grad)
    skyf = soft(sky.astype(float), 1.5)[..., None]
    out = night * (1 - skyf) + sky_img * skyf

    # The big moon, up and to the right of the hill.
    cx, cy, r = W * 0.79, H * 0.15, W * 0.062
    out = moon(out, sky, cx, cy, r)

    # Sea: a violet cast, and the moon's path shimmering on the water below it.
    seaf = soft(sea.astype(float), 2)[..., None]
    violet = np.array([70, 34, 104]) / 255.0
    tinted = night * 0.7 + violet * (0.35 + night.mean(-1, keepdims=True))
    yy, xx = np.mgrid[0:H, 0:W]
    path = np.clip(1 - np.abs(xx - cx) / (W * 0.045), 0, 1) ** 1.5 * (yy > H * 0.5)
    rng = np.random.default_rng(5)
    glints = np.zeros((H, W))
    gimg = Image.new('L', (W, H), 0)
    gd = ImageDraw.Draw(gimg)
    for _ in range(140):
        gx, gy = cx + rng.normal(0, W * 0.02), rng.uniform(H * 0.55, H)
        gw = rng.uniform(4, 14)
        gd.line([(gx - gw, gy), (gx + gw, gy)], fill=int(rng.uniform(120, 255)), width=2)
    glints = soft(np.asarray(gimg).astype(float) / 255.0, 0.8)
    shimmer = (path * 0.12 + glints * path * 0.6)[..., None] * np.array([255, 214, 160]) / 255.0
    out = out * (1 - seaf) + np.clip(tinted + shimmer, 0, 1) * seaf

    # A faint violet wash over the island so it sits in the same light (the art itself is unchanged).
    land = (1 - skyf) * (1 - seaf)
    out = out * (1 - land * 0.12) + (out * np.array([0.92, 0.86, 1.12])) * land * 0.12

    img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
    # Bats crossing the moon, dark plum so they read against it and the sky.
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for bx, by, s in ((cx - r * 0.35, cy - r * 0.1, 2.4), (cx + r * 0.45, cy + r * 0.35, 1.8), (cx + r * 1.7, cy - r * 0.55, 1.4)):
        bat(d, bx, by, s, (34, 16, 44, 255))
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    img = Image.alpha_composite(img.convert('RGBA'), layer).convert('RGB')

    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, 'night.webp'), 'WEBP', quality=86, method=6)
    poster = img.resize((W // 4, H // 4), Image.LANCZOS)
    poster.save(os.path.join(OUT, 'night-poster.webp'), 'WEBP', quality=72, method=6)
    if preview:
        img.resize((W // 2, H // 2), Image.LANCZOS).save(preview)

    with open(TS_OUT, 'w') as f:
        f.write('// Generated by tools/draw_halloween_night.py; do not edit by hand.\n')
        f.write("/** The October island's full moon (0..1 across the map; r is the radius over the map's width), so the\n * island can glow it. */\n")
        f.write('export const HALLOWEEN_MOON={"x":%.4f,"y":%.4f,"r":%.4f} as const\n' % (cx / W, cy / H, r / W))


if __name__ == '__main__':
    main()
