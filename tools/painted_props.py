"""Painted props in the style of the island's decorations (public/garden/registered-22.8.6: soft
shading, warm brown outlines, a little moss and flowers), drawn procedurally so seasonal islands can
share one look. Each prop is painted at 4x and scaled down smoothly, and comes back as
(RGBA image, glow mask) where the glow mask marks the parts that light up at night (jack-o'-lantern
faces, candle flames, the cauldron's brew).

Used by tools/draw_halloween_island.py."""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 4  # paint at 4x, then scale down
ZOOM = 1.0  # final size multiplier (the island draws props a little larger than the preview)
OUTLINE = (78, 46, 38)
FONT = next((p for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf') if os.path.exists(p)), None)


class Canvas:
    """An RGBA painting surface (float, 0..1) at S x the final size, plus a glow mask."""

    def __init__(self, w, h):
        self.w, self.h = w * S, h * S
        self.rgb = np.zeros((self.h, self.w, 3))
        self.a = np.zeros((self.h, self.w))
        self.glow = np.zeros((self.h, self.w))

    def mask(self, draw):
        m = Image.new('L', (self.w, self.h), 0)
        draw(ImageDraw.Draw(m), S)
        return np.asarray(m).astype(float) / 255.0

    def paint(self, mask, color, light=0.55, shine=0.25, depth=10, outline=True, texture=0.06, glow=0.0, seed=0, flat=False):
        """Fill `mask` with `color`, shaded as a soft rounded form lit from the upper left, with a warm
        outline. `depth` (final px) is how round it looks; `glow` (0..1) marks it as lighting up."""
        c = np.array(color, float) / 255.0
        if flat:
            col = np.broadcast_to(c, self.rgb.shape).copy()
        else:
            # A dome over the shape (several blurs averaged), lit from the upper left toward the viewer.
            img = Image.fromarray((mask * 255).astype(np.uint8))
            r = max(1.0, depth * S / 2)
            height = sum(np.asarray(img.filter(ImageFilter.GaussianBlur(r * f))).astype(float) / 255.0 for f in (1.0, 0.55, 0.3)) / 3
            gy, gx = np.gradient(height)
            k = depth * S * 2.2
            nx, ny, nz = -gx * k, -gy * k, np.ones_like(height)
            norm = np.sqrt(nx * nx + ny * ny + nz * nz)
            lx, ly, lz = -0.55, -0.7, 0.55
            ll = math.sqrt(lx * lx + ly * ly + lz * lz)
            lam = np.clip((nx * lx + ny * ly + nz * lz) / (norm * ll), 0, 1)
            shade = (1 - light) + light * 1.35 * lam
            edge = 0.72 + 0.28 * np.clip(height * 2.2, 0, 1)
            col = c * (shade * edge)[..., None]
            hi = np.clip((lam - 0.86) * 6, 0, 1)[..., None] * shine
            col = col * (1 - hi) + np.minimum(1, c * 1.25 + 0.25) * hi
        if texture:
            rng = np.random.default_rng(seed)
            noise = np.asarray(Image.fromarray((rng.random((self.h // 3 + 1, self.w // 3 + 1)) * 255).astype(np.uint8)).resize((self.w, self.h), Image.BILINEAR)).astype(float) / 255.0
            col = col * (1 - texture + texture * 2 * noise[..., None])
        m = mask[..., None]
        if outline:
            ring = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * S + 1))).astype(float) / 255.0
            ring = np.clip(ring - mask, 0, 1)
            o = np.array(OUTLINE, float) / 255.0
            self.rgb = self.rgb * (1 - ring[..., None]) + o * ring[..., None]
            self.a = np.maximum(self.a, ring)
        self.rgb = self.rgb * (1 - m) + np.clip(col, 0, 1) * m
        self.a = np.maximum(self.a, mask)
        if glow:
            self.glow = np.maximum(self.glow, mask * glow)

    def stroke(self, draw, color, width=1.0):
        """Thin painted lines (seams, cracks, stitches) with no outline."""
        m = Image.new('L', (self.w, self.h), 0)
        draw(ImageDraw.Draw(m), S, max(1, int(width * S)))
        mm = np.asarray(m).astype(float)[..., None] / 255.0
        self.rgb = self.rgb * (1 - mm) + np.array(color, float) / 255.0 * mm
        self.a = np.maximum(self.a, mm[..., 0])

    def image(self):
        rgba = np.dstack([self.rgb, self.a])
        size = (round(self.w / S * ZOOM), round(self.h / S * ZOOM))
        img = Image.fromarray((np.clip(rgba, 0, 1) * 255).astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS)
        glow = Image.fromarray((self.glow * 255).astype(np.uint8), 'L').resize(size, Image.LANCZOS)
        return img, glow


# ---------------------------------------------------------------------------------------------
# Little accents shared by the props (the decorations' moss, leaves and white flowers)

LEAF, LEAF_DARK, MOSS = (112, 150, 70), (78, 112, 52), (128, 158, 76)


def leaf(cv, x, y, length, angle, color=LEAF, seed=0):
    def d(dr, s):
        pts = []
        for k in range(13):
            t = k / 12
            r = math.sin(t * math.pi) * length * 0.32
            for side in (1,) if k < 13 else ():
                pass
            pts.append((t, r))
        a = math.radians(angle)
        poly = [(x + math.cos(a) * t * length - math.sin(a) * r, y + math.sin(a) * t * length + math.cos(a) * r) for t, r in pts]
        poly += [(x + math.cos(a) * t * length + math.sin(a) * r, y + math.sin(a) * t * length - math.cos(a) * r) for t, r in reversed(pts)]
        dr.polygon([(px * s, py * s) for px, py in poly], fill=255)
    cv.paint(cv.mask(d), color, depth=2, shine=0.15, seed=seed)


def flower(cv, x, y, r=2.4, color=(250, 246, 236), center=(240, 200, 90)):
    for k in range(5):
        a = k * math.tau / 5 - math.pi / 2
        px, py = x + math.cos(a) * r * 0.8, y + math.sin(a) * r * 0.8
        cv.paint(cv.mask(lambda d, s, px=px, py=py: d.ellipse([(px - r * 0.62) * s, (py - r * 0.62) * s, (px + r * 0.62) * s, (py + r * 0.62) * s], fill=255)), color, depth=1.2, shine=0.1, outline=False, texture=0)
    cv.paint(cv.mask(lambda d, s: d.ellipse([(x - r * 0.42) * s, (y - r * 0.42) * s, (x + r * 0.42) * s, (y + r * 0.42) * s], fill=255)), center, depth=1, outline=False, texture=0)


def grass_tuft(cv, x, y, h=7, color=MOSS, seed=0):
    rng = np.random.default_rng(seed)
    for k in range(6):
        dx = rng.uniform(-h * 0.6, h * 0.6)
        tip = (x + dx * 1.5, y - h * rng.uniform(0.6, 1.1))
        cv.paint(cv.mask(lambda d, s, dx=dx, tip=tip: d.polygon([((x + dx - 1.1) * s, y * s), ((x + dx + 1.1) * s, y * s), (tip[0] * s, tip[1] * s)], fill=255)), color, depth=1.5, outline=False, texture=0.04, seed=k)


def moss_patch(cv, x, y, w, h, seed=0):
    rng = np.random.default_rng(seed)
    def d(dr, s):
        for _ in range(9):
            cx, cy = x + rng.uniform(-w / 2, w / 2), y + rng.uniform(-h / 2, h / 2)
            r = rng.uniform(h * 0.35, h * 0.7)
            dr.ellipse([(cx - r * 1.3) * s, (cy - r) * s, (cx + r * 1.3) * s, (cy + r) * s], fill=255)
    cv.paint(cv.mask(d), MOSS, depth=2, shine=0.2, outline=False, texture=0.12, seed=seed)


# ---------------------------------------------------------------------------------------------
# The Halloween props

ORANGE, ORANGE_DARK = (236, 128, 44), (196, 92, 30)


def _pumpkin_body(cv, cx, cy, w, h, seed=0):
    lobes = 5
    xs = [cx - w / 2 + (k + 0.5) / lobes * w for k in range(lobes)]
    def body(d, s):
        for k, lx in enumerate(xs):
            t = (k + 0.5) / lobes
            lw = w / lobes * 1.7 * (1 - abs(t - 0.5) * 0.45)
            lh = h * (1 - abs(t - 0.5) * 0.22)
            d.ellipse([(lx - lw / 2) * s, (cy - lh / 2) * s, (lx + lw / 2) * s, (cy + lh / 2) * s], fill=255)
    cv.paint(cv.mask(body), ORANGE, depth=w * 0.32, shine=0.35, light=0.6, seed=seed)
    # soft ribs between the lobes, and a lighter streak down each front lobe
    for k in range(1, lobes):
        lx = cx - w / 2 + k / lobes * w
        bend = (lx - cx) * 0.25
        rib = Image.new('L', (cv.w, cv.h), 0)
        ImageDraw.Draw(rib).line([((lx + bend) * S, (cy - h * 0.44) * S), (lx * S, cy * S), ((lx + bend) * S, (cy + h * 0.44) * S)], fill=255, width=int(1.4 * S))
        m = np.asarray(rib.filter(ImageFilter.GaussianBlur(S * 0.8))).astype(float) / 255.0 * cv.a
        cv.rgb = cv.rgb * (1 - 0.45 * m[..., None]) + np.array(ORANGE_DARK, float) / 255.0 * 0.45 * m[..., None] * 0.6
    for lx in xs[1:4]:
        streak = Image.new('L', (cv.w, cv.h), 0)
        ImageDraw.Draw(streak).ellipse([(lx - w * 0.04) * S, (cy - h * 0.34) * S, (lx + w * 0.02) * S, (cy - h * 0.02) * S], fill=255)
        m = np.asarray(streak.filter(ImageFilter.GaussianBlur(S * 1.2))).astype(float) / 255.0 * cv.a * 0.35
        cv.rgb = cv.rgb * (1 - m[..., None]) + np.array((255, 214, 150), float) / 255.0 * m[..., None]


def _stem(cv, cx, top, h, seed=0):
    cv.paint(cv.mask(lambda d, s: d.polygon([((cx - 2.2) * s, (top + 2) * s), ((cx + 1.8) * s, (top + 2) * s), ((cx + 3.6) * s, (top - h) * s), ((cx + 0.8) * s, (top - h - 0.5) * s)], fill=255)), (110, 130, 60), depth=1.5, shine=0.2, seed=seed)


def pumpkin(size=30, seed=0):
    w, h = size, int(size * 0.82)
    cv = Canvas(w + 12, h + 16)
    cx, cy = (w + 12) / 2, 10 + h / 2
    _pumpkin_body(cv, cx, cy, w, h, seed)
    _stem(cv, cx, cy - h / 2 + 1, 6, seed)
    leaf(cv, cx + 2, cy - h / 2 - 1, 9, -20, seed=seed + 9)
    return cv.image()


def jack(size=34, seed=3):
    w, h = size, int(size * 0.84)
    cv = Canvas(w + 12, h + 16)
    cx, cy = (w + 12) / 2, 10 + h / 2
    _pumpkin_body(cv, cx, cy, w, h, seed)
    _stem(cv, cx, cy - h / 2 + 1, 6, seed)
    face = (255, 200, 80)
    ey = cy - h * 0.08
    for ex, flip in ((cx - w * 0.2, 1), (cx + w * 0.2, -1)):
        cv.paint(cv.mask(lambda d, s, ex=ex: d.polygon([((ex - w * 0.12) * s, (ey + h * 0.1) * s), ((ex + w * 0.12) * s, (ey + h * 0.1) * s), (ex * s, (ey - h * 0.14) * s)], fill=255)), face, depth=3, shine=0.5, light=0.3, texture=0.02, glow=1)
    cv.paint(cv.mask(lambda d, s: d.polygon([((cx - w * 0.05) * s, (cy + h * 0.06) * s), ((cx + w * 0.05) * s, (cy + h * 0.06) * s), (cx * s, (cy - h * 0.02) * s)], fill=255)), face, depth=2, light=0.3, texture=0.02, glow=1)
    my = cy + h * 0.2
    def mouth(d, s):
        top = [(cx - w * 0.32, my - h * 0.06)]
        for k in range(1, 8):
            t = k / 8
            top.append((cx - w * 0.32 + t * w * 0.64, my - h * 0.06 + (h * 0.07 if k % 2 else 0) + math.sin(t * math.pi) * h * 0.04))
        top.append((cx + w * 0.32, my - h * 0.06))
        bottom = [(cx + w * 0.24, my + h * 0.12), (cx + w * 0.08, my + h * 0.08), (cx, my + h * 0.15), (cx - w * 0.08, my + h * 0.08), (cx - w * 0.24, my + h * 0.12)]
        d.polygon([(px * s, py * s) for px, py in top + bottom], fill=255)
    cv.paint(cv.mask(mouth), face, depth=3, shine=0.5, light=0.3, texture=0.02, glow=1)
    return cv.image()


def gravestone(cross=False, seed=0):
    w, h = 34, 42
    cv = Canvas(w + 10, h + 8)
    cx, base = (w + 10) / 2, h + 4
    stone, dark = (168, 160, 178), (122, 114, 134)
    if cross:
        cv.paint(cv.mask(lambda d, s: (d.rounded_rectangle([(cx - 4) * s, 6 * s, (cx + 4) * s, (base - 4) * s], radius=2 * s, fill=255),
                                       d.rounded_rectangle([(cx - 13) * s, 15 * s, (cx + 13) * s, 22 * s], radius=2 * s, fill=255))), stone, depth=4, shine=0.3, seed=seed)
        cv.paint(cv.mask(lambda d, s: d.ellipse([(cx - 12) * s, (base - 7) * s, (cx + 12) * s, (base + 1) * s], fill=255)), dark, depth=3, seed=seed + 1)
    else:
        cv.paint(cv.mask(lambda d, s: (d.rounded_rectangle([(cx - 14) * s, 14 * s, (cx + 14) * s, base * s], radius=3 * s, fill=255),
                                       d.ellipse([(cx - 14) * s, 4 * s, (cx + 14) * s, 30 * s], fill=255))), stone, depth=6, shine=0.32, seed=seed)
        # engraving and a little crack
        cv.stroke(lambda d, s, wd: d.line([((cx - 6) * s, 20 * s), ((cx + 6) * s, 20 * s)], fill=255, width=wd), dark, 1.1)
        cv.stroke(lambda d, s, wd: d.line([((cx - 4) * s, 25 * s), ((cx + 4) * s, 25 * s)], fill=255, width=wd), dark, 1.1)
        cv.stroke(lambda d, s, wd: d.line([((cx + 8) * s, 8 * s), ((cx + 6) * s, 13 * s), ((cx + 9) * s, 16 * s)], fill=255, width=wd), dark, 0.7)
        moss_patch(cv, cx - 8, 9, 10, 3, seed=seed + 3)
    moss_patch(cv, cx, base - 1, w * 0.8, 3.5, seed=seed + 4)
    grass_tuft(cv, cx - 12, base + 1, 6, seed=seed + 5)
    flower(cv, cx + 11, base - 1, 2.2)
    return cv.image()


def candle(seed=0):
    cv = Canvas(18, 30)
    cx = 9
    cv.paint(cv.mask(lambda d, s: d.ellipse([(cx - 7) * s, 23 * s, (cx + 7) * s, 29 * s], fill=255)), (150, 140, 160), depth=2, seed=seed)
    cv.paint(cv.mask(lambda d, s: (d.rounded_rectangle([(cx - 3.5) * s, 11 * s, (cx + 3.5) * s, 26 * s], radius=1.5 * s, fill=255),
                                   d.ellipse([(cx + 1) * s, 13 * s, (cx + 4.5) * s, 19 * s], fill=255))), (248, 236, 210), depth=3, shine=0.3, seed=seed)
    cv.stroke(lambda d, s, wd: d.line([(cx * s, 8.5 * s), (cx * s, 11 * s)], fill=255, width=wd), (60, 40, 30), 0.6)
    cv.paint(cv.mask(lambda d, s: d.polygon([((cx - 2.4) * s, 9 * s), ((cx + 2.4) * s, 9 * s), (cx * s, 1.5 * s)], fill=255)), (255, 200, 80), depth=1.5, shine=0.6, outline=False, texture=0, glow=1)
    cv.paint(cv.mask(lambda d, s: d.ellipse([(cx - 1.1) * s, 5 * s, (cx + 1.1) * s, 8.6 * s], fill=255)), (255, 250, 210), outline=False, texture=0, glow=1, flat=True)
    return cv.image()


def haystack(seed=0):
    w, h = 50, 30
    cv = Canvas(w + 14, h + 10)
    hay, hay_dark, hay_light = (236, 196, 100), (190, 146, 62), (252, 226, 150)
    cv.paint(cv.mask(lambda d, s: d.chord([3 * s, 4 * s, (w + 3) * s, (h * 2 + 4) * s], 180, 360, fill=255)), hay, depth=12, shine=0.35, seed=seed)
    rng = np.random.default_rng(seed)
    for _ in range(70):
        x0, y0 = rng.uniform(6, w), rng.uniform(8, h + 2)
        dx, dy = rng.uniform(-3, 3), rng.uniform(2, 5)
        col = hay_dark if rng.random() < 0.6 else hay_light
        cv.stroke(lambda d, s, wd, x0=x0, y0=y0, dx=dx, dy=dy: d.line([(x0 * s, y0 * s), ((x0 + dx) * s, (y0 + dy) * s)], fill=255, width=wd), col, 0.55)
    for k in range(7):
        x0 = w * 0.3 + k * w * 0.4 / 6
        cv.stroke(lambda d, s, wd, x0=x0: d.line([(x0 * s, 8 * s), ((x0 + rng.uniform(-2.5, 2.5)) * s, (3 + rng.uniform(0, 3)) * s)], fill=255, width=wd), hay_dark, 0.6)
    cv.stroke(lambda d, s, wd: d.line([(5 * s, (h - 2) * s), ((w + 1) * s, (h - 2) * s)], fill=255, width=wd), (150, 100, 58), 1.4)
    img, glow = cv.image()
    p, _ = pumpkin(14, seed=seed + 7)
    img.alpha_composite(p, (round(img.width - p.width), round(img.height - p.height)))
    return img, glow


def leaf_pile(seed=0):
    cv = Canvas(56, 32)
    rng = np.random.default_rng(seed)
    colors = [(222, 110, 44), (240, 164, 60), (190, 72, 40), (226, 186, 80), (168, 96, 52)]
    for k in range(22):
        # a low heap: leaves stay well inside the canvas so none are cut off
        x, y = rng.uniform(17, 39), rng.uniform(15, 22)
        leaf(cv, x - 4, y, rng.uniform(8, 11), rng.uniform(0, 360), colors[k % len(colors)], seed=k)
    return cv.image()


def boo_sign(seed=0):
    cv = Canvas(64, 52)
    wood, wood_dark = (186, 134, 86), (150, 104, 64)
    for px in (14, 50):
        cv.paint(cv.mask(lambda d, s, px=px: d.rounded_rectangle([(px - 3) * s, 20 * s, (px + 3) * s, 50 * s], radius=1.5 * s, fill=255)), wood_dark, depth=2, seed=seed + px)
    cv.paint(cv.mask(lambda d, s: d.rounded_rectangle([4 * s, 8 * s, 60 * s, 32 * s], radius=4 * s, fill=255)), wood, depth=4, shine=0.25, seed=seed)
    cv.stroke(lambda d, s, wd: (d.line([(7 * s, 20 * s), (57 * s, 20 * s)], fill=255, width=wd)), wood_dark, 0.6)
    txt = Image.new('L', (cv.w, cv.h), 0)
    td = ImageDraw.Draw(txt)
    font = ImageFont.truetype(FONT, 17 * S) if FONT else ImageFont.load_default()
    td.text((32 * S, 20.5 * S), 'BOO!', font=font, fill=255, anchor='mm')
    cv.paint(np.asarray(txt).astype(float) / 255.0, (252, 244, 226), depth=1, shine=0.1, outline=False, texture=0)
    leaf(cv, 5, 9, 9, 200, seed=seed + 2)
    leaf(cv, 8, 6, 8, 250, LEAF_DARK, seed=seed + 3)
    flower(cv, 9, 9, 2.4)
    grass_tuft(cv, 14, 51, 6, seed=seed + 4)
    grass_tuft(cv, 50, 51, 6, seed=seed + 5)
    return cv.image()


def cauldron(seed=0):
    cv = Canvas(52, 50)
    cx = 26
    # crossed logs and flames peeking out under the pot
    for x0, x1 in ((9, 41), (41, 11)):
        cv.paint(cv.mask(lambda d, s, x0=x0, x1=x1: d.line([(x0 * s, 46 * s), (x1 * s, 42 * s)], fill=255, width=int(4 * s))), (138, 92, 58), depth=2, seed=seed + x0)
    for fx, fh in ((12, 12), (19, 9), (33, 9), (40, 12)):
        cv.paint(cv.mask(lambda d, s, fx=fx, fh=fh: d.polygon([((fx - 4) * s, 44 * s), ((fx + 4) * s, 44 * s), (fx * s, (44 - fh) * s)], fill=255)), (255, 150, 50), depth=2, shine=0.6, outline=False, texture=0, glow=1)
        cv.paint(cv.mask(lambda d, s, fx=fx, fh=fh: d.polygon([((fx - 2) * s, 44 * s), ((fx + 2) * s, 44 * s), (fx * s, (44 - fh * 0.6) * s)], fill=255)), (255, 226, 120), outline=False, texture=0, glow=1, flat=True)
    # pot
    cv.paint(cv.mask(lambda d, s: d.ellipse([8 * s, 14 * s, 44 * s, 41 * s], fill=255)), (60, 56, 70), depth=8, shine=0.35, seed=seed)
    cv.paint(cv.mask(lambda d, s: d.ellipse([5 * s, 12 * s, 47 * s, 21 * s], fill=255)), (84, 78, 96), depth=2, shine=0.3, seed=seed + 1)
    cv.paint(cv.mask(lambda d, s: d.ellipse([9 * s, 13.5 * s, 43 * s, 19.5 * s], fill=255)), (130, 220, 96), depth=2, shine=0.5, outline=False, texture=0.04, glow=1)
    for bx, by, br in ((18, 13, 2.2), (28, 11, 2.8), (35, 13.5, 1.6), (23, 8, 1.4)):
        cv.paint(cv.mask(lambda d, s, bx=bx, by=by, br=br: d.ellipse([(bx - br) * s, (by - br) * s, (bx + br) * s, (by + br) * s], fill=255)), (170, 245, 130), depth=1, shine=0.6, outline=False, texture=0, glow=1)
    return cv.image()


def scarecrow(seed=0):
    cv = Canvas(48, 74)
    cx = 24
    wood, burlap = (150, 104, 64), (222, 196, 140)
    cv.paint(cv.mask(lambda d, s: d.rounded_rectangle([(cx - 2.5) * s, 24 * s, (cx + 2.5) * s, 73 * s], radius=1 * s, fill=255)), wood, depth=2, seed=seed)
    cv.paint(cv.mask(lambda d, s: d.rounded_rectangle([3 * s, 31 * s, 45 * s, 35 * s], radius=1 * s, fill=255)), wood, depth=2, seed=seed + 1)
    # shirt (plaid) with straw cuffs
    cv.paint(cv.mask(lambda d, s: d.polygon([(8 * s, 30 * s), (40 * s, 30 * s), (34 * s, 56 * s), (14 * s, 56 * s)], fill=255)), (206, 84, 62), depth=5, shine=0.25, seed=seed + 2)
    for k in range(4):
        y = 34 + k * 5.5
        cv.stroke(lambda d, s, wd, y=y: d.line([(10 * s, y * s), (38 * s, y * s)], fill=255, width=wd), (170, 58, 46), 0.9)
    for x in (16, 24, 32):
        cv.stroke(lambda d, s, wd, x=x: d.line([(x * s, 31 * s), ((x - (x - 24) * 0.25) * s, 55 * s)], fill=255, width=wd), (170, 58, 46), 0.9)
    for sx in (5, 43):
        for k in range(4):
            cv.stroke(lambda d, s, wd, sx=sx, k=k: d.line([(sx * s, 33 * s), ((sx + (k - 1.5) * 1.6) * s, 38.5 * s)], fill=255, width=wd), (236, 198, 100), 0.8)
    # head
    cv.paint(cv.mask(lambda d, s: d.ellipse([(cx - 9) * s, 12 * s, (cx + 9) * s, 31 * s], fill=255)), burlap, depth=5, shine=0.25, seed=seed + 3)
    for ex in (cx - 4, cx + 4):
        cv.paint(cv.mask(lambda d, s, ex=ex: d.ellipse([(ex - 1.5) * s, 19 * s, (ex + 1.5) * s, 22 * s], fill=255)), (60, 40, 34), depth=1, outline=False, texture=0)
    cv.stroke(lambda d, s, wd: d.arc([(cx - 5) * s, 20 * s, (cx + 5) * s, 27.5 * s], 20, 160, fill=255, width=wd), (110, 70, 50), 0.8)
    for k in range(5):
        x = cx - 4 + k * 2
        cv.stroke(lambda d, s, wd, x=x: d.line([(x * s, 25.6 * s), (x * s, 27.4 * s)], fill=255, width=wd), (110, 70, 50), 0.5)
    # hat
    cv.paint(cv.mask(lambda d, s: d.ellipse([(cx - 15) * s, 11 * s, (cx + 15) * s, 17 * s], fill=255)), (138, 98, 58), depth=2, shine=0.2, seed=seed + 4)
    cv.paint(cv.mask(lambda d, s: d.polygon([((cx - 8) * s, 14 * s), ((cx + 8) * s, 14 * s), ((cx + 6) * s, 3 * s), ((cx - 5) * s, 2 * s)], fill=255)), (150, 108, 64), depth=3, shine=0.25, seed=seed + 5)
    cv.stroke(lambda d, s, wd: d.line([((cx - 8) * s, 12 * s), ((cx + 8) * s, 12 * s)], fill=255, width=wd), (196, 80, 60), 1.6)
    leaf(cv, cx + 6, 11, 7, -40, (226, 130, 52), seed=seed + 6)
    grass_tuft(cv, cx, 73, 7, seed=seed + 7)
    return cv.image()


def spooky_tree(seed=3):
    """A big bare twisty tree with a lantern on a branch. Returns (image, glow, lantern xy in final px)."""
    W, H = 150, 150
    cv = Canvas(W, H)
    rng = np.random.default_rng(seed)
    bark, bark_dark = (104, 80, 92), (78, 58, 72)
    base = (W / 2, H - 6)
    segs = []

    def branch(x, y, ang, length, width, depth):
        if depth == 0 or width < 0.8:
            return
        steps = 6
        pts = [(x, y)]
        a = ang
        for k in range(steps):
            a += rng.uniform(-0.18, 0.18)
            x += math.cos(a) * length / steps
            y -= math.sin(a) * length / steps
            pts.append((x, y))
        segs.append((pts, width))
        for turn in (-0.6, 0.55):
            if rng.random() < 0.9:
                branch(x, y, ang + turn + rng.uniform(-0.25, 0.25), length * 0.7, width * 0.62, depth - 1)

    def trunk(d, s):
        d.polygon([((base[0] - 12) * s, base[1] * s), ((base[0] + 12) * s, base[1] * s), ((base[0] + 6) * s, (base[1] - 60) * s), ((base[0] - 5) * s, (base[1] - 62) * s)], fill=255)
        d.polygon([((base[0] - 20) * s, base[1] * s), ((base[0] - 6) * s, (base[1] - 10) * s), ((base[0] - 4) * s, base[1] * s)], fill=255)
        d.polygon([((base[0] + 20) * s, base[1] * s), ((base[0] + 6) * s, (base[1] - 10) * s), ((base[0] + 4) * s, base[1] * s)], fill=255)

    top = (base[0], base[1] - 60)
    branch(*top, math.pi / 2 + 0.1, 36, 9, 4)
    branch(top[0] - 2, top[1] + 12, math.pi * 0.82, 30, 6, 3)
    branch(top[0] + 2, top[1] + 16, math.pi * 0.16, 30, 6, 3)

    def limbs(d, s):
        trunk(d, s)
        for pts, w in segs:
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                d.line([(x0 * s, y0 * s), (x1 * s, y1 * s)], fill=255, width=max(1, int(w * s)))
                d.ellipse([(x1 - w / 2) * s, (y1 - w / 2) * s, (x1 + w / 2) * s, (y1 + w / 2) * s], fill=255)
    cv.paint(cv.mask(limbs), bark, depth=5, shine=0.25, texture=0.1, seed=seed)
    # bark lines and a hollow
    for k in range(6):
        x = base[0] - 7 + k * 2.6
        cv.stroke(lambda d, s, wd, x=x: d.line([(x * s, (base[1] - 4) * s), ((x + rng.uniform(-2, 2)) * s, (base[1] - 40) * s)], fill=255, width=wd), bark_dark, 0.6)
    cv.paint(cv.mask(lambda d, s: d.ellipse([(base[0] - 4) * s, (base[1] - 34) * s, (base[0] + 3) * s, (base[1] - 24) * s], fill=255)), (40, 28, 36), depth=2, outline=False)
    moss_patch(cv, base[0], base[1] - 2, 34, 4, seed=seed + 1)
    # lantern hanging off the right branch
    rb = segs[-1][0][2] if segs else (base[0] + 20, top[1])
    lx, ly = rb[0], rb[1] + 12
    cv.stroke(lambda d, s, wd: d.line([(rb[0] * s, rb[1] * s), (lx * s, (ly - 5) * s)], fill=255, width=wd), (60, 50, 50), 0.6)
    cv.paint(cv.mask(lambda d, s: d.rounded_rectangle([(lx - 3.5) * s, (ly - 5) * s, (lx + 3.5) * s, (ly + 5) * s], radius=1.5 * s, fill=255)), (255, 196, 90), depth=2, shine=0.5, glow=1)
    cv.paint(cv.mask(lambda d, s: d.rectangle([(lx - 4) * s, (ly - 6.5) * s, (lx + 4) * s, (ly - 4.5) * s], fill=255)), (70, 58, 60), depth=1)
    img, glow = cv.image()
    return img, glow, (lx, ly)


def cobweb(size=30, seed=0):
    """A soft, slightly sagging web (anti-aliased, half-transparent)."""
    k = 4
    img = Image.new('RGBA', (size * 2 * k, size * 2 * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = (246, 244, 252, 150)
    cx = cy = size * k
    spokes = [i * math.tau / 7 + 0.2 for i in range(7)]
    for a in spokes:
        d.line([cx, cy, cx + math.cos(a) * size * k, cy + math.sin(a) * size * k], fill=c, width=k)
    for ring in (0.3, 0.55, 0.8):
        for a0, a1 in zip(spokes, spokes[1:] + spokes[:1]):
            p0 = (cx + math.cos(a0) * size * k * ring, cy + math.sin(a0) * size * k * ring)
            p1 = (cx + math.cos(a1) * size * k * ring, cy + math.sin(a1) * size * k * ring)
            mid = ((p0[0] + p1[0]) / 2 - (p0[0] + p1[0] - 2 * cx) * 0.06, (p0[1] + p1[1]) / 2 - (p0[1] + p1[1] - 2 * cy) * 0.06)
            d.line([p0, mid, p1], fill=c, width=k)
    return img.resize((size * 2, size * 2), Image.LANCZOS)


if __name__ == '__main__':
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else 'props-preview.png'
    items = [pumpkin(30), pumpkin(40, seed=5), jack(), gravestone(), gravestone(cross=True, seed=2), candle(), haystack(), leaf_pile(), boo_sign(), cauldron(), scarecrow(), spooky_tree()[:2], (cobweb(30), None)]
    sheet = Image.new('RGBA', (sum(i[0].width + 16 for i in items) + 16, 190), (226, 190, 110, 255))
    x = 16
    for img, _ in items:
        sheet.alpha_composite(img, (x, 180 - img.height))
        x += img.width + 16
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.LANCZOS).save(out)
