// Independent rights/accounting regression. Executes production TypeScript;
// physical collection and lifecycle live in test_board_clear_lifecycle.cjs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(name){const file=path.resolve(root,name);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const local=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:local,Math,Number,Array,Infinity,console});return module.exports}
const P=load('src/store/pusher.ts'),S=load('src/store/practice.ts'),snapshot=JSON.stringify,fresh=()=>P.newCove(()=>.5,100,true)
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const context={ready:true,ended:false,towerBusy:false,pending:0,balls:0}
const omit=(c,keys)=>Object.fromEntries(Object.entries(c).filter(([k])=>!keys.includes(k)))

test('all 48 Jackpot Chance outcomes grant exactly one clear only for a genuine winning pocket',()=>{
 for(let winning=1;winning<=4;winning++)for(let pocket=0;pocket<P.CHANCE_POCKETS;pocket++){
  let c={...fresh(),jackpot:147,winPockets:winning,boardClears:2,chance:{pocket,at:-P.CHANCE_FRAMES}}
  const before=snapshot(c),hit=P.isWinPocket(pocket,winning);let draws=0;c=P.step(c,()=>{draws++;return .5})
  assert.equal(c.boardClears,hit?3:2);assert.equal(c.jpWins,hit?1:0);assert.equal(c.hand,100);assert.equal(c.won,0);assert.equal(c.fieldAwards,hit?147:10)
  if(hit){assert.equal(draws,0,'resolving an already selected JP or granting a clear never draws again');assert.equal(c.tides.length,1);assert.equal(c.tides[0].n,147);assert.equal(c.tides[0].practice,false)}
  assert.notEqual(snapshot(c),before)
 }
})

test('one earned claim is immutable, repeat-safe, and cannot alter balances, balls, supply or selected outcomes',()=>{
 const c={...fresh(),boardClears:2,hand:72,won:11,dropped:39,bank:85,fieldAwards:28,ballsAwarded:3,ballsCaptured:1,queue:4,spinning:{reels:['🪙','🪙','🪙'],prize:{kind:'shower',n:20},at:0},wheels:[{seg:3,at:0},null,{seg:6,at:0}],wheelQueue:[7,8,9],dish:{pocket:2,at:0},dishQueue:5,chanceQueue:3,tides:[{id:2,n:9,at:0,practice:false}],towers:[{x:50,n:12,at:0}],rain:7,medals:[{id:401,x:50,y:31,vx:0,vy:0,ball:true}]}
 const before=snapshot(c),claimed=P.claimBoardClear(c)
 assert.equal(snapshot(c),before);assert.equal(claimed.boardClears,1);assert.equal(claimed.boardClearBusy,true);assert.equal(claimed.boardClearPractice,false)
 assert.equal(snapshot(omit(claimed,['boardClears','boardClearBusy','boardClearPractice'])),snapshot(omit(c,['boardClears','boardClearBusy','boardClearPractice'])))
 for(let i=0;i<100;i++)assert.strictEqual(P.claimBoardClear(claimed),claimed)
 assert.equal(P.busy({...fresh(),hand:0,boardClears:1}),true,'unspent earned clear prevents automatic forfeiture at empty hand')
 assert.equal(P.busy({...fresh(),hand:0,boardClearBusy:true}),true)
})

test('missing, depleted and malformed claims fail closed; a subsequent earned right can be claimed once after completion',()=>{
 for(const n of [undefined,0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){const c={...fresh(),boardClears:n};assert.strictEqual(P.claimBoardClear(c),c)}
 let c=P.claimBoardClear({...fresh(),boardClears:1});assert.equal(c.boardClears,0);c={...c,boardClearBusy:false};assert.strictEqual(P.claimBoardClear(c),c)
 c=P.step({...c,chance:{pocket:0,at:c.frame-P.CHANCE_FRAMES}},()=>.5);assert.equal(c.boardClears,1);assert.equal(c.jpWins,1)
 c=P.claimBoardClear(c);assert.equal(c.boardClears,0);assert.equal(c.boardClearBusy,true);assert.strictEqual(P.claimBoardClear(c),c)
})

test('Practice JP is not an earned clear, and the optional Practice Clear is one-use with sticky provenance',()=>{
 const state={...S.newPractice(),enabled:true},c=fresh(),jp=S.practiceCommand(state,c,'jp',0,context)
 assert.equal(jp.accepted,true);assert.equal(jp.cove.boardClears,0);assert.equal(jp.cove.jpWins,0);assert.equal(jp.cove.tides[0].practice,true)
 const off=S.practiceCommand(S.newPractice(),c,'clear',0,context);assert.equal(off.accepted,false);assert.strictEqual(off.cove,c)
 const earned={...fresh(),boardClears:2},result=S.practiceCommand(state,earned,'clear',0,context)
 assert.equal(result.accepted,true);assert.equal(result.state.used,true);assert.equal(result.state.clearUsed,true);assert.equal(result.cove.boardClearBusy,true);assert.equal(result.cove.boardClearPractice,true);assert.equal(result.cove.boardClears,2);assert.equal(result.cove.jpWins,0);assert.equal(result.coins,0);assert.equal(result.balls,0)
 assert.equal(snapshot(omit(result.cove,['boardClearBusy','boardClearPractice'])),snapshot(omit(earned,['boardClearBusy','boardClearPractice'])))
 for(const action of S.PRACTICE_ACTIONS){const rejected=S.practiceCommand(result.state,result.cove,action.kind,1000,context);assert.equal(rejected.accepted,false,'no sample may be injected during an active clear');assert.strictEqual(rejected.cove,result.cove)}
 const complete={...result.cove,boardClearBusy:false},closed={...result.state,enabled:false};assert.equal(closed.used,true);assert.equal(closed.clearUsed,true)
 const again=S.practiceCommand({...closed,enabled:true},complete,'clear',2000,context);assert.equal(again.accepted,false);assert.strictEqual(again.cove,complete)
 const real=P.claimBoardClear(complete);assert.equal(real.boardClears,1);assert.equal(real.boardClearPractice,false,'the sample never consumes the earned right')
})
console.log(`${passed}/${passed} independent Board Clear rights checks passed.`)
