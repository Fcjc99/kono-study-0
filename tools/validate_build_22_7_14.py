from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
PHASES=['morning','afternoon','evening','night']
errors=[]
PATCH_SIZE=(489,304)
for phase in PHASES:
    for stage in range(6):
        m=ROOT/f'public/garden/islands/terrace-evolution/{phase}/stage-{stage}.png'
        p=ROOT/f'public/garden/evolution/lanterns/native-patches/{phase}/stage-{stage}.png'
        if not m.exists() or Image.open(m).size!=(1448,1086): errors.append(f'bad full map {m}')
        if not p.exists() or Image.open(p).size!=PATCH_SIZE: errors.append(f'bad native patch {p}')
# Runtime remains map-native.
lantern=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
for bad in ['scene.add.image','setBlendMode','setTint','setAlpha(']:
    if bad in lantern: errors.append('runtime terrace visual returned: '+bad)
stage=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
if '/garden/islands/terrace-evolution/' not in stage: errors.append('Stage0Scene not loading map-native terrace maps')
render=(ROOT/'src/components/GardenCard.tsx').read_text()
for required in ['antialias: true','pixelArt: false','roundPixels: false']:
    if required not in render: errors.append('renderer smoothing missing: '+required)
if errors:
    print('FAIL — 22.7.14')
    [print('-',e) for e in errors]
    raise SystemExit(1)
print('PASS — 22.7.14 terrace native patch production')
