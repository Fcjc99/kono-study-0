import RAPIER from '@dimforge/rapier3d-compat'

/** Sanctuary Tide feeds immutable awards through paced physical outlets.
 * No suspended trays or invisible support planes. Every reward is an ordinary
 * dynamic medal; only actual tray collection credits the player. */
// Three direct drop locations. Legacy dimensional constants remain exported
// for historical geometry audits, but the machine creates no solid fixtures.
export const TIDE = {
 lanes: {left:-3.38,center:.8,right:3.38}, z:.65, rightZ:1.0, centerZ:1.3, centerParkX:2.0, top:2.60,
 radius:.31, halfHeight:.055, columnPitch:.68, layerPitch:.118,
 columns:4, rows:3, batchMax:12,
 halfWidth:.40, halfDepth:.76, gateHalfHeight:.04,
 railHalfThickness:.035, railHeight:.86,
 opening:1.66, travelFrames:120, loadFrames:10, holdFrames:32, openFrames:84,
 closeFrames:84, wavePauseFrames:20,
} as const
export type TideLane=keyof typeof TIDE.lanes
export type TidePoint={x:number;y:number;z:number}
export type TideStage='idle'|'choosing'|'deploying'|'parking'|'loading'|'ready'|'opening'|'draining'|'closing'|'waiting'
export type TideRequest={readonly id:number;readonly key:string|null;readonly total:number;remaining:number;released:number;lane:TideLane|null;readonly practice:boolean}
export type TidePart={lane:TideLane;kind:'rail'|'gate';position:TidePoint;halfSize:TidePoint}
export type TideStatus={
 stage:TideStage;routeSafe:boolean;waitReason:'shared-route'|'capacity'|'load-path'|'gate-path'|'cargo-path'|null;blocked:boolean;clearing:boolean;queued:number;held:number;pending:number;planned:number;released:number;
 requestId:number|null;key:string|null;total:number;remaining:number;requestReleased:number;lane:TideLane|null;practice:boolean;
 waitingRequests:number;requestCount:number;lastCompleted:Readonly<TideRequest>|null;batchSize:number;batchBuilt:number;wave:number;progress:number;gates:TidePart[];rails:TidePart[];
}
export type TideOptions={
 createCoin:(position:TidePoint,request:Readonly<TideRequest>)=>RAPIER.RigidBody
 room:()=>number
 /** Yield after a wave drains; retained for shared-route compatibility. */
 yieldRequested?:()=>boolean
 routeAvailable?:()=>boolean
 /** Ignore this machine's pending bodies. The production caller should include
  * all other uncollected medals/balls, querying the actual swept shapes. */
 clear?:(lane:TideLane)=>boolean
 /** Legacy compatibility callback: direct delivery does not invoke gate motion.
  * Exact prospective floor motion, separate from loading-pocket clearance.
  * Already-delivered medals elsewhere in the reservoir do not obstruct an
  * opening door that is moving away from them. The fourth flag permits only
  * narrowly identified top-supported foreign cargo during outward clearing;
  * it is never true for a closing sweep. */
 gateClear?:(lane:TideLane,from:TidePoint,to:TidePoint,clearing?:boolean)=>boolean
 /** Legacy compatibility callback: direct delivery has no reservoir to clear.
  * True only for foreign cargo caught in the selected reservoir, and
  * only when other machinery allows the gate to own its clearing cycle. */
 needsClearing?:(lane:TideLane)=>boolean
 onRelease?:(body:RAPIER.RigidBody,request:Readonly<TideRequest>)=>void
 onComplete?:(request:Readonly<TideRequest>)=>void
}
const identity={x:0,y:0,z:0,w:1}
const lanes=Object.keys(TIDE.lanes) as TideLane[]
const whole=(n:number)=>Number.isSafeInteger(n)&&n>0?n:0
/** Drop locations remain inside the coin field. */
export const tideLaneZ=(lane:TideLane)=>lane==='center'?TIDE.centerZ:lane==='right'?TIDE.rightZ:TIDE.z
export const tideGateDirection=(_lane:TideLane)=>1

/** No reservoir walls, floors or invisible colliders. */
export function tideRails(_centerX:number=TIDE.centerParkX):TidePart[]{ return [] }
/** Paced outlets drop one real medal at a time. There is no suspended tray,
 * stacking layer, collision floor, or invisible support. */
export function tideCoinSlot(index:number,lane:TideLane):TidePoint{
 const column=index%TIDE.columns
 const offsets=[[-.25,-.34],[.25,.34],[.25,-.34],[-.25,.34]]
 return {x:TIDE.lanes[lane]+offsets[column][0],y:TIDE.top+TIDE.halfHeight+.025,z:tideLaneZ(lane)+offsets[column][1]}
}
/** Legacy geometry audit helper; the direct-feed machine never uses this.
 * Gate sweep plus the loading pocket. Shape intersections, not center tests,
 * catch upright coins/balls and the forward travel of the physical door. */
