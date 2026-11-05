// Board Clear is an optional additional JP right, never a rewritten draw table.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const req=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:req,Math,Number,Array,Map,Set,console});return module.exports}
const P=load('src/store/pusher.ts'),A=load('src/store/practice.ts')
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name)},same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b)),fresh=()=>P.newCove(()=>.5,100,true)
test('every earned JP adds exactly one clear; every miss preserves exact old odds and medal amount',()=>{
 for(let wins=1;wins<=4;wins++)for(let pocket=0;pocket<P.CHANCE_POCKETS;pocket++){
  const hit=P.isWinPocket(pocket,wins),before={...fresh(),jackpot:283,boardClears:2,winPockets:wins,chance:{pocket,at:-P.CHANCE_FRAMES}},calls=[]
  const c=P.step(before,()=>{calls.push(1);return .5})
  assert.equal(c.boardClears,hit?3:2);assert.equal(c.jpWins,hit?1:0);assert.equal(c.fieldAwards,hit?283:10);assert.equal(c.hand,before.hand);assert.equal(c.won,before.won)
  assert.equal(c.jackpot,hit?P.JP_START:303);assert.equal(c.winPockets,hit?1:Math.min(4,wins+1));assert.equal(c.chance,null)
  // An external miss emits two ordinary rain medals: each uses two existing
  // random positions. JP creates a fixed Tide right without any extra draw.
  assert.equal(calls.length,hit?0:4);assert.equal(c.tides?.reduce((n,t)=>n+t.n,0)??0,hit?283:0)
 }
})
test('claim consumes one entitlement once without changing balances, provenance or queues',()=>{
 const before={...fresh(),boardClears:2,hand:41,won:51,lost:3,dropped:110,bank:175,queue:7,dishQueue:4,chanceQueue:2,wheelQueue:[11,12,13],rain:29,towers:[{x:50,n:33,at:0}],tides:[{id:4,n:100,at:0,practice:false}],fieldAwards:162,ballsAwarded:3,ballsCaptured:2}
 const c=P.claimBoardClear(before)
 assert.equal(c.boardClears,1);assert.equal(c.boardClearBusy,true);assert.equal(c.boardClearPractice,false)
 same({...c,boardClears:before.boardClears,boardClearBusy:before.boardClearBusy},before)
 assert.equal(P.claimBoardClear(c),c,'double activation cannot consume another token')
 assert.equal(P.drop(c,50),c,'active/queued clear cannot spend an extra input medal')
 assert.equal(P.busy(c),true);assert.equal(P.claimBoardClear(fresh()).boardClearBusy,false)
 const finished={...c,boardClearBusy:false};const next=P.claimBoardClear(finished)
 assert.equal(next.boardClears,0);assert.equal(next.boardClearBusy,true)
})
test('unclaimed earned clear keeps an empty-hand round open; new round does not persist it',()=>{
 const c={...fresh(),hand:0,boardClears:1};assert.equal(P.busy(c),true);assert.equal(P.busy({...c,boardClears:0}),false)
 const reset=fresh();assert.equal(reset.boardClears,0);assert.equal(reset.boardClearBusy,false);assert.equal(reset.boardClearPractice,false)
})
test('one explicit practice clear preserves earned rights and never synthesizes medal value',()=>{
 const state={...A.newPractice(),enabled:true},before={...fresh(),boardClears:2,bank:145,fieldAwards:500,rain:21},context={ready:true,ended:false,towerBusy:true,pending:900,balls:7}
 const a=A.practiceCommand(state,before,'clear',1000,context)
 assert.equal(a.accepted,true);assert.equal(a.state.used,true);assert.equal(a.state.clearUsed,true);assert.equal(a.cove.boardClearBusy,true);assert.equal(a.cove.boardClearPractice,true);assert.equal(a.cove.boardClears,2)
 assert.equal(a.coins,0);assert.equal(a.balls,0);assert.equal(a.state.addedCoins,0);assert.equal(a.state.addedBalls,0);assert.equal(a.state.sampleLotteries,0)
 same({...a.cove,boardClearBusy:before.boardClearBusy,boardClearPractice:before.boardClearPractice},before)
 const repeat=A.practiceCommand(a.state,{...a.cove,boardClearBusy:false},'clear',3000,context)
 assert.equal(repeat.accepted,false);assert.match(repeat.message,/already been used/);assert.equal(repeat.cove.boardClears,2)
 const reset=A.newPractice();assert.equal(reset.clearUsed,false)
})
test('all practice samples reject while clear runs and unsafe clear requests have no effect',()=>{
 const state={...A.newPractice(),enabled:true},context={ready:true,ended:false,towerBusy:false,pending:0,balls:0},active={...fresh(),boardClearBusy:true}
 for(const {kind} of A.PRACTICE_ACTIONS){const result=A.practiceCommand(state,active,kind,1000,context);assert.equal(result.accepted,false);assert.equal(result.state,state);assert.equal(result.cove,active)}
 for(const changed of [{ready:false},{ended:true}]){const c=fresh(),r=A.practiceCommand(state,c,'clear',1000,{...context,...changed});assert.equal(r.accepted,false);assert.equal(r.cove,c)}
 const c=fresh(),off=A.practiceCommand({...state,enabled:false},c,'clear',1000,context);assert.equal(off.accepted,false);assert.equal(off.cove,c)
})
console.log(count+'/'+count+' Board Clear rule checks passed.')
