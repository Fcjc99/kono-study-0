"""Draws KONO's wardrobe as pixel art that matches the sprite sheet: every outfit is painted on a
small grid (one cell = one of KONO's art pixels), given KONO's brown outline and a soft highlight,
then scaled up 4x with hard edges. It also measures where KONO's head is in every pose, so one
outfit image fits them all (public/garden/kono/outfits/fit.json).

It also draws the little treasures KONO finds during focus sessions (public/garden/finds), in the same
style.

It draws KONO's friends (public/garden/friends), the stamp-card presents (public/garden/presents) and the
bond hearts' friendship gifts (public/garden/gifts) too.

Run: python3 tools/draw_kono_outfits.py  [--preview out.png] [--finds-preview out.png] [--friends-preview out.png] [--presents-preview out.png] [--gifts-preview out.png]"""
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

def headband():
    """Exam day: a study headband (worn by itself on test days, not in the wardrobe)."""
    W, W2, WD, R, R2 = rgb(250, 248, 242), rgb(255, 255, 255), rgb(214, 208, 198), rgb(226, 70, 84), rgb(250, 120, 130)
    im = blank(46, 16); d = ImageDraw.Draw(im)
    d.rectangle((1, 4, 38, 10), fill=W)
    for x in range(3, 38, 5): d.point((x, 9), fill=WD)
    # a little red heart on the front
    d.rectangle((17, 5, 18, 6), fill=R); d.rectangle((21, 5, 22, 6), fill=R); d.rectangle((17, 6, 22, 7), fill=R); d.rectangle((18, 8, 21, 8), fill=R); d.point((19, 9), fill=R); d.point((20, 9), fill=R)
    # the knot and two tails flying off the side
    d.ellipse((36, 3, 41, 10), fill=W)
    d.polygon([(40, 6), (45, 1), (45, 4), (41, 8)], fill=W)
    d.polygon([(40, 8), (45, 12), (43, 14), (39, 10)], fill=W)
    return finish(im, {W[:3]: W2, R[:3]: R2}, {W[:3]: WD}), {'width': 0.8, 'sink': 0.62}

def earmuffs():
    """Winter: fluffy earmuffs on a band over the top of the head."""
    B, B2, BD, F, F2, FD = rgb(120, 150, 210), rgb(160, 186, 236), rgb(84, 110, 170), rgb(250, 246, 250), rgb(255, 255, 255), rgb(214, 206, 222)
    im = blank(46, 22); d = ImageDraw.Draw(im)
    d.arc((6, 1, 39, 30), 200, 340, fill=B, width=3)
    for x0 in (0, 33):
        d.ellipse((x0, 8, x0 + 12, 21), fill=F)
        for k in range(4): d.point((x0 + 3 + k * 2, 11 + (k % 2) * 4), fill=FD)
    return finish(im, {F[:3]: F2, B[:3]: B2}, {F[:3]: FD, B[:3]: BD}), {'width': 0.98, 'sink': 0.62}

