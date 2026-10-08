// KONO today (store/konoMood) and sticker rewards (store/stickers): what KONO feels, and which stickers unlock.
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
const {konoMood}=load('src/store/konoMood.ts'),{earnedStickers,longestStreak,STICKERS,stickerSrc}=load('src/store/stickers.ts'),{BUILD_ASSET_BY_ID,BUILD_CATEGORIES}=load('src/game/data/buildAssets.ts')
const wed='2026-09-30',fri='2026-10-02'
const at=(date,hour=12)=>new Date(date+'T'+String(hour).padStart(2,'0')+':00:00').toISOString()
const task=(due,done=false,finished)=>({due,done,completedAt:done?at(finished??due):undefined})

test('KONO is worried about late work, busy with today, happy when done, calm with nothing',()=>{
 assert.equal(konoMood({tasks:[task('2026-09-28')],exams:[],today:wed,hour:15}).id,'worried')
 assert.match(konoMood({tasks:[task('2026-09-28'),task('2026-09-29')],exams:[],today:wed,hour:15}).line,/2 late assignments/)
 assert.equal(konoMood({tasks:[task(wed)],exams:[],today:wed,hour:15}).id,'busy')
 assert.equal(konoMood({tasks:[],exams:[task(wed)],today:wed,hour:15}).id,'busy')
 assert.equal(konoMood({tasks:[task(wed,true)],exams:[],today:wed,hour:15}).id,'happy')
 assert.equal(konoMood({tasks:[task('2026-10-05')],exams:[],today:wed,hour:15}).id,'calm')
 assert.equal(konoMood({tasks:[task(wed)],exams:[],today:wed,hour:15}).pose,'/garden/kono/read.webp')
})

test('late at night KONO is sleepy; a finished week is a celebration from Friday to Sunday',()=>{
 assert.equal(konoMood({tasks:[task('2026-09-28')],exams:[],today:wed,hour:23}).id,'sleepy')
 assert.equal(konoMood({tasks:[],exams:[],today:wed,hour:3}).id,'sleepy')
 const week=[task('2026-09-28',true),task(wed,true),task(fri,true)]
 assert.equal(konoMood({tasks:week,exams:[],today:fri,hour:16}).id,'celebrate')
 assert.equal(konoMood({tasks:week,exams:[],today:'2026-10-04',hour:23}).id,'celebrate')
 assert.equal(konoMood({tasks:week,exams:[],today:wed,hour:16}).id,'happy','not before Friday')
 assert.notEqual(konoMood({tasks:[...week,task('2026-10-01')],exams:[],today:fri,hour:16}).id,'celebrate','something in the week is still open')
 assert.notEqual(konoMood({tasks:week.slice(0,2),exams:[],today:fri,hour:16}).id,'celebrate','a week needs at least 3 things')
})

const none={tasks:[],exams:[],studySessions:[],completionDates:{},today:wed}
const ids=h=>[...earnedStickers({...none,...h})].sort().join(',')
test('stickers unlock from streaks, totals and early work',()=>{
 assert.equal(ids({}),'')
 assert.equal(longestStreak({'2026-09-01':1,'2026-09-02':2,'2026-09-03':1,'2026-09-10':1,'2026-09-04':0}),3)
 assert.equal(ids({completionDates:{'2026-09-01':1,'2026-09-02':1,'2026-09-03':1}}),'streak-3')
 const five=Object.fromEntries([21,22,23,24,25].map(d=>['2026-09-'+d,1]))
 assert.equal(ids({completionDates:five}),'streak-3,streak-5')
 assert.equal(ids({tasks:[task('2026-09-29',true)]}),'first-done')
 assert.equal(ids({tasks:[task('2026-10-02',true,'2026-09-30')]}),'early-bird,first-done')
 assert.equal(ids({tasks:[task('2026-10-02',true,'2026-10-01')]}),'first-done','one day early is not early bird')
 assert.equal(ids({tasks:[task('2026-09-29',true,'2026-09-27')]}),'early-bird,first-done,weekend','finished on a Sunday')
 assert.ok(earnedStickers({...none,tasks:Array.from({length:25},()=>task('2026-09-29',true))}).has('done-25'))
 assert.ok(!earnedStickers({...none,tasks:Array.from({length:24},()=>task('2026-09-29',true))}).has('done-25'))
})

