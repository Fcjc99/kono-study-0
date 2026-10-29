// Actual application functions with isolated fixtures; no browser or user-data writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,URL,crypto:{randomUUID},console})
 return module.exports
}
// Lock-screen reminders: what the app queues for the week, and how the server sends due ones.
const model=load('src/store/model.ts'),{buildReminders}=load('src/store/pushReminders.ts'),{sendDueReminders,sameSecret,reminderPayload}=load('src/store/pushSender.ts')
const now=new Date('2026-09-28T06:00:00')  // a Monday, 6 AM on this device
const data=model.createFreshData(),id=data.activeProfileId
data.subjects.push({id:'bio',profileId:id,name:'Biology',color:'#4169a8',resources:[]})
data.tasks.push({id:'t1',profileId:id,subjectId:'bio',title:'Lab report',due:'2026-09-28',done:false,notes:''},{id:'t2',profileId:id,subjectId:'bio',title:'Read ch. 4',due:'2026-09-28',done:false,notes:'',plannedTime:'16:00',estimatedMinutes:30},{id:'t3',profileId:id,subjectId:'',title:'Finished thing',due:'2026-09-28',done:true,notes:''})
data.exams.push({id:'e1',profileId:id,subjectId:'bio',title:'Bio quiz',due:'2026-09-30',done:false,notes:''})
data.studySeasons=[{id:'s',profileId:id,name:'Fall',start:'2026-09-01',end:'2026-12-20',active:true,week:{...model.blankWeek(),Monday:[{id:'b1',label:'Biology',start:'09:00',end:'10:15',kind:'study',location:'North Hall 235'},{id:'b2',label:'Lunch',start:'12:00',end:'12:30',kind:'break'}],Wednesday:[{id:'b1w',label:'Biology',start:'09:00',end:'10:15',kind:'study',skippedDates:['2026-09-30']}]}}]
const rows=buildReminders(data,now)
const find=title=>rows.find(r=>r.title===title)
assert.ok(find('2 things due today'),'one summary for everything due today');assert.equal(find('2 things due today').body,'Lab report, Read ch. 4')
assert.equal(new Date(find('2 things due today').sendAt).getHours(),7)
const cls=rows.filter(r=>r.title==='Class in 15 min: Biology')
assert.equal(new Date(cls[0].sendAt).getHours()*60+new Date(cls[0].sendAt).getMinutes(),8*60+45);assert.equal(cls[0].body,'9:00 AM · North Hall 235')
assert.ok(!rows.some(r=>/Lunch/.test(r.title)),'breaks get no reminder')
assert.ok(!rows.some(r=>r.tag==='class-b1w-2026-09-30'),'a class skipped that day gets no reminder')
assert.ok(find('Time to start: Read ch. 4'));assert.equal(new Date(find('Time to start: Read ch. 4').sendAt).getHours(),16)
const quiz=find('Tomorrow: Bio quiz');assert.ok(quiz);assert.equal(quiz.body,'Biology');assert.equal(new Date(quiz.sendAt).toDateString(),new Date('2026-09-29T12:00:00').toDateString());assert.equal(new Date(quiz.sendAt).getHours(),19)
assert.ok(find('Due today: Bio quiz'),'an exam day also gets the morning note')
assert.ok(rows.every(r=>new Date(r.sendAt)>now),'nothing in the past')
assert.ok(rows.every((r,i)=>i===0||rows[i-1].sendAt<=r.sendAt),'in time order')
const late=buildReminders(data,new Date('2026-09-28T08:50:00'));assert.ok(!late.some(r=>r.tag==='class-b1-2026-09-28'),'a class that already started is skipped');assert.ok(!late.some(r=>r.tag==='due-2026-09-28'))
// Events: 15 minutes before by default, or the event's own "Remind me" (off is -1); leave-by when it has travel time.
{const ev=model.createFreshData(),pid=ev.activeProfileId
 ev.calendarEvents.push({id:'ev1',profileId:pid,date:'2026-09-28',time:'15:30',endTime:'16:30',title:'Dentist',kind:'appointment',notes:'',location:'Main St',travelMinutes:20},
  {id:'ev2',profileId:pid,date:'2026-09-29',time:'10:00',title:'Field trip',kind:'other',notes:'',remind:1440},
  {id:'ev3',profileId:pid,date:'2026-09-28',time:'18:00',title:'Quiet dinner',kind:'personal',notes:'',remind:-1},
  {id:'ev4',profileId:pid,date:'2026-09-28',time:'12:00',title:'Lunch call',kind:'other',notes:'',remind:0})
 const r=buildReminders(model.normalizeData(ev),now),tag=t=>r.find(x=>x.tag===t)
 const dentist=tag('event-ev1');assert.equal(dentist.title,'In 15 min: Dentist');assert.equal(new Date(dentist.sendAt).getHours()*60+new Date(dentist.sendAt).getMinutes(),15*60+15)
 assert.equal(dentist.body,'3:30 PM–4:30 PM · Main St · Leave by 3:10 PM')
 const trip=tag('event-ev2');assert.equal(trip.title,'In 1 day: Field trip');assert.equal(new Date(trip.sendAt).toDateString(),new Date('2026-09-28T12:00:00').toDateString())
 assert.ok(!tag('event-ev3'),'Remind me: Off');assert.equal(tag('event-ev4').title,'Now: Lunch call')
}
// The push message: plain for Chrome/Firefox, plus Declarative Web Push (Safari, iOS 18.4+) when the site's address is known.
{const plain=JSON.parse(reminderPayload({title:'T',body:'B',tag:'x'}));assert.equal(plain.title,'T');assert.equal(plain.web_push,undefined)
 const dwp=JSON.parse(reminderPayload({title:'T',body:'B',tag:'x'},'https://kono.example.com'))
 assert.equal(dwp.web_push,8030);assert.equal(dwp.title,'T');assert.equal(dwp.notification.title,'T');assert.equal(dwp.notification.navigate,'https://kono.example.com/?page=planner');assert.equal(dwp.notification.tag,'x')
 assert.equal(JSON.parse(reminderPayload({title:'T',body:'B',tag:null},'http://insecure')).web_push,undefined,'https only')}
