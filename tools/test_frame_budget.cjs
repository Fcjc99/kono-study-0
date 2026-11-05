const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs');
(async()=>{
 const h=await start(),B=h.load('src/store/frameBudget.ts');
 assert.equal(B.boundedAccumulator(1000,1000),B.PHYSICS_STEP_MS*2);
 assert.equal(B.mayStep(100,1,11),false);assert.equal(B.mayStep(100,0,11),true);
 assert.equal(B.mayStep(100,2,0),false);
 let previous=h.review.cove.current.frame;
 for(let i=0;i<30;i++){h.advanceMs(100);const current=h.review.cove.current.frame;assert.equal(current-previous,2,'100ms stall must not run old four-step bursts');previous=current}
 const before=previous;h.advance();assert.equal(h.review.cove.current.frame-before,1,'no catch-up debt after returning to 60Hz');
 h.doc.hidden=true;h.advanceMs(10000);assert.equal(h.review.cove.current.frame,previous+1);h.doc.hidden=false;h.advance();assert.equal(h.review.cove.current.frame,previous+2);
 assert.equal(h.review.cove.current.hand,100-h.review.cove.current.dropped+h.review.cove.current.won);
 for(const p of h.rt.pieces.values())assert.ok(Object.values(p.body.translation()).every(Number.isFinite));
 h.cleanup();console.log('PASS bounded slow-frame work, recovery, pause, ledger and finite physical poses');
})().catch(e=>{console.error(e);process.exit(1)});
