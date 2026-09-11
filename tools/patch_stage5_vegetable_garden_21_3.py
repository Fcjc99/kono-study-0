#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
HOME=ROOT/'public/garden/evolution/home'
DECOR=HOME/'decor'
DOCS=ROOT/'docs'
ISLAND=ROOT/'public/garden/islands/stage-0'
DECOR.mkdir(parents=True,exist_ok=True)
DOCS.mkdir(parents=True,exist_ok=True)
PHASES=['morning','afternoon','evening','night']
SIZE=(500,450)

# The unwanted Stage-5 fence/arch is entirely separated from the house in this lower-left zone.
# Remove only that zone so the complete house/foundation/stairs remain untouched.
CLEAR_BOX=(78,250,190,333)

def remove_arch(path:Path):
    im=Image.open(path).convert('RGBA')
    a=np.array(im)
    x0,y0,x1,y1=CLEAR_BOX
    a[y0:y1,x0:x1]=0
    Image.fromarray(a,'RGBA').save(path,optimize=True)


def draw_garden() -> Image.Image:
    # Tiny hand-built pixel-art raised vegetable bed, deliberately kept compact.
    # Draw at low resolution and keep nearest-neighbor pixels crisp.
    w,h=92,58
    im=Image.new('RGBA',(w,h),(0,0,0,0))
    d=ImageDraw.Draw(im)
    # contact shadow
    d.polygon([(9,38),(70,46),(85,39),(23,31)], fill=(54,44,29,70))
    # isometric-ish wooden raised bed
    outer=[(8,18),(73,25),(82,42),(17,35)]
    d.polygon(outer, fill=(104,65,34,255))
    inner=[(15,19),(68,25),(75,37),(22,32)]
    d.polygon(inner, fill=(72,46,29,255))
    # wood highlights / rails
    d.line([(8,18),(73,25),(82,42)], fill=(171,112,56,255), width=3)
    d.line([(17,35),(82,42)], fill=(139,86,42,255), width=3)
    d.line([(15,19),(68,25),(75,37),(22,32),(15,19)], fill=(195,132,66,255), width=2)
    # corner posts
    for x,y in [(8,17),(73,24),(17,34),(82,41)]:
        d.rectangle((x-2,y-6,x+2,y+2), fill=(116,72,37,255))
        d.rectangle((x-1,y-6,x+1,y-4), fill=(196,137,73,255))
    # three crop rows (leafy greens + carrots/tomatoes)
    rows=[[(24,23),(35,24),(46,26),(57,27)],[(25,28),(37,29),(49,30),(61,31)],[(28,33),(40,34),(52,35),(64,36)]]
    for ri,row in enumerate(rows):
        for j,(x,y) in enumerate(row):
            # 2x2/3x3 blocky leaves
            leaf=(74,124,44,255) if (ri+j)%2==0 else (91,144,52,255)
            d.rectangle((x-3,y-3,x+2,y+2), fill=leaf)
            d.rectangle((x-1,y-5,x+1,y+1), fill=(109,158,60,255))
            d.rectangle((x-5,y-1,x-2,y+1), fill=(65,110,39,255))
            # produce accents
            if ri==1 and j in (1,3):
                d.rectangle((x,y,x+2,y+2), fill=(191,65,39,255))
            if ri==2 and j in (0,2):
                d.rectangle((x,y+1,x+2,y+3), fill=(220,112,35,255))
    # tiny garden sign / tool post for character
    d.rectangle((8,8,11,24), fill=(106,67,37,255))
    d.rectangle((6,6,18,13), fill=(158,102,54,255))
    d.rectangle((8,8,16,10), fill=(197,140,75,255))
    return im


def fit_transform(src:np.ndarray,dst:np.ndarray):
    m=(src[:,:,3]>0)&(dst[:,:,3]>0)
    yy,xx=np.where(m)
    if len(xx)>20000:
        idx=np.linspace(0,len(xx)-1,20000).astype(int); yy=yy[idx]; xx=xx[idx]
    X=np.concatenate([src[yy,xx,:3].astype(np.float32),np.ones((len(xx),1),np.float32)],axis=1)
    Y=dst[yy,xx,:3].astype(np.float32)
    return np.linalg.lstsq(X,Y,rcond=None)[0].T


