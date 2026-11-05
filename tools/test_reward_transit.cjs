// Long actual-production end-to-end route, not a tray-approach relocation test.
// Real Practice supply + ordinary legal DROP across nine aims. No hand refill,
// force, teleport, replacement body, deletion, odds override or direct settlement.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs');
;(async()=>{
 const h=await start(),{rt,review:v}=h,D=h.load('src/store/delivery.ts'),T=h.load('src/store/tide.ts'),TRAY=h.load('src/store/dispense.ts').TRAY,stock=new Set(rt.pieces.keys()),history=new Map();
 const verify=()=>{const c=v.cove.current,q=rt.queues,t=rt.towerMachine.status(),s=rt.tideMachine.status(),a=D.deliveryLedger(c.fieldAwards,rt.counts.rewardDelivered,rt.counts.rewardCollected,rt.counts.rewardLost);D.assertDeliveryConserved(a,D.pendingMedals(c,{hoppers:q.hoppers,tower:t.pending,bucket:q.bucket,tide:s.pending}),[...rt.pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length);assert.equal(c.hand,100-c.dropped+c.won);return a};
 v.practiceState.current.enabled=true;v.command.current('jp');h.advance(12);const tideId=rt.tideMachine.status().requestId;v.selectTideLane(tideId,'center');
 let capture=null,maxMedals=0,deliveryFrame=null;
 // First real collection and delivery of the entire original award are two
 // independent milestones. A rear stop can prevent recirculation enough for
 // the first medal to arrive while later waves still wait on real traffic.
 // Keep the original 16,000-frame bound and legal input schedule for BOTH;
 // never equate first collection with a fully emptied delivery mechanism.
 for(let frame=0;frame<16000&&(!capture||deliveryFrame===null||frame<=capture.frame+60);frame++){
  if(frame>=600&&(frame-600)%40===0){v.dropOne()}
  h.advance();verify();maxMedals=Math.max(maxMedals,[...rt.pieces.values()].filter(p=>!p.ball).length);assert.ok(maxMedals<=900);
  if(rt.tideMachine.status().released===100)deliveryFrame??=frame;
  if(capture&&frame<=capture.frame+60){const p=rt.pieces.get(capture.id);assert.ok(p);assert.equal(p.body,capture.body);assert.equal(p.counted,capture.counted)}
  for(const [id,p]of rt.pieces){if(!p.reward||p.ball)continue;const at=p.body.translation();let r=history.get(id);if(!r){r={body:p.body,start:{...at},wasHeld:!!p.tideHeld,released:false,sharedStock:false,crossedBed:false,counted:false};history.set(id,r)}assert.equal(p.body,r.body,'same registered body through complete route');r.wasHeld||=!!p.tideHeld;
   if(p.tideId===tideId){r.released=true;if(at.z>0&&at.z<TRAY.back&&at.y<1.1)r.crossedBed=true;if(!r.sharedStock&&frame%15===0)rt.world.contactPairsWith(p.body.collider(0),other=>{const body=other.parent();if(body&&stock.has(body.handle))r.sharedStock=true})}
   if(p.counted&&!r.counted){r.counted=true;if(!capture&&p.tideId===tideId){const tc=rt.trayFloor.contactCollider(p.body.collider(0),.012);if(tc&&tc.distance<=.012&&tc.normal1.y>.4){assert.ok(r.wasHeld&&r.released&&r.sharedStock&&r.crossedBed,'held reservoir → real release → live stock contact → bed → actual tray');assert.ok(Math.abs(r.start.z-T.tideLaneZ('center'))<=T.TIDE.halfDepth&&r.start.y>T.TIDE.top-.1);assert.ok(at.z>=TRAY.back&&at.z<=TRAY.front);capture={id,body:p.body,frame,drops:v.cove.current.dropped,at:{...at},counted:p.counted};break}}}
  }
 }
 assert.ok(capture,'an original Tide medal must naturally reach actual tray contact under bounded legal play');assert.ok(rt.counts.rewardCollected>=1);assert.equal(rt.tideMachine.status().released,100,JSON.stringify({tide:rt.tideMachine.status(),tower:rt.towerMachine.status(),hand:v.cove.current.hand,dropped:v.cove.current.dropped}));assert.equal(v.cove.current.jpWins,0,'Practice did not fabricate an earned jackpot');
 console.log(`  original Tide body naturally reached tray after ${capture.drops} legal drops, frame ${capture.frame}; all 100 delivered at frame ${deliveryFrame} (${v.cove.current.dropped} total legal drops by completion); tray z=${capture.at.z.toFixed(3)}; max medal bodies=${maxMedals}`);
 console.log('PASS original reward body completes reservoir → live pile → actual tray without synthetic transport');h.cleanup();
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
