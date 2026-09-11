from pathlib import Path
from PIL import Image, ImageEnhance
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'public/garden/evolution/lanterns'
ISLAND = ROOT / 'public/garden/islands/stage-0'
PHASE = SRC / 'phases'
EMISSIVE = SRC / 'emissive'
for d in (PHASE/'afternoon', PHASE/'evening', EMISSIVE): d.mkdir(parents=True, exist_ok=True)

base_afternoon = np.asarray(Image.open(ISLAND/'stage0-afternoon.png').convert('RGB')).astype(np.float32)
base_evening = np.asarray(Image.open(ISLAND/'stage0-evening.png').convert('RGB')).astype(np.float32)
phase_delta = base_evening - base_afternoon

# Runtime lantern anchors, in production 1448x1086 coordinates.
ANCHORS = [
    (0.716, 0.360), (0.737, 0.363), (0.758, 0.366), (0.779, 0.369),
    (0.801, 0.372), (0.718, 0.475), (0.838, 0.470),
]
ACTIVE = [0, 0, 5, 5, 6, 7]


def grade_afternoon(im: Image.Image) -> Image.Image:
    a = im.getchannel('A')
    rgb = ImageEnhance.Contrast(im.convert('RGB')).enhance(1.025)
    rgb = ImageEnhance.Color(rgb).enhance(1.02)
    arr = np.asarray(rgb).astype(np.float32)
    arr += np.array([1.0, 1.2, 2.0], dtype=np.float32)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    out = Image.fromarray(arr, 'RGB').convert('RGBA')
    out.putalpha(a)
    return out


def grade_evening(im: Image.Image) -> Image.Image:
    alpha = np.asarray(im.getchannel('A')).astype(np.uint8)
    arr = np.asarray(im.convert('RGB')).astype(np.float32)
    # Transfer the actual Stage-0 afternoon→evening lighting shift at the same map pixels.
    # This preserves exact terrace art while making it belong to the existing dusk palette.
    arr = arr + phase_delta * 0.92
    # Small practical-light protection so tea/lantern highlights don't turn muddy.
    lum = 0.2126*arr[...,0] + 0.7152*arr[...,1] + 0.0722*arr[...,2]
    warm = (arr[...,0] > arr[...,2]*1.25) & (arr[...,1] > arr[...,2]*1.08) & (lum > 125) & (alpha > 0)
    arr[...,0][warm] += 7
    arr[...,1][warm] += 4
    arr[...,2][warm] += 1
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    out = Image.fromarray(arr, 'RGB').convert('RGBA')
    out.putalpha(Image.fromarray(alpha, 'L'))
    return out


def emissive_stage(size, stage):
    w,h=size
    out=np.zeros((h,w,4),dtype=np.uint8)
    for i,(nx,ny) in enumerate(ANCHORS[:ACTIVE[stage]]):
        x=int(round(nx*w)); y=int(round(ny*h))
        # crisp pixel practicals only; diffuse glow remains Phaser's glow sprite.
        for dy,dx,a in ((0,0,220),(0,1,150),(0,-1,150),(1,0,150),(-1,0,150),(1,1,70),(1,-1,70),(-1,1,70),(-1,-1,70)):
            xx,yy=x+dx,y+dy
            if 0<=xx<w and 0<=yy<h:
                out[yy,xx,:3]=(255,220,132); out[yy,xx,3]=max(out[yy,xx,3],a)
    return Image.fromarray(out,'RGBA')

for stage in range(6):
    p = SRC / f'terrace-stage-{stage}.png'
    im = Image.open(p).convert('RGBA')
    if stage == 0:
        im.save(PHASE/'afternoon'/p.name)
        im.save(PHASE/'evening'/p.name)
        Image.new('RGBA', im.size, (0,0,0,0)).save(EMISSIVE/f'evening-stage-{stage}.png')
        continue
    grade_afternoon(im).save(PHASE/'afternoon'/p.name)
    grade_evening(im).save(PHASE/'evening'/p.name)
    emissive_stage(im.size, stage).save(EMISSIVE/f'evening-stage-{stage}.png')

print('Terrace 21.8 afternoon/evening phase assets generated.')
