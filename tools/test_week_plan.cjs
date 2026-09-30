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
const model=load('src/store/model.ts'),wp=load('src/store/weekPlan.ts'),{buildReminders}=load('src/store/pushReminders.ts')
const today='2026-09-28' // a Monday
const opts={weekday:{from:'15:30',to:'21:30'},weekend:{from:'10:00',to:'20:00'},maxPerDay:120}
function fixture(){
 const d=model.createFreshData(),id=d.activeProfileId
 d.subjects.push({id:'bio',profileId:id,name:'Biology',color:'#4169a8',resources:[]},{id:'eng',profileId:id,name:'English',color:'#b65f3a',resources:[]})
 d.tasks.push(
  {id:'essay',profileId:id,subjectId:'eng',title:'Essay draft',due:'2026-10-01',done:false,notes:'',estimatedMinutes:120},
  {id:'lab',profileId:id,subjectId:'bio',title:'Lab report',due:'2026-09-29',done:false,notes:''},
  {id:'done',profileId:id,subjectId:'bio',title:'Finished',due:'2026-09-29',done:true,notes:''},
  {id:'timed',profileId:id,subjectId:'bio',title:'Already timed',due:'2026-09-29',done:false,notes:'',plannedTime:'20:00',estimatedMinutes:30},
  {id:'far',profileId:id,subjectId:'bio',title:'Far away',due:'2026-11-20',done:false,notes:''})
 d.exams.push({id:'bioexam',profileId:id,subjectId:'bio',title:'Bio exam',due:'2026-10-02',done:false,notes:''},{id:'todayexam',profileId:id,subjectId:'bio',title:'Quiz today',due:today,done:false,notes:''})
 d.studySeasons=[{id:'s',profileId:id,name:'Fall',start:'2026-09-01',end:'2026-12-20',active:true,week:{...model.blankWeek(),Monday:[{id:'soccer',label:'Soccer practice',start:'15:30',end:'17:00',kind:'hobby'},{id:'brk',label:'Snack',start:'17:00',end:'17:30',kind:'break'}]}}]
 d.calendarEvents.push({id:'dent',profileId:id,date:'2026-09-29',title:'Dentist',kind:'appointment',notes:'',time:'18:00',endTime:'19:00'})
 return d
}
const mins=s=>wp.toMinutes(s.end)-wp.toMinutes(s.start)

