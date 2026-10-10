// Taking care of KONO (src/store/konoCare.ts): snacks come only from finished work, meters drift
// gently and never reach zero, a long break means KONO is back from a trip (not sad), pats are
// throttled, and an unreadable care log never stops a plan from opening.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const mod={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/store/konoCare.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Date,Math,Number,Set,Array,Object,JSON,Infinity})
const {pantry,careMeters,restedAt,restedFor,addCareEvent,readCareState,treatFor,isAwayVisit,bedtime,nightOf,favoriteSnack,fedLine,FLOOR,TREAT_DAYS,ALL_TREATS,tasted,tasteEventId,tasteLine,nextPlayAt,PLAY_EVERY_MS}=mod.exports
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const at=(iso)=>new Date(iso)
const now=at('2026-09-30T15:00:00')
const task=(id,completedAt,extra={})=>({id,done:!!completedAt,completedAt,...extra})
const hoursAgo=h=>new Date(now.getTime()-h*3_600_000).toISOString()

test('snacks: one per assignment finished in the last two weeks, oldest first, gone once eaten',()=>{
 const tasks=[task('a',hoursAgo(2)),task('b',hoursAgo(30)),task('c',undefined),task('old',hoursAgo(24*(TREAT_DAYS+1)))]
 assert.equal(pantry(tasks,[],now).map(p=>p.taskId).join(),'b,a','unfinished and stale work earns nothing')
 assert.equal(pantry(tasks,[{id:'e1',kind:'feed',at:hoursAgo(1),taskId:'b'}],now).map(p=>p.taskId).join(),'a')
 assert.equal(treatFor(task('x',hoursAgo(1))).id,treatFor(task('x',hoursAgo(5))).id,'the same assignment is always the same snack')
 const big=treatFor(task('essay',hoursAgo(1),{estimatedMinutes:90})),steps=treatFor(task('project',hoursAgo(1),{subtasks:[1,2,3]}))
 for(const t of [big,steps])assert.ok(['bento','cake','boba'].includes(t.id),'big work earns a feast, got '+t.id)
})

test('meters: snacks fill KONO up, pats and finished work make it happy, and it drifts slowly but never below the floor',()=>{
 const quiet=careMeters([],[task('a',hoursAgo(40))],now)
 assert.ok(quiet.full>=FLOOR.full&&quiet.happy>=FLOOR.happy)
 const fed=careMeters([{id:'f',kind:'feed',at:hoursAgo(0.1),taskId:'a'}],[task('a',hoursAgo(40))],now)
 assert.ok(fed.full>=quiet.full+20,'a snack fills KONO up')
 const patted=careMeters([{id:'p',kind:'pet',at:hoursAgo(0.1)}],[task('a',hoursAgo(40))],now)
 assert.ok(patted.happy>quiet.happy)
 const busy=careMeters([],[task('a',hoursAgo(40)),task('b',hoursAgo(1)),task('c',hoursAgo(1))],now)
 assert.ok(busy.happy>quiet.happy,'finishing work makes KONO happy')
 const lots=Array.from({length:12},(_,i)=>({id:'f'+i,kind:'feed',at:hoursAgo(1+i*0.05),taskId:'t'+i}))
 const stuffed=careMeters(lots,[task('a',hoursAgo(1))],now).full
 assert.ok(stuffed<=100&&stuffed>=95,'full tops out at 100 (then drifts a little in the hour since): '+stuffed)
 const starving=careMeters([{id:'f',kind:'feed',at:hoursAgo(47)}],[task('a',hoursAgo(47))],now)
 assert.ok(starving.full>=FLOOR.full&&starving.full<40,'two hungry days still leave KONO at the floor, not zero')
})

test('a long break: the first visit in three days finds KONO back from a trip, comfortable and happy',()=>{
 const m=careMeters([{id:'f',kind:'feed',at:hoursAgo(24*5)}],[task('a',hoursAgo(24*5))],now,true)
 assert.equal(m.away,true);assert.ok(m.full>=60&&m.happy>=70)
 assert.equal(isAwayVisit(now.getTime()-4*86_400_000,now),true)
 assert.equal(isAwayVisit(now.getTime()-2*86_400_000,now),false,'opening KONO every day or two is not a trip')
 assert.equal(isAwayVisit(NaN,now),false,'the first visit ever isn’t "away"');assert.equal(isAwayVisit(0,now),false)
})

test('rested follows the day: fresh in the morning, sleepier toward bedtime, asleep at night',()=>{
 assert.equal(restedAt(at('2026-09-30T07:00:00')).rested,100)
 assert.ok(restedAt(at('2026-09-30T20:00:00')).rested<restedAt(at('2026-09-30T12:00:00')).rested)
 assert.ok(restedAt(at('2026-09-30T21:59:00')).rested>=FLOOR.rested)
 assert.equal(restedAt(at('2026-09-30T23:30:00')).asleep,true)
 assert.ok(restedAt(at('2026-10-01T05:30:00')).rested>restedAt(at('2026-09-30T23:30:00')).rested,'sleep restores KONO overnight')
})

