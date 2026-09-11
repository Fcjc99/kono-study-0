from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parents[1]

def check_transparent_rgb(folder: Path):
    bad=[]
    for p in folder.rglob('*.png'):
        arr=np.array(Image.open(p).convert('RGBA'))
        mask=arr[:,:,3]==0
        if mask.any() and np.any(arr[:,:,:3][mask] != 0):
            bad.append(str(p.relative_to(ROOT)))
    return bad

def main():
    home=ROOT/'public/garden/evolution/home'
    png=home/'afternoon-stage-5.png'
    arr=np.array(Image.open(png).convert('RGBA'))[:,:,3]
    shelf=arr[242:251,88:190].sum()
    assert shelf == 0, f'Stage 5 shelf artifact still present: alpha sum {shelf}'
    bad = []
    for folder in [
        ROOT/'public/garden/evolution/home',
        ROOT/'public/garden/evolution/home/full-silhouette',
        ROOT/'public/garden/evolution/lanterns',
        ROOT/'public/garden/evolution/bridge-fishing',
    ]:
        if folder.exists():
            bad.extend(check_transparent_rgb(folder))
    assert not bad, 'Transparent RGB contamination: ' + ', '.join(bad[:10])
    print('Build 22.1.4 validation passed.')

if __name__=='__main__':
    main()
