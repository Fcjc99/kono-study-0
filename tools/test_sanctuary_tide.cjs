// Independent CPU regression: real Rapier gates and authoritative production rules.
// This is deliberately not a WebGL screenshot or a device-performance claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const ts=require('typescript'),R=require('@dimforge/rapier3d-compat'),root=path.resolve(__dirname,'..'),cache=new Map()
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n),Math,Number,Array,Infinity,Set,Map});return module.exports}
const P=load('src/store/pusher.ts'),D=load('src/store/delivery.ts'),Practice=load('src/store/practice.ts'),T=load('src/store/tide.ts'),M=load('src/store/motion.ts'),S=load('src/store/dispense.ts')
const fresh=()=>P.newCove(()=>.2,100,true),json=JSON.stringify
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name)}

function physical(options={}){
 const world=new R.World({x:0,y:-22,z:0});world.timestep=1/60;world.numSolverIterations=8
 const deck=world.createCollider(R.ColliderDesc.cuboid(M.CABINET.halfWidth,.2,M.CABINET.depth/2).setTranslation(0,-.2,-.8).setFriction(.58))
 const pusher=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,M.PUSHER_SHELF.height/2,M.shelfCenter(P.pusherAt(0))))
 world.createCollider(R.ColliderDesc.cuboid(M.PUSHER_SHELF.width/2,M.PUSHER_SHELF.height/2,M.PUSHER_SHELF.depth/2).setFriction(.58),pusher)
 const pieces=new Map(),released=new Set(),completed=[],gateContacts=new Set(),gateSupported=new Set(),deckContacts=new Set(),motions=new Map()
 let frame=0,room=options.room??900,clear=true,maxHeld=0
 function coin(at,request){const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(at.x,at.y,at.z).setCcdEnabled(true).setLinearDamping(S.COIN_MOTION.linearDamping).setAngularDamping(S.COIN_MOTION.angularDamping));world.createCollider(R.ColliderDesc.cylinder(T.TIDE.halfHeight,T.TIDE.radius).setFriction(S.COIN_MOTION.friction).setRestitution(S.COIN_MOTION.restitution),body);pieces.set(body.handle,{body,request:{...request},initial:{...at}});motions.set(body.handle,at.z);return body}
 const machine=T.createTideMachine(world,{createCoin:coin,room:()=>room-pieces.size,clear:()=>clear,onRelease(body,request){assert.ok(pieces.has(body.handle),'release is the original registered body');assert.ok(!released.has(body.handle),'one release per physical body');assert.equal(body.bodyType(),R.RigidBodyType.Dynamic);assert.ok(body.translation().y<T.TIDE.top-T.TIDE.gateHalfHeight*2-T.TIDE.halfHeight-.01,'delivery follows actual crossing');released.add(body.handle)},onComplete:r=>completed.push(r)})
 function verify(){const s=machine.status();maxHeld=Math.max(maxHeld,s.held);assert.equal(s.planned,s.queued+s.held+s.released);assert.equal(s.released,released.size);assert.equal(s.pending,s.queued+s.held);assert.equal(s.held,pieces.size-released.size);assert.ok(s.held<=T.TIDE.batchMax);for(const p of pieces.values()){const q=p.body.translation();assert.ok([q.x,q.y,q.z].every(Number.isFinite));motions.set(p.body.handle,Math.max(motions.get(p.body.handle),q.z))}return s}
 function tick(n=1){for(let i=0;i<n;i++){machine.update(++frame);pusher.setNextKinematicTranslation({x:0,y:M.PUSHER_SHELF.height/2,z:M.shelfCenter(P.pusherAt(frame))});world.step();for(const [h,p]of pieces){const collider=p.body.collider(0),d=deck.contactCollider(collider,.015);if(d&&d.distance<=.015)deckContacts.add(h);world.contactPairsWith(collider,other=>{const b=other.parent();if(b&&b!==p.body&&b.isKinematic()&&b!==pusher)gateContacts.add(h)})}const connected=(body,seen=new Set())=>{if(seen.has(body.handle))return false;seen.add(body.handle);let supported=false;world.contactPairsWith(body.collider(0),other=>{const b=other.parent();if(!b||supported)return;const contact=body.collider(0).contactCollider(other,.015);if(!contact||contact.distance>.015)return;if(b.isKinematic()&&b!==pusher)supported=true;else if(pieces.has(b.handle)&&connected(b,seen))supported=true});return supported};for(const [h,p]of pieces)if(!released.has(h)&&connected(p.body))gateSupported.add(h);verify()}return machine.status()}
 return {world,pieces,released,completed,gateContacts,gateSupported,deckContacts,motions,machine,tick,verify,get maxHeld(){return maxHeld},setRoom:n=>room=n,setClear:v=>clear=v,free:()=>world.free()}
}

