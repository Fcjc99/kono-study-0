// Actual production Rapier regressions; GPU drawing alone is stubbed.
// No live medal is relocated, pushed by a test force, or given wallet credit.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs');
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name)}
const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
function ledger(h){const c=h.review.cove.current,rt=h.rt,q=rt.queues,t=rt.towerMachine.status(),s=rt.tideMachine.status(),D=h.load('src/store/delivery.ts'),a=D.deliveryLedger(c.fieldAwards,rt.counts.rewardDelivered,rt.counts.rewardCollected,rt.counts.rewardLost);D.assertDeliveryConserved(a,D.pendingMedals(c,{hoppers:q.hoppers,tower:t.pending,bucket:q.bucket,tide:s.pending}),[...rt.pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length);assert.equal(c.hand,100-c.dropped+c.won);return a}
async function run({stopped=false,award=false,drops=0,frames=1800}={}){
 const h=await start(),{rt,review:v}=h,initial=new Map([...rt.pieces].filter(([,p])=>!p.ball&&!p.towerHeld&&!p.tideHeld).map(([id,p])=>[id,{at:{...p.body.translation()},maxZ:0,maxD:0,captured:false}]));
 const edge=Math.max(...[...initial.values()].map(r=>r.at.z)),front=[...initial.values()].filter(r=>r.at.z>edge-.2);
 if(stopped)rt.pusherBody.setNextKinematicTranslation=()=>{}; // Hold the real retracted shelf, not the medals.
 if(award){v.practiceState.current.enabled=true;v.command.current('jp');h.advance(12);v.selectTideLane(rt.tideMachine.status().requestId,'center')}
 let attempts=0,maxConnectedZ=-Infinity,firstTray=null;const tideBodies=new Map();
 for(let f=0;f<frames;f++){
  if(f>=600&&attempts<drops&&(f-600)%40===0){v.dropOne();attempts++}
  h.advance();ledger(h);if(award)for(const [id,p]of rt.pieces)if(p.tideHeld&&!p.ball&&!tideBodies.has(id))tideBodies.set(id,{piece:p,body:p.body});
  for(const [id,r]of initial){const p=rt.pieces.get(id);if(!p||r.captured)continue;const at=p.body.translation();r.maxD=Math.max(r.maxD,Math.hypot(at.x-r.at.x,at.z-r.at.z));r.maxZ=Math.max(r.maxZ,at.z-r.at.z);
   if(p.counted){const tc=rt.trayFloor.contactCollider(p.body.collider(0),.012);if(tc&&tc.distance<=.012&&tc.normal1.y>.4){r.captured=true;firstTray??={id,frame:f,at:{...at}}}}
  }
  // Traverse only actual contacts from the moving shelf into ordinary stock.
  if(f%60===0){const seen=new Set(),queue=[rt.pusherBody.collider(0)];while(queue.length){const col=queue.pop();rt.world.contactPairsWith(col,other=>{const body=other.parent(),p=body&&rt.pieces.get(body.handle);if(!p||p.counted||seen.has(body.handle))return;const cp=col.contactCollider(other,.015);if(!cp||cp.distance>.015)return;seen.add(body.handle);queue.push(other);if(initial.has(body.handle))maxConnectedZ=Math.max(maxConnectedZ,initial.get(body.handle).at.z)})}}
 }
 const result={frontEdge:h.load('src/store/motion.ts').CABINET.front,seedCount:initial.size,moved:[...initial.values()].filter(r=>r.maxD>.1).length,meanZ:mean([...initial.values()].map(r=>r.maxZ)),frontN:front.length,frontMoved:front.filter(r=>r.maxD>.1).length,frontMeanZ:mean(front.map(r=>r.maxZ)),maxConnectedZ,captures:[...initial.values()].filter(r=>r.captured).length,firstTray,won:v.cove.current.won,dropped:v.cove.current.dropped,tide:rt.tideMachine.status(),ledger:ledger(h)};
 if(award){assert.equal(tideBodies.size,100,"exact authored Tide bodies observed on real gates");assert.ok([...tideBodies.values()].every(r=>r.piece.body===r.body&&!r.piece.tideHeld),"same100 bodies physically released without replacement")}
 h.cleanup();return result
}
;(async()=>{
 await test('reference starting rings and bed stock are non-overlapping and fit the real two-level field',async()=>{
  const h=await start(),M=h.load('src/store/motion.ts');let seed=17
  const rnd=()=>((seed=seed*16807%2147483647)/2147483647)
  const points=M.fieldStock(.31,M.shelfFront(30),M.CABINET.front,rnd),lower=points.filter(p=>p.y<.1)
  const ringCount=M.FIELD_TOWERS.reduce((n,t)=>n+t.layers*8,0)
  assert.equal(points.filter(p=>p.formation!==undefined).length,ringCount)
  assert.ok(points.length>ringCount&&points.length+128<=900)
  assert.ok(Math.abs(lower[0].z-.31-M.shelfFront(30)+.15)<.001)
  assert.ok(Math.min(...lower.map(p=>p.z-.31))>M.shelfFront(14))
  for(const p of points){assert.ok(p.x-.31>=-M.CABINET.wallX+.1-.001&&p.x+.31<=M.CABINET.wallX-.1+.001);assert.ok(p.z+.31<M.CABINET.front)}
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   const a=points[i],b=points[j];if(Math.abs(a.y-b.y)<.11-.001)assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>.62-.001,'no intersecting starting cylinders')
  }
  const nextRow=lower.find(p=>p.z>lower[0].z+.1);assert.ok(Math.abs(lower[0].x-nextRow.x)>.3)
  assert.equal(M.FIELD_MOTION.gravity.x,0);assert.equal(M.FIELD_MOTION.gravity.z,0)
  assert.equal(h.review.cove.current.won,0,'warm-up does not manufacture starting stock credit')
  h.cleanup()
 })
 let idle,stoppedIdle;
 await test('warm stock has no synthetic drift; only moving-shelf contacts advance the front chain',async()=>{idle=await run();stoppedIdle=await run({stopped:true});assert.equal(idle.won,idle.captures+idle.ledger.collected,'only actual initial/reward tray contacts credit idle play');assert.equal(stoppedIdle.won,0);console.log('  idle control',JSON.stringify({moving:idle,stopped:stoppedIdle}));assert.ok(idle.meanZ>stoppedIdle.meanZ+.3,'moving plate carries physicalstock beyond gravity settling');assert.ok(idle.frontMeanZ>=stoppedIdle.frontMeanZ-.005);assert.ok(idle.maxConnectedZ>idle.frontEdge-.7,'real contact chain reaches front stock near the actual lip');assert.ok(stoppedIdle.meanZ<.01);assert.ok(stoppedIdle.frontMeanZ<.01);console.log('  idle first compression:',idle.frontMeanZ.toFixed(4),'stopped:',stoppedIdle.frontMeanZ)})
 let passive,stoppedPassive;
 await test('one physical 100-medal Tide advances starting stock into actual tray contact without hand credit at release',async()=>{passive=await run({award:true,frames:3600});stoppedPassive=await run({award:true,stopped:true,frames:3600});console.log('  passive observation',JSON.stringify({captures:passive.captures,front:passive.frontMeanZ,released:passive.tide.released,stage:passive.tide.stage,stopped:stoppedPassive.captures}));assert.equal(passive.tide.released,100);assert.equal(passive.tide.pending,0);assert.ok(passive.captures>=1,'the forward Tide causes real original-stock tray contact');assert.ok(passive.moved>stoppedPassive.moved+passive.seedCount/3,'moving shelf transmits contact movement beyond forward Tide gravity');assert.ok(passive.meanZ>stoppedPassive.meanZ+.3);assert.ok(passive.frontMeanZ>=stoppedPassive.frontMeanZ-.005,'forward Tide affects the front with either shelf state; no invented capture-causality quota');assert.equal(passive.won,passive.captures+passive.ledger.collected,'stock and reward tray collections retain distinct provenance');assert.ok(passive.firstTray.at.z>passive.frontEdge);console.log('  passive Tide stock captures:',passive.captures,'front forward:',passive.frontMeanZ.toFixed(3),'stopped captures:',stoppedPassive.captures)})
 await test('ordinary legal drop play advances real stock more than stopped-shelf gravity, without forcing standing rings to collapse',async()=>{const moving=await run({award:true,drops:100,frames:4800}),stopped=await run({award:true,stopped:true,drops:100,frames:4800});assert.equal(moving.dropped,100);assert.equal(stopped.dropped,100);assert.ok(moving.moved>stopped.moved+moving.seedCount/3);assert.ok(moving.frontMoved>stopped.frontMoved);assert.ok(moving.captures>stopped.captures);assert.ok(moving.meanZ>stopped.meanZ+.3);assert.ok(moving.maxConnectedZ>moving.frontEdge-.7);assert.ok(moving.frontMeanZ>stopped.frontMeanZ+.025);console.log('  100 drops:',moving.captures,'real starting-stock captures; mean forward',moving.meanZ.toFixed(3),'; stopped captures',stopped.captures)})
 console.log(`${passed}/${passed} production pile dynamics groups passed (CPU Rapier, not GPU).`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
