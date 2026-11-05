// Independent production lifecycle test. Real React callbacks + Three scene +
// installed Rapier; only GPU/audio/DOM painting are stubbed by the shared harness.
// Controlled fixtures add genuine uncollected bodies/committed rights. No fixture
// moves a target to the tray, invokes settle, fakes contact, or deletes live coins.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs'),R=require('@dimforge/rapier3d-compat')
const json=JSON.stringify
let passed=0
async function test(name,fn){if(process.env.CLEAR_HELD_ONLY==='1'&&!name.startsWith('an actively building'))return;await fn();passed++;console.log('PASS '+name)}
function nodes(n,out=[]){if(!n||typeof n!=='object')return out;if(Array.isArray(n)){n.forEach(x=>nodes(x,out));return out}out.push(n);nodes(n.props?.children,out);return out}
function words(n){if(n==null||typeof n==='boolean')return '';if(typeof n==='string'||typeof n==='number')return String(n);return Array.isArray(n)?n.map(words).join(''):words(n.props?.children)}
function assertLedger(h){const c=h.review.cove.current,rt=h.rt,D=h.load('src/store/delivery.ts'),q=rt.queues,t=rt.towerMachine.status(),s=rt.tideMachine.status(),a=D.deliveryLedger(c.fieldAwards??0,rt.counts.rewardDelivered,rt.counts.rewardCollected,rt.counts.rewardLost);D.assertDeliveryConserved(a,D.pendingMedals(c,{hoppers:q.hoppers,tower:t.pending,bucket:q.bucket,tide:s.pending}),[...rt.pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length);assert.equal(c.hand,100-c.dropped+c.won);return a}
function protectedRules(c){return json(Object.fromEntries(Object.entries(c).filter(([k])=>!['hand','won','lost','boardClearBusy','boardClearPractice','events'].includes(k))))}
function physicalSnapshot(h){return json({c:h.review.cove.current,status:h.rt.boardClearMachine.status(),pieces:[...h.rt.pieces].map(([id,p])=>[id,p.body.translation(),p.body.rotation(),p.body.linvel(),p.body.angvel(),p.counted,p.towerHeld,p.tideHeld]),counts:h.rt.counts,queues:h.rt.queues,tide:h.rt.tideMachine.status(),tower:h.rt.towerMachine.status()})}
function camera(h){return json({position:h.rt.camera.position.toArray(),quaternion:h.rt.camera.quaternion.toArray(),zoom:h.rt.camera.zoom,fov:h.rt.camera.fov,saved:[...['kono-medal-cove.camera.v1'].map(k=>h.storage.getItem(k))]})}
function createAudit(h){
 const c=h.review.cove.current,rt=h.rt,initialBodies=new Set([...rt.pieces.values()].map(p=>p.body)),targets=[...rt.pieces.values()].filter(p=>!p.ball&&!p.counted&&!p.towerHeld&&!p.tideHeld&&p.capturedPocket===undefined),observed=new Set(),initial={won:c.won,lost:c.lost,rewardCollected:rt.counts.rewardCollected},targetBodies=new Set(targets.map(p=>p.body));let peak=[...rt.pieces.values()].filter(p=>!p.ball).length
 assert.ok(targets.length>0)
 // One RAF can execute two real fixed steps. Record the exact immediately
 // preceding step's contacts, and audit settlement before another step replaces
 // them. Never accept an arbitrary historical tray touch or relaxed tolerance.
 let stepContacts=new Map()
 const snapshotContacts=()=>{const next=new Map();for(const p of targets){if(p.counted||rt.pieces.get(p.body.handle)!==p)continue;const touching=(rt.trayCatchers??[rt.trayFloor]).some(catcher=>{const contact=catcher.contactCollider(p.body.collider(0),.012);return contact&&contact.distance<=.012&&contact.normal1.y>.4});if(touching)next.set(p,{...p.body.translation()})}stepContacts=next}
 const account=()=>{for(const p of targets)if(p.counted&&!observed.has(p)){assert.equal(rt.pieces.get(p.body.handle),p,'first settlement keeps original body alive');const at=stepContacts.get(p);assert.ok(at,'first accounting must match real top-facing tray contact in immediately preceding physics step');assert.ok(at.z>h.load('src/store/dispense.ts').TRAY.back-.31,'collection happens at actual front tray');observed.add(p)}}
 const originalStep=rt.world.step.bind(rt.world)
 snapshotContacts();rt.world.step=(...args)=>{account();const result=originalStep(...args);snapshotContacts();return result}
 return {targets,observed,targetBodies,get peak(){return peak},check(){
  assertLedger(h);peak=Math.max(peak,[...rt.pieces.values()].filter(p=>!p.ball).length);assert.ok(peak<=900,'existing capacity ceiling still applies')
  account()
  for(const p of targets)if(!p.counted)assert.equal(rt.pieces.get(p.body.handle),p,'an old live coin must not vanish/replaced before genuine collection')
  for(const piece of rt.pieces.values())if(!initialBodies.has(piece.body)){assert.ok(!targets.some(p=>rt.pieces.get(p.body.handle)===p),'fresh stock cannot appear until every old target physically retires');assert.equal(piece.reward,false,'a refill is starting stock, not a fabricated award')}
  assert.equal(h.review.cove.current.lost,initial.lost,'clear targets must not become side loss')
  assert.equal(h.review.cove.current.won-initial.won,observed.size,'all-medal credit equals independently observed once-only contacts')
  assert.equal(rt.counts.rewardCollected-initial.rewardCollected,[...observed].filter(p=>p.reward).length,'reward-source credit remains a subset, not stock credit')
 },complete(){this.check();assert.equal(observed.size,targets.length,'every original eligible medal reaches actual tray contact')}}
}
function until(h,predicate,limit,check=()=>{}){for(let i=0;i<limit;i++){if(predicate())return i;h.advance();check()}assert.ok(predicate(),'production flow did not complete: '+json(h.rt.boardClearMachine.status()))}
// Cross-bonus fixtures omit the default held stock; the separate reference clear
// regression covers all 128 default held bodies against 772 crowded live targets.
async function fresh(options={initialStock:0}){const h=await start(390,550,options);assert.equal(typeof h.review.requestBoardClear,'function','production clear callback exported');assert.equal(typeof h.rt.boardClearMachine?.status,'function','production clear controller exported');return h}

;(async()=>{
 let h=await fresh(),v=h.review,rt=h.rt,P=h.load('src/store/pusher.ts')
 await test('actual earned-clear callback is guarded before entitlement and during options, hidden tab, camera edit and ended round',()=>{
  const before=json(v.cove.current);v.requestBoardClear();assert.equal(json(v.cove.current),before)
  // Resolve an already selected genuine JP through the production rules/loop.
  v.cove.current={...v.cove.current,jackpot:12,chance:{pocket:0,at:v.cove.current.frame-P.CHANCE_FRAMES}};h.advance(12);assert.equal(v.cove.current.jpWins,1);assert.equal(v.cove.current.boardClears,1)
  for(const mode of ['options','hidden','edit','ended']){
   if(mode==='options')v.blockedRef.current=true;if(mode==='hidden')h.doc.hidden=true;if(mode==='edit')v.editCamera();if(mode==='ended')v.ended.current=true
   const snapshot=json(v.cove.current);v.requestBoardClear();assert.equal(json(v.cove.current),snapshot,mode+' rejects without consuming earned clear')
   v.blockedRef.current=false;h.doc.hidden=false;if(mode==='edit')v.lockCamera();v.ended.current=false
  }
 })
 await test('earned production button clears same stock/reward/input bodies exactly once while preserving active Tide, balls and queued outcomes',()=>{
  // Let the visible JP result finish, then run the actual reservoir until loaded.
  h.advance(P.RESULT_FRAMES+2);v.selectTideLane(rt.tideMachine.status().requestId,'left');until(h,()=>rt.tideMachine.status().held>=3,500)
  // Independent stress fixture: committed side rewards, an unstarted tower,
  // a live ball and waiting ball; ordinary input remains in flight at activation.
  let c=P.awardTower(v.cove.current,20);c=P.awardField(c,9);c={...c,rain:(c.rain??0)+9,bank:85,ballsAwarded:(c.ballsAwarded??0)+2,medals:[...c.medals,{id:c.nextId,x:35,y:35,vx:0,vy:0,ball:true}],nextId:c.nextId+1};v.cove.current=c
  const ball=rt.addCoin(1.5,.7,2,true);v.dropOne();h.advance(3)
  c=v.cove.current;v.cove.current={...c,queue:3,wheelQueue:[4,5,6],dishQueue:2,chanceQueue:1,wheels:[{seg:1,at:c.frame},null,{seg:4,at:c.frame}]}
  const held=[...rt.pieces.values()].filter(p=>p.tideHeld||p.towerHeld),ballPiece=rt.pieces.get(ball.handle);assert.ok(held.length>=3);assert.ok([...rt.pieces.values()].some(p=>p.board&&p.capturedPocket===undefined));assert.ok(rt.queues.hoppers>0);assert.ok(rt.queues.ballWaiting+rt.queues.ballRuns>0)
  v.beginFeed('keyboard');assert.equal(v.feed.current.active,true)
  const audit=createAudit(h),pose=camera(h),hand=v.cove.current.hand
  const clear=nodes(h.render()).find(n=>n.type==='button'&&/clear board|board clear/i.test(words(n)+' '+(n.props?.['aria-label']??''))&&!n.props.disabled)
  assert.ok(clear,'an enabled production button exposes the earned entitlement');clear.props.onClick();assert.equal(v.cove.current.boardClears,0);assert.equal(v.cove.current.boardClearBusy,true);assert.equal(v.cove.current.hand,hand,'activation never grants a numeric payout')
  const frozen=protectedRules(v.cove.current),queues=json(rt.queues),tide=json(rt.tideMachine.status()),tower=json(rt.towerMachine.status()),heldPos=held.map(p=>json({at:p.body.translation(),q:p.body.rotation()})),ballPos=json(ball.translation())
  for(let repeat=0;repeat<20;repeat++){v.requestBoardClear();v.beginFeed('keyboard');v.dropOne();v.tapDrop();h.win.dispatch('keydown',{code:'Space'});v.practiceState.current.enabled=true;v.command.current('coins')}
  v.practiceState.current.enabled=false;assert.equal(v.feed.current.active,false);assert.equal(protectedRules(v.cove.current),frozen)
  const frozenCheck=()=>{audit.check();if(!v.cove.current.boardClearBusy)return;assert.equal(protectedRules(v.cove.current),frozen);assert.equal(json(rt.queues),queues);assert.equal(json(rt.tideMachine.status()),tide);assert.equal(json(rt.towerMachine.status()),tower);assert.equal(rt.pieces.get(ball.handle),ballPiece);assert.equal(json(ball.translation()),ballPos);held.forEach((p,i)=>assert.equal(json({at:p.body.translation(),q:p.body.rotation()}),heldPos[i]));assert.equal(camera(h),pose)}
  h.advance(45);frozenCheck()
  for(const mode of ['hidden','options']){const paused=physicalSnapshot(h);if(mode==='hidden'){h.doc.hidden=true;h.doc.dispatch('visibilitychange')}else v.blockedRef.current=true;h.advance(180);assert.equal(physicalSnapshot(h),paused);h.doc.hidden=false;v.blockedRef.current=false;h.advance();frozenCheck()}
  const frames=until(h,()=>!v.cove.current.boardClearBusy,12000,frozenCheck);audit.complete();assert.equal(v.feed.current.active,false);assert.equal(v.cove.current.hand,hand+audit.targets.length);assert.equal(v.cove.current.jpWins,1);assert.equal(v.cove.current.ballsCaptured,0);assert.equal(v.cove.current.dishQueue,2,'a preserved live ball cannot manufacture a second challenge');assert.equal(v.practiceState.current.used,false);assert.equal(camera(h),pose)
  const seed=[...rt.pieces.values()].filter(p=>!p.ball&&!p.counted&&!p.towerHeld&&!p.tideHeld&&p.capturedPocket===undefined&&!audit.targetBodies.has(p.body));assert.ok(seed.length>0,'a real fresh loose stock pile is present');assert.equal(seed.length,rt.clearSeeded);assert.ok(seed.every(p=>!p.reward&&!p.counted),'new stock is not an award or instant collection')
  const noMore=json({clears:v.cove.current.boardClears,won:v.cove.current.won});v.requestBoardClear();assert.equal(json({clears:v.cove.current.boardClears,won:v.cove.current.won}),noMore);assert.equal(v.cove.current.boardClearBusy,false)
  console.log(`  ${audit.targets.length} original stock/input/reward medals collected physically; ${seed.length} fresh uncredited stock; clear completed in <=${frames+47} running frames; peak ${audit.peak}`)
  const previousFrame=v.cove.current.frame;h.advance();assert.ok(v.cove.current.frame<=previousFrame+1,'resume advances at most one rule tick, no catch-up');assertLedger(h)
  // Queues may now resume, but their selected wheel outcomes cannot be rerolled.
  assert.equal(v.cove.current.wheels[0].seg,1);assert.equal(v.cove.current.wheels[2].seg,4)
 })
 h.cleanup();h=await fresh({initialStock:0});v=h.review;rt=h.rt;P=h.load('src/store/pusher.ts')
 await test('synthetic no-held-bay full 900-medal field clears through real contacts; one Practice sample refills once without earned rights or seed credit',()=>{
  const stock=[...rt.pieces.values()].filter(p=>!p.ball).length,C=h.load('src/store/motion.ts').CABINET,columns=Math.floor((C.width-1)/.63),x0=-(columns-1)*.63/2;let added=0
  for(let layer=2;[...rt.pieces.values()].filter(p=>!p.ball).length<900;layer++)for(let row=0;row<15&&[...rt.pieces.values()].filter(p=>!p.ball).length<900;row++)for(let col=0;col<columns&&[...rt.pieces.values()].filter(p=>!p.ball).length<900;col++){
   const at={x:x0+col*.63,y:.065+layer*.14,z:-3.8+row*.63};let occupied=false;rt.world.forEachCollider(c=>{if(c.isSensor())return;const contact=c.contactShape(new R.Cylinder(.055,.31),at,{x:0,y:0,z:0,w:1},.001);if(contact&&contact.distance<-.001)occupied=true});if(occupied)continue
   rt.addCoin(at.x,at.y,at.z,false,0,false,true,true);added++
  }
  v.cove.current=P.awardField(v.cove.current,added);assertLedger(h);assert.equal(stock+added,900)
  const audit=createAudit(h),hand=v.cove.current.hand,pose=camera(h);v.practiceState.current.enabled=true;v.command.current('clear')
  assert.equal(v.cove.current.boardClearBusy,true);assert.equal(v.practiceState.current.used,true);assert.equal(v.practiceState.current.clearUsed,true);assert.equal(v.cove.current.jpWins,0);assert.equal(v.cove.current.boardClears,0)
  let halos=false,maxActive=0
  const frames=until(h,()=>!v.cove.current.boardClearBusy,20000,()=>{audit.check();const status=rt.boardClearMachine.status(),mesh=rt.scene.getObjectByName('board-clear-magnetic-halos');assert.ok(mesh?.visible);assert.equal(mesh.frustumCulled,false,'moving halo bounds must not be cached from the empty first frame');halos||=mesh.count>0;maxActive=Math.max(maxActive,status.active.length);assert.equal(camera(h),pose)})
  audit.complete();assert.equal(audit.observed.size,900);assert.equal(v.cove.current.hand,hand+900);assert.equal(rt.counts.rewardCollected,added);assert.equal(rt.counts.rewardLost,0);assert.ok(halos,'real active originals have scene-visible magnetic halos')
  const seed=rt.clearSeeded;assert.ok(seed>0);assert.equal([...rt.pieces.values()].filter(p=>!p.ball&&!p.counted).length,seed);assert.equal(v.feed.current.active,false)
  const done=json({won:v.cove.current.won,hand:v.cove.current.hand,awarded:v.cove.current.fieldAwards});v.practiceState.current.enabled=true;v.command.current('clear');v.requestBoardClear();assert.equal(v.cove.current.boardClearBusy,false);h.advance(180);assert.equal(rt.clearSeeded,seed);assert.equal(json({won:v.cove.current.won,hand:v.cove.current.hand,awarded:v.cove.current.fieldAwards}),done,'newly seeded coins are never instant prize credit');assertLedger(h)
  console.log(`  dense ${stock} stock + ${added} reward = 900 exact tray contacts in ${frames} frames; ${seed} new uncredited stock; max ${maxActive} active magnets`)
 })
 h.cleanup();h=await fresh();v=h.review;rt=h.rt;P=h.load('src/store/pusher.ts')
 await test('clear during unchosen Tide preserves choice, and camera edit pauses/rebases without leaking input',()=>{
  v.cove.current={...v.cove.current,jackpot:1,chance:{pocket:0,at:-P.CHANCE_FRAMES}};h.advance(P.RESULT_FRAMES+14)
  const request=rt.tideMachine.status().requestId;assert.equal(rt.tideMachine.status().stage,'choosing');v.requestBoardClear();const audit=createAudit(h);h.advance(30);audit.check()
  v.selectTideLane(request,'right');assert.equal(rt.tideMachine.status().lane,null,'stale lane callbacks cannot mutate a paused unchosen award')
  const paused=physicalSnapshot(h);v.editCamera();h.advance(180);assert.equal(physicalSnapshot(h),paused);v.dropOne();v.beginFeed('keyboard');assert.equal(v.feed.current.active,false);v.lockCamera();h.advance();audit.check()
  until(h,()=>!v.cove.current.boardClearBusy,12000,()=>audit.check());audit.complete();assert.equal(rt.tideMachine.status().stage,'choosing');assert.equal(rt.tideMachine.status().lane,null);assert.equal(rt.tideMachine.status().pending,1)
  v.selectTideLane(request,'right');assert.equal(rt.tideMachine.status().lane,'right');until(h,()=>rt.tideMachine.status().stage==='idle',1500,()=>assertLedger(h));assert.equal(rt.tideMachine.status().released,1)
 })
 await test('a second genuine JP grants one further complete clear, never an automatic repeated refill',()=>{
  const firstCollected=v.cove.current.won,previousBodies=new Set([...rt.pieces.values()].map(p=>p.body))
  v.cove.current={...v.cove.current,jackpot:1,chance:{pocket:0,at:v.cove.current.frame-P.CHANCE_FRAMES}};h.advance(12)
  assert.equal(v.cove.current.jpWins,2);assert.equal(v.cove.current.boardClears,1);assert.equal(v.practiceState.current.used,false)
  const audit=createAudit(h);v.requestBoardClear();v.requestBoardClear();assert.equal(v.cove.current.boardClears,0);assert.equal(v.cove.current.boardClearBusy,true)
  until(h,()=>!v.cove.current.boardClearBusy,12000,()=>audit.check());audit.complete();assert.equal(v.cove.current.jpWins,2);assert.equal(v.cove.current.won,firstCollected+audit.targets.length);assert.equal(v.cove.current.boardClears,0);assert.equal(rt.tideMachine.status().pending,1,'second JP field supply stays owed, separate from the clear')
  const seed=rt.clearSeeded,bodies=new Set([...rt.pieces.values()].map(p=>p.body));assert.ok([...bodies].some(body=>!previousBodies.has(body)),'the second earned clear really creates a new field generation')
  v.requestBoardClear();h.advance(120);assert.equal(v.cove.current.boardClearBusy,false);assert.equal(rt.clearSeeded,seed);assert.ok([...rt.pieces.values()].every(p=>bodies.has(p.body)),'no new body silently refills or spawns twice; original bodies may naturally collect after resume')
  const drops=v.cove.current.dropped,hand=v.cove.current.hand;v.dropOne();assert.equal(v.cove.current.dropped,drops+1);assert.equal(v.cove.current.hand,hand-1,'normal legal input returns after clear');assertLedger(h)
 })
 h.cleanup();h=await fresh();v=h.review;rt=h.rt;P=h.load('src/store/pusher.ts')
 await test('an actively building tower retains every held coin and exact machinery stage, then finishes after clear',()=>{
  v.cove.current=P.awardTower({...v.cove.current,jackpot:1,chance:{pocket:0,at:-P.CHANCE_FRAMES}},20)
  until(h,()=>rt.towerMachine.status().held>=6,600,()=>assertLedger(h));assert.equal(v.cove.current.boardClears,1)
  const held=[...rt.pieces.values()].filter(p=>p.towerHeld);assert.ok(held.length>=6);const status=json(rt.towerMachine.status()),poses=held.map(p=>json({at:p.body.translation(),rotation:p.body.rotation()})),audit=createAudit(h)
  v.requestBoardClear();until(h,()=>!v.cove.current.boardClearBusy,12000,()=>{audit.check();assert.equal(json(rt.towerMachine.status()),status);held.forEach((p,i)=>{assert.equal(rt.pieces.get(p.body.handle),p);assert.equal(p.towerHeld,true);assert.equal(json({at:p.body.translation(),rotation:p.body.rotation()}),poses[i])})});audit.complete()
  assert.equal(rt.counts.rewardDelivered,0,'held tower construction must not be counted as cleared/delivered supply');assert.equal(rt.towerMachine.status().pending,20);assert.equal(rt.tideMachine.status().pending,1)
  // The shortened front can collect an original released medal before the
  // empty machinery finishes resetting. Preserve its identity until a proven
  // actual contact, then permit the ordinary accounted retirement lifecycle.
  const arrived=new Set();let heldContacts=new Set()
  const accountHeld=()=>{for(const p of held)if(p.counted&&!arrived.has(p)){assert.ok(heldContacts.has(p),'released original must truly touch the tray before accounting/retirement');arrived.add(p)}}
  const originalStep=rt.world.step.bind(rt.world)
  rt.world.step=(...args)=>{accountHeld();const result=originalStep(...args);heldContacts=new Set(held.filter(p=>!p.counted&&rt.pieces.get(p.body.handle)===p&&rt.trayCatchers.some(c=>{const contact=c.contactCollider(p.body.collider(0),.012);return contact&&contact.distance<=.012&&contact.normal1.y>.4})));return result}
  until(h,()=>rt.towerMachine.status().stage==='idle'&&rt.towerMachine.status().released===20,2500,()=>{assertLedger(h);accountHeld();for(const p of held)if(!p.counted)assert.equal(rt.pieces.get(p.body.handle),p)})
  accountHeld();assert.equal(rt.counts.rewardDelivered,20);assert.equal(rt.tideMachine.status().pending,1);for(const p of held){if(p.counted)assert.ok(arrived.has(p));else assert.equal(rt.pieces.get(p.body.handle),p);assert.equal(p.towerHeld,false,'the original held body is released, not replaced')}
 })
 h.cleanup()
 console.log(`${passed}/${passed} independent Board Clear lifecycle checks passed (production CPU/Rapier, not GPU).`)
})().catch(error=>{console.error('FAIL',error);process.exit(1)})
