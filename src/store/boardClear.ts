import RAPIER from '@dimforge/rapier3d-compat'
import { TRAY } from './dispense'

/** Board Clear's visible magnetic collector is deliberately a special powered
 * mechanism. It steers the SAME dynamic medals with bounded impulses; it never
 * sets their position, disables their collisions, credits money or removes them.
 * The ordinary cabinet is unchanged when this mechanism is not running. */
// Bounded transport only: neither the physics clock nor collection timing is sped up.
export const BOARD_CLEAR={batch:144,speed:5.2,acceleration:24,radius:.31,halfHeight:.055} as const
export type ClearPoint={x:number;y:number;z:number}
export type ClearPiece={body:RAPIER.RigidBody;counted:number}
export type ClearActive={id:number;position:ClearPoint;target:ClearPoint;stage:'lifting'|'carrying'|'dropping'}
export type BoardClearStatus={stage:'idle'|'sweeping'|'draining'|'complete';total:number;collected:number;retired:number;remaining:number;blocked:number;active:ClearActive[];targetIds:number[]}
export type BoardClearOptions={piece:(id:number)=>ClearPiece|undefined;obstacle?:(collider:RAPIER.Collider)=>boolean;trayHalfWidth?:number}
type Target={id:number;slot:ClearPoint;gravity:number;damping:number;angularDamping:number;state:'waiting'|'routing'|'dropping'|'collected'|'retired';route:ClearPoint[];age:number;lastDistance:number;stalled:number;escape:boolean;strongPull:boolean;retryAt:number;slip:{goal:ClearPoint;balls:number[];basis:ClearPoint}|null;holdLevel:boolean}
const identity={x:0,y:0,z:0,w:1}
const copy=(p:ClearPoint):ClearPoint=>({x:p.x,y:p.y,z:p.z})
const distance=(a:ClearPoint,b:ClearPoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)
const limit=(v:ClearPoint,n:number)=>{const len=Math.hypot(v.x,v.y,v.z);return len>n?{x:v.x*n/len,y:v.y*n/len,z:v.z*n/len}:v}

