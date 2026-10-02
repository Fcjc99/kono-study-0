"""Draws KONO's wardrobe as pixel art that matches the sprite sheet: every outfit is painted on a
small grid (one cell = one of KONO's art pixels), given KONO's brown outline and a soft highlight,
then scaled up 4x with hard edges. It also measures where KONO's head is in every pose, so one
outfit image fits them all (public/garden/kono/outfits/fit.json).

It also draws the little treasures KONO finds during focus sessions (public/garden/finds), in the same
style.

Run: python3 tools/draw_kono_outfits.py  [--preview out.png] [--finds-preview out.png]"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
KONO = os.path.join(ROOT, 'public/garden/kono')
OUT_DIR = os.path.join(KONO, 'outfits')
U = 4                      # art pixel size in the sprites
LINE = (144, 72, 56, 255)  # KONO's outline brown

def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))

def outlined(img, color=LINE):
    """A one-pixel outline around everything drawn, like the sprites."""
    a = img.split()[3].point(lambda v: 255 if v > 0 else 0)
    ring = a.filter(ImageFilter.MaxFilter(3))
    out = blank(*img.size)
    out.paste(Image.new('RGBA', img.size, color), (0, 0), ring)
    out.alpha_composite(img)
    return out

def shade(img, light, dark, cut=0.45):
    """Highlight the upper-left of each shape and darken the lower-right, a pixel at a time."""
    w, h = img.size
    px = img.load()
    out = img.copy(); po = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0: continue
            above = y > 0 and px[x, y - 1][3] > 0
            left = x > 0 and px[x - 1, y][3] > 0
            below = y < h - 1 and px[x, y + 1][3] > 0
            right = x < w - 1 and px[x + 1, y][3] > 0
            if (not above or not left) and px[x, y][:3] in light: po[x, y] = light[px[x, y][:3]]
            elif (not below or not right) and px[x, y][:3] in dark: po[x, y] = dark[px[x, y][:3]]
    return out

def finish(img, light=None, dark=None):
    img = shade(img, light or {}, dark or {})
    img = outlined(img)
    return img.resize((img.width * U, img.height * U), Image.NEAREST)

def rgb(*c): return tuple(c) + (255,)

# --- The outfits. Each returns (image, fit): fit says how wide it sits on KONO's head (share of the
# head's width), how far it sinks into the fluffy top (share of its own height), and a sideways nudge.

def beanie():
    R, R2, RD, C, P = rgb(222, 86, 86), rgb(240, 128, 120), rgb(178, 58, 62), rgb(196, 62, 66), rgb(250, 244, 236)
    im = blank(36, 26); d = ImageDraw.Draw(im)
    d.ellipse((3, 6, 32, 32), fill=R)
    d.rectangle((0, 18, 35, 25), fill=C)
    for x in range(1, 35, 3): d.line((x, 19, x, 24), fill=RD)
    d.ellipse((13, 0, 22, 8), fill=P)
    d.point([(15, 2), (16, 2), (15, 3)], fill=rgb(255, 255, 255))
    im = im.crop((0, 0, 36, 26))
    return finish(im, {R[:3]: R2, P[:3]: rgb(255, 255, 255)}, {R[:3]: RD, P[:3]: rgb(226, 214, 204)}), {'width': 0.62, 'sink': 0.48}

def sunhat():
    S, S2, SD, B = rgb(238, 200, 122), rgb(250, 224, 160), rgb(206, 160, 86), rgb(240, 120, 150)
    im = blank(50, 22); d = ImageDraw.Draw(im)
    d.ellipse((0, 12, 49, 21), fill=S)
    d.ellipse((12, 0, 37, 20), fill=S)
    d.rectangle((12, 11, 37, 14), fill=B)
    d.polygon([(36, 12), (42, 9), (42, 16)], fill=B)
    for x in range(3, 47, 4): d.point((x, 17), fill=SD)
    return finish(im, {S[:3]: S2}, {S[:3]: SD}), {'width': 0.86, 'sink': 0.38}

def gradcap():
    N, N2, ND, G = rgb(56, 64, 104), rgb(86, 96, 146), rgb(36, 40, 70), rgb(246, 196, 72)
    im = blank(44, 24); d = ImageDraw.Draw(im)
    d.rectangle((11, 9, 32, 17), fill=ND)
    d.polygon([(22, 0), (43, 6), (22, 12), (1, 6)], fill=N)
    d.line((22, 6, 37, 9), fill=G); d.line((37, 9, 37, 18), fill=G)
    d.rectangle((36, 18, 38, 22), fill=G)
    d.point((22, 6), fill=rgb(255, 230, 140))
    return finish(im, {N[:3]: N2}, {N[:3]: ND}), {'width': 0.70, 'sink': 0.4}

def flowercrown():
    L, L2 = rgb(110, 176, 92), rgb(150, 206, 120)
    im = blank(46, 14); d = ImageDraw.Draw(im)
    d.arc((2, 4, 43, 30), 200, 340, fill=L, width=2)
    colors = [rgb(244, 140, 170), rgb(252, 218, 96), rgb(250, 250, 250), rgb(186, 150, 236), rgb(244, 140, 170)]
    xs = [5, 13, 22, 31, 39]; ys = [8, 4, 2, 4, 8]
    for x, y, c in zip(xs, ys, colors):
        for dx, dy in ((0, -2), (-2, 0), (2, 0), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1)): d.point((x + dx, y + dy), fill=c)
        d.point((x, y), fill=rgb(250, 190, 70))
    for x, y in ((9, 7), (18, 4), (27, 4), (35, 7)): d.ellipse((x - 1, y - 1, x + 1, y), fill=L)
    return finish(im, {L[:3]: L2}, {}), {'width': 0.80, 'sink': 0.55}

def wizard():
    P, P2, PD, Y = rgb(122, 92, 206), rgb(156, 128, 232), rgb(88, 62, 160), rgb(252, 214, 90)
    im = blank(40, 36); d = ImageDraw.Draw(im)
    d.polygon([(8, 30), (32, 30), (24, 6), (30, 0), (20, 4)], fill=P)
    d.ellipse((0, 27, 39, 35), fill=P)
    for x, y in ((16, 20), (24, 14), (21, 26)):
        d.point([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=Y)
    return finish(im, {P[:3]: P2}, {P[:3]: PD}), {'width': 0.70, 'sink': 0.22}

def crown():
    G, G2, GD = rgb(248, 196, 64), rgb(255, 230, 130), rgb(214, 152, 40)
    im = blank(30, 18); d = ImageDraw.Draw(im)
    d.polygon([(0, 17), (0, 4), (7, 10), (15, 0), (22, 10), (29, 4), (29, 17)], fill=G)
    d.rectangle((0, 13, 29, 17), fill=GD)
    for x, c in ((6, rgb(90, 160, 240)), (15, rgb(232, 70, 90)), (23, rgb(90, 200, 130))): d.rectangle((x - 1, 14, x + 1, 16), fill=c)
    for x, y in ((0, 3), (15, -1), (29, 3)): d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=G2)
    return finish(im, {G[:3]: G2}, {G[:3]: GD}), {'width': 0.50, 'sink': 0.4}

def bow():
    P, P2, PD = rgb(244, 120, 158), rgb(252, 168, 192), rgb(206, 80, 120)
    im = blank(28, 16); d = ImageDraw.Draw(im)
    d.polygon([(13, 7), (1, 0), (0, 15)], fill=P)
    d.polygon([(14, 7), (26, 0), (27, 15)], fill=P)
    d.ellipse((10, 4, 17, 11), fill=PD)
    d.line((4, 4, 9, 7), fill=P2); d.line((23, 4, 18, 7), fill=P2)
    return finish(im, {P[:3]: P2}, {P[:3]: PD}), {'width': 0.46, 'sink': 0.45, 'nudge': 0.26}

def chef():
    W, W2, WD = rgb(252, 250, 244), rgb(255, 255, 255), rgb(220, 214, 204)
    im = blank(34, 30); d = ImageDraw.Draw(im)
    for box in ((0, 6, 14, 20), (9, 0, 25, 16), (20, 6, 33, 20), (5, 4, 18, 16), (16, 4, 29, 16)): d.ellipse(box, fill=W)
    d.rectangle((5, 14, 28, 29), fill=W)
    for x in (11, 17, 23): d.line((x, 18, x, 27), fill=WD)
    return finish(im, {W[:3]: W2}, {W[:3]: WD}), {'width': 0.56, 'sink': 0.3}

def witch():
    K, K2, KD, V, B = rgb(58, 46, 70), rgb(92, 76, 110), rgb(36, 28, 46), rgb(150, 92, 200), rgb(250, 206, 90)
    im = blank(44, 36); d = ImageDraw.Draw(im)
    d.polygon([(11, 29), (33, 29), (26, 10), (32, 3), (36, 6), (30, 0), (21, 5)], fill=K)
    d.ellipse((0, 26, 43, 35), fill=K)
    d.rectangle((12, 24, 32, 28), fill=V)
    d.rectangle((19, 23, 25, 29), fill=B); d.rectangle((21, 25, 23, 27), fill=V)
    return finish(im, {K[:3]: K2}, {K[:3]: KD}), {'width': 0.8, 'sink': 0.22}

OUTFITS = {'beanie': beanie, 'sunhat': sunhat, 'gradcap': gradcap, 'flowers': flowercrown, 'wizard': wizard, 'crown': crown, 'bow': bow, 'chef': chef, 'witch': witch}

# --- KONO's finds (focus sessions): 16x16-cell treasures with the same outline and shading.
FIND_DIR = os.path.join(ROOT, 'public/garden/finds')

def icon(draw, light=None, dark=None, size=18):
    im = blank(size, size); draw(ImageDraw.Draw(im), im)
    return finish(im, light, dark)

def pebble():
    G, G2, GD = rgb(164, 160, 170), rgb(196, 192, 200), rgb(124, 120, 132)
    return icon(lambda d, im: (d.ellipse((2, 6, 15, 15), fill=G), d.point([(6, 9), (11, 12)], fill=GD)), {G[:3]: G2}, {G[:3]: GD})
def acorn(cap=(132, 88, 52), nut=(196, 132, 72), shine=(230, 176, 110)):
    C, N = rgb(*cap), rgb(*nut)
    def draw(d, im):
        d.ellipse((4, 7, 13, 17), fill=N)
        d.ellipse((2, 4, 15, 10), fill=C)
        d.rectangle((8, 1, 9, 4), fill=C)
        for x in range(4, 14, 2): d.point((x, 7), fill=tuple(max(0, c - 30) for c in cap) + (255,))
    return icon(draw, {N[:3]: rgb(*shine)}, {N[:3]: tuple(max(0, c - 40) for c in nut) + (255,)})
def leaf():
    O, O2, OD = rgb(232, 120, 52), rgb(248, 166, 80), rgb(192, 82, 36)
    def draw(d, im):
        d.polygon([(8, 0), (10, 4), (15, 3), (13, 8), (17, 10), (12, 12), (9, 16), (6, 12), (1, 10), (5, 8), (3, 3), (7, 4)], fill=O)
        d.line((9, 6, 9, 17), fill=OD)
    return icon(draw, {O[:3]: O2}, {O[:3]: OD})
def feather():
    W, W2, B = rgb(236, 232, 246), rgb(255, 255, 255), rgb(150, 170, 220)
    def draw(d, im):
        d.ellipse((5, 1, 12, 15), fill=W)
        d.line((8, 3, 9, 17), fill=B)
        for y in (5, 8, 11): d.point([(6, y), (11, y + 1)], fill=B)
    return icon(draw, {W[:3]: W2}, {})
def shell():
    P, P2, PD = rgb(246, 176, 170), rgb(255, 214, 206), rgb(214, 126, 128)
    def draw(d, im):
        d.pieslice((1, 3, 16, 18), 180, 360, fill=P)
        d.rectangle((6, 10, 11, 14), fill=P)
        for x in (4, 7, 10, 13): d.line((8, 12, x, 5), fill=PD)
    return icon(draw, {P[:3]: P2}, {P[:3]: PD})
def clover():
    G, G2, GD = rgb(96, 180, 96), rgb(140, 214, 120), rgb(60, 136, 70)
    def draw(d, im):
        for box in ((3, 2, 9, 8), (9, 2, 15, 8), (3, 8, 9, 14), (9, 8, 15, 14)): d.ellipse(box, fill=G)
        d.line((9, 12, 12, 17), fill=GD)
    return icon(draw, {G[:3]: G2}, {G[:3]: GD})
def pinecone():
    B, B2, BD = rgb(150, 98, 58), rgb(186, 132, 82), rgb(112, 70, 40)
    def draw(d, im):
        d.ellipse((4, 2, 13, 17), fill=B)
        for y in range(4, 16, 3):
            for x in range(5, 13, 3): d.point([(x, y), (x + 1, y + 1)], fill=BD)
        d.rectangle((8, 0, 9, 2), fill=rgb(90, 140, 70))
    return icon(draw, {B[:3]: B2}, {B[:3]: BD})
def seaglass():
    T, T2, TD = rgb(120, 206, 196), rgb(186, 238, 230), rgb(76, 160, 158)
    return icon(lambda d, im: (d.polygon([(3, 6), (9, 2), (15, 5), (14, 13), (7, 16), (2, 12)], fill=T), d.point([(6, 6), (7, 5)], fill=rgb(240, 255, 252))), {T[:3]: T2}, {T[:3]: TD})
def mushroom():
    R, R2, RD, S = rgb(222, 74, 74), rgb(244, 120, 110), rgb(176, 48, 56), rgb(246, 236, 220)
    def draw(d, im):
        d.rectangle((6, 9, 11, 16), fill=S)
        d.pieslice((1, 1, 16, 16), 180, 360, fill=R)
        for x, y in ((5, 5), (11, 4), (8, 7)): d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=rgb(255, 250, 240))
    return icon(draw, {R[:3]: R2}, {R[:3]: RD})
def crystal():
    V, V2, VD = rgb(170, 130, 236), rgb(214, 190, 255), rgb(120, 84, 192)
    def draw(d, im):
        d.polygon([(8, 0), (13, 5), (12, 15), (5, 15), (3, 5)], fill=V)
        d.polygon([(13, 7), (16, 10), (15, 16), (12, 16)], fill=V)
        d.line((8, 1, 8, 14), fill=V2)
    return icon(draw, {V[:3]: V2}, {V[:3]: VD})
def golden_acorn(): return acorn(cap=(214, 160, 50), nut=(248, 204, 74), shine=(255, 240, 160))
def star():
    Y, Y2, YD = rgb(252, 212, 72), rgb(255, 240, 150), rgb(220, 164, 40)
    pts = []
    import math
    for i in range(10):
        r = 8 if i % 2 == 0 else 3.6; a = -math.pi / 2 + i * math.pi / 5
        pts.append((8.5 + r * math.cos(a), 9 + r * math.sin(a)))
    return icon(lambda d, im: d.polygon(pts, fill=Y), {Y[:3]: Y2}, {Y[:3]: YD})
def pumpkin():
    O, O2, OD, G = rgb(240, 132, 40), rgb(252, 176, 80), rgb(200, 96, 30), rgb(96, 140, 60)
    def draw(d, im):
        d.ellipse((1, 5, 10, 16), fill=O); d.ellipse((7, 5, 16, 16), fill=O); d.ellipse((4, 4, 13, 17), fill=O)
        d.line((8, 6, 8, 15), fill=OD)
        d.rectangle((8, 1, 9, 4), fill=G)
    return icon(draw, {O[:3]: O2}, {O[:3]: OD})

FINDS = {'pebble': pebble, 'acorn': acorn, 'leaf': leaf, 'feather': feather, 'shell': shell, 'clover': clover,
         'pinecone': pinecone, 'seaglass': seaglass, 'mushroom': mushroom, 'crystal': crystal,
         'golden-acorn': golden_acorn, 'star': star, 'pumpkin': pumpkin}

# --- Costumes that wrap around KONO's shape (a ghost sheet, Frankenstein's hair and bolts) are drawn
# for each pose from that pose's own silhouette, at full pose size.
def fur_mask(img):
    px = img.load(); w, h = img.size
    return [[px[x, y][3] > 128 and px[x, y][0] > 200 and px[x, y][1] > 170 and px[x, y][2] > 120 and px[x, y][0] - px[x, y][2] < 120 for x in range(w)] for y in range(h)]

def grid(img):
    """The pose on KONO's art-pixel grid: fur cells, eye cells (big dark blobs) and the head's rows."""
    w, h = img.size; gw, gh = w // U, h // U
    small = img.resize((gw, gh), Image.BOX); sp = small.load()
    fur = [[sp[x, y][3] > 150 and sp[x, y][0] > 190 and sp[x, y][1] > 150 and sp[x, y][2] > 100 and sp[x, y][0] - sp[x, y][2] < 130 for x in range(gw)] for y in range(gh)]
    dark = [[sp[x, y][3] > 150 and max(sp[x, y][:3]) < 70 for x in range(gw)] for y in range(gh)]
    rows = [y for y in range(gh) if any(fur[y])]
    return small, fur, dark, rows

def eye_cells(dark, fur, rows):
    """Dark blobs at least 2x2 cells (eyes), not the thin mouth line."""
    gh, gw = len(dark), len(dark[0]); seen = set(); eyes = set()
    for y in range(gh):
        for x in range(gw):
            if not dark[y][x] or (x, y) in seen: continue
            stack, comp = [(x, y)], []
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop(); comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < gw and 0 <= ny < gh and dark[ny][nx] and (nx, ny) not in seen: seen.add((nx, ny)); stack.append((nx, ny))
            xs = [c[0] for c in comp]; ys = [c[1] for c in comp]
            if max(xs) - min(xs) >= 2 and max(ys) - min(ys) >= 2 and len(comp) >= 6: eyes.update(comp)
    return eyes

class Shifted:
    """Pixel access on a padded canvas using the pose's own grid coordinates."""
    def __init__(self, im): self.px = im.load(); self.w, self.h = im.size
    def __setitem__(self, xy, c):
        x, y = xy[0] + PAD, xy[1] + PAD
        if 0 <= x < self.w and 0 <= y < self.h: self.px[x, y] = c

