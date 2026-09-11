
from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ASSET_ROOT=ROOT/'public/garden/fx/critters/individual'
expected=[
    'birds/bird-robin.png','birds/bird-blue.png','birds/bird-flight.png','birds/bird-sparrow.png',
    'butterflies/butterfly-pink-open.png','butterflies/butterfly-blue-side.png','butterflies/butterfly-orange-side.png',
    'butterflies/butterfly-purple-open.png','butterflies/butterfly-mint-open.png','butterflies/butterfly-pink-side.png',
    'pond-life/frog-swim.png','pond-life/frog-sit.png','pond-life/frog-croak.png','pond-life/dragonfly.png','pond-life/snail.png',
    'fireflies/firefly-01.png','fireflies/firefly-02.png','fireflies/firefly-03.png','fireflies/firefly-04.png','fireflies/firefly-05.png','fireflies/firefly-06.png',
]
for rel in expected:
    p=ASSET_ROOT/rel
    assert p.exists(), p
    arr=np.array(Image.open(p).convert('RGBA'))
    assert arr[:,:,3].max()>0, f'empty sprite {rel}'
    assert (arr[:,:,3]==0).sum()>0, f'no transparency {rel}'
    mask=arr[:,:,3]==0
    assert not np.any(arr[:,:,:3][mask] != 0), f'dirty transparent RGB {rel}'

critter=(ROOT/'src/game/systems/CritterSystem.ts').read_text()
assert '/garden/fx/critters/individual' in critter
assert 'setKonoPosition' in critter
assert "'firefly'" in critter and "'snail'" in critter
scene=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
assert 'this.critters.setKonoPosition(this.konoMascot.getNormalizedPosition())' in scene
kono=(ROOT/'src/game/systems/KonoMascotSystem.ts').read_text()
assert 'getNormalizedPosition()' in kono
print('Build 22.5.1 validation passed.')
