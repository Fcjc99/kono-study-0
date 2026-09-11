from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
MAPS=ROOT/'public/garden/islands/terrace-evolution'
SRC=ROOT/'public/garden/evolution/lanterns/source'
WORLD=(1448,1086)
PHASES=('morning','afternoon','evening','night')
errors=[]

# Stage 0 is the permanent terrain/registration source of truth.
# The lower surrounding terrain is immutable; later stages may only occupy
# the registered terrace deck and explicit decor/pergola growth zones.
s0=np.array(Image.open(SRC/'clean-warped-stage-0.png').convert('RGBA'))
s0_alpha=s0[:,:,3]>=64

for phase in PHASES:
    base_path=MAPS/phase/'stage-0.png'
    if not base_path.exists():
        errors.append(f'missing {phase} stage 0')
        continue
    base=np.array(Image.open(base_path).convert('RGB'))
    if base.shape[:2]!=(WORLD[1],WORLD[0]): errors.append(f'wrong size {phase} stage 0')

    for stage in range(6):
        p=MAPS/phase/f'stage-{stage}.png'
        if not p.exists():
            errors.append(f'missing {phase} stage {stage}')
            continue
        im=Image.open(p)
        if im.size!=WORLD: errors.append(f'wrong size {phase} stage {stage}: {im.size}')
        arr=np.array(im.convert('RGB'))
        # Nothing outside the terrace registration envelope may drift.
        changed=np.any(arr!=base,axis=2)
        allowed=np.zeros(changed.shape,bool)
        # Shared registered terrace envelope: exact patch coordinates used by the build.
        allowed[250:610,900:1330]=True
        leaked=changed & ~allowed
        if leaked.any(): errors.append(f'{phase} stage {stage}: {int(leaked.sum())} changed outside registration envelope')

        # Front stool anchor remains pixel-identical to Stage 0 in every stage.
        # Full-map coordinates correspond to source-canvas [162:252,235:322].
        y0,y1=250+235,250+322
        x0,x1=900+162,900+252
        if np.any(arr[y0:y1,x0:x1] != base[y0:y1,x0:x1]):
            errors.append(f'{phase} stage {stage}: front Stage-0 anchor drift')

        # Stages 1-3 retain the Stage 0 post/bench registration exactly.
        if stage<=3:
            regions=[(250+58,250+188,900+90,900+135),
                     (250+70,250+190,900+245,900+298),
                     (250+75,250+145,900+158,900+258)]
            for yy0,yy1,xx0,xx1 in regions:
                if np.any(arr[yy0:yy1,xx0:xx1] != base[yy0:yy1,xx0:xx1]):
                    errors.append(f'{phase} stage {stage}: Stage-0 post/bench anchor drift')
                    break

# Runtime architecture lock: full maps only, no terrace sprite overlay/recolor.
scene=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
lighting=(ROOT/'src/game/systems/LightingSystem.ts').read_text(encoding='utf-8')
lantern=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text(encoding='utf-8')
if '/garden/islands/terrace-evolution/${phase}/stage-${stage}.png' not in scene:
    errors.append('missing full-map terrace texture path')
for token in ['/garden/evolution/lanterns/phases/','phaseSwapVeil']:
    if token in scene: errors.append(f'legacy terrace overlay path in scene: {token}')
for token in ['this.scene.add','.setTint(','.setBlendMode(','BlendModes.','fillRect(','createCanvas']:
    if token in lighting: errors.append(f'LightingSystem renders visible lighting: {token}')
for token in ['.add.image(','.add.sprite(','.setTint(']:
    if token in lantern: errors.append(f'LanternEvolutionSystem renders terrace overlay object: {token}')

if errors:
    print('FAIL — KONO 22.7.23 STAGE-0 REGISTRATION / NATIVE INTEGRATION')
    for e in errors: print(' -',e)
    raise SystemExit(1)
print('PASS — KONO 22.7.23 STAGE-0 REGISTRATION / NATIVE INTEGRATION')
print('24 full-map states validated; Stage 0 anchors locked; no terrace overlay/recolor path detected.')
