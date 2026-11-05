import RAPIER from '@dimforge/rapier3d-compat'

/** Independent contact-accuracy requests compose by maximum, never by restoring a
 * stale snapshot of another controller's request. No forces or poses are changed. */
type Source = 'tower-withdrawal' | 'rear-apron'
type Requests = {base:number; values:Partial<Record<Source,number>>}
const worlds = new WeakMap<RAPIER.World,Map<number,Requests>>()
export function setBodySolverBoost(world:RAPIER.World,body:RAPIER.RigidBody,source:Source,iterations:number){
 let requests=worlds.get(world)
 if(!requests){requests=new Map();worlds.set(world,requests)}
 let state=requests.get(body.handle)
 if(!state){if(!iterations)return;state={base:body.additionalSolverIterations(),values:{}};requests.set(body.handle,state)}
 if(iterations)state.values[source]=iterations
 else delete state.values[source]
 const next=Math.max(state.base,...Object.values(state.values))
 if(body.additionalSolverIterations()!==next)body.setAdditionalSolverIterations(next)
 if(!Object.keys(state.values).length)requests.delete(body.handle)
}


export function pruneSolverBoosts(world:RAPIER.World){
 const requests=worlds.get(world)
 if(requests)for(const handle of requests.keys())if(!world.getRigidBody(handle))requests.delete(handle)
}

/** A bounded side-building carriage, not an overhead payout chute. Coins keep the same Rapier
 * body from the visible side build head through the carriage, field and tray.
 * The construction jig holds them kinematic while building/sliding/lowering; opening
 * the two real support leaves hands them to ordinary gravity/contact physics.
 * Empty leaves return open to the right build bay, then raise and close along a clear swept
 * path. Their status always reports the real body pose for matching meshes.
 * The complete loaded route is preflighted and every increment swept again.
 * No planar impulse or position correction is applied after that handoff. */
export const TOWER = {
 // Construction is wholly outside the right playfield. The open shutter return
 // runs forward of the right supply slide through a matching low side sill.
 x: 5.6, dockX: 1.3, z: -2.3, buildTop: 1.75, releaseTop: 1.55, parkTop: 1.75, resetTop: 1.75,
 radius: .31, halfHeight: .055, pitch: .112, columnPitch: .628, ringRadius: .82, layerTwist: Math.PI/8,
 medalsPerLayer: 8, rows: 30, batchMax: 240,
 leafHalfWidth: 1.16, leafHalfHeight: .04, leafHalfDepth: .58,
 opening: 1.2, headClearance: .60,
 buildFrames: 4, transferFrames: 210, lowerFrames: 30, holdFrames: 18,
 openFrames: 72, returnFrames: 90, parkFrames: 18, deployFrames: 18,
} as const
export type TowerSource = 'bank' | 'prize' | 'stock'
export type TowerStage = 'idle' | 'deploying' | 'building' | 'transferring' | 'homing' | 'lowering' | 'ready' | 'releasing' | 'returning' | 'parking'
export type TowerPoint = {x:number;y:number;z:number}
export type TowerRequest = {id:number;source:TowerSource;total:number;remaining:number}
export type TowerWaitReason = 'shared-route' | 'capacity' | 'cargo-path' | 'support-path'
export type TowerStatus = {
 stage:TowerStage; blocked:boolean; waitReason:TowerWaitReason|null; clearing:boolean; queued:number; held:number; pending:number;
 planned:number; released:number; stockHeld:number; stockReleased:number; batchSize:number; batchBuilt:number;
 requestId:number|null; source:TowerSource|null; progress:number;
 supports:TowerPoint[]; head:TowerPoint|null;
}
export type TowerOptions = {
 /** Create one ordinary coin in the global render/settlement map. It is made
  * kinematic by this controller before any world step. */
 createCoin:(position:TowerPoint,request:Readonly<TowerRequest>)=>RAPIER.RigidBody
 room:()=>number
 /** Unawarded starting stock; held until the next requested tower release. */
 initialStock?:number
 /** False delays admission/transfer, never loses an award. Used for shared
  * route ownership; this controller separately sweeps every real cargo/leaf. */
 clear?:()=>boolean
 onRelease?:(body:RAPIER.RigidBody,request:Readonly<TowerRequest>)=>void
}
const zero={x:0,y:0,z:0},identity={x:0,y:0,z:0,w:1}
const smooth=(t:number)=>{const p=Math.max(0,Math.min(1,t));return p*p*(3-2*p)}
const whole=(n:number)=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0