test('the log: a pat counts once per ten minutes, a snack can’t be eaten twice, and old entries are dropped',()=>{
 let s=addCareEvent(undefined,'p1',{id:'1',kind:'pet',at:now.toISOString()},now)
 s=addCareEvent(s,'p1',{id:'2',kind:'pet',at:now.toISOString()},new Date(now.getTime()+5*60_000))
 const pats=()=>s.log.filter(e=>e.kind==='pet').length
 assert.equal(pats(),1)
 s=addCareEvent(s,'p1',{id:'3',kind:'pet',at:now.toISOString()},new Date(now.getTime()+11*60_000))
 assert.equal(pats(),2)
 s=addCareEvent(s,'p1',{id:'4',kind:'feed',at:now.toISOString(),taskId:'a'},now)
 s=addCareEvent(s,'p1',{id:'5',kind:'feed',at:now.toISOString(),taskId:'a'},now)
 assert.equal(s.log.filter(e=>e.kind==='feed').length,1)
 const later=new Date(now.getTime()+31*86_400_000)
 assert.equal(addCareEvent(s,'p1',{id:'6',kind:'pet',at:later.toISOString()},later).log.filter(e=>e.kind!=='bond').map(e=>e.id).join(),'6','a month later only the new pat is kept (and the days KONO was cared for, store/konoBond)')
})

test('reading a saved log: odd or broken entries are dropped quietly, never an error',()=>{
 const r=readCareState({log:[{id:'ok',kind:'feed',at:'2026-09-30T10:00:00Z',taskId:'a'},{id:'',kind:'pet',at:'2026-09-30T10:00:00Z'},{id:'x',kind:'dance',at:'2026-09-30T10:00:00Z'},{id:'y',kind:'pet',at:'yesterday'},null,'junk',{id:'z',kind:'pet',at:'2026-09-30T11:00:00+02:00',taskId:7}]},'p1')
 assert.equal(r.log.map(e=>e.id).join(),'ok,z')
 assert.equal(r.log[1].at,'2026-09-30T09:00:00.000Z');assert.equal(r.log[1].taskId,undefined)
 for(const bad of [undefined,null,'x',[],{log:'nope'},{log:{}}])assert.equal(readCareState(bad,'p1').log.length,0)
})
test('bedtime: tuck in from 7 PM once a night, asleep until morning, then Wake up once between 6 AM and noon',()=>{
 const t=iso=>new Date(iso)
 assert.equal(bedtime([],t('2026-09-30T18:30:00')).canTuck,false,'not before 7 PM')
 assert.equal(bedtime([],t('2026-09-30T21:00:00')).canTuck,true)
 let s=addCareEvent(undefined,'p1',{id:'s1',kind:'sleep',at:t('2026-09-30T21:00:00').toISOString()},t('2026-09-30T21:00:00'))
 s=addCareEvent(s,'p1',{id:'s2',kind:'sleep',at:t('2026-09-30T21:05:00').toISOString()},t('2026-09-30T21:05:00'))
 assert.equal(s.log.filter(e=>e.kind==='sleep').length,1,'one tuck-in a night')
 for(const at of ['2026-09-30T23:00:00','2026-10-01T03:00:00']){const b=bedtime(s.log,t(at));assert.equal(b.tucked,true,at);assert.equal(b.canTuck,false)}
 assert.equal(careMeters(s.log,[],t('2026-09-30T21:30:00')).asleep,true,'tucked in early: asleep already')
 assert.equal(nightOf(t('2026-10-01T02:00:00')),'2026-09-30','after midnight still belongs to the evening before')
 const morning=bedtime(s.log,t('2026-10-01T07:30:00'))
 assert.equal(morning.tucked,false);assert.equal(morning.canWake,true)
 s=addCareEvent(s,'p1',{id:'w1',kind:'wake',at:t('2026-10-01T07:30:00').toISOString()},t('2026-10-01T07:30:00'))
 assert.equal(bedtime(s.log,t('2026-10-01T08:00:00')).canWake,false,'one wake-up a day')
 assert.equal(addCareEvent(s,'p1',{id:'w2',kind:'wake',at:t('2026-10-01T08:00:00').toISOString()},t('2026-10-01T08:00:00')).log.filter(e=>e.kind!=='bond').length,2)
 assert.equal(bedtime(s.log,t('2026-10-01T13:00:00')).canWake,false,'not after noon')
 assert.equal(bedtime(s.log,t('2026-10-01T20:00:00')).canTuck,true,'a new night')
 assert.equal(readCareState({log:[{id:'a',kind:'sleep',at:'2026-09-30T21:00:00Z'},{id:'b',kind:'wake',at:'2026-10-01T07:00:00Z'}]},'p1').log.length,2)
})
test('a favorite snack each week: the same all week on every device, extra happy when KONO eats it',()=>{
 const mon=favoriteSnack('2026-10-05'),week=['2026-10-06','2026-10-08','2026-10-11'].map(d=>favoriteSnack(d).id)
 assert.ok(week.every(id=>id===mon.id),'Monday to Sunday share one favorite')
 const weeks=new Set(Array.from({length:12},(_,i)=>{const d=new Date('2026-09-07T12:00:00');d.setDate(d.getDate()+7*i);return favoriteSnack(d.toISOString().slice(0,10)).id}))
 assert.ok(weeks.size>=3,'it changes from week to week')
 const fav=favoriteSnack('2026-09-30'),other=['onigiri','dumpling','dango','strawberry','cookie','peach'].find(id=>id!==fav.id)
 const fed=item=>careMeters([{id:'f',kind:'feed',at:'2026-09-30T14:00:00.000Z',taskId:'t',item}],[],at('2026-09-30T15:00:00')).happy
 assert.ok(fed(fav.id)>fed(other)+5,'the favorite makes KONO happier')
 assert.match(fedLine(fav,true),/favorite this week/)
 assert.equal(readCareState({log:[{id:'f',kind:'feed',at:'2026-09-30T14:00:00.000Z',taskId:'t',item:fav.id}]},'p').log[0].item,fav.id,'what was eaten is kept')
})
test('play time: a game with KONO makes it happier (and a bit hungry), and counts once an hour',()=>{
 const base=careMeters([],[],now),played=careMeters([{id:'g',kind:'play',at:hoursAgo(0.1)}],[],now)
 assert.ok(played.happy>=base.happy+10,'playing makes KONO happy: '+base.happy+' -> '+played.happy)
 assert.ok(played.full<=base.full,'and a little hungry')
 const once=addCareEvent(undefined,'p',{id:'g1',kind:'play',at:now.toISOString()},now)
 assert.equal(once.log.filter(e=>e.kind==='play').length,1)
 const again=addCareEvent(once,'p',{id:'g2',kind:'play',at:new Date(now.getTime()+20*60_000).toISOString()},new Date(now.getTime()+20*60_000))
 assert.equal(again.log.filter(e=>e.kind==='play').length,1,'twenty minutes later it doesn’t count again')
 assert.equal(nextPlayAt(once.log),now.getTime()+PLAY_EVERY_MS)
 assert.ok(once.log.some(e=>e.kind==='bond'),'playing marks a day of care')
})

