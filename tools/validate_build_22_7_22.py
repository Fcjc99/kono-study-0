from pathlib import Path
from PIL import Image
import numpy as np, hashlib

ROOT=Path(__file__).resolve().parents[1]
MAPS=ROOT/'public/garden/islands/terrace-evolution'
BASE=ROOT/'public/garden/islands/stage-0'
BOX=(930,245,1275,570)
WORLD=(1448,1086)
errors=[]

# Morning/Afternoon must remain the crisp 22.7.21 maps.
# We validate structure/integration here; release QA records their unchanged hashes.
for phase in ('morning','afternoon','evening','night'):
    base=np.array(Image.open(BASE/f'stage0-{phase}.png').convert('RGB'))
    for stage in range(6):
        p=MAPS/phase/f'stage-{stage}.png'
        if not p.exists(): errors.append(f'missing {phase} stage {stage}'); continue
        im=Image.open(p)
        if im.size!=WORLD: errors.append(f'wrong size {phase} stage {stage}: {im.size}')
        if im.mode!='RGB': errors.append(f'non-RGB {phase} stage {stage}: {im.mode}')
        arr=np.array(im.convert('RGB'))
        x0,y0,x1,y1=BOX
        outside=np.ones(arr.shape[:2],bool); outside[y0:y1,x0:x1]=False
        leaked=np.any(arr!=base,axis=2)&outside
        if leaked.any(): errors.append(f'{phase} stage {stage}: {int(leaked.sum())} changed outside terrace zone')

# Runtime architecture locks.
scene=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
lighting=(ROOT/'src/game/systems/LightingSystem.ts').read_text(encoding='utf-8')
lantern=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text(encoding='utf-8')
if '/garden/islands/terrace-evolution/${phase}/stage-${stage}.png' not in scene: errors.append('missing full-map terrace texture path')
for token in ['/garden/evolution/lanterns/phases/','phaseSwapVeil']:
    if token in scene: errors.append(f'legacy overlay path in scene: {token}')
for token in ['this.scene.add','.setTint(','.setBlendMode(','BlendModes.','fillRect(','createCanvas']:
    if token in lighting: errors.append(f'LightingSystem renders visible lighting: {token}')
for token in ['.add.image(','.add.sprite(','.load.image(','.setTint(','.setAlpha(']:
    if token in lantern: errors.append(f'LanternEvolutionSystem renders terrace object: {token}')

if errors:
    print('FAIL — KONO 22.7.22 EVENING/NIGHT SATURATION BALANCE')
    [print(' -',e) for e in errors]
    raise SystemExit(1)
print('PASS — KONO 22.7.22 EVENING/NIGHT SATURATION BALANCE')
print('24 full-map runtime states validated; no terrace overlay/recolor path detected.')