/** Stationary side-bay admission envelope of the closed cradle and construction head. Query the actual
 * Rapier shapes, not piece centers: upright coins and low-centered balls can
 * intersect the lift even when their centers lie below it. */
export const TOWER_SWEEP = {
 bottom: TOWER.releaseTop-TOWER.leafHalfHeight*2,
 top: TOWER.buildTop+TOWER.halfHeight*2+(Math.ceil(TOWER.batchMax/TOWER.medalsPerLayer)-1)*TOWER.pitch+TOWER.headClearance,
 halfWidth:TOWER.leafHalfWidth, halfDepth:TOWER.leafHalfDepth*2,
} as const
const sweepShape=new RAPIER.Cuboid(TOWER_SWEEP.halfWidth,(TOWER_SWEEP.top-TOWER_SWEEP.bottom)/2,TOWER_SWEEP.halfDepth)
export function towerSweepBlocked(world:RAPIER.World,includeBody:(body:RAPIER.RigidBody)=>boolean):boolean {
 let blocked=false
 world.intersectionsWithShape({x:TOWER.x,y:(TOWER_SWEEP.top+TOWER_SWEEP.bottom)/2,z:TOWER.z},identity,sweepShape,collider=>{
  const body=collider.parent()
  if(body&&includeBody(body)){blocked=true;return false}
  return true
 })
 return blocked
}

/** Exact conservative sweep for an unrotated real support leaf. The loaded
 * carriage slides right-bay to right-field; empty leaves close before returning home. Query
 * colliders, not centers: a coin edge, ball, or fixed fixture pauses the move.
 * The caller excludes own leaves/held cargo. Only outward floor withdrawal
 * may also exclude this batch's released cargo and verified top-supported
 * foreign cargo; return checks every released/foreign body normally. */
export function towerSupportSweepBlocked(world:RAPIER.World,from:TowerPoint,to:TowerPoint,excludeBody:(body:RAPIER.RigidBody)=>boolean):boolean {
 let blocked=false
 const center={x:(from.x+to.x)/2,y:(from.y+to.y)/2,z:(from.z+to.z)/2}
 const shape=new RAPIER.Cuboid(TOWER.leafHalfWidth+Math.abs(to.x-from.x)/2,TOWER.leafHalfHeight+Math.abs(to.y-from.y)/2,TOWER.leafHalfDepth+Math.abs(to.z-from.z)/2)
 world.intersectionsWithShape(center,identity,shape,collider=>{
  if(collider.isSensor())return true
  const body=collider.parent()
  if(body&&excludeBody(body))return true
  blocked=true;return false
 })
 return blocked
}

/** A withdrawing floor must not latch on the ordinary medal/ball resting on
 * its top. This is a geometric contact exception, not a foreign-cargo award:
 * only known dynamic shapes wholly above this leaf's top plane qualify, using
 * the exact rotated cylinder extent rather than the body center. Its actual
 * projected extents must overlap the current leaf footprint, with its bottom at
 * the top plane; a supported rim stays eligible while the floor withdraws.
 * Never use this for lifting, lowering, closing, or the opposite support leaf. */
