"""Paints the Halloween decorations (Decorate › Halloween) in the style of the island's other
decorations: soft pixel art (one art pixel = 3 image pixels), forms lit from the upper left in 4-5
tone ramps, warm dark outlines, and a grassy base with leaves, pebbles and little white flowers.

Each one gets the same four times of day as the rest of the pack (morning, afternoon, evening and
night, graded like the existing art); carved faces, windows and flames glow in the evening and at night.

Writes public/garden/registered-22.8.6/halloween/<id>/<phase>.png and src/game/data/halloweenDecor.ts.
Run: python3 tools/draw_halloween_decor.py   (add --preview FILE for a contact sheet)
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'garden', 'registered-22.8.6', 'halloween')
TS_OUT = os.path.join(ROOT, 'src', 'game', 'data', 'halloweenDecor.ts')
ALLOWLIST = os.path.join(ROOT, 'tools', 'public-allowlist.json')
PX = 3  # image pixels per art pixel
PHASES = ['morning', 'afternoon', 'evening', 'night']
# Per-channel (gain, offset) fitted from the existing pack's own phase renders (afternoon -> phase).
GRADE = {
    'morning': [(0.906, 0.116), (0.954, 0.101), (0.965, 0.044)],
    'afternoon': [(1, 0), (1, 0), (1, 0)],
    'evening': [(0.889, 0.062), (0.875, 0.008), (0.77, 0.07)],
    'night': [(0.46, -0.028), (0.422, 0.101), (0.392, 0.195)],
}
GLOW = {'morning': 0.0, 'afternoon': 0.0, 'evening': 0.55, 'night': 1.0}
LIGHT = np.array([-0.55, -0.62, 0.56])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
RNG = np.random.default_rng(1031)


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float) / 255.0


def ramp(*hexes):
    return [hexc(h) for h in hexes]


# Ramps run dark -> light. Shadows lean purple, lights lean yellow, like the pack.
R = {
    'pumpkin': ramp('#7a2e1c', '#b4481e', '#e2701f', '#f5973a', '#ffc46a'),
    'pumpkin2': ramp('#73301f', '#a8501f', '#d77c27', '#eda447', '#ffd27c'),
    'stem': ramp('#2f3a1c', '#4c5a24', '#6d7f2f', '#93a443', '#bccb68'),
    'wood': ramp('#3d2219', '#61372a', '#8a5236', '#ad6f45', '#cf9262'),
    'darkwood': ramp('#2a1a22', '#3f2830', '#5a3a3c', '#7a5248', '#9c705a'),
    'stone': ramp('#4c4352', '#6c6270', '#8f8590', '#b1a8ae', '#d3cccb'),
    'iron': ramp('#1d1a24', '#2c2834', '#423c4c', '#5d5668', '#7f7a8a'),
    'leaf': ramp('#28401f', '#3d6a28', '#5b9433', '#82b745', '#b2d665'),
    'grass': ramp('#2f5222', '#467c2b', '#67a237', '#8cc049', '#b8dc6a'),
    'straw': ramp('#7a5222', '#a8772f', '#d1a245', '#e9c566', '#f8e29a'),
    'cloth_red': ramp('#5a2228', '#843136', '#b04a45', '#cf6c5a', '#e9957a'),
    'cloth_blue': ramp('#2a2f4e', '#3d4a72', '#566c98', '#7a92b8', '#a7bdd6'),
    'brew': ramp('#2a5a2a', '#3f8c34', '#66c048', '#9ee36a', '#d6ff9e'),
    'flame': ramp('#b8401e', '#e2701f', '#ffa53a', '#ffd25e', '#fff3b0'),
    'glow': ramp('#c85a14', '#ff8a1e', '#ffb43c', '#ffd86a', '#fff2b4'),
    'purple': ramp('#2e2040', '#47305e', '#644686', '#8763aa', '#ad8ccc'),
    'roof': ramp('#3a2236', '#583350', '#7a4a6c', '#9c6688', '#bf88a6'),
}
OUTLINE = hexc('#3a2026')


class Art:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.rgb = np.zeros((h, w, 3))
        self.a = np.zeros((h, w))
        self.glow = np.zeros((h, w))  # 0..1, what lights up at night
        yy, xx = np.mgrid[0:h, 0:w]
        self.xx, self.yy = xx.astype(float), yy.astype(float)

    def texture(self):
        """Soft clustered noise (-0.5..0.5), so flat areas get the pack's painterly texture, not speckle."""
        n = RNG.random((self.h, self.w))
        b = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))).astype(float) / 255.0
        b = (b - b.mean()) / (b.std() + 1e-6)
        return np.clip(b * 0.22, -0.5, 0.5)

    # --- masks
    def ellipse(self, cx, cy, rx, ry):
        return ((self.xx + 0.5 - cx) / rx) ** 2 + ((self.yy + 0.5 - cy) / ry) ** 2 <= 1

    def poly(self, pts):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon([(x, y) for x, y in pts], fill=255)
        return np.asarray(im) > 0

    def line_mask(self, pts, width):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).line([(x, y) for x, y in pts], fill=255, width=max(1, int(round(width))), joint='curve')
        return np.asarray(im) > 0

    # --- painting
    def put(self, mask, color, glow=0.0):
        m = mask.astype(bool)
        self.rgb[m] = color
        self.a[m] = 1
        self.glow[m] = glow

    def shade(self, mask, rmp, normal, glow=0.0, edge=True, noise=0.12, bias=0.0):
        """Fill `mask` from ramp `rmp`, picking the tone from the lighting of `normal` (an (h,w,3)
        array of surface normals), with a little noise so flat areas get texture, and the shape's own
        edge in the darkest tone (an inner outline)."""
        m = mask.astype(bool)
        if not m.any():
            return
        lit = np.clip((normal * LIGHT).sum(-1), -1, 1)
        t = 0.5 + 0.55 * lit + bias + self.texture() * noise
        idx = np.clip((t * (len(rmp) - 1) + 0.5).astype(int), 0, len(rmp) - 1)
        pal = np.array(rmp)
        col = pal[idx]
        if edge:
            inner = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))) > 0
            border = m & ~inner
            col[border] = pal[0] * 0.85 + OUTLINE * 0.15
        self.rgb[m] = col[m]
        self.a[m] = 1
        self.glow[m] = glow

    # --- normals
    def sphere(self, cx, cy, rx, ry):
        nx = (self.xx + 0.5 - cx) / rx
        ny = (self.yy + 0.5 - cy) / ry
        nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0.02, 1))
        return np.stack([nx, ny, nz], -1)

    def cylinder(self, cx, rx):
        nx = np.clip((self.xx + 0.5 - cx) / rx, -1, 1)
        nz = np.sqrt(np.clip(1 - nx * nx, 0.02, 1))
        return np.stack([nx, np.zeros_like(nx) - 0.15, nz], -1)

    def flat(self, nx=0.0, ny=0.0):
        n = np.array([nx, ny, 1.0])
        n = n / np.linalg.norm(n)
        return np.broadcast_to(n, (self.h, self.w, 3))

    # --- finishing
    def outline(self):
        m = self.a > 0.5
        grown = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
        ring = grown & ~m
        # The outline takes a darkened tint of the color beside it, like the pack's warm outlines.
        near = np.asarray(Image.fromarray((self.rgb * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(float) / 255.0
        self.rgb[ring] = OUTLINE * 0.75 + near[ring] * 0.2
        self.a[ring] = 1


# ---------------------------------------------------------------------------------------------
# Shared bits: the grassy base, leaves, flowers, pebbles

def leaf(art, x, y, s, rmp, angle):
    pts = []
    for k in range(10):
        t = k / 9 * math.pi
        r = math.sin(t) * s * 0.45
        px, py = math.cos(angle) * (t / math.pi - 0.5) * s * 1.6, math.sin(angle) * (t / math.pi - 0.5) * s * 1.6
        pts.append((x + px - math.sin(angle) * r, y + py + math.cos(angle) * r))
    for k in range(9, -1, -1):
        t = k / 9 * math.pi
        r = math.sin(t) * s * 0.45
        px, py = math.cos(angle) * (t / math.pi - 0.5) * s * 1.6, math.sin(angle) * (t / math.pi - 0.5) * s * 1.6
        pts.append((x + px + math.sin(angle) * r, y + py - math.cos(angle) * r))
    m = art.poly(pts)
    art.shade(m, rmp, art.sphere(x, y, s, s), noise=0.2, bias=RNG.uniform(-0.1, 0.12))


def flower(art, x, y):
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        art.put(art.ellipse(x + dx * 1.1, y + dy * 1.1, 1.0, 1.0), hexc('#fbf6ea'))
    art.put(art.ellipse(x, y, 0.8, 0.8), hexc('#f2c24c'))


def pebble(art, x, y, r):
    art.shade(art.ellipse(x, y, r * 1.3, r), R['stone'], art.sphere(x, y - r * 0.3, r * 1.3, r * 1.2))


def grass_base(art, cx, cy, rx, ry, flowers=4, pebbles=3, leaves=10, front=True):
    """A soft tuft of grass under the object: blades along the front rim, leaf clumps and flowers."""
    base = art.ellipse(cx, cy, rx, ry)
    art.shade(base, R['grass'], art.sphere(cx, cy - ry * 0.6, rx, ry * 2.2), noise=0.3, bias=-0.05)
    # Blades along the rim.
    for k in range(int(rx * 3.2)):
        t = RNG.uniform(-1, 1)
        bx = cx + t * rx * 0.98
        by = cy + math.sqrt(max(0, 1 - t * t)) * ry * RNG.uniform(0.2, 1.0)
        hgt = RNG.uniform(3, 9)
        lean = RNG.uniform(-2, 2)
        m = art.poly([(bx - 1.4, by), (bx + 1.4, by), (bx + lean, by - hgt)])
        art.shade(m, R['grass'], art.flat(lean * 0.2, -0.4), edge=False, noise=0.4, bias=RNG.uniform(-0.1, 0.25))
    for _ in range(pebbles):
        t = RNG.uniform(-0.85, 0.85)
        pebble(art, cx + t * rx, cy + RNG.uniform(0.0, 0.7) * ry, RNG.uniform(2.2, 3.6))
    for _ in range(leaves * 2):
        t = RNG.uniform(-1, 1)
        leaf(art, cx + t * rx * 0.95, cy + RNG.uniform(-0.2, 0.8) * ry, RNG.uniform(3.5, 6), R['leaf'], RNG.uniform(-2.6, -0.5))
    for _ in range(flowers):
        t = RNG.uniform(-0.9, 0.9)
        flower(art, cx + t * rx, cy + RNG.uniform(0.0, 0.8) * ry)


def jack_face(art, cx, cy, s, glow=1.0, grin=True):
    """A friendly carved face that glows: two triangle eyes and a smile with a tooth."""
    lit = R['glow']
    for side in (-1, 1):
        ex = cx + side * s * 0.38
        m = art.poly([(ex - s * 0.17, cy - s * 0.05), (ex + s * 0.17, cy - s * 0.05), (ex, cy - s * 0.32)])
        art.shade(m, lit, art.sphere(ex, cy - s * 0.4, s * 0.3, s * 0.3), glow=glow, edge=False, noise=0.05, bias=0.15)
    mouth = art.ellipse(cx, cy + s * 0.12, s * 0.52, s * 0.3) & (art.yy + 0.5 > cy + s * 0.1)
    if grin:
        tooth = art.poly([(cx - s * 0.06, cy + s * 0.1), (cx + s * 0.06, cy + s * 0.1), (cx + s * 0.06, cy + s * 0.22), (cx - s * 0.06, cy + s * 0.22)])
        mouth &= ~tooth
    art.shade(mouth, lit, art.sphere(cx, cy - s * 0.1, s * 0.6, s * 0.5), glow=glow, edge=False, noise=0.05, bias=0.1)
    # A dark carved rim around each cut.
    cut = art.glow > 0.5
    ring = (np.asarray(Image.fromarray((cut * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0) & ~cut & (art.a > 0)
    near = ring & art.ellipse(cx, cy, s * 0.8, s * 0.7)
    art.rgb[near] = hexc('#6a2416')


def pumpkin(art, cx, cy, rx, ry, rmp=None, face=False, stem=True, glow=1.0):
    """A ribbed pumpkin: five overlapping lobes (outer ones first) each lit as its own sphere."""
    rmp = rmp or R['pumpkin']
    lobes = [(-0.62, 0.42), (0.62, 0.42), (-0.3, 0.5), (0.3, 0.5), (0.0, 0.52)]
    for ox, w in lobes:
        lx = cx + ox * rx
        m = art.ellipse(lx, cy, rx * w, ry)
        art.shade(m, rmp, art.sphere(lx - ox * rx * 0.3, cy, rx * w * 1.35, ry * 1.05), noise=0.1)
    if stem:
        sm = art.poly([(cx - rx * 0.1, cy - ry * 0.8), (cx + rx * 0.08, cy - ry * 0.8), (cx + rx * 0.16, cy - ry * 1.22), (cx + rx * 0.02, cy - ry * 1.25)])
        art.shade(sm, R['stem'], art.cylinder(cx + rx * 0.04, rx * 0.12))
    if face:
        jack_face(art, cx, cy, min(rx, ry) * 0.95, glow=glow)


# ---------------------------------------------------------------------------------------------
# The decorations

def pumpkin_house():
    art = Art(210, 196)
    cx, base = 105, 170
    grass_base(art, cx, base, 92, 18, flowers=7, pebbles=4, leaves=16)
    # Back lobes, then the big body.
    rx, ry, cy = 82, 66, 108
    lobes = [(-0.7, 0.36), (0.7, 0.36), (-0.4, 0.46), (0.4, 0.46), (0.0, 0.5)]
    for ox, w in lobes:
        lx = cx + ox * rx
        art.shade(art.ellipse(lx, cy, rx * w, ry), R['pumpkin'], art.sphere(lx - ox * rx * 0.3, cy - 6, rx * w * 1.35, ry * 1.08), noise=0.1)
    # The stem is the chimney: a thick green trunk with a little stone cap and a curling vine.
    sm = art.poly([(cx - 9, cy - ry + 8), (cx + 9, cy - ry + 8), (cx + 11, cy - ry - 22), (cx - 7, cy - ry - 24)])
    art.shade(sm, R['stem'], art.cylinder(cx + 2, 10))
    cap = art.ellipse(cx + 2, cy - ry - 24, 11, 4)
    art.shade(cap, R['stone'], art.sphere(cx + 2, cy - ry - 26, 11, 5))
    for k, (vx, vy, vs) in enumerate([(cx + 18, cy - ry - 2, 6), (cx + 27, cy - ry + 3, 5), (cx - 17, cy - ry + 1, 5)]):
        leaf(art, vx, vy, vs, R['leaf'], -0.4 - k * 0.6)
    vine = art.line_mask([(cx + 9, cy - ry - 6), (cx + 16, cy - ry - 10), (cx + 22, cy - ry - 6), (cx + 21, cy - ry - 1)], 1.5)
    art.put(vine, R['stem'][1])
    # Glowing carved eyes (the windows) with little wooden frames.
    for side in (-1, 1):
        ex, ey = cx + side * 34, cy - 18
        tri = art.poly([(ex - 15, ey + 8), (ex + 15, ey + 8), (ex, ey - 15)])
        frame = np.asarray(Image.fromarray((tri * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
        art.shade(frame & ~tri, R['wood'], art.flat(-0.3, -0.5), edge=False, noise=0.3)
        art.shade(tri, R['glow'], art.sphere(ex, ey - 10, 18, 18), glow=1.0, edge=False, noise=0.06, bias=0.1)
        # Window cross bars.
        art.put(art.line_mask([(ex, ey - 13), (ex, ey + 7)], 1), R['wood'][1])
        art.put(art.line_mask([(ex - 8, ey), (ex + 8, ey)], 1), R['wood'][1])
    # The smile is a lit window band; the door is a round wooden door in the middle of it.
    smile = art.ellipse(cx, cy + 14, 56, 30) & (art.yy + 0.5 > cy + 16) & ~art.ellipse(cx, cy + 6, 50, 24)
    art.shade(smile, R['glow'], art.sphere(cx, cy, 60, 40), glow=1.0, edge=False, noise=0.06, bias=0.05)
    rim = (np.asarray(Image.fromarray((smile * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0) & ~smile
    art.rgb[rim & (art.a > 0)] = hexc('#6a2416')
    door = art.ellipse(cx, base - 22, 15, 22) & (art.yy + 0.5 < base - 6)
    door_frame = (np.asarray(Image.fromarray((door * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0) & ~door & (art.yy + 0.5 < base - 6)
    art.shade(door_frame, R['stone'], art.flat(-0.2, -0.6), noise=0.4)
    art.shade(door, R['wood'], art.cylinder(cx - 3, 18), noise=0.25)
    for px in (cx - 6, cx, cx + 6):
        art.put(art.line_mask([(px, base - 40), (px, base - 7)], 1) & door, R['wood'][1])
    art.put(art.ellipse(cx + 8, base - 20, 1.6, 1.6), hexc('#f2c24c'))
    # Steps, a lantern by the door, and pumpkins in the grass.
    for k, w in enumerate((22, 26)):
        st = art.poly([(cx - w, base - 6 + k * 5), (cx + w, base - 6 + k * 5), (cx + w - 2, base - 1 + k * 5), (cx - w + 2, base - 1 + k * 5)])
        art.shade(st, R['stone'], art.flat(-0.1, -0.8), noise=0.3)
    lx, ly = cx - 30, base - 30
    art.put(art.line_mask([(lx, ly - 8), (lx, ly - 2)], 1), R['iron'][1])
    lan = art.poly([(lx - 4, ly - 2), (lx + 4, ly - 2), (lx + 3, ly + 7), (lx - 3, ly + 7)])
    art.shade(lan, R['iron'], art.flat(-0.3, 0), noise=0.1)
    art.shade(art.poly([(lx - 2.5, ly), (lx + 2.5, ly), (lx + 2, ly + 5), (lx - 2, ly + 5)]), R['glow'], art.flat(-0.3, -0.3), glow=1.0, edge=False, noise=0.05, bias=-0.05)
    pumpkin(art, cx + 62, base - 6, 14, 11, R['pumpkin2'])
    pumpkin(art, cx + 46, base + 4, 10, 8)
    pumpkin(art, cx - 64, base - 2, 12, 9, face=True)
    for _ in range(5):
        t = RNG.uniform(-0.95, 0.95)
        leaf(art, cx + t * 90, base + RNG.uniform(2, 14), RNG.uniform(4, 6), R['leaf'], RNG.uniform(-2.6, -0.5))
    for _ in range(4):
        flower(art, cx + RNG.uniform(-85, 85), base + RNG.uniform(4, 14))
    art.outline()
    return art


def spooky_tree():
    art = Art(170, 210)
    cx, base = 85, 186
    grass_base(art, cx, base, 58, 14, flowers=3, pebbles=3, leaves=9)
    # Trunk: a wide flared base narrowing up, leaning a little, with roots.
    trunk = art.poly([(cx - 20, base - 2), (cx - 11, base - 18), (cx - 9, base - 70), (cx - 14, base - 104), (cx - 4, base - 108), (cx + 6, base - 76),
                      (cx + 10, base - 22), (cx + 22, base - 2)])
    art.shade(trunk, R['darkwood'], art.cylinder(cx - 1, 16), noise=0.25)
    for rx0, ry0, rx1, ry1 in ((cx - 18, base - 4, cx - 30, base + 2), (cx + 18, base - 4, cx + 31, base + 1), (cx + 2, base - 4, cx + 8, base + 5)):
        art.shade(art.line_mask([(rx0, ry0), ((rx0 + rx1) / 2, ry0 - 1), (rx1, ry1)], 4), R['darkwood'], art.flat(0, -0.5), noise=0.3)
    # Twisty branches, each a tapering curl.
    def branch(pts, w0):
        n = len(pts) - 1
        for i in range(n):
            w = max(1.5, w0 * (1 - i / n))
            art.shade(art.line_mask([pts[i], pts[i + 1]], w), R['darkwood'], art.flat(-0.2, -0.6), edge=False, noise=0.3, bias=0.05)
    branch([(cx - 9, base - 96), (cx - 26, base - 116), (cx - 34, base - 136), (cx - 30, base - 150), (cx - 22, base - 152)], 9)
    branch([(cx - 4, base - 104), (cx + 2, base - 128), (cx - 4, base - 152), (cx + 4, base - 170), (cx + 12, base - 168)], 9)
    branch([(cx + 4, base - 84), (cx + 26, base - 98), (cx + 44, base - 118), (cx + 54, base - 120), (cx + 58, base - 112)], 9)
    branch([(cx - 8, base - 66), (cx - 30, base - 76), (cx - 52, base - 74), (cx - 60, base - 64)], 7)
    branch([(cx - 30, base - 133), (cx - 46, base - 132), (cx - 52, base - 124)], 4)
    branch([(cx + 1, base - 140), (cx + 18, base - 150), (cx + 24, base - 160)], 4)
    branch([(cx + 34, base - 108), (cx + 38, base - 128), (cx + 46, base - 134)], 4)
    # A hollow with two friendly glowing eyes.
    hol = art.ellipse(cx - 1, base - 48, 7, 10)
    art.put(hol, hexc('#1d1220'))
    for side in (-1, 1):
        art.shade(art.ellipse(cx - 1 + side * 3, base - 50, 1.6, 2.2), R['glow'], art.flat(), glow=1.0, edge=False, noise=0, bias=0.3)
    # A lantern hanging from the right branch, and a few orange leaves clinging on.
    lx, ly = cx + 50, base - 100
    art.put(art.line_mask([(lx, base - 117), (lx, ly - 6)], 1), R['iron'][2])
    lan = art.poly([(lx - 6, ly - 6), (lx + 6, ly - 6), (lx + 5, ly + 9), (lx - 5, ly + 9)])
    art.shade(lan, R['iron'], art.flat(-0.3, 0), noise=0.1)
    art.shade(art.poly([(lx - 3.5, ly - 3), (lx + 3.5, ly - 3), (lx + 3, ly + 6), (lx - 3, ly + 6)]), R['glow'], art.flat(-0.2, -0.3), glow=1.0, edge=False, noise=0.05, bias=-0.05)
    art.shade(art.poly([(lx - 8, ly - 6), (lx + 8, ly - 6), (lx, ly - 12)]), R['iron'], art.flat(-0.3, -0.6), noise=0.1)
    orange = ramp('#7a2e1c', '#b4481e', '#e2701f', '#f5a03a', '#ffcf72')
    for x, y, a in ((cx - 36, base - 150, -1.2), (cx - 52, base - 126, -2.2), (cx + 14, base - 168, -0.6), (cx + 58, base - 118, -0.4),
                    (cx - 58, base - 66, -2.4), (cx + 26, base - 158, -1.0), (cx - 28, base - 76, -1.6)):
        leaf(art, x, y, 4.5, orange, a)
    # Little mushrooms and a pumpkin at the roots.
    for mx, my in ((cx - 34, base + 2), (cx - 28, base + 6)):
        art.shade(art.poly([(mx - 1.5, my), (mx + 1.5, my), (mx + 1.2, my - 5), (mx - 1.2, my - 5)]), R['stone'], art.flat(), noise=0.1, bias=0.2)
        art.shade(art.ellipse(mx, my - 5, 4, 3) & (art.yy + 0.5 < my - 4), R['purple'], art.sphere(mx - 1, my - 6, 4, 3), noise=0.1)
    pumpkin(art, cx + 30, base + 2, 11, 8, face=True)
    art.outline()
    return art


def pumpkin_patch():
    art = Art(180, 120)
    cx, base = 90, 92
    grass_base(art, cx, base, 82, 20, flowers=3, pebbles=2, leaves=14)
    # Curly vines behind, then the pumpkins front to back.
    for pts in (((cx - 70, base - 4), (cx - 40, base - 18), (cx - 10, base - 10), (cx + 20, base - 22), (cx + 60, base - 10)),
                ((cx - 60, base + 8), (cx - 20, base + 2), (cx + 30, base + 10), (cx + 72, base + 2))):
        art.put(art.line_mask(list(pts), 1.6), R['stem'][1])
    for x, y in ((cx - 54, base - 16), (cx - 6, base - 22), (cx + 40, base - 24), (cx + 66, base - 8), (cx - 76, base + 2)):
        leaf(art, x, y, 7, R['leaf'], RNG.uniform(-2.6, -0.5))
        leaf(art, x + 5, y + 3, 6, R['leaf'], RNG.uniform(-2.6, -0.5))
    pumpkin(art, cx + 30, base - 14, 24, 18, R['pumpkin2'])
    pumpkin(art, cx - 34, base - 10, 22, 17)
    pumpkin(art, cx + 2, base + 4, 30, 23, face=True)
    pumpkin(art, cx + 54, base + 8, 13, 10)
    pumpkin(art, cx - 64, base + 8, 11, 9, R['pumpkin2'])
    for _ in range(4):
        leaf(art, cx + RNG.uniform(-80, 80), base + RNG.uniform(8, 18), RNG.uniform(4, 6), R['leaf'], RNG.uniform(-2.6, -0.5))
    art.outline()
    return art


def cauldron():
    art = Art(130, 120)
    cx, base = 65, 100
    grass_base(art, cx, base, 54, 13, flowers=2, pebbles=2, leaves=7)
    # Fire stones and a little fire under the pot.
    for t, dy, r in ((-0.95, 0, 5.5), (-0.5, 4, 6), (0.0, 5, 5), (0.5, 4, 6.5), (0.95, 0, 5)):
        pebble(art, cx + t * 30, base + dy, r)
    for fx, fh in ((cx - 10, 14), (cx, 20), (cx + 10, 15), (cx - 4, 12), (cx + 5, 13)):
        fl = art.poly([(fx - 5, base - 2), (fx + 5, base - 2), (fx + 1, base - 2 - fh), (fx - 1, base - 2 - fh * 0.6)])
        art.shade(fl, R['flame'], art.sphere(fx, base - fh, 6, fh), glow=1.0, edge=False, noise=0.15, bias=0.15)
    # Legs and the pot.
    for side in (-1, 1):
        art.shade(art.poly([(cx + side * 26, base - 22), (cx + side * 20, base - 22), (cx + side * 28, base - 2), (cx + side * 32, base - 2)]), R['iron'], art.flat(-0.3, 0), noise=0.1)
    pot = art.ellipse(cx, base - 40, 38, 30) & (art.yy + 0.5 > base - 62)
    art.shade(pot, R['iron'], art.sphere(cx - 4, base - 46, 42, 34), noise=0.12, bias=0.05)
    rim = art.ellipse(cx, base - 62, 36, 8)
    art.shade(rim, R['iron'], art.flat(-0.2, -0.8), noise=0.1, bias=0.1)
    brew = art.ellipse(cx, base - 62, 30, 5.5)
    art.shade(brew, R['brew'], art.sphere(cx - 6, base - 64, 30, 8), glow=0.6, edge=False, noise=0.2)
    # Bubbles and a wisp of steam.
    for bx, by, br in ((cx - 10, base - 70, 4), (cx + 8, base - 74, 3), (cx + 2, base - 82, 2.5), (cx - 4, base - 90, 2)):
        art.shade(art.ellipse(bx, by, br, br), R['brew'], art.sphere(bx - 1, by - 1, br, br), glow=0.6, noise=0.05, bias=0.2)
    # A wooden spoon.
    art.shade(art.line_mask([(cx + 14, base - 64), (cx + 30, base - 96)], 3), R['wood'], art.flat(-0.3, -0.3), noise=0.2)
    art.outline()
    return art


def scarecrow():
    art = Art(130, 180)
    cx, base = 65, 160
    grass_base(art, cx, base, 46, 12, flowers=3, pebbles=1, leaves=8)
    # Hay bale at the foot.
    bale = art.poly([(cx - 26, base - 2), (cx + 26, base - 2), (cx + 24, base - 22), (cx - 24, base - 22)])
    art.shade(bale, R['straw'], art.cylinder(cx - 4, 30), noise=0.45)
    for y in (base - 8, base - 16):
        art.put(art.line_mask([(cx - 24, y), (cx + 24, y)], 1) & bale, R['straw'][1])
    # The pole and cross bar.
    art.shade(art.poly([(cx - 3, base - 22), (cx + 3, base - 22), (cx + 3, base - 120), (cx - 3, base - 120)]), R['wood'], art.cylinder(cx, 3), noise=0.2)
    art.shade(art.poly([(cx - 46, base - 96), (cx + 46, base - 96), (cx + 46, base - 90), (cx - 46, base - 90)]), R['wood'], art.flat(0, -0.6), noise=0.2)
    # Shirt with a patch, straw poking from the cuffs.
    shirt = art.poly([(cx - 40, base - 100), (cx + 40, base - 100), (cx + 40, base - 86), (cx + 20, base - 84), (cx + 22, base - 46), (cx - 22, base - 46), (cx - 20, base - 84), (cx - 40, base - 86)])
    art.shade(shirt, R['cloth_blue'], art.cylinder(cx - 6, 34), noise=0.25)
    art.shade(art.poly([(cx + 6, base - 72), (cx + 16, base - 72), (cx + 16, base - 62), (cx + 6, base - 62)]), R['cloth_red'], art.flat(-0.2, -0.4), noise=0.3)
    for side in (-1, 1):
        for k in range(4):
            sx = cx + side * (41 + k * 1.2)
            art.shade(art.line_mask([(sx, base - 96 + k * 3), (sx + side * 5, base - 98 + k * 4)], 1.4), R['straw'], art.flat(), edge=False, noise=0.3, bias=0.2)
    for k in range(5):
        sx = cx - 18 + k * 9
        art.shade(art.line_mask([(sx, base - 47), (sx + RNG.uniform(-2, 2), base - 38)], 1.6), R['straw'], art.flat(), edge=False, noise=0.3, bias=0.15)
    # Burlap head with a stitched smile and a pointy hat.
    head = art.ellipse(cx, base - 114, 15, 15)
    art.shade(head, R['straw'], art.sphere(cx - 3, base - 117, 17, 17), noise=0.25, bias=-0.05)
    for side in (-1, 1):
        art.put(art.ellipse(cx + side * 6, base - 116, 1.8, 2.2), hexc('#3a2026'))
        art.put(art.ellipse(cx + side * 10, base - 110, 2.2, 1.3), hexc('#e98a74'))
    art.put(art.line_mask([(cx - 6, base - 108), (cx - 2, base - 106), (cx + 2, base - 106), (cx + 6, base - 108)], 1), hexc('#3a2026'))
    brim = art.ellipse(cx, base - 126, 24, 5)
    art.shade(brim, R['wood'], art.flat(-0.2, -0.8), noise=0.2)
    crown = art.poly([(cx - 13, base - 127), (cx + 13, base - 127), (cx + 6, base - 146), (cx + 12, base - 156), (cx - 2, base - 150), (cx - 10, base - 138)])
    art.shade(crown, R['wood'], art.cylinder(cx - 2, 14), noise=0.2)
    art.shade(art.poly([(cx - 12, base - 133), (cx + 11, base - 133), (cx + 12, base - 128), (cx - 13, base - 128)]), R['cloth_red'], art.flat(-0.2, -0.3), noise=0.2)
    # A crow friend on the bar.
    bx, by = cx + 36, base - 102
    art.shade(art.ellipse(bx, by, 7, 5.5), R['iron'], art.sphere(bx - 2, by - 2, 8, 6), noise=0.1)
    art.shade(art.ellipse(bx + 5, by - 6, 4.5, 4), R['iron'], art.sphere(bx + 4, by - 7, 5, 5), noise=0.1)
    art.put(art.poly([(bx + 9, by - 7), (bx + 13, by - 6), (bx + 9, by - 5)]), hexc('#f2c24c'))
    art.put(art.ellipse(bx + 6, by - 7, 0.9, 0.9), hexc('#fbf6ea'))
    pumpkin(art, cx - 34, base + 2, 11, 8, face=True)
    art.outline()
    return art


def lamp_post():
    art = Art(110, 200)
    cx, base = 46, 186
    grass_base(art, cx, base, 30, 9, flowers=2, pebbles=1, leaves=6)
    # Stone footing, an iron post with a curl, and a jack-o'-lantern lamp hanging off the hook.
    art.shade(art.poly([(cx - 9, base), (cx + 9, base), (cx + 7, base - 10), (cx - 7, base - 10)]), R['stone'], art.flat(-0.3, -0.5), noise=0.3)
    art.shade(art.poly([(cx - 4.5, base - 10), (cx + 4.5, base - 10), (cx + 3.5, base - 160), (cx - 3.5, base - 160)]), R['iron'], art.cylinder(cx, 4.5), noise=0.1)
    art.shade(art.ellipse(cx, base - 163, 6.5, 6.5), R['iron'], art.sphere(cx - 1, base - 164, 6.5, 6.5), noise=0.1)
    art.shade(art.poly([(cx - 7, base - 14), (cx + 7, base - 14), (cx + 6, base - 20), (cx - 6, base - 20)]), R['iron'], art.flat(-0.2, -0.6), noise=0.1)
    hook = art.line_mask([(cx, base - 150), (cx + 14, base - 157), (cx + 26, base - 153), (cx + 28, base - 146)], 3)
    art.put(hook, R['iron'][2])
    curl = art.line_mask([(cx, base - 136), (cx + 8, base - 140), (cx + 11, base - 146), (cx + 7, base - 150)], 1.5)
    art.put(curl, R['iron'][2])
    art.put(art.line_mask([(cx + 28, base - 146), (cx + 28, base - 138)], 1), R['iron'][1])
    pumpkin(art, cx + 28, base - 122, 20, 16, face=True)
    # A little bat sign on the post.
    art.shade(art.poly([(cx - 14, base - 80), (cx + 14, base - 80), (cx + 14, base - 66), (cx - 14, base - 66)]), R['wood'], art.flat(-0.2, -0.4), noise=0.3)
    bat_w = art.poly([(cx - 9, base - 73), (cx - 3, base - 76), (cx, base - 74), (cx + 3, base - 76), (cx + 9, base - 73), (cx + 4, base - 72), (cx, base - 70), (cx - 4, base - 72)])
    art.put(bat_w, hexc('#2e2040'))
    art.outline()
    return art


DECOR = [
    ('pumpkin-house', 'Pumpkin House', pumpkin_house, 'home'),
    ('spooky-tree', 'Spooky Tree', spooky_tree, 'tree'),
    ('pumpkin-patch', 'Pumpkin Patch', pumpkin_patch, 300),
    ('cauldron', 'Bubbling Cauldron', cauldron, 160),
    ('scarecrow', 'Scarecrow', scarecrow, 170),
    ('lantern-post', 'Jack-o’-Lantern Lamp', lamp_post, 110),
]


def render(art, phase):
    """Upscale the art pixels, grade for the time of day, and let the glowing parts shine."""
    rgb = art.rgb.copy()
    gl = art.glow * GLOW[phase]
    graded = np.stack([rgb[..., c] * GRADE[phase][c][0] + GRADE[phase][c][1] for c in range(3)], -1)
    lit = rgb * (1 + 0.15 * GLOW[phase])
    out = graded * (1 - gl[..., None]) + lit * gl[..., None]
    img = np.concatenate([np.clip(out, 0, 1), art.a[..., None]], -1)
    im = Image.fromarray((img * 255).astype(np.uint8), 'RGBA').resize((art.w * PX, art.h * PX), Image.NEAREST)
    if GLOW[phase] > 0 and art.glow.any():
        halo = Image.fromarray((art.glow * 255).astype(np.uint8)).resize((art.w * PX, art.h * PX), Image.NEAREST).filter(ImageFilter.GaussianBlur(PX * 9))
        h = np.clip(np.asarray(halo).astype(float) / 255.0 * GLOW[phase] * 1.6, 0, 0.9)
        base = np.asarray(im).astype(float) / 255.0
        warm = np.array([1.0, 0.66, 0.26])
        a = base[..., 3]
        add = h[..., None] * warm
        colour = np.clip(base[..., :3] + add * 0.5 * a[..., None], 0, 1)
        # Where the art is transparent the glow paints a soft warm light around it.
        new_a = np.clip(a + h * 0.55 * (1 - a), 0, 1)
        colour = np.where((a < 0.5)[..., None], warm, colour)
        im = Image.fromarray((np.concatenate([colour, new_a[..., None]], -1) * 255).astype(np.uint8), 'RGBA')
    return im


def main():
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    entries, sheets = [], []
    for ident, label, paint, size in DECOR:
        art = paint()
        ys, xs = np.nonzero(art.a > 0.5)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        # Crop to the art with a small margin so the glow has room.
        m = 10
        x0, y0, x1, y1 = max(0, x0 - m), max(0, y0 - m), min(art.w, x1 + m), min(art.h, y1 + m)
        sub = Art(x1 - x0, y1 - y0)
        sub.rgb, sub.a, sub.glow = art.rgb[y0:y1, x0:x1], art.a[y0:y1, x0:x1], art.glow[y0:y1, x0:x1]
        folder = os.path.join(OUT, ident)
        os.makedirs(folder, exist_ok=True)
        imgs = {}
        for phase in PHASES:
            imgs[phase] = render(sub, phase)
            imgs[phase].save(os.path.join(folder, phase + '.png'), optimize=True)
        cys, cxs = np.nonzero(sub.a > 0.5)
        entries.append({
            'id': ident, 'label': label, 'width': int(sub.w * PX), 'height': int(sub.h * PX),
            'contentWidth': int((cxs.max() - cxs.min() + 1) * PX), 'contentHeight': int((cys.max() - cys.min() + 1) * PX),
            'anchorY': round(float((cys.max() + 1) / sub.h) - 0.03, 4), 'size': size,
        })
        sheets.append(imgs)
    if preview:
        cell = 640
        sheet = Image.new('RGBA', (cell * len(sheets), cell * 2), (0, 0, 0, 0))
        bg = Image.new('RGBA', sheet.size, (0, 0, 0, 255))
        d = ImageDraw.Draw(bg)
        d.rectangle([0, 0, sheet.width, cell], fill=(150, 196, 110, 255))
        d.rectangle([0, cell, sheet.width, cell * 2], fill=(40, 52, 70, 255))
        for i, imgs in enumerate(sheets):
            for row, phase in enumerate(('afternoon', 'night')):
                im = imgs[phase].copy()
                im.thumbnail((cell - 20, cell - 20))
                bg.alpha_composite(im, (i * cell + (cell - im.width) // 2, row * cell + (cell - im.height) // 2))
        bg.convert('RGB').save(preview)
    with open(TS_OUT, 'w') as f:
        f.write('// Generated by tools/draw_halloween_decor.py; do not edit by hand.\n')
        f.write('/** Decorate › Halloween: the pumpkin house, the spooky tree and the rest, painted like the pack.\n')
        f.write(" * width/height are the canvas in px; content* the painted part; anchorY where it meets the ground;\n")
        f.write(" * size is 'home' or 'tree' (fitted like those) or a width on the 1448-wide island. */\n")
        f.write('export type HalloweenDecor={id:string;label:string;width:number;height:number;contentWidth:number;contentHeight:number;anchorY:number;size:\'home\'|\'tree\'|number}\n')
        f.write('export const HALLOWEEN_DECOR:HalloweenDecor[]=' + json.dumps(entries, ensure_ascii=False, separators=(',', ':')) + '\n')
        f.write("export const halloweenDecorTexturePath=(id:string,phase:string):string=>`/garden/registered-22.8.6/halloween/${id}/${phase}.png`\n")
    with open(ALLOWLIST) as f:
        allow = json.load(f)
    files = allow if isinstance(allow, list) else None
    want = ['/garden/registered-22.8.6/halloween/%s/%s.png' % (e['id'], p) for e in entries for p in PHASES]
    if files is not None:
        for w in want:
            if w not in files:
                files.append(w)
        with open(ALLOWLIST, 'w') as f:
            json.dump(files, f, indent=1)
            f.write('\n')


if __name__ == '__main__':
    main()
