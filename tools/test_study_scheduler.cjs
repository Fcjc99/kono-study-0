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
const model=load('src/store/model.ts'),s=load('src/store/studyScheduler.ts'),{mergeData}=load('src/store/merge.ts'),progress=load('src/game/progression/progressionEngine.ts')
const tests=[],test=(name,fn)=>tests.push([name,fn]),same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)))
function fixture(extra={}){
 const data=model.createFreshData(),plan={id:'study-test',profileId:data.activeProfileId,subjectId:'',title:'Reading',unit:'chapter',total:14,start:'2026-09-09',end:'2026-09-22',weekdays:[0,1,2,3,4,5,6],timeZone:'America/New_York',...extra}
 data.studyPlans=[plan];data.tasks=s.buildStudyTasks(plan,()=>randomUUID());return{data:model.normalizeData(data),plan}
}
const now=day=>new Date(`${day}T16:00:00Z`)
const due=(data,day)=>s.calendarTasks(data.tasks,data.studyPlans,now(day)).filter(t=>t.due===day&&!t.done)
function finish(data,index,day){
 data=structuredClone(data);const task=data.tasks[index],at=now(day).toISOString();task.done=true;task.completedAt=at
 data.sanctuaryProgress[task.profileId]=progress.applyTaskCompletionChange(data.sanctuaryProgress[task.profileId],{task,completed:true,completedAt:at})
 return model.normalizeData(data)
}
test('14 chapters / inclusive two weeks gives exactly one every day',()=>{
 const {data,plan}=fixture();same(data.tasks.map(t=>t.due),s.studyDates(plan.start,plan.end,plan.weekdays));same(data.tasks.map(t=>t.unitNumber),Array.from({length:14},(_,i)=>i+1));assert.equal(new Set(data.tasks.map(t=>t.id)).size,14)
})
test('one missed day gives two, two missed days gives three; no duplicate records',()=>{
 const {data}=fixture(),before=JSON.stringify(data);same(due(data,'2026-09-10').map(t=>t.unitNumber),[1,2]);same(due(data,'2026-09-11').map(t=>t.unitNumber),[1,2,3]);s.calendarTasks(data.tasks,data.studyPlans,now('2026-09-20'));assert.equal(JSON.stringify(data),before)
})
test('partial daily work only carries unchecked chapters; future units are unaffected',()=>{
 let {data}=fixture();data=finish(data,0,'2026-09-10');same(due(data,'2026-09-10').map(t=>t.unitNumber),[2]);same(due(data,'2026-09-11').map(t=>t.unitNumber),[2,3]);assert.equal(data.tasks[3].due,'2026-09-12')
})
test('early completion is distinct from completing the overdue chapter',()=>{
 let {data}=fixture();data=finish(data,2,'2026-09-10');same(due(data,'2026-09-11').map(t=>t.unitNumber),[1,2]);assert.equal(s.calendarTasks(data.tasks,data.studyPlans,now('2026-09-11')).find(t=>t.unitNumber===3).due,'2026-09-10')
})
test('after deadline backlog stays today and deadline never changes',()=>{
 const {data}=fixture();assert.equal(due(data,'2026-09-30').length,14);assert.equal(data.studyPlans[0].end,'2026-09-22');assert.equal(due(data,'2026-10-01').length,14)
})
test('future plan stays future, ordinary overdue assignments are untouched',()=>{
 const {data}=fixture();assert.equal(due(data,'2026-09-08').length,0);const ordinary={id:'normal',due:'2026-09-01',done:false};assert.equal(s.calendarTask(ordinary,undefined,now('2026-09-10')),ordinary)
})
test('selected weekdays carry Friday work to Monday, not weekend',()=>{
 const {data}=fixture({start:'2026-09-11',end:'2026-09-24',weekdays:[1,2,3,4,5],total:10});assert.equal(due(data,'2026-09-12').length,0);assert.equal(due(data,'2026-09-13').length,0);same(due(data,'2026-09-14').map(t=>t.unitNumber),[1,2]);assert.equal(due(data,'2026-09-26').length,10)
})
test('non-divisible / sparse / single day allocations keep whole units',()=>{
 const dates=s.studyDates('2026-09-09','2026-09-11',[0,1,2,3,4,5,6]);same(s.distributeUnits(5,dates).map(x=>x.count),[2,2,1]);same(s.distributeUnits(2,dates).map(x=>x.count),[1,1,0]);assert.equal(fixture({end:'2026-09-09'}).data.tasks.filter(t=>t.due==='2026-09-09').length,14)
})
test('reject malformed dates, ranges, counts and empty weekdays',()=>{
 for(const v of ['2026-02-30','not-a-date','2026-9-09'])assert.throws(()=>s.dateNumber(v));assert.throws(()=>s.studyDates('2026-09-10','2026-09-09',[1]));assert.throws(()=>s.studyDates('2026-09-12','2026-09-13',[1]));assert.throws(()=>s.studyDates('2026-09-09','2026-09-22',[]));assert.throws(()=>s.studyDates('2026-09-09','2036-09-22',[1]));for(const n of [0,-1,1.5,1001,Infinity,NaN])assert.throws(()=>s.distributeUnits(n,['2026-09-09']))
})
test('DST, month/year boundaries and fixed plan timezone',()=>{
 assert.equal(s.addDays('2026-12-31',1),'2027-01-01');assert.equal(s.addDays('2028-02-28',1),'2028-02-29');assert.equal(s.studyDates('2026-03-07','2026-03-10',[0,1,2,3,4,5,6]).length,4);assert.equal(s.studyDates('2026-10-31','2026-11-03',[0,1,2,3,4,5,6]).length,4)
 assert.equal(s.dateInZone('America/New_York',new Date('2026-09-10T03:59:59Z')),'2026-09-09');assert.equal(s.dateInZone('America/New_York',new Date('2026-09-10T04:00:00Z')),'2026-09-10');const {data}=fixture();assert.equal(s.calendarTasks(data.tasks,data.studyPlans,new Date('2026-09-10T03:59:59Z')).filter(t=>t.due==='2026-09-09').length,1)
})
test('Today classification follows the study timezone, not the device date',()=>{
 const {data}=fixture(),stamp=new Date('2026-09-10T02:00:00Z'),display=s.calendarTasks(data.tasks,data.studyPlans,stamp);assert.equal(s.taskToday(display[0],data.studyPlans,'2026-09-10',stamp),'2026-09-09');assert.equal(display[0].due,s.taskToday(display[0],data.studyPlans,'2026-09-10',stamp));assert.equal(s.taskToday({id:'ordinary'},data.studyPlans,'2026-09-10',stamp),'2026-09-10')
});
test('timezone-less imported completion dates are rejected',()=>{
 const {data}=fixture();data.tasks[0].done=true;data.tasks[0].completedAt='2026-09-09T00:30:00';assert.throws(()=>model.normalizeData(data));data.tasks[0].completedAt='2026-09-09T00:30:00-04:00';assert.equal(model.normalizeData(data).tasks[0].completedAt,'2026-09-09T04:30:00.000Z');data.schemaVersion=7;assert.throws(()=>model.normalizeData(data))
});
test('remaining-only reschedule keeps IDs and completed history/credits',()=>{
 let {data}=fixture();data=finish(data,0,'2026-09-09');const changed=s.rescheduleStudyPlan(data,'study-test','2026-09-24',now('2026-09-12'));assert.equal(changed.tasks[0].due,data.tasks[0].due);assert.equal(changed.tasks[0].completedAt,data.tasks[0].completedAt);same(changed.tasks.map(t=>t.id),data.tasks.map(t=>t.id));same(changed.sanctuaryProgress,data.sanctuaryProgress);assert.equal(changed.tasks[1].due,'2026-09-12');assert.equal(changed.tasks.at(-1).due,'2026-09-24');model.normalizeData(changed)
})
test('cancel removes unfinished tasks only and preserves completed work',()=>{
 let {data}=fixture();data=finish(data,0,'2026-09-10');const changed=model.normalizeData(s.cancelStudyPlan(data,'study-test'));assert.equal(changed.studyPlans.length,0);assert.equal(changed.tasks.length,1);assert.equal(changed.tasks[0].studyPlanId,undefined);assert.equal(changed.tasks[0].due,'2026-09-10');same(changed.sanctuaryProgress,data.sanctuaryProgress)
})
test('save/export/reload round trip retains plans, unit IDs and progress',()=>{
 let {data}=fixture();data=finish(data,0,'2026-09-09');const restored=model.normalizeData(JSON.parse(JSON.stringify(data)));same(restored,data);same(due(restored,'2026-09-12').map(t=>t.unitNumber),[2,3,4]);const old=model.createFreshData();delete old.studyPlans;same(model.normalizeData(old).studyPlans,[])
})
test('validation rejects foreign/missing/duplicate units and invalid time zones',()=>{
 for(const mutate of [d=>{d.tasks[0].studyPlanId='foreign'},d=>{d.tasks[0].unitNumber=2},d=>{d.tasks.pop()},d=>{d.studyPlans[0].timeZone='Invalid/Zone'},d=>{d.tasks[0].unitNumber=1001},d=>{d.tasks[0].done=true}]){const {data}=fixture();mutate(data);assert.throws(()=>model.normalizeData(data))}
})
test('two-device independent completions merge without losing progress',()=>{
 const {data:base}=fixture(),left=finish(base,0,'2026-09-10'),right=finish(base,1,'2026-09-10'),merged=mergeData(base,left,right);assert.equal(merged.conflicts.length,0);assert.equal(merged.data.tasks.filter(t=>t.done).length,2);assert.equal(merged.data.sanctuaryProgress[base.activeProfileId].creditedTaskIds.length,2);assert.equal(due(merged.data,'2026-09-10').length,0)
})
test('cancel versus concurrent completion conflicts instead of deleting work',()=>{
 const {data:base}=fixture(),left=s.cancelStudyPlan(base,'study-test'),right=finish(base,0,'2026-09-10');assert.ok(mergeData(base,left,right).conflicts.length)
})
test('rollover never earns credits, repeated completion does not double-credit',()=>{
 let {data}=fixture();const before=JSON.stringify(data.sanctuaryProgress);due(data,'2026-09-22');assert.equal(JSON.stringify(data.sanctuaryProgress),before);data=finish(data,0,'2026-09-10');data=finish(data,0,'2026-09-11');assert.equal(data.sanctuaryProgress[data.activeProfileId].creditedTaskIds.length,1)
})
test('question lists and TSV import produce bounded, literal flashcards',()=>{
 const f=load('src/store/flashcards.ts');const cards=f.parseFlashcards('Q one :: A one\r\nQ two\tA two',randomUUID);same(cards.map(c=>[c.question,c.answer]),[['Q one','A one'],['Q two','A two']]);assert.throws(()=>f.parseFlashcards('unstructured notes',randomUUID));assert.throws(()=>f.parseFlashcards('Q :: ',randomUUID));assert.throws(()=>f.parseFlashcards(Array(201).fill('Q :: A').join('\n'),randomUUID));cards[0].needsReview=false;same(f.reviewQueue({cards},true),[cards[1].id]);same(f.reviewQueue({cards}),[cards[1].id,cards[0].id])
});
test('decks survive export and two-device review merges with profile isolation',()=>{
 const f=load('src/store/flashcards.ts'),base=model.createFreshData();base.flashcardDecks=[{id:'deck',profileId:base.activeProfileId,title:'Test',cards:f.parseFlashcards('First :: Answer\nSecond :: Answer',randomUUID)}];same(model.normalizeData(JSON.parse(JSON.stringify(base))),base);const left=structuredClone(base),right=structuredClone(base);left.flashcardDecks[0].cards[0].needsReview=false;right.flashcardDecks[0].cards[1].needsReview=false;const merged=mergeData(base,left,right);assert.equal(merged.conflicts.length,0);assert.equal(merged.data.flashcardDecks[0].cards.filter(c=>c.needsReview).length,0);base.flashcardDecks[0].profileId='foreign';assert.throws(()=>model.normalizeData(base));
});
test('opposing reviews on two devices surface a conflict even when one repeats the old grade',()=>{
 const f=load('src/store/flashcards.ts'),base=model.createFreshData();base.flashcardDecks=[{id:'deck',profileId:base.activeProfileId,title:'Review',cards:f.parseFlashcards('Q :: A',randomUUID)}];const left=structuredClone(base),right=structuredClone(base);left.flashcardDecks[0].cards[0]={...left.flashcardDecks[0].cards[0],needsReview:false,reviewId:'review-left'};right.flashcardDecks[0].cards[0]={...right.flashcardDecks[0].cards[0],needsReview:true,reviewId:'review-right'};assert.ok(mergeData(base,left,right).conflicts.length)
});
test('study units remain ordered even when their IDs are random',()=>{
 const {data}=fixture();const tasks=due(data,'2026-09-11');tasks.reverse();tasks.sort(s.compareStudyTasks);same(tasks.map(t=>t.unitNumber),[1,2,3])
});
test('template steps keep supplied sequence and show safe React text',()=>{
 const {plan}=fixture({unit:'step',total:6});const tasks=s.buildStudyTasks(plan,()=>randomUUID(),s.studyTemplates.essay);assert.ok(tasks[0].title.endsWith(s.studyTemplates.essay[0]));assert.throws(()=>s.buildStudyTasks(plan,()=>randomUUID(),['one']));const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{StudyDaySessions}=load('src/components/StudyPlanner.tsx');const unsafe={...plan,title:'<script>alert(1)</script>'};const rows=s.buildStudyTasks(unsafe,()=>randomUUID(),s.studyTemplates.essay);const html=renderToStaticMarkup(React.createElement(StudyDaySessions,{plans:[unsafe],tasks:rows,originalTasks:rows,toggle(){}}));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('type="checkbox"'))
})
let failed=0;for(const[name,fn]of tests){try{fn();console.log('PASS',name)}catch(e){failed++;console.error('FAIL',name,e)}}if(failed)process.exitCode=1;else console.log(`${tests.length}/${tests.length} scheduler regression groups passed.`)
