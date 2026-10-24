import type { ImageSegmenter, PoseLandmarker } from '@mediapipe/tasks-vision'

/** The polo template (all cut-outs share it, 796×1000): where the shoulders and hips sit, in shirt pixels. */
const T={w:796,h:1000,cx:398,shoulderL:178,shoulderR:618,shoulderY:150,hipY:880}
const T_SHOULDERS=T.shoulderR-T.shoulderL,T_TORSO=T.hipY-T.shoulderY
/** The sleeve on the left of the picture (the wearer's right), cut along the armhole seam; the other is its
 * mirror image. Each turns about the shoulder joint, from the angle it hangs at in the mockup. */
const SLEEVE:[number,number][]=[[0,100],[178,90],[170,260],[160,455],[152,495],[0,495]]
/** What's cut from the torso for each sleeve: the sleeve minus its shoulder cap, which stays on the torso so
 * a sleeve swinging in doesn't open a gap at the top of the shoulder. */
const SLEEVE_CUT:[number,number][]=[[0,185],[150,170],[170,260],[160,455],[152,495],[0,495]]
const SLEEVE_REST=Math.atan2(290,-108)
/** Pose landmarks (the person's own left and right): shoulders, elbows, wrists, pinky and index knuckles, hips. */
const P={lShoulder:11,rShoulder:12,lElbow:13,rElbow:14,lWrist:15,rWrist:16,lPinky:17,rPinky:18,lIndex:19,rIndex:20,lHip:23,rHip:24}
/** Classes from the multiclass selfie model. */
const C={background:0,hair:1,bodySkin:2,faceSkin:3,clothes:4,other:5}
/** Size the pose and segmentation models read each frame at (wide side), and the lighting sample. */
const ANALYZE=320,LIGHT=64
/** Milliseconds of model time per frame the live camera aims for; slower devices run the models less often
 * (the body-part model first, as hands and hair move slowly enough to reuse its last reading). */
const BUDGET=14

export type Fit={x:number;y:number;angle:number;sx:number;sy:number}
export type Tweak={scale:number;dx:number;dy:number}
export type Landmark={x:number;y:number;visibility?:number}
export type Models={pose:PoseLandmarker;seg:ImageSegmenter|null}
type Analysis={lm?:Landmark[];cats?:Uint8Array;aw:number;ah:number}
type Pieces={torso:HTMLCanvasElement;right:HTMLCanvasElement;left:HTMLCanvasElement}

let loading:Promise<Models>|null=null
/** MediaPipe's pose and body-part models, served from our own /tryon folder: everything runs on the device.
 * GPU when the browser allows it, otherwise CPU. Without the body-part model the polo still fits; it just
 * can't put hands and hair in front. */
export function loadModels():Promise<Models>{
 loading??=(async()=>{
  const {PoseLandmarker,ImageSegmenter}=await import('@mediapipe/tasks-vision')
  const files={wasmLoaderPath:'/tryon/wasm/vision_wasm_internal.js',wasmBinaryPath:'/tryon/wasm/vision_wasm_internal.wasm'}
  const withGpu=async<M>(make:(delegate:'GPU'|'CPU')=>Promise<M>)=>{try{return await make('GPU')}catch{return make('CPU')}}
  const [pose,seg]=await Promise.all([
   withGpu(delegate=>PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/tryon/pose_landmarker_lite.task',delegate},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minTrackingConfidence:.5})),
   withGpu(delegate=>ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:'/tryon/selfie_multiclass_256x256.tflite',delegate},runningMode:'VIDEO',outputCategoryMask:true,outputConfidenceMasks:false})).catch(()=>null),
  ])
  return {pose,seg}
 })()
 loading.catch(()=>{loading=null})
 return loading
}
export async function setMode(m:Models,mode:'VIDEO'|'IMAGE'){await m.pose.setOptions({runningMode:mode});await m.seg?.setOptions({runningMode:mode})}

