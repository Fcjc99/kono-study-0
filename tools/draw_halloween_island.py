"""Shared helpers for the seasonal islands (tools/draw_winter_island.py and draw_spring_island.py import
its color helpers and sprite drawing). Its own Halloween maps are retired: October's island now comes from
the provided pictures (tools/import_season_island.py), so running this file does nothing.

Originally: draws the island's Halloween look (October): the four time-of-day maps recolored for autumn
(golden-orange grass, red and orange bushes, a lilac-to-pumpkin sky, a harvest moon at night) with
pumpkins, jack-o'-lanterns, cute gravestones, a scarecrow, a haystack, a cauldron, leaf piles and
cobwebs painted in the style of the island's decorations (tools/painted_props.py). Jack-o'-lanterns and the cauldron glow in the
evening and at night.

Writes public/garden/terrace-23.0/halloween/<phase>.webp (+ <phase>-poster.webp, the small picture
shown while the island loads) and src/game/data/halloweenIsland.ts (where the glowing things are, so
the island can flicker them and send bats and ghosts from the right spots).

Run: python3 tools/draw_halloween_island.py   (add --preview DIR to also save half-size PNG previews)
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import painted_props as pp  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'garden', 'terrace-23.0')
OUT = os.path.join(SRC, 'halloween')
TS_OUT = os.path.join(ROOT, 'src', 'game', 'data', 'halloweenIsland.ts')
ALLOWLIST = os.path.join(ROOT, 'tools', 'public-allowlist.json')
PHASES = ['morning', 'afternoon', 'evening', 'night']
U = 5  # one art pixel, in map pixels (the island art is soft pixel art at about 2-3 px)
OUTLINE = (58, 32, 30)


# ---------------------------------------------------------------------------------------------
# Color helpers (numpy HSV, all 0..1)

def rgb_to_hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1)
    mn = a.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rc = np.where(nz, (mx - r) / np.where(nz, d, 1), 0)
    gc = np.where(nz, (mx - g) / np.where(nz, d, 1), 0)
    bc = np.where(nz, (mx - b) / np.where(nz, d, 1), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2.0 + rc - bc, 4.0 + gc - rc))
    h = np.where(nz, (h / 6.0) % 1.0, 0)
    s = np.where(mx > 1e-6, d / np.where(mx > 1e-6, mx, 1), 0)
    return np.stack([h, s, mx], -1)


def hsv_to_rgb(a):
    h, s, v = a[..., 0], a[..., 1], a[..., 2]
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    choices = [
        np.stack([v, t, p], -1), np.stack([q, v, p], -1), np.stack([p, v, t], -1),
        np.stack([p, q, v], -1), np.stack([t, p, v], -1), np.stack([v, p, q], -1),
    ]
    out = np.zeros(a.shape)
    for k in range(6):
        out = np.where((i == k)[..., None], choices[k], out)
    return out


def smooth_noise(w, h, scale, seed):
    """Soft value noise in 0..1 (bilinear blobs about `scale` px across)."""
    rng = np.random.default_rng(seed)
    gw, gh = w // scale + 2, h // scale + 2
    grid = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
    big = grid.resize((gw * scale, gh * scale), Image.BICUBIC).crop((0, 0, w, h))
    return np.asarray(big).astype(float) / 255.0


def gradient(h, w, top, bottom, top_y=0.0, bottom_y=0.6):
    """A vertical gradient image (h, w, 3) from `top` to `bottom` between the given heights."""
    ys = np.linspace(0, 1, h)[:, None]
    t = np.clip((ys - top_y) / max(1e-6, bottom_y - top_y), 0, 1)
    top = np.array(top, float) / 255.0
    bottom = np.array(bottom, float) / 255.0
    g = top[None, None, :] * (1 - t[..., None]) + bottom[None, None, :] * t[..., None]
    return np.repeat(g, w, axis=1)


# ---------------------------------------------------------------------------------------------
# Masks (from the afternoon map; every phase shares the same shapes)

def island_masks(afternoon):
    hsv = rgb_to_hsv(afternoon)
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    H, W = h.shape
    grass = (h > 40) & (h < 115) & (s > 0.22) & (v > 0.18)
    rock = (h > 5) & (h < 42) & (s > 0.18) & (v > 0.18) & (v < 0.95)
    rows = np.arange(H)[:, None].repeat(W, 1)
    # Blue and white above the sea line is sky (the sea starts about 56% down at the sides).
    horizon = int(H * 0.53)
    blue = (h > 175) & (h < 255)
    whiteish = (s < 0.18) & (v > 0.75)
    land = grass | rock
    land_soft = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
    sky = (rows < horizon) & (blue | whiteish) & ~land_soft
    sea = (rows >= int(H * 0.38)) & blue & ~land_soft & ~sky
    return {'grass': grass, 'rock': rock, 'sky': sky, 'sea': sea, 'land': land_soft}


# ---------------------------------------------------------------------------------------------
# Recolor

SKY = {
    # top color, horizon color, how much of it
    'morning': ((170, 140, 214), (252, 196, 150), 0.62),
    'afternoon': ((140, 120, 200), (246, 172, 110), 0.6),
    'evening': ((52, 24, 84), (240, 122, 52), 0.72),
    'night': ((18, 8, 40), (58, 24, 88), 0.62),
}
SEA = {'morning': ((110, 120, 180), 0.18), 'afternoon': ((112, 110, 176), 0.18), 'evening': ((86, 44, 98), 0.35), 'night': ((40, 18, 64), 0.4)}


GOLD, ORANGE, BROWN, RED, OLIVE = (np.array(c, float) / 255.0 for c in ((196, 164, 74), (204, 120, 50), (146, 104, 62), (196, 72, 42), (150, 150, 72)))


def autumn(img, masks, phase):
    """Grass to gold, orange and brown patches (bushes to red-orange), keeping the art's own light and
    texture: each pixel takes an autumn color at its own brightness."""
    a = img.copy()
    H, W, _ = a.shape
    hsv = rgb_to_hsv(a)
    s, v = hsv[..., 1], hsv[..., 2]
    hue_deg = hsv[..., 0] * 360
    patches = smooth_noise(W, H, 90, 7)[..., None]
    fine = smooth_noise(W, H, 18, 11)[..., None]
    grassy = (masks['grass'] | ((hue_deg > 60) & (hue_deg < 175) & (s > 0.12) & masks['land'])) & ~masks['rock']
    bush = grassy & (s > 0.45) & (v < 0.7) & (hue_deg > 80)
    wide = smooth_noise(W, H, 220, 5)[..., None]
    color = OLIVE * (1 - wide) + GOLD * wide
    color = color * (1 - 0.55 * patches) + ORANGE * 0.55 * patches
    color = color * (1 - 0.4 * fine) + BROWN * 0.4 * fine
    color = np.where(bush[..., None], RED * (1 - fine) + ORANGE * fine, color)
    lum = (a * np.array([0.3, 0.55, 0.15])).sum(-1, keepdims=True)
    clum = (color * np.array([0.3, 0.55, 0.15])).sum(-1, keepdims=True)
    recolored = np.clip(color * (lum / np.maximum(clum, 1e-3)), 0, 1)
    amount = {'morning': 0.74, 'afternoon': 0.74, 'evening': 0.72, 'night': 0.55}[phase]
    out = np.where(grassy[..., None], a * (1 - amount) + recolored * amount, a)

    top, bottom, mix = SKY[phase]
    g = gradient(H, W, top, bottom, 0.0, 0.5)
    sky = masks['sky'][..., None]
    lum = out.mean(-1, keepdims=True)
    tinted = g * (0.55 + 0.6 * lum)
    out = np.where(sky, out * (1 - mix) + np.clip(tinted, 0, 1) * mix, out)

    color, mix = SEA[phase]
    sea_tint = np.array(color, float)[None, None, :] / 255.0
    out = np.where(masks['sea'][..., None], out * (1 - mix) + sea_tint * (0.5 + out.mean(-1, keepdims=True)) * mix, out)
    return np.clip(out, 0, 1)


def harvest_moon(img, original):
    """At night the moon (found on the original map) turns into an orange harvest moon with a warm glow."""
    a = img.copy()
    H, W, _ = a.shape
    hsv = rgb_to_hsv(original)
    v = hsv[..., 2].copy()
    v[int(H * 0.25):, :] = 0
    v[:, int(W * 0.35):] = 0
    my, mx = np.unravel_index(np.argmax(v), v.shape)
    yy0, xx0 = np.mgrid[0:H, 0:W]
    bright = (v > 0.7) & (hsv[..., 1] < 0.4) & ((xx0 - mx) ** 2 + (yy0 - my) ** 2 < 70 ** 2)
    ys, xs = np.nonzero(bright)
    if not len(xs):
        return a, None
    core = bright & (v > 0.85)
    cys, cxs = np.nonzero(core) if core.any() else (ys, xs)
    cx, cy = cxs.mean(), cys.mean()
    r = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).max() + 3
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    disc = d <= r
    moon = np.array([255, 170, 72], float) / 255.0
    lum = original.mean(-1, keepdims=True)
    a = np.where(disc[..., None], np.clip(moon * (0.45 + 0.65 * np.maximum(lum, 0.62)), 0, 1), a)
    glow = np.clip(1 - (d - r) / (r * 2.4), 0, 1) ** 2 * (d > r)
    a = a + (np.array([255, 140, 50], float) / 255.0) * glow[..., None] * 0.35
    return np.clip(a, 0, 1), (cx / W, cy / H, r / W)


# ---------------------------------------------------------------------------------------------
# Props, drawn in art pixels (U map px each) onto an RGBA layer

class Layer:
    def __init__(self, w, h):
        self.img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.glow = Image.new('L', (w, h), 0)  # what lights up at night
        self.d = ImageDraw.Draw(self.img)
        self.g = ImageDraw.Draw(self.glow)

    def px(self, x, y, color, glow=0):
        x0, y0 = int(x * U), int(y * U)
        self.d.rectangle([x0, y0, x0 + U - 1, y0 + U - 1], fill=color + (255,) if len(color) == 3 else color)
        if glow:
            self.g.rectangle([x0, y0, x0 + U - 1, y0 + U - 1], fill=glow)

    def shape(self, ox, oy, rows, palette, glow_keys=''):
        """Draw a sprite from text rows; each character is a palette key ('.' is empty)."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '.' or ch == ' ':
                    continue
                self.px(ox + i, oy + j, palette[ch], 255 if ch in glow_keys else 0)