export function tideSweepBlocked(world:RAPIER.World,lane:TideLane,includeBody:(body:RAPIER.RigidBody)=>boolean):boolean{
 let blocked=false
 const bottom=TIDE.top-TIDE.gateHalfHeight*2-.02,top=TIDE.top+TIDE.railHeight+.08
 const shape=new RAPIER.Cuboid(TIDE.halfWidth+.015,(top-bottom)/2,TIDE.halfDepth+TIDE.opening/2+.015)
 world.intersectionsWithShape({x:TIDE.lanes[lane],y:(bottom+top)/2,z:tideLaneZ(lane)+tideGateDirection(lane)*TIDE.opening/2},identity,shape,collider=>{
  const body=collider.parent()
  if(body&&includeBody(body)){blocked=true;return false}
  return true
 })
 return blocked
}

/** Admission checks the four small spawn envelopes, not a giant tray volume.
 * The machine also checks the exact next slot against ALL solid colliders. */
export function tideLoadBlocked(world:RAPIER.World,lane:TideLane,includeBody:(body:RAPIER.RigidBody)=>boolean):boolean{
 if(!lanes.includes(lane))return true
 let blocked=false
 for(let i=0;i<TIDE.columns;i++)world.intersectionsWithShape(tideCoinSlot(i,lane),identity,new RAPIER.Cylinder(TIDE.halfHeight+.012,TIDE.radius+.012),collider=>{
  const body=collider.parent()
  if(body&&includeBody(body)){blocked=true;return false}
  return true
 })
 return blocked
}

/** Legacy geometry audit helper; no gate is instantiated by direct delivery.
 * Exact union of the translating, axis-aligned gate at its current and next
 * positions. The floor does not rotate, so this cuboid is its swept volume,
 * including intermediate positions, not merely endpoint/center sampling.
 * Use only the requested next simulation increment; never test the unrelated
 * loading pocket to decide whether a retracted door can continue to open. */
export function tideGateSweepBlocked(world:RAPIER.World,lane:TideLane,from:TidePoint,to:TidePoint,includeBody:(body:RAPIER.RigidBody)=>boolean):boolean{
 if(!lanes.includes(lane)||![from.x,from.y,from.z,to.x,to.y,to.z].every(Number.isFinite))return true
 let blocked=false
 const mid={x:(from.x+to.x)/2,y:(from.y+to.y)/2,z:(from.z+to.z)/2}
 const shape=new RAPIER.Cuboid(TIDE.halfWidth+Math.abs(to.x-from.x)/2,TIDE.gateHalfHeight+Math.abs(to.y-from.y)/2,TIDE.halfDepth+Math.abs(to.z-from.z)/2)
 world.intersectionsWithShape(mid,identity,shape,collider=>{
  const body=collider.parent()
  if(body&&includeBody(body)){blocked=true;return false}
  return true
 })
 return blocked
}

/** Legacy geometry audit helper; unused by direct delivery.
 * Narrow exception for intentionally withdrawing a floor from caught cargo.
 * Compute the exact vertical extent of each rotated cylinder (or ball), rather
 * than inferring safety from center height. Cargo must be wholly on/above the
 * closed gate plane and centered inside its reservoir. Unknown shapes and
 * side/underside obstructions fail closed. Use this ONLY while purging open;
 * closing always checks every external body against the real swept gate. */
export function tideCargoAboveGate(body:RAPIER.RigidBody,lane:TideLane):boolean{
 if(!lanes.includes(lane)||!body.isDynamic()||body.numColliders()<1)return false
 for(let i=0;i<body.numColliders();i++){
  const collider=body.collider(i),shape=collider.shape,p=collider.translation(),q=collider.rotation()
  let extent:number
  if(shape.type===RAPIER.ShapeType.Cylinder){const cylinder=shape as RAPIER.Cylinder,upY=1-2*(q.x*q.x+q.z*q.z);extent=cylinder.halfHeight*Math.abs(upY)+cylinder.radius*Math.sqrt(Math.max(0,1-upY*upY))}
  else if(shape.type===RAPIER.ShapeType.Ball)extent=(shape as RAPIER.Ball).radius
  else return false
  if(Math.abs(p.x-TIDE.lanes[lane])>TIDE.halfWidth||Math.abs(p.z-tideLaneZ(lane))>TIDE.halfDepth||p.y-extent<TIDE.top-.012||p.y-extent>TIDE.top+TIDE.railHeight+.08)return false
 }
 return true
}

