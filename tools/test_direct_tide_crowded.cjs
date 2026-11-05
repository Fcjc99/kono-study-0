const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs');
(async()=>{
 const h=await start(),r=h.rt,v=h.review,P=h.load('src/store/pusher.ts'),D=h.load('src/store/delivery.ts');
 const count=()=>[...r.pieces.values()].filter(p=>!p.ball).length;
 for(let i=0;count()<900;i++)r.addCoin(-3+(i%5)*.65,5+Math.floor(i/25)*.14,-1.2+Math.floor(i/5)%5*.65,false,0,false,true);
 assert.equal(count(),900);v.cove.current=P.awardTide(v.cove.current,25);h.advance();const id=r.tideMachine.status().requestId;v.selectTideLane(id,'center');h.advance();
 assert.equal(r.tideMachine.status().released,0);assert.equal(r.tideMachine.status().pending,25);assert.equal(count(),900);
 const snap=()=>JSON.stringify({s:r.tideMachine.status(),p:[...r.pieces.values()].map(p=>[p.body.handle,p.body.translation(),p.body.rotation()]),frame:v.cove.current.frame});const before=snap();
 h.doc.hidden=true;h.advance(60);assert.equal(snap(),before);h.doc.hidden=false;v.blockedRef.current=true;h.advance(60);assert.equal(snap(),before);v.blockedRef.current=false;
 for(let i=0;i<1500;i++){h.advance();assert.ok(count()<=900);const c=v.cove.current,q=r.queues,t=r.tideMachine.status(),ledger=D.deliveryLedger(c.fieldAwards,r.counts.rewardDelivered,r.counts.rewardCollected,r.counts.rewardLost);D.assertDeliveryConserved(ledger,D.pendingMedals(c,{hoppers:q.hoppers,tower:r.towerMachine.status().pending,bucket:q.bucket,tide:t.pending}),[...r.pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length);assert.equal(c.hand,100-c.dropped+c.won);for(const p of r.pieces.values())assert.ok(Object.values(p.body.translation()).every(Number.isFinite));}
 const s=r.tideMachine.status();assert.equal(s.planned,s.released+s.pending);assert.ok(s.released>0,'capacity clears naturally and shower resumes');assert.equal(s.gates.length+s.rails.length,0);assert.equal(r.scene.children.filter(o=>/^tide-.*-(gate|rail)$/.test(o.name)).length,0);console.log('PASS crowded900 capacity, pause/resume, finite coins, exact accounting and natural recovery',JSON.stringify({released:s.released,pending:s.pending,bodyCount:count()}));h.cleanup();
})().catch(e=>{console.error(e);process.exit(1)});
