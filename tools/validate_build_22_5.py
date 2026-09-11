
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
files=[
    ROOT/'public/garden/fx/critters/birds/bird-sprite-sheet.png',
    ROOT/'public/garden/fx/critters/butterflies/butterfly-sprite-sheet.png',
    ROOT/'public/garden/fx/critters/pond-life/pond-life-sprite-sheet.png',
    ROOT/'public/garden/fx/critters/fireflies/firefly-sprite-sheet.png',
]
for p in files:
    assert p.exists(), p
    arr=np.array(Image.open(p).convert('RGBA'))
    assert arr.shape[2]==4
    alpha=arr[:,:,3]
    assert alpha.max()>0
    # ensure some transparency exists
    assert (alpha==0).sum()>1000, f'not enough transparency in {p.name}'
print('Build 22.5 validation passed.')