test('snack book: each kind of snack KONO tries is remembered for good (one entry per kind)',()=>{
 const first=addCareEvent(undefined,'p',{id:tasteEventId('dango'),kind:'taste',at:now.toISOString(),item:'dango'},now)
 const twice=addCareEvent(first,'p',{id:tasteEventId('dango'),kind:'taste',at:now.toISOString(),item:'dango'},now)
 assert.equal(twice.log.filter(e=>e.kind==='taste').length,1)
 const later=new Date(now.getTime()+90*24*3_600_000)
 const kept=addCareEvent(twice,'p',{id:'p1',kind:'pet',at:later.toISOString()},later)
 assert.deepEqual([...tasted(kept.log)],['dango'],'tried snacks are never forgotten')
 assert.equal(ALL_TREATS.length,9)
 assert.match(tasteLine(ALL_TREATS.find(t=>t.id==='dango'),3),/^✨ New snack! 🍡 KONO tried a dango for the first time\. \(3 of 9 snacks tried\)$/)
 assert.equal(readCareState({log:[{id:'taste-cake',kind:'taste',at:'2026-09-30T14:00:00.000Z',item:'cake'}]},'p').log[0].item,'cake')
})

test('rest follows bedtime: tucked in by 10:30 PM wakes fully rested (and in a good mood), late or no tuck-in wakes groggier',()=>{
 const morning=at('2026-10-01T08:00:00')
 const early=[{id:'s',kind:'sleep',at:'2026-09-30T21:00:00'},{id:'w',kind:'wake',at:'2026-10-01T07:30:00'}].map(e=>({...e,at:new Date(e.at).toISOString()}))
 const late=[{id:'s',kind:'sleep',at:'2026-09-30T23:30:00'},{id:'w',kind:'wake',at:'2026-10-01T07:30:00'}].map(e=>({...e,at:new Date(e.at).toISOString()}))
 const none=[]
 const r=log=>restedFor(log,morning).rested
 assert.ok(r(early)>r(late)&&r(late)>r(none),'early '+r(early)+' > late '+r(late)+' > none '+r(none))
 assert.ok(r(early)>=95)
 const evening=at('2026-10-01T20:00:00')
 assert.ok(restedFor(early,evening).rested<r(early),'sleepier by evening')
 assert.ok(restedFor(none,evening).rested>=FLOOR.rested,'never below the floor')
 assert.equal(restedFor(none,at('2026-10-01T23:00:00')).asleep,true,'asleep at night either way')
 assert.ok(careMeters(early,[],morning).happy>careMeters(late,[],morning).happy,'an early night puts KONO in a good mood')
})
console.log(passed+'/11 KONO care groups passed.')