PUMPKIN_PAL = {'o': OUTLINE, 'p': (232, 118, 30), 'P': (250, 160, 58), 'd': (186, 82, 22), 's': (92, 120, 40), 'S': (64, 88, 30), 'y': (255, 214, 92), 'Y': (255, 244, 170), 'k': (40, 20, 16)}

PUMPKIN_SMALL = [
    '...ss...',
    '..ooSoo.',
    '.opPpPpo',
    'opPpdpPpo',
    'opPpdpPpo',
    'odpPdPpdo',
    '.oddddddo',
    '..ooooooo',
]
PUMPKIN_BIG = [
    '.....ss.....',
    '....sSs.....',
    '..oooSooo...',
    '.opPpPdPpPo.',
    'opPPpPdPpPPo',
    'opPPpPdPpPPo',
    'opPPpPdPpPPo',
    'odPPpPdPpPdo',
    'oddPpPdPpddo',
    '.odddddddddo',
    '..oooooooooo',
]
JACK = [
    '.....ss.....',
    '....sSs.....',
    '..oooSooo...',
    '.opPpPdPpPo.',
    'opPyYpPpYyPo',
    'opPyypPpyyPo',
    'opPPpPyPpPPo',
    'odPYyYyYyYdo',
    'oddPyYyYyPdo',
    '.odddPdPdddo',
    '..oooooooooo',
]
GRAVE_PAL = {'o': (52, 46, 60), 'g': (150, 146, 160), 'G': (188, 184, 198), 'd': (112, 106, 124), 'm': (96, 128, 60), 'M': (130, 160, 72), 't': (70, 64, 82)}
GRAVE = [
    '..oooooo..',
    '.oGGGGggo.',
    'oGGggggggo',
    'oGgtgggtgo',
    'oGgggggggo',
    'oGgtttttgo',
    'oGgggggggo',
    'oGgggggggo',
    'oggggggddo',
    'mMmMmmMmMm',
]
GRAVE_CROSS = [
    '...ooo...',
    '...oGo...',
    '.oooGooo.',
    '.oGGGggo.',
    '.ooogooo.',
    '...ogo...',
    '...ogo...',
    '...odo...',
    '.mMmMmMm.',
]
HAY_PAL = {'o': (96, 62, 24), 'h': (230, 190, 90), 'H': (250, 220, 130), 'd': (190, 146, 60), 'r': (150, 60, 40)}
HAYSTACK = [
    '....oooooo....',
    '..ooHHhHhhoo..',
    '.oHHhHhhHhhdo.',
    'oHhHhhHhhHhhdo',
    'ohhHhhrrhhHhdo',
    'ohHhhHhhhHhhdo',
    'odhhHhhHhhhddo',
    'odddhhddhhdddo',
    '.oooooooooooo.',
]
SCARECROW_PAL = {'o': OUTLINE, 'h': (120, 76, 40), 'H': (160, 104, 56), 's': (240, 210, 140), 'k': (40, 20, 16), 'c': (178, 64, 52), 'C': (214, 96, 72), 'w': (110, 72, 40), 'y': (240, 200, 90), 'b': (90, 104, 160)}
SCARECROW = [
    '....oooo....',
    '...ohHHho...',
    '..oohhhhoo..',
    'ooohhhhhhooo',
    '....osso....',
    '....okko....',
    '....osso....',
    'oyoooccooyo.',
    'yyCcCcCCcCyy',
    '.ooCcCcCCoo.',
    '...obbbbo...',
    '...obbbbo...',
    '....owwo....',
    '....owwo....',
    '....owwo....',
    '...oowwoo...',
]
CAULDRON_PAL = {'o': (24, 20, 28), 'k': (52, 46, 60), 'K': (84, 78, 96), 'g': (120, 220, 90), 'G': (190, 255, 140), 'f': (255, 150, 40), 'F': (255, 220, 90)}
CAULDRON = [
    '...G..g....',
    '..gGg.Gg...',
    '.oogGgGgoo.',
    'oKkgggggkko',
    'oKkkkkkkkko',
    'oKkkkkkkkko',
    '.oKkkkkkko.',
    '..ooooooo..',
    '..F.f.F.f..',
    '.fFfFfFfFf.',
]
LEAVES_PAL = {'a': (214, 92, 34), 'b': (240, 150, 40), 'c': (176, 60, 30), 'd': (226, 190, 70), 'o': (110, 50, 24)}
LEAF_PILE = [
    '...ab.ca...',
    '.cabdbacbd.',
    'abcdabcabda',
    'oaocbdaobco',
]
BOO_PAL = {'o': OUTLINE, 'w': (170, 118, 70), 'W': (200, 148, 90), 'd': (130, 84, 46), 't': (255, 240, 220), 'p': (110, 70, 40)}
BOO_SIGN = [
    'ooooooooooooooo',
    'oWWWWWWWWWWWWWo',
    'oWtttWWtttWtttW',
    'oWtwtWWtwtWtwtW',
    'oWttWWWtwtWtwtW',
    'oWtwtWWtwtWtwtW',
    'oWtttWWtttWtttW',
    'oddddddddddddo.',
    'ooooooopoooooo.',
    '......opo......',
    '......opo......',
    '.....ooooo.....',
]