def ghost_for(img):
    small, fur, dark, rows = grid(img)
    gw, gh = small.size; top, bottom = rows[0], rows[-1]
    cut = top + int((bottom - top) * 0.80)
    eyes = eye_cells(dark, fur, rows)
    W, W2, WD = rgb(246, 246, 252), rgb(255, 255, 255), rgb(210, 212, 230)
    im = blank(gw + 2 * PAD, gh + 2 * PAD); p = Shifted(im)
    # A smooth sheet: each side's edge follows KONO's outline, averaged so the fluffy spikes don't show.
    spans = {}
    for y in range(top, cut + 1):
        xs = [x for x in range(gw) if fur[y][x]]
        if xs: spans[y] = (min(xs) - 1, max(xs) + 1)
    ys = sorted(spans)
    def smooth(i, side):
        win = [spans[ys[j]][side] for j in range(max(0, i - 3), min(len(ys), i + 4))]
        return round(sum(win) / len(win))
    rows = {y: (smooth(i, 0), smooth(i, 1)) for i, y in enumerate(ys)}
    # Cover the fluffy top with a smooth round dome, starting a couple of cells above it.
    import math
    l0, r0 = rows[ys[min(8, len(ys) - 1)]]; mid = (l0 + r0) / 2
    half = max((r - l) / 2 for y, (l, r) in rows.items() if y <= top + 16) * 0.97
    cy, R = top + 9, 12
    for y in range(top - 3, top + 10):
        t = (cy - y) / R
        if abs(t) >= 1: continue
        hw = half * math.sqrt(1 - t * t)
        dl, dr = round(mid - hw), round(mid + hw)
        l, r = rows.get(y, (dl, dr))
        rows[y] = (dl, dr) if y < top + 4 else (min(l, dl), max(r, dr))
    # Below the dome the sheet hangs straight down (wider where KONO is wider).
    for y in list(rows):
        if y >= cy:
            l, r = rows[y]; rows[y] = (min(l, round(mid - half)), max(r, round(mid + half)))
    hem = [0, 0, 1, 2, 3, 3, 2, 1]  # big rounded waves along the bottom
    for y, (l, r) in sorted(rows.items()):
        for x in range(l, r + 1):
            if cut - y < hem[(x - l) % 8]: continue
            if (x, y) in eyes: continue
            p[x, y] = W
    out = shade(im, {W[:3]: W2}, {W[:3]: WD})
    out = outlined(out, rgb(120, 112, 150))
    # Eye holes: KONO's own eyes show through (the outline above draws their rims too).
    return out.resize((out.width * U, out.height * U), Image.NEAREST)

