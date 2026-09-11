
from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/'public/garden/kono'
required=[
 'idle.png','happy.png','question.png','sleep.png','sit.png','shadow.png',
 'walk-down-01.png','walk-down-02.png','walk-down-03.png',
 'walk-up-01.png','walk-up-02.png','walk-up-03.png',
 'walk-left-01.png','walk-left-02.png','walk-right-01.png','walk-right-02.png',
]
for name in required:
 p=ASSET/name
 assert p.exists(), f'missing KONO asset: {name}'
 arr=np.array(Image.open(p).convert('RGBA'))
 assert arr[:,:,3].sum()>0, f'empty KONO asset: {name}'
 transparent=arr[:,:,3]==0
 assert not np.any(arr[:,:,:3][transparent] != 0), f'dirty transparent RGB: {name}'

scene=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
system=(ROOT/'src/game/systems/KonoMascotSystem.ts').read_text()
assert 'KonoMascotSystem.preload(this)' in scene
assert 'this.konoMascot.update(timeMs, dt, environment)' in scene
assert 'this.konoMascot.resize(this.sceneBounds)' in scene
assert 'this.konoMascot.destroy()' in scene
assert 'SANCTUARY_EVENTS.interaction' in system
assert 'SANCTUARY_EVENTS.fishing' in system
assert "'kono-walk-up-01'" in system and "'kono-walk-down-01'" in system
assert "'kono-walk-left-01'" in system and "'kono-walk-right-01'" in system
print('Build 22.4 validation passed.')
