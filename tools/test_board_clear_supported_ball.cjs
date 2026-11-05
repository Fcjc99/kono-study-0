// Independent production freeze/transport regression for a genuinely resting
// ball, not a fake fixed sphere intersecting a pile. No target is relocated,
// deleted, directly settled or given manufactured tray contact by this test.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs')
;(async()=>{
 const h=await start(),{rt,review:v}=h
 let coin=[...rt.pieces.values()].filter(p=>p.body.translation().y<.08).sort((a,b)=>Math.hypot(a.body.translation().x+3,a.body.translation().z+1)-Math.hypot(b.body.translation().x+3,b.body.translation().z+1))[0],at=coin.body.translation()
 const originalStock=new Set(rt.pieces.values())
 const startingBalls=[...rt.pieces.values()].filter(p=>p.ball)
 const ball=startingBalls[2]?.body??rt.addCoin(at.x,at.y+.055+.44+.025,at.z,true);if(!startingBalls.length)v.cove.current={...v.cove.current,ballsAwarded:1};h.advance(240)
 // A fixed animation frame is not proof of rest: the revised occupied field
 // leaves this genuinely supported ball rolling at .010236 after 240 frames.
 // Wait for 30 consecutive real physics frames below the ORIGINAL .01 limit;
 // do not zero velocity, reposition it, or relax the genuine support assertion.
 const speedAt240=Math.hypot(...Object.values(ball.linvel()));let settleFrames=0,quietFrames=0
 for(;settleFrames<1200&&quietFrames<30;settleFrames++){h.advance();quietFrames=Math.hypot(...Object.values(ball.linvel()))<.01?quietFrames+1:0}
 assert.equal(quietFrames,30,'the original dynamic ball must genuinely settle under ordinary physics')
 console.log(`  supported ball speed at frame240: ${speedAt240}; stable after ${settleFrames} additional frames`)
 const supported=[];rt.world.contactPairsWith(ball.collider(0),collider=>{const body=collider.parent(),p=body&&rt.pieces.get(body.handle);if(p&&!p.ball){const contact=p.body.collider(0).contactCollider(ball.collider(0),.012);if(contact&&contact.distance<=.012&&contact.normal1.y>.4)supported.push(p)}})
 coin=supported.find(p=>originalStock.has(p)&&!p.towerHeld&&!p.tideHeld)
 assert.ok(coin,'a genuine original stock medal must physically support the settled dynamic ball');assert.equal(ball.isDynamic(),true);assert.ok(Math.hypot(...Object.values(ball.linvel()))<.01)
 const ballPose=JSON.stringify({at:ball.translation(),q:ball.rotation()}),ballPiece=rt.pieces.get(ball.handle),targets=[...rt.pieces.values()].filter(p=>!p.ball&&!p.counted&&!p.towerHeld&&!p.tideHeld),seen=new Set(),won=v.cove.current.won,lost=v.cove.current.lost,hand=v.cove.current.hand,captured=v.cove.current.ballsCaptured,dishQueue=v.cove.current.dishQueue,rewardBefore=rt.counts.rewardCollected,awardedBefore=v.cove.current.fieldAwards
 v.practiceState.current.enabled=true;v.command.current('clear');assert.equal(v.cove.current.boardClearBusy,true);let frames=0
 for(;frames<12000&&v.cove.current.boardClearBusy;frames++){
  h.advance();assert.equal(rt.pieces.get(ball.handle),ballPiece);assert.equal(JSON.stringify({at:ball.translation(),q:ball.rotation()}),ballPose,'production holds the ball in its authentic resting pose');assert.equal(v.cove.current.ballsCaptured,captured);assert.equal(v.cove.current.dishQueue,dishQueue)
  for(const p of targets){if(!p.counted){assert.equal(rt.pieces.get(p.body.handle),p);continue}if(seen.has(p))continue;assert.equal(rt.pieces.get(p.body.handle),p);assert.ok(rt.trayCatchers.some(c=>{const contact=c.contactCollider(p.body.collider(0),.012);return contact&&contact.distance<=.012&&contact.normal1.y>.4}),'each newly counted original must actually touch tray');seen.add(p)}
  assert.equal(v.cove.current.won-won,seen.size);assert.equal(v.cove.current.lost,lost);assert.equal(rt.counts.rewardCollected-rewardBefore,[...seen].filter(p=>p.reward).length)
 }
 const s=rt.boardClearMachine.status();assert.equal(v.cove.current.boardClearBusy,false,JSON.stringify({stage:s.stage,remaining:s.remaining,blocked:s.blocked,active:s.active.slice(0,5)}));assert.equal(seen.size,targets.length);assert.ok(seen.has(coin),'the ball-supporting original medal is collected, not exempted');assert.equal(v.cove.current.hand,hand+targets.length);assert.equal(rt.counts.rewardCollected-rewardBefore,targets.filter(p=>p.reward).length,'only actual preexisting rewarded targets count as collected rewards');assert.equal(v.cove.current.fieldAwards,awardedBefore,'clearing stock never manufactures a reward award');assert.equal(ball.isDynamic(),true,'the same ball resumes ordinary physics');assert.ok(rt.clearSeeded>0);assert.equal([...rt.pieces.values()].filter(p=>!p.ball&&!p.counted&&!p.towerHeld&&!p.tideHeld).length,rt.clearSeeded)
 // Other original starting balls resume normal play too; if one is naturally
 // captured after the clear, prove its actual tray contact instead of banning
 // legitimate gameplay merely to retain the old one-ball fixture's zero total.
 const resumed=[...rt.pieces.values()].filter(p=>p.ball&&!p.counted),resumedSeen=new Set();let ballContacts=new Set()
 const accountBalls=()=>{for(const p of resumed)if(p.counted&&!resumedSeen.has(p)){assert.ok(ballContacts.has(p),'post-clear ball challenge requires actual tray contact or the preserved physical side-return rule');resumedSeen.add(p)}}
 const originalStep=rt.world.step.bind(rt.world)
 rt.world.step=(...args)=>{accountBalls();const result=originalStep(...args);ballContacts=new Set(resumed.filter(p=>!p.counted&&rt.pieces.get(p.body.handle)===p&&(h.load('src/store/dispense.ts').capturePiece(p.body.translation(),true,false)==='ball'||rt.trayCatchers.some(c=>{const contact=c.contactCollider(p.body.collider(0),.012);return contact&&contact.distance<=.012&&contact.normal1.y>.4}))));return result}
 for(let f=0;f<120;f++){h.advance();accountBalls()}
 assert.equal(rt.pieces.get(ball.handle),ballPiece);assert.equal(ballPiece.counted,0,'the original supported ball does not manufacture a challenge');assert.equal(v.cove.current.ballsCaptured,captured+resumedSeen.size);assert.equal(v.cove.current.hand,100-v.cove.current.dropped+v.cove.current.won)
 console.log(`PASS real settled ball remains intact while all ${targets.length} original live medals, including its supporting stock coin, reach actual tray once (${frames} frames); same ball resumes without a manufactured challenge`);h.cleanup();console.log('1/1 production supported-ball Board Clear regression passed (CPU/Rapier, not GPU).')
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
