from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
PHASES=['morning','afternoon','evening','night']
errors=[]
for phase in PHASES:
    for stage in range(6):
        m=ROOT/f'public/garden/islands/terrace-evolution/{phase}/stage-{stage}.png'
        p=ROOT/f'public/garden/evolution/lanterns/native-patches/{phase}/stage-{stage}.png'
        if not m.exists() or Image.open(m).size!=(1448,1086): errors.append(f'bad full map {m}')
        if not p.exists() or Image.open(p).size!=(489,304): errors.append(f'bad patch {p}')
        if p.exists() and Image.open(p).mode not in ('RGB','RGBA'): errors.append(f'bad patch mode {p}')
ref=ROOT/'public/garden/evolution/lanterns/source/clean-terrace-progression-41967.png'
if not ref.exists(): errors.append('missing locked clean reference')
lantern=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
for bad in ['scene.add.image','setBlendMode','setTint','setAlpha(']:
    if bad in lantern: errors.append('runtime terrace visual returned: '+bad)
stage=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
if '/garden/islands/terrace-evolution/' not in stage: errors.append('runtime not loading baked terrace maps')
# Native patches are opaque map crops: no alpha gaps/black matte can exist at runtime.
for phase in PHASES:
    p=np.array(Image.open(ROOT/f'public/garden/evolution/lanterns/native-patches/{phase}/stage-5.png').convert('RGB'))
    if np.mean(np.max(p,axis=2)<8)>0.001: errors.append(f'black matte contamination in {phase} stage5 patch')
if errors:
    print('FAIL — 22.7.15')
    [print('-',e) for e in errors]
    raise SystemExit(1)
print('PASS — 22.7.15 clean reference terrace integration')
