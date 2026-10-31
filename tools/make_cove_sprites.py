"""Small copies of the Sanctuary's own pixel art for KONO Medal Cove (public/games/cove): each image
cropped to what's drawn and scaled down with nearest-neighbor, so the pixels stay crisp and the game
loads a few kilobytes instead of a megabyte per sprite. The originals in public/garden are untouched.
Run from the repo root: python3 tools/make_cove_sprites.py"""
from PIL import Image
import os
SRC = 'public/garden'
OUT = 'public/games/cove'
SPRITES = {
    'lantern-post': ('registered-22.8.6/lights/lantern-post/afternoon.png', 192),
    'lantern-post-night': ('registered-22.8.6/lights/lantern-post/night.png', 192),
    'paper-lanterns': ('registered-22.8.6/lights/paper-lantern-pair/afternoon.png', 192),
    'light-arch': ('registered-22.8.6/lights/string-light-arch/afternoon.png', 256),
    'tree-blossom': ('registered-22.8.6/tree-styles/cherry-blossom/afternoon.png', 256),
    'tree-leafy': ('registered-22.8.6/tree-styles/round-leafy/afternoon.png', 256),
    'flowers-1': ('production-atmosphere/flower-grass-01.png', 128),
    'flowers-2': ('production-atmosphere/flower-grass-02.png', 128),
    'flowers-3': ('production-atmosphere/flower-grass-03.png', 128),
    'flowers-4': ('production-atmosphere/flower-grass-04.png', 128),
    'shell': ('finds/shell.webp', 72),
    'petal-1': ('processed/petals/cherry-petal-01.png', 48),
    'petal-2': ('processed/petals/cherry-petal-02.png', 48),
    'sparkle': ('processed/sparkles/sparkle-01.png', 64),
    'cloud-a': ('clouds/cloud-02.png', 220),
    'cloud-b': ('clouds/cloud-05.png', 220),
    'butterfly': ('critters/butterfly-01.png', 72),
    'butterfly-2': ('critters/butterfly-02.png', 72),
    'bird': ('critters/bird-01.png', 72),
}
os.makedirs(OUT, exist_ok=True)
for name, (path, size) in SPRITES.items():
    im = Image.open(os.path.join(SRC, path)).convert('RGBA')
    box = im.getbbox()
    if box: im = im.crop(box)
    k = size / max(im.size)
    if k < 1: im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.NEAREST if max(im.size) < 400 else Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', lossless=True)
    print(name, im.size, os.path.getsize(os.path.join(OUT, name + '.webp')), 'bytes')
