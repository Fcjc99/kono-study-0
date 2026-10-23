"""Imports KONO's paint colors (KONO Town › Paint shop) from pose sheets drawn over KONO's approved sprite
sheet (public/garden/kono/source/approved-kono-sprite-sheet.png): the same 12 poses in a 4 x 3 grid on a flat
green (#00FF00) background, one sheet per color, named kono-<color>.png.

Every one of KONO's island frames is made in the color, the same size as the classic frame and with KONO in
the same place, so outfits (fitted to KONO's head in each pose) and the island's placement still fit:
- poses on the sheet are cut out and scaled to the classic frame's height (idle, happy, excited, question,
  sleep, read, tea, two walking-down frames, two walking-right frames);
- sit is tea, the third walking-down frame is the first one mirrored, and walking left is walking right
  mirrored;
- frames that aren't on the sheet (walking away, fishing, the pond) are the classic frame with its fur
  repainted in the color, sampled from the color's idle pose.

Run: python3 -I tools/import_kono_colors.py SOURCE_DIR [--preview out.png]"""
import colorsys, json, os, sys
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
KONO = os.path.join(ROOT, 'public/garden/kono')
COLORS = ['starry', 'rainbow', 'ghost', 'autumn', 'sakura']
# Cells of the 4 x 3 sheet, left to right, top to bottom (cell 4, a sleepy face, isn't used on the island).
CELLS = {'idle': 0, 'happy': 1, 'excited': 2, 'question': 3, 'sleep': 5, 'read': 6, 'tea': 7,
         'walk-down-01': 8, 'walk-down-02': 9, 'walk-right-01': 10, 'walk-right-02': 11}
DERIVED = {'sit': ('tea', False), 'walk-down-03': ('walk-down-01', True), 'walk-left-01': ('walk-right-01', True), 'walk-left-02': ('walk-right-02', True)}
TINTED = ['fishing', 'pond']
BACK = ['walk-up-01', 'walk-up-02', 'walk-up-03']
BANDS = 12


