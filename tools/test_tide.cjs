// CPU-only real Rapier floor/gate tests. These are contact/route tests, not GPU pixels.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const R=require('@dimforge/rapier3d-compat')
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require,Math,Number,Array,Infinity,Map});return module.exports}
const {TIDE:T,createTideMachine,tideCoinSlot,tideRails,tideSweepBlocked,tideLoadBlocked,tideGateSweepBlocked,tideCargoAboveGate,tideLaneZ,tideGateDirection}=load('src/store/tide.ts'),{FIELD_MOTION:M,CABINET}=load('src/store/motion.ts')
let passed=0
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function rig({capacity=1000,productionClear=true,cleanup=true}={}){
 const world=new R.World(M.gravity);world.timestep=M.timestep;world.integrationParameters.numSolverIterations=M.solverIterations
 world.createCollider(R.ColliderDesc.cuboid(CABINET.halfWidth,.2,CABINET.depth/2).setTranslation(0,-.2,CABINET.front-CABINET.depth/2).setFriction(.58))
 const pieces=new Map(),created=[],releases=[],completed=[],stages=new Set();let frame=0,allow=true,room=capacity,maxSpeed=0,contacts=0,maxHeld=0
 const machine=createTideMachine(world,{room:()=>room,clear:lane=>allow&&(!productionClear||!tideSweepBlocked(world,lane,body=>{const p=pieces.get(body.handle);return !!p&&!p.held})),createCoin(position,request){
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setLinearDamping(.18).setAngularDamping(.8).setCcdEnabled(true))
  const collider=world.createCollider(R.ColliderDesc.cylinder(T.halfHeight,T.radius).setDensity(1.4).setFriction(.58).setRestitution(.02),body)
  const p={body,collider,request:{...request},held:true,release:null};pieces.set(body.handle,p);created.push(p);room--;return body
 },onRelease(body,request){const p=pieces.get(body.handle);assert.ok(p.held,'same physical body can only release once');p.held=false;p.release={...body.translation()};p.frame=frame;releases.push({body,handle:body.handle,request:{...request}})},onComplete(request){completed.push(request)}})
 const tick=()=>{
  frame++;const state=machine.update(frame);stages.add(state.stage);maxHeld=Math.max(maxHeld,state.held)
  assert.equal(state.planned,state.queued+state.held+state.released,'award equals queued + physical pending + delivered')
  assert.equal(state.held,[...pieces.values()].filter(p=>p.held).length)
  world.step()
  for(const [handle,p] of pieces){const pos=p.body.translation(),vel=p.body.linvel();assert.ok([pos.x,pos.y,pos.z,vel.x,vel.y,vel.z].every(Number.isFinite));if(pos.y>=0)maxSpeed=Math.max(maxSpeed,Math.hypot(vel.x,vel.y,vel.z))
   if(p.held&&state.stage==='ready'){world.contactPairsWith(p.collider,c=>{const contact=p.collider.contactCollider(c,.012);if(contact&&contact.distance<.012)contacts++})}
   // Standalone disposal ONLY after real board contact, to simulate field/tray
   // turnover in a bounded fixture. Production never uses this test cleanup.
   if(cleanup&&!p.held&&pos.y<.15&&frame-p.frame>45){world.removeRigidBody(p.body);pieces.delete(handle);room++}
  }
  return state
 }
 return {world,machine,tick,pieces,created,releases,completed,stages,setClear:v=>allow=v,setRoom:n=>room=n,stats:()=>({frame,maxSpeed,contacts,maxHeld})}
}
;(async()=>{await R.init()
 test('low reserve slots and rendered rails describe exact ordinary coin geometry',()=>{
  for(const lane of ['left','center','right']){
   const slots=Array.from({length:T.batchMax},(_,i)=>tideCoinSlot(i,lane))
   assert.ok(slots.every(p=>Math.abs(p.x-T.lanes[lane])+T.radius<T.halfWidth&&p.y+T.halfHeight<T.top+T.railHeight&&Math.abs(p.z-tideLaneZ(lane))+T.radius<T.halfDepth))
   for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)assert.ok(Math.hypot(slots[i].x-slots[j].x,slots[i].z-slots[j].z)>=T.radius*2||Math.abs(slots[i].y-slots[j].y)>=T.halfHeight*2)
  }
  assert.equal(tideRails().length,12);assert.equal(T.batchMax,12)
 })
 test('request waits indefinitely for explicit placement; selected lane stays latched',()=>{
  const m=rig(),id=m.machine.enqueue(25,{key:'won-1',practice:true})
  for(let i=0;i<2000;i++)m.tick()
  assert.equal(m.created.length,0);assert.equal(m.machine.status().stage,'choosing');assert.equal(m.machine.status().pending,25)
  assert.equal(m.machine.chooseLane(id+1,'left'),false);assert.equal(m.machine.chooseLane(id,'left'),true)
  assert.equal(m.machine.chooseLane(id,'right'),false);assert.equal(m.machine.chooseLane(id,'left'),true)
  for(let i=0;i<2200;i++)m.tick()
  assert.equal(m.machine.status().pending,0);assert.equal(m.machine.status().lastCompleted.lane,'left');assert.equal(m.machine.status().lastCompleted.practice,true)
  assert.equal(m.releases.length,25);assert.equal(new Set(m.releases.map(p=>p.handle)).size,25)
  assert.ok(m.releases.every(p=>Math.abs(p.request.total-25)<.001&&p.request.lane==='left'))
  m.world.free()
 })
 test('closed physical floor supports loaded dynamic medals; only actual gate opening releases the same bodies',()=>{
  const m=rig({cleanup:false}),id=m.machine.enqueue(12);m.machine.chooseLane(id,'center')
  while(m.machine.status().stage!=='ready')m.tick()
  m.setClear(false);for(let i=0;i<180;i++)m.tick()
  assert.equal(m.machine.status().held,12);assert.equal(m.releases.length,0);assert.ok(m.created.every(p=>p.body.isDynamic()))
  assert.ok(m.created.every(p=>p.body.translation().y>T.top-.02));assert.ok(m.stats().contacts>0,'coins physically touch gate or each other')
  const handles=m.created.map(p=>p.body.handle);m.setClear(true)
  for(let i=0;i<500;i++)m.tick()
  assert.equal(m.releases.length,12);assert.equal(m.machine.status().pending,0)
  assert.deepEqual([...m.releases.map(p=>p.handle)].sort(),[...handles].sort())
  assert.ok(m.created.every(p=>p.body.translation().y<.65&&Math.abs(p.body.translation().x)<1.5),'real gravity routes to central bed '+JSON.stringify(m.created.map(p=>p.body.translation())))
  assert.ok(m.stats().maxSpeed<9,`no explosive launch: ${m.stats().maxSpeed}`)
  for(const s of ['waiting','loading','ready','opening','draining','closing','idle'])assert.ok(m.stages.has(s),s)
  console.log(`  12 real medals: support contacts ${m.stats().contacts}, max speed ${m.stats().maxSpeed.toFixed(3)}`)
  m.world.free()
 })
 test('all three placement lanes land on their actual distinct board region',()=>{
  const means=[]
  for(const lane of ['left','center','right']){
   const m=rig({cleanup:false}),id=m.machine.enqueue(12);m.machine.chooseLane(id,lane)
   for(let i=0;i<700;i++)m.tick()
   assert.equal(m.releases.length,12);const points=m.created.map(p=>p.body.translation())
   for(const p of m.created)assert.ok(Math.abs(p.release.x-T.lanes[lane])<T.halfWidth+T.radius,'actual handoff occurs in the selected narrow lane')
   assert.ok(points.every(p=>Math.abs(p.x-T.lanes[lane])<1.4&&p.y<.7&&p.z>-7.6&&p.z<6),JSON.stringify(points))
   means.push(points.reduce((n,p)=>n+p.x,0)/points.length);m.world.free()
  }
  assert.ok(Math.abs((means[1]-means[0])-(T.lanes.center-T.lanes.left))<.3&&Math.abs((means[2]-means[1])-(T.lanes.right-T.lanes.center))<.3,'settled lanes retain their actual configured spacing')
 })
 test('finite capacity and collision backpressure retain full award and resume partial waves',()=>{
  const m=rig({capacity:0}),id=m.machine.enqueue(29);m.machine.chooseLane(id,'right')
  for(let i=0;i<100;i++)m.tick();assert.equal(m.created.length,0);assert.equal(m.machine.status().pending,29)
  m.setRoom(3);while(m.created.length<1)m.tick();m.setRoom(0)
  for(let i=0;i<500;i++)m.tick()
  assert.ok(m.releases.length>0,'an already admitted partial batch drains instead of deadlocking')
  m.setClear(false);m.setRoom(100);const before=m.created.length;for(let i=0;i<300;i++)m.tick();assert.equal(m.created.length,before)
  m.setClear(true);for(let i=0;i<2600;i++)m.tick()
  assert.equal(m.machine.status().pending,0);assert.equal(m.created.length,29);assert.equal(m.releases.length,29);assert.ok(m.stats().maxHeld<=12);m.world.free()
 })
 test('queued jackpots are FIFO with independent lane choices and duplicate transfer keys are idempotent',()=>{
  const m=rig(),one=m.machine.enqueue(13,{key:'one'}),two=m.machine.enqueue(27,{key:'two',practice:true})
  assert.equal(m.machine.enqueue(13,{key:'one'}),one);assert.equal(m.machine.status().planned,40);assert.equal(m.machine.status().requestCount,2)
  assert.equal(m.machine.chooseLane(two,'right'),false);m.machine.chooseLane(one,'left')
  while(m.completed.length<1)m.tick()
  assert.equal(m.machine.status().stage,'choosing');assert.equal(m.machine.status().requestId,two);assert.equal(m.releases.length,13)
  for(let i=0;i<200;i++)m.tick();assert.equal(m.releases.length,13)
  m.machine.chooseLane(two,'right');for(let i=0;i<2000;i++)m.tick()
  assert.equal(m.machine.status().pending,0);assert.equal(m.machine.status().released,40)
  assert.deepEqual(m.releases.map(p=>p.request.id),[...Array(13).fill(one),...Array(27).fill(two)])
  assert.equal(m.machine.enqueue(13,{key:'one'}),one);assert.equal(m.machine.status().planned,40)
  assert.equal(m.completed[1].total,27);assert.equal(m.completed[1].lane,'right');assert.equal(m.completed[1].practice,true);m.world.free()
 })
 test('same-frame calls and long clock gaps cannot duplicate or skip real loading',()=>{
  const m=rig(),id=m.machine.enqueue(100);m.machine.chooseLane(id,'center');m.tick()
  const before=JSON.stringify(m.machine.status());for(let i=0;i<100;i++)m.machine.update(1);assert.equal(JSON.stringify(m.machine.status()),before)
  m.machine.update(100000);assert.equal(m.created.length,0);assert.equal(m.machine.status().pending,100);assert.equal(m.machine.status().released,0);m.world.free()
 })
 test('real shape sweep includes an upright medal with a low center and rear gate travel',()=>{
  const m=rig(),body=m.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(T.lanes.center,1.15,T.centerZ+1.4)),collider=m.world.createCollider(R.ColliderDesc.cylinder(T.halfHeight,T.radius),body)
  body.setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2},true);m.world.step()
  assert.equal(tideSweepBlocked(m.world,'center',b=>b.handle===body.handle),true)
  assert.equal(tideSweepBlocked(m.world,'left',b=>b.handle===body.handle),false)
  assert.equal(tideSweepBlocked(m.world,'center',()=>false),false)
  m.world.free()
 })
 test('exact gate sweep distinguishes a harmless released pile from a genuine closing collision',()=>{
  const m=rig(),lane='center',body=m.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(T.lanes.center+.1,1.2728,T.centerZ+.03))
  m.world.createCollider(R.ColliderDesc.cylinder(T.halfHeight,T.radius),body);m.world.step()
  const include=b=>b.handle===body.handle,from={x:T.lanes.center,y:T.top-T.gateHalfHeight,z:T.centerZ+1.57},away={...from,z:T.centerZ+1.60}
  assert.equal(tideSweepBlocked(m.world,lane,include),true,'old entire reservoir envelope includes the released medal')
  assert.equal(tideGateSweepBlocked(m.world,lane,from,away,include),false,'door moving away has an actually empty swept shape')
  assert.equal(tideGateSweepBlocked(m.world,lane,{...from,z:T.centerZ+T.halfDepth+.36},{...from,z:T.centerZ+T.halfDepth+.32},include),true,'closing into real medal is never bypassed')
  assert.equal(tideLoadBlocked(m.world,lane,include),true,'pile reaching into closed floor must still delay the next batch')
  assert.equal(tideGateSweepBlocked(m.world,lane,{...from,z:NaN},away,include),true,'invalid sweep fails closed')
  m.world.free()
 })
 test('loading chamber excludes rear door storage but actual gate travel still tests that obstruction',()=>{
  const m=rig(),body=m.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(T.lanes.center,T.top,T.centerZ+T.halfDepth+T.opening-.1))
  m.world.createCollider(R.ColliderDesc.ball(.1),body);m.world.step();const include=b=>b.handle===body.handle
  assert.equal(tideLoadBlocked(m.world,'center',include),false,'rear obstruction cannot falsely block creating a front chamber medal')
  assert.equal(tideGateSweepBlocked(m.world,'center',{x:T.lanes.center,y:T.top-T.gateHalfHeight,z:T.centerZ+T.opening-.2},{x:T.lanes.center,y:T.top-T.gateHalfHeight,z:T.centerZ+T.opening-.1},include),true,'next real movement into rear obstruction is blocked')
  m.world.free()
 })
 test('only real cargo above the floor is exempt while clearing; rotated underside and balls remain blockers',()=>{
  const m=rig(),make=(y,ball=false)=>{const b=m.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(T.lanes.center,y,T.centerZ));m.world.createCollider(ball?R.ColliderDesc.ball(.44):R.ColliderDesc.cylinder(T.halfHeight,T.radius),b);return b}
  const flat=make(T.top+T.halfHeight-.001);assert.equal(tideCargoAboveGate(flat,'center'),true)
  const upright=make(T.top+.1);upright.setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2},true);m.world.propagateModifiedBodyPositionsToColliders();assert.equal(tideCargoAboveGate(upright,'center'),false,'center above floor does not make an intersecting rotated medal safe')
  const ball=make(T.top+.2,true);assert.equal(tideCargoAboveGate(ball,'center'),false);ball.setTranslation({x:T.lanes.center,y:T.top+.44,z:T.centerZ},true);m.world.propagateModifiedBodyPositionsToColliders();assert.equal(tideCargoAboveGate(ball,'center'),true)
  assert.equal(tideCargoAboveGate(flat,'left'),false);const high=make(T.top+4);assert.equal(tideCargoAboveGate(high,'center'),false,'high flight outside the actual chamber is not caught cargo');m.world.free()
 })
 for(const ingress of ['empty','partial','closing'])test(`foreign ${ingress} ingress clears with actual gravity, preserves its original body and pays only the fixed award`,()=>{
  const world=new R.World(M.gravity);world.timestep=M.timestep;world.integrationParameters.numSolverIterations=M.solverIterations
  world.createCollider(R.ColliderDesc.cuboid(CABINET.halfWidth,.2,CABINET.depth/2).setTranslation(0,-.2,CABINET.front-CABINET.depth/2).setFriction(.58))
  const own=new Map(),foreign=[],released=new Set(),completed=[];let owner=true,frame=0,sawClearing=false,partialSize=0,clearOpeningCalls=0
  const add=(at)=>{const b=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(at.x,at.y,at.z).setCcdEnabled(true).setLinearDamping(.18).setAngularDamping(.8));world.createCollider(R.ColliderDesc.cylinder(T.halfHeight,T.radius).setFriction(.58).setRestitution(.02),b);return b}
  const external=b=>!own.get(b.handle)?.held&&(own.has(b.handle)||foreign.includes(b))
  const machine=createTideMachine(world,{room:()=>100,clear:lane=>owner&&!tideLoadBlocked(world,lane,external),needsClearing:lane=>owner&&foreign.some(b=>tideCargoAboveGate(b,lane)),gateClear:(lane,from,to,clearing)=>{
   if(clearing){assert.ok((to.z-from.z)*tideGateDirection(lane)>0,'cargo exemption is only for a withdrawing/opening floor');clearOpeningCalls++}
   return owner&&!tideGateSweepBlocked(world,lane,from,to,b=>external(b)&&!(clearing&&tideCargoAboveGate(b,lane)))
  },createCoin(at,request){const b=add(at);own.set(b.handle,{body:b,held:true,request});return b},onRelease(b,request){assert.ok(own.has(b.handle),'foreign body cannot be credited as this Tide award');assert.ok(!released.has(b.handle));own.get(b.handle).held=false;released.add(b.handle)},onComplete:r=>completed.push(r)})
  const tick=()=>{const state=machine.update(++frame);world.step();sawClearing ||= state.clearing;if(state.clearing&&state.batchSize)partialSize=state.batchSize;assert.equal(state.planned,state.pending+state.released);return state}
  if(ingress==='empty'){
   foreign.push(add({x:T.lanes.left,y:1.8,z:T.z}));for(let i=0;i<100;i++)tick();assert.ok(foreign[0].translation().y>T.top)
  }
  const total=ingress==='partial'?17:7,id=machine.enqueue(total,{key:'foreign-'+ingress});machine.chooseLane(id,'left')
  if(ingress==='empty'){
   owner=false;for(let i=0;i<50;i++)tick();assert.equal(machine.status().stage,'waiting');assert.equal(machine.status().clearing,false,'other machine retains ownership');assert.equal(own.size,0);owner=true
  }else if(ingress==='partial'){
   while(own.size<2)tick();foreign.push(add({x:T.lanes.left,y:1.95,z:T.z+.68}));tick();assert.equal(machine.status().batchSize,2,'finish only the actual smaller own batch')
  }else{
   while(machine.status().stage!=='closing')tick();for(let i=0;i<12;i++)tick();foreign.push(add({x:T.lanes.left,y:1.8,z:T.z}));tick();assert.equal(machine.status().stage,'opening','reopening starts from actual existing door position')
  }
  const original=foreign[0].handle;let lastGate=machine.status().gates[0].position.z
  for(let i=0;i<2800&&machine.status().stage!=='idle';i++){tick();const current=machine.status().gates[0].position.z;assert.ok(Math.abs(current-lastGate)<.07,'no teleport when reopening a partly closed gate');lastGate=current}
  assert.equal(machine.status().stage,'idle',JSON.stringify(machine.status()));assert.ok(sawClearing);assert.ok(clearOpeningCalls>0);assert.equal(own.size,total);assert.equal(released.size,total);assert.equal(completed.length,1);assert.equal(completed[0].total,total);assert.equal(completed[0].released,total);assert.equal(machine.status().lane,null)
  assert.equal(foreign[0].handle,original);assert.ok(foreign[0].translation().y<T.top-.2,'same foreign body falls onto the ordinary deck');assert.equal(released.has(original),false);assert.equal(machine.status().planned,total)
  if(ingress==='partial')assert.ok(partialSize>0&&partialSize<12)
  world.free()
 })
 test('center cassette parks with an open floor beside the wall and traverses empty before real loading',()=>{
  const m=rig({cleanup:false}),initial=m.machine.status(),center=initial.gates[1]
  assert.ok(Math.abs(center.position.x-T.centerParkX)<1e-5);assert.ok(Math.abs(center.position.z-(T.centerZ+T.opening))<1e-5)
  assert.ok(initial.rails.filter(p=>p.lane==='center').every(p=>p.position.z-p.halfSize.z>.4),'forward parked cassette stays beyond the entire rear tower corridor')
  const id=m.machine.enqueue(12);m.machine.chooseLane(id,'center');let sawTravel=false,sawCenter=false,last=center.position.x
  for(let i=0;i<1800&&m.machine.status().stage!=='idle';i++){
   const state=m.tick(),gate=state.gates[1]
   assert.ok(Math.abs(gate.position.x-last)<.05,'continuous physical translation, never a positional jump');last=gate.position.x
   if(state.stage==='deploying'){sawTravel=true;assert.equal(state.held,0);assert.equal(m.created.length,0)}
   if(state.stage==='loading'||state.stage==='ready'){sawCenter=true;assert.ok(Math.abs(gate.position.x-T.lanes.center)<1e-5)}
   if(state.stage==='parking')assert.equal(state.held,0)
   const rails=state.rails.filter(p=>p.lane==='center');assert.ok(rails.every(p=>Math.abs(p.position.x-gate.position.x)<=T.halfWidth+T.railHalfThickness+1e-5))
  }
  assert.ok(sawTravel&&sawCenter);assert.equal(m.machine.status().stage,'idle');assert.equal(m.releases.length,12);assert.equal(m.created.length,12)
  assert.ok(Math.abs(m.machine.status().gates[1].position.x-T.centerParkX)<1e-5);m.world.free()
 })
 test('empty center traversal pauses for a real bodyless cabinet obstruction and resumes without losing supply',()=>{
  const m=rig(),obstacle=m.world.createCollider(R.ColliderDesc.cuboid(.035,.15,.3).setTranslation(2.1,T.top+.3,T.centerZ));m.world.step()
  const id=m.machine.enqueue(12);m.machine.chooseLane(id,'center');for(let i=0;i<400;i++)m.tick()
  const paused=m.machine.status();assert.equal(paused.stage,'deploying');assert.equal(paused.blocked,true);assert.equal(paused.held,0);assert.equal(paused.queued,12);assert.equal(m.created.length,0)
  const x=paused.gates[1].position.x;for(let i=0;i<60;i++)m.tick();assert.ok(Math.abs(m.machine.status().gates[1].position.x-x)<1e-6)
  m.world.removeCollider(obstacle,true);for(let i=0;i<1800&&m.machine.status().stage!=='idle';i++)m.tick()
  assert.equal(m.machine.status().stage,'idle');assert.equal(m.releases.length,12);assert.equal(new Set(m.releases.map(p=>p.handle)).size,12);m.world.free()
 })
 test('foreign cargo on the parked open floor is never carried sideways or counted as the selected award',()=>{
  const m=rig(),body=m.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(T.centerParkX,T.top+.15,T.centerZ+T.opening).setCcdEnabled(true))
  m.world.createCollider(R.ColliderDesc.cylinder(T.halfHeight,T.radius).setFriction(.16).setRestitution(.02),body)
  for(let i=0;i<100;i++)m.tick();const initial={...body.translation()},id=m.machine.enqueue(1);assert.ok(initial.y>T.top);m.machine.chooseLane(id,'center')
  for(let i=0;i<400;i++)m.tick();const paused=m.machine.status();assert.equal(paused.stage,'deploying');assert.equal(paused.blocked,true);assert.equal(paused.queued,1);assert.equal(paused.held,0);assert.equal(paused.released,0);assert.equal(m.created.length,0)
  assert.ok(Math.abs(body.translation().x-initial.x)<.001,'foreign cargo was not carried sideways by a moving floor')
  // The fixture removes only its own obstruction, not an award or board body.
  m.world.removeRigidBody(body);for(let i=0;i<1800&&m.machine.status().stage!=='idle';i++)m.tick();assert.equal(m.machine.status().released,1);assert.equal(m.machine.status().stage,'idle');m.world.free()
 })
 test('a bodyless fixed obstruction in the actual door path blocks opening rather than clipping through the cabinet',()=>{
  const m=rig(),id=m.machine.enqueue(1);m.machine.chooseLane(id,'left');while(m.machine.status().stage!=='ready')m.tick()
  const obstacle=m.world.createCollider(R.ColliderDesc.cuboid(.2,.03,.015).setTranslation(T.lanes.left,T.top-T.gateHalfHeight,T.z+T.halfDepth+.035));m.world.step()
  for(let i=0;i<180;i++)m.tick();const paused=m.machine.status();assert.equal(paused.blocked,true);assert.ok(paused.stage==='ready'||paused.stage==='opening');assert.equal(paused.pending+paused.released,1)
  const gate=paused.gates[0].position.z;for(let i=0;i<50;i++)m.tick();assert.equal(m.machine.status().gates[0].position.z,gate)
  m.world.removeCollider(obstacle,true);for(let i=0;i<1000&&m.machine.status().stage!=='idle';i++)m.tick();assert.equal(m.machine.status().stage,'idle');assert.equal(m.releases.length,1);m.world.free()
 })
 test('large remainder award is conserved through bounded waves, not truncated at display or body limit',()=>{
  const m=rig({capacity:24}),id=m.machine.enqueue(101,{key:'large'});m.machine.chooseLane(id,'center')
  for(let i=0;i<5500;i++)m.tick()
  assert.equal(m.created.length,101);assert.equal(m.releases.length,101);assert.equal(m.machine.status().pending,0)
  assert.ok(m.stats().maxHeld<=12);assert.equal(m.completed[0].total,101);assert.equal(m.completed[0].released,101);m.world.free()
 })
 console.log(`${passed}/${passed} Sanctuary Tide physical checks passed.`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
