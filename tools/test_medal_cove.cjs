// KONO Medal Cove: the medal pusher's rules (store/pusher), no browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const resolveLocal=name=>{const bare=name.replace(/\.js$/,''),at=path.resolve(path.dirname(file),bare);return fs.existsSync(at+'.ts')?at+'.ts':at+'.tsx'}
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(resolveLocal(name)):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console,URL,Response,AbortSignal,TextEncoder,JSON})
 return module.exports
}
let passed=0
const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
const P=load('src/store/pusher.ts'),coins=load('src/store/konoCoins.ts')
let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}
const run=(c,frames)=>{for(let i=0;i<frames;i++)c=P.step(c,rnd);return c}
;(async()=>{
await test('the pile: a fresh machine has a big pile; the pusher shoves it, medals off the front go to your hand, the sides lose some, and most of what you drop comes back',()=>{
 let c=P.newCove(rnd);assert.ok(c.medals.length>150,'a big pile to start');assert.equal(c.hand,100)
 const before=c.hand;for(let f=0;f<60*90;f++){if(f%30===0&&c.hand>0)c=P.drop(c,c.checker+25>96?c.checker-25:c.checker+25,rnd);c=P.step(c,rnd)}
 assert.ok(c.won>c.dropped*0.4,'medals come back off the front ('+c.won+' of '+c.dropped+')');assert.equal(c.hand,before-c.dropped+c.won,'what’s won goes back in your hand')
 for(const m of c.medals){assert.ok(m.x>=0&&m.x<=P.FIELD.w,'the walls keep the pile in');assert.ok(m.y>=c.pusher,'nothing behind the pusher')}
})
await test('a check: a medal through the lantern spins the lottery (and the jackpot grows), up to 4 wait, and three of a kind pays',()=>{
 let c=P.newCove(rnd);c=P.drop(c,c.checker,rnd);assert.equal(c.queue,1);assert.equal(c.hand,99)
 c=P.step(c,rnd);assert.ok(c.spinning,'the reels spin');assert.equal(c.jackpot,P.JP_START+1,'every spin adds to the jackpot')
 for(let i=0;i<6;i++)c=P.drop(c,c.checker,rnd);assert.equal(c.queue+(c.spinning?1:0),4,'four spins at most wait')
 assert.equal(JSON.stringify(P.spinPrize(['🪙','🪙','🪙'])),JSON.stringify({kind:'shower',n:12}));assert.equal(JSON.stringify(P.spinPrize(['🗼','🗼','🗼'])),JSON.stringify({kind:'tower',n:20}));assert.equal(JSON.stringify(P.spinPrize(['🔮','🔮','🔮'])),JSON.stringify({kind:'ball'}))
 assert.equal(JSON.stringify(P.spinPrize(['⭐','⭐','⭐'])),JSON.stringify({kind:'step'}));assert.equal(JSON.stringify(P.spinPrize(['🐚','🌺','🐚'])),JSON.stringify({kind:'shower',n:2}));assert.equal(JSON.stringify(P.spinPrize(['🐚','🌺','⭐'])),JSON.stringify({kind:'none'}))
 const total=P.ODDS.reduce((n,o)=>n+o[2],0);assert.ok(total<1,'some spins miss')
 const counts={};for(let i=0;i<4000;i++){const k=P.spinPrize(P.spinReels(rnd)).kind;counts[k]=(counts[k]??0)+1}
 assert.ok(counts.ball>100&&counts.step>350&&counts.none>1000,'the payout table holds: '+JSON.stringify(counts))
})
await test('the bonus chain: a shower lands on the field, five lamps make the BIG BONUS, a ball off the front rolls into the ball lottery, and a tower tips over onto the field',()=>{
 let c=P.newCove(rnd);const n=c.medals.length
 c={...c,spinning:{reels:['🪙','🪙','🪙'],prize:{kind:'shower',n:12},at:c.frame-200}};c=P.step(c,rnd);assert.ok(c.medals.length>=n+12-2,'the shower lands');assert.match(c.events.at(-1).text,/shower/)
 c={...c,steps:P.LAMPS-1,spinning:{reels:['⭐','⭐','⭐'],prize:{kind:'step'},at:c.frame-200}};c=P.step(c,rnd);assert.equal(c.steps,0);assert.ok(c.medals.some(m=>m.ball),'all five lamps: the big bonus has a prize ball');assert.match(c.events.at(-1).text,/BIG BONUS/)
 const ball=c.medals.find(m=>m.ball);c={...c,medals:c.medals.map(m=>m===ball?{...m,y:P.FIELD.h+1}:m)};c=P.step(c,rnd);assert.ok(c.dish||c.dishQueue,'off the front, the ball goes to the ball lottery')
 let t=P.newCove(rnd);const tn=t.medals.length;t={...t,towers:[{x:50,n:20,at:t.frame-100}]};t=P.step(t,rnd);assert.ok(t.medals.length>=tn+18,'the tower’s medals spill onto the field');assert.equal(t.towers.length,0)
})
await test('Jackpot Chance: a miss pays a little, grows the jackpot and adds a winning pocket (up to 4); a win pays the jackpot and starts it over',()=>{
 let c=P.newCove(rnd);const loss=[...Array(P.CHANCE_POCKETS).keys()].find(i=>!P.isWinPocket(i,1)),win=[...Array(P.CHANCE_POCKETS).keys()].find(i=>P.isWinPocket(i,1))
 const hand=c.hand;c={...c,chance:{pocket:loss,at:c.frame-300}};c=P.step(c,rnd);assert.equal(c.winPockets,2);assert.equal(c.jackpot,P.JP_START+20);assert.ok(c.hand>=hand+10)
 for(let i=0;i<5;i++){const miss=[...Array(P.CHANCE_POCKETS).keys()].find(k=>!P.isWinPocket(k,c.winPockets));c={...c,chance:{pocket:miss,at:c.frame-300}};c=P.step(c,rnd)}
 assert.equal(c.winPockets,4,'four winning pockets at most');assert.equal([...Array(P.CHANCE_POCKETS).keys()].filter(i=>P.isWinPocket(i,4)).length,4)
 const jp=c.jackpot,h=c.hand;c={...c,chance:{pocket:win,at:c.frame-300}};c=P.step(c,rnd)
 assert.equal(c.jpWins,1);assert.ok(c.hand>=h+jp,'the jackpot is paid');assert.equal(c.jackpot,P.JP_START);assert.equal(c.winPockets,1)
 let d=P.newCove(rnd);d={...d,dish:{pocket:P.DISH.findIndex(p=>p.prize.kind==='chance'),at:d.frame-300}};d=P.step(d,rnd);assert.equal(d.chanceQueue+(d.chance?1:0),1,'a JP CHANCE pocket starts a Jackpot Chance')
 assert.equal(P.busy(d),true)
 assert.equal(coins.gameCoins('cove',80),10);assert.equal(coins.gameCoins('cove',0),0)
})
await test('the pin board: a drop goes in at the top; the 🏮 pocket spins the lottery, ⭐ lights a lamp (the fifth is the BIG BONUS), 🗼 builds a tower (three at most)',()=>{
 let c=P.newCove(rnd,100,true);assert.equal(c.medals.length,0,'the physics engine builds the pile')
 c=P.drop(c,30,rnd);assert.equal(c.hand,99);assert.equal(c.medals[0].y,-1,'in at the top of the board');assert.equal(c.queue,0,'the board, not the aim, decides')
 c=P.spawned(c);assert.equal(c.medals.length,0)
 c=P.pocket(c,'spin',rnd);assert.equal(c.queue,1);assert.equal(c.jackpot,P.JP_START+1)
 for(let i=0;i<P.LAMPS-1;i++)c=P.pocket(c,'lamp',rnd);assert.equal(c.steps,P.LAMPS-1)
 const before=c.medals.length;c=P.pocket(c,'lamp',rnd);assert.equal(c.steps,0);assert.ok(c.medals.length>=before+21,'BIG BONUS: a shower and a ball');assert.equal(c.towers.length,1,'and a tower')
 c=P.pocket(c,'tower',rnd);c=P.pocket(c,'tower',rnd);assert.equal(c.towers.length,3);c=P.pocket(c,'tower',rnd);assert.equal(c.towers.length,3,'three towers at most')
 c=P.settle(c,5,1,1);assert.equal(c.won,5);assert.equal(c.lost,1);assert.equal(c.dishQueue,1);assert.equal(c.hand,c.hand)
})
console.log(passed+'/5 KONO Medal Cove groups passed.')
})().catch(error=>{console.error('FAIL',error);process.exit(1)})