const seen=(lm:Landmark[],i:number)=>(lm[i]?.visibility??1)>.5
const at=(lm:Landmark[],i:number,w:number,h:number)=>({x:lm[i].x*w,y:lm[i].y*h})

/** The polo's place on a w×h frame from one person's landmarks, or null when the shoulders aren't both in
 * view. Width comes from the shoulders; length from the hips when visible, kept near the width so a
 * half-hidden body doesn't stretch the shirt. */
export function fitFromPose(lm:Landmark[]|undefined,w:number,h:number):Fit|null{
 if(!lm||!seen(lm,P.lShoulder)||!seen(lm,P.rShoulder))return null
 // The person's right shoulder is on the left of an unmirrored frame.
 const a=at(lm,P.rShoulder,w,h),b=at(lm,P.lShoulder,w,h)
 const span=Math.hypot(b.x-a.x,b.y-a.y)
 if(span<w*.05)return null
 const sx=span/T_SHOULDERS*1.06,angle=Math.atan2(b.y-a.y,b.x-a.x)
 const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2}
 let sy=sx
 if(seen(lm,P.lHip)&&seen(lm,P.rHip)){
  const hip={x:(lm[P.lHip].x+lm[P.rHip].x)/2*w,y:(lm[P.lHip].y+lm[P.rHip].y)/2*h}
  sy=Math.min(sx*1.25,Math.max(sx*.85,Math.hypot(hip.x-mid.x,hip.y-mid.y)/T_TORSO))
 }
 return {x:mid.x,y:mid.y,angle,sx,sy}
}

/** Where the polo goes when no one is found: centred, shoulders a little above a third of the way down. */
export const defaultFit=(w:number,h:number):Fit=>{const s=w*.5/T_SHOULDERS;return {x:w/2,y:h*.3,angle:0,sx:s,sy:s}}

const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a))
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v))
/** How far each sleeve turns from where it hangs, following the upper arm (shoulder to elbow) relative to
 * the shoulders, within the range a short sleeve can really move. */
function sleeveTurns(lm:Landmark[]|undefined,w:number,h:number,torso:number):{right:number;left:number}{
 const turn=(shoulder:number,elbow:number,rest:number,lo:number,hi:number)=>{
  if(!lm||!seen(lm,shoulder)||!seen(lm,elbow))return 0
  const s=at(lm,shoulder,w,h),e=at(lm,elbow,w,h)
  return clamp(wrap(Math.atan2(e.y-s.y,e.x-s.x)-torso-rest),lo,hi)
 }
 return {right:turn(P.rShoulder,P.rElbow,SLEEVE_REST,-.3,1.35),left:turn(P.lShoulder,P.lElbow,Math.PI-SLEEVE_REST,-1.35,.3)}
}

const canvas=(w=1,h=1)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c}
const ctx2d=(c:HTMLCanvasElement)=>c.getContext('2d',{willReadFrequently:false})!
const size=(c:HTMLCanvasElement,w:number,h:number)=>{if(c.width!==w||c.height!==h){c.width=w;c.height=h}}

/** The polo cut into a torso and two sleeves (each sleeve a little wider at the seam, so no hairline shows). */
const piecesCache=new Map<string,Pieces>()
export function piecesFor(img:HTMLImageElement):Pieces|null{
 if(!img.complete||!img.naturalWidth)return null
 let p=piecesCache.get(img.src)
 if(p)return p
 const k=img.naturalWidth/T.w,W=img.naturalWidth,H=img.naturalHeight
 const poly=(c:CanvasRenderingContext2D,pts:[number,number][],mirror:boolean,grow:number)=>{
  c.beginPath()
  pts.forEach(([x,y],i)=>{const gx=x>100?x+grow:x,px=(mirror?T.w-gx:gx)*k;if(i)c.lineTo(px,y*k);else c.moveTo(px,y*k)})
  c.closePath()
 }
 const torso=canvas(W,H),t=ctx2d(torso)
 t.drawImage(img,0,0);t.globalCompositeOperation='destination-out'
 poly(t,SLEEVE_CUT,false,0);t.fill();poly(t,SLEEVE_CUT,true,0);t.fill()
 const sleeve=(mirror:boolean)=>{const c=canvas(W,H),s=ctx2d(c);poly(s,SLEEVE,mirror,6);s.clip();s.drawImage(img,0,0);return c}
 p={torso,right:sleeve(false),left:sleeve(true)}
 piecesCache.set(img.src,p)
 return p
}

