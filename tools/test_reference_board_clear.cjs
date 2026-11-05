// Actual compact default bay stock plus a crowded 900-body fixture. All original
// eligible bodies must reach real tray contact; held unawarded supply is sacred.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs')
;(async()=>{
 const h=await start(),{rt,review:v}=h,crowded=!process.env.CLEAR_DEFAULT_ONLY,started=process.cpuUsage()
 const held=[...rt.pieces.values()].filter(p=>p.towerHeld),balls=[...rt.pieces.values()].filter(p=>p.ball)
 assert.equal(balls.length,6);assert.equal(held.length,128);assert.ok(held.every(p=>!p.reward&&!p.counted))
 const ballPoses=balls.map(p=>JSON.stringify({p:p.body.translation(),q:p.body.rotation()}))
 const poses=held.map(p=>JSON.stringify({p:p.body.translation(),q:p.body.rotation()})),tower=JSON.stringify(rt.towerMachine.status())
 const initial=[...rt.pieces.values()].filter(p=>!p.ball&&!p.towerHeld)
 assert.ok(initial.length>=480,'both actual 192/288 starting rings belong to the clearable field')
 for(let i=0;crowded&&[...rt.pieces.values()].filter(p=>!p.ball).length<900;i++){
  const body=rt.addCoin(-3+(i%5)*.65,5+Math.floor(i/25)*.14,-1.2+Math.floor(i/5)%5*.65,false,0,false,true),collider=body.collider(0)
  rt.world.forEachCollider(other=>{if(other.handle===collider.handle)return;const contact=other.contactCollider(collider,.001);assert.ok(!contact||contact.distance>=-.001,'crowded fixture never starts a live medal inside held supply or cabinet solids')})
 }
 const targets=[...rt.pieces.values()].filter(p=>!p.ball&&!p.towerHeld&&!p.tideHeld),seen=new Set()
 const targetCount=crowded?772:initial.length;assert.equal(targets.length,targetCount);assert.equal([...rt.pieces.values()].filter(p=>!p.ball).length,targetCount+128)
 const initialPieces=new Set(rt.pieces.values())
 let contacts=new Set(),maxBodies=0
 const account=()=>{for(const p of targets)if(p.counted&&!seen.has(p)){assert.equal(rt.pieces.get(p.body.handle),p);assert.ok(contacts.has(p),'first credit follows immediately preceding actual top-facing tray contact');seen.add(p)}}
 const step=rt.world.step.bind(rt.world)
 rt.world.step=(...args)=>{account();const result=step(...args);contacts=new Set(targets.filter(p=>!p.counted&&rt.pieces.get(p.body.handle)===p&&rt.trayCatchers.some(c=>{const contact=c.contactCollider(p.body.collider(0),.012);return contact&&contact.distance<=.012&&contact.normal1.y>.4})));return result}
 const won=v.cove.current.won,hand=v.cove.current.hand
 v.practiceState.current.enabled=true;v.command.current('clear')
 assert.equal(v.cove.current.boardClearBusy,true);assert.equal(v.cove.current.won,won)
 let frames=0
 for(;frames<20000&&v.cove.current.boardClearBusy;frames++){
  if(process.env.CLEAR_TRACE&&frames%Number(process.env.CLEAR_TRACE_EVERY||500)===0){const s=rt.boardClearMachine.status(),cpu=process.cpuUsage(started);console.log('clear trace',JSON.stringify({frames,remaining:s.remaining,blocked:s.blocked,cpuMs:(cpu.user+cpu.system)/1000,active:s.active.slice(0,s.remaining<10?10:3).map(a=>({...a,rotation:rt.pieces.get(a.id).body.rotation()}))}))}
  h.advance();account();maxBodies=Math.max(maxBodies,[...rt.pieces.values()].filter(p=>!p.ball).length);assert.ok(maxBodies<=900)
  balls.forEach((p,i)=>{assert.equal(rt.pieces.get(p.body.handle),p);assert.equal(JSON.stringify({p:p.body.translation(),q:p.body.rotation()}),ballPoses[i])})
  assert.equal(JSON.stringify(rt.towerMachine.status()),tower)
  held.forEach((p,i)=>{assert.equal(rt.pieces.get(p.body.handle),p);assert.equal(p.towerHeld,true);assert.equal(JSON.stringify({p:p.body.translation(),q:p.body.rotation()}),poses[i])})
  for(const p of targets)if(!p.counted)assert.equal(rt.pieces.get(p.body.handle),p)
  for(const p of rt.pieces.values())if(!initialPieces.has(p)){assert.ok(targets.every(t=>rt.pieces.get(t.body.handle)!==t),'no refill before all original targets physically retire');assert.equal(p.ball,false,'Board Clear never manufactures starting balls');assert.equal(!!p.towerHeld,false,'Board Clear never manufactures bay stock')}
  assert.equal(v.cove.current.won-won,seen.size)
 }
 if(v.cove.current.boardClearBusy)for(const a of rt.boardClearMachine.status().active){const p=rt.pieces.get(a.id),contacts=[];rt.world.forEachCollider(c=>{if(c.handle===p.body.collider(0).handle)return;const contact=c.contactCollider(p.body.collider(0),.02);if(contact)contacts.push({at:c.translation(),type:c.shape.type,distance:contact.distance,normal:contact.normal1,parent:c.parent()?.bodyType()})});console.log('blocked contact evidence',JSON.stringify({...a,rotation:p.body.rotation(),contacts}))}
 assert.equal(v.cove.current.boardClearBusy,false,JSON.stringify({...rt.boardClearMachine.status(),targetIds:undefined}))
 assert.equal(seen.size,targetCount);assert.equal(v.cove.current.hand,hand+targetCount);assert.equal(rt.counts.rewardCollected,0)
 assert.equal(rt.boardClearMachine.status().retired,targetCount)
 const fresh=[...rt.pieces.values()].filter(p=>!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted)
 assert.equal(fresh.length,rt.clearSeeded);assert.ok(fresh.length>=480,'both unblocked reference ring formations return after every old target retires');assert.ok(fresh.every(p=>!p.reward),'refill is uncredited starting stock, never an earned reward')
 const motion=h.load('src/store/motion.ts'),formations=motion.FIELD_TOWERS
 for(const [formation,t] of formations.entries())for(let layer=0;layer<t.layers;layer++)for(let i=0;i<8;i++){
  const angle=i*Math.PI/4+layer*Math.PI/8,at={x:t.x+.82*Math.cos(angle),y:t.base+.055+layer*.112,z:(formation===0?rt.pusherBody.translation().z+t.z-motion.shelfCenter(14):t.z)+.82*Math.sin(angle)}
  assert.ok(fresh.some(p=>{const q=p.body.translation();return Math.hypot(q.x-at.x,q.y-at.y,q.z-at.z)<.001}),'an unblocked starting ring is reconstructed as exact ordinary medal bodies')
 }
 console.log(`PASS actual default 128 held originals and 6 prize balls unchanged; all ${targetCount} ${crowded?"crowded":"default"} live originals collected once and retired (${frames} frames, peak ${maxBodies}/900); ${fresh.length} uncredited reference refill`)
 h.cleanup()
})().catch(e=>{console.error(e);process.exit(1)})
