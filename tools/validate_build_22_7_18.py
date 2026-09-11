from pathlib import Path
from PIL import Image
import json, re
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PHASES = ('morning','afternoon','evening','night')
errors=[]

# 24 individually authored runtime PNGs are mandatory.
maps=ROOT/'public/garden/islands/terrace-evolution'
for phase in PHASES:
    for stage in range(6):
        p=maps/phase/f'stage-{stage}.png'
        if not p.exists():
            errors.append(f'missing runtime PNG: {p.relative_to(ROOT)}')
            continue
        im=Image.open(p).convert('RGB')
        if im.size != (1448,1086): errors.append(f'bad runtime size: {phase} stage {stage}: {im.size}')
        a=np.asarray(im)
        # Terrace zone cannot contain a black matte/cutout field.
        zone=a[220:620,840:1370]
        if float(np.mean(np.max(zone,axis=2)<4)) > 0.0005:
            errors.append(f'black-gap contamination: {phase} stage {stage}')

# All four phases must be independently stored, not aliases to one file.
for stage in range(6):
    blobs=[(maps/p/f'stage-{stage}.png').read_bytes() for p in PHASES]
    if len({hash(b) for b in blobs}) != 4:
        errors.append(f'phase PNGs are not independent for stage {stage}')

scene=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
if '/garden/islands/terrace-evolution/${phase}/stage-${stage}.png' not in scene:
    errors.append('Stage0Scene does not load phase/stage-specific full Sanctuary PNGs')
if 'this.phaseSwapVeil.setAlpha(0)' not in scene:
    errors.append('phase swap veil is not hard-disabled')

lighting=(ROOT/'src/game/systems/LightingSystem.ts').read_text()
# Hard runtime no-overlay contract: state only, no render object creation or color operations.
for token in ('scene.add.', '.setTint(', '.setBlendMode(', '.setAlpha(', 'load.image(', 'fillStyle(', 'generateTexture('):
    if token in lighting:
        errors.append(f'LightingSystem still contains rendered overlay path: {token}')
for banned_name in ('darkShade','warmWash','coolWash','directionalHighlight','directionalShadow','moonRim','sunGlow','horizonGlow'):
    if banned_name in lighting:
        errors.append(f'LightingSystem still contains overlay object: {banned_name}')

pkg=json.loads((ROOT/'package.json').read_text())
if pkg.get('version') != '0.99.68-production-22.7.18': errors.append('package version mismatch')
if "0.99.68-production-22.7.18" not in (ROOT/'src/version.ts').read_text(): errors.append('src version mismatch')

# Terrace-specific sprite runtime remains inert: no additional terrace overlay sprites.
lantern=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
for token in ('scene.add.image', '.setTint(', '.setBlendMode('):
    if token in lantern: errors.append(f'LanternEvolutionSystem runtime visual returned: {token}')

if errors:
    print('FAIL — KONO 22.7.18 BAKED PNG / NO LIGHTING OVERLAYS')
    for e in errors: print('-',e)
    raise SystemExit(1)
print('PASS — KONO 22.7.18')
print('24/24 phase-stage Sanctuary PNGs present')
print('LightingSystem is state-only: zero rendered lighting overlays/tints/washes')
print('Terrace runtime uses only individually painted phase PNGs')
