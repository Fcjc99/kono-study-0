// Mirrors tools/test_kono_obstacles.cjs's exact mock-scene/loader pattern.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
class Rect {constructor(x=0,y=0,width=0,height=0){this.setTo(x,y,width,height)} setTo(x,y,width,height){Object.assign(this,{x,y,width,height,left:x,top:y});return this}}
let wanderPick=0
const phaser={Geom:{Rectangle:Rect},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),Between:(a,b)=>(a+b)/2},Utils:{Array:{GetRandom:a=>a[wanderPick++%a.length]}},BlendModes:{ADD:1}};
function load(file){const module={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n==='phaser'?phaser:load(path.resolve(path.dirname(file),n+'.ts')),Math,Map,Set,Number});return module.exports;}
function scene(){const objects=[];function sprite(key){const s={key,height:100,width:100,alpha:1,events:{},setTexture(k){this.key=k;return this},setPosition(x,y){this.x=x;this.y=y;return this},setAlpha(a){this.alpha=a;return this},setTint(...t){this.tint=t;return this},setVisible(v){this.visible=v;return this},on(e,cb){this.events[e]=cb;return this}};for(const m of ['setOrigin','setDepth','setInteractive','setScale','setDisplaySize','setAngle','setBlendMode','removeAllListeners','destroy'])s[m]=()=>s;objects.push(s);return s;}return {objects,time:{now:0},game:{events:{on(){},off(){}}},textures:{exists:()=>false},add:{image:(x,y,k)=>sprite(k),rectangle:()=>sprite('core')}};}
const {KonoMascotSystem}=load(path.join(root,'src/game/systems/KonoMascotSystem.ts'))

const HOUSE_KEY='0.275,0.515', CHERRY_KEY='0.486,0.255'
// Exact (unrounded) equality, not a rounded string: a route waypoint gets snapped-to for exactly one
// tick while merely passing through it (the very next tick moves on again, since travel resumes
// toward the next waypoint), whereas a genuine arrival holds the identical exact position for many
// ticks in a row while idling. Rounding to compare would let a small-enough step (rain/snow slow
// KONO down) round two different in-transit positions to the same string, reading as a false "settle".
const keyOf=(p)=>p.x+','+p.y

function settlePoints(weather,ticks=8000){
  wanderPick=0
  const s=scene(),k=new KonoMascotSystem(s)
  k.setWeather(weather) // set before create() so even the very first wander pick already knows the weather
  k.create(false,'afternoon')
  k.resize(new Rect(0,0,1448,1086))
  const settled=new Set()
  let last=null
  for(let i=0;i<ticks;i++){
    k.update(i*250,0.25,{phase:'afternoon',weather})
    const key=keyOf(k.getNormalizedPosition())
    if(last===key)settled.add(key)
    last=key
  }
  return settled
}

for(const weather of ['rain','snow']){
  const settled=settlePoints(weather)
  assert.ok(settled.size>=1,`expected KONO to actually settle somewhere while it's ${weather === 'rain' ? 'raining' : 'snowing'}`)
  for(const key of settled){
    assert.ok(key===HOUSE_KEY||key===CHERRY_KEY,`unexpected settle point while sheltering from ${weather}: ${key} (only the house and the cherry tree read as shelter)`)
  }
  console.log(`PASS while it's ${weather}, KONO only ever settles at a sheltered spot (the house or the cherry tree), never an exposed one`)
}

// Once the weather clears, normal wandering (including exposed spots) resumes -- rain/snow never
// permanently locks KONO's destinations to shelter.
{
  wanderPick=0
  const s=scene(),k=new KonoMascotSystem(s)
  k.setWeather('rain')
  k.create(false,'afternoon')
  k.resize(new Rect(0,0,1448,1086))
  for(let i=0;i<3000;i++)k.update(i*250,0.25,{phase:'afternoon',weather:'rain'})
  k.setWeather('clear')
  const settled=new Set()
  let last=null
  for(let i=3000;i<12000;i++){
    k.update(i*250,0.25,{phase:'afternoon',weather:'clear'})
    const key=keyOf(k.getNormalizedPosition())
    if(last===key)settled.add(key)
    last=key
  }
  const visitedExposed=[...settled].some((key)=>key!==HOUSE_KEY&&key!==CHERRY_KEY)
  assert.ok(visitedExposed,'expected KONO to visit an exposed spot again once the weather cleared, not stay confined to shelter')
  console.log('PASS clearing weather lifts the shelter-seeking restriction; exposed spots are visited again')
}

// A slower, more careful pace through rain or snow than in clear weather -- the only weather cue
// available without new art (no umbrella/huddle pose exists), so it needs to actually be present.
{
  const displacementAfterTwoTicks=(weather)=>{
    wanderPick=0
    const s=scene(),k=new KonoMascotSystem(s)
    k.setWeather(weather)
    k.create(false,'afternoon')
    k.resize(new Rect(0,0,1448,1086))
    k.update(0,0.25,{phase:'afternoon',weather})
    const p0=k.getNormalizedPosition()
    k.update(250,0.25,{phase:'afternoon',weather})
    const p1=k.getNormalizedPosition()
    return Math.hypot(p1.x-p0.x,p1.y-p0.y)
  }
  const rainStep=displacementAfterTwoTicks('rain')
  const clearStep=displacementAfterTwoTicks('clear')
  assert.ok(rainStep>0,'expected KONO to already be moving by the second tick under rain')
  assert.ok(clearStep>0,'expected KONO to already be moving by the second tick under clear weather')
  assert.ok(rainStep<clearStep*0.9,`expected a meaningfully slower pace in rain (${rainStep}) than in clear weather (${clearStep})`)
  console.log('PASS KONO moves at a slower, more careful pace while it\'s raining than in clear weather')
}

console.log('4/4 KONO weather-reaction regression groups passed.')
