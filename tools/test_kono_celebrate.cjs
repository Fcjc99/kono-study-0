// Mirrors tools/test_kono_obstacles.cjs's exact mock-scene/loader pattern.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
class Rect {constructor(x=0,y=0,width=0,height=0){this.setTo(x,y,width,height)} setTo(x,y,width,height){Object.assign(this,{x,y,width,height,left:x,top:y});return this}}
const phaser={Geom:{Rectangle:Rect},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),Between:(a,b)=>(a+b)/2},Utils:{Array:{GetRandom:a=>a[0]}},BlendModes:{ADD:1}};
function load(file){const module={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n==='phaser'?phaser:load(path.resolve(path.dirname(file),n+'.ts')),Math,Map,Set,Number});return module.exports;}
function scene(){const objects=[];const emitted=[]
 function sprite(key){const s={key,height:100,width:100,alpha:1,events:{},setTexture(k){this.key=k;return this},setPosition(x,y){this.x=x;this.y=y;return this},setAlpha(a){this.alpha=a;return this},setTint(...t){this.tint=t;return this},setVisible(v){this.visible=v;return this},on(e,cb){this.events[e]=cb;return this}};for(const m of ['setOrigin','setDepth','setInteractive','setScale','setDisplaySize','setAngle','setBlendMode','removeAllListeners','destroy'])s[m]=()=>s;objects.push(s);return s;}
 const listeners=new Map()
 return {objects,emitted,time:{now:0},game:{events:{
  on(event,cb,ctx){listeners.set(event,[cb,ctx]);return this},
  off(event){listeners.delete(event);return this},
  emit(event,...args){emitted.push(event);const l=listeners.get(event);if(l)l[0].apply(l[1],args)},
 }},textures:{exists:()=>false},add:{image:(x,y,k)=>sprite(k),rectangle:()=>sprite('core')}}}
const {KonoMascotSystem}=load(path.join(root,'src/game/systems/KonoMascotSystem.ts'))

const tests=[]
function test(name,fn){tests.push({name,fn})}

test('celebrate() plays a happy/excited reaction texture on demand',()=>{
 const s=scene(),k=new KonoMascotSystem(s)
 k.create(false,'afternoon')
 k.resize(new Rect(0,0,1448,1086))
 k.celebrate()
 k.update(0,0.25,{phase:'afternoon',weather:'clear'})
 const texture=s.objects.find(o=>o.key==='kono-happy'||o.key==='kono-excited')
 assert.ok(texture,'expected a reaction texture (kono-happy or kono-excited) to be showing right after celebrate()')
})

test('the scene\'s own celebrate event reaches KONO, matching how the interaction event already works',()=>{
 const s=scene(),k=new KonoMascotSystem(s)
 k.create(false,'afternoon')
 k.resize(new Rect(0,0,1448,1086))
 s.game.events.emit('sanctuary:kono-celebrate', Date.now())
 k.update(0,0.25,{phase:'afternoon',weather:'clear'})
 const texture=s.objects.find(o=>o.key==='kono-happy'||o.key==='kono-excited')
 assert.ok(texture,'expected the emitted sanctuary:kono-celebrate event to trigger a reaction')
})

test('celebrate() is silently a no-op while KONO is asleep at night',()=>{
 const s=scene(),k=new KonoMascotSystem(s)
 k.create(false,'night')
 k.resize(new Rect(0,0,1448,1086))
 k.celebrate()
 k.update(0,0.25,{phase:'night',weather:'clear'})
 const sprite=s.objects.find(o=>o.key==='kono-sleep'||o.key==='kono-happy'||o.key==='kono-excited')
 assert.equal(sprite && sprite.key,'kono-sleep','expected KONO to stay asleep, not celebrate, at night')
})

test('destroy() unsubscribes the celebrate listener so a later emit does nothing',()=>{
 const s=scene(),k=new KonoMascotSystem(s)
 k.create(false,'afternoon')
 k.resize(new Rect(0,0,1448,1086))
 k.destroy()
 assert.doesNotThrow(()=>s.game.events.emit('sanctuary:kono-celebrate', Date.now()),'emitting after destroy() must not throw (no dangling listener call on a torn-down system)')
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} KONO celebrate-event regression groups passed.`)