def frankenstein_for(img):
    small, fur, dark, rows = grid(img)
    gw, gh = small.size; top, bottom = rows[0], rows[-1]
    H, H2, HD, G, GD = rgb(48, 70, 54), rgb(72, 100, 76), rgb(32, 48, 38), rgb(168, 176, 186), rgb(116, 124, 136)
    im = blank(gw + 2 * PAD, gh + 2 * PAD); p = Shifted(im)
    fringe = top + max(4, int((bottom - top) * 0.20))
    head = [x for x in range(gw) if fur[fringe][x]]
    l, r = min(head) - 1, max(head) + 1
    # A square flat-top haircut over the whole head: hair strands, and a deep jagged fringe.
    zig = [0, 1, 2, 3, 2, 1]
    for x in range(l, r + 1):
        end = fringe + 1 - zig[(x - l) % 6]
        for y in range(top - 1, end + 1):
            p[x, y] = HD if (x - l) % 3 == 0 and top + 1 < y < end - 1 else H
    # Bolts on both sides, a little below the middle of the head.
    by = top + int((bottom - top) * 0.42)
    row = [x for x in range(gw) if fur[by][x]]
    if row:
        for bx, side in ((min(row), -1), (max(row), 1)):
            for i in range(3): p[bx + side * (i + 1), by] = G; p[bx + side * (i + 1), by + 1] = GD
            for dy in (-1, 0, 1, 2): p[bx + side * 4, by + dy] = G
    out = shade(im, {H[:3]: H2}, {})
    out = outlined(out)
    return out.resize((out.width * U, out.height * U), Image.NEAREST)

