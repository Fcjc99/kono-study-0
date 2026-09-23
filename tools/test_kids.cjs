// Actual application functions with isolated fixtures; no browser or user-data writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,crypto:{randomUUID},console})
 return module.exports
}
const model=load('src/store/model.ts'),kids=load('src/store/kids.ts')

const tests=[]
function test(name,fn){tests.push({name,fn})}

const withKid=(data,name,color,emoji)=>{const id=model.uid('kid');return {data:{...data,kids:[...data.kids,{id,profileId:data.activeProfileId,name,color:color??'#7ca982',emoji}]},id}}

test('a valid kid (name, color, emoji) round-trips through normalization',()=>{
 const base=model.createFreshData()
 const {data}=withKid(base,'Emma','#7f9fc9','🦄')
 const normalized=model.normalizeData(data)
 const kid=normalized.kids.find(k=>k.name==='Emma')
 assert.ok(kid)
 assert.equal(kid.color,'#7f9fc9')
 assert.equal(kid.emoji,'🦄')
})

test('a malformed kid color is rejected rather than silently accepted',()=>{
 const base=model.createFreshData()
 const {data}=withKid(base,'Emma')
 data.kids[0].color='not-a-color'
 assert.throws(()=>model.normalizeData(data))
})

test('a kid with no emoji normalizes to undefined, not a forced default',()=>{
 const base=model.createFreshData()
 const {data}=withKid(base,'Emma')
 const normalized=model.normalizeData(data)
 assert.equal(normalized.kids[0].emoji,undefined)
})

test('a task tagged with a real kid from the same profile keeps that tag',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id}=withKid(base,'Emma')
 const withTask={...data,tasks:[...data.tasks,{id:'t1',profileId:data.activeProfileId,subjectId:'',kidId:id,title:'Reading log',due:'2026-09-21',done:false,notes:''}]}
 const normalized=model.normalizeData(withTask)
 assert.equal(normalized.tasks.find(t=>t.id==='t1').kidId,id)
})

test('a stale kidId (the kid was since deleted) clears to unassigned instead of failing the whole save',()=>{
 const base=model.normalizeData(model.createFreshData())
 const withTask={...base,tasks:[...base.tasks,{id:'t1',profileId:base.activeProfileId,subjectId:'',kidId:'kid-does-not-exist',title:'Reading log',due:'2026-09-21',done:false,notes:''}]}
 const normalized=model.normalizeData(withTask)
 assert.equal(normalized.tasks.find(t=>t.id==='t1').kidId,undefined)
})

test('a kidId belonging to another profile clears to unassigned rather than leaking across profiles',()=>{
 const base=model.normalizeData(model.createFreshData())
 const other=model.uid('profile')
 const withOther={...base,profiles:[...base.profiles,{id:other,name:'Other plan',label:'Other',kind:'custom',start:base.profiles[0].start,end:base.profiles[0].end}],kids:[...base.kids,{id:'kid-1',profileId:other,name:'Jack',color:'#7ca982'}]}
 const withTask={...withOther,tasks:[...withOther.tasks,{id:'t1',profileId:base.activeProfileId,subjectId:'',kidId:'kid-1',title:'Reading log',due:'2026-09-21',done:false,notes:''}]}
 const normalized=model.normalizeData(withTask)
 assert.equal(normalized.tasks.find(t=>t.id==='t1').kidId,undefined)
})

test('a recurring class block can carry a kidId the same way it carries a subjectId',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id}=withKid(base,'Emma')
 const season=data.studySeasons.find(s=>s.profileId===data.activeProfileId)
 const withBlock={...data,studySeasons:data.studySeasons.map(s=>s.id===season.id?{...s,week:{...s.week,Monday:[{id:'math',label:'Math',start:'09:00',end:'10:00',kind:'study',kidId:id,occurrenceNotes:{}}]}}:s)}
 const normalized=model.normalizeData(withBlock)
 assert.equal(normalized.studySeasons.find(s=>s.id===season.id).week.Monday[0].kidId,id)
})

