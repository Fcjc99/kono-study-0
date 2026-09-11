"""Release checks for the 22.8.7 localized native-phase terrace repair."""
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / 'public/garden/registered-22.8.6/islands/terrace-evolution'
NEW = ROOT / 'public/garden/terrace-22.8.7'
phases = ['morning', 'afternoon', 'evening', 'night']

def rgba(path):
    return np.array(Image.open(path).convert('RGBA'))

for phase in phases:
    native = rgba(OLD / phase / 'stage-0.png')
    seen = []
    for stage in range(6):
        art = rgba(NEW / phase / f'stage-{stage}.png')
        assert art.shape == native.shape == (1086, 1448, 4)
        assert np.all(art[:, :, 3] == 255), 'Full map must be opaque'
        changed = np.any(art != native, axis=2)
        changed[340:560, 940:1280] = False
        assert not changed.any(), f'{phase}/{stage}: change outside terrace repair zone'
        if stage == 0 and phase != 'night':
            assert np.array_equal(art, native), 'Daylight stage 0 must stay original'
        if stage:
            sprite = rgba(ROOT / f'tools/terrace-22.8.3/inputs/stage-{stage}.png')
            assert set(np.unique(sprite[:, :, 3])) <= {0, 255}, 'Terrace silhouette has a halo'
            assert not np.array_equal(art, native), 'Evolution stage was not replaced'
        for earlier in seen:
            assert not np.array_equal(art, earlier), 'Two stages have the same map'
        seen.append(art)

scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
assert '/garden/terrace-22.8.7/${phase}/stage-${stage}.png' in scene
print('PASS: 24 active terrace maps, unchanged pixels outside repair zone, original daylight stage 0, opaque full maps, clean binary sprite silhouettes, six distinct stages per phase.')
