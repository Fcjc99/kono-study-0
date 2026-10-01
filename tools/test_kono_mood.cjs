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

test('every sticker is a placeable island decoration with its own picture',()=>{
 assert.ok(BUILD_CATEGORIES.includes('stickers'))
 assert.equal(new Set(STICKERS.map(s=>s.id)).size,STICKERS.length)
 for(const s of STICKERS){const a=BUILD_ASSET_BY_ID['sticker-'+s.id];assert.ok(a,s.id);assert.equal(a.category,'stickers');assert.equal(a.src,stickerSrc(s.emoji));assert.match(a.src,/^data:image\/svg\+xml,/)}
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

console.log(passed+' KONO mood and sticker groups passed')