def keyed(sheet):
    """The sheet with its green background made clear (and green fringes on the edges removed)."""
    img = sheet.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if g > 150 and g - max(r, b) > 70:
                px[x, y] = (0, 0, 0, 0)
    # Pixels right next to the background lose any green tint.
    a = img.split()[3]
    edge = a.filter(ImageFilter.MinFilter(5))
    for y in range(h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al and not edge.getpixel((x, y)) and g > max(r, b):
                px[x, y] = (r, max(r, b), b, al)
    return img


def cells(img):
    """The 12 poses, each cropped to what's drawn in its cell (small specks dropped)."""
    w, h = img.size
    out = []
    for i in range(12):
        cx, cy = (i % 4) * w // 4, (i // 4) * h // 3
        cell = img.crop((cx, cy, cx + w // 4, cy + h // 3))
        box = cell.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
        out.append(cell.crop(box) if box else cell)
    return out


def fitted(pose, frame):
    """The pose scaled to the classic frame's height and set where KONO stands in it (same canvas)."""
    box = frame.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
    bw, bh = box[2] - box[0], box[3] - box[1]
    s = bh / pose.height
    pw = max(1, round(pose.width * s))
    scaled = pose.resize((pw, bh), Image.LANCZOS)
    a = scaled.split()[3].point(lambda v: 255 if v >= 110 else 0)
    scaled.putalpha(a)
    canvas = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    x = round(box[0] + bw / 2 - pw / 2)
    canvas.alpha_composite(scaled, (max(0, min(frame.width - pw, x)), box[1]))
    return canvas


def is_fur(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.03 <= h <= 0.13 and 0.08 <= s <= 0.5 and v >= 0.62


def fur_map(classic, colored):
    """The color's fur, band by band down KONO's body (its average color and how bright the classic fur is
    there), from the idle poses."""
    cp, kp = classic.load(), colored.load()
    box = classic.split()[3].getbbox()
    bands = [[0, 0, 0, 0, 0] for _ in range(BANDS)]
    for y in range(box[1], box[3]):
        for x in range(box[0], box[2]):
            r, g, b, a = cp[x, y]
            R, G, B, A = kp[x, y]
            if a < 200 or A < 200 or not is_fur(r, g, b) or not is_fur_like(R, G, B):
                continue
            t = bands[min(BANDS - 1, int(BANDS * (y - box[1]) / (box[3] - box[1])))]
            t[0] += R; t[1] += G; t[2] += B; t[3] += (r + g + b) / 3; t[4] += 1
    filled = [(i, t) for i, t in enumerate(bands) if t[4]]
    out = []
    for i in range(BANDS):
        k, t = min(filled, key=lambda f: abs(f[0] - i))
        out.append((t[0] / t[4], t[1] / t[4], t[2] / t[4], t[3] / t[4]))
    return out


def is_fur_like(r, g, b):
    """Not the color's eyes, mouth or outline (very dark)."""
    return r + g + b > 150


def tinted(frame, bands):
    """The frame with its fur in the color: each band's color, lighter or darker as the classic fur is, so
    the strands still show."""
    out = frame.copy()
    px = out.load()
    box = frame.split()[3].getbbox()
    for y in range(box[1], box[3]):
        pos = BANDS * (y - box[1]) / (box[3] - box[1]) - 0.5
        lo = max(0, min(BANDS - 1, int(pos))); hi = min(BANDS - 1, lo + 1); t = max(0.0, min(1.0, pos - lo))
        c = [bands[lo][i] * (1 - t) + bands[hi][i] * t for i in range(4)]
        for x in range(box[0], box[2]):
            r, g, b, a = px[x, y]
            if a < 10 or not is_fur(r, g, b):
                continue
            k = ((r + g + b) / 3) / c[3]
            px[x, y] = (*(max(0, min(255, round(c[i] * k))) for i in range(3)), a)
    return out


def is_face(r, g, b):
    """Eyes and mouth (near black) or blush (pink)."""
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return v < 0.3 or ((h < 0.03 or h > 0.9) and s > 0.2 and v > 0.6)


def back_view(frame, colored_idle, table):
    """A walking-away frame: the classic back frame with its fur tinted in the color, plus the color's pattern
    (stars, petals, leaves) taken from its idle pose, everywhere but where the face is."""
    out = tinted(frame, table)
    tex = fitted(colored_idle.crop(colored_idle.split()[3].getbbox()), frame)
    tp, px, fp = tex.load(), out.load(), frame.load()
    inner = tex.split()[3].filter(ImageFilter.MinFilter(9))
    dark = [(x, y) for y in range(frame.height) for x in range(frame.width) if inner.getpixel((x, y)) > 200 and sum(tp[x, y][:3]) < 150]
    face = (0, 0, -1, -1)
    if dark:
        face = (min(x for x, _ in dark) - 30, min(y for _, y in dark) - 10, max(x for x, _ in dark) + 30, max(y for _, y in dark) + 14)
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = fp[x, y]
            if a < 10 or not is_fur(r, g, b) or inner.getpixel((x, y)) < 200 or (face[0] <= x <= face[2] and face[1] <= y <= face[3]):
                continue
            t, o = tp[x, y], px[x, y]
            if abs(t[0] - o[0]) + abs(t[1] - o[1]) + abs(t[2] - o[2]) > 80:
                px[x, y] = (*t[:3], a)
    return out


def list_in_allowlist(prefix, folder):
    """The build only ships files listed in tools/public-allowlist.json: list this art (and only what's there now)."""
    path = os.path.join(ROOT, 'tools', 'public-allowlist.json')
    allow = [p for p in json.load(open(path)) if not p.startswith(prefix)]
    art = sorted('/' + os.path.relpath(os.path.join(d, f), os.path.join(ROOT, 'public')).replace(os.sep, '/') for d, _, fs in os.walk(folder) for f in fs if f.endswith('.webp'))
    at = max((i for i, p in enumerate(allow) if p.startswith('/garden/kono/')), default=len(allow) - 1) + 1
    allow = allow[:at] + art + allow[at:]
    with open(path, 'w') as f:
        json.dump(allow, f, indent=1)
        f.write('\n')


def main(args):
    if not args or args[0].startswith('-'):
        sys.exit(__doc__)
    source = args[0]
    preview = args[args.index('--preview') + 1] if '--preview' in args else None
    manifest = json.load(open(os.path.join(KONO, 'manifest.json')))
    classic = {name: Image.open(os.path.join(KONO, name + '.webp')).convert('RGBA') for name in manifest if name != 'shadow'}
    made = {}
    for color in COLORS:
        path = os.path.join(source, 'kono-' + color + '.png')
        if not os.path.exists(path):
            print('skip', color, '(no kono-' + color + '.png)')
            continue
        poses = cells(keyed(Image.open(path)))
        frames = {name: fitted(poses[i], classic[name]) for name, i in CELLS.items()}
        for name, (src, mirror) in DERIVED.items():
            pose = poses[CELLS[src]]
            frames[name] = fitted(ImageOps.mirror(pose) if mirror else pose, classic[name])
        table = fur_map(classic['idle'], frames['idle'])
        for name in TINTED:
            frames[name] = tinted(classic[name], table)
        for name in BACK:
            frames[name] = back_view(classic[name], frames['idle'], table)
        out = os.path.join(KONO, 'colors', color)
        os.makedirs(out, exist_ok=True)
        for name, img in frames.items():
            assert img.size == classic[name].size, name
            # Fewer colors, like the classic pixel-art frames, keeps each picture small.
            img.quantize(colors=128, method=Image.Quantize.FASTOCTREE).convert('RGBA').save(os.path.join(out, name + '.webp'), 'WEBP', lossless=True, method=6)
        made[color] = frames
        print('made', color, len(frames), 'frames')
    list_in_allowlist('/garden/kono/colors/', os.path.join(KONO, 'colors'))
    if preview and made:
        names = [n for n in manifest if n != 'shadow']
        tile = 120
        sheet = Image.new('RGBA', (tile * len(names), tile * (len(made) + 1)), (232, 240, 226, 255))
        for row, frames in enumerate([classic, *made.values()]):
            for col, name in enumerate(names):
                im = frames[name].copy(); im.thumbnail((tile - 6, tile - 6))
                sheet.alpha_composite(im, (col * tile + 3, row * tile + 3))
        sheet.save(preview)


if __name__ == '__main__':
    main(sys.argv[1:])
