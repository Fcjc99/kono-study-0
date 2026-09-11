#!/usr/bin/env python3
from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
HOME=ROOT/'public/garden/evolution/home'
FULL=HOME/'full-silhouette'
SRC=HOME/'source'
PHASES=['morning','afternoon','evening','night']
mask=np.array(Image.open(SRC/'stage0-house-coverage-mask.png').convert('RGBA'))[:,:,3]>0

for ph in PHASES:
    for st in range(6):
        p=FULL/f'{ph}-stage-{st}.png'
        assert p.exists(), p
        im=Image.open(p).convert('RGBA')
        assert im.size==(500,450), (p,im.size)
        a=np.array(im.getchannel('A'))
        assert a.max()>0, f'empty full silhouette {p}'
        border=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]])
        assert np.count_nonzero(border)==0, f'sprite touches border/crops silhouette: {p}'
        bb=im.getchannel('A').getbbox(); assert bb
        x0,y0,x1,y1=bb
        assert x0>=10 and y0>=10 and x1<=490 and y1<=440, f'unsafe padding {p}: {bb}'
        lower=(a[max(y0,y1-25):y1]>0).sum()
        assert lower>=700, f'foundation/stairs lower silhouette suspiciously incomplete {p}: {lower}'
        if st>0:
            runtime=Image.open(HOME/f'{ph}-stage-{st}.png').convert('RGBA')
            assert np.array_equal(np.array(runtime),np.array(im)), f'runtime differs from verified silhouette: {ph} s{st}'
            ra=np.array(runtime.getchannel('A'))>0
            assert np.all(ra[mask]), f'Stage 0 exposure remains in {ph} s{st}'


# Runtime map-fit contract. HomeEvolutionSystem places the 500x450 sprite canvas
# at source-map coordinates (100,300). These bounds keep every house on the
# upper-left home lawn, preserve the path approach, and stay clear of the pond.
CROP_X, CROP_Y = 100, 300
SAFE_MAP_RECT = (160, 330, 530, 635)  # left, top, right, bottom
stage0_full = Image.open(FULL/'afternoon-stage-0.png').convert('RGBA')
s0bb = stage0_full.getchannel('A').getbbox(); assert s0bb
s0_entry_x = CROP_X + (s0bb[0] + s0bb[2]) / 2
for st in range(6):
    im = Image.open(FULL/f'afternoon-stage-{st}.png').convert('RGBA')
    bb = im.getchannel('A').getbbox(); assert bb
    mx0,my0,mx1,my1 = CROP_X+bb[0], CROP_Y+bb[1], CROP_X+bb[2], CROP_Y+bb[3]
    sl,stp,sr,sb = SAFE_MAP_RECT
    assert mx0 >= sl and my0 >= stp and mx1 <= sr and my1 <= sb,         f'stage {st} leaves home safe zone: {(mx0,my0,mx1,my1)}'
    # The visible approach/steps remain near the original home's path axis.
    entry_x = CROP_X + (bb[0] + bb[2]) / 2
    assert abs(entry_x - s0_entry_x) <= 35, f'stage {st} drifts off path axis: {entry_x} vs {s0_entry_x}'
    assert 565 <= my1 <= 630, f'stage {st} foundation does not meet home/path elevation: bottom={my1}'


# Build 21.0 lighting foundation continuity (21.1 supersedes the old footprint-ratio test).
LIGHT=ROOT/'public/garden/lighting'
for name,size in {
    'directional-highlight.png':(1024,1024),
    'directional-shadow.png':(1024,1024),
    'moon-rim.png':(1024,1024),
    'sun-glow.png':(512,512),
    'horizon-glow.png':(1024,256),
    'stars-field.png':(1448,520),
}.items():
    p=LIGHT/name
    assert p.exists(), p
    assert Image.open(p).convert('RGBA').size==size, (name,Image.open(p).size)
lighting_ts=(ROOT/'src/game/systems/LightingSystem.ts').read_text()
assert 'scene.make.graphics' not in lighting_ts and 'generateTexture' not in lighting_ts

home_ts=(ROOT/'src/game/systems/HomeEvolutionSystem.ts').read_text()
for token in ['const CROP_X = 100','const CROP_Y = 300','const CROP_WIDTH = 500','const CROP_HEIGHT = 450','setOrigin(0)']:
    assert token in home_ts, f'runtime home anchor/canvas contract changed: {token}'

# Stage 0 remains baked into the island at runtime, but now has a complete explicit reference sprite.
for ph in PHASES:
    rt=Image.open(HOME/f'{ph}-stage-0.png').convert('RGBA')
    assert np.array(rt.getchannel('A')).max()==0, 'runtime stage0 should remain map-painted to avoid double rendering'

for qa in [
    'PRODUCTION-BUILD-21.1-HOME-FULL-SILHOUETTES-QA.png',
    'PRODUCTION-BUILD-21.1-HOME-FOUNDATION-STAIRS-QA.png',
    'PRODUCTION-BUILD-21.1-HOME-STAGES-QA.jpg',
    'PRODUCTION-BUILD-21.1-HOME-ALL-PHASES-QA.jpg',
]:
    assert (ROOT/'docs'/qa).exists(), qa

print('PASS: all 24 full-silhouette phase assets are non-empty and safely padded')
print('PASS: complete lower foundation/stair bands verified on every full silhouette')
print('PASS: runtime stages 1-5 exactly match verified full-silhouette PNGs')
print('PASS: stages 1-5 cover 100% of the baked Stage 0 house footprint')
print('PASS: no home sprite touches/crops any 500x450 canvas edge')
print('PASS: all six homes fit the Sanctuary home lawn and remain aligned to the original path axis')
print('PASS: Build 21.0 raster lighting foundation remains intact in Build 21.1')
