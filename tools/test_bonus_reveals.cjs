// Real decorative controller / Three scene. Does not claim a browser pixel review.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),THREE=require('three')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const req=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:req,Math,Number,Array,Map,Set,console});return module.exports}
const {createBonusReveals,edgeDuration}=load('src/store/bonusReveals.ts'),{createLocalReveals}=load('src/components/localReveals.ts')
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name)}
const tower=n=>({kind:'tower',phase:'award',magnitude:n,at:{x:-2.65,y:1.1,z:-2}})
test('minis stay local; larger committed awards have bounded mild flourishes',()=>{
 for(const n of [20,30])assert.equal(edgeDuration(tower(n)),0)
 assert.equal(edgeDuration(tower(60)),.8);assert.equal(edgeDuration(tower(85)),1.35);assert.equal(edgeDuration(tower(145)),1.35)
 assert.equal(edgeDuration({kind:'tower',phase:'release',magnitude:145}),0)
 assert.equal(edgeDuration({kind:'ball',phase:'capture'}),0)
 assert.equal(edgeDuration({kind:'clear',phase:'award'}),0)
 assert.equal(edgeDuration({kind:'clear',phase:'complete'}),1)
})
test('simultaneous award celebrations serialize; decorative overflow is bounded',()=>{
 const r=createBonusReveals();r.emit(tower(85));const first=r.current.id
 r.emit({kind:'tide',phase:'award'});r.emit({kind:'clear',phase:'complete'});r.emit(tower(60));r.emit(tower(120))
 assert.equal(r.pending,3);assert.equal(r.current.id,first)
 for(let i=0;i<28;i++)r.update(.05)
 assert.equal(r.current.kind,'tide');assert.equal(r.pending,2)
 for(let i=0;i<100;i++)r.update(.05)
 assert.equal(r.current,null);assert.equal(r.pending,0)
})
test('paused time does not progress and a hidden-tab-sized delta cannot catch up',()=>{
 const r=createBonusReveals();r.emit(tower(85));const initial=r.current.remaining
 r.update(0);r.update(-1);r.update(NaN);assert.equal(r.current.remaining,initial)
 r.update(99);assert.equal(r.current.remaining,initial-.05);r.reset();assert.equal(r.current,null)
})
test('Off removes decoration; Subtle and reduced motion never enqueue edges',()=>{
 const r=createBonusReveals(),seen=[];r.subscribeLocal(e=>seen.push(e));r.setMode('off');r.emit(tower(85));assert.equal(seen.length,0);assert.equal(r.current,null)
 r.setMode('subtle');r.emit(tower(85));assert.equal(seen.length,1);assert.equal(r.current,null)
 r.setMode('full');r.setReduced(true);r.emit(tower(85));assert.equal(seen.length,2);assert.equal(r.current,null)
 r.setReduced(false);r.emit(tower(85));assert.ok(r.current);r.setMode('off');assert.equal(r.current,null)
})
test('world accents stay at real event position, use depth testing, and dispose cleanly',()=>{
 const scene=new THREE.Scene(),r=createBonusReveals(),local=createLocalReveals(scene,r)
 r.emit(tower(20));assert.equal(scene.children.length,1);const group=scene.children[0],ring=group.children[0]
 assert.equal(group.position.x,-2.65);assert.equal(group.position.z,-2);assert.equal(ring.material.depthTest,true);assert.equal(ring.material.depthWrite,false)
 for(let i=0;i<4;i++)r.emit(tower(20));assert.equal(scene.children.length,3)
 for(let i=0;i<16;i++)local.update(.05);assert.equal(scene.children.length,0)
 r.setReduced(true);r.emit(tower(20));const quiet=scene.children[0].children[0];local.update(.05);assert.equal(quiet.scale.x,1)
 r.setMode('off');assert.equal(scene.children.length,0,'Off removes local visuals even while simulation is paused');local.update(0);local.dispose();r.setMode('full');r.emit(tower(20));assert.equal(scene.children.length,0)
})
test('overlay is pointer-inert, decorative, edge-only, and has a CSS reduced-motion fallback',()=>{
 const css=fs.readFileSync(path.join(root,'src/components/bonusReveals.css'),'utf8'),component=fs.readFileSync(path.join(root,'src/components/BonusReveals.tsx'),'utf8'),store=fs.readFileSync(path.join(root,'src/store/bonusReveals.ts'),'utf8')
 assert.match(css,/pointer-events:none!important/);assert.match(css,/width:15px/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(component,/aria-hidden="true"/)
 assert.doesNotMatch(store,/Math.random|setTimeout|setInterval|camera\.|setLinvel|settle\(/)
})
test('ceremony pose subscriptions use active time, freeze on pause and detach cleanly',()=>{
 const r=createBonusReveals();let frames=0,seen=[]
 const off=r.subscribeFrame(()=>{frames++;seen.push(r.current?.remaining)})
 r.emit(tower(85));r.update(.025);assert.equal(frames,1)
 const remaining=r.current.remaining;r.update(0);r.update(NaN);r.update(-1)
 assert.equal(frames,1);assert.equal(r.current.remaining,remaining)
 r.update(.025);assert.equal(frames,2);assert.ok(seen[1]<seen[0])
 off();r.update(.025);assert.equal(frames,2)
 const css=fs.readFileSync(path.join(root,'src/components/bonusReveals.css'),'utf8')
 assert.doesNotMatch(css,/@keyframes|animation:cove-/)
 const component=fs.readFileSync(path.join(root,'src/components/BonusReveals.tsx'),'utf8')
 assert.match(component,/reveals.subscribeFrame\(draw\)/)
 assert.match(component,/remaining\/event.duration/)
 assert.match(css,/width:56px/)
})
test('staggered event choreography expands smoothly and fades away without looping',()=>{
 const source=fs.readFileSync(path.join(root,'src/components/BonusReveals.tsx'),'utf8')
 const code=source.slice(source.indexOf('export function celebrationPose'),source.indexOf('function RewardStage'))
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,Math})
 const pose=module.exports.celebrationPose
 assert.equal(pose(0,0).opacity,0);assert.equal(pose(1,0).opacity,0)
 assert.ok(pose(.3,0).rise>pose(.1,0).rise)
 assert.ok(pose(.3,0).spread>pose(.1,0).spread)
 assert.ok(pose(.1,0).opacity>pose(.1,5).opacity)
 assert.equal(pose(.4,2).rise,pose(.4,2).rise)
})
console.log(count+' bonus reveal checks passed')
