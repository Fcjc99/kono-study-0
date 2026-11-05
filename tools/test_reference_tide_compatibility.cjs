// Independent DEFAULT-stock compatibility audit. Real production Rapier;
// no relocated/deleted bodies, replenishment, or rendering claims.
// Ball challenges now continue during Tide, so naturally earned extra towers
// must also finish with exact planned/body counts, not be mistaken for overpay.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs')
function ledger(h){const c=h.review.cove.current,r=h.rt,D=h.load('src/store/delivery.ts'),q=r.queues,a=D.deliveryLedger(c.fieldAwards,r.counts.rewardDelivered,r.counts.rewardCollected,r.counts.rewardLost);D.assertDeliveryConserved(a,D.pendingMedals(c,{hoppers:q.hoppers,tower:r.towerMachine.status().pending,bucket:q.bucket,tide:r.tideMachine.status().pending}),[...r.pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length);assert.equal(c.hand,100-c.dropped+c.won);return a}
;(async()=>{
 const mode=process.argv[2]||'left',h=await start(),r=h.rt,v=h.review,P=h.load('src/store/pusher.ts'),seen=new Map(),released=new Set(),towerSeen=new Map(),towerReleased=new Set();
 const initialMedals=[...r.pieces.values()].filter(p=>!p.ball).length
 assert.equal([...r.pieces.values()].filter(p=>p.towerHeld&&!p.reward).length,128,'default bay stock remains present')
 assert.ok(initialMedals>=708&&initialMedals<=778,'default480ring+128bay+100..170loose stock, never an emptied fixture');assert.equal([...r.pieces.values()].filter(p=>p.ball).length,6)
 let frames=0,lastProgress=0,lastCount=0,firstId=null,startedTower=false,selected=false,blockedFrames=0,initialHeld=new Set([...r.pieces.values()].filter(p=>p.towerHeld).map(p=>p.body.handle))
 const addTide=()=>{v.cove.current=P.awardTide(v.cove.current,100)}
 const addTower=()=>{v.cove.current=P.awardTower(v.cove.current,20,50,'prize');startedTower=true}
 if(mode==='tower-first')addTower();else addTide()
 const targetLane=['left','right'].includes(mode)?mode:'center'
 function check(){ledger(h);for(const [id,p]of r.pieces){if(p.tideHeld){if(seen.has(id))assert.equal(seen.get(id),p);else seen.set(id,p)}if(seen.has(id)){assert.equal(seen.get(id),p);if(!p.tideHeld)released.add(id)}if(p.towerHeld&&!initialHeld.has(id)){if(towerSeen.has(id))assert.equal(towerSeen.get(id),p);else towerSeen.set(id,p)}if(towerSeen.has(id)){assert.equal(towerSeen.get(id),p);if(!p.towerHeld)towerReleased.add(id)}}assert.ok([...r.pieces.values()].filter(p=>!p.ball).length<=900);assert.ok([...r.pieces.values()].filter(p=>p.ball).length<=16)}
 for(;frames<18000;frames++){
  h.advance();check();let s=r.tideMachine.status(),t=r.towerMachine.status()
  if(mode==='tower-first'&&!firstId&&t.stage!=='idle'&&t.stage!=='waiting'&&t.progress>.05){addTide();firstId=-1}
  if(!selected&&s.stage==='choosing'){firstId=s.requestId;v.selectTideLane(firstId,targetLane);selected=true}
  if(mode==='tide-first'&&selected&&!startedTower&&s.batchBuilt>=3)addTower()
  if(s.released!==lastCount){lastCount=s.released;lastProgress=frames}
  if(frames%1200===0)console.log(JSON.stringify({mode,frames,tide:{stage:s.stage,released:s.released,pending:s.pending,blocked:s.blocked},tower:{stage:t.stage,released:t.released,pending:t.pending,blocked:t.blocked},drops:v.cove.current.dropped,hand:v.cove.current.hand}))
  if(selected&&s.lastCompleted?.id===firstId&&s.lastCompleted.released===100&&s.stage==='idle'&&(!startedTower||(t.stage==='idle'&&t.pending===0&&t.planned>=20&&towerReleased.size===t.planned)))break
  blockedFrames=((s.blocked&&t.stage==='idle')||(t.blocked&&s.stage==='idle'))?blockedFrames+1:0
  // Backpressure recovery uses only genuine hand and ordinary player inputs.
  if(frames>1800&&blockedFrames>=120&&frames%30===0&&v.cove.current.hand>0){v.dropOne()}
 }
 const s=r.tideMachine.status(),t=r.towerMachine.status(),result={mode,initialMedals,frames,drops:v.cove.current.dropped,hand:v.cove.current.hand,seen:seen.size,released:released.size,towerSeen:towerSeen.size,towerReleased:towerReleased.size,tide:s,tower:t,ledger:ledger(h)}
 if(!(s.lastCompleted?.id===firstId&&s.lastCompleted.released===100&&s.stage==='idle'&&(!startedTower||(t.stage==='idle'&&t.pending===0&&t.planned>=20&&towerReleased.size===t.planned)))){const T=h.load('src/store/tide.ts'),blockers=[];const loadBlocked=T.tideLoadBlocked(r.world,targetLane,body=>{const p=r.pieces.get(body.handle);if(!p||p.tideHeld||p.counted)return false;blockers.push({id:body.handle,at:body.translation(),ball:p.ball,towerHeld:p.towerHeld,reward:p.reward,tideId:p.tideId});return true});console.log('BLOCKED',JSON.stringify({...result,loadBlocked,blockers}));h.cleanup();process.exitCode=1;return}
 assert.equal(seen.size,100);assert.equal(released.size,100);if(startedTower){assert.ok(t.planned>=20,'requested20 plus any naturally earned tower awards');assert.equal(towerSeen.size,t.planned);assert.equal(towerReleased.size,t.planned);assert.equal(t.released,t.planned)}console.log('PASS',JSON.stringify(result));h.cleanup()
})().catch(e=>{console.error('FAIL',e);process.exitCode=1})