test('a week on time, a test done, and studying for a test ahead',()=>{
 const onTime=[task('2026-09-28',true),task('2026-09-30',true),task('2026-10-02',true,'2026-10-02')]
 assert.ok(earnedStickers({...none,tasks:onTime}).has('on-time-week'))
 assert.ok(!earnedStickers({...none,tasks:[...onTime.slice(0,2),task('2026-10-02',true,'2026-10-03')]}).has('on-time-week'),'one was late')
 assert.ok(!earnedStickers({...none,tasks:[...onTime.slice(0,2),task('2026-10-02')]}).has('on-time-week'),'one still open')
 assert.ok(!earnedStickers({...none,tasks:onTime.slice(0,2)}).has('on-time-week'),'needs 3')
 assert.equal(ids({exams:[{subjectId:'bio',due:'2026-09-29',done:true}]}),'test-done')
 const exam={subjectId:'bio',due:'2026-10-05',done:false}
 assert.equal(ids({exams:[exam],studySessions:[{subjectId:'bio',date:'2026-09-29'}]}),'test-prep')
 assert.equal(ids({exams:[exam],studySessions:[{subjectId:'chem',date:'2026-09-29'}]}),'','another class')
 assert.equal(ids({exams:[exam],studySessions:[{subjectId:'bio',date:'2026-10-02'}]}),'','still ahead, not studied yet')
})

test('every sticker is a placeable island decoration with its own picture (the Spooky season ones use the Halloween set’s art)',()=>{
 assert.ok(BUILD_CATEGORIES.includes('stickers'))
 assert.equal(new Set(STICKERS.map(s=>s.id)).size,STICKERS.length)
 for(const s of STICKERS){
  const a=BUILD_ASSET_BY_ID['sticker-'+s.id];assert.ok(a,s.id);assert.equal(a.category,'stickers')
  if(s.season==='halloween'){for(const phase of ['morning','afternoon','evening','night'])assert.match(a.src[phase],new RegExp('^/garden/registered-22\\.8\\.6/halloween/[a-z-]+/'+phase+'\\.webp$'),s.id)}
  else{assert.equal(a.src,stickerSrc(s.emoji));assert.match(a.src,/^data:image\/svg\+xml,/)}
 }
})

const {seasonOn,stickerOffered,SEASONS}=load('src/store/stickers.ts')
test('island events: Halloween in October and snow days across New Year, with stickers only earnable during them and kept after',()=>{
 assert.equal(seasonOn('2026-09-30'),null)
 assert.equal(seasonOn('2026-10-01').id,'halloween')
 assert.equal(seasonOn('2026-10-31').id,'halloween')
 assert.equal(seasonOn('2026-11-01'),null)
 assert.equal(seasonOn('2026-12-01').id,'winter')
 assert.equal(seasonOn('2027-01-06').id,'winter')
 assert.equal(seasonOn('2027-01-07'),null)
 const oct={...none,today:'2026-10-20'}
 const got=h=>[...earnedStickers({...oct,...h})].filter(id=>id.startsWith('halloween-')).sort().join(',')
 assert.equal(got({tasks:[task('2026-10-05',true,'2026-10-02')]}),'halloween-candy,halloween-pumpkin')
 assert.equal(got({tasks:[task('2026-09-29',true,'2026-09-29')]}),'','September doesn’t count')
 assert.equal(got({completionDates:{'2026-09-30':1,'2026-10-01':1,'2026-10-02':1}}),'','the streak has to be 3 October days')
 assert.equal(got({completionDates:{'2026-10-01':1,'2026-10-02':1,'2026-10-03':1}}),'halloween-ghost')
 assert.equal(got({tasks:Array.from({length:10},()=>task('2026-10-09',true,'2026-10-09'))}),'halloween-bat,halloween-pumpkin')
 const winter=[...earnedStickers({...none,today:'2027-01-03',tasks:[task('2027-01-02',true,'2027-01-02')]})].filter(id=>id.startsWith('winter-'))
 assert.deepEqual(winter,['winter-snowman'],'the event runs across New Year')
 // In Decorate: offered during the event, or once earned; everyday stickers always.
 assert.ok(stickerOffered('streak-3',new Set(),'2026-06-01'))
 assert.ok(stickerOffered('halloween-pumpkin',new Set(),'2026-10-10'))
 assert.ok(!stickerOffered('halloween-pumpkin',new Set(),'2026-11-10'))
 assert.ok(stickerOffered('halloween-pumpkin',new Set(['halloween-pumpkin']),'2026-11-10'),'earned ones stay')
 for(const season of SEASONS)for(const t of season.stickers)assert.ok(BUILD_ASSET_BY_ID['sticker-'+t.id],t.id)
})