export function createTideMachine(world:RAPIER.World,options:TideOptions){
 const requests:TideRequest[]=[],knownKeys=new Map<string,number>()
 const held:{body:RAPIER.RigidBody;request:TideRequest}[]=[]
 let sequence=0,planned=0,released=0,stage:TideStage='idle',active:TideRequest|null=null
 let lastCompleted:Readonly<TideRequest>|null=null
 let age=0,lastFrame=-Infinity,loadAge=0,batchSize=0,batchBuilt=0,wave=0,blocked=false
 const transition=(next:TideStage)=>{stage=next;age=0}
 const finish=()=>{const finished=active!;requests.shift();lastCompleted={...finished};options.onComplete?.({...finished});active=requests[0]??null;wave=0;transition(active?'choosing':'idle')}
 const routeSafe=()=>held.length===0&&['idle','choosing','waiting'].includes(stage)
 const spawnClear=(index:number,lane:TideLane)=>{
  let clear=true
  world.intersectionsWithShape(tideCoinSlot(index,lane),identity,new RAPIER.Cylinder(TIDE.halfHeight+.012,TIDE.radius+.012),c=>{
   if(c.isSensor())return true
   clear=false;return false
  })
  return clear
 }
 const status=():TideStatus=>{
  const queued=requests.reduce((n,r)=>n+r.remaining,0)
  return {stage,routeSafe:routeSafe(),waitReason:!blocked?null:options.routeAvailable?.()===false?'shared-route':options.room()<1?'capacity':stage==='draining'?'cargo-path':'load-path',blocked,clearing:false,queued,held:held.length,pending:queued+held.length,planned,released,
   requestId:active?.id??null,key:active?.key??null,total:active?.total??0,remaining:active?.remaining??0,requestReleased:active?.released??0,lane:active?.lane??null,practice:active?.practice??false,
   waitingRequests:requests.length-(active?1:0),requestCount:requests.length,lastCompleted:lastCompleted?{...lastCompleted}:null,batchSize,batchBuilt,wave,
   progress:stage==='loading'?batchBuilt/Math.max(1,batchSize):0,gates:[],rails:[]}
 }
 return {
  enqueue(count:number,metadata:{practice?:boolean;key?:string}={}){
   const n=whole(count);if(!n)return null
   const key=metadata.key??null;if(key!==null&&knownKeys.has(key))return knownKeys.get(key)!
   if(!Number.isSafeInteger(planned+n))throw new Error('Tide award total exceeds exact integer accounting')
   const request:TideRequest={id:++sequence,key,total:n,remaining:n,released:0,lane:null,practice:metadata.practice===true}
   requests.push(request);planned+=n;if(key!==null)knownKeys.set(key,request.id)
   if(!active){active=requests[0];wave=0;transition('choosing')}
   return request.id
  },
  chooseLane(id:number,lane:TideLane){
   if(!lanes.includes(lane)||active?.id!==id)return false
   if(active.lane!==null)return active.lane===lane
   if(stage!=='choosing')return false
   active.lane=lane;transition('waiting');return true
  },
  status,
  update(frame:number){
   if(!Number.isFinite(frame)||frame<=lastFrame)return status()
   lastFrame=frame;age++;blocked=false
   // Delivery records the same body's physical departure below the outlet.
   // This never credits the wallet, moves a body, or deletes obstructing cargo.
   const waitingHandles=new Set(held.map(p=>p.body.handle))
   for(let i=held.length-1;i>=0;i--){const p=held[i]
    let fieldContact=false
    // A tall existing pile can receive a coin before it crosses the low outlet
    // plane. Real contact with already-field cargo is delivery too; do not
    // deadlock the shared route while pretending that landed coin is in transit.
    world.contactPairsWith(p.body.collider(0),other=>{
     const b=other.parent();if(!b||!b.isDynamic()||waitingHandles.has(b.handle))return
     const contact=p.body.collider(0).contactCollider(other,.002)
     if(contact&&contact.distance<=.002)fieldContact=true
    })
    if(fieldContact||p.body.translation().y<TIDE.top-TIDE.gateHalfHeight*2-TIDE.halfHeight-.01){held.splice(i,1);waitingHandles.delete(p.body.handle);released++;p.request.released++;options.onRelease?.(p.body,{...p.request})}
   }
   if(stage==='waiting'&&active?.lane){
    if(options.routeAvailable?.()===false||options.room()<1||options.clear?.(active.lane)===false||!spawnClear(0,active.lane))blocked=true
    else if(age>=TIDE.wavePauseFrames){batchSize=Math.min(TIDE.batchMax,active.remaining,Math.floor(options.room()));batchBuilt=0;loadAge=TIDE.loadFrames;wave++;transition('loading')}
   }
   if(stage==='loading'&&active?.lane){
    loadAge++
    if(options.routeAvailable?.()===false){blocked=true}
    else if(loadAge>=TIDE.loadFrames&&batchBuilt<batchSize){
     if(options.room()<1){if(batchBuilt>0)batchSize=batchBuilt;else {blocked=true;transition('waiting')}}
     else if(options.clear?.(active.lane)===false||!spawnClear(batchBuilt,active.lane)){
      // Yield a partial wave rather than monopolize the shared route while
      // an ordinary pile obstructs the next inlet. Existing bodies stay real.
      blocked=true;if(batchBuilt>0)batchSize=batchBuilt;else transition('waiting')
     }else{
      const body=options.createCoin(tideCoinSlot(batchBuilt,active.lane),{...active})
      body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);body.setRotation(identity,true)
      body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true)
      held.push({body,request:active});active.remaining--;batchBuilt++;loadAge=0
     }
    }
    if(batchBuilt===batchSize&&batchBuilt>0)transition('draining')
   }else if(stage==='draining'){
    if(held.length)blocked=age>60
    else {batchSize=0;batchBuilt=0;if(active!.remaining)transition('waiting');else finish()}
   }
   return status()
  },
 }
}
