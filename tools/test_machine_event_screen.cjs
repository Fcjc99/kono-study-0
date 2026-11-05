const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),THREE=require('three')
const root=path.resolve(__dirname,'..'),cache=new Map(),calls=[]
const gradient={addColorStop(){}};const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get(o,k){return o[k]??((...a)=>calls.push([k,...a]))},set(o,k,v){o[k]=v;return true}})
const images=[];const document={createElement:tag=>{if(tag==='img'){const image={complete:true,naturalWidth:960,naturalHeight:320,onload:null};images.push(image);return image}return {width:0,height:0,getContext:()=>ctx}}}
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const req=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:req,Math,Number,Array,Map,Set,console,document});return module.exports}
const {createBonusReveals}=load('src/store/bonusReveals.ts'),{createScreenTimeline,screenMotion,screenCaption,screenCharacterPose,createMachineEventScreen}=load('src/components/machineEventScreen.ts')
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name)}
const tower={kind:'tower',phase:'award',magnitude:100}
test('actual events including unlocated Tide and clear reach all-event observers once',()=>{const r=createBonusReveals(),events=[];const off=r.subscribeEvent(e=>events.push(e));r.emit(tower);r.emit({kind:'tide',phase:'award',magnitude:100});r.emit({kind:'clear',phase:'complete'});assert.equal(events.length,3);off();r.emit(tower);assert.equal(events.length,3)})
test('timeline preserves exact award value, ignores physical release spam and bounds backlog',()=>{const s=createScreenTimeline();s.emit(tower);s.emit({kind:'tower',phase:'release'});assert.equal(s.pending,0);assert.equal(s.current.magnitude,100);for(let i=0;i<50;i++)s.emit({kind:'ball',phase:'capture'});assert.equal(s.pending,3);for(let i=0;i<73;i++)s.update(.05);assert.equal(s.current.kind,'ball');assert.equal(s.pending,2)})
test('simulation delta freezes while paused and cannot catch up from hidden wall time',()=>{const s=createScreenTimeline();s.emit(tower);for(const dt of [0,-1,NaN])s.update(dt);assert.equal(s.age,0);s.update(999);assert.equal(s.age,.05);s.reset();assert.equal(s.current,null);assert.equal(s.pending,0)})
test('reduced motion is static and Subtle is slower, captions distinguish pending from wallet credit',()=>{assert.equal(screenMotion(2,'full',true),0);assert.equal(screenMotion(2,'off',false),0);assert.equal(screenMotion(2,'subtle',false),.5);assert.equal(screenMotion(2,'full',false),2);assert.match(screenCaption(tower).detail,/100 medals queued/);assert.match(screenCaption({kind:'tide',phase:'award',magnitude:100}).detail,/100 medals queued/)})
test('in-world display renders committed animation, freezes exactly and survives edge notifications',()=>{const scene=new THREE.Scene(),r=createBonusReveals(),s=createMachineEventScreen(scene,r);assert.equal(scene.children.length,1);r.emit(tower);assert.equal(s.timeline.current.kind,'tower');s.update(.05);const textCalls=calls.filter(c=>c[0]==='fillText');assert.ok(textCalls.every(c=>c[3]<=104),'all meaningful text stays in upper third');const first=JSON.stringify(calls);calls.length=0;s.update(0);assert.equal(calls.length,0);for(let i=0;i<10;i++)s.update(.05);assert.notEqual(JSON.stringify(calls),first);assert.equal(s.timeline.current.magnitude,100);assert.equal(s.group.position.z,-6.24);assert.equal(s.group.position.y,3.75);assert.equal(s.group.children[1].material.depthTest,true);r.setMode('off');s.update(0);assert.equal(s.timeline.current,null);s.dispose()})
test('reduced tower keeps all ten rings inside canvas and texture stays unchanged across steps',()=>{const scene=new THREE.Scene(),r=createBonusReveals(),s=createMachineEventScreen(scene,r);r.setReduced(true);calls.length=0;r.emit(tower);s.update(.05);const ellipses=calls.filter(c=>c[0]==='ellipse');assert.ok(ellipses.length>=30);const medalPositions=calls.filter(c=>c[0]==='translate'&&c[1]===623);assert.equal(medalPositions.length,10);for(const c of medalPositions){assert.ok(c[2]-26>0);assert.ok(c[2]+26<320)}calls.length=0;for(let i=0;i<20;i++)s.update(.05);assert.equal(calls.length,0);s.dispose()})
test('all resources and subscriptions dispose exactly once with no gameplay dependencies',()=>{const scene=new THREE.Scene(),r=createBonusReveals(),s=createMachineEventScreen(scene,r),assets=new Set();s.group.traverse(o=>{if(o.geometry)assets.add(o.geometry);if(o.material){assets.add(o.material);if(o.material.map)assets.add(o.material.map)}});let n=0;assets.forEach(a=>a.addEventListener('dispose',()=>n++));s.dispose();s.dispose();assert.equal(n,assets.size);assert.equal(scene.children.length,0);r.emit(tower);assert.equal(s.timeline.current,null);assert.doesNotMatch(fs.readFileSync(path.join(root,'src/components/machineEventScreen.ts'),'utf8'),/Math\.random|setInterval|setTimeout|setLinvel|createRigidBody|createCollider|settle\(/)})
test('character performs distinct event actions from real frames with static reduced/off poses',()=>{
 const kinds=[null,'tower','tide','ball','clear'];
 for(const kind of kinds){
  const a=screenCharacterPose(kind,.2,'full',false),b=screenCharacterPose(kind,1.3,'full',false);assert.notDeepEqual(a,b);
  assert.deepEqual(screenCharacterPose(kind,.2,'off',false),screenCharacterPose(kind,1.3,'off',false));
  assert.deepEqual(screenCharacterPose(kind,.2,'full',true),screenCharacterPose(kind,1.3,'full',true));
  for(let age=0;age<=3.6;age+=.05){const p=screenCharacterPose(kind,age,'full',false);assert.ok(p.frame>=0&&p.frame<4);assert.ok(p.x-115>=0&&p.x+115<1024);assert.ok(p.y-220>=0&&p.y+20<=320)}
 }
});
test('cached real sprites render, idle is frame-bounded and dispose removes image callbacks',()=>{
 calls.length=0;const scene=new THREE.Scene(),r=createBonusReveals(),s=createMachineEventScreen(scene,r);
 assert.equal(images.slice(-3).length,3);assert.ok(calls.some(c=>c[0]==='drawImage'));
 calls.length=0;s.update(0);assert.equal(calls.length,0);for(let i=0;i<60;i++)s.update(1/60);
 assert.ok(calls.filter(c=>c[0]==='drawImage'&&c.length===10).length<=12);
 calls.length=0;r.emit({kind:'tide',phase:'award',magnitude:100});s.update(.05);assert.ok(calls.some(c=>c[0]==='drawImage'));
 s.dispose();assert.ok(images.slice(-3).every(i=>i.onload===null));
});
console.log(checks+' event screen checks passed')
const {paintSanctuaryScene}=load('src/components/machineEventScreen.ts');
test('shared bonus painter freezes Off and changes actual full-motion frames without awards',()=>{
 const sprites=new Map(['breathe','wave','cheer'].map(n=>[n,{complete:true,naturalWidth:960}]));
 const snapshot=(age,mode,reward)=>{calls.length=0;paintSanctuaryScene(ctx,{kind:reward==='tower'?'tower':reward==='portal'?'tide':'ball',phase:'award'},age,mode,false,sprites,false,reward);return JSON.stringify(calls)};
 for(const reward of ['coins','tower','portal']){assert.equal(snapshot(.1,'off',reward),snapshot(1.1,'off',reward));assert.notEqual(snapshot(.1,'full',reward),snapshot(1.1,'full',reward))}
});
test('character-first cinema has no prose column and at most one compact event badge',()=>{
 const {paintSanctuaryScene}=load('src/components/machineEventScreen.ts');
 for(const event of [null,tower,{kind:'ball',phase:'capture'},{kind:'clear',phase:'complete'}]){
  calls.length=0;paintSanctuaryScene(ctx,event,1,'full',false,new Map());
  const text=calls.filter(c=>c[0]==='fillText');assert.ok(text.length<=1);assert.ok(text.every(c=>String(c[1]).length<20));
  assert.ok(calls.some(c=>c[0]==='scale'&&c[1]===1&&c[2]===1),'foreground fits complete 1024 by 320 stage');
 }
})

test('responsive stage fits phone, sidebar and wide screens without cutting off KONO',()=>{
 const {paintSanctuaryScene,CINEMA_ASSETS}=load('src/components/machineEventScreen.ts');
 assert.equal(Object.keys(CINEMA_ASSETS).length,5);assert.ok(fs.statSync(path.join(root,'public'+CINEMA_ASSETS.backdrop)).size<500000);
 for(const width of [280,320,390,720,1000]){
  const height=Math.round(1024*122/width),fit=Math.min(1,height/320);
  calls.length=0;paintSanctuaryScene(ctx,null,2,'full',false,new Map(),false,undefined,{width:1024,height});
  assert.ok(calls.some(c=>c[0]==='scale'&&c[1]===fit&&c[2]===fit));
  for(const kind of [null,'tower','tide','ball','clear'])for(let t=0;t<10;t+=.1){const p=screenCharacterPose(kind,t,'full',false);const x=(1024-1024*fit)/2+p.x*fit,y=(height-320*fit)/2+p.y*fit;assert.ok(x-120*fit>=0&&x+120*fit<=1024);assert.ok(y-220*fit>=0&&y+22*fit<=height)}
 }
 const start=screenCharacterPose(null,0,'full',false),roam=screenCharacterPose(null,5,'full',false);assert.ok(Math.abs(start.x-roam.x)>150,'idle includes visible exploration, not a two-pixel breath');
});
