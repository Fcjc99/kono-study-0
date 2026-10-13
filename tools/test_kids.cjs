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

// New plans start without a schedule; tests that add a recurring block give the plan one.
const seasonOf=d=>{let s=d.studySeasons.find(x=>x.profileId===d.activeProfileId);if(!s){const p=d.profiles.find(x=>x.id===d.activeProfileId);s={id:'season-test',profileId:p.id,name:'Test schedule',start:p.start,end:p.end,active:true,week:model.blankWeek()};d.studySeasons.push(s)}return s}

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

test('a malformed kid color falls back to the default instead of failing the whole load',()=>{
 const base=model.createFreshData()
 const {data}=withKid(base,'Emma')
 data.kids[0].color='not-a-color'
 assert.equal(model.normalizeData(data).kids[0].color,'#7ca982')
})

test('a kid with no emoji normalizes to undefined, not a forced default',()=>{
 const base=model.createFreshData()
 const {data}=withKid(base,'Emma')
 const normalized=model.normalizeData(data)
 assert.equal(normalized.kids[0].emoji,undefined)
})

test('a kid\'s borderStyle defaults to solid and every current style round-trips',()=>{
 const base=model.createFreshData()
 const {data}=withKid(base,'Emma')
 assert.equal(model.normalizeData(data).kids[0].borderStyle,'solid')
 assert.deepEqual([...model.KID_BORDER_STYLES],['solid','bold','stripe','soft','dashed','dotted','double','glow'])
 for(const style of model.KID_BORDER_STYLES){
  assert.equal(model.normalizeData({...data,kids:[{...data.kids[0],borderStyle:style}]}).kids[0].borderStyle,style)
 }
})

test('the retired animation tuning (colors, speed, glow, extras) is dropped from a saved kid',()=>{
 const base=model.createFreshData()
 const {data}=withKid(base,'Emma')
 const k=model.normalizeData({...data,kids:[{...data.kids[0],borderStyle:'ocean',borderColors:['#112233','#aabbcc'],borderSpeed:2.5,borderGlow:'strong',borderExtras:false}]}).kids[0]
 assert.deepEqual(Object.keys(k).sort(),['borderStyle','color','emoji','id','name','profileId'])
 assert.equal(k.borderStyle,'glow')
})

test('an unknown borderStyle (e.g. synced from a newer build) falls back to solid instead of failing the whole load',()=>{
 const base=model.createFreshData()
 const {data}=withKid(base,'Emma')
 assert.equal(model.normalizeData({...data,kids:[{...data.kids[0],borderStyle:'not-a-style'}]}).kids[0].borderStyle,'solid')
 assert.equal(model.normalizeData({...data,kids:[{...data.kids[0],borderStyle:42}]}).kids[0].borderStyle,'solid')
})

