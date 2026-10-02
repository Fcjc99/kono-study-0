// Repeating events (store/eventRepeat): the dates a repeat adds, the copies it makes, and a change spread over a series.
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
const lib=load('src/store/eventRepeat.ts'),{repeatCopy,applyToSeries,defaultUntil,MAX_REPEATS}=lib
// The module runs in its own context: copy its arrays so deepEqual compares values.
const repeatDates=(...a)=>[...lib.repeatDates(...a)]

test('the dates: daily, weekdays (no weekends), weekly, every 2 weeks, monthly (skipping months without the day)',()=>{
 assert.deepEqual(repeatDates('2026-10-02','daily','2026-10-05'),['2026-10-03','2026-10-04','2026-10-05'])
 assert.deepEqual(repeatDates('2026-10-02','weekdays','2026-10-07'),['2026-10-05','2026-10-06','2026-10-07'],'Oct 2 is a Friday: the weekend is skipped')
 assert.deepEqual(repeatDates('2026-10-02','weekly','2026-10-23'),['2026-10-09','2026-10-16','2026-10-23'])
 assert.deepEqual(repeatDates('2026-10-02','biweekly','2026-10-30'),['2026-10-16','2026-10-30'])
 assert.deepEqual(repeatDates('2026-08-31','monthly','2027-01-31'),['2026-10-31','2026-12-31','2027-01-31'],'no Sep 31 or Nov 31')
 assert.deepEqual(repeatDates('2026-11-29','weekly','2027-01-03'),['2026-12-06','2026-12-13','2026-12-20','2026-12-27','2027-01-03'],'across a year')
})
test('no repeat, an end before the start, and a cap on how many',()=>{
 assert.deepEqual(repeatDates('2026-10-02','none','2026-12-01'),[])
 assert.deepEqual(repeatDates('2026-10-02','weekly','2026-10-01'),[])
 assert.deepEqual(repeatDates('2026-10-02','weekly','2026-10-08'),[])
 assert.equal(repeatDates('2026-01-01','daily','2030-01-01').length,MAX_REPEATS)
 assert.equal(defaultUntil('2026-10-02'),'2026-12-11')
})
const base={id:'ev1',profileId:'p',date:'2026-10-02',title:'Tutoring',kind:'study',notes:'Bring notes',time:'13:30',endTime:'14:30',subjectId:'s1',kidId:'k1',done:true,source:'calendar',planFor:'task:t1',needsReview:true,result:{ourScore:1,opponentScore:0}}
test('a copy is the student’s own event on its date, in the series, with a new ID',()=>{
 const copy=repeatCopy(base,'2026-10-09','rec1')
 assert.notEqual(copy.id,'ev1')
 assert.equal(copy.date,'2026-10-09');assert.equal(copy.recurringId,'rec1');assert.equal(copy.done,false)
 for(const key of ['title','kind','notes','time','endTime','subjectId','kidId'])assert.equal(copy[key],base[key],key)
 for(const key of ['source','planFor','needsReview','result'])assert.ok(!(key in copy),key+' is not copied')
 assert.equal(base.source,'calendar','the original is untouched')
})
test('a change goes to only this one, this and the ones after, or all of them (dates stay), never another series or profile',()=>{
 const series=['2026-10-02','2026-10-09','2026-10-16','2026-10-23'].map((date,i)=>({id:'e'+i,profileId:'p',date,title:'Tutoring',kind:'study',notes:'',time:'13:30',endTime:'14:30',recurringId:'rec1'}))
 const others=[{id:'x',profileId:'p',date:'2026-10-16',title:'Other',kind:'study',notes:'',recurringId:'rec2'},{id:'y',profileId:'q',date:'2026-10-16',title:'Tutoring',kind:'study',notes:'',recurringId:'rec1'}]
 const events=[...series,...others]
 const edited={...series[1],title:'Math tutoring',time:'15:00',endTime:undefined}
 const titles=list=>list.map(e=>e.id+':'+e.title+'@'+e.date+' '+(e.time??'')+'-'+(e.endTime??'')).join(', ')
 assert.equal(applyToSeries(events,edited,'2026-10-09','one'),events)
 assert.equal(titles(applyToSeries(events,edited,'2026-10-09','following')),'e0:Tutoring@2026-10-02 13:30-14:30, e1:Tutoring@2026-10-09 13:30-14:30, e2:Math tutoring@2026-10-16 15:00-, e3:Math tutoring@2026-10-23 15:00-, x:Other@2026-10-16 -, y:Tutoring@2026-10-16 -')
 assert.equal(titles(applyToSeries(events,edited,'2026-10-09','all')),'e0:Math tutoring@2026-10-02 15:00-, e1:Tutoring@2026-10-09 13:30-14:30, e2:Math tutoring@2026-10-16 15:00-, e3:Math tutoring@2026-10-23 15:00-, x:Other@2026-10-16 -, y:Tutoring@2026-10-16 -')
})
console.log(passed+'/4 repeating-event groups passed.')
