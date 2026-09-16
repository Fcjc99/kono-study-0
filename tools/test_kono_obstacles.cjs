const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
class Rect {constructor(x=0,y=0,width=0,height=0){this.setTo(x,y,width,height)} setTo(x,y,width,height){Object.assign(this,{x,y,width,height,left:x,top:y});return this}}
const phaser={Geom:{Rectangle:Rect},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),Between:(a,b)=>(a+b)/2},Utils:{Array:{GetRandom:a=>a[Math.floor(Math.random()*a.length)]}},BlendModes:{ADD:1}};
function load(file){const module={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n==='phaser'?phaser:load(path.resolve(path.dirname(file),n+'.ts')),Math,Map,Set,Number});return module.exports;}
function scene(){const objects=[];function sprite(key){const s={key,height:100,width:100,alpha:1,events:{},setTexture(k){this.key=k;return this},setPosition(x,y){this.x=x;this.y=y;return this},setAlpha(a){this.alpha=a;return this},setTint(...t){this.tint=t;return this},setVisible(v){this.visible=v;return this},on(e,cb){this.events[e]=cb;return this}};for(const m of ['setOrigin','setDepth','setInteractive','setScale','setDisplaySize','setAngle','setBlendMode','removeAllListeners','destroy'])s[m]=()=>s;objects.push(s);return s;}return {objects,time:{now:0},game:{events:{on(){},off(){}}},textures:{exists:()=>false},add:{image:(x,y,k)=>sprite(k),rectangle:()=>sprite('core')}};}
const {KonoMascotSystem}=load(path.join(root,'src/game/systems/KonoMascotSystem.ts'))

const insideEllipse=(point,ellipse)=>{const nx=(point.x-ellipse.x)/ellipse.rx,ny=(point.y-ellipse.y)/ellipse.ry;return nx*nx+ny*ny<1}

// 'garden' is a real nav node at (0.25, 0.65) and a WANDER_NODE_POOL member — placing an obstacle
// exactly there is the sharpest test of both the wander-target filter (never picked as a
// destination) and the per-step block (never crossed while travelling to some other destination).
const GARDEN_OBSTACLE={x:0.25,y:0.65,rx:0.06,ry:0.033}
{
  const s=scene(),k=new KonoMascotSystem(s)
  k.create(false,'afternoon')
  k.resize(new Rect(0,0,1448,1086))
  k.setObstacles([GARDEN_OBSTACLE])
  let everInside=false
  for(let i=0;i<4000;i++){
    k.update(i*250,0.25,{phase:'afternoon'})
    if(insideEllipse(k.getNormalizedPosition(),GARDEN_OBSTACLE))everInside=true
  }
  assert.equal(everInside,false,'KONO must never enter an obstacle footprint while wandering/pathing around it')
  console.log('PASS obstacle at a live nav node is never entered across 1000s of simulated wandering')
}

// Removing the obstacle again must free that ground back up — confirms setObstacles([]) actually
// clears state rather than only ever adding to it.
{
  const s=scene(),k=new KonoMascotSystem(s)
  k.create(false,'afternoon')
  k.resize(new Rect(0,0,1448,1086))
  k.setObstacles([GARDEN_OBSTACLE])
  for(let i=0;i<200;i++)k.update(i*250,0.25,{phase:'afternoon'})
  k.setObstacles([])
  let everInside=false
  for(let i=200;i<4000;i++){
    k.update(i*250,0.25,{phase:'afternoon'})
    if(insideEllipse(k.getNormalizedPosition(),GARDEN_OBSTACLE))everInside=true
  }
  assert.equal(everInside,true,'clearing obstacles must free the ground back up for wandering')
  console.log('PASS setObstacles([]) clears a previously blocked node')
}

// An obstacle placed off the fixed nav graph entirely (mid-way along a well-travelled edge, not at
// any node) must still stop KONO stepping through it during ordinary travel between two nodes.
{
  const s=scene(),k=new KonoMascotSystem(s)
  k.create(false,'afternoon')
  k.resize(new Rect(0,0,1448,1086))
  const midEdgeObstacle={x:0.46,y:0.53,rx:0.05,ry:0.03}
  k.setObstacles([midEdgeObstacle])
  let everInside=false
  for(let i=0;i<4000;i++){
    k.update(i*250,0.25,{phase:'afternoon'})
    if(insideEllipse(k.getNormalizedPosition(),midEdgeObstacle))everInside=true
  }
  assert.equal(everInside,false,'KONO must never step through an obstacle placed mid-edge between two nav nodes')
  console.log('PASS an obstacle placed mid-edge (not on any nav node) is never stepped through')
}

console.log('3/3 KONO obstacle-avoidance regression groups passed.')
