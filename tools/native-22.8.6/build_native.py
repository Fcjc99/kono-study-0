"""Register original phase paintings without changing their palette or sky.

Only nearest-neighbour spatial sampling is used for the small terrain offsets.
The original paintings and previously shipped asset directories remain untouched.
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
import json, hashlib, sys

ROOT = Path(sys.argv[1])
OUT = Path(sys.argv[2])
HERE = Path(__file__).parent
W, H = 1448, 1086
PHASES = ['morning', 'afternoon', 'evening', 'night']
manifest = {'build': '22.8.6', 'palette': 'original-stage0-22.7.28', 'assets': [], 'sources': {}}
def read(rel):
    p = ROOT / rel
    manifest['sources'][rel] = hashlib.sha256(p.read_bytes()).hexdigest()
    return np.array(Image.open(p).convert('RGBA'))
def save(a, rel):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(a.astype('uint8')).save(p)
    manifest['assets'].append({'path': rel, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
                              'width': a.shape[1], 'height': a.shape[0]})
landmarks = json.loads((HERE/'landmarks.json').read_text())
overlays = json.loads((HERE/'overlay-landmarks.json').read_text())
native = {p: read(f'public/garden/islands/stage-0/stage0-{p}.png') for p in PHASES}
def register(phase):
    if phase == 'afternoon': return native[phase].copy()
    points = [(v['canonicalCenter'], v['nativeMinusAfternoon']) for v in landmarks[phase].values()]
    points += [(v['center'], v['offset']) for k,v in overlays[phase].items() if k != 'homeRoofLeft']
    points += [([x,y],[0,0]) for x in [0,180,450,724,1100,1447] for y in [0,140,1085]]
    points += [([0,y],[0,0]) for y in [300,550,800]] + [([1447,y],[0,0]) for y in [300,550,800]]
    yy,xx = np.mgrid[0:H:4,0:W:4].astype('float32')
    accum = np.zeros((*xx.shape,2), dtype='float32'); denom = np.zeros(xx.shape,dtype='float32')
    for (px,py), offset in points:
        weight = 1 / np.maximum((xx-px)**2+(yy-py)**2, 1)**2
        accum += weight[:,:,None] * np.array(offset,dtype='float32'); denom += weight
    field = accum / denom[:,:,None]
    dx,dy = [np.array(Image.fromarray(field[:,:,c]).resize((W,H),Image.Resampling.BILINEAR)) for c in range(2)]
    y,x = np.mgrid[0:H,0:W]
    # Keep the reference sun, moon, upper sky and frame pixels exactly original.
    protected = (y<145) | ((x<180)&(y<420))
    dx[protected]=0; dy[protected]=0
    sx=np.clip(np.rint(x+dx).astype(int),0,W-1); sy=np.clip(np.rint(y+dy).astype(int),0,H-1)
    return native[phase][sy,sx]
base={p:register(p) for p in PHASES}

# Match only the new terrace/clearing to the original local lighting. The
# original full paintings are NEVER color-graded into other phases.
def local_grade(phase):
    if phase=='afternoon': return np.ones(3),np.zeros(3)
    a=base['afternoon'][434:498,1040:1140,:3].reshape(-1,3).astype(float)
    b=base[phase][434:498,1040:1140,:3].reshape(-1,3).astype(float)
    gain=np.clip(np.median(b,axis=0)/np.maximum(np.median(a,axis=0),1),.15,1.1)
    return gain,np.zeros(3)
def grade(a,phase):
    gain,bias=local_grade(phase)
    b=a.copy(); b[:,:,:3]=np.clip(np.rint(a[:,:,:3]*gain+bias),0,255)
    return b
ground=read('tools/terrace-22.8.3/inputs/ground-afternoon.png')
terrace_area=(940,350,1270,565)
x0,y0,x1,y1=terrace_area
yy,xx=np.mgrid[y0:y1,x0:x1]
feather=np.minimum.reduce([np.ones_like(xx), (xx-x0)/8,(x1-1-xx)/8,(yy-y0)/8,(y1-1-yy)/8])[:,:,None]
# Grass-only local median match avoids transferring the original deck's wood
# exposure onto the clearing.
for phase in PHASES:
    clean=base[phase].copy()
    ga=ground[y0:y1,x0:x1,:3].astype(float)
    source=base['afternoon'][550:574,975:1235,:3].reshape(-1,3)
    target=base[phase][550:574,975:1235,:3].reshape(-1,3)
    gain=np.clip(np.median(target,axis=0)/np.maximum(np.median(source,axis=0),1),.15,1.3)
    patch=np.clip(ga*gain,0,255)
    # The clearing plate includes afternoon sky outside the island. Never
    # transplant that sky into another phase: use only its grass pixels.
    terrain=(ga[:,:,1]>ga[:,:,2]*1.12)&(ga[:,:,0]>ga[:,:,2]*1.05)
    weight=feather*terrain[:,:,None]
    clean[y0:y1,x0:x1,:3]=np.rint(clean[y0:y1,x0:x1,:3]*(1-weight)+patch*weight)
    for stage in range(6):
        result=base[phase].copy()
        if stage:
            sprite=read(f'tools/terrace-22.8.3/inputs/stage-{stage}.png')
            assert set(np.unique(sprite[:,:,3])) <= {0,255}, 'Unclean terrace alpha'
            sprite=grade(sprite,phase)
            canvas=Image.fromarray(clean); canvas.alpha_composite(Image.fromarray(sprite),(960,552-sprite.shape[0]))
            result=np.array(canvas)
        save(result,f'islands/terrace-evolution/{phase}/stage-{stage}.png')

for phase in PHASES:
    for family in ['home','cherry-tree']:
        for stage in range(6):
            rel=f'evolution/{family}/{phase}-stage-{stage}.png'
            a=read('public/garden/'+rel)
            if family=='home' and stage==0:
                # Stage 0 is painted in the native map, never a second house.
                a[:]=0
            if family=='home' and stage:
                cleaned=HERE/'home-clean'/f'{phase}-stage-{stage}.png'
                if cleaned.exists(): a=np.array(Image.open(cleaned).convert('RGBA'))
            save(a,rel)
    rel=f'evolution/home/decor/vegetable-garden-stage5-{phase}.png'
    save(read('public/garden/'+rel),rel)
    for state in ['idle','cast']:
        rel=f'evolution/bridge-fishing/phases/{phase}/bridge-fishing-{state}.png'
        save(read('public/garden/'+rel),rel)

# Removing the opaque old-roof fringe must not reveal the original map-painted
# roof underneath. A separate tiny terrain repair sits BELOW the clean sprites.
# It only fills exposed coverage pixels, sampled from immediately above the
# original roof in the same registered painting; it is not part of silhouette.
coverage=read('public/garden/evolution/home/source/stage0-house-coverage-mask.png')[:,:,3]
coverage=np.array(Image.fromarray(coverage).filter(ImageFilter.MaxFilter(5)))>0
exposed=np.zeros(coverage.shape,dtype=bool)
for stage in range(1,6):
    home=np.array(Image.open(OUT/f'evolution/home/afternoon-stage-{stage}.png').convert('RGBA'))
    exposed |= coverage & (home[:,:,3]==0)
top=np.argmax(coverage,axis=0)
ey,ex=np.where(exposed)
for phase in PHASES:
    repair=np.zeros((450,500,4),dtype='uint8')
    sy=np.maximum(0,300+top[ex]-6-(ey-top[ex])%18)
    repair[ey,ex,:3]=base[phase][sy,100+ex,:3]
    repair[ey,ex,3]=255
    save(repair,f'evolution/home/{phase}-roof-underlay.png')

# Water receives its RGB from the exact registered phase painting, with the
# existing animation's small signed motion detail. Alpha stays inside the
# proven canonical water-only masks, preventing phase-colored rectangles.
crops={'ocean':(0,420,1448,666),'pond':(520,525,515,285),'waterfall':(480,790,145,215),'foam':(455,915,195,100)}
old=read('public/garden/registered-22.8.4/islands/terrace-evolution/afternoon/stage-0.png')
for layer,(x,y,w,h) in crops.items():
    baseline=old[y:y+h,x:x+w,:3].astype(float)
    for frame in range(12):
        a=read(f'public/garden/production-water/afternoon-{layer}-{frame}.png')
        detail=np.clip(a[:,:,:3].astype(float)-baseline,-22,22)
        for phase in PHASES:
            result=a.copy()
            gain=np.clip(np.mean(base[phase][y:y+h,x:x+w,:3],axis=(0,1))/np.maximum(np.mean(base['afternoon'][y:y+h,x:x+w,:3],axis=(0,1)),1),.15,1.1)
            result[:,:,:3]=np.clip(np.rint(base[phase][y:y+h,x:x+w,:3]+detail*gain),0,255)
            save(result,f'production-water/{phase}-{layer}-{frame}.png')
manifest['terrace']={'left':960,'bottom':552,'clear':terrace_area}
manifest['registration']={'landmarks':landmarks,'overlays':overlays,'sampling':'nearest','protectedSkyRows':145}
(OUT/'registration.json').write_text(json.dumps(manifest,indent=2))
sheet=Image.new('RGB',(1448,1126),'white'); draw=ImageDraw.Draw(sheet)
for i,phase in enumerate(PHASES):
    im=Image.open(OUT/f'islands/terrace-evolution/{phase}/stage-5.png').convert('RGBA')
    im.alpha_composite(Image.open(OUT/f'evolution/home/{phase}-roof-underlay.png').convert('RGBA'),(100,300))
    home=Image.open(OUT/f'evolution/home/{phase}-stage-5.png').convert('RGBA'); im.alpha_composite(home,(100,300))
    tree=Image.open(OUT/f'evolution/cherry-tree/{phase}-stage-5.png').convert('RGBA').resize((410,430),Image.Resampling.NEAREST)
    im.alpha_composite(tree,(499,272-round(430*624/650)))
    x=(i%2)*724; y=(i//2)*563
    draw.text((x+5,y+4),phase,fill='black'); sheet.paste(im.resize((724,543),Image.Resampling.LANCZOS).convert('RGB'),(x,y+20))
sheet.save(OUT.parent/'preview-native.png')
print(f'Built {len(manifest["assets"])} original-palette assets; originals unchanged.')
