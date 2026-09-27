// Actual application functions with isolated fixtures; no browser or user-data writes.
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
const model=load('src/store/model.ts'),{weekRecap,currentStreak,recapDay}=load('src/store/weekRecap.ts')
const today='2026-09-27' // a Sunday
const at=(date,time='15:00')=>new Date(date+'T'+time+':00').toISOString()
function fixture(){
 const d=model.createFreshData(),id=d.activeProfileId
 d.subjects.push({id:'bio',profileId:id,name:'Biology',color:'#4169a8',resources:[]},{id:'eng',profileId:id,name:'English',color:'#b65f3a',resources:[]})
 d.tasks.push(
  {id:'a',profileId:id,subjectId:'bio',title:'Lab 1',due:'2026-09-23',done:true,notes:'',completedAt:at('2026-09-22')},
  {id:'b',profileId:id,subjectId:'bio',title:'Lab 2',due:'2026-09-25',done:true,notes:'',completedAt:at('2026-09-25','23:30')},
  {id:'c',profileId:id,subjectId:'eng',title:'Essay',due:'2026-09-26',done:true,notes:'',completedAt:at('2026-09-26')},
  {id:'old',profileId:id,subjectId:'eng',title:'Last week',due:'2026-09-19',done:true,notes:'',completedAt:at('2026-09-20')},
  {id:'open',profileId:id,subjectId:'eng',title:'Reading',due:'2026-09-30',done:false,notes:''},
  {id:'far',profileId:id,subjectId:'eng',title:'Far',due:'2026-10-15',done:false,notes:''})
 d.exams.push({id:'q',profileId:id,subjectId:'bio',title:'Bio quiz',due:'2026-09-24',done:true,notes:''},{id:'chem',profileId:id,subjectId:'',title:'Chem test',due:'2026-10-01',done:false,notes:''},{id:'hist',profileId:id,subjectId:'',title:'History test',due:'2026-10-03',done:false,notes:''})
 d.calendarEvents.push(
  {id:'s1',profileId:id,date:'2026-09-24',title:'Review',kind:'study',notes:'',time:'16:00',endTime:'16:50'},
  {id:'s2',profileId:id,date:'2026-09-26',title:'Outline',kind:'study',notes:'',time:'10:00',endTime:'11:30'},
  {id:'s3',profileId:id,date:today,title:'Later today',kind:'study',notes:'',time:'18:00',endTime:'18:45'},
  {id:'s4',profileId:id,date:'2026-09-19',title:'Too early',kind:'study',notes:'',time:'10:00',endTime:'11:00'},
  {id:'p',profileId:id,date:'2026-09-25',title:'Practice',kind:'sports',notes:'',time:'16:00',endTime:'18:00'})
 const progress={unlockedStage:3,completionDates:{'2026-09-20':1,'2026-09-22':1,'2026-09-24':1,'2026-09-25':2,'2026-09-26':1}}
 return {d,progress}
}
test('The recap counts the last seven days: finished work by when it was finished, past study sessions, active days, streak and island',()=>{
 const {d,progress}=fixture(),r=weekRecap(d,today,progress)
 assert.equal(r.from,'2026-09-21');assert.equal(r.to,today)
 assert.equal(r.assignmentsDone,3,'finished this week, whatever the due date; last week’s is left out');assert.equal(r.examsDone,1)
 assert.equal(r.studySessions,2,'study sessions that already happened (not later today, not last week, not sports)');assert.equal(r.studyMinutes,140)
 assert.equal(r.days.map(x=>x.active?'x':'.').join(''),'.x.xxx.');assert.equal(r.activeDays,4)
 const moreDays=weekRecap(d,today,{...progress,completionDates:{'2026-09-24':1}});assert.equal(moreDays.days.map(x=>x.active?'x':'.').join(''),'.x.xxx.','a day with a finished assignment counts even if the island log missed it')
 assert.equal(r.streak,3,'Sep 24–26, counted from yesterday because nothing is finished yet today')
 assert.equal(r.grewThisWeek,5);assert.equal(r.islandStage,3);assert.equal(r.stageName,'Budding cherry tree')
 assert.equal(r.topSubject,'Biology')
 assert.equal(r.nextWeekDue,3,'the reading and two tests are due in the next 7 days');assert.equal(r.nextExam.title,'Chem test')
 assert.equal(r.headline,'Your island grew this week.')
})
test('Headlines: quiet week, every day, a big week, and a long streak',()=>{
 const {d}=fixture(),empty=model.createFreshData()
 assert.equal(weekRecap(empty,today,{unlockedStage:0,completionDates:{}}).headline,'A quiet week. Next week is a fresh start.')
 const all={};for(let i=0;i<7;i++)all[['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27'][i]]=1
 assert.equal(weekRecap(d,today,{unlockedStage:9,completionDates:all}).headline,'Seven days out of seven. What a week!')
 assert.equal(weekRecap(d,today,{unlockedStage:9,completionDates:all}).stageName,'Full bloom','the stage is kept in range')
 const busy=structuredClone(d);for(let i=0;i<10;i++)busy.tasks.push({id:'x'+i,profileId:d.activeProfileId,subjectId:'',title:'x',due:today,done:true,notes:'',completedAt:at('2026-09-23')})
 assert.equal(weekRecap(busy,today,{unlockedStage:1,completionDates:{'2026-09-23':1}}).headline,'A huge week. 13 assignments done!')
 const streak={'2026-09-22':1,'2026-09-23':1,'2026-09-24':1,'2026-09-25':1,'2026-09-26':1}
 assert.equal(currentStreak(streak,today),5);assert.equal(currentStreak({...streak,[today]:1},today),6);assert.equal(currentStreak({'2026-09-25':1},today),0)
 assert.equal(weekRecap(model.createFreshData(),today,{unlockedStage:0,completionDates:streak}).headline,'5 days in a row and counting.')
})
test('Another plan’s work is never counted, and the Sunday card shows on Sunday and Monday only',()=>{
 const {d,progress}=fixture(),other={...d,activeProfileId:'someone-else'}
 const r=weekRecap(other,today,progress);assert.equal(r.assignmentsDone+r.examsDone+r.studySessions+r.nextWeekDue,0)
 assert.equal(['2026-09-27','2026-09-28','2026-09-29','2026-10-03'].map(recapDay).join(','),'true,true,false,false')
})
console.log(passed+'/3 week-recap regression groups passed.')
