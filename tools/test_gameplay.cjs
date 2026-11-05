// Production rule/scheduling/accounting contracts. No renderer substitute.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n),Math,Number,Array,Infinity,Set,Map});return module.exports}
const P=load('src/store/pusher.ts'),D=load('src/store/delivery.ts'),S=load('src/store/dispense.ts'),fresh=()=>P.newCove(()=>.2,100,true)
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name)}
const json=x=>JSON.stringify(x)

test('more than the old mini/main capacity is retained and every activation resolves once',()=>{
 let c=fresh(),resolved=[0,0,0],seen=[-1,-1,-1],delivered=0
 for(let i=0;i<75;i++){c=P.pocket({...c,frame:c.frame+P.COMBO_GAP+1},'spin',()=>.3)}
 assert.equal(c.wheelQueue[0],75)
 for(let f=0;f<75*(P.WHEEL_FRAMES+P.WHEEL_RESULT_FRAMES+P.SPIN_FRAMES+P.REEL_RESULT_FRAMES);f++){
  c=P.step(c,()=>.3)
  for(let i=0;i<3;i++){const r=c.wheelResults?.[i];if(r&&r.at!==seen[i]){seen[i]=r.at;resolved[i]++}}
  delivered+=c.medals.filter(m=>!m.ball).length;c=P.spawned(c)
 }
 assert.deepEqual(resolved,[75,0,0]);assert.equal(c.spinsDone,75);assert.equal(c.queue,0);assert.equal(c.wheelQueue[0],0)
 assert.equal(delivered,c.fieldAwards);assert.equal(c.won,0);assert.equal(c.hand,100)
 let q=P.newCove(()=>.2)
 for(let i=0;i<25;i++)q=P.drop(q,q.checker,()=>.2)
 assert.equal(q.queue,25,'no accepted physical check becomes a silent non-activation')
})
test('Fever counts at capture time and result holds never consume a waiting entry',()=>{
 let c=fresh();for(const name of P.POCKETS)c=P.pocket(c,name,()=>.2)
 assert.equal(json(c.wheelQueue),'[1,1,1]','the trigger hit is ordinary')
 for(let i=0;i<20;i++)c=P.pocket(c,'tower',()=>.2)
 assert.equal(c.wheelQueue[2],41)
 c={...c,frame:c.fever.until};c=P.pocket(c,'tower',()=>.2);assert.equal(c.wheelQueue[2],42)
 c=P.step(c,()=>0);const start=c.wheels[2].at
 c=P.step(c,()=>0,P.WHEEL_FRAMES);assert.equal(c.wheels[2],null);assert.equal(c.wheelQueue[2],41)
 assert.equal(c.wheelResults[2].at,start+P.WHEEL_FRAMES)
 c=P.step(c,()=>0,P.WHEEL_RESULT_FRAMES-1);assert.equal(c.wheels[2],null);assert.equal(c.wheelQueue[2],41)
 c=P.step(c,()=>0);assert.ok(c.wheels[2]);assert.equal(c.wheelQueue[2],40)
})
test('50 captured balls run dish → visible result → JP → visible result with no hidden overlap',()=>{
 let c=P.settle(fresh(),0,0,50),dish=0,chance=0,results=0,delivered=0,lastResult=-1,drawnDish=-1,drawnChance=-1
 for(let f=0;f<50*(P.DISH_FRAMES+P.CHANCE_FRAMES+2*P.RESULT_FRAMES+2*P.BONUS_ARM_FRAMES+4);f++){
  c=P.step(c,()=>.14)
  assert.ok(!(c.dish&&c.chance),'exclusive presentation lane')
  assert.ok(!(c.bonusResult&&(c.dish||c.chance)),'result holds the same lane')
  if(c.dish&&c.dish.at!==drawnDish){dish++;drawnDish=c.dish.at}
  if(c.chance&&c.chance.at!==drawnChance){chance++;drawnChance=c.chance.at}
  if(c.bonusResult&&c.bonusResult.at!==lastResult){results++;lastResult=c.bonusResult.at}
  delivered+=c.medals.filter(m=>!m.ball).length;c=P.spawned(c)
  assert.equal(delivered+(c.rain??0),c.fieldAwards)
  assert.equal(c.hand,100);assert.equal(c.won,0)
 }
 assert.equal(dish,50);assert.equal(chance,50);assert.equal(results,100);assert.equal(c.ballsCaptured,50);assert.equal(c.fieldAwards,500)
 assert.equal(P.busy(c),false);assert.equal(c.dishQueue,0);assert.equal(c.chanceQueue,0)
})
test('immutable selected outcomes survive a pause and source requests do not expire without a consumer',()=>{
 let c=P.step({...fresh(),dishQueue:2},()=>.99),snapshot=json(c),calls=0
 // A pause performs no step. Rendering/read-only progress has no draw side effects.
 for(let i=0;i<1000;i++)D.ballProgress(c)
 assert.equal(json(c),snapshot)
 c=P.step(c,()=>{calls++;return .01});assert.equal(c.dish.pocket,7);assert.equal(calls,0)
 let t=P.awardTower(fresh(),45,50,'bank');t=P.awardTower(t,30)
 t=P.step(t,()=>.2,50000);assert.equal(t.towers.length,2);assert.equal(t.towers[0].source,'bank');assert.equal(t.fieldAwards,75)
})
test('full pending-work inventory includes rain, requests, held construction, bucket, inputs and balls',()=>{
 let c=fresh();c={...c,rain:13,medals:[{id:1,x:50,y:0,vx:0,vy:0},{id:2,x:50,y:-1,vx:0,vy:0},{id:3,x:50,y:0,vx:0,vy:0,ball:true}],towers:[{x:50,n:20,at:0}]}
 assert.equal(D.pendingMedals(c,{hoppers:7,tower:40,bucket:3}),84)
 const empty={input:0,medals:0,balls:0,towerBusy:false,bucketBusy:false,trayBusy:false,inFlight:false}
 assert.equal(D.hasPendingWork(fresh(),empty),false)
 for(const key of Object.keys(empty))assert.equal(D.hasPendingWork(fresh(),{...empty,[key]:typeof empty[key]==='number'?1:true}),true,key)
 assert.equal(D.hasPendingWork({...fresh(),bonusResult:{kind:'dish',pocket:0,label:'10',n:10,at:0,until:60}},empty),true)
 assert.equal(D.hasPendingWork(c,empty),true)
})
test('award → metered delivery → real collection ledger conserves blocked large payouts',()=>{
 let c=P.awardField(fresh(),321),gate=S.enqueueDispense(S.createDispenser(13),321),delivered=0,collected=0,lost=0
 for(let f=0;f<6000;f++){
  const next=S.releaseDispense(gate,f,f<200||f>400&&f<700?0:1);gate=next.state;delivered+=next.released
  if(next.released&&delivered%3===0)collected++
  if(next.released&&delivered%7===0)lost++
  const a=D.deliveryLedger(c.fieldAwards,delivered,collected,lost)
  assert.equal(a.awarded,a.pending+a.delivered);assert.equal(a.delivered,a.live+a.collected+a.lost);assert.equal(a.pending,gate.queued)
  D.assertDeliveryConserved(a,gate.queued,delivered-collected-lost)
  assert.ok(a.live>=0);assert.equal(c.hand,100);assert.equal(c.won,0)
 }
 assert.equal(delivered,321);assert.equal(gate.queued,0)
 assert.throws(()=>D.assertDeliveryConserved(D.deliveryLedger(321,321,collected,lost),1,321-collected-lost),/accounting mismatch/)
})
test('payout pools and original bonus budget stay unchanged',()=>{
 assert.equal(json(P.ODDS),json([['shower','🪙',.06],['tower','🗼',.04],['ball','🔮',.05],['step','⭐',.13],['shower','🐚',.05],['pair',null,.22]]))
 assert.equal(json(P.WHEELS.map(w=>w.map(s=>[s.kind,s.n]))),json([
 [['medals',10],['layers',2],['spin',0],['medals',20],['layers',1],['medals',6],['ball',0],['spin',0]],
 [['lamp',0],['medals',20],['layers',1],['layers',2],['ball',0],['medals',6],['lamp',0],['spin',0]],
 [['layers',2],['medals',10],['layers',4],['ball',0],['layers',1],['lamp',0],['layers',3],['medals',6]]]))
 assert.equal(json(P.DISH.map(p=>p.prize.kind==='chance'?'chance':p.prize.kind+':'+p.prize.n)),json(['medals:10','chance','medals:20','tower:30','medals:10','medals:50','medals:20','chance']))
 assert.equal(P.LAMPS,5);assert.equal(P.BANK_START,20);assert.equal(P.LAYER,5);assert.equal(P.JP_START,100);assert.equal(P.CHANCE_POCKETS,12)
})
test('production scene pauses without stepping and explicit End discloses loss rather than silently discarding',()=>{
 const scene=fs.readFileSync(path.join(root,'src/components/MedalCove.tsx'),'utf8'),app=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8')
 assert.match(scene,/if\(document.hidden\|\|blockedRef.current\|\|detailsPauseRef.current\|\|ended.current\)\{last=now;acc=0;raf=requestAnimationFrame\(tick\);return\}/)
 assert.match(scene,/pendingMedals\(c,/);assert.match(scene,/!hasPendingWork\(c,work\)/)
 assert.match(scene,/p.towerHeld/);assert.match(scene,/if\(p.reward&&!p.ball\)/)
 assert.match(scene,/One captured ball earns one challenge/);assert.match(scene,/queued=\{delivery.wheelQueue\[i\]\}/)
 assert.match(app,/End and discard pending work/);assert.match(app,/Queued bonuses, deliveries and uncollected field medals will be discarded/)
 assert.doesNotMatch(scene,/Math.round\(jpAmount\*Math.min/,'award count is not a fake time-based delivery counter')
})


test('bounded real starting balls are distinct from earned supply and each capture grants one challenge',()=>{
 const freshState=fresh(),c=P.recordStartingBalls(freshState,6),progress=D.ballProgress(c)
 assert.equal(c.ballsStartingSupply,6);assert.equal(progress.starting,6);assert.equal(progress.awarded,0)
 for(const key of ['hand','won','fieldAwards','ballsAwarded','ballsCaptured','dishQueue','chanceQueue','bank'])assert.equal(c[key],freshState[key],key)
 assert.equal(c.medals.length,0,'recording supply must not enqueue duplicate rail balls')
 assert.throws(()=>P.recordStartingBalls(c,6),/already recorded/)
 for(const n of [-1,0,3,7,16,NaN,4.5])assert.throws(()=>P.recordStartingBalls(fresh(),n),/4–6/)
 const captured=P.settle(c,0,0,6)
 assert.equal(captured.ballsCaptured,6);assert.equal(captured.dishQueue,6);assert.equal(captured.ballsAwarded,0);assert.equal(captured.ballsStartingSupply,6)
 assert.equal(P.settle(captured,0,0,0),captured)
 const reset=P.recordStartingBalls(fresh(),6)
 assert.equal(reset.ballsStartingSupply,6);assert.equal(reset.ballsCaptured,0);assert.equal(reset.dishQueue,0)
})

console.log(`${passed}/${passed} gameplay integrity checks passed.`)
