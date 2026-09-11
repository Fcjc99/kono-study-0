#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw
import cv2, numpy as np

ROOT=Path(__file__).resolve().parents[1]
HOME=ROOT/'public/garden/evolution/home'
SRC=HOME/'source'
ISLAND=ROOT/'public/garden/islands/stage-0'
DOCS=ROOT/'docs'
FULL=HOME/'full-silhouette'
BASELINE=SRC/'baseline-21.0'
FULL.mkdir(parents=True,exist_ok=True)
PHASES=['morning','afternoon','evening','night']
SIZE=(500,450)


def source_house_mask(stage:int)->np.ndarray:
    bgr=cv2.imread(str(SRC/f'approved-stage-{stage}.png'),cv2.IMREAD_COLOR)
    h,w=bgr.shape[:2]
    m=np.zeros((h,w),np.uint8); bg=np.zeros((1,65),np.float64); fg=np.zeros((1,65),np.float64)
    cv2.setRNGSeed(0)
    cv2.grabCut(bgr,m,(12,8,w-24,h-16),bg,fg,12,cv2.GC_INIT_WITH_RECT)
    a=np.where((m==cv2.GC_FGD)|(m==cv2.GC_PR_FGD),255,0).astype(np.uint8)
    # Preserve thin posts/stairs by joining tiny one-pixel breaks.
    a=cv2.morphologyEx(a,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)),iterations=1)
    # A stage-specific broad house envelope prevents GrabCut from treating sky/grass
    # as part of the foreground while leaving the complete roof/foundation/stairs intact.
    polys={
      0:[(82,48),(365,48),(395,225),(382,310),(330,360),(135,350),(82,255)],
      1:[(78,46),(370,46),(400,235),(385,320),(330,360),(125,350),(74,255)],
      2:[(58,30),(382,30),(410,255),(390,335),(345,365),(110,355),(58,270)],
      3:[(48,22),(400,22),(425,270),(398,345),(345,370),(88,365),(45,275)],
      4:[(30,18),(438,18),(442,290),(410,345),(355,372),(72,365),(28,265)],
      5:[(18,16),(438,16),(442,320),(412,370),(350,397),(62,390),(18,285)],
    }
    env=np.zeros_like(a)
    cv2.fillPoly(env,[np.array(polys[stage],np.int32)],255)
    keep=cv2.bitwise_and(a,env)
    # Remove residual sky/cloud pixels that GrabCut can attach to the upper roof edge.
    hsv=cv2.cvtColor(bgr,cv2.COLOR_BGR2HSV)
    yy=np.indices(keep.shape)[0]
    sky=((hsv[:,:,0]>=82)&(hsv[:,:,0]<=112)&(hsv[:,:,1]>=18)&(hsv[:,:,2]>=105)&(yy<155)) | ((hsv[:,:,1]<35)&(hsv[:,:,2]>215)&(yy<145))
    keep[sky]=0
    # Keep tiny attached details (rails/vines/planters), while dropping remote props.
    n,lab,stats,_=cv2.connectedComponentsWithStats(keep,8)
    if n<=1: return keep
    comps=sorted(range(1,n),key=lambda i:stats[i,cv2.CC_STAT_AREA],reverse=True)
    main=comps[0]; out=np.zeros_like(keep); out[lab==main]=255
    dil=cv2.dilate((out>0).astype(np.uint8),np.ones((9,9),np.uint8),iterations=1)>0
    for i in comps[1:]:
        if stats[i,cv2.CC_STAT_AREA]>=10 and np.any((lab==i)&dil): out[lab==i]=255
    return out


def bbox(mask:np.ndarray):
    ys,xs=np.where(mask>0)
    return (xs.min(),ys.min(),xs.max()+1,ys.max()+1)


def fit_color_transform(src_rgba:np.ndarray,dst_rgba:np.ndarray):
    m=(src_rgba[:,:,3]>0)&(dst_rgba[:,:,3]>0)
    yy,xx=np.where(m)
    if len(xx)>15000:
        idx=np.linspace(0,len(xx)-1,15000).astype(int); yy=yy[idx]; xx=xx[idx]
    X=np.concatenate([src_rgba[yy,xx,:3].astype(np.float32),np.ones((len(xx),1),np.float32)],axis=1)
    Y=dst_rgba[yy,xx,:3].astype(np.float32)
    if len(X)<50:
        return np.array([[1,0,0,0],[0,1,0,0],[0,0,1,0]],np.float32)
    M=np.linalg.lstsq(X,Y,rcond=None)[0].T
    return M


def apply_color(im:Image.Image,M:np.ndarray)->Image.Image:
    a=np.array(im.convert('RGBA'))
    mask=a[:,:,3]>0
    X=np.concatenate([a[:,:,:3].reshape(-1,3).astype(np.float32),np.ones((a.shape[0]*a.shape[1],1),np.float32)],axis=1)
    rgb=np.clip(X@M.T,0,255).astype(np.uint8).reshape(a.shape[0],a.shape[1],3)
    a[:,:,:3]=rgb
    a[~mask,:3]=0
    return Image.fromarray(a,'RGBA')