test('a kid saved under any retired border style migrates to the closest simple one instead of failing the whole load',()=>{
 const base=model.createFreshData()
 const {data}=withKid(base,'Emma')
 const migrated={sparkle:'glow',rainbow:'glow',fire:'bold',cute:'soft',sports:'stripe',modern:'solid',unique:'double',space:'bold',garden:'soft',ocean:'glow',neon:'glow',solid:'solid',dashed:'dashed',glow:'glow'}
 for(const [legacy,expected] of Object.entries(migrated)){
  const normalized=model.normalizeData({...data,kids:[{...data.kids[0],borderStyle:legacy}]})
  assert.equal(normalized.kids[0].borderStyle,expected,legacy)
 }
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

test('a kid tag works across the parent’s own plans (the family plan can move), but clears to unassigned in a kid’s own plan',()=>{
 const base=model.normalizeData(model.createFreshData())
 const other=model.uid('profile')
 const withOther={...base,profiles:[...base.profiles,{id:other,name:'Other plan',label:'Other',kind:'custom',start:base.profiles[0].start,end:base.profiles[0].end}],kids:[...base.kids,{id:'kid-1',profileId:other,name:'Jack',color:'#7ca982'}]}
 const kidPlan={id:model.uid('profile'),name:'Jack',label:'Jack’s plan',kind:'school',start:base.profiles[0].start,end:base.profiles[0].end,kidId:'kid-1'}
 const withTask={...withOther,profiles:[...withOther.profiles,kidPlan],tasks:[...withOther.tasks,{id:'t1',profileId:base.activeProfileId,subjectId:'',kidId:'kid-1',title:'Reading log',due:'2026-09-21',done:false,notes:''},{id:'t2',profileId:kidPlan.id,subjectId:'',kidId:'kid-1',title:'Spelling',due:'2026-09-21',done:false,notes:''}]}
 const normalized=model.normalizeData(withTask)
 assert.equal(normalized.tasks.find(t=>t.id==='t1').kidId,'kid-1','another of the parent’s plans keeps the tag')
 assert.equal(normalized.tasks.find(t=>t.id==='t2').kidId,undefined,'a kid’s own plan has no kid tags')
})

test('a recurring class block can carry a kidId the same way it carries a subjectId',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id}=withKid(base,'Emma')
 const season=seasonOf(data)
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
 const season=seasonOf(data)
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
 const season=seasonOf(data2)
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

test('kidFamilyEventItems carries time and endTime, and prefixes the title once tagged',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data,id:blairId}=withKid(base,'Blair')
 let full={...data,calendarEvents:[...data.calendarEvents,{id:'ev1',profileId:data.activeProfileId,subjectId:'',kidId:blairId,title:'Cheer practice',date:'2026-09-21',time:'15:30',endTime:'17:00',kind:'sports',notes:'',done:false}]}
 full=model.normalizeData(full)
 const items=kids.kidFamilyEventItems(full,full.activeProfileId,'2026-09-21')
 const item=items.find(i=>i.id==='ev1')
 assert.equal(item.time,'15:30')
 assert.equal(item.endTime,'17:00')
 assert.equal(item.title,'Blair: Cheer practice')
})

test('kidFamilyEventItems leaves an untagged event\'s title unprefixed',()=>{
 const base=model.normalizeData(model.createFreshData())
 const full=model.normalizeData({...base,calendarEvents:[...base.calendarEvents,{id:'ev2',profileId:base.activeProfileId,subjectId:'',title:'Family dinner',date:'2026-09-21',time:'18:00',kind:'personal',notes:'',done:false}]})
 const items=kids.kidFamilyEventItems(full,full.activeProfileId,'2026-09-21')
 assert.equal(items.find(i=>i.id==='ev2').title,'Family dinner')
})

test('kidFamilyEventItems excludes a completed event, an event on a different date, and an event on another profile',()=>{
 const base=model.normalizeData(model.createFreshData())
 const otherProfile={...base.profiles[0],id:model.uid('profile'),label:'Other'}
 const full=model.normalizeData({...base,profiles:[...base.profiles,otherProfile],calendarEvents:[
  {id:'done',profileId:base.activeProfileId,subjectId:'',title:'Done already',date:'2026-09-21',kind:'personal',notes:'',done:true},
  {id:'other-day',profileId:base.activeProfileId,subjectId:'',title:'Tomorrow',date:'2026-09-22',kind:'personal',notes:'',done:false},
  {id:'other-profile',profileId:otherProfile.id,subjectId:'',title:'Not mine',date:'2026-09-21',kind:'personal',notes:'',done:false},
 ]})
 const items=kids.kidFamilyEventItems(full,full.activeProfileId,'2026-09-21')
 assert.equal(items.some(i=>i.id==='done'),false)
 assert.equal(items.some(i=>i.id==='other-day'),false)
 assert.equal(items.some(i=>i.id==='other-profile'),false)
})

test('parentMode defaults off for a fresh, kid-less save',()=>{
 const normalized=model.normalizeData(model.createFreshData())
 assert.equal(normalized.settings.parentMode,false)
})

