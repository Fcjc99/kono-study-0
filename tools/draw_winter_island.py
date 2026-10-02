"""Draws the island's winter look (December 1 to February 14; Valentine's week adds floating hearts in
game/systems/WinterSystem): the four time-of-day maps under snow (snowy grass with blue shadows, dark
snow-dusted bushes, a crisp sky, a deep cold sea) with a lit pine tree and its star on the hilltop,
snowmen, wrapped gifts, little snowy pines, lamp posts, a sled and snow drifts, all in the island's own
pixel style. The tree's lights, its star and the lamps glow in the evening and at night.

Writes public/garden/terrace-23.0/winter/<phase>.webp (+ <phase>-poster.webp, the small picture shown
while the island loads) and src/game/data/winterIsland.ts (where the lights are, so the island can
twinkle them).

Shares its color helpers and sprite drawing with tools/draw_halloween_island.py.

Run: python3 tools/draw_winter_island.py   (add --preview DIR to also save half-size PNG previews)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import draw_halloween_island as hw  # noqa: E402

ROOT, SRC, PHASES, U, OUTLINE = hw.ROOT, hw.SRC, hw.PHASES, hw.U, hw.OUTLINE
OUT = os.path.join(SRC, 'winter')
TS_OUT = os.path.join(ROOT, 'src', 'game', 'data', 'winterIsland.ts')
ALLOWLIST = hw.ALLOWLIST

# ---------------------------------------------------------------------------------------------
# Recolor

SKY = {
    # top color, horizon color, how much of it
    'morning': ((176, 206, 240), (252, 226, 230), 0.55),
    'afternoon': ((138, 186, 236), (226, 240, 252), 0.5),
    'evening': ((62, 60, 132), (244, 160, 150), 0.68),
    'night': ((10, 16, 46), (34, 44, 96), 0.6),
}
SEA = {'morning': ((70, 120, 170), 0.22), 'afternoon': ((60, 116, 176), 0.22), 'evening': ((54, 60, 120), 0.32), 'night': ((14, 24, 60), 0.4)}
SNOW, SNOW_SHADE, SNOW_BLUE = (np.array(c, float) / 255.0 for c in ((250, 252, 255), (196, 212, 238), (150, 176, 220)))
PINE, PINE_SNOW = (np.array(c, float) / 255.0 for c in ((46, 96, 84), (196, 222, 230)))


def snowy(img, masks, phase, afternoon):
    """Grass under snow: every grass pixel becomes snow shaded by the afternoon art's own light (bright =
    sunlit white, dark = blue shadow), dimmed and cooled for the time of day; bushes turn into dark snow-dusted evergreens and paths into trodden snow. Shapes come from
    the afternoon map so every phase matches."""
    a = img.copy()
    H, W, _ = a.shape
    hsv = hw.rgb_to_hsv(afternoon)
    s, v = hsv[..., 1], hsv[..., 2]
    hue_deg = hsv[..., 0] * 360
    fine = hw.smooth_noise(W, H, 16, 21)[..., None]
    land = masks['land'] & ~masks['rock'] & ~masks['sky'] & ~masks['sea']
    path = land & (hue_deg > 28) & (hue_deg < 64) & (s > 0.12) & (s < 0.62) & (v > 0.55)
    grassy = (masks['grass'] | ((hue_deg > 60) & (hue_deg < 175) & (s > 0.12) & masks['land'])) & ~masks['rock'] & ~path
    bush = grassy & (s > 0.45) & (v < 0.62) & (hue_deg > 80)
    lum = (afternoon * np.array([0.3, 0.55, 0.15])).sum(-1, keepdims=True)
    t = np.clip((lum - 0.25) / 0.5, 0, 1)
    snow = SNOW_BLUE * (1 - t) ** 2 + SNOW_SHADE * 2 * t * (1 - t) + SNOW * t ** 2
    snow = snow * (1 - 0.08 * fine) + SNOW_SHADE * 0.08 * fine
    pine = PINE * (0.55 + 0.9 * lum)
    pine = np.where((fine > 0.55) & (t > 0.35), PINE_SNOW * (0.7 + 0.4 * lum), pine)
    trodden = np.array([0.86, 0.88, 0.94]) * (0.78 + 0.25 * lum) * (1 - 0.06 * fine)
    color = np.where(bush[..., None], pine, np.where(path[..., None], trodden, snow))
    # The time of day: dimmer and bluer toward night (the phase art's own light, relative to afternoon).
    shade = {'morning': (1.0, 0.97, 0.98), 'afternoon': (1.0, 1.0, 1.0), 'evening': (0.72, 0.64, 0.8), 'night': (0.3, 0.36, 0.58)}[phase]
    rel = np.clip((img * np.array([0.3, 0.55, 0.15])).sum(-1, keepdims=True) / np.maximum(lum, 0.05), 0.4, 1.2)
    color = color * np.array(shade) * (0.75 + 0.25 * rel)
    snowy_area = (grassy | path)[..., None]
    out = np.where(snowy_area, a * 0.04 + color * 0.96, a)
    # Rocks a touch colder.
    rock = masks['rock'][..., None]
    out = np.where(rock, out * 0.88 + np.array([0.62, 0.68, 0.8]) * out.mean(-1, keepdims=True) * 0.12 / 0.7, out)

    top, bottom, mix = SKY[phase]
    g = hw.gradient(H, W, top, bottom, 0.0, 0.5)
    sky = masks['sky'][..., None]
    lum = out.mean(-1, keepdims=True)
    tinted = g * (0.55 + 0.6 * lum)
    out = np.where(sky, out * (1 - mix) + np.clip(tinted, 0, 1) * mix, out)

    color, mix = SEA[phase]
    sea_tint = np.array(color, float)[None, None, :] / 255.0
    out = np.where(masks['sea'][..., None], out * (1 - mix) + sea_tint * (0.5 + out.mean(-1, keepdims=True)) * mix, out)
    return np.clip(out, 0, 1)


# ---------------------------------------------------------------------------------------------
# Props (text sprites; '.' is empty)

SNOWMAN_PAL = {'o': (70, 80, 110), 'w': (246, 250, 255), 'W': (255, 255, 255), 'b': (196, 212, 238), 'k': (40, 36, 48), 'n': (240, 130, 40), 'r': (214, 60, 70), 'R': (240, 100, 100), 'h': (60, 52, 70), 's': (120, 84, 56)}
SNOWMAN = [
    '...ohhho...',
    '...ohhho...',
    '..ohhhhho..',
    '...owWwo...',
    '..owkwkwo..',
    '..owwnnwo..',
    '...owwwo...',
    '.srRrRrRrs.',
    '..owWwwbo.s',
    '.owWwkwwbo.',
    '.owwwwwwbo.',
    '.owwwkwwbo.',
    'owWwwwwwwbo',
    'owwwwwwwwbo',
    'owwwwwwwbbo',
    '.obbbbbbbo.',
    '..ooooooo..',
]
GIFT_PAL = {'o': OUTLINE, 'r': (214, 60, 70), 'R': (244, 104, 104), 'd': (170, 40, 56), 'y': (250, 210, 80), 'Y': (255, 240, 150), 'g': (60, 150, 110), 'G': (100, 196, 150), 'e': (36, 110, 80), 'b': (90, 130, 220), 'B': (140, 176, 246), 'u': (60, 90, 170)}
GIFT_RED = [
    '..yY.Yy..',
    '...yYy...',
    'oooooyoooo',
    'orRRRyRRro',
    'orRRRyRRro',
    'oyyyyYyyyo',
    'orrrRyrrdo',
    'orrrryrrdo',
    'oddddydddo',
    'oooooooooo',
]
GIFT_GREEN = [r.replace('r', 'g').replace('R', 'G').replace('d', 'e') for r in GIFT_RED]
GIFT_BLUE = [r.replace('r', 'b').replace('R', 'B').replace('d', 'u') for r in GIFT_RED]
SMALL_PINE_PAL = {'o': (30, 52, 50), 'g': (46, 100, 86), 'G': (70, 130, 108), 'w': (240, 246, 255), 'W': (255, 255, 255), 't': (110, 74, 50)}
SMALL_PINE = [
    '....o....',
    '...oWo...',
    '...ogo...',
    '..oWwgo..',
    '..ogGgo..',
    '.oWwggGo.',
    '.ogGgGgo.',
    'oWwwgGggo',
    'ogGgGgGgo',
    'ooooooooo',
    '...oto...',
    '...oto...',
]
LAMP_PAL = {'o': (40, 38, 52), 'k': (64, 62, 80), 'K': (100, 98, 120), 'y': (255, 210, 110), 'Y': (255, 246, 200), 'w': (246, 250, 255)}
LAMP = [
    '..www..',
    '.ooooo.',
    '.oyYyo.',
    '.oYYYo.',
    '.oyYyo.',
    '.ooooo.',
    '...k...',
    '...K...',
    '...k...',
    '...K...',
    '...k...',
    '...K...',
    '...k...',
    '..okko.',
    '.ooooo.',
]
SLED_PAL = {'o': OUTLINE, 'r': (200, 60, 60), 'R': (236, 100, 96), 'd': (150, 40, 44), 'm': (110, 110, 130), 'M': (170, 170, 190)}
SLED = [
    '.orRRRRRRRo..',
    'orRRRRRRRRro.',
    'oddddddddddo.',
    '.mo...m..om..',
    'mMMMMMMMMMMMm',
    '.mmmmmmmmmmm.',
]
DRIFT_PAL = {'w': (250, 252, 255), 'W': (255, 255, 255), 'b': (206, 220, 242), 'B': (176, 196, 230)}
DRIFT = [
    '....wwWw....',
    '..wwWWWwwb..',
    '.wWWwwwwbbB.',
    'wwwwwwwbbbBB',
]

PROPS = [
    ('gift_red', 690, 282), ('gift_green', 772, 286), ('gift_blue', 732, 296),
    ('snowman', 470, 330), ('snowman', 1110, 640), ('snowman', 300, 640),
    ('pine', 560, 300), ('pine', 900, 300), ('pine', 230, 520), ('pine', 1240, 560), ('pine', 1000, 760), ('pine', 420, 760),
    ('lamp', 620, 520), ('lamp', 860, 520), ('lamp', 520, 700), ('lamp', 960, 690),
    ('sled', 1020, 470),
    ('drift', 380, 450), ('drift', 840, 610), ('drift', 650, 770), ('drift', 1180, 470), ('drift', 260, 700), ('drift', 760, 420),
]
TREE_AT = (730, 262)  # the lit pine on the hilltop
SPRITES = {
    'snowman': (SNOWMAN, SNOWMAN_PAL, ''), 'gift_red': (GIFT_RED, GIFT_PAL, ''), 'gift_green': (GIFT_GREEN, GIFT_PAL, ''),
    'gift_blue': (GIFT_BLUE, GIFT_PAL, ''), 'pine': (SMALL_PINE, SMALL_PINE_PAL, ''), 'lamp': (LAMP, LAMP_PAL, 'yY'),
    'sled': (SLED, SLED_PAL, ''), 'drift': (DRIFT, DRIFT_PAL, ''),
}
LIGHT_COLORS = [(255, 90, 90), (255, 214, 90), (100, 200, 255), (140, 240, 140), (255, 150, 220)]


def lit_pine():
    """A big snowy pine in art pixels (RGBA, unscaled) with colored lights and a star; returns the image,
    where the star is, and where each light is (art px)."""
    tw, th = 38, 44
    art = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    px = np.zeros((th, tw, 4), np.uint8)
    cx = tw // 2
    rng = np.random.default_rng(12)
    lights = []
    green, light_green, dark = (40, 104, 80), (62, 136, 100), (28, 74, 60)
    snow = (240, 246, 255)
    # three tiers, wider toward the bottom
    for top, bottom, half in ((6, 18, 8), (13, 28, 12), (22, 38, 16)):
        for y in range(top, bottom + 1):
            w = int(half * (y - top + 1) / (bottom - top + 1)) + 1
            for x in range(cx - w, cx + w + 1):
                c = light_green if x < cx else green
                if x >= cx + w - 1:
                    c = dark
                if y == bottom and rng.random() < 0.7:
                    c = snow
                px[y, x] = c + (255,)
            # snow resting on each tier's top edge
            if y == top + 1 or (y < top + 4 and rng.random() < 0.3):
                for x in range(cx - w, cx - w + 2):
                    px[y, x] = snow + (255,)
    # trunk
    for y in range(39, 44):
        for x in range(cx - 2, cx + 3):
            px[y, x] = (110, 74, 50, 255) if x < cx + 1 else (84, 56, 40, 255)
    # lights in loose garlands down the tiers
    for k in range(26):
        y = int(rng.uniform(8, 37))
        tier_half = 8 if y < 18 else 12 if y < 28 else 16
        ys = [(6, 18, 8), (13, 28, 12), (22, 38, 16)]
        top, bottom, half = [t for t in ys if t[0] <= y <= t[1]][-1]
        w = int(half * (y - top + 1) / (bottom - top + 1))
        if w < 2:
            continue
        x = int(rng.uniform(cx - w + 1, cx + w))
        color = LIGHT_COLORS[k % len(LIGHT_COLORS)]
        px[y, x] = color + (255,)
        lights.append((x, y))
    # star
    star = ['..y..', '.yYy.', 'yYYYy', '.yYy.', '.y.y.']
    for dy, row in enumerate(star):
        for dx, ch in enumerate(row):
            if ch != '.':
                px[dy + 1, cx - 2 + dx] = ((255, 214, 80) if ch == 'y' else (255, 248, 200)) + (255,)
    # outline
    alpha = px[..., 3] > 0
    grown = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    px[grown & ~alpha] = (24, 44, 44, 255)
    return Image.fromarray(px), (cx, 3), lights


def draw_props(w, h):
    layer = hw.Layer(w, h)
    glows = []
    tree, (sx, sy), lights = lit_pine()
    tx, ty = TREE_AT
    big = tree.resize((tree.width * U, tree.height * U), Image.NEAREST)
    ox, oy = int(tx - big.width / 2), int(ty - big.height)
    layer.d.ellipse([tx - 80, ty - 8, tx + 80, ty + 12], fill=(60, 80, 120, 60))
    layer.img.alpha_composite(big, (ox, oy))
    for lx, ly in lights:
        layer.g.rectangle([ox + lx * U, oy + ly * U, ox + lx * U + U - 1, oy + ly * U + U - 1], fill=255)
        glows.append({'kind': 'light', 'x': round((ox + lx * U + U / 2) / w, 4), 'y': round((oy + ly * U + U / 2) / h, 4), 'r': round(U * 3 / w, 4)})
    layer.g.rectangle([ox + (sx - 2) * U, oy + (sy - 2) * U, ox + (sx + 3) * U, oy + (sy + 3) * U], fill=255)
    glows.append({'kind': 'star', 'x': round((ox + sx * U + U / 2) / w, 4), 'y': round((oy + sy * U + U / 2) / h, 4), 'r': round(U * 10 / w, 4)})
    for kind, x, y in PROPS:
        rows, pal, glow_keys = SPRITES[kind]
        sw, sh = max(len(r) for r in rows), len(rows)
        ox2, oy2 = x / U - sw / 2, y / U - sh  # (x, y) is the sprite's bottom middle
        if kind != 'drift':
            layer.d.ellipse([x - sw * U * 0.45, y - U * 1.2, x + sw * U * 0.45, y + U * 1.4], fill=(60, 80, 120, 60))
        layer.shape(ox2, oy2, rows, pal, glow_keys)
        if glow_keys:
            glows.append({'kind': kind, 'x': round(x / w, 4), 'y': round((y - sh * U * 0.82) / h, 4), 'r': round(sw * U * 2.6 / w, 4)})
    return layer, glows


LIGHT = {
    # multiply props by this (rgb), how bright the glowing parts are
    'morning': ((1.0, 0.98, 1.0), 0.0),
    'afternoon': ((1.0, 1.0, 1.0), 0.0),
    'evening': ((0.82, 0.74, 0.86), 0.8),
    'night': ((0.46, 0.5, 0.72), 1.0),
}


def composite(base, layer, phase):
    tint, glow_strength = LIGHT[phase]
    props = np.asarray(layer.img).astype(float) / 255.0
    glow_mask = np.asarray(layer.glow).astype(float)[..., None] / 255.0
    rgb = props[..., :3]
    lit = rgb * np.array(tint)[None, None, :]
    rgb = lit * (1 - glow_mask * glow_strength) + rgb * glow_mask * glow_strength
    alpha = props[..., 3:4]
    out = base * (1 - alpha) + rgb * alpha
    if glow_strength:
        halo = Image.fromarray(np.asarray(layer.glow).astype(np.uint8)).filter(ImageFilter.GaussianBlur(12))
        halo = np.asarray(halo).astype(float)[..., None] / 255.0
        out = out + np.array([1.0, 0.86, 0.55])[None, None, :] * halo * 1.4 * glow_strength
    return np.clip(out, 0, 1)


def main():
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    os.makedirs(OUT, exist_ok=True)
    afternoon = np.asarray(Image.open(os.path.join(SRC, 'afternoon.png')).convert('RGB')).astype(float) / 255.0
    masks = hw.island_masks(afternoon)
    H, W = masks['grass'].shape
    layer, glows = draw_props(W, H)
    for phase in PHASES:
        original = np.asarray(Image.open(os.path.join(SRC, phase + '.png')).convert('RGB')).astype(float) / 255.0
        img = snowy(original, masks, phase, afternoon)
        img = composite(img, layer, phase)
        out = Image.fromarray((img * 255).round().astype(np.uint8))
        out.save(os.path.join(OUT, phase + '.webp'), 'WEBP', quality=84, method=6)
        out.resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(OUT, phase + '-poster.webp'), 'WEBP', quality=62, method=6)
        if preview:
            out.resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(preview, 'winter-' + phase + '.png'))
        print(phase, os.path.getsize(os.path.join(OUT, phase + '.webp')) // 1024, 'KB')

    data = {'glows': glows}
    ts = ('// Generated by tools/draw_winter_island.py; do not edit by hand.\n'
          '/** The winter island (December 1 to February 14): where the pine\'s lights, its star and the lamp posts\n'
          ' * glow. Positions are 0..1 across the island map. */\n'
          'export const WINTER_ISLAND=' + json.dumps(data, separators=(',', ':')) + ' as const\n')
    with open(TS_OUT, 'w') as f:
        f.write(ts)

    # The build only ships files listed in tools/public-allowlist.json: keep the winter island listed,
    # right after the regular island maps.
    art = ['/garden/terrace-23.0/winter/' + phase + suffix for phase in PHASES for suffix in ('.webp', '-poster.webp')]
    allow = [p for p in json.load(open(ALLOWLIST)) if not p.startswith('/garden/terrace-23.0/winter/')]
    at = max((i for i, p in enumerate(allow) if p.startswith('/garden/terrace-23.0/')), default=len(allow) - 1) + 1
    allow = allow[:at] + art + allow[at:]
    with open(ALLOWLIST, 'w') as f:
        json.dump(allow, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
