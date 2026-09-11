const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
class Rect {constructor(x=0,y=0,width=0,height=0){this.setTo(x,y,width,height)} setTo(x,y,width,height){Object.assign(this,{x,y,width,height,left:x,top:y});return this}}
const phaser={Geom:{Rectangle:Rect},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),Between:(a,b)=>(a+b)/2},Utils:{Array:{GetRandom:a=>a[0]}},BlendModes:{ADD:1}};
function load(file){const module={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n==='phaser'?phaser:load(path.resolve(path.dirname(file),n+'.ts')),Math,Map,Set,Number});return module.exports;}
function scene(){const objects=[];function sprite(key){const s={key,height:100,width:100,alpha:1,events:{},setTexture(k){this.key=k;return this},setPosition(x,y){this.x=x;this.y=y;return this},setAlpha(a){this.alpha=a;return this},setTint(...t){this.tint=t;return this},setVisible(v){this.visible=v;return this},on(e,cb){this.events[e]=cb;return this}};for(const m of ['setOrigin','setDepth','setInteractive','setScale','setDisplaySize','setAngle','setBlendMode','removeAllListeners','destroy'])s[m]=()=>s;objects.push(s);return s;}const gradient={addColorStop(){}};return {objects,time:{now:0},game:{events:{on(){},off(){}}},textures:{exists:()=>false,createCanvas:()=>({context:{createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,fillRect(){}},refresh(){}})},add:{image:(x,y,k)=>sprite(k),rectangle:()=>sprite('core')}};}
const {KonoMascotSystem}=load(path.join(root,'src/game/systems/KonoMascotSystem.ts'));
const s=scene(),k=new KonoMascotSystem(s);k.create(false,'night');k.resize(new Rect(0,0,1448,1086));
const asleep=k.getNormalizedPosition();assert.equal(s.objects[1].key,'kono-sleep');
for(let i=0;i<600;i++){k.update(i*1000,1,{phase:'night'});s.objects[1].events.pointerdown();}
assert.equal(s.objects[1].key,'kono-sleep');assert.deepEqual(k.getNormalizedPosition(),asleep);assert(s.objects[1].tint.every(t=>t<0xaaaaee));
k.handleFishing({type:'cast'});k.handleInteraction({type:'start',action:{landmarkId:'lanterns',id:'tea',phase:'night'}});k.update(601000,1,{phase:'night'});assert.deepEqual(k.getNormalizedPosition(),asleep);
k.setPhase('morning');k.update(603000,1,{phase:'morning'});assert.notEqual(s.objects[1].key,'kono-sleep');
k.setPhase('night');assert.equal(s.objects[1].key,'kono-sleep');
const {LanternEvolutionSystem}=load(path.join(root,'src/game/systems/LanternEvolutionSystem.ts'));
const ls=scene(),lanterns=new LanternEvolutionSystem(ls);lanterns.create(0,false);lanterns.resize(new Rect(0,0,1448,1086));
for(let stage=0;stage<=5;stage++){lanterns.setStage(stage);lanterns.setPhase('evening');const cores=ls.objects.filter(o=>o.key==='core'&&o.visible);assert.equal(cores.length,stage===0?6:5);assert(cores.every(o=>o.alpha>.8&&o.x>=1000&&o.x<1220&&o.y>=350&&o.y<450));for(const phase of ['night','morning','afternoon']){lanterns.setPhase(phase);assert(cores.every(o=>o.alpha===0));}}
const {LightingSystem}=load(path.join(root,'src/game/systems/LightingSystem.ts'));
const gs=scene(),lighting=new LightingSystem(gs);lighting.create(false);lighting.resize(new Rect(0,0,1448,1086));const env={ambientLight:1,darkness:0,warmth:0,coolness:0,lanternStrength:0,starVisibility:0,haze:0,waterHighlight:1,precipitation:0,cloudCover:0};
lighting.update(0,.1,{...env,phase:'evening'});assert(gs.objects[0].alpha>0);assert.equal(gs.objects[1].alpha,0);
lighting.update(0,.1,{...env,phase:'night'});assert.equal(gs.objects[0].alpha,0);assert(gs.objects[1].alpha>0);
lighting.update(0,.1,{...env,phase:'afternoon'});assert(gs.objects.every(o=>o.alpha===0));
console.log('PASS: persistent night sleep, no click/fishing/interaction wakeups, morning wake, shaded Kono; all six terrace stages evening-only lights; sun/moon/day transitions.');