/** One fitting room: reads each frame (pose and body parts), keeps the fit steady between frames, and draws
 * the frame with the polo on — sleeves following the arms, shaded by the room's own light, with hands,
 * forearms, hair and face kept in front of it. */
export class TryOn{
 fit:Fit|null=null
 private turns={right:0,left:0}
 private misses=0
 private small=canvas()
 private layer=canvas()
 private shade=canvas()
 private front=canvas()
 private lightIn=canvas()
 private lightOut=canvas()
 private arms=canvas()
 private mask=canvas()
 private analysis:Analysis={aw:0,ah:0}
 /** Live camera pacing: frames read so far and each model's recent cost (eased). */
 private frame=0
 private cost={pose:0,seg:0}

 reset(){this.fit=null;this.turns={right:0,left:0};this.misses=0;this.analysis={aw:0,ah:0};this.frame=0;this.cost={pose:0,seg:0}}
 /** Every how many frames a model runs on the live camera, from what it has been costing. */
 private every(ms:number,max:number){return Math.min(max,Math.max(1,Math.ceil(ms/BUDGET)))}

 /** Reads a frame (video: pass its timestamp) and updates the fit. False when no one is in view. */
 read(m:Models,src:CanvasImageSource,w:number,h:number,ts?:number):boolean{
  const aw=ANALYZE,ah=Math.max(1,Math.round(h*ANALYZE/w))
  size(this.small,aw,ah)
  ctx2d(this.small).drawImage(src,0,0,aw,ah)
  const video=ts!=null,n=this.frame++
  let lm=this.analysis.lm,cats=this.analysis.aw===aw&&this.analysis.ah===ah?this.analysis.cats:undefined
  if(!video||n%this.every(this.cost.pose,3)===0){
   const t0=performance.now()
   lm=(ts==null?m.pose.detect(this.small):m.pose.detectForVideo(this.small,ts)).landmarks[0]
   this.cost.pose+=(performance.now()-t0-this.cost.pose)*.2
  }
  if(m.seg&&(!video||!cats||n%this.every(this.cost.seg+this.cost.pose,6)===0)){
   const t0=performance.now()
   const r=ts==null?m.seg.segment(this.small):m.seg.segmentForVideo(this.small,ts)
   cats=r.categoryMask?.getAsUint8Array().slice()
   r.close()
   this.cost.seg+=(performance.now()-t0-this.cost.seg)*.2
  }
  this.analysis={lm,cats,aw,ah}
  const next=fitFromPose(lm,w,h)
  if(next){
   this.misses=0
   const turns=sleeveTurns(lm,w,h,next.angle)
   this.fit=video?ease(this.fit,next):next
   const k=video?.3:1
   this.turns={right:this.turns.right+(turns.right-this.turns.right)*k,left:this.turns.left+(turns.left-this.turns.left)*k}
  }else if(!video||++this.misses>20)this.fit=null
  return !!next
 }

