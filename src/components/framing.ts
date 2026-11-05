import {CABINET,PLINKO} from '../store/motion'
import {TOWER} from '../store/tower'
/** View-only framing. None of these values affect a collider, reward, or body. */
export type FramePoint = readonly [number, number, number]
// Front stands at the coin-bed edge, looking very slightly UP at the pegboard.
export const FRONT_EYE_HEIGHT = 1.7
export const CAMERA_VIEWS = [{yaw:0,pitch:-.035},{yaw:0,pitch:.87},{yaw:.48,pitch:.48},{yaw:-.48,pitch:.48},{yaw:0,pitch:.35}] as const

// Collection lip, deck/shelf, input hood, both delivery mouths/ball run,
// lighthouse roof, and KONO. Garden decorations are deliberately not fit targets.
export const MACHINE_BOUNDS: readonly FramePoint[] = [
 [-4.3,-2.3,CABINET.front+2.8],[4.3,-2.3,CABINET.front+2.8],[-4.3,-1,CABINET.front+2.8],[4.3,-1,CABINET.front+2.8],[-4.3,-2,CABINET.front+.1],[4.3,-2,CABINET.front+.1],
 [-4.35,1.7,CABINET.front-.3],[4.35,1.7,CABINET.front-.3],[-4.4,2.5,-8.65],[4.4,2.5,-8.65],
 [-4.1,PLINKO.top+1.2,-6.5],[4.1,PLINKO.top+1.2,-6.5],[-6.4,6.8,-5.9],[-6.4,2.3,-4.6],[-5.5,7.15,-5.9],[-4.2,7.15,-4.7],
 [6.2,3.5,-5.9],[6.2,2.3,-4.6],[-3.8,7.75,-6.6],[-2.7,7.75,-6.6],
 [4.2,7.4,-6.45],[6.2,7.4,-6.45],[-.9,7.1,-7.1],[.9,7.1,-5.2],
]

/** Front is a play view, not an inventory photograph of the whole cabinet.
 * Keep every edge of the usable bed, moving shelf, pin board, aiming rail and
 * collection tray in frame. The peripheral ball magazine, side hoppers and
 * character/lighthouse remain in the scene but cannot make the playfield tiny.
 * Overview (and the side angles) deliberately fits those peripheral objects. */
export const FRONT_BOUNDS: readonly FramePoint[] = [
 [-4.3,-2.3,CABINET.front+2.8],[4.3,-2.3,CABINET.front+2.8],[-4.3,-1,CABINET.front+2.8],[4.3,-1,CABINET.front+2.8],[-4.3,-2,CABINET.front+.1],[4.3,-2,CABINET.front+.1],
 [-4.35,1.7,CABINET.front-.3],[4.35,1.7,CABINET.front-.3],[-4.4,2.5,-8.65],[4.4,2.5,-8.65],
 [-4.1,PLINKO.top+1.2,-6.5],[4.1,PLINKO.top+1.2,-6.5],[-.9,7.1,-7.1],[.9,7.1,-5.2],
]

/** Tower geometry is always essential, even in Front; an ordinary coin never
 * changes this framing. Select again on view changes so Overview is reversible. */
export function frameBoundsForView(viewIndex:number,towerPoints:readonly FramePoint[]): readonly FramePoint[] {
 return [...(viewIndex===0?FRONT_BOUNDS:MACHINE_BOUNDS),...towerPoints,...REFERENCE_BUILD_BOUNDS]
}

/** Reserve each actual tower column, with a small rim/lean allowance. */
export function towerFramePoints(slots: readonly {x:number;y:number;z:number}[], flying=false): FramePoint[] {
 const points:FramePoint[]=[]
 for(const slot of slots){
  for(const x of [-.71,.71])for(const z of [-.71,.71])points.push([slot.x+x,7.105+slot.y+.12+(flying?1.1:0),-6.65+slot.z+z])
 }
 return points
}

