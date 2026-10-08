"""Imports the Halloween decoration art (Decorate › Halloween) from the generated source pictures: each
one is cut out of its white background (soft, unmixed edges), trimmed, scaled to the pack's size, and
given the pack's four times of day (morning, afternoon, evening and night, graded like the existing art).
Lit things (jack-o'-lantern faces, lantern and window light, candle flames, the cauldron's brew) keep
their light in the evening and at night, with a soft glow around them.

Writes public/garden/registered-22.8.6/halloween/<id>/<phase>.webp and src/game/data/halloweenDecor.ts.
Run: python3 tools/import_halloween_decor.py THEME_DIR FILLER_DIR [--preview FILE]
(the folders unzipped from 15_halloween_theme_generated_sources_v1.zip and
16_halloween_filler_theme_generated_sources_v1.zip).
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'garden', 'registered-22.8.6', 'halloween')
TS_OUT = os.path.join(ROOT, 'src', 'game', 'data', 'halloweenDecor.ts')
ALLOWLIST = os.path.join(ROOT, 'tools', 'public-allowlist.json')
PHASES = ['morning', 'afternoon', 'evening', 'night']
MAX_SIDE = 640
# Per-channel (gain, offset), fitted from the existing pack's own renders (afternoon -> phase).
GRADE = {
    'morning': [(0.906, 0.116), (0.954, 0.101), (0.965, 0.044)],
    'afternoon': [(1, 0), (1, 0), (1, 0)],
    'evening': [(0.889, 0.062), (0.875, 0.008), (0.77, 0.07)],
    'night': [(0.46, -0.028), (0.422, 0.101), (0.392, 0.195)],
}
GLOW = {'morning': 0.0, 'afternoon': 0.0, 'evening': 0.6, 'night': 1.0}

# id, label, source file, size ('home'/'tree' fit like those, or the art's width on the 1448-wide island)
DECOR = [
    ('pumpkin-house', 'Pumpkin House', 'halloween_01_pumpkin_house.png', 'home'),
    ('spooky-tree', 'Autumn Spooky Tree', 'halloween_02_autumn_spooky_tree.png', 'tree'),
    ('pumpkin-patch', 'Pumpkin Patch', 'halloween_03_pumpkin_patch.png', 300),
    ('cauldron', 'Bubbling Cauldron', 'halloween_04_bubbling_cauldron.png', 200),
    ('scarecrow', 'Scarecrow', 'halloween_05_scarecrow.png', 190),
    ('lantern-post', 'Jack-o’-Lantern Lamp', 'halloween_06_jack_o_lantern_lamp.png', 150),
    ('sign', 'Halloween Sign', 'halloween_07_writable_sign.png', 280),
    ('study-candy', 'Study Corner Treats', 'halloween_08_study_candy_decor.png', 210),
    ('jack-o-lantern-trio', 'Jack-o’-Lantern Trio', 'halloween2_01_jack_o_lantern_trio.png', 200),
    ('candy-basket', 'Candy Basket', 'halloween2_02_candy_basket.png', 150),
    ('gravestone', 'Mossy Gravestone', 'halloween2_03_mossy_gravestone_cluster.png', 210),
    ('bat-roost', 'Bat Roost', 'halloween2_04_bat_roost_perch.png', 180),
    ('hay-bale', 'Hay Bales & Pumpkins', 'halloween2_05_hay_bale_pumpkins.png', 190),
    ('ghost-friend', 'Ghost Friend', 'halloween2_06_ghost_friend_lantern.png', 140),
    ('fence-garland', 'Autumn Fence Garland', 'halloween2_07_autumn_fence_garland.png', 280),
    ('spell-book', 'Spell Book & Candles', 'halloween2_08_spell_book_candles.png', 200),
]


PALE_GROUND = {'fence-garland', 'bat-roost'}


def cut_out(rgb, pale_ground=False):
    """Alpha from the white background: the near-white region connected to the border is background;
    a few pixels along its edge are unmixed from white so the outline stays soft without a white fringe."""
    a = rgb.astype(float) / 255.0
    H, W, _ = a.shape
    corners = np.concatenate([a[:6, :6].reshape(-1, 3), a[:6, -6:].reshape(-1, 3), a[-6:, :6].reshape(-1, 3), a[-6:, -6:].reshape(-1, 3)])
    bg = np.median(corners, 0)
    diff = np.abs(a - bg).max(-1)
    cand = ((diff < 0.035) * 255).astype(np.uint8)
    mask = Image.fromarray(cand, 'L').copy()  # (a copy: floodfill can't write into numpy's buffer)
    # Flood from every border pixel that's background-colored.
    for x in range(0, W, 7):
        for y in (0, H - 1):
            if mask.getpixel((x, y)) == 255:
                ImageDraw.floodfill(mask, (x, y), 128)
    for y in range(0, H, 7):
        for x in (0, W - 1):
            if mask.getpixel((x, y)) == 255:
                ImageDraw.floodfill(mask, (x, y), 128)
    m = np.asarray(mask)
    background = m == 128
    # Background showing through holes (inside a basket handle, between branches): big enclosed patches
    # of the exact background color.
    holes = Image.fromarray(((m == 255) * 255).astype(np.uint8), 'L').copy()
    hm = np.asarray(holes)
    ys, xs = np.nonzero(hm == 255)
    seen = np.zeros_like(background)
    for y, x in zip(ys[::97], xs[::97]):
        if seen[y, x] or np.asarray(holes)[y, x] != 255:
            continue
        ImageDraw.floodfill(holes, (int(x), int(y)), 77)
        region = np.asarray(holes) == 77
        seen |= region
        if region.sum() > 250 and diff[region].mean() < 0.012:
            background |= region
        ImageDraw.floodfill(holes, (int(x), int(y)), 10)
    # Soft ground shadows: light, colorless pixels reaching out from the background become a see-through
    # shadow instead of a pale patch.
    v = a.max(-1)
    sat = (a.max(-1) - a.min(-1)) / np.maximum(v, 1e-3)
    pale = (sat < 0.07) & (v > 0.78) & ~background
    if pale_ground:
        # Some pictures stand on a whitish ground patch; a looser test clears it (only for those, so the
        # ghost's white body is never touched).
        pale |= (sat < 0.16) & (v > 0.84) & ~background
    shade = Image.fromarray(((pale | background) * 255).astype(np.uint8), 'L').copy()
    ImageDraw.floodfill(shade, (0, 0), 128)
    shadow = (np.asarray(shade) == 128) & pale
    # Edge band: up to 5 px inside the object next to the background (this also clears the pale rim some
    # pictures have along the bottom of their ground).
    near = np.asarray(Image.fromarray(((background | shadow) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(11))) > 0
    band = near & ~background & ~shadow
    alpha = np.where(background, 0.0, 1.0)
    # A shadow pixel keeps how much darker than the background it is, as a warm dark tint.
    depth = np.clip((bg.mean() - v) / bg.mean() * 3.2, 0, 0.55)
    alpha = np.where(shadow, depth, alpha)
    # Color-to-alpha against the background color in the band.
    unmix = np.clip(((bg - a) / np.maximum(bg, 1e-3)).max(-1), 0, 1)
    unmix = np.clip(unmix * 1.6, 0, 1)
    alpha = np.where(band, np.minimum(alpha, unmix), alpha)
    safe = np.maximum(alpha, 1e-3)[..., None]
    color = np.where(band[..., None], np.clip((a - (1 - safe) * bg) / safe, 0, 1), a)
    color = np.where(shadow[..., None], np.array([0.22, 0.16, 0.12]), color)
    return color, alpha


def lit_mask(color, alpha):
    """What gives off light: bright warm-yellow (carved faces, lamps, windows, flames) and the bright
    green brew. Kept small and soft so leaves and pumpkin skin don't glow."""
    r, g, b = color[..., 0], color[..., 1], color[..., 2]
    mx, mn = color.max(-1), color.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-3)
    warm = (r > 0.98) & (g > 0.84) & (b < 0.45) & (sat > 0.55)
    brew = (g > 0.82) & (r < 0.75) & (b < 0.6) & (sat > 0.4)
    m = (warm | brew) & (alpha > 0.9)
    # Only clusters: a lone bright leaf edge pixel shouldn't light up.
    mi = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5))
    return np.asarray(mi.filter(ImageFilter.GaussianBlur(1.5))).astype(float) / 255.0