;(async()=>{
 await R.init()
 await test('earned JP commits one immutable Tide award, not rain or immediate hand credit',()=>{
  let c={...fresh(),jackpot:137,chance:{pocket:0,at:0},frame:P.CHANCE_FRAMES-1,dishQueue:2}
  c=P.step(c,()=>{throw Error('a committed chance must not reroll')})
  assert.equal(c.fieldAwards,137);assert.equal(c.hand,100);assert.equal(c.won,0);assert.equal(c.rain??0,0);assert.equal(c.jpWins,1);assert.equal(c.jackpot,P.JP_START)
  assert.equal(json(c.tides),json([{id:1,n:137,at:P.CHANCE_FRAMES,practice:false}]))
  const awarded=json(c.tides);for(let i=0;i<P.RESULT_FRAMES-1;i++)c=P.step(c,()=>{throw Error('result dwell must not start next draw')})
  assert.equal(json(c.tides),awarded);assert.equal(c.dishQueue,2);assert.equal(P.busy(c),true)
  c=P.step({...c,tideBusy:true},()=>.99);assert.equal(c.dish.pocket,7);assert.equal(c.dishQueue,1)
  assert.equal(json(c.tides),awarded,'physical Tide right survives the independent presentation');assert.equal(c.fieldAwards,137)

 })
 await test('all chance pockets preserve original hit map, award amounts, cap and truthful miss copy',()=>{
  for(let winning=1;winning<=4;winning++)for(let pocket=0;pocket<12;pocket++){
   const hit=P.isWinPocket(pocket,winning);let c=P.step({...fresh(),jackpot:247,winPockets:winning,frame:P.CHANCE_FRAMES-1,chance:{pocket,at:0}},()=>.5)
   assert.equal(c.fieldAwards,hit?247:10);assert.equal(c.tides?.length??0,hit?1:0);assert.equal(c.jpWins,hit?1:0);assert.equal(c.jackpot,hit?100:267);assert.equal(c.winPockets,hit?1:Math.min(4,winning+1));assert.equal(c.hand,100)
   if(!hit){assert.doesNotMatch(c.events.at(-1).text,/So close/i);assert.equal(/added/.test(c.bonusResult.label),winning<4);assert.equal(/maximum/.test(c.bonusResult.label),winning===4)}
  }
 })
 await test('Practice JP stays explicitly sample supply and preserves prize odds and earned wins',()=>{
  const state={...Practice.newPractice(),enabled:true},c={...fresh(),jackpot:223,winPockets:3,jpWins:4},ctx={ready:true,ended:false,towerBusy:false,pending:0,balls:0}
  const out=Practice.practiceCommand(state,c,'jp',1000,ctx);assert.equal(out.accepted,true);assert.equal(out.state.used,true);assert.equal(out.state.addedCoins,100);assert.equal(out.cove.tides[0].practice,true);assert.equal(out.cove.fieldAwards,100);assert.equal(out.cove.jpWins,4);assert.equal(out.cove.jackpot,223);assert.equal(out.cove.winPockets,3);assert.equal(out.cove.hand,100)
  const twice=Practice.practiceCommand(out.state,out.cove,'jp',1100,ctx);assert.equal(twice.accepted,false);assert.equal(twice.cove,out.cove)
  assert.equal(D.pendingMedals(out.cove,{hoppers:0,tower:0,bucket:0,tide:0}),100)
 })
 for(const lane of ['left','center','right'])await test(`${lane} gate: real support → same dynamic medals → same wooden deck, exact 25-medal remainder`,()=>{
  const h=physical();try{
   const id=h.machine.enqueue(25,{key:'physical-'+lane});assert.equal(h.machine.status().stage,'choosing');h.tick(120);assert.equal(h.pieces.size,0)
   assert.equal(h.machine.chooseLane(id,lane),true);assert.equal(h.machine.chooseLane(id,lane==='left'?'right':'left'),false)
   for(let i=0;i<2000&&h.machine.status().stage!=='idle';i++)h.tick()
   const s=h.verify();assert.equal(s.stage,'idle');assert.equal(s.released,25);assert.equal(s.pending,0);assert.equal(h.pieces.size,25);assert.equal(h.completed.length,1);assert.equal(h.completed[0].total,25);assert.equal(h.completed[0].released,25);assert.equal(h.completed[0].lane,lane);assert.equal(h.maxHeld,12)
   h.tick(200);assert.ok(h.deckContacts.size>=12,'the medal waves physically reach the actual board');for(const p of h.pieces.values())assert.ok(p.body.translation().y<1.1,'every released body lands on the same board or a supported pile');assert.equal(h.gateSupported.size,25,'every original medal had an actual contact chain to its visible gate before release')
   for(const p of h.pieces.values()){assert.ok(Math.abs(p.initial.x-T.TIDE.lanes[lane])<=T.TIDE.columnPitch+.001);assert.ok(Math.abs(p.initial.z-T.tideLaneZ(lane))<=T.TIDE.columnPitch+.001);assert.equal(p.request.total,25)}
   console.log(`  ${lane}: ${s.released} original bodies, ${h.gateContacts.size} gate contacts, ${h.deckContacts.size} deck contacts`)
  }finally{h.free()}
 })
 await test('each gate physically contacts existing board medals; flat medals are not given an artificial push',()=>{
  for(const lane of ['left','center','right']){const h=physical();try{
   const start={x:T.TIDE.lanes[lane]+.18,y:.055,z:T.tideLaneZ(lane)+.2},body=h.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(start.x,start.y,start.z).setCcdEnabled(true).setLinearDamping(S.COIN_MOTION.linearDamping).setAngularDamping(S.COIN_MOTION.angularDamping))
   h.world.createCollider(R.ColliderDesc.cylinder(.055,.31).setFriction(S.COIN_MOTION.friction).setRestitution(S.COIN_MOTION.restitution),body)
   h.tick(100);const before={...body.translation()},id=h.machine.enqueue(12);h.machine.chooseLane(id,lane);let contact=false
   for(let i=0;i<900;i++){h.tick();h.world.contactPairsWith(body.collider(0),other=>{if(h.pieces.has(other.parent()?.handle))contact=true})}
   const after=body.translation(),movement=Math.hypot(after.x-before.x,after.z-before.z);assert.equal(contact,true,'a real reward medal contacts existing board material');assert.ok(Number.isFinite(movement));console.log(`  ${lane}: contacted existing medal moved ${movement.toFixed(3)} world units`)
  }finally{h.free()}}
 })
 await test('gate ownership, repeat enqueue, wrong request/lane and clock reentry cannot change committed supply',()=>{
  const h=physical();try{
   const a=h.machine.enqueue(13,{key:'a'}),b=h.machine.enqueue(7,{key:'b',practice:true});assert.equal(h.machine.enqueue(99,{key:'a'}),a);assert.equal(h.machine.status().planned,20)
   assert.equal(h.machine.chooseLane(b,'right'),false);assert.equal(h.machine.chooseLane(a,'invalid'),false);assert.equal(h.machine.chooseLane(-1,'center'),false);assert.equal(h.machine.status().lane,null)
   h.machine.chooseLane(a,'left');let firstDone=false
   for(let i=0;i<3000&&h.completed.length<2;i++){
    const before=json(h.machine.status());h.machine.update(NaN);assert.equal(json(h.machine.status()),before)
    h.tick();const s=h.machine.status();if(s.requestId===b&&!firstDone){assert.equal(s.stage,'choosing');assert.equal(s.lane,null);assert.equal(h.completed.length,1);assert.equal(h.completed[0].id,a);assert.equal(h.completed[0].released,13);firstDone=true;h.machine.chooseLane(b,'right')}
   }
   assert.equal(firstDone,true);assert.equal(h.completed.length,2);assert.equal(h.completed[1].practice,true);assert.equal(h.completed[1].released,7);assert.equal(h.machine.enqueue(13,{key:'a'}),a);assert.equal(h.machine.status().planned,20);assert.equal(h.machine.status().released,20)
   for(const n of [0,-1,NaN,Infinity,1.5])assert.equal(h.machine.enqueue(n),null)
  }finally{h.free()}
 })
 await test('zero capacity, a partial batch and a blocked gate retain every entitlement without deleting a body',()=>{
  const h=physical({room:0});try{
   const id=h.machine.enqueue(37,{key:'pressure'});h.machine.chooseLane(id,'center');h.tick(100);assert.equal(h.machine.status().blocked,true);assert.equal(h.machine.status().queued,37);assert.equal(h.pieces.size,0)
   h.setRoom(5);for(let i=0;i<1200&&h.released.size<5;i++)h.tick();assert.equal(h.released.size,5);assert.equal(h.pieces.size,5);assert.equal(h.machine.status().pending,32)
   h.tick(150);assert.equal(h.machine.status().pending,32);assert.equal(h.pieces.size,5)
   h.setRoom(100);h.setClear(false);h.tick(100);assert.equal(h.machine.status().blocked,true);assert.equal(h.machine.status().pending,32);assert.equal(h.pieces.size,5)
   h.setClear(true);for(let i=0;i<3000&&h.machine.status().stage!=='idle';i++)h.tick();assert.equal(h.machine.status().released,37);assert.equal(h.machine.status().pending,0);assert.equal(h.pieces.size,37);assert.equal(h.completed.length,1)
  }finally{h.free()}
 })
 console.log(`${passed}/${passed} independent Sanctuary Tide checks passed (real Rapier; no GPU).`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
