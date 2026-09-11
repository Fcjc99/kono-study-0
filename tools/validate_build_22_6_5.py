from pathlib import Path
from PIL import Image, ImageStat
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
PHASES=('morning','afternoon','evening','night')
terrace=ROOT/'public/garden/evolution/lanterns/phases'

for stage in range(1,6):
    imgs={p:Image.open(terrace/p/f'terrace-stage-{stage}.png').convert('RGBA') for p in PHASES}
    alpha=np.array(imgs['afternoon'])[:,:,3]
    for phase,img in imgs.items():
        arr=np.array(img)
        assert np.array_equal(arr[:,:,3],alpha), f'alpha geometry drift stage {stage} {phase}'
        assert np.count_nonzero(arr[arr[:,:,3]==0,:3])==0, f'transparent rgb contamination stage {stage} {phase}'
    def mean_v(img):
        arr=np.array(img)
        mask=arr[:,:,3]>0
        return float(np.mean(arr[:,:,:3][mask]))
    vals={p:mean_v(i) for p,i in imgs.items()}
    assert vals['night'] < vals['evening'] < vals['afternoon'], (stage,vals)
    assert vals['morning'] < vals['afternoon'], (stage,vals)

lantern=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
for forbidden in ('terraceEmissive','sanctuary-lantern-glow','BlendModes.ADD','lantern-glow.png'):
    assert forbidden not in lantern, f'terrace overlay token returned: {forbidden}'

mascot=(ROOT/'src/game/systems/KonoMascotSystem.ts').read_text()
assert "pond: NAV_NODES['pond-west']" in mascot
assert "bridge: NAV_NODES.bridge" in mascot
assert 'Keep the current walk frame between navigation nodes' in mascot
assert 'const arrivalDistance = 0.006' in mascot

app=(ROOT/'src/App.tsx').read_text()
css=(ROOT/'src/App.css').read_text()
assert '},680)}' in app
assert 'Array.from({length:8}' in app
assert '--angle:calc(var(--i)*45deg)' in css
assert 'scale(1.22) rotate(8deg)' not in css

print('Build 22.6.5 validation passed.')