test('familyTileBorders and familyTileAvatars default on, and an explicit false round-trips',()=>{
 const fresh=model.normalizeData(model.createFreshData())
 assert.equal(fresh.settings.familyTileBorders,true)
 assert.equal(fresh.settings.familyTileAvatars,true)
 const off=model.normalizeData({...fresh,settings:{...fresh.settings,familyTileBorders:false,familyTileAvatars:false}})
 assert.equal(off.settings.familyTileBorders,false)
 assert.equal(off.settings.familyTileAvatars,false)
})

test('parentMode defaults on when a legacy save (no parentMode key at all) already has kids, so an existing parent never loses the tab silently',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data}=withKid(base,'Emma')
 const {parentMode,...settingsWithoutParentMode}=data.settings
 const legacy={...data,settings:settingsWithoutParentMode}
 const normalized=model.normalizeData(legacy)
 assert.equal(normalized.settings.parentMode,true)
})

test('an explicit parentMode choice round-trips regardless of whether any kids exist',()=>{
 const base=model.createFreshData()
 const onWithNoKids=model.normalizeData({...base,settings:{...base.settings,parentMode:true}})
 assert.equal(onWithNoKids.settings.parentMode,true)
 const withEmma=withKid(model.normalizeData(base),'Emma').data
 const offWithKids=model.normalizeData({...withEmma,settings:{...withEmma.settings,parentMode:false}})
 assert.equal(offWithKids.settings.parentMode,false)
})

test('a multi-codepoint emoji (a ZWJ family sequence, well past the old 8-char cap) survives normalization',()=>{
 const base=model.normalizeData(model.createFreshData())
 const {data}=withKid(base,'Emma','#7ca982','\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}')
 const normalized=model.normalizeData(data)
 assert.equal(normalized.kids[0].emoji,'\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}')
})

test('Family plans: a kid’s own plan is made once, keeps the kid’s name and link, survives a save, and the parent PIN is kept only as a hash',()=>{
 const fam=load('src/store/familyPlans.ts')
 let {data,id:kidId}=withKid(model.createFreshData(),'Emma','#6a8fc7','🦄')
 const parent=data.activeProfileId,kid=data.kids.find(k=>k.id===kidId)
 assert.equal(fam.planForKid(data,kidId),undefined)
 const made=fam.addKidPlan(data,kid);data=made.data
 const plan=fam.planForKid(data,kidId);assert.equal(plan.id,made.id);assert.equal(plan.label,'Emma’s plan');assert.equal(plan.kidId,kidId)
 assert.ok(data.sanctuaryProgress[plan.id],'the kid’s plan gets its own island')
 assert.equal(fam.addKidPlan(data,kid).id,made.id,'made once')
 assert.equal(data.activeProfileId,parent,'making it doesn’t switch by itself')
 assert.equal(fam.kidPlans(data,parent).length,1);assert.equal(fam.kidOfPlan(data,plan).name,'Emma')
 const saved=model.normalizeData(JSON.parse(JSON.stringify({...data,settings:{...data.settings,parentPin:'a'.repeat(64)}})))
 assert.equal(saved.profiles.find(p=>p.id===plan.id).kidId,kidId,'the link survives a save')
 assert.equal(saved.settings.parentPin,'a'.repeat(64))
 assert.equal(model.normalizeData(JSON.parse(JSON.stringify({...data,settings:{...data.settings,parentPin:'1234'}}))).settings.parentPin,undefined,'a plain PIN is never kept')
 assert.equal(fam.validPin('2468'),true);assert.equal(fam.validPin('12'),false);assert.equal(fam.validPin('12ab'),false)
})