test('nextKidColor picks a color no existing kid already has',()=>{
 const used=[{color:kids.KID_COLORS[0]},{color:kids.KID_COLORS[1]}]
 assert.equal(kids.nextKidColor(used),kids.KID_COLORS[2])
})

test('nextKidColor cycles the palette once every color is already taken',()=>{
 const used=kids.KID_COLORS.map(c=>({color:c}))
 assert.ok(kids.KID_COLORS.includes(kids.nextKidColor(used)))
})

test('kidItemsForDate tags each kid\'s tasks, exams and events with their own name and color, on the right date only',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id:emmaId}=withKid(base,'Emma','#7f9fc9','🦄')
 const {data:data2,id:jackId}=withKid(data,'Jack','#c69a65')
 let full={...data2,tasks:[...data2.tasks,{id:'t1',profileId:data2.activeProfileId,subjectId:'',kidId:emmaId,title:'Emma math',due:'2026-09-21',done:false,notes:''}],exams:[...data2.exams,{id:'e1',profileId:data2.activeProfileId,subjectId:'',kidId:jackId,title:'Jack science test',due:'2026-09-21',done:false,notes:''}],calendarEvents:[...data2.calendarEvents,{id:'c1',profileId:data2.activeProfileId,subjectId:'',date:'2026-09-22',title:'Emma tomorrow event',kind:'personal',kidId:emmaId,notes:''}]}
 full=model.normalizeData(full)
 const items=kids.kidItemsForDate(full,full.activeProfileId,'2026-09-21')
 assert.equal(items.length,2)
 const task=items.find(i=>i.id==='t1'),exam=items.find(i=>i.id==='e1')
 assert.equal(task.kidName,'Emma')
 assert.equal(task.color,'#7f9fc9')
 assert.equal(exam.kidName,'Jack')
 assert.equal(exam.color,'#c69a65')
 assert.ok(!items.some(i=>i.id==='c1'),'expected the event dated the next day to be excluded from this date')
})

test('kidItemsForDate keeps an untagged item visible under any kid filter, the same way an unassigned subject item always shows',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id:emmaId}=withKid(base,'Emma')
 let full={...data,tasks:[...data.tasks,{id:'t1',profileId:data.activeProfileId,subjectId:'',kidId:emmaId,title:'Emma math',due:'2026-09-21',done:false,notes:''},{id:'t2',profileId:data.activeProfileId,subjectId:'',title:'Whole family errand',due:'2026-09-21',done:false,notes:''}]}
 full=model.normalizeData(full)
 const onlyOtherKid=kids.kidItemsForDate(full,full.activeProfileId,'2026-09-21',new Set())
 assert.equal(onlyOtherKid.length,1)
 assert.equal(onlyOtherKid[0].id,'t2')
})

test('kidItemsForDate includes a kid\'s tagged recurring class occurrence on that date',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id}=withKid(base,'Emma')
 const season=data.studySeasons.find(s=>s.profileId===data.activeProfileId)
 let full={...data,studySeasons:data.studySeasons.map(s=>s.id===season.id?{...s,start:'2026-09-01',end:'2026-12-31',week:{...s.week,Monday:[{id:'math',label:'Math',start:'09:00',end:'10:00',kind:'study',kidId:id,occurrenceNotes:{}}]}}:s)}
 full=model.normalizeData(full)
 // 2026-09-21 is a Monday.
 const items=kids.kidItemsForDate(full,full.activeProfileId,'2026-09-21')
 assert.ok(items.some(i=>i.kind==='class'&&i.title==='Math'&&i.kidName==='Emma'))
})

test('kidDueItems leaves an untagged item\'s title unprefixed',()=>{
 const base=model.normalizeData(model.createFreshData())
 let data={...base,tasks:[...base.tasks,{id:'t1',profileId:base.activeProfileId,subjectId:'',title:'Reading log',due:'2026-09-21',done:false,notes:''}]}
 const items=kids.kidDueItems(data,data.activeProfileId,'2026-09-21','15:00')
 assert.equal(items.find(i=>i.id==='t1').title,'Reading log')
})