def build_stage_afternoon(stage:int)->Image.Image:
    src=Image.open(SRC/f'approved-stage-{stage}.png').convert('RGB')
    sm=source_house_mask(stage)
    sx0,sy0,sx1,sy1=bbox(sm)
    crop=np.array(src)[sy0:sy1,sx0:sx1]
    am=sm[sy0:sy1,sx0:sx1]
    rgba=np.dstack([crop,am]).astype(np.uint8)
    rgba[rgba[:,:,3]==0,:3]=0
    obj=Image.fromarray(rgba,'RGBA')

    if stage==0:
        # Align the explicit QA/reference Stage 0 sprite to the baked house on the real map crop.
        map_img=np.array(Image.open(ISLAND/'stage0-afternoon.png').convert('RGB'))[300:750,100:600]
        # stage0 coverage mask is already aligned to the runtime crop; use its bbox as the target.
        mm=np.array(Image.open(SRC/'stage0-house-coverage-mask.png').convert('RGBA'))[:,:,3]
        tx0,ty0,tx1,ty1=bbox(mm)
        tw,th=tx1-tx0,ty1-ty0
        # Keep source proportions and align on bottom center.
        scale=min(tw/obj.width, th/obj.height)
        # coverage mask is conservative; explicit sprite may be slightly taller/wider.
        scale*=1.06
        nw,nh=max(1,round(obj.width*scale)),max(1,round(obj.height*scale))
        obj=obj.resize((nw,nh),Image.Resampling.NEAREST)
        cx=(tx0+tx1)//2; bottom=ty1+4
    else:
        old=np.array(Image.open(BASELINE/f'afternoon-stage-{stage}.png').convert('RGBA'))
        oa=old[:,:,3]
        tx0,ty0,tx1,ty1=bbox(oa)
        tw,th=tx1-tx0,ty1-ty0
        # Use full silhouette height to preserve foundation + all stair treads.
        scale=min(tw/obj.width, th/obj.height)
        if stage>=2: scale*=0.98
        nw,nh=max(1,round(obj.width*scale)),max(1,round(obj.height*scale))
        obj=obj.resize((nw,nh),Image.Resampling.NEAREST)
        cx=(tx0+tx1)//2
        # move a few pixels downward to restore the missing lower foundation/stair pixels
        bottom=ty1 + (3 if stage==1 else 7)
    x=cx-obj.width//2; y=bottom-obj.height
    canvas=Image.new('RGBA',SIZE,(0,0,0,0)); canvas.alpha_composite(obj,(x,y))
    return canvas


def ensure_stage0_coverage(im:Image.Image, stage:int)->Image.Image:
    if stage==0: return im
    mm=np.array(Image.open(SRC/'stage0-house-coverage-mask.png').convert('RGBA'))[:,:,3]>0
    bx=im.getchannel('A').getbbox()
    if not bx: return im
    x0,y0,x1,y1=bx; crop=im.crop(bx); basecx=(x0+x1)//2; basebot=y1
    target=0.997 if stage in (1,3) else 0.9995
    best=(-1.0,None,None)
    chosen=None
    for sc_i in range(100,131):
        sc=sc_i/100.0
        r=crop.resize((max(1,round(crop.width*sc)),max(1,round(crop.height*sc))),Image.Resampling.NEAREST)
        ra=r.getchannel('A')
        local=(-1.0,None)
        for dx in range(-12,13,2):
            for dy in range(-8,15,2):
                px=basecx+dx-r.width//2; py=basebot+dy-r.height
                # Never solve coverage by cropping the new sprite; keep safe transparent padding.
                if px < 12 or py < 12 or px+r.width > SIZE[0]-12 or py+r.height > SIZE[1]-12:
                    continue
                can=Image.new('L',SIZE,0); can.paste(ra,(px,py))
                cov=float((np.array(can)>0)[mm].mean())
                if cov>local[0]: local=(cov,(px,py))
                if cov>best[0]: best=(cov,r,(px,py))
        if local[0]>=target:
            chosen=(r,local[1],local[0],sc); break
    if chosen is None:
        r,pos,cov=best[1],best[2],best[0]
    else:
        r,pos,cov,_=chosen
    out=Image.new('RGBA',SIZE,(0,0,0,0)); out.alpha_composite(r,pos)
    return out


def micro_cover_stage0(im:Image.Image, stage:int)->Image.Image:
    # Any remaining Stage 0 exposure after alignment is only a 1-3 px edge mismatch.
    # Extend the NEW house edge into those exact pixels using the nearest new-house pixel,
    # avoiding terrain patches, rectangles, or old-roof reuse.
    if stage==0: return im
    from scipy.ndimage import distance_transform_edt
    arr=np.array(im.convert('RGBA'))
    a=arr[:,:,3]>0
    mm=np.array(Image.open(SRC/'stage0-house-coverage-mask.png').convert('RGBA'))[:,:,3]>0
    u=mm & ~a
    if not np.any(u): return im
    _,inds=distance_transform_edt(~a,return_indices=True)
    yy,xx=np.where(u); ny=inds[0,yy,xx]; nx=inds[1,yy,xx]
    arr[yy,xx,:3]=arr[ny,nx,:3]; arr[yy,xx,3]=255
    return Image.fromarray(arr,'RGBA')


