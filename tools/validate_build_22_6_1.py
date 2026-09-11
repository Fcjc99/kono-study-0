from pathlib import Path
from PIL import Image
import numpy as np
import json

ROOT=Path(__file__).resolve().parents[1]
errors=[]

def clean_png(p:Path, require_binary=False):
    arr=np.array(Image.open(p).convert('RGBA'))
    a=arr[:,:,3]
    if np.count_nonzero(arr[a==0,:3]):
        errors.append(f'transparent RGB contamination: {p.relative_to(ROOT)}')
    if require_binary and not set(np.unique(a).tolist()).issubset({0,255}):
        errors.append(f'non-binary alpha: {p.relative_to(ROOT)}')

# Version sync
pkg=json.loads((ROOT/'package.json').read_text())['version']
version_text=(ROOT/'src/version.ts').read_text()
if pkg != '0.99.48-production-22.6.1' or '0.99.48-production-22.6.1' not in version_text:
    errors.append('version metadata not synchronized')

# No legacy firefly runtime pipeline
stage=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
for forbidden in ["/garden/processed/fireflies/", "spawnDriftingSprite('firefly'", "prefix: 'leaf' | 'petal' | 'firefly'"]:
    if forbidden in stage:
        errors.append(f'legacy firefly pipeline remains: {forbidden}')

# Critters clean
crit=ROOT/'public/garden/fx/critters/individual'
for p in crit.rglob('*.png'):
    clean_png(p, require_binary=True)

# Terrace phase PNGs clean and same canvas
for phase in ['morning','afternoon','evening','night']:
    for stage_no in range(1,6):
        p=ROOT/f'public/garden/evolution/lanterns/phases/{phase}/terrace-stage-{stage_no}.png'
        if not p.exists():
            errors.append(f'missing terrace asset {p.relative_to(ROOT)}')
            continue
        im=Image.open(p).convert('RGBA')
        if im.size != (1448,1086):
            errors.append(f'wrong terrace canvas {p.relative_to(ROOT)} {im.size}')
        clean_png(p)

# Stage 5 home covers Stage 0 mask across all phases
mask=np.array(Image.open(ROOT/'public/garden/evolution/home/source/stage0-house-coverage-mask.png').convert('L'))>127
for phase in ['morning','afternoon','evening','night']:
    p=ROOT/f'public/garden/evolution/home/{phase}-stage-5.png'
    arr=np.array(Image.open(p).convert('RGBA'))
    alpha=arr[:,:,3]>0
    if not np.all(alpha[mask]):
        errors.append(f'stage5 home does not fully cover Stage0 mask: {phase}')
    clean_png(p)

# Stage0 maps locked size
for phase in ['morning','afternoon','evening','night']:
    p=ROOT/f'public/garden/islands/stage-0/stage0-{phase}.png'
    if Image.open(p).size != (1448,1086):
        errors.append(f'wrong Stage0 phase canvas: {phase}')

if errors:
    print('\n'.join(errors))
    raise SystemExit(1)
print('Build 22.6.1 final bug cleanup validation passed.')