PAD = 6  # cells of room around a pose for bolts and the sheet's outline

POSE_COSTUMES = {'ghost': ghost_for, 'frankenstein': frankenstein_for}

# --- Where KONO's head is in each pose: the top of the fur and the width of the round body there.
def head_of(path):
    im = Image.open(path).convert('RGBA'); px = im.load(); w, h = im.size
    fur = lambda p: p[3] > 128 and p[0] > 200 and p[1] > 170 and p[2] > 120 and p[0] - p[2] < 120
    cols = [x for x in range(w) if any(fur(px[x, y]) for y in range(h))]
    tops = {x: next(y for y in range(h) if fur(px[x, y])) for x in cols}
    top = min(tops.values())
    # The head's width: the widest run of fur in the top 40% (below that come arms, books, cups).
    bottom = max(y for x in cols for y in range(h) if fur(px[x, y]))
    spans = []
    for y in range(top, top + max(8, int((bottom - top) * 0.4))):
        row = [x for x in range(w) if fur(px[x, y])]
        if row: spans.append((max(row) - min(row), min(row), max(row)))
    _, left, right = max(spans)
    near = [x for x, t in tops.items() if t <= top + 6 and left <= x <= right] or [(left + right) // 2]
    return {'x': round(sum(near) / len(near) / w, 4), 'y': round(top / h, 4), 'w': round((right - left) / w, 4), 'size': [w, h]}

TS = os.path.join(ROOT, 'src/game/data/konoOutfits.ts')

def write_ts(heads, fits):
    """The measurements the app needs, so the island and the KONO card place outfits the same way."""
    head_rows = ',\n'.join(f"  '{k}': {{x: {v['x']}, y: {v['y']}, w: {v['w']}, size: [{v['size'][0]}, {v['size'][1]}]}}" for k, v in sorted(heads.items()))
    def fit_row(k, v):
        if v.get('full'): return f"  {k}: {{px: [0, 0], sink: 0, nudge: 0, full: true, skip: {json.dumps(v.get('skip', []))}}}"
        return f"  {k}: {{px: [{v['px'][0]}, {v['px'][1]}], sink: {v['sink']}, nudge: {v.get('nudge', 0)}}}"
    fit_rows = ',\n'.join(fit_row(k, v) for k, v in fits.items())
    open(TS, 'w').write(f"""// Generated by tools/draw_kono_outfits.py from the KONO sprites; don't edit by hand. Re-run the script after
// changing a pose or an outfit.
export type OutfitFit={{px:[number,number];sink:number;nudge:number;full?:boolean;skip?:string[]}}
export type PoseHead={{x:number;y:number;w:number;size:[number,number]}}
/** Where KONO's head is in each pose (shares of the image): top centre, and the head's width. */
export const POSE_HEADS:Record<string,PoseHead>={{
{head_rows},
}}
/** Each outfit's size in sprite pixels (drawn at KONO's own pixel size), how far it sinks into the fluffy
 * top (share of its height) and any sideways nudge (share of the head's width). */
export const OUTFIT_FITS:Record<string,OutfitFit>={{
{fit_rows},
}}
/** Costumes drawn for each pose (a ghost sheet, Frankenstein's hair) have {PAD * U}px of room all round. */
export const COSTUME_PAD={PAD * U}
/** Poses where KONO isn't wearing an outfit: asleep, and fishing (that pose has its own straw hat). */
export const NO_OUTFIT_POSES=new Set(['sleep','fishing'])
/** The outfit's box on a pose, in that pose's pixels (same maths as the drawing script's preview). */
export function outfitBox(pose:string,outfit:string):{{x:number;y:number;w:number;h:number}}|null{{
 const head=POSE_HEADS[pose],fit=OUTFIT_FITS[outfit]
 if(!head||!fit||NO_OUTFIT_POSES.has(pose)||fit.skip?.includes(pose))return null
 const [w,h]=head.size,[ow,oh]=fit.px
 if(fit.full)return {{x:-COSTUME_PAD,y:-COSTUME_PAD,w:w+2*COSTUME_PAD,h:h+2*COSTUME_PAD}}
 const cx=head.x*w+fit.nudge*head.w*w
 const y=head.y*h+0.10*head.w*w-oh*(1-fit.sink)
 return {{x:cx-ow/2,y,w:ow,h:oh}}
}}
/** The image for an outfit on a pose: one drawing for hats, one per pose for costumes. */
export const outfitSrcFor=(outfit:string,pose:string)=>'/garden/kono/outfits/'+(OUTFIT_FITS[outfit]?.full?outfit+'/'+pose:outfit)+'.webp'
""")

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = json.load(open(os.path.join(KONO, 'manifest.json')))
    heads = {name: head_of(os.path.join(KONO, meta['file'])) for name, meta in manifest.items() if name != 'shadow'}
    fits = {}
    for oid, fn in OUTFITS.items():
        img, fit = fn()
        img.save(os.path.join(OUT_DIR, oid + '.webp'), lossless=True)
        fits[oid] = {**{k: v for k, v in fit.items() if k != 'width'}, 'px': [img.width, img.height]}
    for cid, fn in POSE_COSTUMES.items():
        os.makedirs(os.path.join(OUT_DIR, cid), exist_ok=True)
        for name, meta in manifest.items():
            if name in ('shadow', 'sleep', 'fishing', 'pond'): continue
            pose = Image.open(os.path.join(KONO, meta['file'])).convert('RGBA')
            costume = fn(pose)  # the pose's size plus PAD cells all round
            costume.save(os.path.join(OUT_DIR, cid, name + '.webp'), lossless=True)
        fits[cid] = {'full': True, 'sink': 0, 'px': [0, 0], 'skip': ['pond']}
    write_ts(heads, fits)
    os.makedirs(FIND_DIR, exist_ok=True)
    for fid, fn in FINDS.items(): fn().save(os.path.join(FIND_DIR, fid + '.webp'), lossless=True)
    # The build only ships files listed in tools/public-allowlist.json: keep the outfit art listed.
    allow_path = os.path.join(ROOT, 'tools/public-allowlist.json')
    allow = [p for p in json.load(open(allow_path)) if not p.startswith(('/garden/kono/outfits/', '/garden/finds/'))]
    art = sorted('/' + os.path.relpath(os.path.join(d, f), os.path.join(ROOT, 'public')).replace(os.sep, '/') for base in (OUT_DIR, FIND_DIR) for d, _, fs in os.walk(base) for f in fs if f.endswith('.webp'))
    at = max((i for i, p in enumerate(allow) if p.startswith('/garden/kono/')), default=len(allow) - 1) + 1
    allow = allow[:at] + art + allow[at:]
    json.dump(allow, open(allow_path, 'w'), indent=1); open(allow_path, 'a').write('\n')
    if '--finds-preview' in sys.argv:
        out = sys.argv[sys.argv.index('--finds-preview') + 1]
        sheet = Image.new('RGBA', (100 * len(FINDS), 120), (250, 244, 236, 255))
        for i, fid in enumerate(FINDS):
            im = Image.open(os.path.join(FIND_DIR, fid + '.webp')); sheet.alpha_composite(im, (i * 100 + (100 - im.width) // 2, (120 - im.height) // 2))
        sheet.save(out)
    if '--preview' in sys.argv:
        preview(sys.argv[sys.argv.index('--preview') + 1], heads, fits)

REF_HEAD = None  # idle head width in px: outfits are drawn for it, so most poses use them 1:1

def placement(head, fit, size, ref=None):
    """Where an outfit goes on a pose (in that pose's pixels): its box and scale."""
    w, h = size
    # Every sprite is drawn at the same art scale, so outfits are never resized: pixel-true everywhere.
    scale = 1
    ow, oh = fit['px'][0] * scale, fit['px'][1] * scale
    cx = head['x'] * w + fit.get('nudge', 0) * head['w'] * w
    # Sit on the head: the fluffy tips are about a tenth of the head deep, then the outfit's own sink.
    y = head['y'] * h + 0.10 * head['w'] * w - oh * (1 - fit['sink'])
    return cx - ow / 2, y, ow, oh

def wear(pose_path, head, oid, fit, ref=None):
    base = Image.open(pose_path).convert('RGBA'); w, h = base.size
    if fit.get('full'):
        pose = os.path.splitext(os.path.basename(pose_path))[0]
        if pose in fit.get('skip', []): return base
        layer = Image.open(os.path.join(OUT_DIR, oid, pose + '.webp')).convert('RGBA')
        m = PAD * U
        out = blank(w + 2 * m, h + 2 * m); out.alpha_composite(base, (m, m)); out.alpha_composite(layer, (0, 0)); return out
    x, y, ow, oh = placement(head, fit, (w, h), ref)
    hat = Image.open(os.path.join(OUT_DIR, oid + '.webp')).resize((max(1, round(ow)), max(1, round(oh))), Image.NEAREST)
    pad = max(0, -int(y)) + 4
    canvas = blank(w, h + pad); canvas.alpha_composite(base, (0, pad))
    canvas.alpha_composite(hat, (int(x), int(y) + pad))
    return canvas

def preview(path, heads, fits):
    poses = ['idle', 'excited', 'walk-right-01', 'walk-up-01', 'read', 'tea', 'pond']
    cell = 280
    sheet = Image.new('RGBA', (cell * len(poses), cell * len(fits)), (250, 244, 236, 255))
    for r, oid in enumerate(fits):
        for c, pose in enumerate(poses):
            img = wear(os.path.join(KONO, pose + '.png'), heads[pose], oid, fits[oid])
            img.thumbnail((cell - 10, cell - 10), Image.NEAREST)
            sheet.alpha_composite(img, (c * cell + (cell - img.width) // 2, r * cell + (cell - img.height) // 2))
    sheet.save(path)

if __name__ == '__main__':
    main()
