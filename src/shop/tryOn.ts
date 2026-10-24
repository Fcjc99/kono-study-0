import type { PoseLandmarker } from '@mediapipe/tasks-vision'

/** Where the shoulders and hips sit on the polo template (shirt pixels, 796×1000). */
const T={shoulderL:178,shoulderR:618,shoulderY:150,hipY:880,cx:398}
const T_SHOULDERS=T.shoulderR-T.shoulderL,T_TORSO=T.hipY-T.shoulderY
/** Pose landmarks: 11/12 are the left/right shoulders, 23/24 the hips (the person's own left and right). */
const L_SHOULDER=11,R_SHOULDER=12,L_HIP=23,R_HIP=24

export type Fit={x:number;y:number;angle:number;sx:number;sy:number}
export type Landmark={x:number;y:number;visibility?:number}

let loading:Promise<PoseLandmarker>|null=null
/** MediaPipe's pose model, served from our own /tryon folder (nothing leaves the device). Downloads the first
 * time someone tries a polo on; GPU when the browser allows it, otherwise CPU. */
export function loadPose():Promise<PoseLandmarker>{
 loading??=(async()=>{
  const {PoseLandmarker}=await import('@mediapipe/tasks-vision')
  const files={wasmLoaderPath:'/tryon/wasm/vision_wasm_internal.js',wasmBinaryPath:'/tryon/wasm/vision_wasm_internal.wasm'}
  const make=(delegate:'GPU'|'CPU')=>PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/tryon/pose_landmarker_lite.task',delegate},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minTrackingConfidence:.5})
  try{return await make('GPU')}catch{return make('CPU')}
 })()
 loading.catch(()=>{loading=null})
 return loading
}

/** The polo's place on a frame of w×h pixels from one person's landmarks (shares of the frame), or null when
 * the shoulders aren't both in view. Width comes from the shoulders; length from the hips when they're
 * visible, kept within a sensible range of the width so a half-hidden body doesn't stretch the shirt. */
export function fitFromPose(lm:Landmark[]|undefined,w:number,h:number):Fit|null{
 if(!lm)return null
 const seen=(i:number)=>(lm[i]?.visibility??1)>.5
 if(!seen(L_SHOULDER)||!seen(R_SHOULDER))return null
 // The person's right shoulder is on the left of an unmirrored frame.
 const a={x:lm[R_SHOULDER].x*w,y:lm[R_SHOULDER].y*h},b={x:lm[L_SHOULDER].x*w,y:lm[L_SHOULDER].y*h}
 const span=Math.hypot(b.x-a.x,b.y-a.y)
 if(span<w*.05)return null
 const sx=span/T_SHOULDERS*1.06,angle=Math.atan2(b.y-a.y,b.x-a.x)
 const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2}
 let sy=sx
 if(seen(L_HIP)&&seen(R_HIP)){
  const hip={x:(lm[L_HIP].x+lm[R_HIP].x)/2*w,y:(lm[L_HIP].y+lm[R_HIP].y)/2*h}
  sy=Math.min(sx*1.25,Math.max(sx*.85,Math.hypot(hip.x-mid.x,hip.y-mid.y)/T_TORSO))
 }
 return {x:mid.x,y:mid.y,angle,sx,sy}
}

/** Where the polo goes when no one is found: centred, shoulders a little above a third of the way down. */
export const defaultFit=(w:number,h:number):Fit=>{const s=w*.5/T_SHOULDERS;return {x:w/2,y:h*.3,angle:0,sx:s,sy:s}}

/** Eases a fit toward the next one so the shirt doesn't jitter with every frame's landmarks. */
export function ease(from:Fit|null,to:Fit,k=.35):Fit{
 if(!from)return to
 const m=(p:number,q:number)=>p+(q-p)*k
 return {x:m(from.x,to.x),y:m(from.y,to.y),angle:m(from.angle,to.angle),sx:m(from.sx,to.sx),sy:m(from.sy,to.sy)}
}

/** Draws the polo at a fit, with the shopper's own size and position tweaks on top. */
export function drawPolo(ctx:CanvasRenderingContext2D,shirt:HTMLImageElement,fit:Fit,tweak:{scale:number;dx:number;dy:number}){
 ctx.save()
 ctx.translate(fit.x+tweak.dx,fit.y+tweak.dy)
 ctx.rotate(fit.angle)
 ctx.scale(fit.sx*tweak.scale,fit.sy*tweak.scale)
 ctx.shadowColor='rgba(0,0,0,.18)';ctx.shadowBlur=18;ctx.shadowOffsetY=6
 ctx.drawImage(shirt,-T.cx,-T.shoulderY)
 ctx.restore()
}