// Monday morning: the week ahead, in due-date order.
const week=rows.find(r=>r.tag==='week-2026-09-28')
assert.ok(week,'a Monday summary');assert.equal(week.title,'This week: 2 assignments, 1 exam')
assert.equal(week.body,'Lab report (Mon), Read ch. 4 (Mon), Bio quiz (Wed)');assert.equal(new Date(week.sendAt).getHours()*60+new Date(week.sendAt).getMinutes(),6*60+55)
assert.equal(rows.filter(r=>r.tag.startsWith('week-')).length,1,'only on Mondays')
// KONO's notes: when KONO will be hungry or lonely at 4:30 PM, one a day, and they can be turned off.
{const pet=model.createFreshData(),pid=pet.activeProfileId
 pet.konoCare={[pid]:{profileId:pid,log:[{id:'f',kind:'feed',at:'2026-09-27T12:00:00.000Z',taskId:'x'}]}}
 const notes=buildReminders(pet,now).filter(r=>r.tag.startsWith('kono-'))
 assert.ok(notes.length>=1&&notes.length<=3,'up to one KONO note a day for three days: '+notes.length)
 assert.match(notes[0].title,/^KONO (is getting hungry 🍙|misses you 💛)$/)
 assert.ok(notes.every(r=>new Date(r.sendAt).getHours()===16&&new Date(r.sendAt).getMinutes()===30))
 pet.settings.konoNotes=false
 assert.equal(buildReminders(pet,now).filter(r=>r.tag.startsWith('kono-')).length,0,'off means off')
 assert.equal(model.normalizeData?model.normalizeData(JSON.parse(JSON.stringify(pet))).settings.konoNotes:false,false,'the setting is saved')
 assert.equal(buildReminders(model.createFreshData(),now).filter(r=>r.tag.startsWith('kono-')).length,0,'no care log, no notes')}
{// Work shifts: nothing arrives mid-shift, and a long shift gets a heads-up the evening before.
 const job=model.createFreshData(),jid=job.activeProfileId
 job.studySeasons=[{id:'w',profileId:jid,name:'Cafe · work',start:'2026-09-01',end:'2026-12-20',active:true,week:{...model.blankWeek(),Monday:[{id:'wm',label:'Cafe',start:'15:00',end:'19:00',kind:'routine'}],Wednesday:[{id:'ww',label:'Cafe',start:'12:00',end:'18:00',kind:'routine'}]}}]
 job.tasks.push({id:'j1',profileId:jid,subjectId:'',title:'Essay',due:'2026-09-28',done:false,notes:'',plannedTime:'16:00'},{id:'j2',profileId:jid,subjectId:'',title:'Lab',due:'2026-10-01',done:false,notes:''})
 const r=buildReminders(job,now),start=r.find(x=>x.title==='Time to start: Essay')
 assert.equal(new Date(start.sendAt).getHours(),19,'a reminder that falls in a shift waits until the shift ends')
 const eve=r.find(x=>x.tag==='shift-2026-09-30');assert.ok(eve,'a heads-up before a 6-hour shift with work due')
 assert.equal(new Date(eve.sendAt).toDateString(),new Date('2026-09-29T12:00:00').toDateString());assert.equal(new Date(eve.sendAt).getHours()*60+new Date(eve.sendAt).getMinutes(),19*60+10)
 assert.match(eve.body,/^Cafe 12:00 PM–6:00 PM\. Due by Thu: Lab\./)
 assert.ok(!r.some(x=>x.tag==='shift-2026-09-28'),'no heads-up for a shift whose evening before has passed')}
