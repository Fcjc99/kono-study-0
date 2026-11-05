// Real Rapier construction/support/contact tests. No GPU or synthetic trajectory.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const {performance}=require('node:perf_hooks'),R=require('@dimforge/rapier3d-compat')
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require,Math,Number,Array,Infinity});return module.exports}
const {TOWER:T,TOWER_SWEEP,createTowerMachine,towerCoinSlot,towerSweepBlocked}=load('src/store/tower.ts'),{CABINET,FIELD_MOTION:M,PUSHER_SHELF:S,shelfFront,shelfCenter,fieldStock}=load('src/store/motion.ts'),{TRAY,COIN_MOTION:C,capturePiece}=load('src/store/dispense.ts')
let passed=0
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function machine({capacity=900,clear=true,seed=false}={}){
 const w=new R.World(M.gravity);w.timestep=M.timestep;w.integrationParameters.numSolverIterations=M.solverIterations
 w.createCollider(R.ColliderDesc.cuboid(S.width/2+.2,.2,CABINET.depth/2).setTranslation(0,-.2,CABINET.front-CABINET.depth/2).setFriction(M.deckFriction))
 const shelf=w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,S.height/2,shelfCenter(14)))
 const face=w.createCollider(R.ColliderDesc.cuboid(S.width/2,S.height/2,S.depth/2).setFriction(M.shelfFriction),shelf)
 const tray=w.createCollider(R.ColliderDesc.cuboid(S.width/2+.2,.15,1.3).setTranslation(0,-2.15,TRAY.center).setFriction(.9))
 const pieces=[],releases=[],created=[],stages=new Set(),all=new Map();let room=capacity,sweep=clear
 function coin(p,request=null){
  const body=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setLinearDamping(C.linearDamping).setAngularDamping(C.angularDamping).setCcdEnabled(true))
  const collider=w.createCollider(R.ColliderDesc.cylinder(T.halfHeight,T.radius).setDensity(1.4).setFriction(C.friction).setRestitution(C.restitution),body)
  const piece={body,collider,request:request?{...request}:null,held:!!request,caught:false,start:{...p},releasedAt:-1};all.set(body.handle,piece)
  if(request){pieces.push(piece);created.push(body.handle);room--}return body
 }
 const tower=createTowerMachine(w,{createCoin:coin,room:()=>room,clear:()=>sweep,onRelease(body,request){const p=all.get(body.handle);assert.ok(p.held);assert.equal(p.request.id,request.id);p.held=false;p.releasedAt=frame;p.release={...body.translation()};releases.push({body,source:request.source,id:request.id})}})
 let frame=0,maxSpeed=0,maxAdvance=0,toppled=false,contactAtRelease=0,caught=0,earlyUpright=1,maxSpeedAt=null
 function tick(){
  frame++;const s=tower.update(frame);stages.add(s.stage)
  assert.equal(s.planned,s.queued+s.held+s.released,'every planned medal is queued, held or physically released')
  assert.equal(s.held,pieces.filter(p=>p.held).length)
  const front=shelfFront(14+16*(.5-.5*Math.cos(frame/70)));shelf.setNextKinematicTranslation({x:0,y:.3,z:front-S.depth/2});w.step()
  for(const p of pieces){
   const at=p.body.translation(),v=p.body.linvel(),q=p.body.rotation()
   assert.ok([at.x,at.y,at.z,v.x,v.y,v.z].every(Number.isFinite))
   if(p.held)continue
   // Production retires lost bodies; this fixture retains identities. Measure
   // live playfield speeds, not their later unbounded free fall below the tray.
   if(!p.caught&&at.y>=0&&Math.hypot(v.x,v.y,v.z)>maxSpeed){maxSpeed=Math.hypot(v.x,v.y,v.z);maxSpeedAt={at:{...at},v:{...v},frame}}maxAdvance=Math.max(maxAdvance,at.z-p.release.z)
   const upY=1-2*(q.x*q.x+q.z*q.z);toppled ||= upY<.65;if(frame-p.releasedAt<6)earlyUpright=Math.min(earlyUpright,upY)
   if(frame===p.releasedAt){
    // At handoff the lowest real coins contact the real support (not a cloud).
    let supporting=false;w.contactPairsWith(p.collider,c=>{const cp=p.collider.contactCollider(c,.015);if(cp&&cp.distance<=.015)supporting=true});if(supporting)contactAtRelease++
   }
   if(!p.caught){const contact=tray.contactCollider(p.collider,.012),kind=capturePiece(at,false,!!contact&&contact.distance<=.012&&contact.normal1.y>.4);if(kind){p.caught=true;if(kind==='medal')caught++}}
  }
  return s
 }
 if(seed){let value=17;const random=()=>((value=value*16807%2147483647)/2147483647);for(const p of fieldStock(T.radius,shelfFront(30),CABINET.front,random,false))coin(p)}
 return {w,tower,pieces,releases,created,stages,coin,tick,setRoom:n=>{room=n},setClear:b=>{sweep=b},stats:()=>({frame,maxSpeed,maxAdvance,toppled,contactAtRelease,caught,earlyUpright,maxSpeedAt}),all,face,tray}
}
;(async()=>{await R.init()
 test('tower batch geometry uses each exact medal once without overlapping or multiplying rings',()=>{
  for(const count of [1,2,5,6,7,20,30,40,47,48,71,72]){
   const slots=Array.from({length:count},(_,i)=>towerCoinSlot(i,count));assert.equal(new Set(slots.map(s=>`${s.x}/${s.y}/${s.z}`)).size,count)
   for(let a=0;a<slots.length;a++)for(let b=a+1;b<slots.length;b++){
    const x=Math.hypot(slots[a].x-slots[b].x,slots[a].z-slots[b].z),y=Math.abs(slots[a].y-slots[b].y)
    assert.ok(x>=T.radius*2-.001||y>=T.halfHeight*2-.001)
   }
   assert.ok(slots.every(s=>Math.abs(s.x-T.x)+T.radius<T.leafHalfWidth&&Math.abs(s.z-T.z)+T.radius<T.leafHalfDepth*2&&s.y<T.rows*T.pitch))
  }
 })
 test('eight-medal hollow rings keep exact standard coins and a genuine open center',()=>{
  const slots=Array.from({length:T.batchMax},(_,i)=>towerCoinSlot(i,T.batchMax)),layers=new Map()
  for(const slot of slots){const key=slot.y.toFixed(5);if(!layers.has(key))layers.set(key,[]);layers.get(key).push(slot)}
  assert.equal(layers.size,30);for(const layer of layers.values())assert.equal(layer.length,8)
  assert.equal(T.radius,.31);assert.equal(T.halfHeight,.055)
  for(const slot of slots)assert.ok(Math.abs(Math.hypot(slot.x-T.x,slot.z-T.z)-.82)<1e-10)
  assert.ok((T.ringRadius-T.radius)/(T.ringRadius+T.radius)>.45,'visible center hole matches the reference')
  for(let i=0;i<T.medalsPerLayer;i++){
   const shift=Math.hypot(slots[i].x-slots[i+T.medalsPerLayer].x,slots[i].z-slots[i+T.medalsPerLayer].z)
   assert.ok(shift>.30&&shift<T.radius*2,'staggered upper medal bridges real contact below')
  }
  for(const count of [1,2,5,7,20,30,47])for(let i=0;i<count;i++)assert.deepEqual(towerCoinSlot(i,count),slots[i])
  assert.ok(TOWER_SWEEP.top<5.8,'entire construction head stays inside existing scene envelope')
 })
 test('20, 30 and 72-medal towers build upright, slide sideways and release the same bodies to gravity',()=>{
  for(const count of [20,30,72]){
   const m=machine();m.tower.enqueue(count,'bank')
   let incomingTravel=false,lastCreated=0
   for(let i=0;i<2300;i++){
    const before=m.tower.status();m.tick();const after=m.tower.status()
    assert.ok(m.created.length-lastCreated<=1,'never a spawn burst');lastCreated=m.created.length
    if(before.head&&after.head){const p=m.pieces.at(-1);if(p.held&&p.body.translation().y<p.start.y-.1)incomingTravel=true}
   }
   const s=m.tower.status(),stats=m.stats()
   assert.equal(s.planned,count);assert.equal(s.pending,0);assert.equal(s.released,count);assert.equal(m.created.length,count)
   assert.equal(new Set(m.releases.map(p=>p.body.handle)).size,count,'each exact body hands off once')
   for(const name of ['building','lowering','ready','releasing','returning','idle'])assert.ok(m.stages.has(name),name+' '+JSON.stringify(s)+' '+JSON.stringify(stats))
   assert.ok(incomingTravel,'medals travel down from build head rather than appearing in-place')
   assert.equal(stats.contactAtRelease,count,'every medal has a real support or neighboring layer contact at handoff');assert.ok(stats.earlyUpright>.97,`unstable initial bundle ${stats.earlyUpright}`)
   assert.ok(m.pieces.every(p=>Math.abs(p.release.x-(p.start.x-T.x+T.dockX))<.03),'original bodies actually slide from side to dock before release')
   assert.ok(m.pieces.every(p=>p.body.isDynamic()),'released stacks remain ordinary dynamics, not held upright by animation');assert.ok(m.pieces.some(p=>p.body.translation().y<p.release.y-.1),'gravity moves actual cargo down after support withdrawal')
   assert.ok(stats.maxSpeed<12,`explosive speed ${stats.maxSpeed} ${JSON.stringify(stats.maxSpeedAt)}`)
   console.log(`  ${count}: ${stats.maxAdvance.toFixed(3)} forward, support contacts ${stats.contactAtRelease}, collected ${stats.caught}, initial up ${stats.earlyUpright.toFixed(4)}, max speed ${stats.maxSpeed.toFixed(3)}`)
   m.w.free()
  }
 })
 test('body-capacity and swept-volume backpressure retain exact pending material, including partial builds',()=>{
  const m=machine({capacity:0});m.tower.enqueue(65,'bank')
  for(let i=0;i<40;i++)m.tick();assert.equal(m.tower.status().queued,65);assert.equal(m.created.length,0);assert.equal(m.tower.status().waitReason,'capacity')
  m.setClear(false);m.tick();assert.equal(m.tower.status().waitReason,'shared-route');m.setClear(true)
  m.setRoom(3);for(let i=0;i<380;i++)m.tick()
  assert.equal(m.tower.status().held,0);assert.equal(m.tower.status().queued,62);assert.equal(m.tower.status().released,3,'small admitted batch must release rather than deadlock at capacity')
  const ids=m.created.slice();let emptyGuard=0;while(m.tower.status().stage!=='idle'&&emptyGuard++<2400)m.tick();assert.ok(emptyGuard<2400);const foreignInput=m.coin({x:T.x,y:T.parkTop+T.halfHeight+.001,z:T.z});m.setRoom(100);let admitted=0,purges=0;while(!['deploying','building'].includes(m.tower.status().stage)&&admitted++<4500){const state=m.tick();if(state.clearing){purges++;assert.equal(state.released,3);assert.equal(state.pending,62);assert.equal(state.held,0);for(const id of [...ids,foreignInput.handle])assert.ok(m.all.get(id).body.isDynamic(),'purged foreign medals keep their original physical bodies')}}assert.ok(admitted<4500);assert.ok(purges>0,'a genuine empty-floor purge clears foreign released medals before new award admission');m.setClear(false);for(let i=0;i<750;i++)m.tick()
  assert.equal(m.tower.status().held,62);assert.equal(m.tower.status().queued,0);assert.equal(m.tower.status().released,3);assert.equal(m.tower.status().waitReason,'shared-route')
  m.setClear(true);for(let i=0;i<2200;i++)m.tick()
  assert.equal(m.tower.status().released,65);assert.equal(m.tower.status().pending,0);assert.deepEqual(m.created.slice(0,3),ids)
  assert.equal(m.created.length,65);assert.equal(new Set(m.created).size,65)
  m.w.free()
 })
 test('shared lift sweep detects real upright coins and balls, but ignores flat seed layers and held pieces',()=>{
  const m=machine();const flat=m.coin({x:T.x,y:.065,z:T.z});m.w.step()
  const include=body=>!!m.all.get(body.handle);assert.equal(towerSweepBlocked(m.w,include),false)
  const upright=m.coin({x:T.x,y:TOWER_SWEEP.bottom-T.radius+.05,z:T.z});upright.setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2},true);m.w.step()
  assert.equal(towerSweepBlocked(m.w,include),true,'upright center below .63 still blocks lift')
  m.w.removeRigidBody(upright);m.all.delete(upright.handle);
  const ball=m.w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(T.x+.8,TOWER_SWEEP.bottom-.44+.05,T.z));m.w.createCollider(R.ColliderDesc.ball(.44),ball);m.w.step()
  assert.equal(towerSweepBlocked(m.w,b=>b.handle===ball.handle),true,'low ball center blocks lift')
  assert.equal(towerSweepBlocked(m.w,()=>false),false,'caller excludes held or settled pieces')
  m.w.free()
 })
 test('one ordinary medal on the outside porch fits beneath the real cradle without an underside exception',()=>{
  const w=new R.World(M.gravity);w.timestep=M.timestep;w.integrationParameters.numSolverIterations=M.solverIterations
  w.createCollider(R.ColliderDesc.cuboid(1.35,.1,1.45).setTranslation(T.x-.1,1.0,T.z).setFriction(M.shelfFriction))
  const body=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(T.x,1.1+T.halfHeight+.001,T.z))
  w.createCollider(R.ColliderDesc.cylinder(T.halfHeight,T.radius).setFriction(C.friction),body)
  for(let i=0;i<20;i++)w.step()
  assert.ok(Math.abs(body.translation().y-(1.1+T.halfHeight))<.005,'fixture is actually supported by the real-height outside porch')
  assert.ok(TOWER_SWEEP.bottom-(1.1+T.halfHeight*2)>=.009,'one real coin thickness plus clearance fits below the cradle')
  assert.equal(towerSweepBlocked(w,b=>b.handle===body.handle),false,'a flat porch medal cannot latch the descending support underside')
  w.free()
 })
 test('a real ball on the side stage delays construction until the test obstruction is removed',()=>{
  const m=machine(),body=m.w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(T.x+T.ringRadius,T.buildTop+.44,T.z).setLinearDamping(.04).setAngularDamping(.08).setCcdEnabled(true))
  const collider=m.w.createCollider(R.ColliderDesc.ball(.44).setDensity(.6).setFriction(.22).setRestitution(.24),body)
  m.all.set(body.handle,{body,collider,held:false,caught:false});m.w.step();m.tower.enqueue(20);for(let i=0;i<40;i++)m.tick()
  assert.equal(m.tower.status().blocked,true);assert.equal(m.tower.status().waitReason,'cargo-path');assert.equal(m.created.length,0,'cannot build through a ball')
  let maxPenetration=0;for(let i=0;i<120;i++){m.tick();m.w.forEachRigidBody(b=>{if(!b.isKinematic())return;const cp=collider.contactCollider(b.collider(0),.01);if(cp)maxPenetration=Math.max(maxPenetration,-cp.distance)})}assert.equal(m.tower.status().released,0);assert.equal(m.tower.status().pending,20);m.w.removeRigidBody(body);m.all.delete(body.handle)
  for(let i=0;i<1500;i++){m.tick();for(const p of m.pieces)assert.ok(p.body.isValid())}
  assert.equal(m.tower.status().released,20);assert.equal(m.tower.status().pending,0);assert.ok(maxPenetration<.04,`ball/tower penetration ${maxPenetration}`)
  m.w.free()
 })
 test('dense direct dock traffic safely retains every owed medal rather than forcing a side transfer',()=>{
  const m=machine({seed:true});m.tower.enqueue(30);let blockedFrames=0
  for(let i=0;i<4000;i++){if(i<1200&&i%15===0)m.coin({x:((i/15)%3-1)*.65,y:1.5,z:T.z-.45});m.tick();if(m.tower.status().blocked)blockedFrames++}
  assert.ok(blockedFrames>0,'fixture actually exercises occupied sweep');const state=m.tower.status();assert.equal(state.released+state.pending,30);assert.equal(state.planned,30);if(state.pending){assert.equal(state.blocked,true);assert.equal(state.held+state.queued,state.pending);assert.ok(m.pieces.every(p=>p.held||p.releasedAt>=0),'no body disappears from controller ownership')}else assert.equal(state.released,30)
  console.log(`  side transfer delayed safely for ${blockedFrames} frames under dense dock traffic`);m.w.free()
 })
 test('same-frame independent requests and very large awards remain FIFO and conserved across bounded batches',()=>{
  const m=machine({capacity:900,seed:true}),ids=[m.tower.enqueue(20,'bank'),m.tower.enqueue(30,'prize'),m.tower.enqueue(121,'bank')]
  let maxHeld=0
  for(let i=0;i<6500;i++){m.tick();maxHeld=Math.max(maxHeld,m.tower.status().held)}
  // Use connected stock and the production controller's exact cargo/leaf sweeps.
  // A tall released tower can still obstruct the next lift: retain it safely,
  // then continue ordinary gravity-fed medals at the real board-bottom handoff
  // across nine in-range aims. These fixture inputs are not awards or nudges.
  let feedCount=0,extraFrames=0
  if(m.tower.status().pending){
   assert.ok(m.tower.status().blocked||m.tower.status().stage!=='idle');assert.equal(m.tower.status().planned,m.tower.status().released+m.tower.status().pending)
   const foreign=new Map(),state=m.tower.status()
   for(const p of m.pieces.filter(p=>p.held)){
    const from=p.body.translation(),to={x:p.start.x-T.x+T.dockX,y:from.y,z:from.z}
    m.w.intersectionsWithShape({x:(from.x+to.x)/2,y:from.y,z:from.z},{x:0,y:0,z:0,w:1},new R.Cuboid(T.radius+Math.abs(to.x-from.x)/2,T.halfHeight,T.radius),c=>{
     const b=c.parent(),piece=b&&m.all.get(b.handle);if(piece&&!piece.held)foreign.set(b.handle,{id:b.handle,at:{...b.translation()},request:piece.request?.id??null});return true
    })
   }
   console.log('  retained FIFO blockage before further ordinary inputs: '+JSON.stringify({stage:state.stage,held:state.held,released:state.released,pending:state.pending,actualCargoSweepHits:[...foreign.values()].slice(0,8)}))
   for(;extraFrames<9000&&m.tower.status().pending;extraFrames++){
    if(extraFrames%30===0&&m.tower.status().blocked&&m.all.size<900)m.coin({x:(feedCount++%9-4)*.72,y:1.45,z:-6.15})
    m.tick();maxHeld=Math.max(maxHeld,m.tower.status().held);assert.ok(m.all.size<=900,'normal inputs never exceed the physical body budget')
   }
  }
  const s=m.tower.status();assert.equal(s.planned,171);assert.equal(s.released,171,JSON.stringify(s));assert.equal(s.pending,0);assert.ok(maxHeld<=T.batchMax);assert.ok(feedCount<=300)
  assert.equal(m.created.length,171);assert.equal(new Set(m.created).size,171);assert.deepEqual(m.releases.map(p=>p.body.handle),m.created,'all 171 original bodies release once in creation/FIFO order')
  if(feedCount)console.log(`  FIFO retained its blocked remainder; ${feedCount} ordinary gravity-fed inputs cleared it in ${extraFrames} frames`)
  for(const [i,n] of [20,30,121].entries())assert.equal(m.releases.filter(p=>p.id===ids[i]).length,n)
  assert.deepEqual(m.releases.map(p=>p.id),[...Array(20).fill(ids[0]),...Array(30).fill(ids[1]),...Array(121).fill(ids[2])])
  m.w.free()
 })
 test('same-frame calls and background clock jumps cannot create duplicate coins or skip construction',()=>{
  const m=machine();m.tower.enqueue(20);m.tower.update(1)
  const first=m.tower.status(),created=m.created.length
  for(let i=0;i<20;i++)m.tower.update(1)
  assert.equal(JSON.stringify(m.tower.status()),JSON.stringify(first));assert.equal(m.created.length,created)
  m.tower.update(100000);assert.ok(m.created.length-created<=1);assert.equal(m.tower.status().released,0)
  m.w.free()
 })
 test('bounded tower load records real CPU physics cost without claiming device/GPU frame rate',()=>{
  const m=machine({seed:true});m.tower.enqueue(T.batchMax);const samples=[]
  for(let i=0;i<2000;i++){const start=performance.now();m.tick();samples.push(performance.now()-start)}
  samples.sort((a,b)=>a-b);const median=samples[Math.floor(samples.length*.5)],p95=samples[Math.floor(samples.length*.95)]
  assert.equal(m.created.length,T.batchMax);assert.ok(m.tower.status().held<=T.batchMax)
  assert.ok(samples.every(Number.isFinite));assert.ok(p95<250,'gross CPU regression (not a frame-rate target)')
  console.log(`  ${m.all.size} medals + 2 support leaves: CPU test-step median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`)
  m.w.free()
 })
 console.log(`${passed}/${passed} physical tower checks passed.`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
