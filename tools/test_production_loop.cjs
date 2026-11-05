// Executes the real production rules/scene/physics loop. GPU drawing is stubbed.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs')
;(async()=>{
 const {review:v,rt,doc,advance,cleanup,load}=await start()
 const P=load('src/store/pusher.ts'),D=load('src/store/delivery.ts')
 v.cove.current={...P.awardTower(P.awardField(v.cove.current,57),65,50,'bank'),rain:57}
 let lastDelivered=0,lastCollected=0,lastLost=0
 function verify(){
  const c=v.cove.current,q=rt.queues,s=rt.towerMachine.status(),ledger=D.deliveryLedger(c.fieldAwards,rt.counts.rewardDelivered,rt.counts.rewardCollected,rt.counts.rewardLost)
  assert.equal(ledger.pending,D.pendingMedals(c,{hoppers:q.hoppers,tower:s.pending,bucket:q.bucket,tide:rt.tideMachine.status().pending}))
  assert.ok(c.fieldAwards>=122);assert.equal(c.hand,100+c.won)
  assert.ok(ledger.delivered>=lastDelivered&&ledger.collected>=lastCollected&&ledger.lost>=lastLost)
  assert.ok(ledger.pending>=0&&ledger.live>=0)
  assert.equal(ledger.live,[...rt.pieces.values()].filter(p=>p.reward&&!p.towerHeld&&!p.tideHeld&&!p.counted).length)
  lastDelivered=ledger.delivered;lastCollected=ledger.collected;lastLost=ledger.lost
  return ledger
 }
 for(let i=0;i<300;i++){advance();verify()}
 const snapshot=()=>JSON.stringify({c:v.cove.current,pieces:[...rt.pieces].map(([h,p])=>[h,p.body.translation(),p.body.rotation()]),counts:rt.counts,queues:rt.queues,tower:rt.towerMachine.status()})
 const paused=snapshot();doc.hidden=true;advance(90);assert.equal(snapshot(),paused,'hidden tabs pause the actual rules, bodies and construction')
 doc.hidden=false;v.blockedRef.current=true;advance(90);assert.equal(snapshot(),paused,'options pause the actual rules, bodies and construction')
 v.blockedRef.current=false;advance();assert.ok(v.cove.current.frame<=302,'resume cannot catch up 180 hidden frames')
 for(let i=0;i<4700;i++){advance();verify()}
 for(let i=0;i<7000&&verify().pending>0;i++){advance();verify()}
 const ledger=verify();assert.equal(ledger.delivered,v.cove.current.fieldAwards,'every committed supply, including later genuine ball awards, physically hands off');assert.ok(ledger.delivered>=122);assert.equal(ledger.pending,0);assert.equal(rt.towerMachine.status().pending,0)
 console.log('  production ledger:',JSON.stringify(ledger),'tower released:',rt.towerMachine.status().released)
 cleanup()
 console.log('PASS actual production loop preserves delivery/body reconciliation, pause/resume, and every tower/side-feed handoff')
 console.log('1/1 production-loop checks passed (GPU renderer stubbed).')
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