test('The work list: unfinished assignments and exams due soon, not ones already timed, done, far off or an exam today',()=>{
 const work=wp.weekWork(fixture(),today)
 assert.equal(work.map(w=>w.ref).join(','),'task:lab,task:essay,exam:bioexam')
 assert.equal(work.find(w=>w.ref==='task:lab').minutes,45,'an assignment without an estimate gets 45 minutes')
 assert.equal(work.find(w=>w.ref==='task:essay').minutes,120);assert.equal(work.find(w=>w.ref==='exam:bioexam').minutes,180)
 assert.equal(work.find(w=>w.ref==='task:essay').subject,'English')
})
test('Free time: the study window minus classes, events and timed assignments (with a 10-minute cushion); breaks stay free',()=>{
 const slots=wp.freeSlots(fixture(),today,'08:00',opts)
 const mon=slots.filter(s=>s.date===today).map(s=>s.start+'-'+s.end).join(' ')
 assert.equal(mon,'17:10-21:30','after soccer (a break is not busy)')
 const tue=slots.filter(s=>s.date==='2026-09-29').map(s=>s.start+'-'+s.end).join(' ')
 assert.equal(tue,'15:30-17:50 19:10-19:50 20:40-21:30','around the dentist and the timed assignment')
 assert.equal(slots.filter(s=>s.date==='2026-10-03')[0].start,'10:00','weekends use the weekend hours')
 assert.equal(wp.freeSlots(fixture(),today,'18:02',opts).filter(s=>s.date===today)[0].start,'18:15','today starts from the next quarter hour')
 assert.equal(new Set(slots.map(s=>s.date)).size,7)
})
test('KONO’s own plan: soonest due first, inside free time, before each due date, exam review on different days, daily limit kept',()=>{
 const d=fixture(),work=wp.weekWork(d,today),slots=wp.freeSlots(d,today,'08:00',opts),plan=wp.planWeekSimple(work,slots,opts.maxPerDay)
 assert.ok(plan.length>=5)
 for(const s of plan){
  assert.ok(slots.some(f=>f.date===s.date&&f.start<=s.start&&s.end<=f.end),'inside free time: '+s.date+' '+s.start)
  const w=work.find(x=>x.ref===s.ref);assert.ok(w.kind==='exam'?s.date<w.due:s.date<=w.due,'before due: '+s.title)
 }
 const days=new Map();for(const s of plan)days.set(s.date,(days.get(s.date)??0)+mins(s))
 for(const [date,total] of days)assert.ok(total<=opts.maxPerDay,date+' is over the daily limit')
 const exam=plan.filter(s=>s.ref==='exam:bioexam');assert.equal(new Set(exam.map(s=>s.date)).size,exam.length,'one exam review a day')
 assert.equal(plan.filter(s=>s.ref==='task:lab').reduce((n,s)=>n+mins(s),0),45,'the lab report gets its 45 minutes')
 assert.ok(plan.find(s=>s.ref==='task:lab').date<='2026-09-29')
 for(const a of plan)for(const b of plan)if(a!==b&&a.date===b.date)assert.ok(a.end<=b.start||b.end<=a.start,'no overlaps')
 assert.match(plan.find(s=>s.ref==='exam:bioexam').title,/^Review for Bio exam/)
})
test('The AI’s plan is checked: sessions outside free time, after the due date, overlapping, over the limit or for unknown work are dropped',()=>{
 const d=fixture(),work=wp.weekWork(d,today),slots=wp.freeSlots(d,today,'08:00',opts)
 const answer=JSON.stringify({sessions:[
  {ref:'task:lab',date:'2026-09-28',start:'17:15',minutes:45,focus:'Write the lab conclusion'},
  {ref:'task:lab',date:'2026-09-28',start:'16:00',minutes:30,focus:'During soccer'},
  {ref:'task:essay',date:'2026-09-28',start:'17:30',minutes:40,focus:'Overlaps the lab session'},
  {ref:'task:essay',date:'2026-10-02',start:'16:00',minutes:60,focus:'After it is due'},
  {ref:'exam:bioexam',date:'2026-10-02',start:'16:00',minutes:30,focus:'On the exam day'},
  {ref:'exam:bioexam',date:'2026-09-30',start:'16:00',minutes:60,focus:'Flashcards: cells'},
  {ref:'exam:bioexam',date:'2026-09-30',start:'17:15',minutes:70,focus:'Over the 2 h limit'},
  {ref:'task:nope',date:'2026-09-30',start:'19:00',minutes:30,focus:'Unknown'},
  {ref:'task:essay',date:'2026-09-29',start:'9:05',minutes:30,focus:'Before school hours'},
  {ref:'task:essay',date:'2026-09-29',start:'15:30',minutes:500,focus:'Outline the essay'}]})
 const plan=wp.parseWeekPlan(answer,work,slots,opts.maxPerDay)
 assert.equal(plan.map(s=>s.title).join(' | '),'Write the lab conclusion | Outline the essay | Flashcards: cells')
 assert.equal(plan[1].end,'17:00','a too-long session is capped at 90 minutes')
 assert.throws(()=>wp.parseWeekPlan('not json',work,slots,120),/valid JSON/)
 assert.throws(()=>wp.parseWeekPlan('{"plan":[]}',work,slots,120),/expected format/)
 const prompt=wp.weekPlanPrompt(work,slots,120,today)
 assert.match(prompt,/"ref":"exam:bioexam"/);assert.match(prompt,/"weekday":"Monday","start":"17:10","end":"21:30"/);assert.match(prompt,/at most 120 minutes/)
})
test('Adding the plan: timed study events linked to their work; planning again only fills what’s left; clearing removes upcoming ones',()=>{
 const d=fixture(),id=d.activeProfileId,work=wp.weekWork(d,today),slots=wp.freeSlots(d,today,'08:00',opts)
 const plan=wp.planWeekSimple(work,slots,opts.maxPerDay);plan[plan.length-1].include=false
 const {data:next,added}=wp.applyWeekPlan(d,id,plan,work)
 assert.equal(added,plan.length-1)
 const ev=next.calendarEvents.filter(e=>e.planFor)
 assert.equal(ev.length,plan.length-1);assert.equal(ev[0].kind,'study');assert.ok(ev[0].time&&ev[0].endTime)
 const lab=ev.find(e=>e.planFor==='task:lab');assert.equal(lab.subjectId,'bio');assert.match(lab.notes,/^For Lab report · due 2026-09-29/)
 assert.equal(wp.applyWeekPlan(next,id,plan,work).added,0,'adding the same plan twice adds nothing')
 const again=wp.weekWork(next,today)
 assert.ok(!again.some(w=>w.ref==='task:lab'),'fully planned work drops out');
 const skipped=plan[plan.length-1];assert.ok(again.some(w=>w.ref===skipped.ref),'unticked time is still to plan')
 const tueFree=wp.freeSlots(next,today,'08:00',opts).filter(s=>s.date===lab.date)
 assert.ok(!tueFree.some(s=>s.start<=lab.time&&lab.endTime<=s.end),'a planned session is no longer free time')
 assert.equal(model.normalizeData(next).calendarEvents.filter(e=>e.planFor).length,ev.length,'the link survives saving')
 const bad=structuredClone(next);bad.calendarEvents[0].planFor='bogus value';assert.equal(model.normalizeData(bad).calendarEvents[0].planFor,undefined)
 assert.equal(wp.upcomingPlanned(next,today).length,ev.length)
 const cleared=wp.clearUpcomingPlanned(next,today);assert.equal(cleared.calendarEvents.filter(e=>e.planFor).length,0);assert.ok(cleared.calendarEvents.some(e=>e.id==='dent'),'other events are kept')
 const unfit=wp.unplanned(work,plan);assert.ok(unfit.every(x=>x.left>=15))
 assert.throws(()=>wp.applyWeekPlan({...d,activeProfileId:'other'},id,plan,work),/plan changed/)
})
test('Lock-screen reminders: each planned session sends "Study time" when it starts',()=>{
 const d=fixture(),id=d.activeProfileId,work=wp.weekWork(d,today),plan=wp.planWeekSimple(work,wp.freeSlots(d,today,'08:00',opts),opts.maxPerDay)
 const {data:next}=wp.applyWeekPlan(d,id,plan,work)
 const rows=buildReminders(next,new Date(today+'T06:00:00'))
 const first=next.calendarEvents.filter(e=>e.planFor).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0]
 const r=rows.find(x=>x.tag==='study-'+first.id)
 assert.ok(r);assert.equal(r.title,'Study time: '+first.title);assert.match(r.body,/–.* · For /)
 const at=new Date(r.sendAt);assert.equal(String(at.getHours()).padStart(2,'0')+':'+String(at.getMinutes()).padStart(2,'0'),first.time)
})
test('Week drag and drop: events move keeping their length; an assignment gets a planned time on its day, a study session before it, and asks before moving its due date; exams get study time before',()=>{
 const {weekDrop}=load('src/store/weekDrop.ts')
 const ev=weekDrop('calendarEvents',{id:'e',title:'Tutoring',time:'15:00',endTime:'16:30'},'2026-10-01','10:00','p')
 assert.equal(ev.kind,'patch');assert.equal(JSON.stringify(ev.changes),JSON.stringify({date:'2026-10-01',time:'10:00',endTime:'11:30'}))
 const task={id:'t1',title:'Math worksheet',due:'2026-10-01',estimatedMinutes:45,subjectId:'math'}
 const same=weekDrop('tasks',task,'2026-10-01','15:00','p');assert.equal(same.kind,'patch');assert.equal(same.changes.plannedTime,'15:00')
 const before=weekDrop('tasks',task,'2026-09-29','16:00','p');assert.equal(before.kind,'session')
 assert.equal(before.event.title,'Work on Math worksheet');assert.equal(before.event.planFor,'task:t1');assert.equal(before.event.kind,'study')
 assert.equal(before.event.endTime,'16:45','as long as the assignment is estimated');assert.equal(before.event.subjectId,'math');assert.equal(before.event.date,'2026-09-29')
 const after=weekDrop('tasks',task,'2026-10-03','09:00','p');assert.equal(after.kind,'move-due');assert.equal(after.changes.due,'2026-10-03');assert.match(after.question,/Math worksheet/)
 const exam={id:'x1',title:'Bio test',due:'2026-10-02'}
 const study=weekDrop('exams',exam,'2026-09-30','19:00','p');assert.equal(study.kind,'session');assert.equal(study.event.title,'Study for Bio test');assert.equal(study.event.endTime,'20:00');assert.equal(study.event.planFor,'exam:x1')
 assert.equal(weekDrop('exams',exam,'2026-10-02','08:00','p').kind,'none','nothing to plan on the exam day itself')
 assert.equal(weekDrop('notes',{id:'n'},'2026-10-02','08:00','p').kind,'none')
 // A late-evening session never runs past midnight.
 assert.equal(weekDrop('tasks',{...task,estimatedMinutes:120},'2026-09-29','23:00','p').event.endTime,'23:59')
 // It saves: the session passes the plan's own checks.
 const data=model.createFreshData();data.tasks.push({...task,profileId:data.activeProfileId,subjectId:'',done:false,notes:''})
 const session=weekDrop('tasks',{...task,subjectId:''},'2026-09-29','16:00',data.activeProfileId).event
 assert.equal(model.normalizeData({...data,calendarEvents:[session]}).calendarEvents[0].planFor,'task:t1')
})
console.log(passed+'/7 plan-my-week regression groups passed.')
