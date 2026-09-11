
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
for phase in ['morning','afternoon','evening','night']:
    for state in ['idle','cast']:
        p=ROOT/f'public/garden/evolution/bridge-fishing/phases/{phase}/bridge-fishing-{state}.png'
        arr=np.array(Image.open(p).convert('RGBA'))
        assert arr.shape == (1086,1448,4)
        assert arr[:,:,3].sum() > 0
        transparent=arr[:,:,3]==0
        assert not np.any(arr[:,:,:3][transparent] != 0), f'dirty transparent RGB {phase} {state}'
        ys,xs=np.where(arr[:,:,3]>0)
        assert xs.min() >= 490 and xs.max() <= 850
        assert ys.min() >= 690 and ys.max() <= 935
fs=(ROOT/'src/game/systems/FishingSystem.ts').read_text()
assert 'this.bounds.width * 0.496' in fs
assert 'this.bounds.height * 0.848' in fs
print('Build 22.2 validation passed.')