CANDLE_PAL = {'o': OUTLINE, 'c': (246, 232, 200), 'C': (220, 200, 160), 'y': (255, 190, 60), 'Y': (255, 246, 180)}
CANDLE = [
    '.y.',
    'yYy',
    '.Y.',
    'oco',
    'ocC',
    'ocC',
    'ooo',
]

# Where things go, in map pixels (1448 x 1086 map; x, y is each thing's bottom middle), on the grass
# and mostly around the edges, away from the middle where KONO walks and decorations usually go.
PROPS = [
    ('jack', 510, 300), ('jack', 862, 282), ('pumpkin', 640, 262),
    ('pumpkin_big', 250, 580), ('pumpkin', 300, 612), ('pumpkin', 214, 632),
    ('cauldron', 392, 412), ('boo', 700, 420),
    ('grave', 1046, 474), ('cross', 1118, 500), ('grave', 1190, 470), ('candle', 1084, 506), ('candle', 1156, 504), ('jack', 980, 430),
    ('scarecrow', 1166, 640), ('hay', 1080, 696), ('pumpkin', 1140, 724), ('pumpkin_big', 1010, 730),
    ('jack', 612, 770), ('jack', 832, 760), ('pumpkin', 960, 780), ('candle', 720, 770),
    ('leaves', 480, 650), ('leaves', 930, 600), ('leaves', 760, 520), ('leaves', 360, 700), ('leaves', 1000, 360), ('leaves', 560, 420),
]
TREE_AT = (730, 248)  # the big bare tree on the hilltop
SPRITES = {
    'jack': (JACK, PUMPKIN_PAL, 'yY'), 'pumpkin': (PUMPKIN_SMALL, PUMPKIN_PAL, ''), 'pumpkin_big': (PUMPKIN_BIG, PUMPKIN_PAL, ''),
    'grave': (GRAVE, GRAVE_PAL, ''), 'cross': (GRAVE_CROSS, GRAVE_PAL, ''), 'hay': (HAYSTACK, HAY_PAL, ''),
    'scarecrow': (SCARECROW, SCARECROW_PAL, ''), 'cauldron': (CAULDRON, CAULDRON_PAL, 'gGfF'), 'leaves': (LEAF_PILE, LEAVES_PAL, ''),
    'boo': (BOO_SIGN, BOO_PAL, ''), 'candle': (CANDLE, CANDLE_PAL, 'yY'),
}
# Cobwebs on the bushes (map px): center and size.
WEBS = [(222, 492, 34), (1238, 600, 30), (210, 690, 30)]