def render(color, alpha, lit, phase):
    graded = np.stack([color[..., c] * GRADE[phase][c][0] + GRADE[phase][c][1] for c in range(3)], -1)
    g = (lit * GLOW[phase])[..., None]
    out = np.clip(graded * (1 - g) + np.clip(color * 1.05, 0, 1) * g, 0, 1)
    a = alpha.copy()
    if GLOW[phase] > 0 and lit.any():
        H, W = alpha.shape
        halo = np.asarray(Image.fromarray((lit * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(6, W / 45)))).astype(float) / 255.0
        h = np.clip(halo * 2.2 * GLOW[phase], 0, 0.85)
        warm = np.array([1.0, 0.7, 0.3])
        out = np.clip(out + warm * (h * 0.35 * a)[..., None], 0, 1)
        out = np.where((a < 0.05)[..., None], warm, out)
        a = np.clip(a + h * 0.5 * (1 - a), 0, 1)
    return Image.fromarray((np.concatenate([out, a[..., None]], -1) * 255).astype(np.uint8), 'RGBA')


def sign_area(color, alpha):
    """The blank parchment panel: the light, flat region around the middle of the sign."""
    v = color.max(-1)
    sat = (color.max(-1) - color.min(-1)) / np.maximum(v, 1e-3)
    H, W = v.shape
    light = Image.fromarray((((v > 0.78) & (sat < 0.3) & (alpha > 0.99)) * 255).astype(np.uint8), 'L').copy()
    ImageDraw.floodfill(light, (W // 2, int(H * 0.42)), 128)
    ys, xs = np.nonzero(np.asarray(light) == 128)
    if len(xs) > 500:
        x0, x1, y0, y1 = np.percentile(xs, 1), np.percentile(xs, 99), np.percentile(ys, 1), np.percentile(ys, 99)
        px, py = (x1 - x0) * 0.07, (y1 - y0) * 0.1
        return {'x': round(float(x0 + px) / W, 4), 'y': round(float(y0 + py) / H, 4), 'width': round(float(x1 - x0 - 2 * px) / W, 4), 'height': round(float(y1 - y0 - 2 * py) / H, 4)}
    return old_sign_area(color, alpha)


def old_sign_area(color, alpha):
    v = color.max(-1)
    sat = (color.max(-1) - color.min(-1)) / np.maximum(color.max(-1), 1e-3)
    m = (v > 0.86) & (sat < 0.22) & (alpha > 0.99)
    H, W = m.shape
    rows = np.where(m.mean(1) > 0.3)[0]
    cols = np.where(m[rows.min():rows.max() + 1].mean(0) > 0.5)[0] if len(rows) else []
    if not len(rows) or not len(cols):
        return None
    y0, y1, x0, x1 = rows.min(), rows.max(), cols.min(), cols.max()
    pad_x, pad_y = (x1 - x0) * 0.06, (y1 - y0) * 0.1
    return {'x': round((x0 + pad_x) / W, 4), 'y': round((y0 + pad_y) / H, 4), 'width': round((x1 - x0 - 2 * pad_x) / W, 4), 'height': round((y1 - y0 - 2 * pad_y) / H, 4)}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    if preview in args:
        args.remove(preview)
    theme, filler = args[0], args[1]
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    entries, previews = [], []
    for ident, label, name, size in DECOR:
        path = os.path.join(theme if name.startswith('halloween_') else filler, name)
        rgb = np.asarray(Image.open(path).convert('RGB'))
        color, alpha = cut_out(rgb, pale_ground=ident in PALE_GROUND)
        ys, xs = np.nonzero(alpha > 0.04)
        m = 12
        y0, y1, x0, x1 = max(0, ys.min() - m), min(alpha.shape[0], ys.max() + 1 + m), max(0, xs.min() - m), min(alpha.shape[1], xs.max() + 1 + m)
        color, alpha = color[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
        # Scale down (premultiplied, so edges stay clean).
        H, W = alpha.shape
        k = min(1.0, MAX_SIDE / max(H, W))
        if k < 1:
            im = Image.fromarray((np.concatenate([color, alpha[..., None]], -1) * 255).astype(np.uint8), 'RGBA').convert('RGBa')
            im = im.resize((round(W * k), round(H * k)), Image.LANCZOS).convert('RGBA')
            arr = np.asarray(im).astype(float) / 255.0
            color, alpha = arr[..., :3], arr[..., 3]
        lit = lit_mask(color, alpha)
        folder = os.path.join(OUT, ident)
        os.makedirs(folder, exist_ok=True)
        imgs = {}
        for phase in PHASES:
            imgs[phase] = render(color, alpha, lit, phase)
            imgs[phase].save(os.path.join(folder, phase + '.webp'), 'WEBP', quality=88, method=6)
        H, W = alpha.shape
        cys, cxs = np.nonzero(alpha > 0.5)
        entry = {'id': ident, 'label': label, 'width': int(W), 'height': int(H),
                 'contentWidth': int(cxs.max() - cxs.min() + 1), 'contentHeight': int(cys.max() - cys.min() + 1),
                 'anchorY': round(float(cys.max() + 1) / H - 0.04, 4), 'size': size}
        if ident == 'sign':
            entry['signArea'] = sign_area(color, alpha)
        entries.append(entry)
        previews.append(imgs)
        print(ident, W, H, 'lit px', int((lit > 0.5).sum()), entry.get('signArea', ''))
    if preview:
        cell = 300
        cols = 8
        rows = (len(previews) + cols - 1) // cols
        sheet = Image.new('RGBA', (cell * cols, cell * rows * 2), (0, 0, 0, 255))
        d = ImageDraw.Draw(sheet)
        for r in range(rows):
            d.rectangle([0, r * 2 * cell, sheet.width, (r * 2 + 1) * cell], fill=(140, 186, 104, 255))
            d.rectangle([0, (r * 2 + 1) * cell, sheet.width, (r * 2 + 2) * cell], fill=(36, 30, 60, 255))
        for i, imgs in enumerate(previews):
            for k, phase in enumerate(('afternoon', 'night')):
                im = imgs[phase].copy()
                im.thumbnail((cell - 16, cell - 16))
                sheet.alpha_composite(im, ((i % cols) * cell + (cell - im.width) // 2, ((i // cols) * 2 + k) * cell + (cell - im.height) // 2))
        sheet.convert('RGB').save(preview)
    with open(TS_OUT, 'w') as f:
        f.write('// Generated by tools/import_halloween_decor.py; do not edit by hand.\n')
        f.write('/** Decorate › Halloween. width/height are the picture in px; content* the painted part; anchorY where it\n')
        f.write(" * meets the ground; size is 'home' or 'tree' (fitted like those) or its width on the 1448-wide island;\n")
        f.write(' * signArea (the sign only) is the blank panel a player can write on. */\n')
        f.write("export type HalloweenDecor={id:string;label:string;width:number;height:number;contentWidth:number;contentHeight:number;anchorY:number;size:'home'|'tree'|number;signArea?:{x:number;y:number;width:number;height:number}}\n")
        f.write('export const HALLOWEEN_DECOR:HalloweenDecor[]=' + json.dumps(entries, ensure_ascii=False, separators=(',', ':')) + '\n')
        f.write("export const halloweenDecorTexturePath=(id:string,phase:string):string=>`/garden/registered-22.8.6/halloween/${id}/${phase}.webp`\n")
    with open(ALLOWLIST) as f:
        files = json.load(f)
    files = [p for p in files if not p.startswith('/garden/registered-22.8.6/halloween/')]
    files += ['/garden/registered-22.8.6/halloween/%s/%s.webp' % (e['id'], p) for e in entries for p in PHASES]
    with open(ALLOWLIST, 'w') as f:
        json.dump(files, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