test('The family plan shows each kid’s own plan as theirs, saves “who it’s for” into a kid’s plan, can move, and Kids today sums each kid up',()=>{
 const fam=load('src/store/familyPlans.ts'),glance=load('src/store/kidGlance.ts')
 let {data,id:emma}=withKid(model.createFreshData(),'Emma','#6a8fc7','🦄')
 ;({data}=withKid(data,'Leo','#e08a4f'))
 const parent=data.activeProfileId,leo=data.kids.find(k=>k.name==='Leo').id
 const made=fam.addKidPlan(data,data.kids.find(k=>k.id===emma));data=made.data
 const today='2026-10-13'
 data={...data,
  tasks:[...data.tasks,{id:'t-emma',profileId:made.id,subjectId:'',title:'Spelling list',due:'2026-10-14',done:false,notes:''},{id:'t-late',profileId:made.id,subjectId:'',title:'Reading log',due:'2026-10-10',done:false,notes:''},{id:'t-leo',profileId:parent,subjectId:'',kidId:leo,title:'Science poster',due:'2026-10-14',done:false,notes:''}],
  exams:[...data.exams,{id:'x-emma',profileId:made.id,subjectId:'',title:'Math test',due:'2026-10-15',done:false,notes:''}]}
 const view=fam.familyView(data,parent)
 const borrowed=view.data.tasks.find(t=>t.id==='t-emma')
 assert.equal(borrowed.profileId,parent);assert.equal(borrowed.kidId,emma,'shown as Emma’s')
 assert.equal(view.home.get('t-emma'),made.id,'and remembered as living in her plan')
 assert.equal(data.tasks.find(t=>t.id==='t-emma').profileId,made.id,'the plan itself is unchanged')
 assert.equal(fam.familyView(data,made.id).home.size,0,'a kid’s plan doesn’t borrow anything')
 // Who's it for: Emma (with a plan) gets it in her plan; Leo (no plan) gets a tag; "Me" brings it back.
 const event={id:'e1',profileId:parent,subjectId:'',date:today,title:'Dentist',kind:'appointment',notes:''}
 const forEmma=fam.moveToWhose(data,event,parent,emma);assert.equal(forEmma.profileId,made.id);assert.equal(forEmma.kidId,undefined)
 const forLeo=fam.moveToWhose(data,event,parent,leo);assert.equal(forLeo.profileId,parent);assert.equal(forLeo.kidId,leo)
 assert.equal(fam.moveToWhose(data,forEmma,parent,undefined).profileId,parent)
 // Kids today.
 const rows=glance.kidGlance(data,parent,today),e=rows.find(r=>r.kid.id===emma),l=rows.find(r=>r.kid.id===leo)
 assert.deepEqual(e.dueTonight,['Spelling list']);assert.equal(e.late,1);assert.deepEqual(e.tests.map(t=>t.title),['Math test']);assert.equal(e.planId,made.id)
 assert.deepEqual(l.dueTonight,['Science poster']);assert.equal(l.planId,undefined)
 // The family plan can move to another of the parent's plans; tags go with the kids.
 const second={id:model.uid('profile'),name:'Mom',label:'Work and home',kind:'custom',start:data.profiles[0].start,end:data.profiles[0].end}
 data={...data,profiles:[...data.profiles,second]}
 assert.equal(fam.familyPlanId(data),parent)
 const moved=model.normalizeData(JSON.parse(JSON.stringify(fam.makeFamilyPlan(data,second.id))))
 assert.equal(fam.familyPlanId(moved),second.id)
 assert.equal(moved.tasks.find(t=>t.id==='t-leo').kidId,leo,'Leo’s tag is kept')
 assert.throws(()=>fam.makeFamilyPlan(data,made.id),/own plans/)
})

