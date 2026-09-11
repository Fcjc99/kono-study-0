from pathlib import Path
from PIL import Image
import numpy as np, json, sys

ROOT=Path(__file__).resolve().parents[1]
PHASES=['morning','afternoon','evening','night']
BASE=ROOT/'public/garden/islands/stage-0'
MAPS=ROOT/'public/garden/islands/terrace-evolution'
SPR=ROOT/'public/garden/evolution/lanterns/phases'
errors=[]

for phase in PHASES:
    base=np.array(Image.open(BASE/f'stage0-{phase}.png').convert('RGB'))
    for stage in range(6):
        mp=MAPS/phase/f'stage-{stage}.png'
        sp=SPR/phase/f'terrace-stage-{stage}.png'
        if not mp.exists(): errors.append(f'missing map {mp.relative_to(ROOT)}'); continue
        if not sp.exists(): errors.append(f'missing sprite {sp.relative_to(ROOT)}'); continue
        m=np.array(Image.open(mp).convert('RGB'))
        s=np.array(Image.open(sp).convert('RGBA'))
        if m.shape!=(1086,1448,3): errors.append(f'bad map size {phase} stage {stage}: {m.shape}')
        if s.shape!=(1086,1448,4): errors.append(f'bad sprite size {phase} stage {stage}: {s.shape}')
        allowed=s[:,:,3]>0
        changed=np.any(m!=base,axis=2)
        leaked=int((changed & ~allowed).sum())
        if leaked: errors.append(f'terrain patch leak {phase} stage {stage}: {leaked} pixels outside terrace silhouette')
        if stage==0 and changed.any(): errors.append(f'stage0 {phase} must be byte-pixel identical to native phase base')

scene=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
lighting=(ROOT/'src/game/systems/LightingSystem.ts').read_text()
if 'phaseSwapVeil' in scene: errors.append('phaseSwapVeil still exists')
if 'add.rectangle' in lighting or 'add.image' in lighting or '.setTint' in lighting or 'BlendModes' in lighting:
    errors.append('LightingSystem still renders or tints visible objects')
if '/garden/islands/terrace-evolution/${phase}/stage-${stage}.png' not in scene:
    errors.append('runtime is not loading phase/stage-specific terrace maps')

pkg=json.loads((ROOT/'package.json').read_text())
if pkg.get('version')!='0.99.69-production-22.7.19': errors.append('package version mismatch')
if "0.99.69-production-22.7.19" not in (ROOT/'src/version.ts').read_text(): errors.append('src version mismatch')

if errors:
    print('FAIL — KONO 22.7.19 TERRACE NO-OVERLAY / NO-PATCH')
    for e in errors: print('-',e)
    sys.exit(1)
print('PASS — KONO 22.7.19')
print('24 phase/stage runtime maps validated; zero terrace terrain changes outside clean silhouette; no phase veil; LightingSystem renders no overlays.')
