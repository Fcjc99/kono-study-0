// Actual production startup/capture/retry. GPU painting is stubbed; the capture
// fixture deliberately relocates one original ball and makes no natural-win claim.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs')
;(async()=>{
 let h=await start(),{rt,review:v}=h
 const balls=[...rt.pieces.values()].filter(p=>p.ball),count=balls.length
 assert.equal(count,6);assert.equal(v.cove.current.ballsStartingSupply,count)
 assert.ok(count<=16);assert.ok([...rt.pieces.values()].filter(p=>!p.ball).length<=900)
 assert.equal(v.cove.current.ballsAwarded,0);assert.equal(v.cove.current.ballsCaptured,0);assert.equal(v.cove.current.dishQueue,0);assert.equal(v.cove.current.hand,100);assert.equal(v.cove.current.fieldAwards,0)
 for(const ball of balls){assert.ok(ball.body.isDynamic());assert.equal(ball.reward,false);assert.ok(Math.abs(ball.body.collider(0).radius()-.44)<1e-7)
  rt.world.forEachCollider(c=>{if(c.handle===ball.body.collider(0).handle)return;const contact=c.contactCollider(ball.body.collider(0),.001);assert.ok(!contact||contact.distance>=-.001,'no startup ball overlap with a coin or fixture')})
 }
 h.advance(300)
 assert.equal(v.cove.current.ballsCaptured,0,'no gratuitous startup capture');assert.equal(v.cove.current.dishQueue,0)
 for(const p of balls){assert.equal(rt.pieces.get(p.body.handle),p);assert.equal(p.counted,0)}
 const ball=balls[0],id=ball.body.handle,TRAY=h.load('src/store/dispense.ts').TRAY
 ball.body.setTranslation({x:0,y:TRAY.top+.44+.001,z:(TRAY.back+TRAY.front)/2},true);ball.body.setLinvel({x:0,y:0,z:0},true)
 for(let i=0;i<30&&!ball.counted;i++)h.advance()
 assert.ok(ball.counted);assert.equal(v.cove.current.ballsCaptured,1);assert.equal(rt.pieces.get(id),ball,'capture retains same body for deferred retirement')
 assert.equal(v.cove.current.dishQueue+(v.cove.current.dish?1:0),1,'one real capture activates exactly one challenge')
 h.advance(60);assert.equal(v.cove.current.ballsCaptured,1);assert.equal(rt.pieces.get(id),ball)
 h.advance(180);assert.equal(rt.pieces.has(id),false,'original captured ball retires only after collection delay');assert.equal(v.cove.current.ballsCaptured,1)
 v.retryMachine();assert.equal(v.cove.current.ballsStartingSupply,0);assert.equal(v.cove.current.ballsCaptured,0);assert.equal(v.cove.current.ballsAwarded,0)
 h.cleanup();h=await start();assert.equal([...h.rt.pieces.values()].filter(p=>p.ball).length,count);assert.equal(h.review.cove.current.ballsStartingSupply,count);h.cleanup()
 console.log('PASS six real non-overlapping starting balls: independent budget/provenance, no initial challenge, same-body one-capture/deferred retirement, fresh-round reset (CPU/Rapier, not GPU).')
})().catch(e=>{console.error(e);process.exit(1)})
