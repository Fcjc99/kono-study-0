
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
crit=ROOT/'public/garden/fx/critters'
files=list((crit/'individual').rglob('*.png'))+[
    crit/'birds/bird-sprite-sheet.png',
    crit/'butterflies/butterfly-sprite-sheet.png',
    crit/'pond-life/pond-life-sprite-sheet.png',
    crit/'fireflies/firefly-sprite-sheet.png',
]
for p in files:
    arr=np.array(Image.open(p).convert('RGBA'))
    a=arr[:,:,3]
    uniq=set(np.unique(a).tolist())
    assert uniq.issubset({0,255}), f'non-binary alpha in {p.name}: {uniq}'
    assert np.count_nonzero(arr[a==0,:3])==0, f'transparent RGB contamination in {p.name}'
print('Build 22.5.2 validation passed.')
