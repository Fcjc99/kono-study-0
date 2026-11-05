// Actual Rapier support sweeps, not hidden-mesh or interpolated-render checks.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),R=require('@dimforge/rapier3d-compat')
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require,Math,Number,Array,Infinity,Set});return module.exports}
const {TOWER:T,createTowerMachine,towerSupportSweepBlocked,towerCargoAboveSupport}=load('src/store/tower.ts'),{CABINET,FIELD_MOTION:M,PIN_POSITIONS,PUSHER_SHELF:S,shelfCenter}=load('src/store/motion.ts'),{COIN_MOTION:C,BALL_MOTION:B}=load('src/store/dispense.ts')
let passed=0
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function fixture(){
 const world=new R.World(M.gravity);world.timestep=M.timestep;world.integrationParameters.numSolverIterations=M.solverIterations
 world.createCollider(R.ColliderDesc.cuboid(S.width/2+.2,.2,6.8).setTranslation(0,-.2,-.8).setFriction(.58))
 const shelf=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,S.height/2,shelfCenter(14)))
 world.createCollider(R.ColliderDesc.cuboid(S.width/2,S.height/2,S.depth/2).setFriction(.45),shelf)
 const pieces=[],released=[],stages=new Set();let frame=0
 const machine=createTowerMachine(world,{room:()=>900-pieces.length,createCoin(at,request){
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(at.x,at.y,at.z).setLinearDamping(.18).setAngularDamping(.8).setCcdEnabled(true))
  world.createCollider(R.ColliderDesc.cylinder(T.halfHeight,T.radius).setDensity(1.4).setFriction(C.friction).setRestitution(C.restitution),body)
  pieces.push({body,id:request.id});return body
 },onRelease(body,request){released.push({handle:body.handle,id:request.id})}})
 const supports=[];world.forEachRigidBody(b=>{if(b!==shelf&&b.isKinematic())supports.push(b)})
 const tick=()=>{const s=machine.update(++frame);stages.add(s.stage);shelf.setNextKinematicTranslation({x:0,y:S.height/2,z:shelfCenter(14+16*(.5-.5*Math.cos(frame/70)))});world.step();return machine.status()}
 const block=(y=4.2,x=T.x+T.ringRadius,z=T.z,hy=.12)=>{const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x,y,z));const collider=world.createCollider(R.ColliderDesc.cuboid(.2,hy,.2),body);return {body,collider}}
 return {world,machine,pieces,released,stages,supports,tick,block}
}
;(async()=>{await R.init()
 test('idle cradle keeps its two real colliders at the right stage, with no disabled or hidden support',()=>{
  const m=fixture();for(let i=0;i<100;i++)m.tick()
  assert.equal(m.machine.status().stage,'idle');assert.equal(m.supports.length,2)
  for(const [i,b]of m.supports.entries()){
   assert.ok(b.isEnabled());assert.equal(b.numColliders(),1);assert.ok(Math.abs(b.translation().y-(T.parkTop-T.leafHalfHeight))<1e-5)
   assert.ok(Math.abs(b.translation().x-T.x)<=T.leafHalfWidth+.001,'idle support belongs to the right stage');assert.ok(T.z>-4,'idle support stays forward of the pegboard')
   const s=m.machine.status().supports[i];assert.ok(m.machine.status().supports.some(p=>Math.abs(p.x-b.translation().x)<1e-6&&Math.abs(p.y-b.translation().y)<1e-6),'render status contains actual body pose')
  }
  m.world.free()
 })
 test('complete deployment/parking corridor clears actual pegboard pins, backplate and outboard ball route',()=>{
  const m=fixture(),rotation={x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2}
  for(const [x,y]of PIN_POSITIONS)m.world.createCollider(R.ColliderDesc.cylinder(.21,.06).setTranslation(x,y,-6.15).setRotation(rotation))
  m.world.createCollider(R.ColliderDesc.cuboid(CABINET.boardWidth/2,2.025,.06).setTranslation(0,3.075,-6.35))
  for(const x of [-6.12+CABINET.sideShift,6.12-CABINET.sideShift]){const body=m.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x,3.3,-5.25));m.world.createCollider(R.ColliderDesc.ball(.44),body)}
  m.world.step()
  const own=new Set(m.supports.map(b=>b.handle))
  for(const side of [-1,1])assert.equal(towerSupportSweepBlocked(m.world,{x:T.x,y:T.resetTop-.04,z:T.z+side*T.leafHalfDepth},{x:T.x,y:T.parkTop-.04,z:T.z+side*T.leafHalfDepth},b=>own.has(b.handle)),false)
  m.world.free()
 })
 test('a real obstruction stops side construction before contact and retains the exact pending request',()=>{
  const m=fixture(),obstacle=m.block(T.buildTop+.35),id=m.machine.enqueue(20,'bank')
  let stopped=null,maxPenetration=0
  for(let i=0;i<140;i++){
   const s=m.tick();if(s.blocked)stopped=s.supports.map(p=>p.y)
   for(const b of m.supports){const c=b.collider(0).contactCollider(obstacle.collider,.001);if(c)maxPenetration=Math.max(maxPenetration,-c.distance)}
  }
  const s=m.machine.status();assert.equal(s.stage,'building');assert.equal(s.blocked,true);assert.equal(s.pending,20);assert.equal(s.held,0);assert.equal(m.pieces.length,0)
  assert.ok(stopped);assert.ok(maxPenetration<.001,`swept support penetration ${maxPenetration}`)
  const snapshot=JSON.stringify(s);m.machine.update(140);assert.equal(JSON.stringify(m.machine.status()),snapshot,'same frame cannot advance a paused stage')
  m.world.removeRigidBody(obstacle.body)
  for(let i=0;i<2400;i++)m.tick()
  assert.equal(m.machine.status().released,20);assert.equal(m.machine.status().pending,0);assert.equal(m.machine.status().stage,'idle')
  assert.equal(new Set(m.released.map(p=>p.handle)).size,20);assert.ok(m.released.every(p=>p.id===id));assert.equal(m.pieces.length,20)
  for(const stage of ['deploying','building','lowering','ready','releasing','returning','parking','idle'])assert.ok(m.stages.has(stage),stage)
  m.world.free()
 })
 test('blocked open home-lift leaves the mechanism honest and waits safely before a later queued tower',()=>{
  const m=fixture();m.machine.enqueue(1);let guard=0
  while(m.machine.status().stage!=='homing'&&guard++<1000)m.tick()
  assert.ok(guard<1000);const obstacle=m.block((T.releaseTop+T.parkTop)/2,T.x,T.z-T.leafHalfDepth-T.opening,.025);m.machine.enqueue(3,'bank')
  for(let i=0;i<100;i++)m.tick()
  const s=m.machine.status();assert.equal(s.stage,'homing');assert.equal(s.blocked,true);assert.equal(s.queued,3);assert.equal(s.released,1);assert.equal(m.pieces.length,1)
  const before=s.supports.map(p=>p.y);for(let i=0;i<20;i++)m.tick();assert.deepEqual(m.machine.status().supports.map(p=>p.y),before)
  m.world.removeRigidBody(obstacle.body);for(let i=0;i<2400;i++)m.tick()
  assert.equal(m.machine.status().stage,'idle');assert.equal(m.machine.status().released,4);assert.equal(m.pieces.length,4);assert.equal(m.machine.status().pending,0)
  m.world.free()
 })
 test('opening and empty return stop at real fixtures instead of sweeping colliders through them',()=>{
  for(const phase of ['releasing','returning']){
   const m=fixture();m.machine.enqueue(6,'bank');let guard=0
   while(m.machine.status().stage!==(phase==='releasing'?'ready':'returning')&&guard++<1000)m.tick()
   assert.ok(guard<1000)
   const x=phase==='releasing'?T.dockX:T.dockX+T.leafHalfWidth+.2
   const y=T.releaseTop-T.leafHalfHeight,z=phase==='releasing'?T.z+T.leafHalfDepth*2+.2:T.z-T.leafHalfDepth-T.opening
   const obstruction=m.world.createCollider(R.ColliderDesc.cuboid(.1,.02,.1).setTranslation(x,y,z))
   m.world.step();let maxPenetration=0
   for(let i=0;i<200;i++){
    m.tick();for(const support of m.supports){const hit=support.collider(0).contactCollider(obstruction,.001);if(hit)maxPenetration=Math.max(maxPenetration,-hit.distance)}
   }
   const blocked=m.machine.status();assert.equal(blocked.stage,phase);assert.equal(blocked.blocked,true);assert.equal(blocked.released,6)
   assert.equal(blocked.pending,0);assert.ok(maxPenetration<.001,`${phase} fixture penetration ${maxPenetration}`)
   m.machine.enqueue(3);for(let i=0;i<30;i++)m.tick();assert.equal(m.pieces.length,6,'next request cannot bypass an obstructed reset')
   m.world.removeCollider(obstruction,true);for(let i=0;i<2600;i++)m.tick()
   assert.equal(m.machine.status().stage,'idle');assert.equal(m.machine.status().released,9);assert.equal(m.machine.status().pending,0)
   m.world.free()
  }
 })
 test('outward withdrawal releases the same flat, rotated or ball cargo without awarding it again',()=>{
  for(const {angle,ball} of [{angle:0,ball:false},{angle:.32,ball:false},{angle:0,ball:true}]){
   const m=fixture();m.machine.enqueue(1,'bank');let guard=0
   while(m.machine.status().stage!=='releasing'&&guard++<1000)m.tick();assert.ok(guard<1000)
   const q={x:Math.sin(angle/2),y:0,z:0,w:Math.cos(angle/2)},extent=ball?.44:T.halfHeight*Math.cos(angle)+T.radius*Math.sin(angle),motion=ball?B:C
   const body=m.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(T.dockX,T.releaseTop+extent+.001,T.z+T.leafHalfDepth).setRotation(q).setLinearDamping(motion.linearDamping).setAngularDamping(motion.angularDamping).setCcdEnabled(true))
   m.world.createCollider((ball?R.ColliderDesc.ball(.44):R.ColliderDesc.cylinder(T.halfHeight,T.radius)).setDensity(ball?.6:1.4).setFriction(motion.friction).setRestitution(motion.restitution),body)
   const handle=body.handle,right=m.supports.find(b=>b.translation().z>T.z)
   assert.equal(towerCargoAboveSupport(body,right.translation()),true,'exact tilted bottom, not merely center, is supported above the floor')
   let fell=false,maxSpeed=0
   for(let i=0;i<1000;i++){m.tick();assert.equal(body.handle,handle);assert.ok(body.isDynamic());const at=body.translation(),v=body.linvel();fell||=at.y<T.releaseTop+(ball?.44:T.halfHeight)-.06;if(at.y>=-2.3)maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z))}
   assert.equal(m.machine.status().stage,'idle');assert.equal(m.machine.status().released,1);assert.equal(m.machine.status().planned,1)
   assert.equal(m.released.length,1);assert.ok(m.released.every(p=>p.handle!==handle),'foreign input is not delivered as a second tower award');assert.ok(fell,'the same foreign cargo falls naturally after its support withdraws');assert.ok(maxSpeed<12)
   m.world.free()
  }
 })
 test('foreign-cargo exception rejects tilted undersides, side balls, fixed bodies and unknown shapes',()=>{
  const m=fixture(),support={x:T.leafHalfWidth,y:T.releaseTop-T.leafHalfHeight,z:T.z}
  const make=(shape,at,rotation={x:0,y:0,z:0,w:1},fixed=false)=>{const body=m.world.createRigidBody((fixed?R.RigidBodyDesc.fixed():R.RigidBodyDesc.dynamic()).setTranslation(at.x,at.y,at.z).setRotation(rotation));m.world.createCollider(shape,body);return body}
  const upright=make(R.ColliderDesc.cylinder(T.halfHeight,T.radius),{x:T.leafHalfWidth+.25,y:T.releaseTop+.12,z:T.z},{x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2})
  assert.equal(towerCargoAboveSupport(upright,support),false,'a high center does not hide the rotated edge below the floor')
  const side=make(R.ColliderDesc.ball(.44),{x:T.leafHalfWidth*2+.25,y:T.releaseTop,z:T.z}),under=make(R.ColliderDesc.ball(.44),{x:T.leafHalfWidth+.25,y:T.releaseTop-.25,z:T.z})
  assert.equal(towerCargoAboveSupport(side,support),false);assert.equal(towerCargoAboveSupport(under,support),false)
  const unknown=make(R.ColliderDesc.cuboid(.2,.1,.2),{x:T.leafHalfWidth+.25,y:T.releaseTop+.1,z:T.z}),fixed=make(R.ColliderDesc.ball(.44),{x:T.leafHalfWidth+.25,y:T.releaseTop+.44,z:T.z},undefined,true)
  assert.equal(towerCargoAboveSupport(unknown,support),false);assert.equal(towerCargoAboveSupport(fixed,support),false)
  m.world.step();const from=support,to={...support,x:support.x+.1},own=new Set(m.supports.map(b=>b.handle))
  assert.equal(towerSupportSweepBlocked(m.world,from,to,b=>own.has(b.handle)||towerCargoAboveSupport(b,from)),true,'actual next outward sweep still stops at unsafe shapes')
  for(const [name,target] of [['side ball',side],['underside ball',under]])assert.equal(towerSupportSweepBlocked(m.world,from,to,b=>own.has(b.handle)||b.handle!==target.handle||towerCargoAboveSupport(b,from)),true,`${name} individually blocks the actual next outward sweep`)
  m.world.free()
 })
 test('sweep uses full ball/coin shape, while sensor markers cannot deadlock the mechanism',()=>{
  const m=fixture(),own=new Set(m.supports.map(b=>b.handle)),from={x:T.leafHalfWidth,y:3.16,z:T.z},to={x:T.leafHalfWidth,y:3.3,z:T.z}
  const body=m.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(T.leafHalfWidth*2+.35,3.23,T.z));const collider=m.world.createCollider(R.ColliderDesc.ball(.44),body);m.world.step()
  assert.equal(towerSupportSweepBlocked(m.world,from,to,b=>own.has(b.handle)),true,'ball center is outside the leaf footprint but its shape crosses it')
  collider.setSensor(true);m.world.step();assert.equal(towerSupportSweepBlocked(m.world,from,to,b=>own.has(b.handle)),false)
  m.world.free()
 })
 console.log(`${passed}/${passed} real cradle parking checks passed.`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
