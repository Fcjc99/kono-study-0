// Solver precision only: no pose/force policy and no provenance-dependent behavior.
const assert=require('node:assert/strict'),R=require('@dimforge/rapier3d-compat'),{start}=require('./production_runtime.cjs')
;(async()=>{
 const h=await start(),{rt,review:v,load}=h
 const {updateRearContactAccuracy}=load('src/store/contactAccuracy.ts'),{setBodySolverBoost}=load('src/store/tower.ts'),{BOARD_BACKSTOP:B,FIELD_MOTION}=load('src/store/motion.ts')
 assert.equal(FIELD_MOTION.solverIterations,8);assert.equal(rt.world.integrationParameters.numSolverIterations,8)
 assert.ok([...rt.pieces.values()].every(p=>p.body.additionalSolverIterations()===0),'canonical startup settle has no live rear-zone boost')
 const w=new R.World({x:0,y:-22,z:0}),body=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,2,B.z+.5)),piece={body,ball:false}
 w.createCollider(R.ColliderDesc.cylinder(.055,.31),body)
 const pose=JSON.stringify(body.translation()),velocity=JSON.stringify(body.linvel())
 updateRearContactAccuracy(w,[piece],.31);assert.equal(body.additionalSolverIterations(),24)
 assert.equal(JSON.stringify(body.translation()),pose);assert.equal(JSON.stringify(body.linvel()),velocity)
 setBodySolverBoost(w,body,'tower-withdrawal',8)
 body.setTranslation({x:0,y:2,z:B.z+1},false) // explicit isolated enter/exit fixture
 updateRearContactAccuracy(w,[piece],.31);assert.equal(body.additionalSolverIterations(),8)
 setBodySolverBoost(w,body,'tower-withdrawal',0);assert.equal(body.additionalSolverIterations(),0)
 body.setTranslation({x:0,y:2,z:B.z+.5},false);piece.ball=true
 updateRearContactAccuracy(w,[piece],.31);assert.equal(body.additionalSolverIterations(),0,'balls not silently reclassified as medals')
 w.free()
 let normalSteps=0,clearSteps=0,normalNear=0,clearNear=0
 const original=rt.world.step.bind(rt.world)
 rt.world.step=(...args)=>{
  const clearing=v.cove.current.boardClearBusy
  if(clearing)clearSteps++;else normalSteps++
  for(const p of rt.pieces.values()){
   const t=p.body.translation(),near=!p.ball&&p.body.isDynamic()&&t.z<B.z+.8&&t.y>B.bottom-.4&&t.y<B.top+.4
   if(near){assert.equal(p.body.additionalSolverIterations(),24,'actual production step receives near-zone precision before solving');if(clearing)clearNear++;else normalNear++}
  }
  return original(...args)
 }
 h.advance(10);v.practiceState.current.enabled=true;v.command.current('clear');assert.equal(v.cove.current.boardClearBusy,true);h.advance(10)
 assert.ok(normalSteps>0&&clearSteps>0&&normalNear>0&&clearNear>0)
 h.cleanup();console.log('PASS startup8, enter/exit composition, unchanged poses/velocities, and actual normal + BoardClear pre-step wiring')
})().catch(error=>{console.error(error);process.exit(1)})
