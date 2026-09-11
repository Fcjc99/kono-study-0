
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
# ensure evening/night stage5 are non-empty and clean alpha
for phase in ['evening','night']:
    p=ROOT/f'public/garden/evolution/lanterns/phases/{phase}/terrace-stage-5.png'
    arr=np.array(Image.open(p).convert('RGBA'))
    assert arr[:,:,3].sum() > 0, f'{phase} terrace empty'
    mask=arr[:,:,3]==0
    assert not np.any(arr[:,:,:3][mask] != 0), f'{phase} terrace has dirty transparent RGB'
text=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
assert 'const ACTIVE_LIGHT_COUNTS = [0, 0, 0, 0, 0, 0] as const' in text
print('Build 22.1.8 validation passed.')
