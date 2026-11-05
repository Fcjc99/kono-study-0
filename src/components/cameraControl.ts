import type {FramePoint} from './framing'

/** Only a view preference is saved. No game state, aim, medals or physics. */
export const CAMERA_STORAGE_KEY='kono-medal-cove.camera.v1'
export type CameraPose={target:FramePoint;distance:number;yaw:number;pitch:number;zoom:number;fov:number}
export type CameraDragMode='pan'|'orbit'
type CameraStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
export function validateCameraPose(value:unknown):CameraPose|null{
 if(!value||typeof value!=='object')return null
 const p=value as CameraPose
 if(!Array.isArray(p.target)||p.target.length!==3||!p.target.every(n=>typeof n==='number'&&Number.isFinite(n))||![p.distance,p.yaw,p.pitch,p.zoom,p.fov].every(n=>typeof n==='number'&&Number.isFinite(n)))return null
 return {target:[clamp(p.target[0],-12,12),clamp(p.target[1],-2,20),clamp(p.target[2],-12,12)],distance:clamp(p.distance,14,220),yaw:clamp(p.yaw,-1.15,1.15),pitch:clamp(p.pitch,-.08,1.1),zoom:clamp(p.zoom,.7,3),fov:clamp(p.fov,35,60)}
}
export function readCameraPose(storage:CameraStorage):CameraPose|null{
 try{const raw=storage.getItem(CAMERA_STORAGE_KEY);if(!raw)return null;const saved=JSON.parse(raw);return saved.version===1?validateCameraPose(saved.pose):null}catch{return null}
}
export function saveCameraPose(storage:CameraStorage,pose:CameraPose|null){
 try{if(pose){const valid=validateCameraPose(pose);if(!valid)return false;storage.setItem(CAMERA_STORAGE_KEY,JSON.stringify({version:1,pose:valid}))}else storage.removeItem(CAMERA_STORAGE_KEY);return true}catch{return false}
}
export function cameraPoseFrame(p:CameraPose){
 const forward:FramePoint=[Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),Math.cos(p.yaw)*Math.cos(p.pitch)]
 const position:FramePoint=[p.target[0]+forward[0]*p.distance,p.target[1]+forward[1]*p.distance,p.target[2]+forward[2]*p.distance]
 return {position,target:p.target,distance:p.distance,far:Math.max(100,p.distance+65),fogNear:Math.max(28,p.distance+15)}
}
/** Pan in camera-right/up directions. Values are world units, not viewport pixels. */
export function panCamera(p:CameraPose,right:number,up:number):CameraPose{
 const r:FramePoint=[Math.cos(p.yaw),0,-Math.sin(p.yaw)],u:FramePoint=[-Math.sin(p.yaw)*Math.sin(p.pitch),Math.cos(p.pitch),-Math.cos(p.yaw)*Math.sin(p.pitch)]
 return validateCameraPose({...p,target:p.target.map((n,i)=>n+r[i]*right+u[i]*up)})!
}
/** Two fingers always pan + pinch; one finger uses the selected explicit mode.
 * Incremental deltas rebase on every pointer, so a pinch ending cannot jump. */
export function createCameraGesture(get:()=>CameraPose|null,change:(p:CameraPose)=>void,mode:()=>CameraDragMode,height:()=>number){
 const points=new Map<number,{x:number;y:number}>()
 const distance=()=>{const [a,b]=[...points.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0}
 return {
  down(id:number,x:number,y:number){if(points.size>=2||!Number.isFinite(x)||!Number.isFinite(y))return false;points.set(id,{x,y});return true},
  move(id:number,x:number,y:number){const old=points.get(id),p=get();if(!old||!p||!Number.isFinite(x)||!Number.isFinite(y))return
   const dx=x-old.x,dy=y-old.y,before=distance();points.set(id,{x,y})
   if(points.size===2||mode()==='pan'){
    const units=2*p.distance*Math.tan(p.fov*Math.PI/360)/p.zoom/Math.max(1,height()),divisor=points.size
    const moved=panCamera(p,-dx*units/divisor,dy*units/divisor),after=distance()
    change(validateCameraPose({...moved,zoom:points.size===2&&before>4&&after>4?p.zoom*after/before:p.zoom})!)
   }else change(validateCameraPose({...p,yaw:p.yaw-dx*.006,pitch:p.pitch+dy*.006})!)
  },
  up(id:number){points.delete(id)},
  cancel(){points.clear()},
 }
}