test('Renaming plans: a parent’s plan gets a new name and owner; a kid’s plan renames the kid too, and “Emma’s plan” follows the new name',()=>{
 const fam=load('src/store/familyPlans.ts')
 let {data,id:emma}=withKid(model.createFreshData(),'Emma','#6a8fc7','🦄')
 const parent=data.activeProfileId,made=fam.addKidPlan(data,data.kids.find(k=>k.id===emma));data=made.data
 data=fam.renamePlan(data,parent,{label:'Our family',name:'Mom'})
 assert.equal(data.profiles.find(p=>p.id===parent).label,'Our family');assert.equal(data.profiles.find(p=>p.id===parent).name,'Mom')
 data=fam.renamePlan(data,made.id,{label:'Emma’s plan',name:'Em'})
 assert.equal(data.kids.find(k=>k.id===emma).name,'Em','the kid is renamed everywhere')
 assert.equal(data.profiles.find(p=>p.id===made.id).label,'Em’s plan','the default plan name follows')
 data=fam.renamePlan(data,made.id,{label:'Middle school',name:'Em'})
 assert.equal(data.profiles.find(p=>p.id===made.id).label,'Middle school','a chosen plan name stays')
 assert.throws(()=>fam.renamePlan(data,parent,{label:'x',name:'  '}),/whose plan/)
 assert.equal(model.normalizeData(JSON.parse(JSON.stringify(data))).kids.find(k=>k.id===emma).name,'Em')
})

test('Several people on one item, and a kid’s own plan shows what the family plan tagged for them',()=>{
 const fam=load('src/store/familyPlans.ts'),same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m)
 let {data,id:blair}=withKid(model.createFreshData(),'Blair','#6a8fc7')
 ;({data}=withKid(data,'Leo','#e08a4f'))
 const parent=data.activeProfileId,leo=data.kids.find(k=>k.name==='Leo').id
 const made=fam.addKidPlan(data,data.kids.find(k=>k.id===blair));data=made.data
 const base={id:'e-both',profileId:parent,date:'2026-10-14',title:'Dentist',kind:'appointment',notes:''}
 // Two people: stays in the family plan, tagged to both.
 const both=fam.moveToWhose(data,base,parent,[blair,leo])
 assert.equal(both.profileId,parent);same(both.kidIds,[blair,leo]);assert.equal(both.kidId,blair)
 // One kid with a plan: into their plan.
 assert.equal(fam.moveToWhose(data,base,parent,[blair]).profileId,made.id)
 data={...data,calendarEvents:[...data.calendarEvents,both,{id:'e-leo',profileId:parent,date:'2026-10-14',title:'Soccer',kind:'sports',kidId:leo,notes:''},{id:'e-blair',profileId:parent,date:'2026-10-15',title:'Piano',kind:'activity',kidId:blair,notes:''}]}
 const saved=model.normalizeData(JSON.parse(JSON.stringify(data)))
 same(saved.calendarEvents.find(e=>e.id==='e-both').kidIds,[blair,leo],'both names survive a save')
 assert.equal(model.peopleOf(saved.calendarEvents.find(e=>e.id==='e-leo')).join(),leo)
 // Blair's plan sees the dentist (with Leo) and piano, not Leo's soccer.
 const view=fam.kidPlanView(saved,made.id)
 const mine=view.data.calendarEvents.filter(e=>e.profileId===made.id).map(e=>e.title).sort()
 same(mine,['Dentist','Piano'])
 assert.equal(view.home.get('e-piano')??view.home.get('e-blair'),parent,'they still live in the family plan')
 assert.equal(saved.calendarEvents.find(e=>e.id==='e-blair').profileId,parent)
 assert.equal(fam.kidPlanView(saved,parent).home.size,0,'the family plan itself borrows nothing this way')
 // From Blair's plan, the family plan's things for her can be finished or removed.
 const ws=load('src/store/workspace.ts')
 assert.equal(ws.inReach({...saved,activeProfileId:made.id},parent),true)
 // Kids today counts both-people items for each.
 const glance=load('src/store/kidGlance.ts')
 const withTask={...saved,tasks:[...saved.tasks,{id:'t-both',profileId:parent,subjectId:'',kidId:blair,kidIds:[blair,leo],title:'Science fair board',due:'2026-10-14',done:false,notes:''}]}
 const rows=glance.kidGlance(model.normalizeData(withTask),parent,'2026-10-13')
 same(rows.find(r=>r.kid.id===leo).dueTonight,['Science fair board'])
 same(rows.find(r=>r.kid.id===blair).dueTonight,['Science fair board'])
})

