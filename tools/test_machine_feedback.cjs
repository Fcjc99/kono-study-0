const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),THREE=require('three')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const req=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:req,Math,Number,Array,Map,Set,Float32Array,console});return module.exports}
const {createBonusReveals}=load('src/store/bonusReveals.ts'),{createMachineFeedback,createContactBegins}=load('src/components/machineFeedback.ts')
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name)}
function fixture(){const scene=new THREE.Scene(),reveals=createBonusReveals(),fx=createMachineFeedback(scene,reveals);return {scene,reveals,fx,root:scene.children[0],trail:scene.getObjectByName('action-travelling-light')}}
const at={x:1,y:2,z:3},target={x:4,y:5,z:6}
test('committed pocket signal travels continuously from measured pocket toward wheel',()=>{
 const {fx,root,trail}=fixture();fx.cue('pocket',at,{target,color:'#ff0000',key:2});fx.update(.05)
 const first=Array.from(trail.geometry.attributes.position.array);assert.equal(trail.visible,true)
 for(let i=0;i<8;i++)fx.update(.05)
 const later=Array.from(trail.geometry.attributes.position.array);assert.notDeepEqual(first,later);assert.ok(later[42]>first[42]);assert.ok(later[42]<target.x)
 assert.equal(root.children[1].position.x,at.x);assert.equal(trail.material.depthTest,true);assert.equal(trail.material.depthWrite,false);fx.dispose()
})
test('collection ripple expands at actual contact; launch trail advances only when cued',()=>{
 const {fx,root,trail}=fixture();fx.update(.05);assert.equal(trail.visible,false)
 fx.cue('collect',at);const ring=root.children[1];fx.update(.05);const scale=ring.scale.x;fx.update(.05);assert.ok(ring.scale.x>scale);assert.equal(ring.position.x,at.x);assert.equal(ring.rotation.x,-Math.PI/2)
 for(let i=0;i<20;i++)fx.update(.05);assert.equal(trail.visible,false);assert.equal(ring.visible,false);fx.dispose()
})
test('zero delta freezes all transforms and travel positions, large delta is bounded',()=>{
 const {fx,root,trail}=fixture();fx.cue('launch',at);fx.update(.05)
 const position=Array.from(trail.geometry.attributes.position.array),scale=root.children[1].scale.clone()
 for(let i=0;i<100;i++)fx.update(0)
 assert.deepEqual(Array.from(trail.geometry.attributes.position.array),position);assert.ok(root.children[1].scale.equals(scale));fx.update(99);assert.ok(root.children[1].visible);fx.dispose()
})
test('repeated hits coalesce and sustained unique hits retain fixed pool and buffers',()=>{
 const {fx,root,trail}=fixture(),n=root.children.length,buffer=trail.geometry.attributes.position.array
 for(let i=0;i<1000;i++)fx.cue('pin',at,{key:1});assert.equal(root.children.filter(o=>o.isMesh&&o.visible).length,1)
 for(let i=0;i<1000;i++)fx.cue('pin',at,{key:i});assert.equal(root.children.length,n);assert.equal(trail.geometry.attributes.position.array,buffer);assert.equal(root.children.filter(o=>o.isMesh&&o.visible).length,24);fx.dispose()
})
test('Subtle moves less, Reduced stays still, Off clears even while paused',()=>{
 const {fx,root,trail,reveals}=fixture();reveals.setMode('subtle');fx.cue('pocket',at,{target});fx.update(.05);assert.equal(trail.visible,false);assert.ok(root.children[1].scale.x>1)
 reveals.setReduced(true);fx.cue('launch',at);fx.update(.05);assert.equal(root.children[2].scale.x,1);assert.equal(trail.visible,false)
 reveals.setMode('off');assert.equal(root.children.some(o=>o.isMesh&&o.visible),false);fx.dispose()
})
test('all pooled GPU resources dispose once and helper cannot modify gameplay or camera',()=>{
 const {fx,scene,reveals}=fixture(),assets=new Set();scene.traverse(o=>{if(o.geometry)assets.add(o.geometry);if(o.material)assets.add(o.material)})
 let n=0;assets.forEach(a=>a.addEventListener('dispose',()=>n++));fx.dispose();fx.dispose();assert.equal(n,assets.size);assert.equal(scene.children.length,0);reveals.setMode('off')
 const source=fs.readFileSync(path.join(root,'src/components/machineFeedback.ts'),'utf8');assert.doesNotMatch(source,/Math\.random|setTimeout|setInterval|camera\.|setLinvel|createRigidBody|createCollider|settle\(/)
})
test('pin begin detector emits once for resting contact and again after separation',()=>{
 const contacts=createContactBegins(),seen=[]
 for(let frame=0;frame<100;frame++){contacts.beginFrame();seen.push(contacts.contact(10,20));assert.equal(contacts.contact(10,20),false);contacts.endFrame()}
 assert.equal(seen.filter(Boolean).length,1);assert.equal(contacts.size,1)
 contacts.beginFrame();contacts.endFrame();assert.equal(contacts.size,0)
 contacts.beginFrame();assert.equal(contacts.contact(10,20),true);contacts.endFrame()
})
test('contact history freezes with paused physics, tracks while Off, and retires removed bodies',()=>{
 const contacts=createContactBegins(),{reveals,fx,root}=fixture()
 reveals.setMode('off');contacts.beginFrame();if(contacts.contact(10,20))fx.cue('pin',at);contacts.endFrame()
 assert.equal(root.children.some(o=>o.isMesh&&o.visible),false);assert.equal(contacts.size,1)
 // Paused frames never begin/end a physics-contact frame.
 for(let i=0;i<100;i++)fx.update(0)
 reveals.setMode('full');contacts.beginFrame();assert.equal(contacts.contact(10,20),false);contacts.endFrame()
 contacts.beginFrame();assert.equal(contacts.contact(11,20),true);contacts.endFrame();assert.equal(contacts.size,1)
 contacts.clear();assert.equal(contacts.size,0);fx.dispose()
})
test('contact history stays bounded under overflow and fails quiet until contacts clear',()=>{
 const contacts=createContactBegins(8)
 for(let frame=0;frame<50;frame++){contacts.beginFrame();for(let i=0;i<1000;i++){const starts=contacts.contact(i,20);if(frame>0)assert.equal(starts,false)}contacts.endFrame();assert.equal(contacts.size,8)}
 contacts.beginFrame();contacts.endFrame();assert.equal(contacts.size,0)
 contacts.beginFrame();assert.equal(contacts.contact(7,20),true);contacts.endFrame()
})
test('production tracks contact begins after real steps even with effects Off',()=>{
 const source=fs.readFileSync(path.join(root,'src/components/MedalCove.tsx'),'utf8')
 assert.match(source,/world\.step\(\)\s+contactBegins\.beginFrame\(\)/)
 assert.match(source,/pin&&contactBegins\.contact\(h,other\.handle\)&&!lookRef.current/);assert.match(source,/if\(reveals.mode!=='off'\)machineFeedback.cue\('pin'/)
 assert.match(source,/contactBegins\.endFrame\(\)/);assert.match(source,/contactBegins\.clear\(\)/)
})
console.log(count+' machine feedback transform checks passed')