/** Complete compact cabinet, including both delivery mouths, actual catcher,
 * low Tidegate lanes, input/ball rails and bounded reserve. Unlike Front this
 * is an explicit temporary inspection view, not a replacement preference. */
export const RESERVE_BOUNDS:readonly FramePoint[]=[-2.25,2.25].flatMap(x=>[5.81,6.95].flatMap(y=>[-7.4,-5.9].map(z=>[x,y,z] as FramePoint)))
/** Explicit reference inspection view includes the real shaft, field levels and
 * tray but does not let peripheral garden artwork miniaturize the medals. */
// Follow the actual external side workshop rather than the old in-board bay.
// Reserve the full construction head and the open return shutters, without
// altering or overwriting any user-locked camera pose.
export const REFERENCE_BUILD_BOUNDS:readonly FramePoint[]=[TOWER.x-TOWER.leafHalfWidth-.08,TOWER.x+1.34].flatMap(x=>[0,Math.max(5.6,TOWER.buildTop+TOWER.halfHeight*2+(TOWER.rows-1)*TOWER.pitch+TOWER.headClearance+.1)].flatMap(y=>[TOWER.z-TOWER.leafHalfDepth*2-TOWER.opening,TOWER.z+TOWER.leafHalfDepth*2+TOWER.opening].map(z=>[x,y,z] as FramePoint)))
export const WHOLE_ROUTE_BOUNDS:readonly FramePoint[]=[
 ...FRONT_BOUNDS,...RESERVE_BOUNDS,...REFERENCE_BUILD_BOUNDS,
 ...[-3.9,3.9].flatMap(x=>[.6,2.26].flatMap(y=>[-4.4,1.5].map(z=>[x,y,z] as FramePoint))),
]
export const TIERED_VIEW_INDEX=4
export const TIERED_BOUNDS:readonly FramePoint[]=[
 ...[-4.35,4.35].flatMap(x=>[[-2.3,CABINET.front+2.8],[.6,CABINET.front],[.6,-6.45],[PLINKO.top+1.04,PLINKO.z],[PLINKO.bottom-.65,PLINKO.z]].map(([y,z])=>[x,y,z] as FramePoint)),
 ...REFERENCE_BUILD_BOUNDS,
]
export const TIERED_VIEW={yaw:0,pitch:.35,fov:42,zoom:1} as const
export function fitTieredFrame(aspect:number,insets:FrameInsets={top:.16,bottom:.09,side:.04}){
 return fitInsetHull(TIERED_BOUNDS,TIERED_VIEW,aspect,insets)
}
export const WHOLE_ROUTE_VIEW={yaw:-.35,pitch:.58,fov:42,zoom:1} as const
export type FrameInsets={top:number;bottom:number;side:number}

/** Fit projected geometry into the unoccluded stage rectangle, not merely the
 * full canvas. Insets are fractions measured from the real toolbar/hint.
 * A locked custom pose never uses this solver. */
