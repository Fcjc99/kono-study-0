// Contact-driven motion regressions: real Rapier, using production material/pin settings.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const assert = require('node:assert/strict'), ts = require('typescript')
function load(file) {
 const module = { exports: {} }
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
 }).outputText, { module, exports: module.exports, Math, Number, Array, Infinity })
 return module.exports
}
const {CABINET:K,PLINKO,FIELD_MOTION:M,PIN_POSITIONS,PUSHER_SHELF:S,shelfFront,shelfCenter} = load('src/store/motion.ts')
const {COIN_MOTION:C} = load('src/store/dispense.ts')
const R = require('@dimforge/rapier3d-compat')
let passed=0
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function machine(){
 const w=new R.World(M.gravity);w.timestep=M.timestep;w.integrationParameters.numSolverIterations=M.solverIterations
 const deck=w.createCollider(R.ColliderDesc.cuboid(K.halfWidth,.2,6.8).setTranslation(0,-.2,-.8).setFriction(M.deckFriction))
 const shelf=w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,S.height/2,shelfCenter(14)))
 const face=w.createCollider(R.ColliderDesc.cuboid(S.width/2,S.height/2,S.depth/2).setFriction(M.shelfFriction),shelf)
 return {w,deck,shelf,face}
}
function coin(w,x,y,z){
 const b=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x,y,z).setLinearDamping(C.linearDamping).setAngularDamping(C.angularDamping).setCcdEnabled(true))
 const c=w.createCollider(R.ColliderDesc.cylinder(.055,.31).setDensity(1.4).setFriction(C.friction).setRestitution(C.restitution),b)
 return {b,c}
}
function cycle(m,frame){const front=shelfFront(14+16*(.5-.5*Math.cos(frame/70)));m.shelf.setNextKinematicTranslation({x:0,y:.3,z:front-S.depth/2});m.w.step()}
function planar(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
;(async()=>{await R.init()
 test('stationary flat bed: a remote medal does not drift during 30 seconds of shelf cycles',()=>{
  const m=machine(),p=coin(m.w,.7,.065,2)
  for(let i=0;i<180;i++)m.w.step()
  const start=p.b.translation();let maximum=0
  for(let i=0;i<1800;i++){cycle(m,i);maximum=Math.max(maximum,planar(start,p.b.translation()))}
  assert.ok(maximum<.005,`uncontacted medal drifted ${maximum}`)
  assert.ok(p.b.isSleeping(),'uncontacted medal naturally sleeps')
  console.log('  maximum isolated drift:',maximum.toFixed(6));m.w.free()
 })
 test('contact drive: a medal stays put until the green shelf strikes it, then advances',()=>{
  const m=machine(),p=coin(m.w,.4,.065,shelfFront(23))
  for(let i=0;i<180;i++)m.w.step()
  const start=p.b.translation();let contactFrame=-1,precontactDrift=0,maximum=0
  for(let i=0;i<440;i++){
   cycle(m,i)
   const contact=m.face.contactCollider(p.c,.025)
   if(contact&&contact.distance<=.025&&contactFrame<0)contactFrame=i
   if(contactFrame<0)precontactDrift=Math.max(precontactDrift,planar(start,p.b.translation()))
   maximum=Math.max(maximum,p.b.translation().z-start.z)
  }
  assert.ok(contactFrame>0&&contactFrame<220,'shelf actually reaches medal')
  assert.ok(precontactDrift<.01,`pre-contact drift ${precontactDrift}`)
  assert.ok(maximum>.7,`medal must move from shelf contact, moved ${maximum}`)
  console.log('  first contact frame:',contactFrame,'advance:',maximum.toFixed(4));m.w.free()
 })
 test('a resting medal stack is stable while a distant shelf moves, and wakes on a new drop',()=>{
  const m=machine(),stack=[]
  for(let layer=0;layer<4;layer++)stack.push(coin(m.w,1,.065+layer*.12,1.4))
  for(let i=0;i<240;i++)m.w.step()
  const starts=stack.map(p=>p.b.translation())
  let maximum=0
  for(let i=0;i<900;i++){cycle(m,i);stack.forEach((p,j)=>{maximum=Math.max(maximum,planar(starts[j],p.b.translation()));assert.ok(p.b.translation().y>0)})}
  assert.ok(maximum<.025,`stack creep ${maximum}`)
  assert.ok(stack.every(p=>p.b.isSleeping()),'stable stack sleeps naturally')
  coin(m.w,1.16,1.6,1.4);let woke=false
  for(let i=0;i<120;i++){cycle(m,i);woke ||= stack.some(p=>!p.b.isSleeping())}
  assert.ok(woke,'new medal contact wakes resting pieces without forced wake/velocities')
  console.log('  maximum stack drift:',maximum.toFixed(6));m.w.free()
 })
 test('all 93 source positions exit or naturally balance on a pin and release with later swept input',()=>{
  const {flipperPose}=load('src/store/flipper.ts');let balances=0;
  for(let aim=4;aim<=96;aim++){
   const x=Math.max(-K.aimHalfWidth,Math.min(K.aimHalfWidth,(aim-50)*K.aimHalfWidth/45))
   const w=new R.World(M.gravity);w.timestep=M.timestep;w.integrationParameters.numSolverIterations=M.solverIterations
   for(const wallX of [-K.boardWallX,K.boardWallX])w.createCollider(R.ColliderDesc.cuboid(.1,1.875,.3).setTranslation(wallX,(PLINKO.top+PLINKO.bottom)/2,PLINKO.z).setFriction(.5))
   const rotation={x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2}
   for(const [px,py] of PIN_POSITIONS)w.createCollider(R.ColliderDesc.cylinder(.21,.06).setTranslation(px,py,-6.15).setRotation(rotation).setFriction(.02).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(.35))
   const b=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x,PLINKO.top+.3,PLINKO.z).setRotation(rotation).enabledTranslations(true,true,false).enabledRotations(false,false,true).setLinearDamping(.05).setAngularDamping(C.angularDamping).setCcdEnabled(true))
   w.createCollider(R.ColliderDesc.cylinder(.055,.31).setDensity(1.4).setFriction(C.friction).setRestitution(C.restitution),b)
   let exit=-1
   for(let i=0;i<600;i++){w.step();if(b.translation().y<PLINKO.bottom){exit=i;break}}
   if(exit<0){
    const at=b.translation(),velocity=b.linvel();let supported=false;
    w.contactPairsWith(b.collider(0),other=>{const t=other.translation(),contact=other.contactCollider(b.collider(0),.02);if(PIN_POSITIONS.some(([px,py])=>Math.abs(t.x-px)<1e-5&&Math.abs(t.y-py)<1e-5)&&t.y<at.y&&contact&&contact.distance>-.005&&contact.distance<.02)supported=true});
    assert.ok(supported&&Math.hypot(velocity.x,velocity.y,velocity.z)<.02,'uncleared source must genuinely rest on a pin, not jam at a wall');balances++;
    // Continue with ordinary legal source drops over a complete automatic sweep.
    // Never relocate the resting original or apply a nudge/force to it.
    for(let f=0;f<960&&exit<0;f++){
     if(f<360&&f%30===0){const source=flipperPose(f,K.aimHalfWidth);const next=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(source.x,PLINKO.top+.3,PLINKO.z).setRotation(rotation).enabledTranslations(true,true,false).enabledRotations(false,false,true).setLinearDamping(.05).setAngularDamping(C.angularDamping).setCcdEnabled(true));w.createCollider(R.ColliderDesc.cylinder(.055,.31).setDensity(1.4).setFriction(C.friction).setRestitution(C.restitution),next)}
     w.step();if(b.translation().y<PLINKO.bottom)exit=600+f;
    }
   }
   assert.ok(exit>0,`source ${aim}, feed at ${x} did not reach the board bottom after subsequent physical inputs`);w.free()
  }
  console.log('  isolated pin balances released by later real source contacts:',balances)
 })
 test('production scene uses the shared fixed clock and has no buried turntable or pin kicks',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/components/MedalCove.tsx'),'utf8')
  assert.match(source,/new RAPIER.World\(FIELD_MOTION.gravity\)/)
  assert.match(source,/world.timestep=FIELD_MOTION.timestep/)
  assert.match(source,/pusherBody.translation\(\);pusherMesh.position.set/)
  assert.doesNotMatch(source,/turnBody|turnAngle|turnMesh|wantSlow|Math.random\(\)<\.5\?-1:1/)
  assert.equal(M.gravity.x,0);assert.equal(M.gravity.z,0)
 })
 console.log(`${passed}/${passed} stationary-bed/contact checks passed.`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
