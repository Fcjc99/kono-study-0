// Mirrors tools/test_kono_weather.cjs's exact mock-scene/loader/settle-detection pattern, but with a
// real event-bus mock (from tools/test_kono_celebrate.cjs) since this feature is driven entirely by
// the sanctuary:kono-focus-companion event, not a direct method call from the test itself.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
class Rect {constructor(x=0,y=0,width=0,height=0){this.setTo(x,y,width,height)} setTo(x,y,width,height){Object.assign(this,{x,y,width,height,left:x,top:y});return this}}
let wanderPick=0
const phaser={Geom:{Rectangle:Rect},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),Between:(a,b)=>(a+b)/2},Utils:{Array:{GetRandom:a=>a[wanderPick++%a.length]}},BlendModes:{ADD:1}};
function load(file){const module={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n==='phaser'?phaser:load(path.resolve(path.dirname(file),n+'.ts')),Math,Map,Set,Number});return module.exports;}
function scene(){const objects=[]
 function sprite(key){const s={key,height:100,width:100,alpha:1,events:{},setTexture(k){this.key=k;return this},setPosition(x,y){this.x=x;this.y=y;return this},setAlpha(a){this.alpha=a;return this},setTint(...t){this.tint=t;return this},setVisible(v){this.visible=v;return this},on(e,cb){this.events[e]=cb;return this}};for(const m of ['setOrigin','setDepth','setInteractive','setScale','setDisplaySize','setAngle','setBlendMode','removeAllListeners','destroy'])s[m]=()=>s;objects.push(s);return s;}
 const listeners=new Map()
 return {objects,time:{now:0},game:{events:{
  on(event,cb,ctx){listeners.set(event,[cb,ctx]);return this},
  off(event){listeners.delete(event);return this},
  emit(event,...args){const l=listeners.get(event);if(l)l[0].apply(l[1],args)},
 }},textures:{exists:()=>false},add:{image:(x,y,k)=>sprite(k),rectangle:()=>sprite('core')}}}
const {KonoMascotSystem}=load(path.join(root,'src/game/systems/KonoMascotSystem.ts'))

const CHERRY_KEY='0.486,0.255'
// Exact (unrounded) equality -- see test_kono_weather.cjs for why: a route waypoint gets passed
// through for exactly one tick, while a genuine settle holds the identical position for many ticks.
const keyOf=(p)=>p.x+','+p.y

function boot(phase='afternoon'){
 wanderPick=0
 const s=scene(),k=new KonoMascotSystem(s)
 k.create(false,phase)
 k.resize(new Rect(0,0,1448,1086))
 return {s,k}
}

{
 const {s,k}=boot()
 s.game.events.emit('sanctuary:kono-focus-companion', true)
 for(let i=0;i<8000;i++)k.update(i*250,0.25,{phase:'afternoon',weather:'clear'})
 assert.equal(keyOf(k.getNormalizedPosition()),CHERRY_KEY,'expected KONO to settle at the cherry tree once a focus session starts')
 console.log('PASS starting a focus session sends KONO to the cherry tree to settle in')
}

{
 const {s,k}=boot()
 s.game.events.emit('sanctuary:kono-focus-companion', true)
 for(let i=0;i<3000;i++)k.update(i*250,0.25,{phase:'afternoon',weather:'clear'})
 const settled=new Set()
 let last=null
 for(let i=3000;i<12000;i++){
  k.update(i*250,0.25,{phase:'afternoon',weather:'clear'})
  const key=keyOf(k.getNormalizedPosition())
  if(last===key)settled.add(key)
  last=key
 }
 assert.deepEqual([...settled],[CHERRY_KEY],'expected KONO to stay put at the cherry tree for the whole focus session, never wandering off')
 console.log('PASS KONO stays at the cherry tree for the whole focus session instead of wandering')
}

{
 const {s,k}=boot()
 s.game.events.emit('sanctuary:kono-focus-companion', true)
 for(let i=0;i<3000;i++)k.update(i*250,0.25,{phase:'afternoon',weather:'clear'})
 s.game.events.emit('sanctuary:kono-focus-companion', false)
 const visited=new Set()
 for(let i=3000;i<20000;i++){
  k.update(i*250,0.25,{phase:'afternoon',weather:'clear'})
  visited.add(keyOf(k.getNormalizedPosition()))
 }
 assert.ok(visited.size>1,'expected KONO to resume wandering to other spots once the focus session ends')
 console.log('PASS ending the focus session lets KONO resume wandering')
}

{
 const {s,k}=boot('night')
 s.game.events.emit('sanctuary:kono-focus-companion', true)
 for(let i=0;i<20;i++)k.update(i*250,0.25,{phase:'night',weather:'clear'})
 assert.equal(k.getNormalizedPosition().x,0.275,'expected KONO to stay asleep at the house, not head for the cherry tree, if focus starts at night')
 console.log('PASS starting a focus session at night does not wake KONO to walk to the cherry tree')
}

{
 const {s,k}=boot()
 s.game.events.emit('sanctuary:kono-focus-companion', true)
 k.destroy()
 assert.doesNotThrow(()=>s.game.events.emit('sanctuary:kono-focus-companion', false),'emitting after destroy() must not throw (no dangling listener call on a torn-down system)')
 console.log('PASS destroy() unsubscribes the focus-companion listener so a later emit does nothing')
}

console.log('5/5 KONO focus-companion regression groups passed.')
