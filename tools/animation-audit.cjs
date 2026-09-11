// Read-only regression probes against the production TypeScript implementation.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
class Rect {
  constructor(x=0,y=0,width=0,height=0){this.setTo(x,y,width,height)}
  setTo(x,y,width,height){Object.assign(this,{x,y,left:x,top:y,width,height});return this}
}
class Image {
  constructor(x=0,y=0,key=''){Object.assign(this,{x,y,key,width:64,height:64,scaleX:1,scaleY:1,alpha:1,visible:true,active:true,data:{}})}
  setOrigin(){return this} setDepth(){return this} setTint(){return this} setInteractive(){return this} setBlendMode(){return this} setFlipX(){return this} on(){return this} removeAllListeners(){return this}
  setPosition(x,y){Object.assign(this,{x,y});return this}
  setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this}
  setAlpha(alpha){this.alpha=alpha;return this}
  setAngle(angle){this.angle=angle;return this}
  setVisible(visible){this.visible=visible;return this}
  setTexture(key){this.key=key;return this}
  setDisplaySize(w,h){return this.setScale(w/this.width,h/this.height)}
  setData(k,v){this.data[k]=v;return this} getData(k){return this.data[k]}
  destroy(){this.active=false}
}
const fakeMath=Object.create(Math);
const Phaser={Geom:{Rectangle:Rect},Math:{Clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),Between:(a,b)=>Math.round((a+b)/2),FloatBetween:(a,b)=>(a+b)/2,Linear:(a,b,t)=>a+(b-a)*t,DegToRad:d=>d*Math.PI/180},Utils:{Array:{GetRandom:a=>a[0]}},BlendModes:{ADD:1,NORMAL:0}};
function scene(){
  const list=[],tweens=[],timers=[];
  return {children:{list},textures:{exists:()=>true},add:{image:(...args)=>{const x=new Image(...args);list.push(x);return x}},time:{now:0,addEvent:c=>{const t={...c,destroy(){},remove(){}};timers.push(t);return t},delayedCall:(delay,callback)=>{const t={delay,callback,remove(){}};timers.push(t);return t}},tweens:{items:tweens,add:c=>{tweens.push(c);return c},killTweensOf:target=>{const targets=Array.isArray(target)?target:[target];for(let i=tweens.length-1;i>=0;i--)if(targets.includes(tweens[i].targets))tweens.splice(i,1)}},game:{events:{on(){},off(){}}}};
}
const cache=new Map();
function load(rel){
  if(cache.has(rel))return cache.get(rel);
  const file=path.join(root,rel);
  const stagedNames=['KonoMascotSystem.ts','PondEvolutionSystem.ts','TreeEvolutionSystem.ts'];
  const staged=process.env.KONO_ANIMATION_STAGED==='1'&&stagedNames.includes(path.basename(rel));
  let source=fs.readFileSync(staged?path.join(__dirname,'patches',path.basename(rel)):file,'utf8');
  if(rel.endsWith('KonoMascotSystem.ts'))source+='\nexport {NAV_NODES,NAV_GRAPH,isWalkablePoint};';
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext(code,{module:mod,exports:mod.exports,Math:fakeMath,console,require:name=>name==='phaser'?Phaser:load(path.relative(root,path.resolve(path.dirname(file),name+'.ts')))});
  cache.set(rel,mod.exports);return mod.exports;
}
const {KonoMascotSystem,NAV_NODES,NAV_GRAPH,isWalkablePoint}=load('src/game/systems/KonoMascotSystem.ts');
function mascot(phase='afternoon'){
  const s=scene(),m=new KonoMascotSystem(s);
  m.sprite=new Image();m.shadow=new Image();m.phase=phase;m.nextWanderAt=Infinity;
  m.resize(new Rect(0,0,1448,1086));
  return {m,s};
}
const env={phase:'afternoon',precipitation:0,weatherShade:0,snowIntensity:0,wind:0};
module.exports={load,mascot,scene,Rect,Image,env,NAV_NODES,NAV_GRAPH,isWalkablePoint,fakeMath};
if(require.main===module){
const edgePairs=[];
for(const [a,bs]of Object.entries(NAV_GRAPH))for(const b of bs)if(a<b)edgePairs.push([a,b]);
let unsafeConnections=[];
for(const [a,b]of edgePairs)for(let sample=0;sample<=100;sample++){
  const t=sample/100,p={x:NAV_NODES[a].x*(1-t)+NAV_NODES[b].x*t,y:NAV_NODES[a].y*(1-t)+NAV_NODES[b].y*t};
  const {m}=mascot();m.position=p;
  const c=m.closestNode(p),q=NAV_NODES[c];
  for(let i=0;i<=100;i++){
    const u=i/100;
    if(!isWalkablePoint({x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u})){unsafeConnections.push({a,b,t,nearest:c,p});break}
  }
}
console.log('Mid-edge nearest-node pond collisions:',unsafeConnections.length,JSON.stringify(unsafeConnections.slice(0,3)));
// Exercise all full routes with forced destinations and a strict travel bound.
{
  let failed=0,unsafe=0,maxFrames=0;
  for(const a of Object.keys(NAV_NODES))for(const b of Object.keys(NAV_NODES)){
    const {m}=mascot();m.position={...NAV_NODES[a]};m.forcedTarget=true;m.navigateToNode(b);
    let frames=0;
    for(;frames<7200;frames++){
      m.update(frames*1000/60,1/60,env);
      if(!isWalkablePoint(m.position))unsafe++;
      if(Math.hypot(m.position.x-NAV_NODES[b].x,m.position.y-NAV_NODES[b].y)<.000001&&m.route.length===0)break;
    }
    if(frames===7200)failed++;maxFrames=Math.max(maxFrames,frames);
  }
  console.log('All endpoint routes:',JSON.stringify({failed,unsafe,maxFrames}));
}
{
  const {m}=mascot();m.position={...NAV_NODES['west-junction']};m.target={x:m.position.x+.0059,y:m.position.y};
  const start=m.position.x;m.update(0,0,env);
  console.log('Mascot movement on zero dt at arrival pixels:',(m.position.x-start)*1448);
}
// At a settled evening node, idle texture must not be rerolled each update.
{
  const {m}=mascot('evening');m.position={...NAV_NODES['west-junction']};m.target={...m.position};m.route=[];m.destinationNode=null;
  let frame=0;fakeMath.random=()=>frame++%2===0?.1:.9;
  const textures=[];for(let i=0;i<6;i++){m.update(i*16,.016,{...env,phase:'evening'});textures.push(m.currentTexture)}
  console.log('Evening stationary frames:',textures.join(', '));
  fakeMath.random=()=>.99;
}
// A pointer reaction should not erase a pending destination action.
{
  const {m,s}=mascot();
  m.handleInteraction({type:'start',action:{id:'cherry-read',landmarkId:'cherry',phase:'afternoon'}});
  const before=m.pendingReaction;m.beginReaction('kono-happy',1250);
  console.log('Pointer reaction destroys queued destination reaction:',before,'=>',m.pendingReaction);
}
// Derive physical ratios from actual sprite scaling.
{
  const {m}=mascot();
  const samples=[1448,800,390].map(w=>{m.resize(new Rect(0,0,w,w*.75));return {mapWidth:w,mascotHeight:m.sprite.height*m.sprite.scaleY,shadowScale:m.shadow.scaleX}});
  console.log('Mascot sizes:',JSON.stringify(samples));
}
// Same runtime clock across motion toggles should preserve the koi position.
{
  const {PondEvolutionSystem}=load('src/game/systems/PondEvolutionSystem.ts');
  const p=new PondEvolutionSystem(scene());p.create(5,false);p.resize(new Rect(0,0,1448,1086));
  p.update(20000,env);const before=p.fish.map(({sprite})=>[sprite.x,sprite.y]);
  p.setReducedMotion(true);p.update(20016,env);const after=p.fish.map(({sprite})=>[sprite.x,sprite.y]);
  console.log('Koi toggle teleport pixels:',JSON.stringify(after.map((a,i)=>Math.hypot(a[0]-before[i][0],a[1]-before[i][1]))));
}
// Interrupt growth after its outgoing layer faded but before the incoming completes.
for(const [rel,type,prefix]of [['TreeEvolutionSystem','TreeEvolutionSystem','Tree'],['HomeEvolutionSystem','HomeEvolutionSystem','Home']]){
  const exports=load('src/game/systems/'+rel+'.ts'),s=scene(),sys=new exports[type](s);sys.create(1,'afternoon',false);sys.resize(new Rect(0,0,1448,1086));sys.setStage(2,true);
  sys['active'+prefix].alpha=0;sys['incoming'+prefix].alpha=.8;
  sys.setStage(3,true);
  console.log(type+' rapid retarget alpha:',sys['active'+prefix].alpha,sys['incoming'+prefix].alpha);
}
// Growth petals should have only one owner for alpha at any given instant.
{
  const {TreeEvolutionSystem}=load('src/game/systems/TreeEvolutionSystem.ts'),s=scene(),tree=new TreeEvolutionSystem(s);
  tree.create(3,'afternoon',false);tree.resize(new Rect(0,0,1448,1086));tree.setStage(4,true);
  const petal=s.children.list.find(x=>x.key.startsWith('petal-'));
  const alphaTweens=s.tweens.items.filter(t=>t.targets===petal&&t.alpha!==undefined);
  console.log('Tree growth simultaneous alpha ranges:',JSON.stringify(alphaTweens.map(t=>({start:t.delay||0,end:(t.delay||0)+t.duration,alpha:t.alpha}))));
}
}
