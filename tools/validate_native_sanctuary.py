"""Regression contract for the native-palette registered sanctuary."""
from pathlib import Path
from PIL import Image
import hashlib,json,numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/garden/registered-22.8.6'
manifest=json.loads((OUT/'registration.json').read_text())
assert len(manifest['assets'])==280
for rel,expected in manifest['sources'].items():
 assert hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()==expected, f'Original altered: {rel}'
for asset in manifest['assets']:
 p=OUT/asset['path']; im=Image.open(p)
 assert im.size==(asset['width'],asset['height'])
 assert hashlib.sha256(p.read_bytes()).hexdigest()==asset['sha256'], f'Asset changed: {p}'
def rgba(p):return np.array(Image.open(p).convert('RGBA'))
phases=['morning','afternoon','evening','night']
for phase in phases:
 native=rgba(ROOT/f'public/garden/islands/stage-0/stage0-{phase}.png')
 baseline=rgba(OUT/f'islands/terrace-evolution/{phase}/stage-0.png')
 assert np.array_equal(native[:145],baseline[:145]),f'{phase}: original sky/moon changed'
 assert np.array_equal(native[:420,:180],baseline[:420,:180]),f'{phase}: original sunset changed'
 for stage in range(6):
  im=rgba(OUT/f'islands/terrace-evolution/{phase}/stage-{stage}.png')
  changed=np.any(im!=baseline,axis=2); changed[340:565,940:1270]=False
  assert not changed.any(),f'{phase} stage{stage}: changes escaped terrace area'
  assert np.all(im[:,:,3]==255)
  for family in ['home','cherry-tree']:
   art=rgba(OUT/f'evolution/{family}/{phase}-stage-{stage}.png')
   canonical=rgba(OUT/f'evolution/{family}/afternoon-stage-{stage}.png')
   assert np.array_equal(art[:,:,3],canonical[:,:,3]),f'{family}: phase silhouette drifts'
   if family=='home':
    assert set(np.unique(art[:,:,3]))<={0,255},'House halo'
    old=rgba(ROOT/f'public/garden/{"evolution/"+family}/{phase}-stage-{stage}.png')
    assert np.array_equal(art[art[:,:,3]>0],old[art[:,:,3]>0]),'House colors were changed'
 for layer in ['ocean','pond','waterfall','foam']:
  frames=[]
  for frame in range(12):
   a=rgba(OUT/f'production-water/{phase}-{layer}-{frame}.png')
   old=rgba(ROOT/f'public/garden/production-water/afternoon-{layer}-{frame}.png')
   assert np.array_equal(a[:,:,3],old[:,:,3]),'Water escaped its safe masks'
   frames.append(a)
  assert any(not np.array_equal(frames[0],a) for a in frames[1:]),f'{phase} {layer} motion lost'
print('PASS: 280 asset hashes, immutable originals, exact original skies/sun/moon, 24 confined terrace states, phase-identical silhouettes, unchanged home palette and 192 water-frame masks/motion.')
