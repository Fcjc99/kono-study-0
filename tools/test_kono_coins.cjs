// KONO’s coins (src/store/konoCoins.ts): earned from work and play, spent in the shops, folded by month without counting twice.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,JSON,structuredClone,crypto:{randomUUID},console,window:{addEventListener(){},removeEventListener(){},dispatchEvent(){}},Event:class{}})
 return module.exports
}
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const {bondPoints,bondLevel,giftsAt,bondLine,GIFTS,MAX_HEARTS}=load('src/store/konoBond.ts')
const coins=load('src/store/konoCoins.ts'),care=load('src/store/konoCare.ts'),{foundCounts}=load('src/store/konoFinds.ts')
const {coinBalance,PER_FINISHED,PER_WISH,PER_FIND}=coins
const at=(day,h=12)=>day+'T'+String(h).padStart(2,'0')+':00:00.000Z'

test('balance: 10 per thing finished, 15 per wish, 5 per find, plus coins won, minus things bought',()=>{
 const log=[{id:'wish-2026-10-01',kind:'wish',at:at('2026-10-01')},{id:'f1',kind:'find',at:at('2026-10-01'),item:'acorn'},{id:'spin-2026-10-02',kind:'coin',at:at('2026-10-02'),item:'spin',n:50},{id:'b1',kind:'buy',at:at('2026-10-02'),item:'food:cookie',n:12}]
 assert.equal(coinBalance(3,log),3*PER_FINISHED+PER_WISH+PER_FIND+50-12)
 assert.equal(coinBalance(0,[]),0)
})
test('the prize wheel, a surprise and a quest are each once a day (a fixed ID; a second device’s entry is the same one)',()=>{
 const now=new Date('2026-10-22T15:00:00Z')
 let state=care.addCareEvent(undefined,'p',coins.spinEvent('2026-10-22',1,now),now)
 state=care.addCareEvent(state,'p',coins.spinEvent('2026-10-22',5,now),now)
 assert.equal(state.log.length,1);assert.equal(state.log[0].n,coins.WHEEL[1])
 assert.ok(coins.spunToday(state.log,'2026-10-22'));assert.ok(!coins.spunToday(state.log,'2026-10-23'))
 const q=coins.questToday('p','2026-10-22')
 state=care.addCareEvent(state,'p',coins.questEvent('2026-10-22',q,now),now)
 state=care.addCareEvent(state,'p',coins.questEvent('2026-10-22',q,now),now)
 assert.equal(state.log.filter(e=>e.item==='quest').length,1)
})
test('arcade: three coin rounds a day, coins by score (capped), then just for fun',()=>{
 const now=new Date('2026-10-22T15:00:00Z');let log=[]
 assert.equal(coins.roundsLeft(log,'2026-10-22'),3)
 for(let i=0;i<3;i++){const e=coins.gameEvent(log,'2026-10-22','catch',12,now);assert.ok(e);assert.equal(e.n,24);log=care.addCareEvent({profileId:'p',log},'p',e,now).log}
 assert.equal(coins.roundsLeft(log,'2026-10-22'),0)
 assert.equal(coins.gameEvent(log,'2026-10-22','catch',12,now),null)
 assert.equal(coins.roundsLeft(log,'2026-10-23'),3,'a new day, new rounds')
 assert.equal(coins.gameCoins('catch',999),50);assert.equal(coins.gameCoins('memory',6),48);assert.equal(coins.gameCoins('memory',40),5);assert.equal(coins.gameCoins('peekaboo',0),0)
})
test('shops: the same stock all day on every device; food includes this week’s favorite; owned outfits and found treasures aren’t sold',()=>{
 const a=coins.foodStock('2026-10-22'),b=coins.foodStock('2026-10-22')
 assert.deepEqual(a,b);assert.equal(a.length,5);assert.equal(a[0].id,care.favoriteSnack('2026-10-22').id)
 const outfits=coins.outfitStock(new Set(['bow','beanie']),'2026-07-01')
 assert.ok(!outfits.some(o=>o.id==='bow'||o.id==='beanie'));assert.ok(!outfits.some(o=>o.id==='witch'),'Halloween outfits only sell in their season')
 assert.equal(outfits.filter(o=>o.sale).length,1)
 const t=coins.treasureStock(new Map([['acorn',1]]),'2026-07-01')
 assert.equal(t.length,3);assert.ok(!t.some(x=>x.id==='acorn'))
})
test('things bought: snacks wait with KONO’s snacks, outfits are owned, treasures count as found',()=>{
 const now=new Date('2026-10-22T15:00:00Z')
 const food=coins.foodStock('2026-10-22')[0],outfit=coins.outfitStock(new Set(),'2026-10-22').find(o=>o.id==='crown'),find=coins.treasureStock(new Map(),'2026-10-22')[0]
 let state={profileId:'p',log:[]}
 for(const [i,item] of [food,outfit,find].entries())state=care.addCareEvent(state,'p',coins.buyEvent('buy-'+i,item,now),now)
 const p=care.pantry([],state.log,now)
 assert.equal(p.length,1);assert.equal(p[0].treat.id,food.id);assert.equal(p[0].taskId,'buy-0')
 assert.ok(coins.boughtOutfits(state.log).has('crown'))
 assert.equal(foundCounts(state.log).get(find.id),1)
 assert.equal(coinBalance(0,state.log),-(food.price+outfit.price+find.price))
})
test('old months fold into one entry each, the balance doesn’t change, and an old device’s copy of a folded month never counts twice',()=>{
 const old=[{id:'game-2026-06-01-1',kind:'coin',at:at('2026-06-01'),item:'game:catch',n:30},{id:'spin-2026-06-02',kind:'coin',at:at('2026-06-02'),item:'spin',n:50},{id:'b-food',kind:'buy',at:at('2026-06-03'),item:'food:cookie',n:12},{id:'b-hat',kind:'buy',at:at('2026-06-03'),item:'outfit:crown',n:600}]
 const before=coinBalance(0,old),now=new Date('2026-10-22T15:00:00Z')
 const state=care.addCareEvent({profileId:'p',log:old},'p',{id:'spin-2026-10-22',kind:'coin',at:now.toISOString(),item:'spin',n:10},now)
 assert.equal(coinBalance(0,state.log),before+10)
 assert.ok(state.log.some(e=>e.id==='bank-2026-06'&&e.n===68))
 assert.ok(state.log.some(e=>e.id==='b-hat'),'an outfit bought is kept as it is')
 assert.ok(!state.log.some(e=>e.id==='b-food'||e.id==='spin-2026-06-02'))
 // A device that hadn't folded yet merges its loose June entries back in: still the same balance.
 assert.equal(coinBalance(0,[...state.log,...old.filter(e=>!state.log.some(x=>x.id===e.id))]),before+10)
})
test('reading a saved log keeps coin entries with whole numbers and drops broken ones',()=>{
 const read=care.readCareState({log:[{id:'c1',kind:'coin',at:at('2026-10-01'),item:'spin',n:25},{id:'c2',kind:'coin',at:at('2026-10-01'),n:'lots'},{id:'c3',kind:'buy',at:at('2026-10-01'),item:'food:cake',n:2.5},{id:'bank-2026-01',kind:'bank',at:at('2026-01-15'),n:-40}]},'p')
 assert.deepEqual(read.log.map(e=>e.id),['c1','bank-2026-01'])
 assert.equal(read.log[0].n,25)
})
test('surprises come about every other day and the quest asks for a real snack worth three times its price',()=>{
 let days=0;for(let d=1;d<=60;d++){const day='2026-'+(d<=31?'08-'+String(d).padStart(2,'0'):'09-'+String(d-31).padStart(2,'0'));if(coins.surpriseToday('plan-1',day))days++}
 assert.ok(days>15&&days<45,'surprise days: '+days)
 const q=coins.questToday('plan-1','2026-10-22');assert.ok(care.ALL_TREATS.some(t=>t.id===q.treat.id));assert.equal(q.reward,coins.foodPrice(q.treat)*3)
})
console.log(passed+'/'+passed+' coin checks passed.')
