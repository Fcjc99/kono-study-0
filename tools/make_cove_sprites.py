"""HD copies of the Sanctuary's own pixel art for KONO Medal Cove (public/games/cove): each image
cropped to what's drawn and scaled to the size the game draws them at on a high-resolution screen (smoothly), so they stay
sharp without loading the full-size originals. The originals in public/garden are untouched.
Run from the repo root: python3 tools/make_cove_sprites.py"""
from PIL import Image
import os
SRC = 'public/garden'
OUT = 'public/games/cove'
SPRITES = {
    'lantern-post': ('registered-22.8.6/lights/lantern-post/afternoon.png', 480),
    'lantern-post-night': ('registered-22.8.6/lights/lantern-post/night.png', 480),
    'paper-lanterns': ('registered-22.8.6/lights/paper-lantern-pair/afternoon.png', 480),
    'light-arch': ('registered-22.8.6/lights/string-light-arch/afternoon.png', 640),
    'tree-blossom': ('registered-22.8.6/tree-styles/cherry-blossom/afternoon.png', 640),
    'tree-leafy': ('registered-22.8.6/tree-styles/round-leafy/afternoon.png', 640),
    'flowers-1': ('production-atmosphere/flower-grass-01.png', 320),
    'flowers-2': ('production-atmosphere/flower-grass-02.png', 320),
    'flowers-3': ('production-atmosphere/flower-grass-03.png', 320),
    'flowers-4': ('production-atmosphere/flower-grass-04.png', 320),
    'shell': ('finds/shell.webp', 180),
    'petal-1': ('processed/petals/cherry-petal-01.png', 120),
    'petal-2': ('processed/petals/cherry-petal-02.png', 120),
    'sparkle': ('processed/sparkles/sparkle-01.png', 160),
    'cloud-a': ('clouds/cloud-02.png', 560),
    'cloud-b': ('clouds/cloud-05.png', 560),
    'butterfly': ('critters/butterfly-01.png', 180),
    'butterfly-2': ('critters/butterfly-02.png', 180),
    'bird': ('critters/bird-01.png', 180),
}
os.makedirs(OUT, exist_ok=True)
for name, (path, size) in SPRITES.items():
    im = Image.open(os.path.join(SRC, path)).convert('RGBA')
    box = im.getbbox()
    if box: im = im.crop(box)
    k = size / max(im.size)
    if k < 1: im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    # The big painted ones as high-quality lossy WebP (a quarter of the size); the small pixel-art ones lossless.
    if max(im.size) > 200: im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=92, alpha_quality=100, method=6)
    else: im.save(os.path.join(OUT, name + '.webp'), 'WEBP', lossless=True)
    print(name, im.size, os.path.getsize(os.path.join(OUT, name + '.webp')), 'bytes')
