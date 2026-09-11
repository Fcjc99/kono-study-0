// Headless behavioral regressions against the shipped production systems.
const assert=require('node:assert/strict');
const {load,mascot,scene,Rect,env,NAV_NODES,NAV_GRAPH,isWalkablePoint,fakeMath}=require('./animation-audit.cjs');
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-10,`${message}: ${a} != ${b}`);
let routes=0;
fakeMath.random=()=>.99;
function finishRoute(m,b,label){
  let arrived=false;
  for(let frame=0;frame<7200;frame++){
    const before={...m.position};m.update(frame*1000/60,1/60,env);
    assert.ok(isWalkablePoint(m.position),'route left the walkable area');
    assert.ok(Math.hypot(m.position.x-before.x,m.position.y-before.y)<=.04/60+1e-12,'route exceeded its frame travel budget');
    if(Math.hypot(m.position.x-NAV_NODES[b].x,m.position.y-NAV_NODES[b].y)<1e-10&&!m.route.length){arrived=true;break}
  }
  assert.ok(arrived,`${label} -> ${b} did not finish`);
}
const nodeIds=Object.keys(NAV_NODES);
for(const a of nodeIds)for(const b of nodeIds){
  const {m}=mascot();m.position={...NAV_NODES[a]};m.forcedTarget=true;m.navigateToNode(b);
  finishRoute(m,b,a);routes++;
}
assert.equal(routes,nodeIds.length**2,'every pair of actual navigation nodes must be exercised');
let retargets=0;
const edges=[];
for(const [a,neighbors]of Object.entries(NAV_GRAPH))for(const b of neighbors){
  assert.ok(NAV_GRAPH[b].includes(a),`edge ${a} -> ${b} must be reversible`);
  if(a<b)edges.push([a,b]);
}
for(const [a,b]of edges)for(const fraction of [.1,.25,.5,.75,.9])for(const destination of nodeIds){
  const {m}=mascot();
  m.position={x:NAV_NODES[a].x+(NAV_NODES[b].x-NAV_NODES[a].x)*fraction,y:NAV_NODES[a].y+(NAV_NODES[b].y-NAV_NODES[a].y)*fraction};
  m.forcedTarget=true;m.navigateToNode(b);
  const start={...m.position};m.navigateToNode(destination);
  near(m.position.x,start.x,'retargeting must not teleport x');near(m.position.y,start.y,'retargeting must not teleport y');
  finishRoute(m,destination,`${a}/${b} at ${fraction}`);retargets++;
}
assert.equal(retargets,edges.length*5*nodeIds.length,'every mid-edge position must retarget to every destination');
{
  const {m}=mascot();
  for(const start of ['house','garden','north-center','lanterns','bridge']){
    const route=Array.from(m.findNodePath(start,'cherry'));
    assert.deepEqual(route.slice(-4),['tree-approach','tree-stairs','tree-landing','cherry'],'plateau approach must climb the stair chain');
  }
  assert.ok(NAV_NODES.cherry.y<.27,'tree destination must be on the plateau');
  near(NAV_NODES.house.x,.275,'home destination aligns with porch');near(NAV_NODES.house.y,.515,'home destination aligns with doorstep');
  near(NAV_NODES.lanterns.x,.748,'terrace destination stays inside deck');near(NAV_NODES.lanterns.y,.455,'terrace destination stays inside deck');
  m.position={...NAV_NODES['tree-stairs']};m.forcedTarget=true;m.navigateToNode('cherry');
  const before={...m.position};m.update(0,0,env);near(m.position.x,before.x,'zero delta on stairs must not move x');near(m.position.y,before.y,'zero delta on stairs must not move y');
  m.update(900000,900,env);assert.ok(Math.hypot(m.position.x-before.x,m.position.y-before.y)<=.04*.034+1e-12,'long pause on stairs must not skip the flight');
  finishRoute(m,'cherry','stair pause recovery');
}
for(const delta of [0,-1,NaN,Infinity,1/60,100]){
  const {m}=mascot();m.position={...NAV_NODES['west-junction']};m.target={x:m.position.x+.0059,y:m.position.y};
  const start={...m.position};m.update(0,delta,env);
  const allowed=Number.isFinite(delta)?.04*Math.min(.034,Math.max(0,delta)):0;
  near(Math.hypot(m.position.x-start.x,m.position.y-start.y),Math.min(.0059,allowed),'arrival step respects the finite bounded delta');
}
{
  const {m}=mascot('evening');m.position={...NAV_NODES['west-junction']};m.target={...m.position};m.route=[];m.destinationNode=null;
  let n=0;fakeMath.random=()=>n++%2?.9:.1;
  const poses=new Set();for(let i=0;i<100;i++){m.update(i*16,.016,{...env,phase:'evening'});poses.add(m.currentTexture)}
  assert.equal(poses.size,1,'stationary evening pose must stay stable');
  m.beginReaction('kono-tea',3000);m.update(2000,.016,{...env,phase:'evening'});assert.equal(m.currentTexture,'kono-tea','explicit tea reaction still works');
  fakeMath.random=()=>.99;
}
{
  const {m}=mascot();m.handleInteraction({type:'start',action:{id:'cherry-read',landmarkId:'cherry',phase:'afternoon'}});
  m.beginReaction('kono-happy',1250);assert.equal(m.pendingReaction,'kono-read','pointer reaction preserves destination reaction');
  let reacted=false;
  for(let t=0;t<60000;t+=16){m.update(t,.016,env);if(m.currentTexture==='kono-read'){reacted=true;break}}
  assert.ok(reacted,'queued landmark reaction must run after arrival');
  assert.equal(m.pendingReaction,null,'arrival consumes queued reaction once');
}
{
  const {m}=mascot();const samples=[1448,800,390,200].map(w=>{m.resize(new Rect(0,0,w,w*.75));return {w,height:m.sprite.height*m.sprite.scaleY,shadow:m.shadow.scaleX}});
  for(const sample of samples){
    near(sample.shadow/sample.height,samples[0].shadow/samples[0].height,'shadow follows readable mascot size');
    assert.ok(sample.height<=sample.w*.75*.12,'mascot stays bounded on very small maps');
  }
  near(samples[1].height/samples[1].w,samples[0].height/samples[0].w,'desktop mascot scales with island');
  assert.ok(samples[0].height>60,'desktop actions must be clearly readable');
  near(samples.find(s=>s.w===390).height,26,'phone mascot has a readable 26px floor');
  near(samples.find(s=>s.w===200).height,18,'tiny embeds cap the floor to 12 percent');
  m.resize(new Rect(0,0,390,292.5));
  const anchor={x:m.sprite.x,y:m.sprite.y},height=m.sprite.height*m.sprite.scaleY;
  for(const pose of ['kono-read','kono-tea','kono-happy','kono-sleep','kono-idle']){
    m.setTexture(pose);m.positionVisuals();
    near(m.sprite.height*m.sprite.scaleY,height,'reactions keep their readable height');
    near(m.sprite.x,anchor.x,'reaction retains foot anchor x');near(m.sprite.y,anchor.y,'reaction retains foot anchor y');
  }
}
{
  const {PondEvolutionSystem}=load('src/game/systems/PondEvolutionSystem.ts'),p=new PondEvolutionSystem(scene());
  p.create(5,false);p.resize(new Rect(0,0,1448,1086));
  for(let t=0;t<=20000;t+=16)p.update(t,env);
  const positions=()=>p.fish.map(({sprite})=>[sprite.x,sprite.y,sprite.key]);
  const before=positions();p.setReducedMotion(true);p.update(20016,env);assert.deepEqual(positions(),before,'reduced motion must freeze each fish in place');
  p.update(80000,env);assert.deepEqual(positions(),before,'frozen fish remain in place');
  p.setReducedMotion(false);p.update(80016,env);
  p.fish.forEach(({sprite},i)=>assert.ok(Math.hypot(sprite.x-before[i][0],sprite.y-before[i][1])<3,'resume must not teleport'));
  const clock=p.motionTimeMs;p.update(900000,env);near(p.motionTimeMs-clock,34,'page resume has a bounded clock step');
  const stable=p.motionTimeMs;p.update(NaN,env);p.update(Infinity,env);near(p.motionTimeMs,stable,'invalid timestamps do not poison koi time');
}
{
  const {TreeEvolutionSystem}=load('src/game/systems/TreeEvolutionSystem.ts'),s=scene(),tree=new TreeEvolutionSystem(s);
  tree.create(3,'afternoon',false);tree.resize(new Rect(0,0,1448,1086));tree.setStage(4,true);
  const petals=s.children.list.filter(x=>x.key.startsWith('petal-'));assert.equal(petals.length,5);
  for(const petal of petals){
    const tweens=s.tweens.items.filter(t=>t.targets===petal);assert.equal(tweens.length,1,'one tween owns growth-petal position and opacity');
    const tween=tweens[0];tween.onUpdate({progress:0});near(petal.alpha,0,'petal begins transparent');
    tween.onUpdate({progress:.5});assert.ok(petal.alpha>0,'petal becomes visible');
    let last=petal.alpha;for(const progress of [.73,.8,.9,.96,1]){tween.onUpdate({progress});assert.ok(petal.alpha<=last,'petal must not reappear during fade out');last=petal.alpha}
    near(last,0,'petal ends transparent');tween.onComplete();assert.equal(petal.active,false,'petal is cleaned up');
  }
}
console.log(`PASS: ${nodeIds.length} nodes, ${routes} complete pond-safe routes, ${retargets} mid-route retargets; painted stair chain and doorstep/deck endpoints; finite travel budgets and stair pause recovery; stable evening idle; destination reactions; readable mascot/shadow sizes and stable pose anchors; koi motion toggles and pause recovery; growth-petal opacity and cleanup.`);