export function fitWholeRouteFrame(aspect:number,insets:FrameInsets={top:.18,bottom:.08,side:.04}){
 return fitInsetHull(WHOLE_ROUTE_BOUNDS,WHOLE_ROUTE_VIEW,aspect,insets)
}
function fitInsetHull(bounds:readonly FramePoint[],view:{yaw:number;pitch:number;fov:number;zoom:number},aspect:number,insets:FrameInsets){
 const {yaw,pitch,fov,zoom}=view
 const forward:FramePoint=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)]
 const right:FramePoint=[Math.cos(yaw),0,-Math.sin(yaw)]
 const up:FramePoint=[-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)]
 const tanY=Math.tan(fov*Math.PI/360)/zoom,tx=tanY*Math.max(.1,aspect)*(1-2*Math.min(.2,Math.max(0,insets.side)))
 const top=Math.min(.6,Math.max(.02,insets.top)),bottom=Math.min(.35,Math.max(.02,insets.bottom))
 const upper=tanY*(1-2*top),lower=tanY*(1-2*bottom)
 const projected=bounds.map(p=>({x:dot(p,right),y:dot(p,up),z:dot(p,forward)}))
 const maxX=Math.max(...projected.map(p=>p.x+tx*p.z)),minX=Math.min(...projected.map(p=>p.x-tx*p.z))
 const maxY=Math.max(...projected.map(p=>p.y+upper*p.z)),minY=Math.min(...projected.map(p=>p.y-lower*p.z))
 const distance=Math.max(Math.max(...projected.map(p=>p.z))+1,(maxX-minX)/(2*tx),(maxY-minY)/(upper+lower))
 const cx=(maxX+minX)/2,cy=(maxY+minY+(lower-upper)*distance)/2
 const target:FramePoint=[right[0]*cx+up[0]*cy,right[1]*cx+up[1]*cy,right[2]*cx+up[2]*cy]
 const position:FramePoint=[target[0]+forward[0]*distance,target[1]+forward[1]*distance,target[2]+forward[2]*distance]
 const farthestDepth=distance-Math.min(...projected.map(p=>p.z))
 return {target,position,distance,far:Math.max(100,farthestDepth+30),fogNear:Math.max(28,farthestDepth+2),yaw,pitch,fov,zoom}
}

const dot=(p:FramePoint,v:FramePoint)=>p[0]*v[0]+p[1]*v[1]+p[2]*v[2]
/** Find the closest perspective camera whose full essential hull fits. Unlike a
 * fixed look-at target, this centers the *projected* hull, not empty world space. */
export function fitMachineFrame(points:readonly FramePoint[],aspect:number,fov:number,yaw:number,pitch:number,minEyeHeight=-Infinity){
 const forward:FramePoint=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)]
 const right:FramePoint=[Math.cos(yaw),0,-Math.sin(yaw)]
 const up:FramePoint=[-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)]
 const tanY=Math.tan(fov*Math.PI/360),tx=tanY*Math.max(.1,aspect)*.965,ty=tanY*.95
 const projected=points.map(p=>({x:dot(p,right),y:dot(p,up),z:dot(p,forward)}))
 const maxX=Math.max(...projected.map(p=>p.x+tx*p.z)),minX=Math.min(...projected.map(p=>p.x-tx*p.z))
 const maxY=Math.max(...projected.map(p=>p.y+ty*p.z)),minY=Math.min(...projected.map(p=>p.y-ty*p.z))
 let distance=Math.max(Math.max(...projected.map(p=>p.z))+1,(maxX-minX)/(2*tx),(maxY-minY)/(2*ty))
 const cx=(maxX+minX)/2
 let cy=(maxY+minY)/2
 // A projected-hull center alone sinks a low-angle camera below the wooden
 // bed. Keep the lens at standing eye height and solve the SAME full hull
 // again. This is one ordinary perspective camera, not a crop or second lens.
 if(up[1]*cy+forward[1]*distance<minEyeHeight){
  const eye=minEyeHeight/Math.cos(pitch),slope=Math.tan(pitch)
  distance=Math.max(distance,...projected.flatMap(p=>[
   (p.y-eye+ty*p.z)/(ty-slope),(-p.y+eye+ty*p.z)/(ty+slope),
  ]))
  cy=eye-slope*distance
 }
 const target:FramePoint=[right[0]*cx+up[0]*cy,right[1]*cx+up[1]*cy,right[2]*cx+up[2]*cy]
 const position:FramePoint=[target[0]+forward[0]*distance,target[1]+forward[1]*distance,target[2]+forward[2]*distance]
 const farthestDepth=distance-Math.min(...projected.map(p=>p.z))
 return {target,position,distance,far:Math.max(80,farthestDepth+30),fogNear:Math.max(28,farthestDepth+2)}
}
