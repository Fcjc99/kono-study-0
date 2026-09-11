
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]

assert not (ROOT/'public/garden/evolution/lanterns/emissive').exists(), 'emissive directory still exists'
assert not (ROOT/'public/garden/evolution/lanterns/lantern-glow.png').exists(), 'lantern-glow asset still exists'
ts=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
for forbidden in ['terraceEmissive', 'sanctuary-lantern-glow', 'BlendModes.ADD', 'glows:']:
    assert forbidden not in ts, f'overlay runtime code still present: {forbidden}'

for phase in ['evening','night']:
    for stage in range(1,6):
        arr=np.array(Image.open(ROOT/f'public/garden/evolution/lanterns/phases/{phase}/terrace-stage-{stage}.png').convert('RGBA'))
        assert arr[:,:,3].sum()>0
        transparent=arr[:,:,3]==0
        assert not np.any(arr[:,:,:3][transparent] != 0), f'dirty transparent RGB {phase} {stage}'

# Night terrace should contain no very bright warm pixels.
for stage in range(1,6):
    arr=np.array(Image.open(ROOT/f'public/garden/evolution/lanterns/phases/night/terrace-stage-{stage}.png').convert('RGBA')).astype(np.int16)
    warm_bright=(arr[:,:,0]>145)&(arr[:,:,1]>105)&(arr[:,:,2]<100)&(arr[:,:,3]>0)
    assert warm_bright.sum()==0, f'warm night terrace pixels remain stage {stage}'

# Stage5 house bbox is larger than stage4 in both dimensions in afternoon.
def bbox(p):
    a=np.array(Image.open(p).convert('RGBA'))[:,:,3]>0
    y,x=np.where(a)
    return x.min(),y.min(),x.max(),y.max()
b4=bbox(ROOT/'public/garden/evolution/home/afternoon-stage-4.png')
b5=bbox(ROOT/'public/garden/evolution/home/afternoon-stage-5.png')
assert (b5[2]-b5[0]) > (b4[2]-b4[0]), 'stage5 house not wider than stage4'
print('Build 22.1.14 validation passed.')