const quiet=model.createFreshData();assert.ok(!buildReminders(quiet,now).some(r=>r.tag.startsWith('week-')),'nothing due: no Monday summary')
console.log('PASS reminder planner: work shifts respected, morning summary, exam eve, classes 15 min before, study blocks, skipped/breaks/past left out')

{
 // A rotating school: Duxbury High's 7-day rotation, with Monday September 28 as Day 4.
 const {academicTemplate}=load('src/store/academicCatalog.ts'),b=load('src/store/bellSchedules.ts')
 const plan=model.createFreshData(),dhs=academicTemplate(plan.activeProfileId,'duxburyhs-2026')
 const season={...dhs,active:true,school:{...dhs.school,grade:'10',anchorDate:'2026-09-28',anchorDay:'Day 4'}}
 const names=['Chemistry I','US History II','English 10','Spanish III','Algebra II','Ceramics','Free']
 plan.studySeasons=[b.buildRotationWeek(season,names.map(label=>({label,location:'',lunchWave:1})))]
 const week=buildReminders(plan,new Date('2026-09-28T06:00:00')),eve=week.filter(r=>r.tag.startsWith('rotation-'))
 const monday=eve.find(r=>new Date(r.sendAt).getDate()===28)
 assert.equal(monday.title,'Tomorrow is Day 5');assert.equal(new Date(monday.sendAt).getHours()*60+new Date(monday.sendAt).getMinutes(),19*60+30)
 // Day 5 is classes 7-1-2-3-4 and class 7 is a free block, so the first class is Chemistry I in Block 2.
 assert.equal(monday.body,'First class: Chemistry I at 9:23 AM')
 assert.ok(!eve.some(r=>new Date(r.sendAt).getDay()===6),'no reminder the evening before a Sunday')
 assert.equal(eve.find(r=>new Date(r.sendAt).getDay()===0).title,'Tomorrow is Day 2','Sunday evening: Friday was Day 1, so Monday is Day 2')
 // Columbus Day (Monday, October 12) is a school holiday: the evening before says so.
 const holiday=buildReminders(plan,new Date('2026-10-10T08:00:00')).find(r=>r.tag.startsWith('rotation-')&&new Date(r.sendAt).getDate()===11)
 assert.equal(holiday.title,'No school tomorrow');assert.match(holiday.body,/Columbus|Indigenous/)
 // A weekly (Monday–Friday) school gets no rotation reminder.
 assert.ok(!rows.some(r=>r.tag.startsWith('rotation-')))
 console.log('PASS rotating school: the evening before says which day tomorrow is and its first class, or that there is no school')
}