test('Family extras: gifts wait in a kid’s pantry with a note; weekday repeats; one school for two kids; family to-dos; done today',()=>{
 const fam=load('src/store/familyPlans.ts'),care=load('src/store/konoCare.ts'),rep=load('src/store/eventRepeat.ts'),glance=load('src/store/kidGlance.ts')
 const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m)
 // A gift from a parent: in the pantry, with who sent it and the note; eaten like any snack.
 const now=new Date('2026-10-13T16:00:00'),at=now.toISOString()
 let state=care.addCareEvent(undefined,'p-kid',{id:'gift-1',kind:'gift',at,item:care.SNACKS[2].id,from:'Mom',note:'Great job on the test!'},now)
 const read=care.readCareState(JSON.parse(JSON.stringify(state)),'p-kid')
 assert.equal(read.log[0].note,'Great job on the test!');assert.equal(read.log[0].from,'Mom')
 same(care.pantry([],read.log,now).map(p=>p.taskId),['gift-1'])
 assert.equal(care.waitingGifts(read.log,now)[0].id,'gift-1')
 state=care.addCareEvent(read,'p-kid',{id:'feed-1',kind:'feed',at,taskId:'gift-1',item:care.SNACKS[2].id},now)
 assert.equal(care.pantry([],state.log,now).length,0,'eaten');assert.equal(care.waitingGifts(state.log,now).length,0)
 // Every Tuesday and Thursday from Mon Oct 12 through Oct 22.
 same(rep.weekdayDates('2026-10-12',[2,4],'2026-10-22'),['2026-10-13','2026-10-15','2026-10-20','2026-10-22'])
 same(rep.weekdayDates('2026-10-12',[],'2026-10-22'),[])
 // One school for two kids: each kid's own plan shows it; a family to-do survives a save.
 let {data,id:blair}=withKid(model.createFreshData(),'Blair','#6a8fc7')
 ;({data}=withKid(data,'Leo','#e08a4f'))
 const parent=data.activeProfileId,leo=data.kids.find(k=>k.name==='Leo').id
 let made=fam.addKidPlan(data,data.kids.find(k=>k.id===blair));data=made.data
 const leoPlan=fam.addKidPlan(data,data.kids.find(k=>k.id===leo));data=leoPlan.data
 data={...data,studySeasons:[{id:'s-dms',profileId:parent,kidId:blair,kidIds:[blair,leo],name:'DMS',start:'2026-09-01',end:'2027-06-20',active:true,week:model.blankWeek()}],familyTodos:[{id:'todo-1',profileId:parent,title:'Sign permission slip',done:false,forKidId:leo}],
  tasks:[{id:'t-done',profileId:made.id,subjectId:'',title:'Reading log',due:'2026-10-13',done:true,completedAt:new Date('2026-10-13T15:00:00').toISOString(),notes:''}]}
 const saved=model.normalizeData(JSON.parse(JSON.stringify(data)))
 same(saved.studySeasons[0].kidIds,[blair,leo]);assert.equal(saved.familyTodos[0].title,'Sign permission slip');assert.equal(saved.familyTodos[0].forKidId,leo)
 assert.equal(fam.kidPlanView(saved,made.id).data.studySeasons[0].profileId,made.id,'Blair’s plan has the school')
 assert.equal(fam.kidPlanView(saved,leoPlan.id).data.studySeasons[0].profileId,leoPlan.id,'so does Leo’s')
 same(glance.kidGlance(saved,parent,'2026-10-13').find(r=>r.kid.id===blair).doneToday,['Reading log'])
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} kid-tag regression groups passed.`)