def phase_transform(stage:int,phase:str)->np.ndarray:
    # Learn the existing phase grade so the repaired silhouette preserves the established lighting palette.
    if phase=='afternoon':
        return np.array([[1,0,0,0],[0,1,0,0],[0,0,1,0]],np.float32)
    ref_stage=stage if stage>0 else 1
    a=np.array(Image.open(BASELINE/f'afternoon-stage-{ref_stage}.png').convert('RGBA'))
    b=np.array(Image.open(BASELINE/f'{phase}-stage-{ref_stage}.png').convert('RGBA'))
    return fit_color_transform(a,b)


def build_assets():
    afternoons={}
    for st in range(6):
        af=micro_cover_stage0(ensure_stage0_coverage(build_stage_afternoon(st),st),st); afternoons[st]=af
        af.save(FULL/f'afternoon-stage-{st}.png',optimize=True)
        if st>0: af.save(HOME/f'afternoon-stage-{st}.png',optimize=True)
    # runtime stage0 remains transparent because the map already paints it; full-silhouette keeps explicit Stage 0.
    for ph in ['morning','evening','night']:
        for st in range(6):
            im=micro_cover_stage0(apply_color(afternoons[st],phase_transform(st,ph)),st)
            im.save(FULL/f'{ph}-stage-{st}.png',optimize=True)
            if st>0: im.save(HOME/f'{ph}-stage-{st}.png',optimize=True)


def checker(size):
    w,h=size; im=Image.new('RGB',size,(205,205,205)); d=ImageDraw.Draw(im); t=18
    for y in range(0,h,t):
        for x in range(0,w,t):
            if (x//t+y//t)%2: d.rectangle((x,y,min(w-1,x+t-1),min(h-1,y+t-1)),fill=(238,238,238))
    return im


def make_qas():
    # isolated full silhouettes
    panels=[]
    for st in range(6):
        bg=checker(SIZE); sp=Image.open(FULL/f'afternoon-stage-{st}.png').convert('RGBA'); bg.paste(sp,(0,0),sp)
        d=ImageDraw.Draw(bg); d.rectangle((8,8,118,36),fill=(18,20,24)); d.text((16,15),f'Stage {st}',fill='white')
        panels.append(bg)
    w,h=SIZE; sh=Image.new('RGB',(w*3,h*2),(20,22,26))
    for i,p in enumerate(panels): sh.paste(p,((i%3)*w,(i//3)*h))
    sh.save(DOCS/'PRODUCTION-BUILD-21.1-HOME-FULL-SILHOUETTES-QA.png')

    # real sanctuary stage QA
    out=[]
    for st in range(6):
        base=Image.open(ISLAND/'stage0-afternoon.png').convert('RGBA')
        if st>0:
            sp=Image.open(HOME/f'afternoon-stage-{st}.png').convert('RGBA')
            base.alpha_composite(sp,(100,300))
        p=base.resize((724,543),Image.Resampling.NEAREST).convert('RGB'); d=ImageDraw.Draw(p); d.rectangle((8,8,120,36),fill=(18,20,24)); d.text((16,15),f'Stage {st}',fill='white'); out.append(p)
    sw,hh=out[0].size; sheet=Image.new('RGB',(sw*3,hh*2),(20,22,26))
    for i,p in enumerate(out): sheet.paste(p,((i%3)*sw,(i//3)*hh))
    sheet.save(DOCS/'PRODUCTION-BUILD-21.1-HOME-STAGES-QA.jpg',quality=94)

    # enlarged bottom-edge QA to make foundation/stair integrity obvious
    strips=[]
    for st in range(6):
        sp=Image.open(FULL/f'afternoon-stage-{st}.png').convert('RGBA'); a=np.array(sp.getchannel('A')); x0,y0,x1,y1=bbox(a)
        x0=max(0,x0-18); x1=min(500,x1+18); y0=max(0,y1-120); y1=min(450,y1+20)
        crop=checker((x1-x0,y1-y0)); part=sp.crop((x0,y0,x1,y1)); crop.paste(part,(0,0),part); crop=crop.resize((420,180),Image.Resampling.NEAREST)
        d=ImageDraw.Draw(crop); d.rectangle((5,5,90,29),fill=(18,20,24)); d.text((12,10),f'Stage {st}',fill='white'); strips.append(crop)
    sheet2=Image.new('RGB',(420*3,180*2),(20,22,26))
    for i,p in enumerate(strips): sheet2.paste(p,((i%3)*420,(i//3)*180))
    sheet2.save(DOCS/'PRODUCTION-BUILD-21.1-HOME-FOUNDATION-STAIRS-QA.png')

if __name__=='__main__':
    build_assets(); make_qas(); print('Build 21.1 full silhouette sprites rebuilt')