def spooky_tree():
    """A bare, twisty tree in art pixels (RGBA, unscaled), with a dark outline and a lantern hanging off it."""
    tw, th = 44, 46
    art = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    d = ImageDraw.Draw(art)
    bark, light = (76, 52, 62, 255), (112, 82, 90, 255)
    base = (22, th - 2)
    # trunk
    for k in range(0, 18):
        wdt = 4 - k // 6
        x = base[0] + int(1.5 * math.sin(k / 3.0))
        d.line([x - wdt, base[1] - k, x + wdt, base[1] - k], fill=bark)
        d.point((x - wdt + 1, base[1] - k), fill=light)
    rng = np.random.default_rng(3)

    def branch(x, y, ang, length, width):
        if length < 3:
            return
        x2, y2 = x + math.cos(ang) * length, y - math.sin(ang) * length
        d.line([x, y, x2, y2], fill=bark, width=max(1, width))
        for turn in (-0.55, 0.5):
            if rng.random() < 0.85:
                branch(x2, y2, ang + turn + rng.uniform(-0.2, 0.2), length * 0.68, width - 1)

    top = (base[0] + 1, base[1] - 17)
    branch(*top, math.pi / 2 + 0.15, 11, 3)
    branch(top[0] - 1, top[1] + 4, math.pi * 0.82, 9, 2)
    branch(top[0] + 1, top[1] + 6, math.pi * 0.2, 9, 2)
    # roots
    d.line([base[0] - 4, base[1], base[0] - 8, base[1] + 1], fill=bark)
    d.line([base[0] + 4, base[1], base[0] + 8, base[1] + 1], fill=bark)
    # outline
    alpha = np.asarray(art)[..., 3] > 0
    grown = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    px = np.asarray(art).copy()
    px[grown & ~alpha] = (40, 22, 30, 255)
    # a little lantern hanging from the right branch
    lx, ly = top[0] + 8, top[1] + 2
    for dy, row in enumerate(['.o.', '.o.', 'oyo', 'yYy', 'oyo']):
        for dx, ch in enumerate(row):
            if ch == '.':
                continue
            px[ly + dy, lx + dx - 1] = {'o': (40, 22, 30, 255), 'y': (255, 170, 50, 255), 'Y': (255, 240, 160, 255)}[ch]
    return Image.fromarray(px), (lx, ly + 3)