const {nextUpList}=load('src/store/nextUp.ts')
test('What should I do now: late first, then today, tomorrow, then big work early in the week; steps point at the next one',()=>{
 const t=(id,due,extra={})=>({id,title:id,due,done:false,...extra})
 const list=nextUpList([t('small-fri','2026-10-02',{estimatedMinutes:15}),t('big-mon','2026-10-05',{estimatedMinutes:90}),t('tomorrow','2026-10-01'),t('today',wed),t('late','2026-09-28'),t('older-late','2026-09-25'),t('far','2026-10-20'),t('done',wed,{done:true})],wed)
 assert.equal(list.map(i=>i.id).join(','),['older-late','late','today','tomorrow','big-mon','small-fri'].join(','))
 assert.match(list[0].why,/late/)
 assert.equal(list[2].why,'It’s due today.')
 assert.match(list[4].why,/big one/)
 assert.equal(list[4].minutes,90)
 assert.equal(list[5].minutes,15)
 assert.equal(list[2].minutes,25,'no estimate: a 25-minute focus')
 const steps=nextUpList([t('essay',wed,{subtasks:[{title:'Outline',done:true},{title:'Draft',done:false}]})],wed)
 assert.equal(steps[0].step,'Draft')
 assert.equal(nextUpList([],wed).length,0)
 const withTest=nextUpList([t('late','2026-09-28'),t('today',wed),t('tomorrow','2026-10-01')],wed,[{id:'bio-test',title:'Bio test',due:'2026-10-01',done:false},{id:'far-test',title:'Far test',due:'2026-10-09',done:false}])
 assert.equal(withTest.map(i=>i.title).join(','),['late','today','Study for Bio test','tomorrow'].join(','),'a test tomorrow comes right after today’s work')
 assert.equal(withTest[2].exam,true)
 assert.equal(withTest[2].why,'The test is tomorrow.')
 assert.equal(nextUpList([],wed,[{id:'x',title:'Quiz',due:wed,done:false}]).map(i=>i.title).join(','),['Study for Quiz'].join(','))
})

const {templateSteps,stepDays,parseSteps,suggestSteps}=load('src/store/projectSteps.ts')
test('project steps: a template for the kind of work, spread from today to the day before it’s due',()=>{
 const essay=templateSteps('History essay',wed,'2026-10-12')
 assert.equal(essay.map(s=>s.title).join('|'),'Pick your topic and gather sources|Make an outline|Write the first draft|Revise and edit|Read it over one last time')
 assert.equal(essay.map(s=>s.due).join(','),'2026-09-30,2026-10-03,2026-10-06,2026-10-08,2026-10-11')
 assert.equal(templateSteps('Science fair poster',wed,'2026-10-07')[0].title,'Plan it and list what you need')
 assert.equal(templateSteps('Read chapters 4-6',wed,'2026-10-07')[0].title,'Read the first part')
 assert.equal(templateSteps('Math packet',wed,'2026-10-07').length,3)
 const tight=templateSteps('English essay',wed,'2026-10-01')
 assert.equal(tight.length,2,'one day of room: keep the first and last step')
 assert.equal(tight.map(s=>s.title+'@'+s.due).join('|'),'Pick your topic and gather sources@2026-09-30|Read it over one last time@2026-09-30')
 assert.equal(stepDays(3,wed,wed).join(','),[wed,wed,wed].join(','),'due today: everything today')
})

test('project steps from the AI are checked: dates kept between today and the due date, in order, at least 2 steps',()=>{
 const raw='```json\n{"steps":[{"title":"Draft","date":"2026-10-05"},{"title":"Research  sources","date":"2026-09-01"},{"title":"Edit","date":"2026-12-01"},{"date":"2026-10-02"}]}\n```'
 const steps=parseSteps(raw,wed,'2026-10-10')
 assert.equal(steps.map(s=>s.title+'@'+s.due).join('|'),'Research sources@2026-09-30|Draft@2026-10-05|Edit@2026-10-10')
 assert.throws(()=>parseSteps('{"steps":[{"title":"One","date":"2026-10-01"}]}',wed,'2026-10-10'))
 assert.throws(()=>parseSteps('not json',wed,'2026-10-10'))
})

