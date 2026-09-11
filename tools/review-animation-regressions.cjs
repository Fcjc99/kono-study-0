// Read-only tests of the staged source; original checkout supplies unchanged imports.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const original=path.resolve(__dirname,'..');
const staged=original,ts=require(path.join(original,'node_modules/typescript'));
const {scene,Rect,Image,env}=require('./animation-audit.cjs');
Image.prototype.setDepth=function(depth){this.depth=depth;return this};
const Phaser={Geom:{Rectangle:Rect},Math:{Clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),Between:(a,b)=>Math.round((a+b)/2),FloatBetween:(a,b)=>(a+b)/2,Linear:(a,b,t)=>a+(b-a)*t,DegToRad:d=>d*Math.PI/180},Utils:{Array:{GetRandom:a=>a[0]}},BlendModes:{ADD:1,NORMAL:0}};
const cache=new Map();
function load(rel){
  if(cache.has(rel))return cache.get(rel);
  const stagedFile=path.join(staged,rel),file=fs.existsSync(stagedFile)?stagedFile:path.join(original,rel);
  const source=fs.readFileSync(file,'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext(code,{module:mod,exports:mod.exports,Math,console,require:name=>name==='phaser'?Phaser:load(path.normalize(path.join(path.dirname(rel),name+'.ts')))});
  cache.set(rel,mod.exports);return mod.exports;
}
let cases=0;
for(const type of ['Tree','Home'])for(const alphas of [[.8,.2],[.2,.8],[.5,.5]]){
  const { [type+'EvolutionSystem']:System }=load('src/game/systems/'+type+'EvolutionSystem.ts');
  const s=scene(),system=new System(s);system.create(1,'afternoon',false);system.resize(new Rect(0,0,1448,1086));system.setStage(2,true);
  const oldActive=system['active'+type],oldIncoming=system['incoming'+type];
  const stale=s.tweens.items.find(t=>t.targets===oldIncoming&&t.onComplete).onComplete;
  oldActive.alpha=alphas[0];oldIncoming.alpha=alphas[1];
  const expected=alphas[1]>alphas[0]?oldIncoming:oldActive;
  system.setStage(3,true);
  assert.equal(system['active'+type],expected,'more-visible layer must become outgoing');
  assert.notEqual(system['incoming'+type],expected,'incoming must be assigned after the reference swap');
  assert.equal(expected.alpha,Math.max(...alphas),'retarget must retain the stronger layer alpha');
  assert.equal(system['incoming'+type].alpha,0);
  assert.ok(system['incoming'+type].key.endsWith('stage-3'),'incoming layer must receive the newest texture');
  const tweens=s.tweens.items.filter(t=>t.targets===oldActive||t.targets===oldIncoming);
  assert.equal(tweens.length,2);assert.equal(tweens[0].duration,tweens[1].duration);assert.equal(tweens[0].ease,tweens[1].ease);
  const incoming=system['incoming'+type],key=incoming.key;
  stale();assert.equal(system['active'+type],expected);assert.equal(system['incoming'+type],incoming);assert.equal(incoming.key,key,'stale completion cannot restore an older texture');
  const complete=tweens.find(t=>t.onComplete);complete.targets.alpha=1;complete.onComplete();
  assert.equal(system['active'+type],incoming);assert.equal(system['active'+type].alpha,1);assert.equal(system['incoming'+type].alpha,0);
  system.setStage(2,true);
  const pending=s.tweens.items.find(t=>t.targets===system['incoming'+type]&&t.onComplete).onComplete;
  system['active'+type].alpha=.4;system['incoming'+type].alpha=.6;
  if(type==='Tree')system.setPhase('night',false);else system.setPhase('night');
  assert.equal(system['active'+type].alpha,1);assert.equal(system['incoming'+type].alpha,0);assert.ok(system['active'+type].key.includes('night-stage-2'));
  pending();assert.equal(system['active'+type].alpha,1);assert.ok(system['active'+type].key.includes('night-stage-2'),'phase interruption must invalidate old completion');cases++;
}
{
  const {TreeEvolutionSystem}=load('src/game/systems/TreeEvolutionSystem.ts');
  const samples=[1448,390].map(width=>{const s=scene(),tree=new TreeEvolutionSystem(s);tree.create(3,'afternoon',false);tree.resize(new Rect(0,0,width,width*.75));tree.setStage(4,true);const growth=s.children.list.find(x=>x.key.startsWith('petal-'));tree.spawnPersistentPetal(env);const persistent=[...tree.persistentPetals][0];return {width,growth:growth.scaleX,persistent:persistent.scaleX}});
  for(const key of ['growth','persistent'])assert.ok(Math.abs(samples[0][key]/samples[0].width-samples[1][key]/samples[1].width)<1e-12,key+' particle scaling must remain proportional');
}
{
  const {KonoMascotSystem}=load('src/game/systems/KonoMascotSystem.ts'),s=scene(),m=new KonoMascotSystem(s);
  m.sprite=new Image();m.shadow=new Image();m.resize(new Rect(0,0,1448,1086));m.position={x:.486,y:.255};m.positionVisuals();
  assert.equal(m.sprite.depth,28.18+.30+.255*.12);
  console.log('Tree destination:',JSON.stringify({x:m.sprite.x,footY:m.sprite.y,mascotHeight:m.sprite.height*m.sprite.scaleY,mascotDepth:m.sprite.depth,treeDepth:26,treeAlternateDepth:26.01}));
}
console.log(`PASS: ${cases} crossfade retarget/ordering/completion/phase-interruption cases; matched durations/easing; proportional growth and persistent particles. No staged source was edited.`);