def apply_transform(im:Image.Image,M:np.ndarray):
    a=np.array(im.convert('RGBA'))
    mask=a[:,:,3]>0
    X=np.concatenate([a[:,:,:3].reshape(-1,3).astype(np.float32),np.ones((a.shape[0]*a.shape[1],1),np.float32)],axis=1)
    rgb=np.clip(X@M.T,0,255).astype(np.uint8).reshape(a.shape[0],a.shape[1],3)
    a[:,:,:3]=rgb; a[~mask,:3]=0
    return Image.fromarray(a,'RGBA')

# Remove the gate/fence from BOTH verified silhouettes and runtime Stage 5 sprites.
for ph in PHASES:
    for p in [HOME/'full-silhouette'/f'{ph}-stage-5.png', HOME/f'{ph}-stage-5.png']:
        remove_arch(p)

# Garden master and phase-matched overlays on the same 500x450 home canvas.
garden=draw_garden()
master=Image.new('RGBA',SIZE,(0,0,0,0))
master.alpha_composite(garden,(101,258))
master.save(DECOR/'vegetable-garden-stage5-afternoon.png',optimize=True)

# Learn the established home phase grades from the Stage 5 sprites.
af=np.array(Image.open(HOME/'afternoon-stage-5.png').convert('RGBA'))
for ph in ['morning','evening','night']:
    dst=np.array(Image.open(HOME/f'{ph}-stage-5.png').convert('RGBA'))
    M=fit_transform(af,dst)
    apply_transform(master,M).save(DECOR/f'vegetable-garden-stage5-{ph}.png',optimize=True)

# QA: real Sanctuary maps, Stage 5 with clean house + garden overlay.
phase_panels=[]
for ph in PHASES:
    base=Image.open(ISLAND/f'stage0-{ph}.png').convert('RGBA')
    home=Image.open(HOME/f'{ph}-stage-5.png').convert('RGBA')
    veg=Image.open(DECOR/f'vegetable-garden-stage5-{ph}.png').convert('RGBA')
    base.alpha_composite(home,(100,300)); base.alpha_composite(veg,(100,300))
    # crop to map art, but keep enough context
    panel=base.resize((724,543),Image.Resampling.LANCZOS).convert('RGB')
    d=ImageDraw.Draw(panel); d.rectangle((8,8,156,36),fill=(17,20,24)); d.text((16,15),ph.title(),fill='white')
    phase_panels.append(panel)
qa=Image.new('RGB',(1448,1086),(20,22,26))
for i,p in enumerate(phase_panels): qa.paste(p,((i%2)*724,(i//2)*543))
qa.save(DOCS/'PRODUCTION-BUILD-21.3-STAGE5-VEGETABLE-GARDEN-ALL-PHASES-QA.jpg',quality=92)

# Closeup QA on checkerboard showing house and separate garden asset placement.
bg=Image.new('RGB',SIZE,(218,218,218)); dd=ImageDraw.Draw(bg); t=16
for y in range(0,SIZE[1],t):
    for x in range(0,SIZE[0],t):
        if (x//t+y//t)%2: dd.rectangle((x,y,x+t-1,y+t-1),fill=(242,242,242))
home=Image.open(HOME/'afternoon-stage-5.png').convert('RGBA'); veg=Image.open(DECOR/'vegetable-garden-stage5-afternoon.png').convert('RGBA')
bg.paste(home,(0,0),home); bg.paste(veg,(0,0),veg)
dd=ImageDraw.Draw(bg); dd.rectangle((8,8,250,38),fill=(17,20,24)); dd.text((16,16),'Stage 5 - gate removed + vegetable garden',fill='white')
bg.save(DOCS/'PRODUCTION-BUILD-21.3-STAGE5-VEGETABLE-GARDEN-SPRITE-QA.png')
print('Stage 5 gate/fence removed; vegetable garden overlays created for all phases.')