const {nextUpList:nextUp2}=load('src/store/nextUp.ts')
test('a project’s step planned for today comes up today, even when the project is due later',()=>{
 const project={id:'essay',title:'History essay',due:'2026-10-12',done:false,subtasks:[{title:'Outline',done:true,due:'2026-09-29'},{title:'Draft',done:false,due:wed}]}
 const list=nextUp2([project,{id:'tmr',title:'Worksheet',due:'2026-10-01',done:false}],wed)
 assert.equal(list.map(i=>i.id).join(','),'essay,tmr')
 assert.equal(list[0].step,'Draft')
 assert.equal(list[0].why,'Today’s step for this project.')
 const behind=nextUp2([{...project,subtasks:[{title:'Outline',done:false,due:'2026-09-28'}]}],wed)
 assert.match(behind[0].why,/planned for Monday, so it’s a little behind/)
 assert.equal(nextUp2([{...project,due:'2026-10-30',subtasks:[{title:'Outline',done:false,due:'2026-10-20'}]}],wed).length,0,'nothing this week')
})

const askKono=load('src/store/askKono.ts'),modelForAsk=load('src/store/model.ts')
test('Ask KONO understands today, tomorrow, this week and "when is … due"',()=>{
 const q=t=>{const r=askKono.readQuestion(t);return r.kind+(r.query?':'+r.query:'')}
 assert.equal(q("What's my schedule today?"),'today')
 assert.equal(q('what do I have tomorrow'),'tomorrow')
 assert.equal(q('what is due this week'),'week')
 assert.equal(q('When is my bio essay due?'),'due:bio essay')
 assert.equal(q('when is the math test'),'due:math test')
 assert.equal(q('  '),'unknown')
 assert.equal(q('when is it due'),'unknown','nothing to look for')
})

test('Ask KONO answers a day (classes in order, events, tests, due, no school), the week, and when something is due',()=>{
 const d=modelForAsk.createFreshData(),pid=d.activeProfileId
 d.subjects.push({id:'bio',profileId:pid,name:'Biology',color:'#4169a8',resources:[]})
 const week=modelForAsk.blankWeek()
 week.Wednesday=[{id:'b2',label:'Algebra',start:'10:15',end:'11:00',kind:'study'},{id:'b1',label:'Biology',start:'09:00',end:'09:50',kind:'study',location:'Room 235'},{id:'l',label:'Lunch',start:'12:00',end:'12:30',kind:'break'}]
 d.studySeasons=[{id:'s',profileId:pid,name:'Fall',start:'2026-09-01',end:'2026-12-20',active:true,week}]
 d.tasks.push({id:'t1',profileId:pid,subjectId:'bio',title:'Lab report',due:wed,done:false,notes:''},{id:'t2',profileId:pid,subjectId:'bio',title:'Ecology essay',due:'2026-10-09',done:false,notes:''},{id:'t3',profileId:pid,subjectId:'',title:'Old worksheet',due:'2026-09-25',done:false,notes:''})
 d.exams.push({id:'e1',profileId:pid,subjectId:'bio',title:'Cell biology test',due:'2026-10-02',done:false,notes:''})
 d.calendarEvents.push({id:'ev',profileId:pid,date:wed,title:'Soccer practice',kind:'sports',notes:'',time:'16:30'})
 const today=askKono.dayAnswer(d,wed,wed)
 assert.equal(today.lines.join(' | '),'9:00 AM · Biology (Room 235) | 10:15 AM · Algebra | 4:30 PM · Soccer practice | ✎ Due: Lab report | ⚠ Late: Old worksheet')
 assert.match(today.speech,/^Today, Wednesday, September 30\. You have 2 classes\. Biology at 9:00 AM and Algebra at 10:15 AM\. Also, Soccer practice at 4:30 PM\. Due today: Lab report\. And one late assignment: Old worksheet\.$/)
 const thu=askKono.answer(d,{kind:'tomorrow'},wed)
 assert.equal(thu.lines.join(' | '),'Nothing on the plan.')
 assert.match(thu.speech,/Nothing is on your plan tomorrow/)
 const week2=askKono.weekAnswer(d,wed)
 assert.equal(week2.lines.join(' | '),'Today: Lab report | Friday: ★ Cell biology test')
 assert.match(week2.speech,/^2 things are due this week\./)
 assert.equal(askKono.dueAnswer(d,'bio essay',wed).speech,'Ecology essay is due Friday, October 9, in 9 days.','bio matches the Biology class')
 assert.equal(askKono.dueAnswer(d,'cell test',wed).speech,'Cell biology test is on Friday, October 2, in 2 days.')
 assert.equal(askKono.dueAnswer(d,'lab',wed).speech,'Lab report is due today.')
 assert.equal(askKono.dueAnswer(d,'worksheet',wed).speech,'Old worksheet was due Friday, September 25, so it’s late.')
 assert.equal(askKono.dueAnswer(d,'soccer',wed).speech,'Soccer practice is today at 4:30 PM.')
 assert.match(askKono.dueAnswer(d,'piano',wed).speech,/couldn’t find/)
 // Parent mode: kid names in front.
 d.settings.parentMode=true;d.kids.push({id:'kid-a',profileId:pid,name:'Emma',color:'#e86a5c'});d.calendarEvents[0].kidId='kid-a'
 assert.match(askKono.dayAnswer(d,wed,wed).speech,/Emma: Soccer practice at 4:30 PM/)
})

