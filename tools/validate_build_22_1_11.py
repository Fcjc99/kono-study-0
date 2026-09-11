
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]

# clean transparency for patched home assets
for rel in [
    'public/garden/evolution/home/evening-stage-1.png',
    'public/garden/evolution/home/evening-stage-5.png',
    'public/garden/evolution/home/night-stage-5.png',
    'public/garden/evolution/home/full-silhouette/evening-stage-5.png',
]:
    arr=np.array(Image.open(ROOT/rel).convert('RGBA'))
    mask=arr[:,:,3]==0
    assert not np.any(arr[:,:,:3][mask] != 0), f'dirty transparent RGB: {rel}'

# stage5 alpha should fully cover the approved coverage mask
cov=np.array(Image.open(ROOT/'public/garden/evolution/home/source/stage0-house-coverage-mask.png').convert('L'))>127
for phase in ['morning','afternoon','evening','night']:
    arr=np.array(Image.open(ROOT/f'public/garden/evolution/home/{phase}-stage-5.png').convert('RGBA'))
    alpha=arr[:,:,3]>0
    assert np.all(alpha[cov]), f'stage 5 coverage missing in {phase}'

# evening stage5 should contain warmer window pixels than night stage5
eve=np.array(Image.open(ROOT/'public/garden/evolution/home/evening-stage-5.png').convert('RGBA')).astype(np.int16)
night=np.array(Image.open(ROOT/'public/garden/evolution/home/night-stage-5.png').convert('RGBA')).astype(np.int16)
warm_e=((eve[:,:,0] > eve[:,:,2]+25) & (eve[:,:,1] > eve[:,:,2]+10) & (eve[:,:,3]>0)).sum()
warm_n=((night[:,:,0] > night[:,:,2]+25) & (night[:,:,1] > night[:,:,2]+10) & (night[:,:,3]>0)).sum()
assert warm_e > warm_n, 'evening house is not visibly warmer than night'
print('Build 22.1.11 validation passed.')