export function towerCargoAboveSupport(body:RAPIER.RigidBody,support:TowerPoint):boolean {
 if(!body.isDynamic()||body.numColliders()<1)return false
 const top=support.y+TOWER.leafHalfHeight,skin=.012
 for(let i=0;i<body.numColliders();i++){
  const collider=body.collider(i),shape=collider.shape,p=collider.translation(),q=collider.rotation()
  let extent:number,extentX:number,extentZ:number
  if(shape.type===RAPIER.ShapeType.Cylinder){
   const cylinder=shape as RAPIER.Cylinder,upY=1-2*(q.x*q.x+q.z*q.z),upX=2*(q.x*q.y-q.w*q.z),upZ=2*(q.y*q.z+q.w*q.x)
   const reach=(up:number)=>cylinder.halfHeight*Math.abs(up)+cylinder.radius*Math.sqrt(Math.max(0,1-up*up))
   extent=reach(upY);extentX=reach(upX);extentZ=reach(upZ)
  }else if(shape.type===RAPIER.ShapeType.Ball)extent=extentX=extentZ=(shape as RAPIER.Ball).radius
  else return false
  const bottom=p.y-extent
  if(Math.abs(p.x-support.x)>TOWER.leafHalfWidth+extentX||Math.abs(p.z-support.z)>TOWER.leafHalfDepth+extentZ||bottom<top-skin||bottom>top+skin)return false
 }
 return true
}

/** Eight real normal-size medals form each hollow ring. Alternating half-step
 * layers bridge their neighbours without coplanar overlap. Existing awards are
 * not multiplied: a 20-medal request remains exactly 20 real medals. Starting
 * stock is separate provenance and never counted as an earned award. */
export function towerCoinSlot(index:number,_count:number):TowerPoint {
 const i=whole(index),layer=Math.floor(i/TOWER.medalsPerLayer)
 const angle=(i%TOWER.medalsPerLayer)*Math.PI*2/TOWER.medalsPerLayer+layer*TOWER.layerTwist
 return {x:TOWER.x+TOWER.ringRadius*Math.cos(angle),
  y:TOWER.halfHeight+layer*TOWER.pitch,
  z:TOWER.z+TOWER.ringRadius*Math.sin(angle)}
}