test('KONO’s good morning / goodnight sum up a day in one sentence',()=>{
 const d=modelForAsk.createFreshData(),pid=d.activeProfileId
 const week=modelForAsk.blankWeek()
 week.Wednesday=[{id:'b2',label:'Algebra',start:'10:15',end:'11:00',kind:'study'},{id:'b1',label:'Biology',start:'09:00',end:'09:50',kind:'study'}]
 week.Thursday=[{id:'b3',label:'Art',start:'08:30',end:'09:20',kind:'study'}]
 d.studySeasons=[{id:'s',profileId:pid,name:'Fall',start:'2026-09-01',end:'2026-12-20',active:true,week}]
 d.tasks.push({id:'t1',profileId:pid,subjectId:'',title:'Lab report',due:'2026-09-30',done:false,notes:''})
 d.exams.push({id:'e1',profileId:pid,subjectId:'',title:'Cell biology test',due:'2026-09-30',done:false,notes:''},{id:'e2',profileId:pid,subjectId:'',title:'Spanish',due:'2026-10-01',done:false,notes:''})
 d.calendarEvents.push({id:'ev',profileId:pid,date:'2026-09-30',title:'Soccer practice',kind:'sports',notes:'',time:'16:30'})
 assert.equal(load('src/store/dayGlance.ts').dayGlance(d,'2026-09-30'),'2 classes, starting with Biology at 9:00 AM, the Cell biology test, Lab report is due and Soccer practice at 4:30 PM.')
 assert.equal(load('src/store/dayGlance.ts').dayGlance(d,'2026-10-01'),'Art at 8:30 AM and the Spanish test.')
 assert.equal(load('src/store/dayGlance.ts').dayGlance(d,'2026-10-03'),'nothing on the plan.')
})

