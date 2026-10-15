// Sick days, snow days and days off (store/daysOff): classes skipped or the school closed, events off, and all of it undone.
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
const off=load('src/store/daysOff.ts'),model=load('src/store/model.ts'),{classOccurrences}=load('src/store/classSchedule.ts')
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const fixture=()=>{
 const d=model.createFreshData(),pid=d.activeProfileId
 d.kids=[{id:'emma',profileId:pid,name:'Emma',color:'#7ca982'},{id:'leo',profileId:pid,name:'Leo',color:'#d9908c'}]
 const week=(label,extra={})=>({Monday:[{id:label,label,start:'09:00',end:'10:00',kind:'study',...extra}],Sunday:[],Tuesday:[],Wednesday:[],Thursday:[],Friday:[],Saturday:[]})
 d.studySeasons=[{id:'e',profileId:pid,name:'Emma school',start:'2026-09-01',end:'2026-12-20',active:true,week:week('Math'),kidId:'emma'},{id:'l',profileId:pid,name:'Leo school',start:'2026-09-01',end:'2026-12-20',active:true,week:week('Art'),kidId:'leo'},{id:'w',profileId:pid,name:'Work',start:'2026-09-01',end:'2026-12-20',active:true,week:week('Shift')}]
 d.calendarEvents=[{id:'s',profileId:pid,date:'2026-10-19',title:'Soccer',kind:'sports',notes:'',kidId:'emma',time:'16:00'},{id:'b',profileId:pid,date:'2026-10-19',title:'Both',kind:'other',notes:'',kidIds:['emma','leo']}]
 return {d:model.normalizeData(d),pid}
}
const skipped=(d,pid,date)=>classOccurrences({activeProfileId:pid,studySeasons:d.studySeasons},date).filter(c=>c.block.skippedDates?.includes(date)).map(c=>c.block.label).sort()
test('a sick kid: only their classes are skipped and only their events are off; taking it back undoes it',()=>{
 const {d,pid}=fixture(),sick=off.addDayOff(d,pid,'2026-10-19',['emma'],'sick')
 assert.deepEqual(skipped(sick,pid,'2026-10-19'),['Math'])
 assert.equal(off.eventOff(sick,pid,sick.calendarEvents[0]),true);assert.equal(off.eventOff(sick,pid,sick.calendarEvents[1]),false,'Leo is still going')
 assert.equal(off.dayOffLabel(sick,sick.daysOff[0]),'Emma is out sick')
 assert.equal(model.normalizeData(JSON.parse(JSON.stringify(sick))).daysOff.length,1,'it survives a save')
 const back=off.removeDayOff(sick,sick.daysOff[0].id)
 assert.deepEqual(skipped(back,pid,'2026-10-19'),[]);assert.equal(back.daysOff.length,0)
})
test('a class already skipped stays skipped when the day off is taken back',()=>{
 const {d,pid}=fixture();d.studySeasons[0].week.Monday[0].skippedDates=['2026-10-19']
 const back=off.removeDayOff(off.addDayOff(d,pid,'2026-10-19',['emma'],'sick'),'x')
 const again=off.addDayOff(d,pid,'2026-10-19',['emma'],'sick'),undone=off.removeDayOff(again,again.daysOff[0].id)
 assert.deepEqual(skipped(undone,pid,'2026-10-19'),['Math']);assert.ok(back)
})
test('everyone off: every kid’s classes, not your own work; a snow day closes schools instead',()=>{
 const {d,pid}=fixture(),all=off.addDayOff(d,pid,'2026-10-19',[],'off')
 assert.deepEqual(skipped(all,pid,'2026-10-19'),['Art','Math'],'not the work shift')
 assert.equal(off.dayOffLabel(all,all.daysOff[0]),'Day off for everyone')
 d.studySeasons[0].school={pattern:'rotation',name:'Hill',grade:'3',cycle:['A','B'],anchorDate:'2026-10-19',anchorDay:'A',weekdays:[1,2,3,4,5],snowAdvances:false,lastClassDate:'2026-12-18',exceptions:[]}
 d.studySeasons[0].week={A:[{id:'m',label:'Math',start:'09:00',end:'10:00',kind:'study'}],B:[{id:'r',label:'Reading',start:'09:00',end:'10:00',kind:'study'}]}
 const fresh=model.normalizeData(d),snow=off.addDayOff(fresh,pid,'2026-10-19',[],'snow')
 assert.deepEqual(classOccurrences({activeProfileId:pid,studySeasons:snow.studySeasons},'2026-10-19').filter(c=>c.season.id==='e').length,0,'school closed')
 assert.equal(classOccurrences({activeProfileId:pid,studySeasons:snow.studySeasons},'2026-10-20').find(c=>c.season.id==='e').block.label,'Math','the rotation waits a day')
 assert.equal(off.eventOff(snow,pid,snow.calendarEvents[0]),false,'a snow day leaves events alone')
 const back=off.removeDayOff(snow,snow.daysOff[0].id)
 assert.equal(back.studySeasons[0].school.exceptions.length,0)
})
test('a kid’s own plan sees the family’s day off',()=>{
 const {d,pid}=fixture();d.profiles.push({id:'emma-plan',name:'Emma',label:'Emma',kind:'custom',start:'2026-09-01',end:'2027-06-30',kidId:'emma'})
 const sick=off.addDayOff(model.normalizeData(d),pid,'2026-10-19',['emma'],'sick')
 assert.equal(off.daysOffOn(sick,'emma-plan','2026-10-19').length,1);assert.equal(off.isOut(sick,'emma-plan','2026-10-19',undefined),true)
})
console.log(passed+'/4 day-off groups passed.')