test('kidDueItems prefixes a title with the kid\'s name once the item is tagged to one',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id:emmaId}=withKid(base,'Emma')
 const {data:data2,id:jackId}=withKid(data,'Jack')
 let full={...data2,tasks:[...data2.tasks,{id:'t1',profileId:data2.activeProfileId,subjectId:'',kidId:emmaId,title:'Reading log',due:'2026-09-21',done:false,notes:''}],exams:[...data2.exams,{id:'e1',profileId:data2.activeProfileId,subjectId:'',kidId:jackId,title:'Science test',due:'2026-09-21',done:false,notes:''}]}
 full=model.normalizeData(full)
 const items=kids.kidDueItems(full,full.activeProfileId,'2026-09-21','15:00')
 assert.equal(items.find(i=>i.id==='t1').title,'Emma: Reading log')
 assert.equal(items.find(i=>i.id==='e1').title,'Jack: Science test')
})

test('kidDueItems drops a kid\'s tagged item while they are in their own tagged class right now, but keeps an untagged item and another kid\'s item unaffected',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id:emmaId}=withKid(base,'Emma')
 const {data:data2,id:jackId}=withKid(data,'Jack')
 const season=data2.studySeasons.find(s=>s.profileId===data2.activeProfileId)
 let full={
  ...data2,
  studySeasons:data2.studySeasons.map(s=>s.id===season.id?{...s,start:'2026-09-01',end:'2026-12-31',week:{...s.week,Monday:[{id:'math',label:'Math',start:'09:00',end:'10:00',kind:'study',kidId:emmaId,occurrenceNotes:{}}]}}:s),
  tasks:[...data2.tasks,{id:'t1',profileId:data2.activeProfileId,subjectId:'',kidId:emmaId,title:'Reading log',due:'2026-09-21',done:false,notes:''},{id:'t2',profileId:data2.activeProfileId,subjectId:'',kidId:jackId,title:'Worksheet',due:'2026-09-21',done:false,notes:''},{id:'t3',profileId:data2.activeProfileId,subjectId:'',title:'Whole family errand',due:'2026-09-21',done:false,notes:''}],
 }
 full=model.normalizeData(full)
 // 2026-09-21 is a Monday; 09:30 falls inside Emma's tagged 09:00-10:00 class.
 const duringClass=kids.kidDueItems(full,full.activeProfileId,'2026-09-21','09:30')
 assert.ok(!duringClass.some(i=>i.id==='t1'),'expected Emma\'s tagged item to be dropped while she is in her own class')
 assert.ok(duringClass.some(i=>i.id==='t2'),'expected Jack\'s item to still show up, unaffected by Emma\'s class')
 assert.ok(duringClass.some(i=>i.id==='t3'),'expected the untagged item to still show up')
 const afterClass=kids.kidDueItems(full,full.activeProfileId,'2026-09-21','11:00')
 assert.ok(afterClass.some(i=>i.id==='t1'),'expected Emma\'s item back once her class has ended')
})

test('kidTimeBlockItems carries plannedTime and estimatedMinutes, and prefixes the title once tagged',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id:jackId}=withKid(base,'Jack')
 let full={...data,tasks:[...data.tasks,{id:'t1',profileId:data.activeProfileId,subjectId:'',kidId:jackId,title:'Worksheet',due:'2026-09-21',done:false,notes:'',plannedTime:'16:00',estimatedMinutes:30}]}
 full=model.normalizeData(full)
 const items=kids.kidTimeBlockItems(full,full.activeProfileId,'2026-09-21','15:00')
 const item=items.find(i=>i.id==='t1')
 assert.equal(item.plannedTime,'16:00')
 assert.equal(item.estimatedMinutes,30)
 assert.equal(item.title,'Jack: Worksheet')
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} kid-tag regression groups passed.`)
