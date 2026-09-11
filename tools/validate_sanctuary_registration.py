"""Verify all runtime geometry and phase grades, not only PNG dimensions."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/garden/registered-22.8.4'
manifest = json.loads((ASSETS / 'registration.json').read_text())
lock = json.loads((ROOT / 'STAGE0-LOCK-22.7.38.json').read_text())
for info in lock['phases'].values():
    assert hashlib.sha256((ROOT / info['locked_source_path']).read_bytes()).hexdigest() == info['sha256'], 'Original source changed'
assert len(manifest['assets']) == 276
assert manifest['terrace'] == dict(left=960, bottom=552, clear=[940,350,1270,565])
for item in manifest['assets']:
    target = ASSETS / item['path']
    assert hashlib.sha256(target.read_bytes()).hexdigest() == item['sha256'], item['path']
    actual = Image.open(target).convert('RGBA')
    source = Image.open(ASSETS / item['canonical']).convert('RGBA')
    phase = next(p for p in manifest['grades'] if p in item['path'])
    gain, bias = manifest['grades'][phase]
    channels = source.split()
    # Match JavaScript Math.round (all values non-negative).
    expected = Image.merge('RGBA', tuple(channels[c].point([min(255, max(0, int(v * gain[c] + bias[c] + .5))) for v in range(256)]) for c in range(3)) + (channels[3],))
    assert actual.size == source.size
    assert all(c.getbbox() is None for c in ImageChops.difference(actual, expected).split()), f'{item["path"]}: phase geometry or alpha moved'
base = Image.open(ASSETS / 'islands/terrace-evolution/afternoon/stage-0.png').convert('RGBA')
outside = Image.new('L', base.size, 255)
outside.paste(0, (940,280,1270,565))
seen = set()
for stage in range(1,6):
    image = Image.open(ASSETS / f'islands/terrace-evolution/afternoon/stage-{stage}.png').convert('RGBA')
    digest = hashlib.sha256(image.tobytes()).hexdigest()
    assert digest not in seen
    seen.add(digest)
    assert all(ImageChops.multiply(c, outside).getbbox() is None for c in ImageChops.difference(image, base).split()), 'Terrain changed outside terrace'
print('PASS: 276 registered assets; exact phase geometry/alpha; five unique terrace upgrades; original source maps preserved.')