const wardrobeMod=load('src/store/konoWardrobe.ts'),careMod=load('src/store/konoCare.ts')
test('Wardrobe: outfits unlock by finished work and granted wishes; seasonal outfits (Halloween, winter, Valentine’s) count only in their season and show only then or once earned',()=>{
 const w=wardrobeMod,ids=set=>[...set].sort().join(',')
 const S=(h=0,wi=0,v=0,sp=0,se=0)=>({halloween:h,winter:wi,valentine:v,spring:sp,semester:se})
 const st=(finished,wishes,sf=S(),sw=S())=>({finished,wishes,seasonFinished:sf,seasonWishes:sw})
 assert.equal(ids(w.unlockedOutfits(st(0,0))),'')
 assert.equal(ids(w.unlockedOutfits(st(5,1))),'beanie,bow')
 assert.equal(ids(w.unlockedOutfits(st(50,14))),'beanie,bow,chef,crown,flowers,gradcap,sunhat,wizard')
 assert.equal(ids(w.unlockedOutfits(st(6,3,S(6),S(3)))),'beanie,bow,frankenstein,ghost,sunhat,witch')
 assert.equal(ids(w.unlockedOutfits(st(3,2,S(0,3),S(0,0,2)))),'beanie,earmuffs,heartband')
 assert.equal(ids(w.unlockedOutfits(st(5,3,S(0,0,0,0,5),S(0,0,0,3)))),'beanie,bow,bunnyears,partyhat,sunhat')
 const none=new Set()
 assert.equal(w.outfitsOffered(none,'2026-10-15').length,11,'October: the everyday outfits and the Halloween costumes')
 assert.equal(w.outfitsOffered(none,'2026-11-02').length,8,'November: seasonal outfits are hidden…')
 assert.equal(w.outfitsOffered(new Set(['ghost']),'2026-11-02').some(o=>o.id==='ghost'),true,'…unless earned')
 assert.deepEqual([...w.outfitsOffered(none,'2026-12-20').filter(o=>o.season).map(o=>o.id)],['earmuffs'],'December: earmuffs')
 assert.deepEqual([...w.outfitsOffered(none,'2027-02-10').filter(o=>o.season).map(o=>o.id)],['earmuffs','heartband'],'Valentine’s week: earmuffs and the heart headband')
 assert.equal(w.outfitHow(w.OUTFITS.find(o=>o.id==='witch')),'Finish 2 assignments in October.')
 assert.deepEqual([...w.outfitsOffered(none,'2027-04-10').filter(o=>o.season).map(o=>o.id)],['bunnyears'],'spring: bunny ears')
 assert.deepEqual([...w.outfitsOffered(none,'2027-06-01').filter(o=>o.season).map(o=>o.id)],['partyhat'],'end of semester: the party hat')
 assert.equal(w.outfitHow(w.OUTFITS.find(o=>o.id==='partyhat')),'Finish 5 assignments at the end of the semester (May 21 – June 20).')
 assert.equal(w.outfitHow(w.OUTFITS.find(o=>o.id==='heartband')),'Grant 2 of KONO’s wishes during Valentine’s week (February 1–14).')
 const tasks=[{due:'2026-10-02',done:true,completedAt:'2026-10-02T15:00:00'},{due:'2026-09-02',done:true,completedAt:'2026-09-02T15:00:00'},{due:'2027-01-10',done:true,completedAt:'2027-01-10T15:00:00'}]
 const log=[{id:'wish-2026-10-02',kind:'wish',at:'2026-10-02T12:00:00.000Z'},{id:'wish-2026-09-20',kind:'wish',at:'2026-09-20T12:00:00.000Z'},{id:'wish-2026-10-02',kind:'wish',at:'2026-10-02T12:00:00.000Z'},{id:'wish-2027-02-03',kind:'wish',at:'2027-02-03T12:00:00.000Z'}]
 const stats=w.wardrobeStats(9,tasks,log)
 assert.equal([stats.finished,stats.wishes,stats.seasonFinished.halloween,stats.seasonWishes.halloween].join(),'9,3,1,1','the same wish saved twice counts once')
 assert.equal([stats.seasonFinished.winter,stats.seasonWishes.winter,stats.seasonWishes.valentine].join(),'1,1,1','winter runs across New Year to February 14')
 const unlocked=w.unlockedOutfits(st(5,1))
 assert.equal(w.wornOutfit([{id:'a',kind:'wear',at:'2026-10-01T10:00:00Z',item:'bow'},{id:'b',kind:'wear',at:'2026-10-01T11:00:00Z',item:'beanie'}],unlocked),'beanie','the latest pick')
 assert.equal(w.wornOutfit([{id:'a',kind:'wear',at:'2026-10-01T10:00:00Z',item:''}],unlocked),null,'taken off')
 assert.equal(w.wornOutfit([{id:'a',kind:'wear',at:'2026-10-01T10:00:00Z',item:'crown'}],unlocked),null,'not earned: not worn')
})

