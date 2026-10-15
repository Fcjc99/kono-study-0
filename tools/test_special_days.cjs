// Birthdays & countdowns (store/specialDays), leave-by times (store/leaveBy) and the grandparents' page (store/familyPage).
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
const sd=load('src/store/specialDays.ts'),page=load('src/store/familyPage.ts'),lb=load('src/store/leaveBy.ts'),model=load('src/store/model.ts')
const b=(date,extra={})=>({id:'b1',profileId:'p',kind:'birthday',title:'Emma',date,...extra}),c=(date,extra={})=>({id:'c1',profileId:'p',kind:'countdown',title:'Disney trip',date,...extra})

test('birthdays come back every year (Feb 29 on Feb 28 in other years); countdowns are one day',()=>{
 assert.equal(sd.nextDate(b('2017-11-02'),'2026-10-15'),'2026-11-02')
 assert.equal(sd.nextDate(b('2017-03-02'),'2026-10-15'),'2027-03-02','already passed this year: next year')
 assert.equal(sd.nextDate(b('2016-02-29'),'2027-01-01'),'2027-02-28')
 assert.equal(sd.nextDate(b('2016-02-29'),'2028-01-01'),'2028-02-29')
 assert.equal(sd.nextDate(c('2026-12-20'),'2026-10-15'),'2026-12-20')
 assert.equal(sd.nextDate(c('2026-10-01'),'2026-10-15'),null,'a passed countdown is gone')
 assert.equal(sd.specialLabel(b('2017-11-02'),'2026-11-02'),'Emma’s birthday (9)')
 assert.equal(sd.specialLabel(c('2026-12-20'),'2026-12-20'),'Disney trip')
})
test('on a date, and coming up soonest first with days to go',()=>{
 const data={specialDays:[b('2017-10-17'),c('2026-12-20',{emoji:'🏰'}),{...b('1950-10-15'),id:'b2',title:'Grandma'},{...b('2015-10-20'),id:'other',profileId:'q'}]}
 assert.deepEqual(sd.specialOn(data,'p','2026-10-15').map(x=>x.label),['Grandma’s birthday (76)'])
 const up=sd.upcomingSpecial(data,'p','2026-10-15',90).map(x=>x.icon+' '+x.label+' '+sd.daysAwayLabel(x.daysAway))
 assert.deepEqual(up,['🎂 Grandma’s birthday (76) Today!','🎂 Emma’s birthday (9) 2 days','🏰 Disney trip 66 days'])
})
test('special days load and save; a bad one is dropped, not the plan',()=>{
 const d=model.createFreshData(),pid=d.activeProfileId
 d.specialDays=[{id:'s1',profileId:pid,kind:'birthday',title:'Emma',date:'2017-11-02'},{id:'s2',profileId:pid,kind:'countdown',title:'Trip',date:'not a date'},{id:'s3',profileId:'nobody',kind:'countdown',title:'X',date:'2026-12-01'}]
 const n=model.normalizeData(JSON.parse(JSON.stringify(d)))
 assert.deepEqual(n.specialDays.map(s=>s.id),['s1'])
 d.calendarEvents=[{id:'e',profileId:pid,date:'2026-10-15',title:'Soccer',kind:'sports',notes:'',time:'16:00',location:'  Riverside Park ',travelMinutes:20},{id:'f',profileId:pid,date:'2026-10-15',title:'X',kind:'other',notes:'',travelMinutes:-3}]
 const m=model.normalizeData(JSON.parse(JSON.stringify(d)))
 assert.equal(m.calendarEvents[0].location,'Riverside Park');assert.equal(m.calendarEvents[0].travelMinutes,20);assert.equal(m.calendarEvents[1].travelMinutes,undefined)
})
test('leave by: start minus travel, and the reminder window',()=>{
 assert.equal(lb.leaveBy('16:00',20),'15:40');assert.equal(lb.leaveBy('00:10',30),'00:00');assert.equal(lb.leaveBy(undefined,20),undefined);assert.equal(lb.leaveBy('16:00',undefined),undefined)
 const e={date:'2026-10-15',time:'16:00',travelMinutes:20}
 assert.equal(lb.isLeaveTime(e,'2026-10-15',15*60+39),false);assert.equal(lb.isLeaveTime(e,'2026-10-15',15*60+40),true);assert.equal(lb.isLeaveTime(e,'2026-10-15',15*60+51),false);assert.equal(lb.isLeaveTime({...e,done:true},'2026-10-15',15*60+40),false)
 assert.equal(lb.mapsLink('Riverside Park & Field 3'),'https://www.google.com/maps/search/?api=1&query=Riverside%20Park%20%26%20Field%203')
})
test('grandparents’ page: the next two weeks of events, tests and birthdays, escaped, without homework, notes or drivers',()=>{
 const d=model.createFreshData(),pid=d.activeProfileId
 d.profiles[0].label='The Parks'
 d.kids=[{id:'k1',profileId:pid,name:'Emma',color:'#7ca982',emoji:'🦄'}]
 d.calendarEvents=[{id:'e1',profileId:pid,date:'2026-10-16',title:'Soccer <game>',kind:'sports',notes:'secret note',time:'10:00',endTime:'11:00',kidId:'k1',location:'Riverside Park',driver:'Dad'},{id:'e2',profileId:pid,date:'2026-11-30',title:'Too far',kind:'other',notes:''}]
 d.exams=[{id:'x',profileId:pid,subjectId:'',title:'Science quiz',due:'2026-10-17',done:false,notes:''}]
 d.tasks=[{id:'t',profileId:pid,subjectId:'',title:'Spelling homework',due:'2026-10-16',done:false,notes:''}]
 d.specialDays=[{id:'s',profileId:pid,kind:'birthday',title:'Emma',date:'2017-10-18',kidId:'k1'}]
 const html=page.familyPageHtml(d,pid,'2026-10-15')
 assert.match(html,/<h1>The Parks<\/h1>/)
 assert.match(html,/Soccer &lt;game&gt;/);assert.ok(!html.includes('<game>'),'titles are escaped')
 assert.match(html,/10:00 AM/);assert.match(html,/📍 Riverside Park/);assert.match(html,/🦄 Emma/)
 assert.match(html,/📝 Science quiz/);assert.match(html,/🎂 Emma’s birthday \(9\)/)
 for(const hidden of ['Spelling homework','secret note','Dad','Too far','<script'])assert.ok(!html.includes(hidden),hidden+' should not be on the page')
 assert.equal(page.todayIn('America/Los_Angeles',new Date('2026-10-16T05:00:00Z')),'2026-10-15');assert.equal(page.todayIn('Not/AZone',new Date('2026-10-16T05:00:00Z')),'2026-10-16')
})
console.log(passed+'/5 special-day groups passed.')
