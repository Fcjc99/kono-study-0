// Actual Rapier mixed-provenance stock/award construction. No GPU claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),R=require('@dimforge/rapier3d-compat')
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require,Math,Number,Array,Infinity});return module.exports}
const {TOWER:T,createTowerMachine,setBodySolverBoost}=load('src/store/tower.ts')
function fixture(capacity=900){
 const world=new R.World({x:0,y:-22,z:0});world.timestep=1/60;world.integrationParameters.numSolverIterations=8
 world.createCollider(R.ColliderDesc.cuboid(8,.2,8).setTranslation(0,-.2,0))
 let room=capacity,frame=0;const created=[],released=[]
 const tower=createTowerMachine(world,{initialStock:128,room:()=>room,createCoin(at,request){const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(at.x,at.y,at.z).setCcdEnabled(true));world.createCollider(R.ColliderDesc.cylinder(.055,.31).setFriction(.16),body);created.push({body,source:request.source,id:request.id});room--;return body},onRelease(body,request){released.push({body,source:request.source,id:request.id})}})
 function tick(n=1){for(let i=0;i<n;i++){tower.update(++frame);world.step();const s=tower.status();assert.equal(s.planned,s.queued+s.held-s.stockHeld+s.released);assert.equal(s.pending,s.queued+s.held-s.stockHeld);assert.equal(s.stockHeld+s.stockReleased,128);assert.equal(new Set(released.map(p=>p.body.handle)).size,released.length)}}
 return{world,tower,created,released,tick,setRoom:n=>room=n}
}
;(async()=>{await R.init()
 const accuracyWorld=new R.World({x:0,y:-22,z:0}),accuracyBody=accuracyWorld.createRigidBody(R.RigidBodyDesc.dynamic()),pose=accuracyBody.translation()
 setBodySolverBoost(accuracyWorld,accuracyBody,'tower-withdrawal',8);assert.equal(accuracyBody.additionalSolverIterations(),8)
 setBodySolverBoost(accuracyWorld,accuracyBody,'rear-apron',16);assert.equal(accuracyBody.additionalSolverIterations(),16)
 setBodySolverBoost(accuracyWorld,accuracyBody,'tower-withdrawal',0);assert.equal(accuracyBody.additionalSolverIterations(),16)
 setBodySolverBoost(accuracyWorld,accuracyBody,'rear-apron',0);assert.equal(accuracyBody.additionalSolverIterations(),0,'no stale tower request restored')
 setBodySolverBoost(accuracyWorld,accuracyBody,'rear-apron',16);setBodySolverBoost(accuracyWorld,accuracyBody,'tower-withdrawal',8)
 setBodySolverBoost(accuracyWorld,accuracyBody,'rear-apron',0);assert.equal(accuracyBody.additionalSolverIterations(),8,'active tower accuracy survives zone exit')
 setBodySolverBoost(accuracyWorld,accuracyBody,'tower-withdrawal',0);assert.equal(accuracyBody.additionalSolverIterations(),0)
 assert.deepEqual(accuracyBody.translation(),pose);accuracyWorld.free();console.log('PASS independent solver requests compose without stale restoration or pose changes')
 const m=fixture();const ids=m.created.map(p=>p.body.handle);let s=m.tower.status();assert.equal(s.stockHeld,128);assert.equal(s.pending,0);assert.equal(s.planned,0);assert.equal(s.stage,'idle');m.tick(30);assert.equal(m.released.length,0)
 m.tower.enqueue(20,'bank');m.tick(1000);s=m.tower.status();assert.equal(s.stockReleased,128);assert.equal(s.released,20);assert.equal(s.pending,0);assert.equal(s.stage,'idle');assert.deepEqual(m.released.filter(p=>p.source==='stock').map(p=>p.body.handle),ids);assert.equal(m.released.filter(p=>p.source==='bank').length,20)
 m.tower.enqueue(30,'prize');m.tick(2000);s=m.tower.status();assert.equal(s.stockReleased,128);assert.equal(s.released,50);assert.equal(s.pending,0);assert.equal(m.created.length,178);assert.equal(m.created.filter(p=>p.source==='stock').length,128);m.world.free();console.log('PASS stock128 + earned20 release same148 bodies; next30 has no new stock or award inflation')
 const c=fixture(131);c.tower.enqueue(20,'bank');c.tick(900);s=c.tower.status();assert.equal(s.stockReleased,128);assert.equal(s.released,3);assert.equal(s.pending,17);assert.equal(s.queued,17);c.setRoom(17);c.tick(1800);assert.equal(c.tower.status().released,20);assert.equal(c.tower.status().pending,0);c.world.free();console.log('PASS capacity-limited mixed stock/award release retains all remaining earned medals')
})().catch(e=>{console.error(e);process.exit(1)})
