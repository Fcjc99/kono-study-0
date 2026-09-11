#!/usr/bin/env python3
from pathlib import Path
from PIL import Image
import numpy as np, cv2

ROOT=Path(__file__).resolve().parents[1]
HOME=ROOT/'public/garden/evolution/home'
PHASES=['morning','afternoon','evening','night']

# Complete only the missing left edge of the Stage 5 garden arch using mirrored
# pixels from the existing right side. This preserves the original pixel texture
# instead of drawing a new procedural object.
def repair(path:Path):
    im=np.array(Image.open(path).convert('RGBA'))
    out=im.copy()
    xc=119; x1,x2=119,162; y1,y2=242,318
    patch=im[y1:y2,x1:x2].copy()
    rgb=patch[:,:,:3]
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
    R,G,B=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    wood=(patch[:,:,3]>0)&(hsv[:,:,0]>=5)&(hsv[:,:,0]<=28)&(hsv[:,:,1]>=70)&(hsv[:,:,2]>=45)&(R>G*1.12)&(G>B*1.15)
    for sy in range(patch.shape[0]):
        for sx in range(patch.shape[1]):
            if not wood[sy,sx]:
                continue
            dx=xc-1-sx; dy=y1+sy
            # Keep a clean margin and never overwrite existing Stage 5 art.
            if dx>=90 and out[dy,dx,3]==0:
                out[dy,dx]=patch[sy,sx]
    Image.fromarray(out,'RGBA').save(path,optimize=True)

for ph in PHASES:
    src=HOME/'full-silhouette'/f'{ph}-stage-5.png'
    repair(src)
    # Runtime Stage 5 must match the verified full silhouette exactly.
    Image.open(src).save(HOME/f'{ph}-stage-5.png',optimize=True)
print('Stage 5 gate/archway silhouette repaired in all 4 phases')
