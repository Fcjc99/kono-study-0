// Real input/practice contracts, without WebGL. Fake targets only dispatch DOM
// events; production bindFeedSafety/createFeedControl own all cancellation logic.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const local=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name.replace(/\.js$/,'')+'.ts')):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:local,Math,Number,Array,Infinity,console})
 return module.exports
}
const I=load('src/store/interaction.ts'),S=load('src/store/practice.ts'),P=load('src/store/pusher.ts')
let passed=0
function test(name,fn){fn();passed++;console.log('PASS '+name)}
const snapshot=x=>JSON.stringify(x),fresh=()=>P.newCove(()=>.5,100,true)
const enabled=()=>({...S.newPractice(),enabled:true})
const context=overrides=>({ready:true,ended:false,towerBusy:false,pending:0,balls:0,...overrides})
function command(state,cove,kind,at=0,ctx={}){return S.practiceCommand(state,cove,kind,at,context(ctx))}
function unchanged(result,state,cove){assert.equal(result.accepted,false);assert.strictEqual(result.state,state);assert.strictEqual(result.cove,cove);assert.equal(result.coins,0);assert.equal(result.balls,0)}
class Target{
 constructor(){this.listeners=new Map();this.hidden=false}
 addEventListener(name,fn){const set=this.listeners.get(name)||new Set();set.add(fn);this.listeners.set(name,set)}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn)}
 dispatch(name,props={}){for(const fn of this.listeners.get(name)||[])fn({type:name,...props})}
 count(){return [...this.listeners.values()].reduce((n,list)=>n+list.size,0)}
}

