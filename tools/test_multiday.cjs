// Quick add ("＋ Add" › Type it): one typed line becomes an assignment or exam with its class, date and time.
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
const {parseQuickAdd}=load('src/store/quickAdd.ts')
const {normalizeData,eventOnDate,createFreshData}=load('src/store/model.ts')
const {kidItemsForDate}=load('src/store/kids.ts')
const base=()=>createFreshData()
test('a trip keeps its last day; a last day before the first, a bad date or more than 62 days on is dropped',()=>{
 const d=base(),pid=d.activeProfileId
 const ev=(id,date,endDate)=>({id,profileId:pid,date,title:'Trip '+id,kind:'personal',notes:'',...(endDate===undefined?{}:{endDate})})
 const out=normalizeData({...d,calendarEvents:[ev('a','2026-11-10','2026-11-14'),ev('b','2026-11-10','2026-11-09'),ev('c','2026-11-10','soon'),ev('d','2026-11-10','2027-03-01'),ev('e','2026-11-10')]})
 const by=Object.fromEntries(out.calendarEvents.map(e=>[e.id,e.endDate]))
 assert.equal(by.a,'2026-11-14');for(const k of ['b','c','d','e'])assert.equal(by[k],undefined,k)
})
test('it is on each day from its first to its last, and on those days it is all day (no time)',()=>{
 assert.equal(eventOnDate({date:'2026-11-10',endDate:'2026-11-12'},'2026-11-09'),false)
 for(const day of ['2026-11-10','2026-11-11','2026-11-12'])assert.equal(eventOnDate({date:'2026-11-10',endDate:'2026-11-12'},day),true)
 assert.equal(eventOnDate({date:'2026-11-10',endDate:'2026-11-12'},'2026-11-13'),false)
 assert.equal(eventOnDate({date:'2026-11-10'},'2026-11-10'),true)
 const d=base(),pid=d.activeProfileId
 const data=normalizeData({...d,calendarEvents:[{id:'camp',profileId:pid,date:'2026-11-10',endDate:'2026-11-12',time:'09:00',title:'Camp',kind:'activity',notes:''}]})
 const mid=kidItemsForDate(data,pid,'2026-11-11').find(i=>i.id==='camp')
 assert.ok(mid,'camp shows mid-trip');assert.equal(mid.time,undefined)
})
console.log(`${passed}/2 multi-day groups passed.`)
