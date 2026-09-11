from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
PH=ROOT/'public/garden/evolution/lanterns/phases'
# Stage0 remains transparent in every phase.
for phase in ['morning','afternoon','evening','night']:
    p=PH/phase/'terrace-stage-0.png'
    assert p.exists(), p
    a=np.array(Image.open(p).convert('RGBA'))[:,:,3]
    assert a.max()==0, f'Stage0 evolution layer must remain transparent: {phase}'
# All evolved phase sprites must have exactly the approved afternoon alpha geometry.
for stage in range(1,6):
    base=np.array(Image.open(PH/'afternoon'/f'terrace-stage-{stage}.png').convert('RGBA'))[:,:,3]
    assert base.max()>0
    for phase in ['morning','evening','night']:
        p=PH/phase/f'terrace-stage-{stage}.png'
        arr=np.array(Image.open(p).convert('RGBA'))
        assert np.array_equal(arr[:,:,3],base), f'alpha geometry mismatch: {phase} stage {stage}'
        assert arr[:,:,:3][arr[:,:,3]>0].std()>4, f'flat/empty repaint: {phase} stage {stage}'
# Runtime terrace renderer must stay single-layer only.
text=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
for forbidden in ['terraceEmissive','sanctuary-lantern-glow','BlendModes.ADD','ACTIVE_LIGHT_COUNTS']:
    assert forbidden not in text, f'forbidden terrace overlay token: {forbidden}'
assert 'No runtime terrace-light overlays' in text
print('Build 22.6.8 validation passed.')
