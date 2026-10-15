// Clash warnings (store/clashes): same person, same driver, a kid’s class; not the event itself or its own series.
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
const {findClashes}=load('src/store/clashes.ts'),model=load('src/store/model.ts')
const label=d=>d.slice(5)
const d=model.createFreshData(),pid=d.activeProfileId
d.kids=[{id:'emma',profileId:pid,name:'Emma',color:'#7ca982'},{id:'leo',profileId:pid,name:'Leo',color:'#d9908c'}]
const ev=(id,date,time,endTime,extra={})=>({id,profileId:pid,date,time,endTime,title:id,kind:'other',notes:'',...extra})
d.calendarEvents=[ev('Piano','2026-10-19','16:00','16:45',{kidId:'emma'}),ev('Book club','2026-10-19','19:00','20:30'),ev('Swim','2026-10-19','16:30','17:30',{kidId:'leo',driver:'Dad'}),ev('Old','2026-10-19','16:00','17:00',{kidId:'emma',done:true})]
const week={Monday:[{id:'b',label:'Biology',start:'13:00',end:'13:50',kind:'study'}],Sunday:[],Tuesday:[],Wednesday:[],Thursday:[],Friday:[],Saturday:[]}
d.studySeasons=[{id:'s',profileId:pid,name:'Fall',start:'2026-09-01',end:'2026-12-20',active:true,week,kidId:'emma'}]
const texts=c=>[...findClashes(d,pid,c,label)].map(x=>x.text)
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
test('the same kid at the same time; a different kid is fine; no end time counts as an hour',()=>{
 assert.deepEqual(texts({dates:['2026-10-19'],time:'16:30',endTime:'17:30',kidIds:['emma']}),['Emma already has Piano at 4:00 PM–4:45 PM.'])
 assert.deepEqual(texts({dates:['2026-10-19'],time:'17:00',kidIds:['emma']}),[],'after piano ends')
 assert.deepEqual(texts({dates:['2026-10-19'],time:'15:30',kidIds:['emma']}),['Emma already has Piano at 4:00 PM–4:45 PM.'],'3:30 with no end runs to 4:30')
 assert.deepEqual(texts({dates:['2026-10-20'],time:'16:30',kidIds:['emma']}),[],'another day')
})
test('your own and whole-family things clash with each other; the same driver in two places',()=>{
 assert.deepEqual(texts({dates:['2026-10-19'],time:'19:30',kidIds:[]}),['You already have Book club at 7:00 PM–8:30 PM.'])
 assert.deepEqual(texts({dates:['2026-10-19'],time:'16:45',endTime:'17:15',kidIds:['emma'],driver:'dad'}),['Dad is already driving to Swim at 4:30 PM–5:30 PM.'])
 assert.deepEqual(texts({dates:['2026-10-19'],time:'16:45',endTime:'17:15',kidIds:['emma','leo']}),['Leo already has Swim at 4:30 PM–5:30 PM.'])
})
test('a kid’s class; the event itself, its own series and finished things don’t count; repeats name the date once',()=>{
 assert.deepEqual(texts({dates:['2026-10-19'],time:'13:30',kidIds:['emma']}),['Emma has Biology (class) at 1:00 PM–1:50 PM.'])
 assert.deepEqual(texts({id:'Piano',dates:['2026-10-19'],time:'16:00',kidIds:['emma']}),[],'not itself')
 const series=findClashes({...d,calendarEvents:[...d.calendarEvents,ev('Piano2','2026-10-26','16:00','16:45',{kidId:'emma',recurringId:'r'})]},pid,{recurringId:'r',dates:['2026-10-26'],time:'16:00',kidIds:['emma']},label)
 assert.deepEqual([...series],[],'its own series')
 const weekly=[...findClashes(d,pid,{dates:['2026-10-12','2026-10-19','2026-10-26'],time:'13:15',kidIds:['emma']},label)].map(x=>x.text)
 assert.deepEqual(weekly,['Emma has Biology (class) at 1:00 PM–1:50 PM on 10-12.'],'every Monday: said once')
 assert.deepEqual(texts({dates:['2026-10-19'],kidIds:['emma']}),[],'no time, no clash')
})
test('in a kid’s own plan, its untagged things are that kid’s; a date label with periods still says it once',()=>{
 const kp={...d,activeProfileId:'kp',calendarEvents:[{...ev('Choir','2026-10-19','16:00','17:00'),profileId:'kp'}],studySeasons:[{...d.studySeasons[0],profileId:'kp',kidId:undefined}]}
 assert.deepEqual([...findClashes(kp,'kp',{dates:['2026-10-19'],time:'16:30',kidIds:['emma'],self:'emma'},label)].map(x=>x.text),['Emma already has Choir at 4:00 PM–5:00 PM.'])
 assert.deepEqual([...findClashes(kp,'kp',{dates:['2026-10-19'],time:'13:30',kidIds:['emma'],self:'emma'},label)].map(x=>x.text),['Emma has Biology (class) at 1:00 PM–1:50 PM.'])
 const dotted=[...findClashes(d,pid,{dates:['2026-10-12','2026-10-19'],time:'13:15',kidIds:['emma']},x=>x.slice(8)+'. Okt.')].map(x=>x.text)
 assert.deepEqual(dotted,['Emma has Biology (class) at 1:00 PM–1:50 PM on 12. Okt..'])
})
console.log(passed+'/4 clash groups passed.')
