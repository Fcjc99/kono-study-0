"""Draws the island's two warm-weather looks, both in the island's own pixel style:

- spring (March 20 to May 20): fresh green grass dotted with little flowers, flowering bushes, a soft
  blue-pink sky, a cherry blossom tree on the hilltop, tulip beds, blossom saplings and a birdhouse
  (petals and butterflies drift in game/systems/SpringSystem);
- end of semester (May 21 to June 20): sunny early-summer grass, a bright sky, bunting strung across
  the island, balloon bunches, a picnic blanket, a beach umbrella and a "YAY!" sign (confetti and
  tossed caps in game/systems/SpringSystem).

Writes public/garden/terrace-23.0/<spring|semester>/<phase>.webp (+ <phase>-poster.webp, the small
picture shown while the island loads). Lanterns on the birdhouse and the bunting's lights glow a little
at night. Shares its color helpers and sprite drawing with tools/draw_halloween_island.py.

Run: python3 tools/draw_spring_island.py   (add --preview DIR to also save half-size PNG previews)
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import draw_halloween_island as hw  # noqa: E402

ROOT, SRC, PHASES, U, OUTLINE, ALLOWLIST = hw.ROOT, hw.SRC, hw.PHASES, hw.U, hw.OUTLINE, hw.ALLOWLIST

SKIES = {
    'spring': {
        'morning': ((186, 214, 246), (252, 222, 232), 0.45),
        'afternoon': ((140, 196, 244), (246, 226, 240), 0.4),
        'evening': ((110, 90, 170), (252, 170, 170), 0.55),
        'night': ((20, 26, 70), (60, 50, 110), 0.45),
    },
    'semester': {
        'morning': ((150, 206, 250), (255, 236, 196), 0.42),
        'afternoon': ((90, 176, 246), (210, 236, 255), 0.42),
        'evening': ((120, 80, 160), (255, 170, 110), 0.55),
        'night': ((16, 24, 70), (52, 50, 110), 0.45),
    },
}
GRASS = {
    # base, highlight, shade (rgb 0..255)
    'spring': ((108, 196, 92), (168, 230, 120), (62, 140, 72)),
    'semester': ((124, 194, 70), (196, 228, 96), (74, 140, 52)),
}
FLOWER_COLORS = {
    'spring': [(255, 182, 214), (255, 255, 255), (255, 226, 110), (210, 170, 255)],
    'semester': [(255, 230, 110), (255, 255, 255), (255, 150, 120)],
}


def fresh(img, masks, phase, afternoon, look):
    """Grass to a fresh spring (or sunny early-summer) green shaded by the afternoon art's own light,
    with little flowers dotted over it and flowering bushes; a softer sky and a bright sea."""
    a = img.copy()
    H, W, _ = a.shape
    hsv = hw.rgb_to_hsv(afternoon)
    s, v = hsv[..., 1], hsv[..., 2]
    hue_deg = hsv[..., 0] * 360
    grassy = (masks['grass'] | ((hue_deg > 60) & (hue_deg < 175) & (s > 0.12) & masks['land'])) & ~masks['rock']
    bush = grassy & (s > 0.45) & (v < 0.62) & (hue_deg > 80)
    lum = (afternoon * np.array([0.3, 0.55, 0.15])).sum(-1, keepdims=True)
    t = np.clip((lum - 0.2) / 0.6, 0, 1)
    base, hi, sh = (np.array(c, float) / 255.0 for c in GRASS[look])
    green = sh * (1 - t) ** 2 + base * 2 * t * (1 - t) + hi * t ** 2
    # Flowers: tiny clusters of 2x2 px dots scattered over the grass (and more on the bushes in spring).
    rng = np.random.default_rng(31 if look == 'spring' else 37)
    flowers = np.zeros((H, W, 3))
    fmask = np.zeros((H, W), bool)
    ys, xs = np.nonzero(grassy[::3, ::3])
    pick = rng.random(len(xs)) < (0.012 if look == 'spring' else 0.006)
    colors = FLOWER_COLORS[look]
    for y, x in zip(ys[pick] * 3, xs[pick] * 3):
        c = np.array(colors[rng.integers(len(colors))], float) / 255.0
        flowers[y:y + 3, x:x + 3] = c
        fmask[y:y + 3, x:x + 3] = True
    if look == 'spring':
        by, bx = np.nonzero(bush[::4, ::4])
        bpick = rng.random(len(bx)) < 0.12
        for y, x in zip(by[bpick] * 4, bx[bpick] * 4):
            flowers[y:y + 3, x:x + 3] = np.array((255, 190, 220), float) / 255.0
            fmask[y:y + 3, x:x + 3] = True
    color = np.where(bush[..., None], green * 0.72, green)
    color = np.where(fmask[..., None] & grassy[..., None], flowers * (0.75 + 0.3 * lum), color)
    shade = {'morning': (1.0, 0.97, 0.95), 'afternoon': (1.0, 1.0, 1.0), 'evening': (0.8, 0.66, 0.7), 'night': (0.3, 0.36, 0.56)}[phase]
    rel = np.clip((img * np.array([0.3, 0.55, 0.15])).sum(-1, keepdims=True) / np.maximum(lum, 0.05), 0.4, 1.2)
    color = color * np.array(shade) * (0.75 + 0.25 * rel)
    out = np.where(grassy[..., None], a * 0.1 + color * 0.9, a)

    top, bottom, mix = SKIES[look][phase]
    g = hw.gradient(H, W, top, bottom, 0.0, 0.5)
    sky = masks['sky'][..., None]
    l2 = out.mean(-1, keepdims=True)
    out = np.where(sky, out * (1 - mix) + np.clip(g * (0.55 + 0.6 * l2), 0, 1) * mix, out)
    return np.clip(out, 0, 1)


# ---------------------------------------------------------------------------------------------
# Props (text sprites; '.' is empty)

TULIP_PAL = {'o': (60, 90, 50), 'r': (240, 90, 120), 'R': (255, 150, 170), 'y': (250, 210, 80), 'Y': (255, 236, 150), 'p': (190, 130, 240), 'P': (220, 180, 255), 'g': (80, 160, 80), 'G': (120, 200, 100)}
TULIPS = [
    '.rR...yY...pP.',
    'rRRr.yYYy.pPPp',
    'rrrr.yyyy.pppp',
    '.rr...yy...pp.',
    '..g....g....g.',
    '.Gg..Gg.g..gG.',
    '..g....g....g.',
    'oooooooooooooo',
]
BIRDHOUSE_PAL = {'o': OUTLINE, 'r': (214, 90, 80), 'R': (240, 130, 110), 'w': (240, 220, 180), 'W': (255, 244, 210), 'd': (40, 30, 30), 'p': (150, 110, 80), 'P': (190, 150, 110), 'y': (255, 220, 120)}
BIRDHOUSE = [
    '....oo....',
    '...oRRo...',
    '..oRRrRo..',
    '.oRrrrrRo.',
    'ooooooooooo',
    '.oWwwwwwo.',
    '.oWwddwwo.',
    '.oWwddwwo.',
    '.oWwwwwwo.',
    '.oooooooo.',
    '....oPo...',
    '....oPo...',
    '....oPo...',
    '....oPo...',
    '....oPo...',
    '...ooooo..',
]
SAPLING_PAL = {'o': (110, 60, 80), 'p': (255, 176, 206), 'P': (255, 220, 236), 'd': (230, 130, 170), 't': (130, 90, 70)}
SAPLING = [
    '...oooo...',
    '.oopPPpoo.',
    'opPPpppPpo',
    'oPpppdpppo',
    'opppdppppo',
    '.odpppdpo.',
    '..oo.too..',
    '.....t....',
    '.....t....',
    '....ooo...',
]
BALLOON_PAL = {'o': (70, 60, 80), 'r': (240, 90, 100), 'R': (255, 160, 160), 'b': (100, 160, 240), 'B': (170, 210, 255), 'y': (255, 210, 80), 'Y': (255, 240, 170), 's': (120, 110, 120)}
BALLOONS = [
    '.oo....oo...',
    'orRo..obBo..',
    'orro.oybYyo.',
    '.oo..oyyyyo.',
    '..s...oyyo..',
    '..s....oo...',
    '...s...s....',
    '....s.s.....',
    '.....s......',
    '.....s......',
    '....ooo.....',
]
BLANKET_PAL = {'o': OUTLINE, 'r': (230, 80, 90), 'w': (250, 246, 240), 'b': (196, 140, 92), 'B': (222, 176, 126)}
BLANKET = [
    '......obbo.......',
    '.....obBBbo......',
    '..oooooooooooooo.',
    '.orwrwrwrwrwrwro.',
    'owrwrwrwrwrwrwro.',
    'orwrwrwrwrwrwrwo.',
    'owrwrwrwrwrwrwo..',
    'ooooooooooooooo..',
]
UMBRELLA_PAL = {'o': (70, 50, 60), 'y': (255, 210, 80), 'Y': (255, 240, 160), 'b': (90, 170, 230), 'B': (160, 210, 250), 'p': (200, 200, 210)}
UMBRELLA = [
    '......oo......',
    '...ooYyBbo....',
    '..oYyBbYyBo...',
    '.oyYbBYyBbYo..',
    'oyyBbbYyyBbbo.',
    'oooooooooooooo',
    '......op......',
    '......op......',
    '......op......',
    '......op......',
    '......op......',
    '.....oooo.....',
]
SIGN_PAL = {'o': OUTLINE, 'w': (196, 140, 92), 'W': (222, 176, 126), 't': (255, 250, 240), 'p': (150, 100, 62)}
YAY_SIGN = [
    'ooooooooooooooooo',
    'oWWWWWWWWWWWWWWWo',
    'oWtWtWWtWWtWtWtWo',
    'oWtWtWtWtWtWtWtWo',
    'oWWtWWtttWWtWWtWo',
    'oWWtWWtWtWWtWWWWo',
    'oWWtWWtWtWWtWWtWo',
    'owwwwwwwwwwwwwwwo',
    'ooooooooooooooooo',
    '...op.......op...',
    '...op.......op...',
    '...op.......op...',
]


def cherry_tree():
    """A big cherry blossom tree in art pixels (RGBA, unscaled)."""
    tw, th = 48, 44
    px = np.zeros((th, tw, 4), np.uint8)
    rng = np.random.default_rng(5)
    cx = tw // 2
    bark, bark_l = (110, 74, 70), (146, 104, 96)
    for y in range(26, 44):
        w = 2 + (y - 26) // 8
        for x in range(cx - w, cx + w + 1):
            px[y, x] = (bark_l if x < cx else bark) + (255,)
    for (x0, y0, x1, y1) in ((cx, 30, cx - 9, 22), (cx, 28, cx + 10, 20)):
        for k in range(12):
            x = int(x0 + (x1 - x0) * k / 11); y = int(y0 + (y1 - y0) * k / 11)
            px[y, x] = bark + (255,); px[y, x + 1] = bark + (255,)
    blossoms = [(255, 182, 210), (255, 206, 226), (250, 150, 190), (255, 230, 240)]
    for (bx, by, r) in ((cx, 14, 13), (cx - 12, 20, 9), (cx + 12, 19, 9), (cx - 5, 8, 8), (cx + 7, 9, 8)):
        for y in range(by - r, by + r + 1):
            for x in range(bx - r - 2, bx + r + 3):
                if 0 <= x < tw and 0 <= y < th and ((x - bx) / (r + 2)) ** 2 + ((y - by) / r) ** 2 <= 1:
                    shade = 0 if (x - bx) + (y - by) < -r * 0.4 else 3 if (x - bx) + (y - by) > r * 0.6 else 1 + int(rng.random() < 0.3)
                    px[y, x] = blossoms[shade] + (255,)
    alpha = px[..., 3] > 0
    grown = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    px[grown & ~alpha] = (120, 70, 90, 255)
    return Image.fromarray(px)


SPRITES = {
    'tulips': (TULIPS, TULIP_PAL, ''), 'birdhouse': (BIRDHOUSE, BIRDHOUSE_PAL, ''), 'sapling': (SAPLING, SAPLING_PAL, ''),
    'balloons': (BALLOONS, BALLOON_PAL, ''), 'blanket': (BLANKET, BLANKET_PAL, ''), 'umbrella': (UMBRELLA, UMBRELLA_PAL, ''),
    'yay': (YAY_SIGN, SIGN_PAL, ''),
}
PROPS = {
    'spring': [
        ('tulips', 520, 330), ('tulips', 940, 330), ('tulips', 300, 600), ('tulips', 1120, 620), ('tulips', 640, 760), ('tulips', 860, 740),
        ('sapling', 250, 520), ('sapling', 1230, 560), ('sapling', 430, 760), ('sapling', 1010, 770), ('sapling', 570, 300), ('sapling', 900, 300),
        ('birdhouse', 1060, 470),
    ],
    'semester': [
        ('balloons', 520, 330), ('balloons', 950, 330), ('balloons', 1180, 600), ('balloons', 290, 610),
        ('blanket', 640, 560), ('umbrella', 700, 520), ('yay', 730, 296),
    ],
}
# Bunting lines (semester): pairs of poles in map px, flags hanging between them.
BUNTING = [((440, 470), (700, 430)), ((760, 430), (1040, 470)), ((520, 700), (920, 700))]
FLAG_COLORS = [(240, 90, 100), (255, 210, 80), (100, 170, 240), (120, 210, 120), (230, 140, 230)]
TREE_AT = (730, 262)


def draw_props(w, h, look):
    layer = hw.Layer(w, h)
    if look == 'spring':
        tree = cherry_tree()
        tx, ty = TREE_AT
        big = tree.resize((tree.width * U, tree.height * U), Image.NEAREST)
        layer.d.ellipse([tx - 90, ty - 8, tx + 90, ty + 12], fill=(40, 70, 40, 60))
        layer.img.alpha_composite(big, (int(tx - big.width / 2), int(ty - big.height)))
    for kind, x, y in PROPS[look]:
        rows, pal, glow_keys = SPRITES[kind]
        sw, sh = max(len(r) for r in rows), len(rows)
        if kind not in ('tulips', 'blanket'):
            layer.d.ellipse([x - sw * U * 0.4, y - U * 1.2, x + sw * U * 0.4, y + U * 1.4], fill=(30, 50, 20, 60))
        layer.shape(x / U - sw / 2, y / U - sh, rows, pal, glow_keys)
    if look == 'semester':
        for (x0, y0), (x1, y1) in BUNTING:
            for px_, py_ in ((x0, y0), (x1, y1)):
                layer.d.rectangle([px_ - 3, py_ - 70, px_ + 2, py_], fill=(150, 104, 70, 255))
                layer.d.rectangle([px_ - 5, py_ - 74, px_ + 4, py_ - 68], fill=(110, 74, 50, 255))
            n = max(4, int(math.hypot(x1 - x0, y1 - y0) / 34))
            pts = []
            for k in range(n + 1):
                t = k / n
                pts.append((x0 + (x1 - x0) * t, y0 - 70 + (y1 - y0) * t + math.sin(t * math.pi) * 26))
            layer.d.line(pts, fill=(80, 60, 60, 255), width=2)
            for k in range(1, n):
                fx, fy = pts[k]
                c = FLAG_COLORS[k % len(FLAG_COLORS)]
                layer.d.polygon([(fx - 9, fy), (fx + 9, fy), (fx, fy + 18)], fill=c + (255,), outline=(70, 50, 50, 255))
    return layer


LIGHT = {
    'morning': (1.0, 0.98, 0.96), 'afternoon': (1.0, 1.0, 1.0), 'evening': (0.86, 0.72, 0.76), 'night': (0.42, 0.46, 0.66),
}


def composite(base, layer, phase):
    props = np.asarray(layer.img).astype(float) / 255.0
    rgb = props[..., :3] * np.array(LIGHT[phase])[None, None, :]
    alpha = props[..., 3:4]
    return np.clip(base * (1 - alpha) + rgb * alpha, 0, 1)


def main():
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    afternoon = np.asarray(Image.open(os.path.join(SRC, 'afternoon.png')).convert('RGB')).astype(float) / 255.0
    masks = hw.island_masks(afternoon)
    H, W = masks['grass'].shape
    for look in ('spring', 'semester'):
        out_dir = os.path.join(SRC, look)
        os.makedirs(out_dir, exist_ok=True)
        layer = draw_props(W, H, look)
        for phase in PHASES:
            original = np.asarray(Image.open(os.path.join(SRC, phase + '.png')).convert('RGB')).astype(float) / 255.0
            img = composite(fresh(original, masks, phase, afternoon, look), layer, phase)
            out = Image.fromarray((img * 255).round().astype(np.uint8))
            out.save(os.path.join(out_dir, phase + '.webp'), 'WEBP', quality=84, method=6)
            out.resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(out_dir, phase + '-poster.webp'), 'WEBP', quality=62, method=6)
            if preview:
                out.resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(preview, look + '-' + phase + '.png'))
            print(look, phase, os.path.getsize(os.path.join(out_dir, phase + '.webp')) // 1024, 'KB')

    # The build only ships files listed in tools/public-allowlist.json: keep both looks listed, right
    # after the regular island maps.
    art = ['/garden/terrace-23.0/' + look + '/' + phase + suffix for look in ('spring', 'semester') for phase in PHASES for suffix in ('.webp', '-poster.webp')]
    allow = [p for p in json.load(open(ALLOWLIST)) if not p.startswith(('/garden/terrace-23.0/spring/', '/garden/terrace-23.0/semester/'))]
    at = max((i for i, p in enumerate(allow) if p.startswith('/garden/terrace-23.0/')), default=len(allow) - 1) + 1
    allow = allow[:at] + art + allow[at:]
    with open(ALLOWLIST, 'w') as f:
        json.dump(allow, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
