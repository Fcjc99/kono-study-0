from pathlib import Path
from PIL import Image
import numpy as np
import cv2
import json, sys

ROOT=Path(__file__).resolve().parents[1]
PHASES=['morning','afternoon','evening','night']
BASE=ROOT/'public/garden/islands/stage-0'
MAPS=ROOT/'public/garden/islands/terrace-evolution'
SPR=ROOT/'public/garden/evolution/lanterns/phases'
SOURCE=ROOT/'public/garden/evolution/lanterns/source/22.7.19-pre-vibrancy-phases'
errors=[]

for phase in PHASES:
    base=np.array(Image.open(BASE/f'stage0-{phase}.png').convert('RGB'))
    for stage in range(6):
        mp=MAPS/phase/f'stage-{stage}.png'
        sp=SPR/phase/f'terrace-stage-{stage}.png'
        old=SOURCE/phase/f'terrace-stage-{stage}.png'
        if not mp.exists(): errors.append(f'missing map {mp.relative_to(ROOT)}'); continue
        if not sp.exists(): errors.append(f'missing sprite {sp.relative_to(ROOT)}'); continue
        if not old.exists(): errors.append(f'missing pristine source {old.relative_to(ROOT)}'); continue
        m=np.array(Image.open(mp).convert('RGB'))
        s=np.array(Image.open(sp).convert('RGBA'))
        o=np.array(Image.open(old).convert('RGBA'))
        if m.shape!=(1086,1448,3): errors.append(f'bad map size {phase} stage {stage}: {m.shape}')
        if s.shape!=(1086,1448,4): errors.append(f'bad sprite size {phase} stage {stage}: {s.shape}')
        if not np.array_equal(s[:,:,3],o[:,:,3]): errors.append(f'alpha/silhouette changed {phase} stage {stage}')
        allowed=s[:,:,3]>0
        changed=np.any(m!=base,axis=2)
        leaked=int((changed & ~allowed).sum())
        if leaked: errors.append(f'terrain patch leak {phase} stage {stage}: {leaked} pixels outside terrace silhouette')
        if stage==0 and changed.any(): errors.append(f'stage0 {phase} must equal native phase base')
        if phase=='afternoon' and not np.array_equal(s,o): errors.append(f'afternoon changed at stage {stage}; afternoon must remain benchmark')

# Washout regression guard on Stage 5.
def sv(path):
    a=np.array(Image.open(path).convert('RGBA'))
    mask=a[:,:,3]>0
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    return float(hsv[:,:,1][mask].mean()), float(hsv[:,:,2][mask].mean())

for phase in ['morning','evening','night']:
    old_s,old_v=sv(SOURCE/phase/'terrace-stage-5.png')
    new_s,new_v=sv(SPR/phase/'terrace-stage-5.png')
    if new_s <= old_s*1.08: errors.append(f'{phase} saturation improvement too small: {old_s:.1f}->{new_s:.1f}')
    if phase=='night' and new_v <= old_v*1.12: errors.append(f'night value/readability improvement too small: {old_v:.1f}->{new_v:.1f}')

scene=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
lighting=(ROOT/'src/game/systems/LightingSystem.ts').read_text()
if 'phaseSwapVeil' in scene: errors.append('phaseSwapVeil still exists')
if 'add.rectangle' in lighting or 'add.image' in lighting or '.setTint' in lighting or 'BlendModes' in lighting:
    errors.append('LightingSystem still renders or tints visible objects')
if '/garden/islands/terrace-evolution/${phase}/stage-${stage}.png' not in scene:
    errors.append('runtime is not loading phase/stage-specific terrace maps')

pkg=json.loads((ROOT/'package.json').read_text())
if pkg.get('version')!='0.99.70-production-22.7.20': errors.append('package version mismatch')
if '0.99.70-production-22.7.20' not in (ROOT/'src/version.ts').read_text(): errors.append('src version mismatch')

if errors:
    print('FAIL — KONO 22.7.20 TERRACE VIBRANCY / NATIVE MATCH')
    for e in errors: print('-',e)
    sys.exit(1)
print('PASS — KONO 22.7.20')
print('24 runtime maps validated; afternoon preserved; morning/evening/night vibrancy improved; alpha silhouettes unchanged; no terrace lighting overlay.')
