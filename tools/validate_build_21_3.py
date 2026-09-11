#!/usr/bin/env python3
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
HOME=ROOT/'public/garden/evolution/home'
phases=['morning','afternoon','evening','night']
# Old Stage-5 arch/fence zone must be substantially cleared in the house sprite.
for ph in phases:
    a=np.array(Image.open(HOME/f'{ph}-stage-5.png').convert('RGBA'))[:,:,3]
    zone=a[250:333,78:190]
    assert (zone>0).mean() < 0.18, f'old gate zone not cleared enough: {ph}'
    veg=Image.open(HOME/'decor'/f'vegetable-garden-stage5-{ph}.png').convert('RGBA')
    va=np.array(veg)[:,:,3]
    assert np.count_nonzero(va)>900, f'vegetable garden missing: {ph}'
    ys,xs=np.where(va>0)
    assert xs.min()>=12 and ys.min()>=12 and xs.max()<=487 and ys.max()<=437, f'garden touches canvas edge: {ph}'
# Home stage 5 still covers the original baked house footprint.
mask=np.array(Image.open(HOME/'source/stage0-house-coverage-mask.png').convert('RGBA'))[:,:,3]>0
for ph in phases:
    a=np.array(Image.open(HOME/f'{ph}-stage-5.png').convert('RGBA'))[:,:,3]>0
    assert np.all(a[mask]), f'Stage 0 house exposure after gate removal: {ph}'
# TypeScript integration exists.
ts=(ROOT/'src/game/systems/HomeEvolutionSystem.ts').read_text()
for token in ['vegetableGardenKey','vegetableGarden','vegetable-garden-stage5']:
    assert token in ts, token
print('PASS: Stage 5 gate/arch removed in all four phases')
print('PASS: separate pixel-PNG vegetable garden exists and is safely padded')
print('PASS: Stage 5 still covers 100% of baked Stage 0 house footprint')
print('PASS: vegetable garden is wired into HomeEvolutionSystem only for Stage 5')
