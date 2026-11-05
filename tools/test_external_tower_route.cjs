// Real production physics: construction remains off-board and the same bodies cross a clear side portal.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs');
(async()=>{
 const award=Number(process.argv[2]||20),h=await start(),T=h.load('src/store/tower.ts').TOWER,C=h.load('src/store/motion.ts').CABINET,P=h.load('src/store/pusher.ts');
 assert.ok(T.x-T.leafHalfWidth>C.halfWidth,'entire construction carriage is outside board');
 const original=new Map(),stages=new Set();let frame=0,done=false;
 h.review.cove.current=P.awardTower(h.review.cove.current,award,50,'prize');
 for(;frame<6000;frame++){
  h.advance();const s=h.rt.towerMachine.status();stages.add(s.stage);
  for(const [id,p]of h.rt.pieces){if(p.towerHeld&&p.reward)original.set(id,p.body);if(original.has(id))assert.equal(p.body,original.get(id));if(p.towerHeld&&s.stage==='building')assert.ok(p.body.translation().x-T.radius>C.halfWidth,'no construction on board')}
  if(frame%500===0)console.log('route',frame,s.stage,s.waitReason,s.released);
  if(s.released===award&&s.stage==='idle'){done=true;break}
 }
 assert.ok(done,JSON.stringify(h.rt.towerMachine.status()));assert.equal(original.size,award);for(const stage of ['building','transferring','ready','releasing','returning','homing'])assert.ok(stages.has(stage));
 const q=h.rt.queues,D=h.load('src/store/delivery.ts'),c=h.review.cove.current,a=D.deliveryLedger(c.fieldAwards,h.rt.counts.rewardDelivered,h.rt.counts.rewardCollected,h.rt.counts.rewardLost);
 D.assertDeliveryConserved(a,D.pendingMedals(c,{hoppers:q.hoppers,tower:h.rt.towerMachine.status().pending,bucket:q.bucket,tide:h.rt.tideMachine.status().pending}),[...h.rt.pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length);
 assert.equal(c.hand,100-c.dropped+c.won);console.log('PASS outside construction, continuous-body handoff, empty return and ledger',{award,stock:128,frame});h.cleanup();
})().catch(e=>{console.error(e);process.exit(1)});
