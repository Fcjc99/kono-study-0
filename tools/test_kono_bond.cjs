// KONO’s bond hearts (src/store/konoBond.ts): a bond that only grows, from things kept for good; a day KONO was cared for is marked once.
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
const {addCareEvent,bondEventId}=load('src/store/konoCare.ts')
const ev=(kind,i,extra={})=>({id:kind+'-'+i,kind,at:'2026-09-0'+(1+(i%9))+'T12:00:00.000Z',...extra})

test('points: 1 per thing finished, 3 per day KONO was cared for, 3 per wish, 2 per find, 3 per visit (pats and feedings themselves add nothing more)',()=>{
 const log=[ev('bond',1),ev('bond',2),ev('wish',1),ev('find',1),ev('find',2),ev('visit',1),ev('pet',1),ev('feed',1),ev('pet',2)]
 assert.equal(bondPoints(5,log),5+6+3+4+3)
 assert.equal(bondPoints(0,[...log,ev('bond',1)]),bondPoints(0,log),'the same day twice (two devices) counts once')
 assert.equal(bondPoints(0,[]),0)
})
test('hearts: 1 to start, more as points grow, 10 at most; it never goes down because every source is kept for good',()=>{
 assert.equal(bondLevel(0).level,1);assert.equal(bondLevel(0).title,'New friends')
 assert.equal(bondLevel(9).level,1);assert.equal(bondLevel(10).level,2);assert.equal(bondLevel(10).title,'Buddies')
 assert.equal(bondLevel(30).level,3);assert.equal(bondLevel(29).next,30)
 assert.equal(bondLevel(10_000).level,MAX_HEARTS);assert.equal(bondLevel(10_000).next,null)
 let last=0;for(let p=0;p<600;p+=7){const l=bondLevel(p).level;assert.ok(l>=last);last=l}
})
test('a friendship gift for each heart from 3 on, and what KONO says',()=>{
 assert.equal(giftsAt(2).length,0)
 assert.deepEqual([...giftsAt(3).map(g=>g.id)],['cushion'])
 assert.equal(giftsAt(MAX_HEARTS).length,GIFTS.length)
 assert.equal(bondLine(bondLevel(10)),'💗 You and KONO are now Buddies! Now a pat sends up a little heart.')
 assert.equal(bondLine(bondLevel(30)),'💗 You and KONO are now Pals! KONO made you a heart cushion. It’s in Decorate › Presents.')
 assert.match(bondLine(bondLevel(100)),/KONO made you a KONO plushie\./)
})
test('the day’s first feeding, pat or tuck-in marks the day once (fixed ID), kept for good',()=>{
 const now=new Date('2026-10-12T15:00:00')
 let state=addCareEvent(undefined,'p',{id:'a',kind:'pet',at:now.toISOString()},now)
 assert.deepEqual([...state.log.map(e=>e.kind)],['pet','bond'])
 assert.equal(state.log[1].id,bondEventId('2026-10-12'))
 const later=new Date('2026-10-12T16:00:00')
 state=addCareEvent(state,'p',{id:'b',kind:'feed',at:later.toISOString(),taskId:'t1'},later)
 assert.equal(state.log.filter(e=>e.kind==='bond').length,1,'once a day')
 state=addCareEvent(state,'p',{id:'c',kind:'find',at:later.toISOString(),item:'pebble'},later)
 assert.equal(state.log.filter(e=>e.kind==='bond').length,1,'a find isn’t care')
 const months=new Date('2027-03-01T10:00:00')
 state=addCareEvent(state,'p',{id:'d',kind:'pet',at:months.toISOString()},months)
 assert.deepEqual([...state.log.filter(e=>e.kind==='bond').map(e=>e.id)],['bond-2026-10-12','bond-2027-03-01'],'old care days stay')
 assert.equal(state.log.some(e=>e.id==='a'),false,'old pats themselves are let go')
})
console.log(passed+' KONO bond test groups passed')