PAINTED = {
    'jack': lambda i: pp.jack(seed=3 + i), 'pumpkin': lambda i: pp.pumpkin(30, seed=i), 'pumpkin_big': lambda i: pp.pumpkin(40, seed=5 + i),
    'grave': lambda i: pp.gravestone(seed=i), 'cross': lambda i: pp.gravestone(cross=True, seed=2 + i), 'hay': lambda i: pp.haystack(seed=i),
    'scarecrow': lambda i: pp.scarecrow(seed=i), 'cauldron': lambda i: pp.cauldron(seed=i), 'leaves': lambda i: pp.leaf_pile(seed=i),
    'boo': lambda i: pp.boo_sign(seed=i), 'candle': lambda i: pp.candle(seed=i),
}


def soft_shadow(layer, x, y, half_w, half_h, alpha=70):
    """A soft contact shadow under a prop (blurred, so it sits on the grass like the island's own art)."""
    pad = int(half_w + 12)
    sh = Image.new('L', (pad * 2, pad * 2), 0)
    ImageDraw.Draw(sh).ellipse([pad - half_w, pad - half_h, pad + half_w, pad + half_h], fill=alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(max(2, half_h * 0.8)))
    tint = Image.new('RGBA', sh.size, (40, 26, 16, 0))
    tint.putalpha(sh)
    layer.img.alpha_composite(tint, (int(x - pad), int(y - pad)))


