#!/usr/bin/env python3
from PIL import Image
import numpy as np
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
HOME=ROOT/'public/garden/evolution/home'
LIGHT=ROOT/'public/garden/lighting'
SOURCE=HOME/'source'
phases=['morning','afternoon','evening','night']
mask=np.array(Image.open(SOURCE/'stage0-house-coverage-mask.png').convert('RGBA'))[:,:,3]>0
assert mask.shape==(450,500)

areas=[]
for ph in phases:
    for st in range(6):
        p=HOME/f'{ph}-stage-{st}.png'
        assert p.exists(), p
        im=Image.open(p).convert('RGBA')
        assert im.size==(500,450), (p, im.size)
        a=np.array(im.getchannel('A'))
        if st==0:
            assert a.max()==0, f'stage0 must stay map-painted: {p}'
        else:
            opaque=a>0
            assert np.all(opaque[mask]), f'stage {st} no longer covers stage0 in {ph}'
            border=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]])
            assert np.count_nonzero(border)==0, f'sprite touches crop border: {p}'
            rgb=np.array(im)[:,:,:3]
            accidental_black=opaque & (rgb.max(axis=2)<24)
            assert accidental_black.sum()==0, f'near-black extraction hole in {p}: {accidental_black.sum()} px'
    
for st in range(1,6):
    a=np.array(Image.open(HOME/f'afternoon-stage-{st}.png').convert('RGBA'))[:,:,3]>0
    areas.append(int(a.sum()))

# Rebalance contract: stage3 stays close to stage2, then detail density grows without giant footprint jumps.
assert 0.90 <= areas[2]/areas[1] <= 1.12, ('stage3 should stay near stage2 footprint', areas)
assert areas[3] > areas[2]*1.10, ('stage4 should read as richer, not enormous', areas)
assert areas[4] > areas[3]*1.06, ('stage5 should be distinct', areas)
assert areas[4] < areas[2]*1.35, ('stage5 footprint grew too much', areas)

for st in range(1,6):
    p=HOME/f'ground-shadow-stage-{st}.png'
    assert p.exists(), p
    assert Image.open(p).convert('RGBA').size==(500,450)
for frame in range(1,4):
    p=HOME/'fx'/f'chimney-smoke-{frame:02d}.png'
    assert p.exists(), p
    assert Image.open(p).convert('RGBA').size==(32,36)

lighting_assets={
    'directional-highlight.png':(1024,1024),
    'directional-shadow.png':(1024,1024),
    'moon-rim.png':(1024,1024),
    'sun-glow.png':(512,512),
    'horizon-glow.png':(1024,256),
    'stars-field.png':(1448,520),
}
for name,size in lighting_assets.items():
    p=LIGHT/name
    assert p.exists(), p
    assert Image.open(p).convert('RGBA').size==size, (name,Image.open(p).size)

lighting_ts=(ROOT/'src/game/systems/LightingSystem.ts').read_text()
foundation_ts=(ROOT/'src/game/sanctuary/lightingFoundation.ts').read_text()
home_ts=(ROOT/'src/game/systems/HomeEvolutionSystem.ts').read_text()
scene_ts=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
assert 'LightingSystem.preload(this)' in scene_ts
assert 'scene.make.graphics' not in lighting_ts and 'generateTexture' not in lighting_ts
for token in ['lightOrigin','shadowFocus','contactShadowStrength','waterReflectionStrength']:
    assert token in foundation_ts, token
for token in ['ground-shadow-stage','chimney-smoke','stage >= 4','LIGHTING_FOUNDATION']:
    assert token in home_ts, token

print('PASS: Build 21.0 home stages retain 100% Stage 0 coverage')
print('PASS: Stage 3-5 footprint growth rebalanced; later evolution is detail-led')
print('PASS: Stage 2-5 perimeter repair + black-hole rejection')
print('PASS: contact-shadow PNGs and chimney-smoke PNG frames')
print('PASS: raster lighting foundation assets; no generated graphics in LightingSystem')
print('areas:', areas)
