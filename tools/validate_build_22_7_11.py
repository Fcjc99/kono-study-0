from pathlib import Path
from PIL import Image
import numpy as np
import sys

ROOT=Path(__file__).resolve().parents[1]
PHASES=['morning','afternoon','evening','night']
errors=[]
for ph in PHASES:
    for stage in range(6):
        p=ROOT/f'public/garden/evolution/lanterns/phases/{ph}/terrace-stage-{stage}.png'
        if not p.exists():
            errors.append(f'missing {p.relative_to(ROOT)}')
            continue
        im=Image.open(p).convert('RGBA')
        if im.size!=(1448,1086):
            errors.append(f'bad size {p.relative_to(ROOT)} {im.size}')
        a=np.array(im)
        alpha=a[:,:,3]
        if stage==0 and np.any(alpha>0):
            errors.append(f'stage0 must be transparent: {ph}')
        if stage>0 and not np.any(alpha>0):
            errors.append(f'empty stage: {ph} {stage}')
        if np.any(np.any(a[alpha==0,:3]!=0,axis=1)):
            errors.append(f'transparent RGB contamination: {ph} {stage}')
        ys,xs=np.where(alpha>0)
        if len(xs):
            if xs.min()<850 or xs.max()>1300 or ys.min()<250 or ys.max()>620:
                errors.append(f'growth escaped terrace zone: {ph} {stage} bbox={(xs.min(),ys.min(),xs.max(),ys.max())}')

# cumulative coverage should not shrink as stages grow (minor fluctuations allowed visually, but alpha pixel count should trend up)
for ph in PHASES:
    counts=[]
    for stage in range(1,6):
        a=np.array(Image.open(ROOT/f'public/garden/evolution/lanterns/phases/{ph}/terrace-stage-{stage}.png').convert('RGBA'))[:,:,3]
        counts.append(int((a>0).sum()))
    for i in range(1,len(counts)):
        if counts[i] < counts[i-1]*0.92:
            errors.append(f'non-cumulative coverage trend {ph}: {counts}')
            break

if errors:
    print('Build 22.7.11 terrace validation FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('Build 22.7.11 terrace validation PASSED')
