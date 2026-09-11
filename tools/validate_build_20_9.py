#!/usr/bin/env python3
from PIL import Image
import numpy as np
import os

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME=os.path.join(ROOT,"public","garden","evolution","home")
SOURCE=os.path.join(HOME,"source")
phases=["morning","afternoon","evening","night"]
mask=np.array(Image.open(os.path.join(SOURCE,"stage0-house-coverage-mask.png")).convert("RGBA"))[:,:,3]>0
assert mask.shape==(450,500)
assert mask.sum()>20000

for ph in phases:
    for st in range(6):
        p=os.path.join(HOME,f"{ph}-stage-{st}.png")
        assert os.path.exists(p), p
        im=Image.open(p).convert("RGBA")
        assert im.size==(500,450), (p, im.size)
        a=np.array(im.getchannel("A"))
        if st==0:
            assert a.max()==0, f"Stage 0 must remain transparent because the original cottage is baked into the map: {p}"
        else:
            opaque=a>0
            assert opaque.sum()>10000, f"Missing home sprite: {p}"
            assert np.all(opaque[mask]), f"Stage {st} does not fully cover the original Stage 0 house/steps in {ph}"
            border=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]])
            assert np.count_nonzero(border)==0, f"Sprite touches the 500x450 crop border: {p}"

# Distinction: later stages must have materially different alpha footprints.
areas=[]
for st in range(1,6):
    a=np.array(Image.open(os.path.join(HOME,f"afternoon-stage-{st}.png")).convert("RGBA"))[:,:,3]>0
    areas.append(int(a.sum()))
assert areas[2] > areas[1]*1.12, (areas, "Stage 3 should be clearly larger than Stage 2")
assert areas[3] > areas[2]*1.10, (areas, "Stage 4 should be clearly larger than Stage 3")
assert areas[4] > areas[3]*1.05, (areas, "Stage 5 should be clearly larger than Stage 4")
print("PASS: 24 home textures")
print("PASS: transparent full-house sprites (no rectangular terrain patches)")
print("PASS: 100% Stage 0 house/steps coverage for stages 1-5 in all phases")
print("PASS: stages 3-5 have distinct, progressively larger footprints")
print("areas:", areas)