export function createBoardClearMachine(world:RAPIER.World,options:BoardClearOptions){
 // Keep the collector's goal atlas, distributed slots, and reacquisition
 // boundary inside the actual narrow catcher. Every target still uses contact.
 const trayHalfWidth=options.trayHalfWidth??TRAY.halfWidth
 const slotPitch=BOARD_CLEAR.radius*2,slotColumns=Math.max(1,Math.floor((trayHalfWidth-BOARD_CLEAR.radius-.08)*2/slotPitch)+1)
 const slotHalfWidth=(slotColumns-1)*slotPitch/2
 const targets=new Map<number,Target>()
 let stage:BoardClearStatus['stage']='idle',lastFrame=-Infinity,clock=0,blocked=0,lastCollected=0,lastProgress=0,lastReplan=0
 // Orientation-independent navigation encloses an ordinary medal even while
 // contacts tilt it. Exact swept shapes test every graph
 // edge, so a thin closed gate between samples is never mistaken for open air.
 // A magnetic torque aligns a coin gradually, rather than teleporting rotation.
 const navShape=new RAPIER.Ball(.325),coinShape=new RAPIER.Cylinder(BOARD_CLEAR.halfHeight,BOARD_CLEAR.radius)
 const xs=Array.from({length:37},(_,i)=>-8.1+i*.45),zs=Array.from({length:39},(_,i)=>-8.1+i*.45)
 const ys=[-3.4,-2.7,-2.15,-1.5,-.8,.16,.78,1.03,1.58,2.25,3,4,5,6.1,7.3]
 const NX=xs.length,NZ=zs.length,NY=ys.length,size=NX*NZ*NY
 const index=(x:number,y:number,z:number)=>(y*NZ+z)*NX+x
 const point=(i:number):ClearPoint=>{const x=i%NX,z=Math.floor(i/NX)%NZ,y=Math.floor(i/(NX*NZ));return{x:xs[x],y:ys[y],z:zs[z]}}
 let parents=new Int32Array(0),open=new Uint8Array(0)
 const obstacle=(collider:RAPIER.Collider)=>{
  if(collider.isSensor())return false
  const body=collider.parent();if(body&&targets.has(body.handle))return false
  return options.obstacle?.(collider)!==false
 }
 const free=(at:ClearPoint)=>{let found=false;world.intersectionsWithShape(at,identity,navShape,()=>{found=true;return false},undefined,undefined,undefined,undefined,obstacle);return !found}
 const line=(a:ClearPoint,b:ClearPoint,shape:RAPIER.Shape=navShape,rotation=identity)=>!world.castShape(a,rotation,{x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},shape,.002,1,false,undefined,undefined,undefined,undefined,obstacle)
 // A solver can compress an upright medal between two frozen prize balls.
 // Ordinary casts correctly return TOI=0 there. This narrowly permits a short
 // tangential retreat from ONLY those existing contacts, never a new overlap.
 const slipPath=(body:RAPIER.RigidBody,goal:ClearPoint,ids:number[])=>{
  const at=body.translation(),q=body.rotation(),length=distance(at,goal)
  if(length>.421)return false
  const balls=ids.map(id=>world.getCollider(id))
  if(balls.some(c=>!c||!c.parent()?.isFixed()||c.shape.type!==RAPIER.ShapeType.Ball||Math.abs((c.shape as RAPIER.Ball).radius-TRAY.ballRadius)>.0001))return false
  const self=body.collider(0).handle,other=(c:RAPIER.Collider)=>!c.isSensor()&&c.handle!==self&&!ids.includes(c.handle)
  let occupied=false
  world.forEachCollider(c=>{if(other(c)){const hit=c.contactShape(coinShape,at,q,.002);if(hit&&hit.distance<.002)occupied=true}})
  if(occupied||world.castShape(at,q,{x:goal.x-at.x,y:goal.y-at.y,z:goal.z-at.z},coinShape,.002,1,false,undefined,undefined,undefined,undefined,other))return false
  let previous=balls.map(c=>c.contactShape(coinShape,at,q,.003)?.distance??.003)
  if(previous.some(d=>d<-.025))return false
  const steps=Math.max(1,Math.ceil(length/.005))
  for(let i=1;i<=steps;i++){
   const p={x:at.x+(goal.x-at.x)*i/steps,y:at.y+(goal.y-at.y)*i/steps,z:at.z+(goal.z-at.z)*i/steps}
   const next=balls.map(c=>c.contactShape(coinShape,p,q,.003)?.distance??.003)
   if(next.some((d,j)=>d<previous[j]-.000002))return false
   previous=next
  }
  return previous.every(d=>d>=.002)
 }
 const findSlip=(body:RAPIER.RigidBody,preferred?:ClearPoint)=>{
  const at=body.translation(),q=body.rotation(),n={x:2*(q.x*q.y-q.w*q.z),y:1-2*(q.x*q.x+q.z*q.z),z:2*(q.y*q.z+q.w*q.x)}
  if(Math.abs(n.y)>.35)return null
  const hits:{id:number;normal:ClearPoint}[]=[]
  world.forEachCollider(c=>{if(c.parent()?.isFixed()&&c.shape.type===RAPIER.ShapeType.Ball&&Math.abs((c.shape as RAPIER.Ball).radius-TRAY.ballRadius)<.0001){const hit=c.contactShape(coinShape,at,q,0);if(hit&&hit.distance<0&&hit.distance>=-.025)hits.push({id:c.handle,normal:hit.normal1})}})
  if(hits.length!==2||hits[0].normal.x*hits[1].normal.x+hits[0].normal.y*hits[1].normal.y+hits[0].normal.z*hits[1].normal.z>-.95)return null
  const balls=hits.map(h=>h.id)
  for(const basis of [...(preferred?[preferred]:[]),{x:0,y:-1,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}]){
   const dot=basis.x*n.x+basis.y*n.y+basis.z*n.z,v={x:basis.x-dot*n.x,y:basis.y-dot*n.y,z:basis.z-dot*n.z},norm=Math.hypot(v.x,v.y,v.z)
   if(norm<.1)continue
   for(const length of [.12,.16,.2,.24,.28,.30,.32,.34,.36,.38,.4,.42]){const goal={x:at.x+v.x/norm*length,y:at.y+v.y/norm*length,z:at.z+v.z/norm*length};if(slipPath(body,goal,balls))return {goal,balls,basis}}
  }
  return null
 }
 const atlas=()=>{
  parents=new Int32Array(size);parents.fill(-2);open=new Uint8Array(size)
  for(let i=0;i<size;i++)open[i]=free(point(i))?1:0
  const queue=new Int32Array(size);let head=0,tail=0
  // Goal row is over the actual front collection tray, not a credit sensor.
  const zi=Math.round((TRAY.center-zs[0])/.45),yi=6
  for(let x=0;x<NX;x++){if(Math.abs(xs[x])>trayHalfWidth-BOARD_CLEAR.radius-.08)continue;const at=index(x,yi,zi);if(open[at]){parents[at]=-1;queue[tail++]=at}}
  while(head<tail){const i=queue[head++],x=i%NX,z=Math.floor(i/NX)%NZ,y=Math.floor(i/(NX*NZ)),from=point(i)
   const neighbors=[x?i-1:-1,x<NX-1?i+1:-1,z?i-NX:-1,z<NZ-1?i+NX:-1,y?i-NX*NZ:-1,y<NY-1?i+NX*NZ:-1]
   for(const j of neighbors)if(j>=0&&open[j]&&parents[j]===-2&&line(from,point(j))){parents[j]=i;queue[tail++]=j}
  }
 }
 const route=(body:RAPIER.RigidBody,slot:ClearPoint,escapeFirst=false):ClearPoint[]=>{
  const at=body.translation(),candidates:number[]=[]
  // Sweep above the waiting pile instead of towing through its lower layers.
  // These are motor waypoints, not position changes. Each entire lift, carry
  // and descent sweeps real protected/fixture geometry before admission.
  // Narrow cups, roofs and supported-ball cases retain the atlas escape below.
  if(!escapeFirst)for(const height of [3,4,5,6.1,7.3]){
   if(height<at.y+.35)continue
   const lift={x:at.x,y:height,z:at.z},over={x:slot.x,y:height,z:slot.z}
   if(line(at,lift,coinShape,body.rotation())&&line(lift,over)&&line(over,slot))return [lift,over,slot]
  }
  const xi=Math.max(0,Math.min(NX-1,Math.round((at.x-xs[0])/.45))),zi=Math.max(0,Math.min(NZ-1,Math.round((at.z-zs[0])/.45)))
  const nearestY=ys.map((y,i)=>({i,d:Math.abs(y-at.y)})).sort((a,b)=>a.d-b.d).slice(0,5)
  for(const {i:y} of nearestY)for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++)if(xi+dx>=0&&xi+dx<NX&&zi+dz>=0&&zi+dz<NZ){const i=index(xi+dx,y,zi+dz);if(parents[i]>=-1)candidates.push(i)}
  candidates.sort((a,b)=>distance(at,point(a))-distance(at,point(b)))
  let start=-1,prefix:ClearPoint[]=[]
  if(!escapeFirst)for(const i of candidates){if(line(at,point(i),coinShape,body.rotation())){start=i;break}}
  // A narrow open reservoir can be physically wide enough for a medal but
  // contain no flat atlas-grid center. Lift at the exact current X/Z above its
  // rim before joining the atlas. Both actual oriented sweeps must be clear;
  // a closed roof/held body still blocks this route rather than being ignored.
  if(start<0)for(const rise of [.45,.9,1.35,1.8,2.4]){
   const escape={x:at.x,y:at.y+rise,z:at.z}
   if(!line(at,escape,coinShape,body.rotation()))continue
   const near=[...candidates].sort((a,b)=>distance(escape,point(a))-distance(escape,point(b)))
   for(const i of near)if(line(escape,point(i),coinShape,body.rotation())){start=i;prefix=[escape];break}
   if(start>=0)break
  }
  // A medal under a preserved ball / low roof may have room to slide, but no
  // room to rise to the first atlas layer. Escape laterally at its EXACT current
  // height first; if a sloping cover closes that horizontal gap, also test small
  // rising/descending exits. Both legs sweep its actual oriented shape and remain dynamic
  // motor targets; this is not an endpoint translation or overlap exemption.
  // A wall and a preserved ball overhang can leave a low corridor that needs
  // a descent BEFORE the lateral leg. All three complete oriented sweeps must
  // pass. The landing height comes from an oriented cast to the actual floor,
  // not a guessed decrement. Tiny side offsets find free positive wall gaps.
  if(start<0)low:for(const dx of [0,.005,-.005]){
   const fall={x:dx,y:-1.2,z:0},floor=world.castShape(at,body.rotation(),fall,coinShape,.002,1,false,undefined,undefined,undefined,undefined,obstacle)
   if(!floor||floor.time_of_impact<.05||floor.normal1.y<.4)continue
   const fraction=Math.max(0,floor.time_of_impact-.025/1.2)
   const down={x:at.x+dx*fraction,y:at.y+fall.y*fraction,z:at.z}
   if(!line(at,down,coinShape,body.rotation()))continue
   for(const radius of [.45,.9,1.35])for(let direction=0;direction<16;direction++){
    const a=direction*Math.PI/8,escape={x:down.x+Math.cos(a)*radius,y:down.y,z:down.z+Math.sin(a)*radius}
    if(!line(down,escape,coinShape,body.rotation()))continue
    const near=[...candidates].sort((a,b)=>distance(escape,point(a))-distance(escape,point(b)))
    for(const i of near)if(line(escape,point(i),coinShape,body.rotation())){start=i;prefix=[down,escape];break low}
   }
  }
  if(start<0)outer:for(const dy of [0,-.12,-.24,-.36,.12,.24])for(const radius of [.45,.9,1.35])for(let direction=0;direction<16;direction++){
   const a=direction*Math.PI/8,escape={x:at.x+Math.cos(a)*radius,y:at.y+dy,z:at.z+Math.sin(a)*radius}
   if(!line(at,escape,coinShape,body.rotation()))continue
   const near=[...candidates].sort((a,b)=>distance(escape,point(a))-distance(escape,point(b)))
   for(const i of near)if(line(escape,point(i),coinShape,body.rotation())){start=i;prefix=[escape];break outer}
  }
  if(start<0)return []
  const points:ClearPoint[]=[];let i=start,guard=0
  while(i>=0&&guard++<size){points.push(point(i));i=parents[i]}
  // Distribution prevents the collector making one narrow heap in the tray.
  points.push(slot)
  // Compress only when the complete conservative sweep is clear. The first
  // leg also sweeps the actual current orientation: a tilted medal beneath a
  // cover cannot be treated as already flat while torque is still leveling it.
  const compressed:ClearPoint[]=[...prefix];let from=copy(prefix[prefix.length-1]??at),p=0
  while(p<points.length){let furthest=p;for(let k=p+1;k<points.length;k++){if(line(from,points[k])&&(compressed.length>0||line(at,points[k],coinShape,body.rotation())))furthest=k;else break}compressed.push(points[furthest]);from=points[furthest];p=furthest+1}
  return compressed
 }
 const restore=(target:Target,body:RAPIER.RigidBody)=>{body.setGravityScale(target.gravity,true);body.setLinearDamping(target.damping);body.setAngularDamping(target.angularDamping)}
 const drive=(body:RAPIER.RigidBody,to:ClearPoint|null,speed:number=BOARD_CLEAR.speed,acceleration:number=BOARD_CLEAR.acceleration)=>{
  const p=body.translation(),v=body.linvel(),d=to?{x:to.x-p.x,y:to.y-p.y,z:to.z-p.z}:{x:0,y:0,z:0}
  const wanted=limit({x:d.x*4,y:d.y*4,z:d.z*4},speed),dv=limit({x:wanted.x-v.x,y:wanted.y-v.y,z:wanted.z-v.z},acceleration/60),m=body.mass()
  body.applyImpulse({x:dv.x*m,y:dv.y*m,z:dv.z*m},true)
 }
 const level=(body:RAPIER.RigidBody,align=true)=>{
  const q=body.rotation(),w=body.angvel(),up={x:2*(q.x*q.y-q.w*q.z),y:1-2*(q.x*q.x+q.z*q.z),z:2*(q.y*q.z+q.w*q.x)},sign=up.y>=0?1:-1
  const inertia=body.principalInertia(),average=(inertia.x+inertia.y+inertia.z)/3
  const a=limit({x:(align?-up.z*sign*30:0)-w.x*7,y:-w.y*5,z:(align?up.x*sign*30:0)-w.z*7},40)
  body.applyTorqueImpulse({x:a.x*average/60,y:a.y*average/60,z:a.z*average/60},true)
 }
 const status=():BoardClearStatus=>{
  let collected=0,retired=0;const active:ClearActive[]=[]
  for(const t of targets.values()){
   if(t.state==='collected'||t.state==='retired')collected++
   if(t.state==='retired')retired++
   else if(t.state==='routing'||t.state==='dropping'){
    const p=options.piece(t.id);if(p)active.push({id:t.id,position:copy(p.body.translation()),target:copy(t.slip?.goal??t.route[0]??t.slot),stage:t.state==='dropping'?'dropping':p.body.translation().y<(t.route[0]?.y??0)-.2?'lifting':'carrying'})
   }
  }
  return {stage,total:targets.size,collected,retired,remaining:targets.size-collected,blocked,active,targetIds:[...targets.keys()]}
 }
 return {
  isTarget:(id:number)=>targets.has(id),
  begin(ids:readonly number[]){
   if(stage!=='idle'&&stage!=='complete')return false
   targets.clear();clock=0;lastFrame=-Infinity;blocked=0;lastCollected=0;lastProgress=0;lastReplan=0
   for(const id of ids){const p=options.piece(id);if(!p||p.counted||targets.has(id))continue
    const i=targets.size,body=p.body
    // Keep a medal in its nearest catcher lane instead of criss-crossing the
    // entire field according to insertion ID. Two real depth rows share load.
    const laneX=Math.max(-slotHalfWidth,Math.min(slotHalfWidth,Math.round((body.translation().x+slotHalfWidth)/slotPitch)*slotPitch-slotHalfWidth))
    targets.set(id,{id,slot:{x:laneX,y:.78,z:TRAY.center-.35+(Math.floor(i/slotColumns)%2)*.7},gravity:body.gravityScale(),damping:body.linearDamping(),angularDamping:body.angularDamping(),state:'waiting',route:[],age:0,lastDistance:Infinity,stalled:0,escape:false,strongPull:false,retryAt:0,slip:null,holdLevel:false})
    // A visibly energized magnetic field brakes the waiting stock. It does not
    // switch bodies to kinematic or disable contact, and cannot pass a wall.
    body.setGravityScale(0,true);body.setLinearDamping(.35);body.setAngularDamping(1.2)
   }
   stage=targets.size?'sweeping':'complete';if(targets.size)atlas();return true
  },
  update(frame?:number){
   if(stage==='idle'||stage==='complete')return status()
   if(frame!==undefined){if(!Number.isFinite(frame)||frame<=lastFrame)return status();lastFrame=frame}
   clock++;blocked=0
   let flying=0
   for(const t of targets.values()){
    const p=options.piece(t.id)
    if(!p){if(t.state!=='collected'&&t.state!=='retired')throw new Error('Board Clear target disappeared before actual tray collection');t.state='retired';continue}
    if(p.counted){if(t.state!=='collected')restore(t,p.body);t.state='collected';continue}
    if(t.state==='routing'||t.state==='dropping')flying++
   }
   const count=[...targets.values()].filter(t=>t.state==='collected'||t.state==='retired').length
   if(count!==lastCollected){lastCollected=count;lastProgress=clock}
   // Re-query the real cabinet after a contact jam. This can discover a newly
   // registered collider or a return grate that has emptied; only the route
   // changes. The blocked coin is never removed or moved to the new waypoint.
   if(clock-lastProgress>240&&clock-lastReplan>240){atlas();lastReplan=clock;for(const t of targets.values())if(t.state==='routing'){t.route=[];t.lastDistance=Infinity;t.stalled=0;t.retryAt=0}}
   // Peel higher layers first, with a frontward preference, rather than towing
   // a tower bottom through waiting medals. Falling stock is urgent so it cannot
   // leave the bounded navigation envelope while awaiting admission.
   const waiting=[...targets.values()].filter(t=>t.state==='waiting').sort((a,b)=>{const pa=options.piece(a.id)!.body.translation(),pb=options.piece(b.id)!.body.translation();return (pb.y<-.4?100:pb.z+pb.y*4)-(pa.y<-.4?100:pa.z+pa.y*4)})
   for(const t of waiting){if(flying>=BOARD_CLEAR.batch)break;t.state='routing';t.age=0;flying++}
   for(const t of targets.values()){
    if(t.state==='collected'||t.state==='retired')continue
    const p=options.piece(t.id)!,body=p.body,at=body.translation();t.age++
    if(t.state==='waiting'){drive(body,null,0);level(body);continue}
    if(t.state==='dropping'){
     // Release is gravity-driven, with the visible magnet only centering the
     // descent over the grate. No height predicate awards the coin.
     const v=body.linvel(),mass=body.mass(),wanted=limit({x:(t.slot.x-at.x)*3-v.x,y:0,z:(t.slot.z-at.z)*3-v.z},.18)
     body.applyImpulse({x:wanted.x*mass,y:0,z:wanted.z*mass},true);level(body)
     if((t.age>240||at.y<TRAY.lossY||at.z<TRAY.back+.35||at.z>TRAY.front-.3||Math.abs(at.x)>trayHalfWidth-BOARD_CLEAR.radius)&&(!p.counted)){body.setGravityScale(0,true);t.state='routing';t.route=[];t.age=0;t.lastDistance=Infinity}
     continue
    }
    if(t.slip){
     const clear=t.slip.balls.every(id=>(world.getCollider(id).contactShape(coinShape,at,body.rotation(),.003)?.distance??.003)>=.002)
     if(clear){t.slip=null;t.route=[];t.retryAt=0}
     else{
      if(!slipPath(body,t.slip.goal,t.slip.balls))t.slip=findSlip(body,t.slip.basis)
      level(body,false)
      if(t.slip)drive(body,t.slip.goal,.6,18);else{t.retryAt=clock+15;drive(body,null,0)}
      continue
     }
    }
    if(t.holdLevel&&free(at))t.holdLevel=false
    if(!t.route.length){
     // A closed geometric route cannot improve by repeating thousands of the
     // same shape sweeps every rendered step. Keep the same live coin braked
     // and leveled, retrying at a bounded physical cadence; never skip a sweep.
     if(clock<t.retryAt){blocked++;level(body,!t.holdLevel);drive(body,null,0);continue}
     t.route=route(body,t.slot,t.escape)
     if(t.route.length){t.escape=false;t.retryAt=0}else{
      t.slip=findSlip(body)
      if(t.slip){t.holdLevel=true;level(body,false);drive(body,t.slip.goal,.6,18)}else{t.retryAt=clock+15;blocked++;level(body,!t.holdLevel);drive(body,null,0)}
      continue
     }
    }
    level(body,!t.holdLevel)
    let goal=t.route[0],d=distance(at,goal)
    // The final waypoint is a descent area, not a zero-size docking socket.
    // A radius-wide arrival above the catcher lets adjacent real coins fall
    // instead of mutually hovering while seeking the exact same point. This
    // only restores gravity; collection still requires actual tray contact.
    // Round an intermediate turn only after fresh complete sweeps to the next
    // waypoint pass. A blocked corner retains the original tight arrival.
    const next=t.route[1]
    const turnClear=next&&line(at,next)&&line(at,next,coinShape,body.rotation())
    const arrival=t.route.length===1||turnClear?BOARD_CLEAR.radius+.13:.13
    // A completed escape ends slow recovery; it must not throttle the entire trip.
    if(d<arrival){t.route.shift();t.lastDistance=Infinity;t.stalled=0;t.strongPull=false;goal=t.route[0];if(!goal){t.state='dropping';t.age=0;restore(t,body);continue}d=distance(at,goal)}
    if(d<t.lastDistance-.008){t.stalled=0;t.lastDistance=d}else t.stalled++
    if(t.stalled>90){t.route=[];t.lastDistance=Infinity;t.stalled=0;t.escape=true;t.strongPull=true;blocked++;continue}
    // A naturally supported, then clamped ball can trap a medal through
    // static contact friction. A stronger slow powered pull breaks that real
    // contact after a measured stall; CCD/colliders and route sweeps stay on.
    drive(body,goal,t.strongPull?1.2:BOARD_CLEAR.speed,t.strongPull?120:BOARD_CLEAR.acceleration)
   }
   const all=[...targets.values()]
   stage=all.every(t=>t.state==='retired')?'complete':all.every(t=>t.state==='collected'||t.state==='retired')?'draining':'sweeping'
   return status()
  },
  status,
 }
}