test('Daily wish: finish today’s work (up to 3), get ahead, or be tucked in; progress counts what was finished today',()=>{
 const w=wardrobeMod,t='2026-10-02'
 const due=(n,done=0)=>Array.from({length:n},(_,i)=>({due:t,done:i<done,completedAt:i<done?t+'T15:00:00':undefined}))
 assert.equal(JSON.stringify(w.todaysWish(due(5),[],t)),JSON.stringify({kind:'finish',goal:3}))
 assert.equal(JSON.stringify(w.todaysWish(due(1),[],t)),JSON.stringify({kind:'finish',goal:1}))
 assert.equal(w.todaysWish([{due:'2026-10-05',done:false}],[],t).kind,'ahead')
 assert.equal(w.todaysWish([],[],t).kind,'bedtime')
 assert.equal(w.wishProgress({kind:'finish',goal:3},[...due(3,2),{due:'2026-09-20',done:true,completedAt:t+'T09:00:00'}],[],t),3,'late work finished today counts too')
 assert.equal(w.wishProgress({kind:'ahead',goal:1},[{due:'2026-10-05',done:true,completedAt:t+'T10:00:00'}],[],t),1)
 assert.equal(w.wishProgress({kind:'bedtime',goal:1},[],[{id:'s',kind:'sleep',at:t+'T21:00:00'}],t),1)
 assert.equal(w.wishText({kind:'finish',goal:2}),'finish 2 things today')
 assert.equal(JSON.stringify(w.wishEvent(t)),JSON.stringify({id:'wish-2026-10-02',kind:'wish',at:'2026-10-02T12:00:00.000Z'}),'the same entry on every device')
 // Old entries are trimmed after a month, but granted wishes and the outfit KONO has on stay.
 const now=new Date('2026-12-15T12:00:00Z')
 let s={profileId:'p',log:[w.wishEvent('2026-10-02'),{id:'w',kind:'wear',at:'2026-10-03T10:00:00.000Z',item:'beanie'},{id:'p1',kind:'pet',at:'2026-10-03T10:00:00.000Z'}]}
 s=careMod.addCareEvent(s,'p',{id:'p2',kind:'pet',at:now.toISOString()},now)
 assert.equal(s.log.map(e=>e.id).join(),'wish-2026-10-02,w,p2,bond-2026-12-15','(the pat also marks a day KONO was cared for: store/konoBond)')
 assert.equal(careMod.addCareEvent(s,'p',w.wishEvent('2026-10-02'),now).log.length,4,'a wish is saved once')
 assert.equal(careMod.readCareState({log:[{id:'w',kind:'wear',at:'2026-10-03T10:00:00Z',item:'ghost'}]},'p').log[0].item,'ghost')
})

const findsMod=load('src/store/konoFinds.ts')
test('Focus finds: 10+ minutes finds something, longer sessions find rarer things, new finds come first, and the seasons bring a pumpkin, a snowflake or a candy heart',()=>{
 const f=findsMod,none=new Map(),tier=(m,roll,found=none,day='2026-09-15')=>f.findFor(m,roll,found,day)?.id
 assert.equal(f.findFor(9,0.9,none,'2026-09-15'),null,'too short for a find')
 const of=(id)=>f.FINDS.find(x=>x.id===id).tier
 assert.equal(of(tier(10,0.99)),'common','10 minutes: something common')
 assert.equal(of(tier(25,0.1)),'common');assert.equal(of(tier(25,0.6)),'uncommon')
 assert.equal(of(tier(45,0.45)),'uncommon');assert.equal(of(tier(60,0.9)),'rare')
 const allCommonButLeaf=new Map(f.FINDS.filter(x=>x.tier==='common'&&x.id!=='leaf').map(x=>[x.id,1]))
 assert.equal(tier(15,0.3,allCommonButLeaf),'leaf','something not found yet comes first')
 const everyCommon=new Map(f.FINDS.filter(x=>x.tier==='common').map(x=>[x.id,1]))
 assert.equal(of(tier(15,0.3,everyCommon)),'common','with everything found, a repeat is fine')
 assert.equal(tier(15,0.1,none,'2026-10-15'),'pumpkin','October can bring a pumpkin')
 assert.notEqual(tier(15,0.1,new Map([['pumpkin',1]]),'2026-10-15'),'pumpkin','only one pumpkin hunt')
 assert.equal(f.findsOffered(none,'2026-11-02').some(x=>x.id==='pumpkin'),false)
 assert.equal(f.findsOffered(new Map([['pumpkin',1]]),'2026-11-02').some(x=>x.id==='pumpkin'),true)
 assert.equal(tier(15,0.1,none,'2026-12-20'),'snowflake','winter can bring a snowflake')
 assert.ok(['snowflake','candy-heart'].includes(tier(15,0.1,none,'2027-02-10')),'Valentine’s week: a snowflake or a candy heart')
 assert.equal(tier(15,0.1,new Map([['snowflake',1]]),'2027-02-10'),'candy-heart')
 assert.equal(f.findHow(f.FINDS.find(x=>x.id==='snowflake')),'Found on focus sessions between December 1 and February 14.')
 assert.deepEqual([...f.findsOffered(none,'2026-12-20').filter(x=>x.season).map(x=>x.id)],['snowflake'])
 assert.equal(tier(15,0.1,none,'2027-04-10'),'blossom','spring can bring a cherry blossom')
 assert.equal(tier(15,0.1,none,'2027-06-01'),'diploma','the end of the semester can bring a tiny diploma')
 assert.equal(tier(15,0.1,none,'2027-07-01')&&f.FINDS.find(x=>x.id===tier(15,0.1,none,'2027-07-01')).season,undefined,'summer: no seasonal find')
 const r1=f.rollFrom(1759330800000),r2=f.rollFrom(1759330800000);assert.equal(r1,r2);assert.ok(r1>=0&&r1<1)
 const counts=f.foundCounts([{id:'a',kind:'find',at:'2026-10-01T10:00:00Z',item:'acorn'},{id:'b',kind:'find',at:'2026-10-02T10:00:00Z',item:'acorn'},{id:'c',kind:'pet',at:'2026-10-02T10:00:00Z'}])
 assert.equal(counts.get('acorn'),2)
 assert.equal(f.foundLine(f.FINDS.find(x=>x.id==='acorn'),25),'KONO found an acorn while you focused for 25 minutes! It’s in Decorate › Finds.')
 // Finds stay in the collection past the month-long trim.
 const now=new Date('2026-12-15T12:00:00Z')
 const s=careMod.addCareEvent({profileId:'p',log:[{id:'a',kind:'find',at:'2026-09-01T10:00:00.000Z',item:'star'}]},'p',{id:'p',kind:'pet',at:now.toISOString()},now)
 assert.equal(s.log.filter(e=>e.kind!=='bond').map(e=>e.id).join(),'a,p')
 assert.equal(careMod.readCareState({log:[{id:'a',kind:'find',at:'2026-09-01T10:00:00Z',item:'star'}]},'p').log[0].item,'star')
})