 /** Draws the frame and, when there's a fit (or one is given), the polo on it. */
 draw(out:CanvasRenderingContext2D,frame:CanvasImageSource,w:number,h:number,shirt:HTMLImageElement,tweak:Tweak,fallback?:Fit){
  out.drawImage(frame,0,0,w,h)
  const fit=this.fit??fallback,pieces=piecesFor(shirt)
  if(!fit||!pieces)return
  size(this.layer,w,h)
  const L=ctx2d(this.layer)
  L.clearRect(0,0,w,h)
  this.drawPieces(L,pieces,fit,tweak)
  this.light(L,frame,w,h,fit)
  out.save()
  out.shadowColor='rgba(0,0,0,.22)';out.shadowBlur=Math.max(6,w*.012);out.shadowOffsetY=Math.max(2,w*.004)
  out.drawImage(this.layer,0,0)
  out.restore()
  this.inFront(out,frame,w,h,fit)
 }

 private drawPieces(L:CanvasRenderingContext2D,p:Pieces,fit:Fit,tweak:Tweak){
  const k=T.w/p.torso.width
  L.save()
  L.translate(fit.x+tweak.dx,fit.y+tweak.dy)
  L.rotate(fit.angle)
  L.scale(fit.sx*tweak.scale*k,fit.sy*tweak.scale*k)
  L.translate(-T.cx/k,-T.shoulderY/k)
  L.drawImage(p.torso,0,0)
  const sleeve=(img:HTMLCanvasElement,pivotX:number,turn:number)=>{
   L.save();L.translate(pivotX/k,T.shoulderY/k);L.rotate(turn);L.translate(-pivotX/k,-T.shoulderY/k);L.drawImage(img,0,0);L.restore()
  }
  sleeve(p.right,T.shoulderL,this.turns.right)
  sleeve(p.left,T.shoulderR,this.turns.left)
  L.restore()
 }

 /** The room's light on the polo: brightness and colour from the whole frame, and the shading (folds,
 * shadows, the side nearer a lamp) from the part of the body under the shirt, soft-light blended. */
 private light(L:CanvasRenderingContext2D,frame:CanvasImageSource,w:number,h:number,fit:Fit){
  const lw=LIGHT,lh=Math.max(1,Math.round(h*LIGHT/w))
  size(this.lightIn,lw,lh);size(this.lightOut,lw,lh)
  const src=this.lightIn.getContext('2d',{willReadFrequently:true})!
  src.drawImage(frame,0,0,lw,lh)
  const px=src.getImageData(0,0,lw,lh).data
  const {cats,aw,ah}=this.analysis
  const body=(x:number,y:number)=>!cats||cats[Math.min(ah-1,Math.floor(y*ah/lh))*aw+Math.min(aw-1,Math.floor(x*aw/lw))]!==C.background
  // The shirt's box, shoulders to hem, in sample pixels.
  const s=lw/w,x0=Math.floor((fit.x-330*fit.sx)*s),x1=Math.ceil((fit.x+330*fit.sx)*s),y0=Math.floor((fit.y-60*fit.sy)*s),y1=Math.ceil((fit.y+760*fit.sy)*s)
  let r=0,g=0,b=0,n=0,boxLum=0,boxN=0
  for(let y=0;y<lh;y++)for(let x=0;x<lw;x++){
   const i=(y*lw+x)*4,l=(.299*px[i]+.587*px[i+1]+.114*px[i+2])/255
   r+=px[i];g+=px[i+1];b+=px[i+2];n++
   if(x>=x0&&x<=x1&&y>=y0&&y<=y1&&body(x,y)){boxLum+=l;boxN++}
  }
  r/=n*255;g/=n*255;b/=n*255
  const scene=.299*r+.587*g+.114*b,ref=boxN?boxLum/boxN:scene
  // Darker rooms darken the polo a little and a warm or cool room tints it, gently: shoppers need to see the
  // polo's true colours.
  const base=.5-clamp((.52-scene)*.45,-.04,.1),tint=[(r-scene)*.2,(g-scene)*.2,(b-scene)*.2]
  const outCtx=ctx2d(this.lightOut),img=outCtx.createImageData(lw,lh),o=img.data
  for(let y=0;y<lh;y++)for(let x=0;x<lw;x++){
   const i=(y*lw+x)*4,l=(.299*px[i]+.587*px[i+1]+.114*px[i+2])/255
   const d=body(x,y)?clamp((l-ref)*.85,-.22,.22):0
   for(let c=0;c<3;c++)o[i+c]=clamp(base+d+tint[c],0,1)*255
   o[i+3]=255
  }
  outCtx.putImageData(img,0,0)
  size(this.shade,w,h)
  const S=ctx2d(this.shade)
  S.globalCompositeOperation='copy';S.imageSmoothingEnabled=true;S.imageSmoothingQuality='high'
  S.drawImage(this.lightOut,0,0,w,h)
  S.globalCompositeOperation='destination-in';S.drawImage(this.layer,0,0)
  L.save();L.globalCompositeOperation='soft-light';L.drawImage(this.shade,0,0);L.restore()
 }