def place(layer, img, glow, x, y):
    """Put a painted prop on the layer with its bottom middle at map (x, y); its glow goes in the glow mask."""
    ox, oy = int(round(x - img.width / 2)), int(round(y - img.height))
    layer.img.alpha_composite(img, (ox, oy))
    g = layer.glow.crop((ox, oy, ox + glow.width, oy + glow.height))
    layer.glow.paste(Image.fromarray(np.maximum(np.asarray(g), np.asarray(glow))), (ox, oy))
    return ox, oy


def draw_props(w, h):
    """The Halloween props, painted in the style of the island's decorations (tools/painted_props.py)."""
    pp.ZOOM = 1.3
    layer = Layer(w, h)
    glows = []
    tree, tree_glow, (lx, ly) = pp.spooky_tree()
    tx, ty = TREE_AT
    soft_shadow(layer, tx, ty, 70, 9)
    ox, oy = place(layer, tree, tree_glow, tx, ty + 4)
    glows.append({'kind': 'tree-lantern', 'x': round((ox + lx * pp.ZOOM) / w, 4), 'y': round((oy + ly * pp.ZOOM) / h, 4), 'r': round(U * 9 / w, 4)})
    for i, (kind, x, y) in enumerate(PROPS):
        img, glow = PAINTED[kind](i)
        if kind != 'leaves':
            soft_shadow(layer, x, y - 2, img.width * 0.38, max(4, img.width * 0.08))
        place(layer, img, glow, x, y + 3)
        if kind in ('jack', 'cauldron', 'candle'):
            glows.append({'kind': kind, 'x': round(x / w, 4), 'y': round((y - img.height * 0.45) / h, 4), 'r': round(img.width * 1.1 / w, 4)})
    for cx, cy, size in WEBS:
        web = pp.cobweb(size)
        layer.img.alpha_composite(web, (int(cx - size), int(cy - size)))
    return layer, glows


LIGHT = {
    # multiply props by this (rgb), how bright the glowing parts are
    'morning': ((1.0, 0.96, 0.92), 0.0),
    'afternoon': ((1.0, 1.0, 1.0), 0.0),
    'evening': ((0.86, 0.66, 0.62), 0.75),
    'night': ((0.42, 0.40, 0.62), 1.0),
}