export function createTowerMachine(world:RAPIER.World,options:TowerOptions){
 const requests:TowerRequest[]=[]
 const held:{body:RAPIER.RigidBody;slot:TowerPoint;request:TowerRequest}[]=[]
 const departing=new Set<number>()
 let sequence=0,planned=0,released=0,stockReleased=0,stage:TowerStage='idle',age=0,lastFrame=-Infinity
 let clearing=false,returnX:number=TOWER.dockX,returnTop:number=TOWER.releaseTop
 let active:TowerRequest|null=null,batchSize=0,batchBuilt=0,blocked=false,top:number=TOWER.parkTop,opening=0,x:number=TOWER.x
 let waitReason:TowerWaitReason|null=null
 const block=(reason:TowerWaitReason)=>{blocked=true;waitReason=reason}
 let incoming:{body:RAPIER.RigidBody;slot:TowerPoint;age:number}|null=null
 const supports=[-1,1].map(side=>{
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,top-TOWER.leafHalfHeight,TOWER.z+side*TOWER.leafHalfDepth))
  body.setAdditionalSolverIterations(8)
  // Polished idealized shutters must slip beneath loose coins, not convey them.
  world.createCollider(RAPIER.ColliderDesc.cuboid(TOWER.leafHalfWidth,TOWER.leafHalfHeight,TOWER.leafHalfDepth)
   .setFriction(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(0),body)
  return {side,body}
 })
 const initialStock=Math.min(TOWER.batchMax-TOWER.medalsPerLayer,whole(options.initialStock??0),Math.floor(options.room()))
 if(initialStock){
  const request:TowerRequest={id:0,source:'stock',total:initialStock,remaining:0}
  for(let i=0;i<initialStock;i++){
   const slot=towerCoinSlot(i,initialStock),body=options.createCoin({x:slot.x,y:top+slot.y,z:slot.z},request)
   body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true)
   body.setRotation(identity,true);body.setLinvel(zero,true);body.setAngvel(zero,true)
   held.push({body,slot,request})
  }
 }
 const moveSupports=()=>supports.forEach(({side,body})=>body.setNextKinematicTranslation({x,y:top-TOWER.leafHalfHeight,z:TOWER.z+side*(TOWER.leafHalfDepth+opening)}))
 const cargoSweepBlocked=(from:TowerPoint,to:TowerPoint,exclude:Set<number>)=>{
  let hit=false
  // Held coins stay upright; this exact conservative translational envelope
  // includes their rim, not merely their centers. No fixture is filtered out.
  const shape=new RAPIER.Cuboid(TOWER.radius+Math.abs(to.x-from.x)/2,TOWER.halfHeight+Math.abs(to.y-from.y)/2,TOWER.radius+Math.abs(to.z-from.z)/2)
  world.intersectionsWithShape({x:(from.x+to.x)/2,y:(from.y+to.y)/2,z:(from.z+to.z)/2},identity,shape,c=>{
   if(c.isSensor()|| (c.parent()&&exclude.has(c.parent()!.handle)))return true
   hit=true;return false
  });return hit
 }
 const ownHandles=()=>new Set([...supports.map(s=>s.body.handle),...held.map(p=>p.body.handle)])
 const moveSupportPose=(nextTop:number,nextOpening:number,withdraw=false,nextX=x,dryRun=false)=>{
  // Empty motor motion is deliberately slow. Ordinary dynamic medals are
  // exempt from the conservative preflight ONLY: their colliders remain fully
  // enabled and the real floor contacts displace them. Fixed fixtures, balls and
  // held cargo still stop the motor; all loaded moves use the full sweep.
  const emptyMotor=held.length===0&&['releasing','returning','homing','parking'].includes(stage)
  let intermediate=false
  if(emptyMotor&&!dryRun){
   const distance=Math.hypot(nextX-x,nextTop-top,nextOpening-opening)
   if(distance>.008){const scale=.008/distance;nextX=x+(nextX-x)*scale;nextTop=top+(nextTop-top)*scale;nextOpening=opening+(nextOpening-opening)*scale;intermediate=true}
  }

  const motorCoin=(b:RAPIER.RigidBody)=>emptyMotor&&b.isDynamic()&&b.numColliders()===1&&b.collider(0).shape.type===RAPIER.ShapeType.Cylinder
  const excluded=new Set([...supports.map(s=>s.body.handle),...held.map(p=>p.body.handle),...(withdraw?departing:[])])
  const outward=withdraw&&nextOpening>opening&&Math.abs(nextTop-top)<1e-9
  const obstructed=supports.some(({side,body})=>{
   const from=body.translation(),to={x:nextX,y:nextTop-TOWER.leafHalfHeight,z:TOWER.z+side*(TOWER.leafHalfDepth+nextOpening)}
   if(Math.hypot(from.x-to.x,from.y-to.y,from.z-to.z)<1e-6)return false
   return towerSupportSweepBlocked(world,from,to,b=>excluded.has(b.handle)||motorCoin(b)||(outward&&towerCargoAboveSupport(b,from)))
  })
  const cargoBlocked=held.some(({body,slot})=>cargoSweepBlocked(body.translation(),{x:slot.x+nextX-TOWER.x,y:nextTop+slot.y,z:slot.z},excluded))
  if(obstructed||cargoBlocked){block(cargoBlocked?'cargo-path':'support-path');return false}
  if(!dryRun){top=nextTop;opening=nextOpening;x=nextX}return !intermediate
 }
 const moveEmptyTop=(nextTop:number)=>moveSupportPose(nextTop,opening)
 const positionHeld=()=>held.forEach(({body,slot})=>{
  const rise=incoming?.body===body?TOWER.headClearance*(1-smooth(incoming.age/TOWER.buildFrames)):0
  body.setNextKinematicTranslation({x:slot.x+x-TOWER.x,y:top+slot.y+rise,z:slot.z})
 })
 const transition=(next:TowerStage)=>{stage=next;age=0}
 const status=():TowerStatus=>{
  const queued=requests.reduce((n,r)=>n+r.remaining,0),stockHeld=held.filter(p=>p.request.source==='stock').length
  const progress=stage==='building'?batchBuilt/Math.max(1,batchSize):stage==='deploying'?age/TOWER.deployFrames:stage==='parking'?age/TOWER.parkFrames:stage==='transferring'?age/TOWER.transferFrames:stage==='homing'?age/(TOWER.parkFrames+TOWER.transferFrames):stage==='lowering'?age/TOWER.lowerFrames:stage==='ready'?age/TOWER.holdFrames:stage==='releasing'?age/TOWER.openFrames:stage==='returning'?age/TOWER.returnFrames:0
  return {stage,blocked,waitReason,clearing,queued,held:held.length,pending:queued+held.length-stockHeld,planned,released,stockHeld,stockReleased,batchSize,batchBuilt,
   requestId:active?.id??null,source:active?.source??null,progress:Math.min(1,progress),
   supports:supports.map(s=>({...s.body.translation()})),
   head:incoming?{x:incoming.slot.x,y:top+incoming.slot.y+TOWER.headClearance,z:incoming.slot.z}:null}
 }
 return {
  /** Requests remain independent and FIFO, including two bank releases in one
   * frame. The source survives every staged batch. */
  enqueue(count:number,source:Exclude<TowerSource,'stock'>='prize'){
   const n=whole(count);if(!n)return null
   const request={id:++sequence,source,total:n,remaining:n};requests.push(request);planned+=n;return request.id
  },
  status,
  /** Call exactly before the shared fixed world.step(). Repeating a frame is a
   * no-op; a background-tab jump cannot spawn a burst or skip a release stage. */
  update(frame:number){
   if(!Number.isFinite(frame)||frame<=lastFrame)return status()
   lastFrame=frame;blocked=false;waitReason=null;age++
   if(stage==='idle'&&requests.length){
    let foreignFloorCargo=false
    if(!held.length){
     const own=new Set(supports.map(s=>s.body.handle))
     world.forEachRigidBody(body=>{
      if(!own.has(body.handle)&&body.isDynamic()&&body.numColliders()===1&&body.collider(0).shape.type===RAPIER.ShapeType.Cylinder&&supports.some(s=>towerCargoAboveSupport(body,s.body.translation())))foreignFloorCargo=true
     })
    }
    if(foreignFloorCargo&&options.clear?.()!==false){
     // Empty bay purge: these are existing foreign bodies, not another award.
     // Open the actual floor before admitting any requested construction.
     clearing=true;active=null;batchBuilt=0;batchSize=0;transition('releasing')
    }else if(options.clear?.()===false)block('shared-route')
    else if(options.room()<1)block('capacity')
    else{active=requests[0];batchSize=Math.min(TOWER.batchMax,held.length+active.remaining,held.length+Math.floor(options.room()));batchBuilt=held.length;transition('deploying')}
   }
   if(stage==='deploying'){
    const next=TOWER.parkTop+(TOWER.buildTop-TOWER.parkTop)*smooth(age/TOWER.deployFrames)
    if(!moveEmptyTop(next))age--
    else if(age>=TOWER.deployFrames){top=TOWER.buildTop;transition('building')}
   }else if(stage==='building'){
    if(incoming){
     const nextAge=incoming.age+1,slot=incoming.slot
     const next={x:slot.x,y:top+slot.y+TOWER.headClearance*(1-smooth(nextAge/TOWER.buildFrames)),z:slot.z}
     if(cargoSweepBlocked(incoming.body.translation(),next,ownHandles()))block('cargo-path')
     else{incoming.age=nextAge;if(incoming.age>=TOWER.buildFrames){incoming=null;batchBuilt++}}
    }
    if(!incoming&&batchBuilt<batchSize&&active){
     if(options.room()<1){
      // Another feeder may use the remaining capacity after admission. Finish
      // this smaller physical stack; holding it forever would prevent the
      // field from clearing capacity. Existing positions never recenter.
      if(batchBuilt>0)batchSize=batchBuilt
      else block('capacity')
     }
     else{
      const slot=towerCoinSlot(batchBuilt,batchSize),at={x:slot.x,y:top+slot.y+TOWER.headClearance,z:slot.z}
      if(cargoSweepBlocked(at,{...at,y:top+slot.y},ownHandles())){block('cargo-path');positionHeld();moveSupports();return status()}
      const body=options.createCoin(at,{...active})
      body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true)
      body.setRotation(identity,true);body.setLinvel(zero,true);body.setAngvel(zero,true)
      held.push({body,slot,request:active});active.remaining--;incoming={body,slot,age:0}
     }
    }
    if(batchBuilt===batchSize&&!incoming){
     if(options.clear?.()===false)block('shared-route')
     else if(moveSupportPose(top,opening,false,TOWER.dockX,true))transition('transferring')
    }
   }else if(stage==='transferring'){
    if(options.clear?.()===false){age--;block('shared-route')}
    else if(!moveSupportPose(top,opening,false,TOWER.x+(TOWER.dockX-TOWER.x)*smooth(age/TOWER.transferFrames)))age--
    else if(age>=TOWER.transferFrames)transition('lowering')
   }else if(stage==='lowering'){
    // A blocked sweep pauses the lift without modifying its already held coins.
    if(options.clear?.()===false){age--;block('shared-route')}
    else{const next=TOWER.buildTop+(TOWER.releaseTop-TOWER.buildTop)*smooth(age/TOWER.lowerFrames);if(!moveSupportPose(next,opening))age--;else if(age>=TOWER.lowerFrames){top=TOWER.releaseTop;transition('ready')}}
   }else if(stage==='ready'&&age>=TOWER.holdFrames){
    for(const {body,request} of held){
     body.setBodyType(RAPIER.RigidBodyType.Dynamic,true)
     setBodySolverBoost(world,body,'tower-withdrawal',8) // temporary contact accuracy during withdrawal
     // This zero is the end of the stopped construction jig, not a field nudge.
     body.setLinvel(zero,true);body.setAngvel(zero,true)
     departing.add(body.handle);if(request.source==='stock')stockReleased++;else released++;options.onRelease?.(body,{...request})
    }
    held.length=0;transition('releasing')
   }else if(stage==='releasing'){
    // The withdrawing floor may slide under its own newly released cargo.
    // Foreign top-supported medals/balls may fall from the withdrawing floor
    // too; their identity and award status never change. Empty-floor contact
    // mode still stops for fixed fixtures, held supply and unsupported balls.
    if(!moveSupportPose(top,TOWER.opening*smooth(age/TOWER.openFrames),true))age--
    else if(age>=TOWER.openFrames){opening=TOWER.opening;for(const handle of departing){const body=world.getRigidBody(handle);if(body)setBodySolverBoost(world,body,'tower-withdrawal',0)};departing.clear();returnX=x;returnTop=top;transition('returning')}
   }else if(stage==='returning'){
    // Bring EMPTY open shutters home horizontally through the clear right lane,
    // away from the Tide rails and transparent cover; never lift through a tower.
    const nextX=returnX+(TOWER.x-returnX)*smooth(age/TOWER.returnFrames)
    if(!moveSupportPose(returnTop,TOWER.opening,false,nextX))age--
    else if(age>=TOWER.returnFrames)transition('homing')
   }else if(stage==='homing'){
    // Raise the OPEN leaves in the clear home lane before closing. Closing
    // low formed a narrow throat against the transparent cover for upright coins.
    const lift=smooth(age/TOWER.parkFrames),close=smooth((age-TOWER.parkFrames)/TOWER.transferFrames)
    const nextTop=returnTop+(TOWER.parkTop-returnTop)*lift
    const nextOpening=TOWER.opening*(1-close)
    if(!moveSupportPose(nextTop,nextOpening,false,TOWER.x))age--
    else if(age>=TOWER.parkFrames+TOWER.transferFrames){
     if(active?.remaining===0)requests.shift()
     active=null;batchSize=0;batchBuilt=0;transition('parking')
    }
   }else if(stage==='parking'){
    // Already high and closed: dwell without any downward parking dip.
    if(!moveEmptyTop(TOWER.parkTop))age--
    else if(age>=TOWER.parkFrames){top=TOWER.parkTop;clearing=false;transition('idle')}
   }
   positionHeld();moveSupports();return status()
  },
 }
}
