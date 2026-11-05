// Reproduce a measured solver pinch, not an authorized initial-stock overlap.
// The two prize balls are the exact preserved production poses; no collider is
// disabled and no live target position or orientation is set after construction.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript'),R=require('@dimforge/rapier3d-compat')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(file){if(cache.has(file))return cache.get(file);const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:m,exports:m.exports,require:n=>n==='./dispense'?load('src/store/dispense.ts'):require(n),console});cache.set(file,m.exports);return m.exports}
;(async()=>{await R.init();for(const blockedDown of [false,true]){const w=new R.World({x:0,y:-22,z:0});w.timestep=1/60;w.integrationParameters.numSolverIterations=8
w.createCollider(R.ColliderDesc.cuboid(4.2,.2,5.125).setTranslation(0,-.2,-3.125));const tray=w.createCollider(R.ColliderDesc.cuboid(4.2,.15,1.3).setTranslation(0,-2.15,3.4))
const platform=blockedDown?w.createCollider(R.ColliderDesc.cuboid(.12,.03,.35).setTranslation(-1.1,.37,-1.3)):null
const balls=[[-1.5499999523162842,.7927713990211487,-1.5],[-.6000000238418579,.7930505871772766,-1.399999976158142]].map(a=>{const b=w.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(...a));w.createCollider(R.ColliderDesc.ball(.44).setFriction(.22),b);return b}),poses=balls.map(b=>JSON.stringify({p:b.translation(),q:b.rotation()}))
if(platform)balls.forEach(ball=>assert.ok((platform.contactCollider(ball.collider(0),.001)?.distance??1)>=0,'blocking platform must not overlap either preserved ball'))
const p={x:-1.0939089059829712,y:.7470143437385559,z:-1.2883291244506836},q={x:-.2083623856306076,y:.1336566060781479,z:.6684998273849487,w:.7013052701950073}
const b=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setRotation(q).setCcdEnabled(true));w.createCollider(R.ColliderDesc.cylinder(.055,.31).setDensity(1.4).setFriction(.16),b)
const piece={body:b,counted:0},pieces=new Map([[b.handle,piece]]);w.step();const motor=load('src/store/boardClear.ts').createBoardClearMachine(w,{piece:id=>pieces.get(id)}),start={...b.translation()};assert.equal(motor.begin([b.handle]),true);assert.deepEqual({...b.translation()},start)
let contactFrame=0,finished=0,peakPenetration=0,lowY=Infinity,maxTravel=0,maxPinchTravel=0,platformPenetration=0
for(let f=1;f<=5000;f++){
 if(process.env.PINCH_TRACE&&f%300===0)console.log('pinch',f,JSON.stringify(motor.status().active),JSON.stringify(b.linvel()))
 const old=pieces.has(b.handle)?{...b.translation()}:null,inPinch=old&&balls.some(ball=>(ball.collider(0).contactCollider(b.collider(0),0)?.distance??0)<0);motor.update(f);w.step();balls.forEach((ball,i)=>assert.equal(JSON.stringify({p:ball.translation(),q:ball.rotation()}),poses[i]))
 if(pieces.has(b.handle)){
  const at=b.translation();lowY=Math.min(lowY,at.y);maxTravel=Math.max(maxTravel,Math.hypot(at.x-old.x,at.y-old.y,at.z-old.z))
  if(platform){const hit=platform.contactCollider(b.collider(0),.02);if(hit)platformPenetration=Math.max(platformPenetration,-hit.distance)}
  if(inPinch)maxPinchTravel=Math.max(maxPinchTravel,Math.hypot(at.x-old.x,at.y-old.y,at.z-old.z))
  balls.forEach(ball=>{const hit=ball.collider(0).contactCollider(b.collider(0),.02);if(hit)peakPenetration=Math.max(peakPenetration,-hit.distance)})
  if(!piece.counted){const hit=tray.contactCollider(b.collider(0),.012);if(hit&&hit.distance<=.012&&hit.normal1.y>.4){piece.counted=f;contactFrame=f}}
  if(piece.counted&&f-piece.counted>90){assert.ok(contactFrame>0);w.removeRigidBody(b);pieces.delete(b.handle)}
 }
 if(motor.status().stage==='complete'){finished=f;break}
}
assert.ok(finished,JSON.stringify({status:motor.status(),q:pieces.has(b.handle)?b.rotation():null,peakPenetration}));assert.ok(contactFrame>0);assert.equal(motor.status().retired,1);assert.ok(maxTravel<.25,'normal gravity fall and transport remain bounded');assert.ok(maxPinchTravel<.05,'numerical-pinch recovery uses only a slow bounded physical slip');assert.ok(peakPenetration<.03,'solver compression remains bounded, never driven through a ball');assert.ok(platformPenetration<.005,'no recovery path cuts through the unrelated blocking platform');assert.ok(lowY<-.9,'the original really descends into the catcher')
console.log(`PASS ${blockedDown?"blocked-down alternate tangent":"downward tangent"}: same original escapes opposing fixed-ball numerical pinch, actual tray contact at ${contactFrame}, retired ${finished}; peak compression ${peakPenetration}, max step ${maxTravel}, pinched step ${maxPinchTravel}; both exact ball poses preserved`);w.free()}
})().catch(e=>{console.error(e);process.exit(1)})