{
 // School days off and early releases: a week ahead for every school, and the evening before for a
 // Monday–Friday school too (a rotating one already says "No school tomorrow" / "Tomorrow is Day 3 · …").
 const {academicTemplate}=load('src/store/academicCatalog.ts'),{schoolChanges,changeTitle,changeDetail}=load('src/store/schoolHeadsUp.ts')
 const plan=model.createFreshData(),pid=plan.activeProfileId,dhs=academicTemplate(pid,'duxburyhs-2026')
 const rotation={...dhs,active:true,school:{...dhs.school,grade:'10',anchorDate:'2026-09-28',anchorDay:'Day 4'}}
 plan.studySeasons=[rotation]
 const fall=schoolChanges(plan,pid,'2026-11-20','2026-11-30')
 assert.equal(fall.map(c=>c.kind+':'+c.start+'..'+c.end).join(' '),'early:2026-11-25..2026-11-25 off:2026-11-26..2026-11-27','Thanksgiving is one run; the weekend is not a day off')
 assert.equal(changeTitle(fall[1]),'No school Thu, Nov 26 – Fri, Nov 27')
 assert.equal(changeDetail(fall[1]),'Thanksgiving recess · Duxbury High School')
 assert.equal(schoolChanges(plan,pid,'2027-02-15','2027-02-15')[0].days,5,'February break, Monday to Friday')
 assert.equal(schoolChanges(plan,pid,'2027-02-17','2027-02-20').length,0,'a break already under way is not announced again')
 const week=buildReminders(plan,new Date('2026-11-18T08:00:00'))
 const ahead=week.filter(r=>r.tag.startsWith('school-week-'))
 assert.equal(ahead.map(r=>new Date(r.sendAt).getDate()+' '+r.title).join(' | '),'18 Next week: Early release Wed, Nov 25 | 19 Next week: No school Thu, Nov 26 – Fri, Nov 27')
 assert.equal(new Date(ahead[0].sendAt).getHours()*60+new Date(ahead[0].sendAt).getMinutes(),18*60+30)
 assert.equal(week.filter(r=>r.tag.startsWith('school-eve-')).length,0,'a rotating school gets the evening before from its own reminder')
 // The same calendar as a plain Monday–Friday school.
 plan.studySeasons=[{...rotation,school:{...rotation.school,pattern:'weekly',cycle:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']}}]
 const eve=buildReminders(plan,new Date('2026-11-23T08:00:00')).filter(r=>r.tag.startsWith('school-eve-'))
 assert.equal(eve.map(r=>new Date(r.sendAt).getDate()+' '+r.title).join(' | '),'24 Early release tomorrow | 25 No school tomorrow through Friday')
 assert.equal(eve[1].body,'Thanksgiving recess · Duxbury High School')
 assert.equal(new Date(eve[0].sendAt).getHours(),19)
 console.log('PASS school days off and early releases: one run per break, a week ahead at 6:30 PM, and the evening before for a weekly school')
}

{
 // Homework the night before, and (parent mode) the family's week ahead on Sunday evening.
 const plan=model.createFreshData(),pid=plan.activeProfileId
 plan.subjects.push({id:'eng',profileId:pid,name:'English',color:'#000',resources:[]})
 plan.kids.push({id:'k1',profileId:pid,name:'Maya',color:'#7ca982',emoji:'🦊'},{id:'k2',profileId:pid,name:'Theo',color:'#d9908c'})
 plan.tasks.push(
  {id:'h1',profileId:pid,subjectId:'eng',kidId:'k1',title:'Essay outline',due:'2026-10-05',done:false,notes:''},
  {id:'h2',profileId:pid,subjectId:'',kidId:'k2',title:'Math sheet',due:'2026-10-06',done:false,notes:''},
  {id:'h3',profileId:pid,subjectId:'',title:'Permission slip',due:'2026-10-06',done:false,notes:''},
  {id:'h4',profileId:pid,subjectId:'',kidId:'k1',title:'Finished already',due:'2026-10-06',done:true,notes:''})
 plan.exams.push({id:'x1',profileId:pid,subjectId:'',kidId:'k2',title:'Spelling test',due:'2026-10-08',done:false,notes:''})
 const sunday=new Date('2026-10-04T09:00:00')
 const rows=buildReminders(plan,sunday),tagged=t=>rows.find(r=>r.tag===t)
 const one=tagged('homework-2026-10-04')
 assert.equal(one.title,'Due tomorrow: Essay outline');assert.equal(one.body,'English')
 assert.equal(new Date(one.sendAt).getHours()*60+new Date(one.sendAt).getMinutes(),19*60+5)
 const two=tagged('homework-2026-10-05');assert.equal(two.title,'2 assignments due tomorrow');assert.equal(two.body,'Math sheet, Permission slip','done work is left out')
 assert.ok(!rows.some(r=>r.tag==='homework-2026-10-06'),'nothing due Wednesday: no reminder Tuesday night')
 assert.ok(!rows.some(r=>r.tag.startsWith('family-week-')),'only in parent mode')
 plan.settings.parentMode=true
 const family=buildReminders(plan,sunday).find(r=>r.tag==='family-week-2026-10-04')
 assert.equal(family.title,'Family week ahead');assert.equal(new Date(family.sendAt).getHours(),18);assert.equal(new Date(family.sendAt).getDay(),0)
 assert.equal(family.body,'🦊 Maya: 1 due · Theo: 2 due · Everyone: 1 due · Tests: Spelling test (Thu)')
 assert.equal(buildReminders(plan,sunday).filter(r=>r.tag.startsWith('family-week-')).length,1,'once a week')
 // Maya has a plan of her own: the parent hears about her test the evening before, and her week counts.
 const mayaPlan={id:'p-maya',name:'Maya',label:'Maya’s plan',kind:'school',start:plan.profiles[0].start,end:plan.profiles[0].end,kidId:'k1'}
 plan.profiles.push(mayaPlan)
 plan.exams.push({id:'x2',profileId:'p-maya',subjectId:'',title:'Fractions quiz',due:'2026-10-07',done:false,notes:''})
 plan.tasks.push({id:'h5',profileId:'p-maya',subjectId:'',title:'Reading log',due:'2026-10-07',done:false,notes:''})
 const withKidPlan=buildReminders(plan,sunday)
 const heads=withKidPlan.find(r=>r.tag==='kid-test-k1-2026-10-06')
 assert.equal(heads.title,'🦊 Maya has a test tomorrow');assert.equal(heads.body,'Fractions quiz');assert.equal(new Date(heads.sendAt).getHours()*60+new Date(heads.sendAt).getMinutes(),19*60+15)
 assert.match(withKidPlan.find(r=>r.tag==='family-week-2026-10-04').body,/🦊 Maya: 3 due/)
 assert.ok(!withKidPlan.some(r=>r.title==='Due tomorrow: Reading log'),'the parent’s phone doesn’t get the kid’s homework reminders')
 // Maya's iPad, on her plan: her own reminders, nothing for the family.
 const ipad=buildReminders({...plan,activeProfileId:'p-maya'},sunday)
 assert.ok(ipad.some(r=>r.tag==='exam-2026-10-06'&&r.title==='Tomorrow: Fractions quiz'),'her test, the night before')
 assert.ok(ipad.some(r=>r.title==='Due tomorrow: Reading log'))
 assert.ok(!ipad.some(r=>/^family-|^kid-test-/.test(r.tag)),'no family reminders in a kid’s plan')
 // A test the parent tagged for Maya in the family plan reaches her iPad too.
 plan.exams.push({id:'x3',profileId:pid,subjectId:'',kidId:'k1',title:'Spelling bee',due:'2026-10-07',done:false,notes:''})
 const ipad2=buildReminders({...plan,activeProfileId:'p-maya'},sunday)
 assert.equal(ipad2.find(r=>r.tag==='exam-2026-10-06').title,'2 exams or tests tomorrow')
 console.log('PASS the night before: still-open homework due tomorrow at 7:05 PM; parents get the family week ahead on Sunday at 6 PM, and a heads-up for a kid’s test; a kid’s device gets only the kid’s plan')
}

;(async()=>{
 const sent=[],forgotten=[]
 const due=[{endpoint:'https://push/a',p256dh:'k',auth:'a',title:'Due today: Essay',body:'ENGL',tag:'due'},{endpoint:'https://push/gone',p256dh:'k',auth:'a',title:'One',body:'',tag:null},{endpoint:'https://push/gone',p256dh:'k',auth:'a',title:'Two',body:'',tag:null},{endpoint:'https://push/flaky',p256dh:'k',auth:'a',title:'Three',body:'',tag:null}]
 const result=await sendDueReminders({claim:async()=>due,forget:async e=>{forgotten.push(e)},send:async(sub,payload)=>{if(sub.endpoint.endsWith('gone'))throw Object.assign(Error('gone'),{statusCode:410});if(sub.endpoint.endsWith('flaky'))throw Object.assign(Error('busy'),{statusCode:503});sent.push([sub.endpoint,JSON.parse(payload)])}})
 assert.equal(result.sent,1);assert.equal(result.failed,1);assert.equal(result.forgotten,1)
 assert.equal(sent[0][1].title,'Due today: Essay');assert.equal(forgotten.join(),'https://push/gone','a gone device is forgotten once, and not retried')
 assert.equal(sameSecret('abc123','abc123'),true);assert.equal(sameSecret('abc123','abc124'),false);assert.equal(sameSecret('',''),false);assert.equal(sameSecret('abc','abcd'),false)
 console.log('PASS reminder sender: sends each, forgets gone devices, keeps going after errors; secrets compared safely')
})().catch(e=>{console.error(e);process.exit(1)})

{
 // Family to-dos: a morning reminder on their day, and on each turn of a repeating one.
 const plan=model.createFreshData(),pid=plan.activeProfileId
 plan.familyTodos=[{id:'t1',profileId:pid,title:'Trash out',done:false,due:'2026-10-05',repeat:'week',weekly:true},{id:'t2',profileId:pid,title:'Return library books',done:false,due:'2026-10-06'},{id:'t3',profileId:pid,title:'Done already',done:true,due:'2026-10-05'}]
 const rows=buildReminders(plan,new Date('2026-10-04T09:00:00'),10)
 const mon=rows.find(r=>r.tag==='todo-2026-10-05'),tue=rows.find(r=>r.tag==='todo-2026-10-06'),nextMon=rows.find(r=>r.tag==='todo-2026-10-12')
 assert.ok(mon&&/^To-do today: Trash out$/.test(mon.title),'the to-do on its day: '+JSON.stringify(mon))
 assert.ok(tue&&tue.title==='To-do today: Return library books')
 assert.ok(nextMon,'a weekly to-do comes back on its next turn')
 assert.equal(new Date(mon.sendAt).getHours(),8)
 console.log('PASS family to-dos: a reminder at 8 AM on their day, and on each turn of a repeating one; ticked ones don’t remind')
}
