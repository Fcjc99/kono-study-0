"""Imports KONO's world map and its lands (Sanctuary › World map): world-map.png and land-<id>.png, each
1448 x 1086, saved as public/garden/world/<name>.webp and listed in tools/public-allowlist.json. The lands'
market furniture (land_<id>_NN_<name>.png) goes through tools/import_kono_house.py with the house furniture.

Run: python3 -I tools/import_kono_world.py SOURCE_DIR"""
import json, os, re, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'public/garden/world')


def main(args):
    if not args or args[0].startswith('-'):
        sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    for name in sorted(os.listdir(args[0])):
        if re.match(r'(world-map|land-[a-z]+)\.png$', name):
            Image.open(os.path.join(args[0], name)).convert('RGB').save(os.path.join(OUT, name[:-4] + '.webp'), 'WEBP', quality=86, method=6)
            print(name[:-4])
    path = os.path.join(ROOT, 'tools', 'public-allowlist.json')
    allow = [p for p in json.load(open(path)) if not p.startswith('/garden/world/')]
    art = sorted('/garden/world/' + f for f in os.listdir(OUT) if f.endswith('.webp'))
    at = max((i for i, p in enumerate(allow) if p.startswith('/garden/')), default=len(allow) - 1) + 1
    with open(path, 'w') as f:
        json.dump(allow[:at] + art + allow[at:], f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main(sys.argv[1:])