def heartband():
    """Valentine's week: a headband with two hearts bobbing on springs."""
    K, K2, KD, P, P2, PD = rgb(232, 90, 130), rgb(250, 140, 170), rgb(190, 60, 100), rgb(244, 84, 120), rgb(255, 150, 176), rgb(200, 50, 86)
    im = blank(40, 26); d = ImageDraw.Draw(im)
    d.arc((2, 15, 37, 40), 200, 340, fill=K, width=3)
    for cx, top in ((11, 0), (28, 1)):
        # spring
        for y in range(top + 8, 18, 2): d.point((cx + (1 if (y // 2) % 2 else -1), y), fill=rgb(150, 150, 170))
        # heart
        d.ellipse((cx - 5, top, cx, top + 5), fill=P); d.ellipse((cx, top, cx + 5, top + 5), fill=P)
        d.polygon([(cx - 5, top + 3), (cx + 5, top + 3), (cx, top + 9)], fill=P)
    return finish(im, {K[:3]: K2, P[:3]: P2}, {K[:3]: KD, P[:3]: PD}), {'width': 0.72, 'sink': 0.42}

OUTFITS = {'headband': headband, 'beanie': beanie, 'sunhat': sunhat, 'gradcap': gradcap, 'flowers': flowercrown, 'wizard': wizard, 'crown': crown, 'bow': bow, 'chef': chef, 'witch': witch, 'earmuffs': earmuffs, 'heartband': heartband}

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

def snowflake():
    B, B2, BD = rgb(150, 200, 246), rgb(226, 244, 255), rgb(100, 150, 214)
    def draw(d, im):
        c = 8
        for dx, dy in ((0, -7), (0, 7), (-6, -4), (6, 4), (-6, 4), (6, -4)):
            d.line((c + 1, c + 1, c + 1 + dx, c + 1 + dy), fill=B, width=2)
            mx, my = c + 1 + dx * 0.6, c + 1 + dy * 0.6
            d.point([(round(mx - dy * 0.25), round(my + dx * 0.25)), (round(mx + dy * 0.25), round(my - dx * 0.25))], fill=B)
        d.ellipse((c - 1, c - 1, c + 3, c + 3), fill=B2)
    return icon(draw, {B[:3]: B2}, {B[:3]: BD})
def candy_heart():
    P, P2, PD = rgb(250, 168, 196), rgb(255, 210, 226), rgb(220, 120, 160)
    def draw(d, im):
        d.ellipse((1, 3, 9, 11), fill=P); d.ellipse((8, 3, 16, 11), fill=P)
        d.polygon([(1, 8), (16, 8), (8.5, 16)], fill=P)
        d.line((5, 9, 12, 9), fill=rgb(214, 70, 110)); d.line((6, 11, 11, 11), fill=rgb(214, 70, 110))
    return icon(draw, {P[:3]: P2}, {P[:3]: PD})

FINDS = {'pebble': pebble, 'acorn': acorn, 'leaf': leaf, 'feather': feather, 'shell': shell, 'clover': clover,
         'pinecone': pinecone, 'seaglass': seaglass, 'mushroom': mushroom, 'crystal': crystal,
         'golden-acorn': golden_acorn, 'star': star, 'pumpkin': pumpkin, 'snowflake': snowflake, 'candy-heart': candy_heart}

# --- KONO's friends (island visitors after a good week): 30x26-cell animals, same outline and shading.
FRIEND_DIR = os.path.join(ROOT, 'public/garden/friends')

def friend(draw, light=None, dark=None):
    im = blank(30, 26); draw(ImageDraw.Draw(im), im)
    return finish(im, light, dark)

def eyes(d, *pts, c=(40, 28, 30)):
    for x, y in pts: d.rectangle((x, y, x + 1, y + 1), fill=rgb(*c)); d.point((x, y), fill=rgb(255, 255, 255))

def cat():
    O, O2, OD, C, P = rgb(240, 160, 80), rgb(252, 196, 120), rgb(204, 120, 52), rgb(252, 236, 210), rgb(240, 140, 150)
    def draw(d, im):
        d.ellipse((7, 11, 22, 25), fill=O)                      # body
        d.line((21, 22, 27, 18), fill=O, width=2); d.line((27, 18, 27, 12), fill=O, width=2)  # tail
        d.ellipse((6, 3, 21, 16), fill=O)                       # head
        d.polygon([(7, 7), (8, 0), (12, 4)], fill=O); d.polygon([(20, 7), (19, 0), (15, 4)], fill=O)
        d.point([(8, 3), (19, 3)], fill=P)
        d.ellipse((10, 15, 17, 24), fill=C)                     # chest
        for x in (9, 12, 15, 18): d.line((x, 4, x, 6), fill=OD)
        eyes(d, (9, 9), (16, 9)); d.point((13, 12), fill=P); d.point((14, 12), fill=P)
    return friend(draw, {O[:3]: O2}, {O[:3]: OD})

def duck():
    W, W2, WD, B, Bd = rgb(252, 248, 236), rgb(255, 255, 255), rgb(214, 206, 190), rgb(248, 160, 50), rgb(214, 120, 30)
    def draw(d, im):
        d.ellipse((4, 12, 26, 25), fill=W)                      # body
        d.polygon([(24, 14), (29, 11), (26, 18)], fill=W)       # tail
        d.ellipse((5, 2, 17, 14), fill=W)                       # head
        d.polygon([(0, 8), (6, 7), (6, 11), (1, 10)], fill=B); d.line((1, 9, 5, 9), fill=Bd)
        d.ellipse((12, 15, 22, 21), fill=WD)                    # wing
        eyes(d, (8, 6))
    return friend(draw, {W[:3]: W2}, {W[:3]: WD})

def frog():
    G, G2, GD, Y = rgb(110, 190, 90), rgb(150, 220, 120), rgb(70, 140, 60), rgb(220, 236, 160)
    def draw(d, im):
        d.ellipse((3, 9, 26, 25), fill=G)                       # body
        d.ellipse((4, 3, 12, 11), fill=G); d.ellipse((17, 3, 25, 11), fill=G)   # eye bumps
        d.ellipse((8, 15, 21, 24), fill=Y)                      # belly
        d.ellipse((6, 5, 10, 9), fill=rgb(255, 255, 255)); d.ellipse((19, 5, 23, 9), fill=rgb(255, 255, 255))
        d.rectangle((7, 6, 8, 8), fill=rgb(40, 28, 30)); d.rectangle((20, 6, 21, 8), fill=rgb(40, 28, 30))
        d.arc((9, 9, 20, 15), 20, 160, fill=GD)                 # smile
        d.point([(7, 13), (22, 13)], fill=rgb(240, 150, 150))
    return friend(draw, {G[:3]: G2}, {G[:3]: GD})

def bunny():
    W, W2, WD, P = rgb(244, 240, 236), rgb(255, 255, 255), rgb(206, 198, 196), rgb(244, 170, 186)
    def draw(d, im):
        d.ellipse((8, 0, 13, 13), fill=W); d.ellipse((16, 0, 21, 13), fill=W)   # ears
        d.line((10, 2, 10, 10), fill=P); d.line((18, 2, 18, 10), fill=P)
        d.ellipse((6, 15, 24, 25), fill=W)                      # body
        d.ellipse((7, 7, 22, 19), fill=W)                       # head
        d.ellipse((22, 18, 27, 23), fill=W2)                    # tail
        eyes(d, (10, 12), (17, 12)); d.point((14, 15), fill=P)
    return friend(draw, {W[:3]: W2}, {W[:3]: WD})

def hedgehog():
    S, S2, SD, F, Fd = rgb(150, 104, 70), rgb(186, 136, 96), rgb(110, 74, 48), rgb(244, 220, 184), rgb(214, 184, 148)
    def draw(d, im):
        for x in range(6, 27, 3): d.polygon([(x, 12), (x + 2, 3 + (x % 4)), (x + 4, 12)], fill=S)   # spikes
        d.ellipse((6, 8, 28, 25), fill=S)                       # back
        d.ellipse((1, 12, 15, 25), fill=F)                      # face
        d.point((1, 18), fill=rgb(40, 28, 30)); d.point((2, 18), fill=rgb(40, 28, 30))
        eyes(d, (6, 16)); d.point((9, 20), fill=rgb(240, 150, 150))
    return friend(draw, {S[:3]: S2, F[:3]: rgb(255, 236, 206)}, {S[:3]: SD, F[:3]: Fd})

def fox():
    O, O2, OD, W = rgb(236, 120, 50), rgb(250, 160, 80), rgb(196, 86, 30), rgb(252, 244, 230)
    def draw(d, im):
        d.ellipse((17, 12, 29, 25), fill=O); d.ellipse((24, 18, 29, 25), fill=W)   # bushy tail, white tip
        d.ellipse((6, 12, 22, 25), fill=O)                      # body
        d.ellipse((10, 16, 17, 25), fill=W)                     # chest
        d.polygon([(4, 9), (13, 3), (22, 9), (13, 17)], fill=O) # head
        d.polygon([(5, 6), (6, 0), (10, 4)], fill=O); d.polygon([(21, 6), (20, 0), (16, 4)], fill=O)
        d.polygon([(8, 11), (13, 16), (18, 11), (13, 13)], fill=W)
        eyes(d, (9, 8), (16, 8)); d.point((13, 15), fill=rgb(40, 28, 30))
    return friend(draw, {O[:3]: O2}, {O[:3]: OD})

def owl():
    B, B2, BD, C, Y = rgb(156, 112, 80), rgb(190, 146, 108), rgb(116, 80, 56), rgb(244, 226, 196), rgb(250, 190, 70)
    def draw(d, im):
        d.ellipse((6, 4, 24, 25), fill=B)                       # body
        d.polygon([(7, 7), (8, 0), (12, 5)], fill=B); d.polygon([(23, 7), (22, 0), (18, 5)], fill=B)   # ear tufts
        d.ellipse((10, 14, 20, 24), fill=C)                     # belly
        for y in (17, 20): d.point([(13, y), (15, y), (17, y)], fill=rgb(200, 170, 130))
        d.ellipse((8, 6, 15, 13), fill=Y); d.ellipse((15, 6, 22, 13), fill=Y)   # eye rings
        d.rectangle((10, 8, 12, 10), fill=rgb(40, 28, 30)); d.rectangle((17, 8, 19, 10), fill=rgb(40, 28, 30))
        d.polygon([(14, 12), (16, 12), (15, 15)], fill=rgb(220, 140, 50))
    return friend(draw, {B[:3]: B2}, {B[:3]: BD})

def turtle():
    S, S2, SD, K, K2 = rgb(110, 160, 90), rgb(150, 196, 120), rgb(70, 116, 60), rgb(170, 200, 120), rgb(200, 226, 150)
    def draw(d, im):
        d.ellipse((1, 13, 8, 20), fill=K)                       # head
        for x in (6, 20): d.ellipse((x, 19, x + 5, 25), fill=K) # legs
        d.ellipse((5, 6, 28, 23), fill=S)                       # shell
        d.rectangle((5, 17, 28, 21), fill=SD)
        for cx, cy in ((12, 12), (19, 10), (23, 15), (15, 16)): d.ellipse((cx - 2, cy - 2, cx + 2, cy + 2), fill=S2)
        eyes(d, (3, 15))
    return friend(draw, {S[:3]: S2, K[:3]: K2}, {S[:3]: SD})

FRIENDS = {'cat': cat, 'duck': duck, 'frog': frog, 'bunny': bunny, 'hedgehog': hedgehog, 'fox': fox, 'owl': owl, 'turtle': turtle}

# --- KONO's presents (one for every 7 stamps on the stamp card): 24x24-cell keepsakes, same style.
PRESENT_DIR = os.path.join(ROOT, 'public/garden/presents')

def keepsake(draw, light=None, dark=None):
    im = blank(24, 24); draw(ImageDraw.Draw(im), im)
    return finish(im, light, dark)

def kite():
    R, R2, RD, Y, B = rgb(236, 92, 110), rgb(250, 140, 150), rgb(196, 60, 84), rgb(252, 210, 90), rgb(110, 170, 230)
    def draw(d, im):
        d.polygon([(11, 0), (19, 7), (11, 16), (4, 7)], fill=R)
        d.polygon([(11, 0), (19, 7), (11, 7)], fill=Y)
        d.polygon([(4, 7), (11, 16), (11, 7)], fill=B)
        d.line((11, 16, 13, 19), fill=RD); d.line((13, 19, 10, 22), fill=RD)
        for x, y in ((13, 19), (10, 22)): d.rectangle((x - 1, y - 1, x + 1, y), fill=Y)
    return keepsake(draw, {R[:3]: R2}, {R[:3]: RD})
def balloons():
    P, P2, PD, T, T2, Y, Y2 = rgb(240, 120, 160), rgb(252, 170, 200), rgb(204, 80, 124), rgb(110, 200, 200), rgb(170, 232, 228), rgb(250, 206, 80), rgb(255, 236, 150)
    def draw(d, im):
        S = rgb(150, 120, 110)
        d.line((6, 10, 11, 22), fill=S); d.line((17, 9, 12, 22), fill=S); d.line((12, 12, 12, 22), fill=S)
        d.ellipse((1, 1, 10, 11), fill=P); d.ellipse((13, 0, 22, 10), fill=T); d.ellipse((7, 4, 16, 14), fill=Y)
        d.rectangle((10, 21, 13, 23), fill=rgb(236, 92, 110))
    return keepsake(draw, {P[:3]: P2, T[:3]: T2, Y[:3]: Y2}, {P[:3]: PD})
def teddy():
    B, B2, BD, M = rgb(196, 140, 92), rgb(222, 176, 126), rgb(160, 106, 64), rgb(244, 214, 176)
    def draw(d, im):
        d.ellipse((3, 0, 8, 5), fill=B); d.ellipse((15, 0, 20, 5), fill=B)
        d.ellipse((4, 1, 19, 13), fill=B)
        d.ellipse((5, 11, 18, 23), fill=B)
        d.ellipse((1, 13, 6, 19), fill=B); d.ellipse((17, 13, 22, 19), fill=B)
        d.ellipse((8, 15, 15, 21), fill=M); d.ellipse((9, 7, 14, 12), fill=M)
        d.rectangle((11, 8, 12, 9), fill=rgb(70, 44, 36))
        eyes(d, (8, 5), (14, 5))
        d.rectangle((8, 11, 15, 12), fill=rgb(236, 92, 110))
    return keepsake(draw, {B[:3]: B2}, {B[:3]: BD})
def musicbox():
    W, W2, WD, G, P = rgb(214, 150, 110), rgb(236, 184, 140), rgb(170, 108, 76), rgb(250, 206, 80), rgb(246, 180, 200)
    def draw(d, im):
        d.rectangle((2, 12, 21, 22), fill=W)
        d.polygon([(2, 12), (21, 12), (19, 4), (4, 4)], fill=P)
        d.rectangle((2, 11, 21, 12), fill=G)
        d.rectangle((9, 15, 14, 19), fill=G)
        d.line((22, 16, 23, 16), fill=G); d.rectangle((23, 14, 23, 18), fill=G)
        d.ellipse((10, 0, 13, 3), fill=rgb(255, 250, 244))
    return keepsake(draw, {W[:3]: W2}, {W[:3]: WD})
def snowglobe():
    G, G2, BS, BS2, BSD = rgb(186, 226, 246), rgb(232, 248, 255), rgb(150, 96, 70), rgb(186, 128, 92), rgb(112, 70, 50)
    def draw(d, im):
        d.ellipse((2, 0, 21, 19), fill=G)
        d.polygon([(11, 6), (15, 13), (7, 13)], fill=rgb(80, 160, 100)); d.polygon([(11, 9), (16, 16), (6, 16)], fill=rgb(80, 160, 100))
        d.rectangle((3, 16, 20, 17), fill=rgb(255, 255, 255))
        for x, y in ((6, 5), (15, 4), (17, 9), (5, 11), (10, 3)): d.point((x, y), fill=rgb(255, 255, 255))
        d.rectangle((3, 18, 20, 23), fill=BS)
        d.line((5, 20, 18, 20), fill=rgb(250, 206, 80))
    return keepsake(draw, {G[:3]: G2, BS[:3]: BS2}, {BS[:3]: BSD})
def basket():
    W, W2, WD, R = rgb(206, 156, 92), rgb(232, 192, 128), rgb(164, 116, 62), rgb(228, 80, 86)
    def draw(d, im):
        d.arc((4, 0, 19, 16), 180, 360, fill=WD, width=2)
        d.polygon([(1, 9), (22, 9), (20, 22), (3, 22)], fill=W)
        for y in (13, 17): d.line((3, y, 20, y), fill=WD)
        for x in range(4, 21, 4): d.line((x, 10, x, 21), fill=WD)
        for x in range(1, 23, 4): d.rectangle((x, 8, x + 1, 10), fill=R); d.rectangle((x + 2, 8, x + 3, 10), fill=rgb(255, 250, 244))
        d.ellipse((14, 4, 19, 9), fill=rgb(222, 60, 70)); d.point((16, 3), fill=rgb(90, 140, 70))
    return keepsake(draw, {W[:3]: W2}, {W[:3]: WD})
def sailboat():
    H, H2, HD, S, S2 = rgb(120, 168, 230), rgb(166, 204, 246), rgb(80, 124, 196), rgb(250, 246, 236), rgb(255, 255, 255)
    def draw(d, im):
        d.line((11, 1, 11, 16), fill=rgb(150, 106, 72))
        d.polygon([(12, 2), (20, 15), (12, 15)], fill=S)
        d.polygon([(10, 5), (10, 15), (4, 15)], fill=rgb(246, 180, 200))
        d.polygon([(1, 16), (22, 16), (18, 22), (5, 22)], fill=H)
        d.rectangle((12, 1, 15, 2), fill=rgb(236, 92, 110))
    return keepsake(draw, {H[:3]: H2, S[:3]: S2}, {H[:3]: HD})
def telescope():
    T, T2, TD, L = rgb(110, 120, 200), rgb(160, 168, 236), rgb(76, 82, 156), rgb(250, 206, 80)
    def draw(d, im):
        d.line((8, 14, 3, 23), fill=rgb(150, 106, 72), width=2); d.line((12, 14, 12, 23), fill=rgb(150, 106, 72), width=2); d.line((14, 14, 19, 23), fill=rgb(150, 106, 72), width=2)
        d.polygon([(2, 12), (19, 2), (22, 7), (5, 16)], fill=T)
        d.polygon([(17, 3), (20, 1), (23, 6), (20, 8)], fill=L)
        d.line((9, 9, 11, 12), fill=L)
        d.ellipse((9, 11, 13, 15), fill=TD)
    return keepsake(draw, {T[:3]: T2}, {T[:3]: TD})

PRESENTS = {'kite': kite, 'balloons': balloons, 'teddy': teddy, 'musicbox': musicbox, 'snowglobe': snowglobe, 'basket': basket, 'sailboat': sailboat, 'telescope': telescope}

# --- KONO's friendship gifts (one for each bond heart from 3 on): 24x24-cell keepsakes, same style.
GIFT_DIR = os.path.join(ROOT, 'public/garden/gifts')

def heart_shape(d, x, y, s, fill):
    """A pixel heart about s cells wide with its top-left at (x, y)."""
    r = s // 4
    d.ellipse((x, y, x + 2 * r + 1, y + 2 * r + 1), fill=fill)
    d.ellipse((x + 2 * r, y, x + 4 * r + 1, y + 2 * r + 1), fill=fill)
    d.polygon([(x, y + r + 1), (x + 4 * r + 1, y + r + 1), (x + 2 * r + 0.5, y + 4 * r + 1)], fill=fill)

PINK, PINK2, PINKD = rgb(240, 110, 150), rgb(252, 160, 190), rgb(200, 70, 112)
def cushion():
    def draw(d, im):
        d.rounded_rectangle((1, 5, 22, 21), radius=5, fill=rgb(246, 196, 214))
        heart_shape(d, 6, 8, 12, PINK)
        for x, y in ((1, 5), (22, 5), (1, 21), (22, 21)): d.point((x, y), fill=rgb(250, 206, 80))
    return keepsake(draw, {rgb(246, 196, 214)[:3]: rgb(255, 226, 236), PINK[:3]: PINK2}, {rgb(246, 196, 214)[:3]: rgb(222, 160, 184)})
def lantern():
    def draw(d, im):
        d.line((11, 0, 11, 3), fill=rgb(120, 90, 70))
        d.rectangle((7, 3, 16, 5), fill=rgb(150, 106, 72))
        d.rounded_rectangle((5, 5, 18, 20), radius=4, fill=rgb(255, 214, 150))
        heart_shape(d, 7, 8, 9, PINK)
        d.rectangle((7, 20, 16, 22), fill=rgb(150, 106, 72))
    return keepsake(draw, {rgb(255, 214, 150)[:3]: rgb(255, 240, 200)}, {rgb(255, 214, 150)[:3]: rgb(236, 176, 110)})
def plushie():
    P, P2, PD = rgb(246, 196, 160), rgb(255, 224, 196), rgb(214, 156, 120)
    def draw(d, im):
        for x, y in ((3, 4), (8, 1), (14, 1), (19, 4), (2, 10), (20, 10)): d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=P)
        d.ellipse((2, 2, 21, 21), fill=P)
        d.ellipse((5, 20, 9, 23), fill=PD); d.ellipse((14, 20, 18, 23), fill=PD)
        eyes(d, (7, 10), (14, 10))
        d.point([(5, 14), (18, 14)], fill=rgb(240, 140, 150)); d.point([(6, 14), (17, 14)], fill=rgb(240, 140, 150))
        d.line((10, 15, 13, 15), fill=rgb(120, 70, 60))
        d.rectangle((1, 16, 4, 18), fill=PINK); d.rectangle((19, 16, 22, 18), fill=PINK)
    return keepsake(draw, {P[:3]: P2}, {P[:3]: PD})
def bench():
    W, W2, WD = rgb(196, 140, 92), rgb(222, 176, 126), rgb(150, 100, 62)
    def draw(d, im):
        d.rectangle((1, 6, 22, 9), fill=W); d.rectangle((1, 11, 22, 13), fill=W)
        d.rectangle((0, 15, 23, 17), fill=W)
        for x in (2, 20): d.rectangle((x, 6, x + 1, 23), fill=WD)
        heart_shape(d, 9, 0, 6, PINK)
    return keepsake(draw, {W[:3]: W2}, {W[:3]: WD})
def wishjar():
    G, G2 = rgb(200, 230, 240), rgb(236, 250, 255)
    def draw(d, im):
        d.rectangle((7, 0, 16, 3), fill=rgb(196, 140, 92))
        d.rounded_rectangle((3, 3, 20, 23), radius=5, fill=G)
        import math
        for i, (x, y) in enumerate(((7, 9), (13, 7), (16, 13), (9, 15), (12, 19), (6, 19), (16, 19))):
            d.point((x, y), fill=rgb(255, 220, 90)); d.point([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=rgb(255, 240, 160))
        d.line((4, 6, 4, 12), fill=G2)
    return keepsake(draw, {G[:3]: G2}, {G[:3]: rgb(160, 200, 214)})
def frame():
    F, F2, FD = rgb(214, 160, 80), rgb(240, 200, 120), rgb(170, 120, 56)
    def draw(d, im):
        d.rectangle((1, 1, 22, 22), fill=F)
        d.rectangle((4, 4, 19, 19), fill=rgb(200, 232, 246))
        d.rectangle((4, 15, 19, 19), fill=rgb(150, 210, 120))
        d.ellipse((4, 10, 10, 16), fill=rgb(246, 196, 160)); eyes(d, (5, 12), (8, 12))
        d.ellipse((13, 9, 19, 17), fill=rgb(250, 222, 196)); d.pieslice((13, 8, 19, 14), 180, 360, fill=rgb(110, 72, 52)); eyes(d, (14, 12), (17, 12))
        heart_shape(d, 9, 4, 5, PINK)
    return keepsake(draw, {F[:3]: F2}, {F[:3]: FD})
def arch():
    def draw(d, im):
        d.arc((1, 1, 22, 30), 180, 360, fill=rgb(110, 180, 100), width=3)
        d.rectangle((1, 15, 3, 23), fill=rgb(110, 180, 100)); d.rectangle((20, 15, 22, 23), fill=rgb(110, 180, 100))
        for x, y in ((2, 9), (6, 3), (11, 1), (17, 3), (21, 9), (2, 17), (21, 17)): heart_shape(d, x - 2, y - 2, 5, PINK)
    return keepsake(draw, {PINK[:3]: PINK2}, {PINK[:3]: PINKD})
def golden():
    Y, Y2, YD = rgb(250, 200, 70), rgb(255, 236, 150), rgb(214, 156, 40)
    def draw(d, im):
        heart_shape(d, 2, 1, 20, Y)
        d.rectangle((8, 19, 15, 21), fill=rgb(170, 120, 56)); d.rectangle((6, 21, 17, 23), fill=rgb(150, 100, 50))
        d.point([(6, 5), (7, 4), (5, 6)], fill=rgb(255, 255, 240))
    return keepsake(draw, {Y[:3]: Y2}, {Y[:3]: YD})

GIFTS = {'cushion': cushion, 'lantern': lantern, 'plushie': plushie, 'bench': bench, 'wishjar': wishjar, 'frame': frame, 'arch': arch, 'golden': golden}

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
    os.makedirs(FRIEND_DIR, exist_ok=True)
    for fid, fn in FRIENDS.items(): fn().save(os.path.join(FRIEND_DIR, fid + '.webp'), lossless=True)
    os.makedirs(PRESENT_DIR, exist_ok=True)
    for pid, fn in PRESENTS.items(): fn().save(os.path.join(PRESENT_DIR, pid + '.webp'), lossless=True)
    os.makedirs(GIFT_DIR, exist_ok=True)
    for gid, fn in GIFTS.items(): fn().save(os.path.join(GIFT_DIR, gid + '.webp'), lossless=True)
    # The build only ships files listed in tools/public-allowlist.json: keep the outfit art listed.
    allow_path = os.path.join(ROOT, 'tools/public-allowlist.json')
    allow = [p for p in json.load(open(allow_path)) if not p.startswith(('/garden/kono/outfits/', '/garden/finds/', '/garden/friends/', '/garden/presents/', '/garden/gifts/'))]
    art = sorted('/' + os.path.relpath(os.path.join(d, f), os.path.join(ROOT, 'public')).replace(os.sep, '/') for base in (OUT_DIR, FIND_DIR, FRIEND_DIR, PRESENT_DIR, GIFT_DIR) for d, _, fs in os.walk(base) for f in fs if f.endswith('.webp'))
    at = max((i for i, p in enumerate(allow) if p.startswith('/garden/kono/')), default=len(allow) - 1) + 1
    allow = allow[:at] + art + allow[at:]
    json.dump(allow, open(allow_path, 'w'), indent=1); open(allow_path, 'a').write('\n')
    for flag, items, folder in (('--presents-preview', PRESENTS, PRESENT_DIR), ('--gifts-preview', GIFTS, GIFT_DIR)):
        if flag not in sys.argv: continue
        out = sys.argv[sys.argv.index(flag) + 1]
        sheet = Image.new('RGBA', (120 * len(items), 130), (250, 244, 236, 255))
        for i, pid in enumerate(items):
            im = Image.open(os.path.join(folder, pid + '.webp')).convert('RGBA'); sheet.alpha_composite(im, (i * 120 + (120 - im.width) // 2, (130 - im.height) // 2))
        sheet.save(out)
    if '--friends-preview' in sys.argv:
        out = sys.argv[sys.argv.index('--friends-preview') + 1]
        sheet = Image.new('RGBA', (140 * len(FRIENDS), 130), (250, 244, 236, 255))
        for i, fid in enumerate(FRIENDS):
            im = Image.open(os.path.join(FRIEND_DIR, fid + '.webp')); sheet.alpha_composite(im, (i * 140 + (140 - im.width) // 2, (130 - im.height) // 2))
        sheet.save(out)
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