 /** What sits in front of a shirt: hair and face always, and forearms and hands wherever they are (bare or
 * in sleeves), taken from the camera frame and laid back over the polo with soft edges. */
 private inFront(out:CanvasRenderingContext2D,frame:CanvasImageSource,w:number,h:number,fit:Fit){
  const {lm,cats,aw,ah}=this.analysis
  if(!cats||!aw)return
  size(this.arms,aw,ah)
  const A=this.arms.getContext('2d',{willReadFrequently:true})!
  A.clearRect(0,0,aw,ah)
  if(lm){
   A.strokeStyle='#fff';A.lineCap='round';A.lineJoin='round'
   const span=T_SHOULDERS*fit.sx*aw/w
   const arm=(elbow:number,wrist:number,pinky:number,index:number)=>{
    if(!seen(lm,elbow)||!seen(lm,wrist))return
    const e=at(lm,elbow,aw,ah),wr=at(lm,wrist,aw,ah)
    A.lineWidth=span*.2;A.beginPath();A.moveTo(e.x,e.y);A.lineTo(wr.x,wr.y);A.stroke()
    const hx=(lm[pinky].x+lm[index].x)/2*aw,hy=(lm[pinky].y+lm[index].y)/2*ah
    A.lineWidth=span*.26;A.beginPath();A.moveTo(wr.x,wr.y);A.lineTo(wr.x+(hx-wr.x)*1.6,wr.y+(hy-wr.y)*1.6);A.stroke()
   }
   arm(P.rElbow,P.rWrist,P.rPinky,P.rIndex)
   arm(P.lElbow,P.lWrist,P.lPinky,P.lIndex)
  }
  const reach=A.getImageData(0,0,aw,ah).data
  size(this.mask,aw,ah)
  const M=ctx2d(this.mask),img=M.createImageData(aw,ah),o=img.data
  for(let i=0;i<cats.length;i++){
   const c=cats[i]
   if(c===C.hair||c===C.faceSkin||(c!==C.background&&reach[i*4+3]>0))o[i*4+3]=255
  }
  M.putImageData(img,0,0)
  size(this.front,w,h)
  const F=ctx2d(this.front)
  F.globalCompositeOperation='copy';F.imageSmoothingEnabled=true;F.imageSmoothingQuality='high'
  F.drawImage(this.mask,0,0,w,h)
  F.globalCompositeOperation='source-in';F.drawImage(frame,0,0,w,h)
  out.drawImage(this.front,0,0)
 }
}

/** Eases a fit toward the next one so the shirt doesn't jitter with every frame's landmarks. */
export function ease(from:Fit|null,to:Fit,k=.35):Fit{
 if(!from)return to
 const m=(p:number,q:number)=>p+(q-p)*k
 return {x:m(from.x,to.x),y:m(from.y,to.y),angle:from.angle+wrap(to.angle-from.angle)*k,sx:m(from.sx,to.sx),sy:m(from.sy,to.sy)}
}
