const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),THREE=require('three')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const req=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:req,Math,Number,Array,Map,Set,Float32Array,console});return module.exports}
const {createBonusReveals}=load('src/store/bonusReveals.ts'),{createTowerCeremony}=load('src/components/towerCeremony.ts'),{TOWER,towerCoinSlot}=load('src/store/tower.ts')
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name)}
const status=(extra={})=>({stage:'building',blocked:false,requestId:1,batchSize:20,batchBuilt:2,supports:[{x:TOWER.x-TOWER.leafHalfWidth,y:TOWER.buildTop-TOWER.leafHalfHeight,z:TOWER.z},{x:TOWER.x+TOWER.leafHalfWidth,y:TOWER.buildTop-TOWER.leafHalfHeight,z:TOWER.z}],head:{x:TOWER.x,y:2,z:TOWER.z},...extra})
function fixture(){const scene=new THREE.Scene(),reveals=createBonusReveals(),fx=createTowerCeremony(scene,reveals);return {scene,reveals,fx,get:n=>scene.getObjectByName(n)}}
test('light rows follow real completed slot heights; do not reveal unbuilt stack',()=>{
 const {fx,get}=fixture(),rungs=get('actual-built-layer-lights'),m=new THREE.Matrix4()
 fx.update(status({batchBuilt:0}),.016);assert.equal(rungs.count,0)
 for(const n of [1,2,20,TOWER.batchMax]){fx.update(status({batchSize:n,batchBuilt:n}),.016);const ys=new Set(Array.from({length:n},(_,i)=>towerCoinSlot(i,n).y));assert.equal(rungs.count,ys.size);let i=0;for(const y of ys){rungs.getMatrixAt(i++,m);assert.ok(Math.abs(m.elements[13]-TOWER.buildTop-y)<1e-5)}}
 fx.update(status({stage:'releasing'}),.016);assert.equal(rungs.count,0);fx.dispose()
})
test('real starting stock remains legible at rest without revealing queued awards',()=>{
 const {fx,get}=fixture(),rungs=get('actual-built-layer-lights'),beads=get('moving-support-edge-lights')
 fx.update(status({stage:'idle',batchBuilt:0,batchSize:0,stockHeld:128,queued:500,head:null}),.016)
 assert.equal(rungs.count,16);assert.equal(beads.count,16)
 fx.update(status({stage:'idle',batchBuilt:0,stockHeld:0,queued:500,head:null}),.016)
 assert.equal(rungs.count,0);assert.equal(beads.count,0)
 fx.update(status({stage:'building',batchBuilt:129,stockHeld:128}),.016);assert.equal(rungs.count,17)
 fx.update(status({stage:'releasing',batchBuilt:129,stockHeld:0}),.016);assert.equal(rungs.count,0);fx.dispose()
})
test('construction tool retracts only on actual completed deposit, never below base',()=>{
 const {fx}=fixture();fx.update(status({batchBuilt:0}),.02);assert.equal(fx.toolLift,0)
 fx.update(status(),.05);assert.ok(fx.toolLift>0&&fx.toolLift<=.1)
 for(let i=0;i<8;i++)fx.update(status(),.05);assert.ok(Math.abs(fx.toolLift)<1e-9)
 fx.update(status({batchBuilt:3,blocked:true}),.05);assert.equal(fx.toolLift,0);fx.dispose()
})
test('stars require actual release event, are pooled, finite, and cannot grow scene',()=>{
 const {scene,reveals,fx,get}=fixture(),stars=get('committed-release-stars'),children=scene.children[0].children.length
 fx.update(status(),.016);reveals.emit({kind:'tower',phase:'award',at:{x:1,y:2,z:3},magnitude:72});fx.update(status(),.016);assert.equal(stars.visible,false)
 for(let i=0;i<80;i++)reveals.emit({kind:'tower',phase:'release',at:{x:1,y:2,z:3},magnitude:72})
 fx.update(status(),.016);assert.equal(stars.visible,true);assert.equal(stars.geometry.attributes.position.count,24*6);assert.equal(scene.children[0].children.length,children)
 for(let i=0;i<16;i++)fx.update(status(),.05);assert.equal(stars.visible,false);fx.dispose()
})
test('paused zero dt freezes all active stars and tool displacement',()=>{
 const {fx,reveals,get}=fixture();reveals.emit({kind:'ball',phase:'release',at:{x:1,y:2,z:3}});fx.update(status(),.03)
 const p=Array.from(get('committed-release-stars').geometry.attributes.position.array),lift=fx.toolLift
 const matrices=Array.from(get('moving-support-edge-lights').instanceMatrix.array),colors=Array.from(get('moving-support-edge-lights').instanceColor.array)
 for(let i=0;i<100;i++)fx.update(status(),0)
 assert.deepEqual(Array.from(get('committed-release-stars').geometry.attributes.position.array),p);assert.equal(fx.toolLift,lift);assert.deepEqual(Array.from(get('moving-support-edge-lights').instanceMatrix.array),matrices);assert.deepEqual(Array.from(get('moving-support-edge-lights').instanceColor.array),colors);fx.dispose()
})
test('Off clears immediately while paused; Subtle/reduced suppress travel but keep quiet progress',()=>{
 const {scene,fx,reveals,get}=fixture();fx.update(status(),.05);reveals.emit({kind:'tower',phase:'release',at:{x:1,y:2,z:3}});fx.update(status(),.03)
 reveals.setMode('off');assert.equal(scene.children[0].visible,false);assert.equal(fx.toolLift,0)
 for(const mode of ['subtle','full']){reveals.setMode(mode);reveals.setReduced(mode==='full');fx.update(status({batchBuilt:4}),.03);assert.equal(fx.toolLift,0);assert.ok(get('actual-built-layer-lights').count>0);reveals.emit({kind:'ball',phase:'release',at:{x:1,y:2,z:3}});fx.update(status(),.03);assert.equal(get('committed-release-stars').visible,false)}fx.dispose()
})
test('Tide accent requires measured opening gate movement, not requested stage alone',()=>{
 const {fx,get}=fixture(),gate=get('actual-opening-tide-gate-light'),tide=z=>({stage:'opening',blocked:false,lane:'left',gates:[{lane:'left',position:{x:-3.38,y:1.36,z},halfSize:{x:.4,y:.04,z:.76}}]})
 fx.update(status(),.016,tide(0));assert.equal(gate.visible,false)
 fx.update(status(),.016,tide(.03));assert.equal(gate.visible,true);assert.equal(gate.position.z,.79)
 for(let i=0;i<6;i++)fx.update(status(),.05,{...tide(.03),blocked:true});assert.equal(gate.visible,false);fx.dispose()
})
test('completed-layer ring rises only after an actual deposit and pauses exactly',()=>{
 const {fx,get}=fixture(),ring=get('completed-layer-rising-ring')
 fx.update(status({batchBuilt:0}),.03);assert.equal(ring.visible,false)
 fx.update(status({batchBuilt:2}),.03);assert.equal(ring.visible,true);const y=ring.position.y
 fx.update(status({batchBuilt:2}),.03);assert.ok(ring.position.y>y);const paused=ring.position.y
 fx.update(status({batchBuilt:2}),0);assert.equal(ring.position.y,paused)
 for(let i=0;i<12;i++)fx.update(status({batchBuilt:2}),.05);assert.equal(ring.visible,false);fx.dispose()
})
test('carriage trail samples measured support travel and fades at rest',()=>{
 const {fx,get}=fixture(),trail=get('measured-carriage-travel-trail'),s=status({stage:'transferring'})
 fx.update(s,.03);assert.equal(trail.visible,false)
 for(let i=0;i<3;i++){s.supports.forEach(p=>p.x+=.04);fx.update(s,.03)}
 assert.equal(trail.visible,true);const points=Array.from(trail.geometry.attributes.position.array)
 assert.ok(points[0]>points[3]);fx.update(s,0);assert.deepEqual(Array.from(trail.geometry.attributes.position.array),points)
 for(let i=0;i<8;i++)fx.update(s,.05);assert.equal(trail.visible,false);fx.dispose()
})
test('all GPU assets disposed once, subscriptions detached, no physics/random/camera code',()=>{
 const {scene,fx,reveals}=fixture(),geos=new Set(),mats=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material)})
 let disposed=0;for(const asset of [...geos,...mats])asset.addEventListener('dispose',()=>disposed++)
 fx.dispose();fx.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,geos.size+mats.size);reveals.emit({kind:'tower',phase:'release',at:{x:1,y:2,z:3}});assert.equal(scene.children.length,0)
 assert.doesNotMatch(fs.readFileSync(path.join(root,'src/components/towerCeremony.ts'),'utf8'),/Math\.random|setTimeout|setInterval|camera\.|setLinvel|createRigidBody|createCollider|settle\(/)
})
test('production wiring freezes ceremony throughout Board Clear and uses physical release callbacks',()=>{
 const source=fs.readFileSync(path.join(root,'src/components/MedalCove.tsx'),'utf8')
 assert.match(source,/towerCeremony.update\(towerState,cove.current.boardClearBusy\?0:steps\/60,tideMachine.status\(\)\)/)
 assert.match(source,/head.y\+\.16\+towerCeremony.toolLift/);assert.match(source,/towerCeremony.dispose\(\)/)
 assert.match(source,/if\(document.hidden\|\|blockedRef.current\|\|(?:detailsPauseRef.current\|\|)?ended.current\)/)
})
console.log(count+' tower ceremony checks passed')