const seasonMod=load('src/game/sanctuary/season.ts')
test('the island’s seasons: Halloween all October, snow from December 1 to February 14 with hearts in Valentine’s week, spring blossom, the end of the semester, and their sticker events',()=>{
 const at=day=>seasonMod.islandSeason(new Date(day+'T12:00:00'))
 assert.equal(at('2026-09-30'),null);assert.equal(at('2026-10-01'),'halloween');assert.equal(at('2026-10-31'),'halloween')
 assert.equal(at('2026-11-30'),null);assert.equal(at('2026-12-01'),'winter');assert.equal(at('2027-01-20'),'winter')
 assert.equal(at('2027-02-01'),'valentine');assert.equal(at('2027-02-14'),'valentine');assert.equal(at('2027-02-15'),null)
 assert.equal(at('2027-03-19'),null);assert.equal(at('2027-03-20'),'spring');assert.equal(at('2027-05-20'),'spring')
 assert.equal(at('2027-05-21'),'semester');assert.equal(at('2027-06-20'),'semester');assert.equal(at('2027-06-21'),null);assert.equal(at('2027-08-01'),null)
 assert.equal(seasonMod.islandMapPath('morning','spring'),'/garden/terrace-23.0/spring/morning');assert.equal(seasonMod.islandMapPath('morning','semester'),'/garden/terrace-23.0/semester/morning')
 assert.equal(seasonOn('2027-04-02').id,'spring');assert.equal(seasonOn('2027-06-02').id,'semester')
 assert.equal(seasonMod.islandMapPath('night','valentine'),'/garden/terrace-23.0/winter/night','Valentine’s week uses the winter island')
 assert.equal(seasonMod.islandMapPath('night',null),'/garden/terrace-23.0/night')
 assert.equal(seasonOn('2027-02-10').id,'valentine');assert.equal(seasonOn('2027-02-15'),null)
 const got=[...earnedStickers({...none,today:'2027-02-12',tasks:[task('2027-02-12',true,'2027-02-09')]})].filter(id=>id.startsWith('valentine-')).sort()
 assert.deepEqual(got,['valentine-chocolate','valentine-heart'])
})

console.log(passed+' KONO mood and sticker groups passed')