def composite(base, layer, phase):
    tint, glow_strength = LIGHT[phase]
    props = np.asarray(layer.img).astype(float) / 255.0
    glow_mask = np.asarray(layer.glow).astype(float)[..., None] / 255.0
    rgb = props[..., :3]
    lit = rgb * np.array(tint)[None, None, :]
    rgb = lit * (1 - glow_mask * glow_strength) + rgb * glow_mask * glow_strength
    # Lit-up parts (carved faces, flames, the brew) shine brighter than their painted color at night.
    rgb = np.clip(rgb * (1 + 0.6 * glow_mask * glow_strength) + glow_mask * 0.06 * glow_strength, 0, 1)
    alpha = props[..., 3:4]
    out = base * (1 - alpha) + rgb * alpha
    if glow_strength:
        halo = Image.fromarray((np.asarray(layer.glow)).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))
        halo = np.asarray(halo).astype(float)[..., None] / 255.0
        out = out + np.array([1.0, 0.55, 0.15])[None, None, :] * halo * 1.6 * glow_strength
    return np.clip(out, 0, 1)


def main():
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    os.makedirs(OUT, exist_ok=True)
    afternoon = np.asarray(Image.open(os.path.join(SRC, 'afternoon.png')).convert('RGB')).astype(float) / 255.0
    masks = island_masks(afternoon)
    H, W = masks['grass'].shape
    layer, glows = draw_props(W, H)
    moon = None
    for phase in PHASES:
        original = np.asarray(Image.open(os.path.join(SRC, phase + '.png')).convert('RGB')).astype(float) / 255.0
        img = autumn(original, masks, phase)
        if phase == 'night':
            img, moon = harvest_moon(img, original)
        img = composite(img, layer, phase)
        out = Image.fromarray((img * 255).round().astype(np.uint8))
        out.save(os.path.join(OUT, phase + '.webp'), 'WEBP', quality=84, method=6)
        out.resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(OUT, phase + '-poster.webp'), 'WEBP', quality=62, method=6)
        if preview:
            out.resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(preview, 'halloween-' + phase + '.png'))
        print(phase, os.path.getsize(os.path.join(OUT, phase + '.webp')) // 1024, 'KB')

    # Where things glow, and the sky band bats fly through (normalized to the map).
    data = {'glows': glows, 'moon': None if moon is None else {'x': round(moon[0], 4), 'y': round(moon[1], 4), 'r': round(moon[2], 4)},
            'graves': [{'x': round(x / W, 4), 'y': round((y - 30) / H, 4)} for k, x, y in PROPS if k in ('grave', 'cross')]}
    ts = ('// Generated by tools/draw_halloween_island.py; do not edit by hand.\n'
          '/** The Halloween island (October): where its jack-o\'-lanterns and cauldron glow, the harvest moon, and\n'
          ' * the gravestones a friendly ghost can float up from. Positions are 0..1 across the island map. */\n'
          'export const HALLOWEEN_ISLAND=' + json.dumps(data, separators=(',', ':')) + ' as const\n')
    with open(TS_OUT, 'w') as f:
        f.write(ts)

    # The build only ships files listed in tools/public-allowlist.json: keep the Halloween island listed,
    # right after the regular island maps.
    art = ['/garden/terrace-23.0/halloween/' + phase + suffix for phase in PHASES for suffix in ('.webp', '-poster.webp')]
    allow = [p for p in json.load(open(ALLOWLIST)) if not p.startswith('/garden/terrace-23.0/halloween/')]
    at = max((i for i, p in enumerate(allow) if p.startswith('/garden/terrace-23.0/')), default=len(allow) - 1) + 1
    allow = allow[:at] + art + allow[at:]
    with open(ALLOWLIST, 'w') as f:
        json.dump(allow, f, indent=1)
        f.write('\n')

if __name__ == '__main__':
    print('Retired: run tools/import_season_island.py with the Halloween sanctuary pictures instead.')
