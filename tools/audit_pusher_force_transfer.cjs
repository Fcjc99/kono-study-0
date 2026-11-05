// Independent, observation-only whole-production physics audit. CPU Rapier, not GPU.
// No replacement body, transport impulse, teleport or ledger manipulation is used.
// The stopped control only holds the real shelf at its initial pose.
const fs=require('node:fs'),assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs');
const stopped=process.argv.includes('--stopped'),label=process.argv.find(x=>x.startsWith('--label='))?.split('=')[1]||'observation';
const frames=Number(process.argv.find(x=>x.startsWith('--frames='))?.split('=')[1]||8400);
const inputAttempts=Number(process.argv.find(x=>x.startsWith('--drops='))?.split('=')[1]||100);
const practice=!process.argv.includes('--no-award');
;(async()=>{
 const h=await start(),{rt,review:v}=h,P=h.load('src/store/pusher.ts'),D=h.load('src/store/delivery.ts');
 const initial=new Map([...rt.pieces].map(([id,p])=>[id,{start:{...p.body.translation()},maxD:0,maxZ:0,end:null,terminal:null}]));
 const seeds=[...initial.values()],maxInitialZ=Math.max(...seeds.map(p=>p.start.z));
 const frontIds=new Set([...initial].filter(([,p])=>p.start.z>maxInitialZ-.2).map(([id])=>id));
 if(stopped){const at={...rt.pusherBody.translation()};rt.pusherBody.setNextKinematicTranslation=()=>{};rt.pusherBody.setTranslation(at,true)}
 const rewards=new Map(),batches=[];let attempted=0,seedCaptured=0,seedLost=0,maxLive=0, maxReach=-Infinity,pusherContacts=new Set(),maxConnected=0,maxReachInitialZ=-Infinity,firstRewardCapture=null;
 let tideId=null;
 function audit(frame){
  const c=v.cove.current,q=rt.queues,t=rt.towerMachine.status(),s=rt.tideMachine.status();
  const ledger=D.deliveryLedger(c.fieldAwards??0,rt.counts.rewardDelivered,rt.counts.rewardCollected,rt.counts.rewardLost);
  D.assertDeliveryConserved(ledger,D.pendingMedals(c,{hoppers:q.hoppers,tower:t.pending,bucket:q.bucket,tide:s.pending}),[...rt.pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length);assert.equal(c.hand,100-c.dropped+c.won);
  maxLive=Math.max(maxLive,rt.pieces.size);
  for(const [id,p]of rt.pieces){const at=p.body.translation();assert.ok([at.x,at.y,at.z].every(Number.isFinite));let r=initial.get(id);
   if(r&&!r.terminal){r.end={...at};if(p.counted){r.terminal={at:{...at},frame,kind:Math.abs(at.x)<=5.3&&at.z>=6.0?'collected':'lost'};if(r.terminal.kind==='collected')seedCaptured++;else seedLost++}else{r.maxD=Math.max(r.maxD,Math.hypot(at.x-r.start.x,at.z-r.start.z));r.maxZ=Math.max(r.maxZ,at.z-r.start.z)}}
   if(p.reward&&!p.ball){let w=rewards.get(id);if(!w){w={id,tideId:p.tideId,start:{...at},minZ:at.z,maxZ:at.z,deck:false,terminal:null};rewards.set(id,w)}if(p.tideId!==undefined)w.tideId=p.tideId;w.minZ=Math.min(w.minZ,at.z);w.maxZ=Math.max(w.maxZ,at.z);w.end={...at};if(!p.towerHeld&&!p.tideHeld&&at.y<1.1&&at.z<6&&at.z>-7.6)w.deck=true;if(p.counted&&!w.terminal){w.terminal={frame,at:{...at},kind:Math.abs(at.x)<=5.3&&at.z>=6.0?'collected':'lost',trayContact:!!rt.trayFloor.contactCollider(p.body.collider(0),.012)};if(w.terminal.kind==='collected'&&firstRewardCapture===null)firstRewardCapture={frame,id,tideId:p.tideId,at:{...at}}}}
  }
  if(frame%30===0){const seen=new Set(),queue=[rt.pusherBody.collider(0)];while(queue.length){const col=queue.pop();rt.world.contactPairsWith(col,other=>{const body=other.parent(),piece=body&&rt.pieces.get(body.handle);if(!piece||piece.counted||seen.has(body.handle))return;const contact=col.contactCollider(other,.015);if(!contact||contact.distance>.015)return;seen.add(body.handle);queue.push(other);if(col.handle===rt.pusherBody.collider(0).handle)pusherContacts.add(body.handle);const init=initial.get(body.handle);if(init)maxReachInitialZ=Math.max(maxReachInitialZ,init.start.z)})}maxConnected=Math.max(maxConnected,seen.size);maxReach=Math.max(maxReach,...[...seen].map(id=>rt.pieces.get(id).body.translation().z));}
  if(frame%1200===0||frame===frames){const a=[...initial.values()],front=[...frontIds].map(id=>initial.get(id));const summarize=xs=>({n:xs.length,moved01:xs.filter(r=>r.maxD>.1).length,moved31:xs.filter(r=>r.maxD>.31).length,meanMaxD:xs.reduce((s,r)=>s+r.maxD,0)/xs.length,meanMaxZ:xs.reduce((s,r)=>s+r.maxZ,0)/xs.length,captured:xs.filter(r=>r.terminal?.kind==='collected').length});const batch={frame,attempted,dropped:c.dropped,hand:c.hand,won:c.won,lost:c.lost,ledger,tide:{stage:s.stage,released:s.released,pending:s.pending},seeds:summarize(a),front:summarize(front),maxConnected,maxReach,maxReachInitialZ,tideCollected:[...rewards.values()].filter(r=>r.tideId===tideId&&r.terminal?.kind==='collected').length};batches.push(batch);console.log(JSON.stringify(batch))}
 }
 if(practice){v.practiceState.current.enabled=true;v.command.current('jp');h.advance(12);tideId=rt.tideMachine.status().requestId;v.selectTideLane(tideId,'center')}
 audit(0);
 for(let f=1;f<=frames;f++){
  // Identical legal input attempt schedule for moving/stopped arms. Never refill hand.
  if(f>=600&&attempted<inputAttempts&&(f-600)%40===0){v.dropOne();attempted++}
  h.advance();audit(f);
 }
 const result={label,stopped,practice,frames,inputAttempts,seedCount:initial.size,frontCount:frontIds.size,seedCaptured,seedLost,maxLive,pusherContactCount:pusherContacts.size,firstRewardCapture,batches,rewards:[...rewards.values()]};
 fs.writeFileSync(`/tmp/pusher-audit-${label}-${stopped?'stopped':'moving'}.json`,JSON.stringify(result,null,2));h.cleanup();
})().catch(e=>{console.error(e);process.exit(1)});
