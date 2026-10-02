// KONO’s stamp card (src/store/konoStamps.ts): a stamp for each day something gets finished, a present for every 7.
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
const {stampCard,PRESENTS,CARD_SIZE,presentLine,presentHow}=load('src/store/konoStamps.ts')
const days=n=>Object.fromEntries(Array.from({length:n},(_,i)=>[new Date(Date.UTC(2026,8,1+i*2)).toISOString().slice(0,10),1+(i%3)]))
const today='2026-12-01'

test('a stamp for each day with something finished, however far apart (missed days never break the card)',()=>{
 const card=stampCard(days(4),today)
 assert.equal(card.stamped.length,4)
 assert.deepEqual([...card.stamped],['2026-09-01','2026-09-03','2026-09-05','2026-09-07'])
 assert.equal(card.presents.length,0)
 assert.equal(card.next.id,'kite')
 assert.equal(stampCard({'2026-09-01':0,'2026-09-02':2},today).stamped.length,1,'a day with nothing finished is no stamp')
 assert.equal(stampCard({},today).stamped.length,0)
 assert.equal(stampCard({'2026-12-05':1},today).stamped.length,0,'not a stamp from the future (a clock that was ahead)')
})
test('7 stamps fill the card and open a present; the full card shows until the next stamp starts a new one',()=>{
 const full=stampCard(days(7),today)
 assert.equal(full.stamped.length,CARD_SIZE)
 assert.deepEqual([...full.presents.map(p=>p.id)],['kite'])
 assert.equal(full.next.id,'balloons')
 const next=stampCard(days(8),today)
 assert.equal(next.stamped.length,1)
 assert.deepEqual([...next.presents.map(p=>p.id)],['kite'])
 assert.deepEqual([...stampCard(days(21),today).presents.map(p=>p.id)],['kite','balloons','teddy'])
})
test('stamped today, and after every present the cards keep coming (for a hug)',()=>{
 assert.equal(stampCard({...days(2),[today]:1},today).stampedToday,true)
 assert.equal(stampCard(days(2),today).stampedToday,false)
 const all=stampCard(days(CARD_SIZE*PRESENTS.length+3),'2027-06-01')
 assert.equal(all.presents.length,PRESENTS.length)
 assert.equal(all.next,null)
 assert.equal(all.stamped.length,3)
})
test('what KONO says, and how each present is earned',()=>{
 assert.equal(presentLine(PRESENTS[2]),'🎁 Your stamp card is full! KONO wrapped a present for you: a teddy bear. It’s in Decorate › Presents.')
 assert.match(presentLine(PRESENTS[1]),/present for you: balloons\./)
 assert.match(presentLine(undefined),/biggest hug/)
 assert.equal(presentHow(PRESENTS[0]),'Opens with stamp card 1.')
})
console.log(passed+' KONO stamp card test groups passed')
