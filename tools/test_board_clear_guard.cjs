// Exact measured clear stall: a medal beside the guard, below two protected
// balls. It needs a lower swept exit, not a contact exemption or teleport.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript'),R=require('@dimforge/rapier3d-compat')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(file){if(cache.has(file))return cache.get(file);const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:m,exports:m.exports,require:n=>n==='./dispense'?load('src/store/dispense.ts'):require(n),console});cache.set(file,m.exports);return m.exports}
;(async()=>{await R.init();for(const height of [.40,.44088125228881836,.46,.4859129786491394]){const w=new R.World({x:0,y:-22,z:0});w.timestep=1/60;w.integrationParameters.numSolverIterations=8
 const floor=w.createCollider(R.ColliderDesc.cuboid(4.2,.2,5.125).setTranslation(0,-.2,-3.125)),guard=w.createCollider(R.ColliderDesc.cuboid(.1,1.2,3.325).setTranslation(-4.05,1,-1.325)),tray=w.createCollider(R.ColliderDesc.cuboid(4.2,.15,1.3).setTranslation(0,-2.15,3.4))
 const balls=[[-3.1500000953674316,.7933129072189331,-.6000000238418579],[-3.1500000953674316,.7934291362762451,.3499999940395355]].map(p=>{const b=w.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(...p));w.createCollider(R.ColliderDesc.ball(.44).setFriction(.22),b);return b}),poses=balls.map(b=>JSON.stringify({p:b.translation(),q:b.rotation()}))
 const start={x:height>.45?-3.639955759048462:-3.6389553546905518,y:height,z:height>.45?-.14234933257102966:-.13790017366409302},rotation=height>.45?{x:0,y:0,z:0,w:1}:{x:.002907032845541835,y:.9397287368774414,z:-.001918257912620902,w:-.34190335869789124}
 const b=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(start.x,start.y,start.z).setRotation(rotation).setCcdEnabled(true));w.createCollider(R.ColliderDesc.cylinder(.055,.31).setDensity(1.4).setFriction(.16),b)
 const piece={body:b,counted:0},pieces=new Map([[b.handle,piece]]);for(const c of [floor,guard,...balls.map(b=>b.collider(0))])assert.ok((c.contactCollider(b.collider(0),.01)?.distance??1)>=0,'raw fixture begins without overlap before any physics step');w.step();const initial={...b.translation()},m=load('src/store/boardClear.ts').createBoardClearMachine(w,{piece:id=>pieces.get(id)})
 for(const c of [floor,guard,...balls.map(b=>b.collider(0))])assert.ok((c.contactCollider(b.collider(0),.01)?.distance??1)>=0,'fixture begins without overlapping any solid')
 m.begin([b.handle]);assert.deepEqual({...b.translation()},initial);let contact=0,finished=0,maxStep=0,maxDepth=0,lowExit=false
 for(let f=1;f<=2500;f++){const old=pieces.has(b.handle)?{...b.translation()}:null;m.update(f);w.step();balls.forEach((b,i)=>assert.equal(JSON.stringify({p:b.translation(),q:b.rotation()}),poses[i]))
  if(pieces.has(b.handle)){const at=b.translation();maxStep=Math.max(maxStep,Math.hypot(at.x-old.x,at.y-old.y,at.z-old.z));if(at.y<.3&&at.z<1)lowExit=true
   for(const c of [floor,guard,...balls.map(b=>b.collider(0))])maxDepth=Math.max(maxDepth,-(c.contactCollider(b.collider(0),.01)?.distance??0))
   const hit=tray.contactCollider(b.collider(0),.012);if(!piece.counted&&hit&&hit.distance<=.012&&hit.normal1.y>.4){piece.counted=f;contact=f}
   if(piece.counted&&f-piece.counted>90){w.removeRigidBody(b);pieces.delete(b.handle)}
  }
  if(m.status().stage==='complete'){finished=f;break}
 }
 assert.ok(finished,JSON.stringify(m.status()));assert.ok(lowExit,'original medal physically takes the lower exit beneath preserved balls');assert.ok(contact>0);assert.equal(m.status().retired,1);assert.ok(maxStep<.25);assert.ok(maxDepth<.005,'no escape drives through the floor, wall or balls')
 console.log(`PASS guard/two-ball overhang at ${height}: same original takes swept lower exit, real tray contact ${contact}, retirement ${finished}; maximum solid compression ${maxDepth}, step ${maxStep}; both ball poses exact`);w.free()}
})().catch(e=>{console.error(e);process.exit(1)})
