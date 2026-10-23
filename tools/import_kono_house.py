"""Imports KONO's house (Sanctuary › KONO's house): the room and the furniture pieces.

- The room: one 1448 x 1086 picture of the empty room (kono-house-room.png), saved as
  public/garden/house/room.webp.
- Furniture: one piece per picture on a plain white background (house_NN_<name>.png). The white around
  each piece is cut away (by flooding in from the edges, so white inside a piece stays), the piece is
  trimmed, scaled to at most 512 px and saved as public/garden/house/<id>.webp, where <id> is the name
  part of the file (house_01_bed.png → bed).

Run: python3 -I tools/import_kono_house.py SOURCE_DIR [--preview out.png]"""
import json, os, re, sys
from collections import deque
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'public/garden/house')
MAX = 512


def cut_white(img):
    """Clear the white background connected to the picture's edges, with a soft edge."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    # White, and the pale grey of a soft ground shadow: the room draws its own shadow under each piece.
    near = lambda p: min(p[:3]) > 196 and max(p[:3]) - min(p[:3]) < 48
    seen = bytearray(w * h)
    q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or not near(px[x, y]):
            continue
        seen[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    mask = Image.frombytes('L', (w, h), bytes(0 if s else 255 for s in seen))
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    # Pale fringe pixels along the cut are darkened a little so no white halo shows.
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            m = mp[x, y]
            if m and m < 255 and min(r, g, b) > 196:
                px[x, y] = (r * 3 // 4, g * 3 // 4, b * 3 // 4, 255)
    img.putalpha(mask)
    return img.crop(mask.point(lambda v: 255 if v > 24 else 0).getbbox())


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
    os.makedirs(OUT, exist_ok=True)
    room = os.path.join(source, 'kono-house-room.png')
    if os.path.exists(room):
        Image.open(room).convert('RGB').save(os.path.join(OUT, 'room.webp'), 'WEBP', quality=86, method=6)
        print('room')
    pieces = []
    for name in sorted(os.listdir(source)):
        m = re.match(r'house_\d+_(.+)\.png$', name)
        if not m:
            continue
        pid = {'study_desk_with_lamp': 'desk'}.get(m.group(1), m.group(1)).replace('_', '-')
        piece = cut_white(Image.open(os.path.join(source, name)))
        piece.thumbnail((MAX, MAX), Image.LANCZOS)
        piece.save(os.path.join(OUT, pid + '.webp'), 'WEBP', quality=88, method=6)
        pieces.append((pid, piece))
        print(pid, piece.size)
    list_in_allowlist('/garden/house/', OUT)
    if preview and pieces:
        sheet = Image.new('RGBA', (4 * 260, ((len(pieces) + 3) // 4) * 260), (120, 160, 120, 255))
        for i, (_, p) in enumerate(pieces):
            p = p.copy(); p.thumbnail((250, 250))
            sheet.alpha_composite(p, ((i % 4) * 260 + 5, (i // 4) * 260 + 5))
        sheet.save(preview)


if __name__ == '__main__':
    main(sys.argv[1:])