test('tap and hold release exactly one medal per interval, with no catch-up burst',()=>{
 const feed=I.createFeedControl();assert.equal(I.FEED_INTERVAL,200)
 assert.equal(feed.tap(0),true);assert.equal(feed.tap(199),false);assert.equal(feed.tap(200),true)
 assert.equal(feed.begin('pointer:1',250),false,'hold can arm during cooldown without double-dropping')
 assert.equal(feed.active,true);assert.equal(feed.tick(399,true),false);assert.equal(feed.tick(400,true),true)
 assert.equal(feed.tick(400,true),false);assert.equal(feed.tick(599,true),false);assert.equal(feed.tick(600,true),true)
 assert.equal(feed.tick(10000,true),true);assert.equal(feed.tick(10000,true),false,'a delayed frame cannot drain the hand in a catch-up loop')
 feed.stop();assert.equal(feed.tick(12000,true),false)
 feed.reset();assert.equal(feed.tap(0),true,'a new round resets timing')
})
test('a second pointer or key cannot steal a hold; only the owner release ends it',()=>{
 const feed=I.createFeedControl();assert.equal(feed.begin('pointer:4',0),true)
 assert.equal(feed.begin('pointer:4',200),false,'duplicate down cannot add a medal')
 assert.equal(feed.begin('keyboard',200),false);assert.equal(feed.begin('pointer:5',200),false)
 assert.equal(feed.owner,'pointer:4');feed.stop('keyboard');feed.stop('pointer:5');assert.equal(feed.active,true)
 assert.equal(feed.tick(200,true),true);feed.stop('pointer:4');assert.equal(feed.active,false);assert.equal(feed.tick(400,true),false)
 assert.equal(feed.begin('keyboard',500),true);assert.equal(feed.tick(700,false),false,'not-ready, ended, modal or empty-hand gate cancels')
 assert.equal(feed.active,false);assert.equal(feed.tick(900,true),false,'reenabling never resumes a stale held feed')
})
test('pointer up/cancel, Space release, blur and tab visibility cancel feeding and cleanup removes listeners',()=>{
 const win=new Target(),doc=new Target(),feed=I.createFeedControl(),unbind=I.bindFeedSafety(win,doc,owner=>feed.stop(owner))
 assert.equal(win.count(),4);assert.equal(doc.count(),1)
 let t=0
 for(const event of ['pointerup','pointercancel']){
  assert.equal(feed.begin('pointer:9',t+=1000),true);win.dispatch(event,{pointerId:10});assert.equal(feed.active,true)
  win.dispatch(event,{pointerId:9});assert.equal(feed.active,false);assert.equal(feed.tick(t+500,true),false)
 }
 feed.begin('keyboard',t+=1000);win.dispatch('keyup',{code:'KeyA'});assert.equal(feed.active,true)
 win.dispatch('keyup',{code:'Space'});assert.equal(feed.active,false)
 feed.begin('keyboard',t+=1000);win.dispatch('blur');assert.equal(feed.active,false)
 feed.begin('pointer:1',t+=1000);doc.dispatch('visibilitychange');assert.equal(feed.active,true,'visible state does not cancel')
 doc.hidden=true;doc.dispatch('visibilitychange');assert.equal(feed.active,false)
 feed.begin('pointer:2',t+=1000);unbind();assert.equal(feed.active,false);assert.equal(win.count(),0);assert.equal(doc.count(),0)
 feed.begin('pointer:2',t+=1000);win.dispatch('blur');assert.equal(feed.active,true,'unmounted bindings no longer mutate input')
})
test('aim rail converts direct position, clamps edges and handles invalid coordinates',()=>{
 assert.equal(I.aimFromRail(100,100,400),4);assert.equal(I.aimFromRail(300,100,400),50);assert.equal(I.aimFromRail(500,100,400),96)
 assert.equal(I.aimFromRail(-900,100,400),4);assert.equal(I.aimFromRail(999,100,400),96)
 assert.equal(I.aimFromRail(101,100,0),96);assert.equal(I.clampAim(NaN),50);assert.equal(I.clampAim(Infinity),50)
 for(let x=100;x<=500;x++){const aim=I.aimFromRail(x,100,400);assert.ok(aim>=4&&aim<=96)}
})
test('practice is explicit, requires a running machine, and rejects rapid duplicate actions without mutation',()=>{
 const c=fresh(),off=S.newPractice(),s=enabled(),before=snapshot(c)
 unchanged(command(off,c,'coins'),off,c)
 unchanged(command(s,c,'coins',0,{ready:false}),s,c);unchanged(command(s,c,'coins',0,{ended:true}),s,c)
 const first=command(s,c,'coins',0);assert.equal(first.accepted,true);assert.equal(first.state.used,true)
 for(const kind of S.PRACTICE_ACTIONS.map(a=>a.kind))unchanged(command(first.state,first.cove,kind,649),first.state,first.cove)
 assert.equal(command(first.state,first.cove,'ball',650).accepted,true)
 assert.equal(snapshot(c),before);assert.equal(s.used,false,'caller input remains immutable')
 assert.equal(command({...first.state,enabled:false},first.cove,'coins',1000).state.used,true,'closing Practice never erases sample provenance')
})
test('sample coins, balls and tower growth are explicit supply, never credited directly to hand/won',()=>{
 let c=fresh(),s=enabled(),t=0
 for(const [kind,coins,balls]of [['coins',12,0],['ball',0,1],['grow',0,0]]){
  const r=command(s,c,kind,t);assert.equal(r.accepted,true);assert.equal(r.coins,coins);assert.equal(r.balls,balls)
  assert.equal(r.cove.hand,100);assert.equal(r.cove.won,0);assert.equal(r.cove.dropped,0)
  s=r.state;c=r.cove;t+=650
 }
 assert.equal(s.addedCoins,32);assert.equal(s.addedBalls,1);assert.equal(s.sampleLotteries,0)
 assert.equal(c.bank,P.BANK_START+20);assert.equal(c.medals.length,0,'sample handoff is metered by physical dispatch, not free spawned winnings')
})
test('practice busy limits retain queued supplies and never overwrite active bonuses',()=>{
 const c=fresh(),s=enabled()
 for(const kind of ['coins','ball','tower'])unchanged(command(s,c,kind,0,{pending:180}),s,c)
 unchanged(command(s,c,'ball',0,{balls:8}),s,c)
 for(const kind of ['tower','grow'])unchanged(command(s,c,kind,0,{towerBusy:true}),s,c)
 for(const field of [{dish:{pocket:0,at:0}},{dishQueue:1},{chance:{pocket:1,at:0}},{chanceQueue:1}]){
  const active={...c,...field};unchanged(command(s,active,'dish'),s,active)
 }
 assert.equal(command(s,c,'ball',0,{balls:7}).accepted,true)
 assert.equal(command(s,c,'coins',0,{pending:179}).accepted,true)
})
test('tower release moves the exact bank once, preserves original wheels, and records the reserve refill',()=>{
 const wheel={seg:4,at:0},prize={x:30,n:11,at:0},c={...fresh(),frame:50,bank:75,steps:3,wheels:[wheel,null,null],wheelQueue:[2,1,0],towers:[prize]},s=enabled()
 const r=command(s,c,'tower',1000);assert.equal(r.accepted,true)
 assert.equal(r.cove.bank,P.BANK_START);assert.equal(r.cove.hand,c.hand);assert.equal(r.cove.won,c.won);assert.equal(r.cove.steps,3)
 assert.strictEqual(r.cove.wheels,c.wheels);assert.strictEqual(r.cove.wheelQueue,c.wheelQueue);assert.strictEqual(r.cove.towers[0],prize)
 const release=r.cove.towers[1];assert.equal(release.n,75);assert.equal(release.source,'bank');assert.equal(release.at,50)
 assert.equal(r.state.addedCoins,P.BANK_START,'refill supply is marked as a sample, not silently manufactured')
 unchanged(command(r.state,r.cove,'tower',1700),r.state,r.cove)
 const consumed={...r.cove,towers:[]};unchanged(command(r.state,consumed,'tower',1700,{towerBusy:true}),r.state,consumed)
 assert.equal(c.bank,75);assert.equal(c.towers.length,1,'original data stays untouched')
})
test('sample lottery runs the original random bonus rules and routes payout to playfield, not hand',()=>{
 for(const [random,expectedChance]of [[()=>.01,false],[()=>.14,true]]){
  const original=fresh(),r=command(enabled(),original,'dish');assert.equal(r.accepted,true);assert.equal(r.state.sampleLotteries,1)
  assert.equal(r.cove.dishQueue,1);assert.equal(r.cove.dish,null,'dispatch requests rather than fabricates a resolved outcome')
  let c=r.cove,emitted=0,sawChance=false,sawDish=false
  for(let f=0;f<650;f++){
   c=P.step(c,random);sawDish||=!!c.dish;sawChance||=!!c.chance
   emitted+=c.medals.filter(m=>!m.ball).length;c=P.spawned(c)
   assert.equal(c.hand,100);assert.equal(c.won,0,'no tray contact means no collected medals')
  }
  assert.equal(sawDish,true);assert.equal(sawChance,expectedChance);assert.equal(emitted,10)
  assert.equal(c.dish,null);assert.equal(c.chance,null)
  if(expectedChance){assert.equal(c.winPockets,2);assert.equal(c.jpWins,0,'sample Jackpot Chance can genuinely miss')}
 }
})
test('mini tower is an explicit twenty-medal practice sample, not wallet credit or reserve spending',()=>{
 const state=enabled(),c=fresh(),r=command(state,c,'mini')
 assert.equal(r.accepted,true);assert.equal(r.state.used,true);assert.equal(r.state.addedCoins,20)
 assert.equal(r.cove.hand,c.hand);assert.equal(r.cove.won,c.won);assert.equal(r.cove.bank,c.bank)
 assert.equal(r.cove.fieldAwards,c.fieldAwards+20);assert.equal(r.cove.towers.length,1);assert.equal(r.cove.towers[0].n,20)
 assert.equal(r.cove.towers[0].source,undefined)
 unchanged(command(state,c,'mini',0,{towerBusy:true}),state,c)
 unchanged(command(state,c,'mini',0,{pending:180}),state,c)
 const disabled={...state,enabled:false};unchanged(command(disabled,c,'mini'),disabled,c)
})

console.log(`${passed}/${passed} input/practice checks passed.`)
