// Mirrors tools/test_kquiz.cjs's loader: real TS transpile + a fresh VM per module, recursive
// relative-import resolution, real npm packages for anything non-relative.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto')
const root=path.resolve(__dirname,'..'),deps=path.join(root,'node_modules')
const ts=require(path.join(deps,'typescript'))
const modules=new Map()
function load(rel){
 if(modules.has(rel))return modules.get(rel)
 const file=path.join(root,rel),source=fs.readFileSync(file,'utf8')
 const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,mod={exports:{}}
 const requireIn=name=>name==='react'?{}:!name.startsWith('.')?require(path.join(deps,name)):load(path.normalize(path.join(path.dirname(rel),name+'.ts')))
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:requireIn,crypto:{randomUUID},console,Date,Math,Set,Map,Object,Promise,structuredClone})
 modules.set(rel,mod.exports);return mod.exports
}
const model=load('src/store/model.ts')
const photo=load('src/store/assignmentPhoto.ts')

const tests=[]
function test(name,fn){tests.push({name,fn})}
const make=()=>model.createFreshData()

test('the prompt tells the AI today\'s date so it can resolve relative day words itself',()=>{
 const prompt=photo.__test__.buildAssignmentPhotoPrompt('2026-09-18')
 assert.ok(prompt.includes('2026-09-18'))
 assert.ok(prompt.includes('"items"'))
 assert.ok(prompt.includes('"subject"'))
})

test('the prompt covers a full course syllabus, not just a quick note, and prefers a syllabus\'s own literal dates',()=>{
 const prompt=photo.__test__.buildAssignmentPhotoPrompt('2026-09-18')
 assert.ok(prompt.toLowerCase().includes('syllabus'))
 assert.ok(prompt.includes('ENTIRE document'))
 assert.ok(prompt.toLowerCase().includes('literal date'))
})

test('a dense syllabus page can list far more items than the old 60-item cap allowed',()=>{
 const items=Array.from({length:100},(_,i)=>({title:'Reading '+i,date:'2026-09-'+String(20+(i%9)).padStart(2,'0'),kind:'task',subject:''}))
 const parsed=photo.__test__.parseAssignmentPhoto(JSON.stringify({items}))
 assert.equal(parsed.length,100)
})

test('parsing accepts a well-formed response and rejects an empty or malformed one',()=>{
 const good=JSON.stringify({items:[
  {title:'Math worksheet pg 12',date:'2026-09-22',kind:'task',subject:'Math'},
  {title:'History exam',date:null,kind:'exam',subject:'History'},
  {title:'Soccer practice',date:'2026-09-20',kind:'event',subject:''},
 ]})
 const parsed=photo.__test__.parseAssignmentPhoto(good)
 assert.equal(parsed.length,3)
 assert.equal(parsed[0].date,'2026-09-22');assert.equal(parsed[0].kind,'task');assert.equal(parsed[0].subject,'Math')
 assert.equal(parsed[1].date,null);assert.equal(parsed[1].kind,'exam')
 assert.equal(parsed[2].subject,'')
 assert.throws(()=>photo.__test__.parseAssignmentPhoto('not json'))
 assert.throws(()=>photo.__test__.parseAssignmentPhoto(JSON.stringify({})))
 assert.throws(()=>photo.__test__.parseAssignmentPhoto(JSON.stringify({items:[]})))
})

test('an item with no title, an invalid date, or an unrecognized kind is dropped or defaulted rather than failing the batch',()=>{
 const mixed=JSON.stringify({items:[
  {title:'Good item',date:'2026-09-22',kind:'task',subject:''},
  {title:'',date:'2026-09-22',kind:'task',subject:''},
  {title:'Bad date',date:'not-a-date',kind:'task',subject:''},
  {title:'Unknown kind',date:null,kind:'birthday',subject:''},
  null,
  'not an object',
 ]})
 const parsed=photo.__test__.parseAssignmentPhoto(mixed)
 assert.equal(parsed.length,3)
 assert.equal(parsed.find(p=>p.title==='Good item').date,'2026-09-22')
 assert.equal(parsed.find(p=>p.title==='Bad date').date,null)
 assert.equal(parsed.find(p=>p.title==='Unknown kind').kind,'event')
})

test('applying items creates real tasks/exams/calendarEvents, each flagged needsReview, matching subjects by name',()=>{
 const d=make(),pid=d.activeProfileId
 d.subjects=[{id:'subj1',profileId:pid,name:'Biology',color:'#000',resources:[]}]
 const items=[
  {title:'Lab report',date:'2026-09-22',kind:'task',subject:'Biology'},
  {title:'Unit test',date:'2026-09-25',kind:'exam',subject:'Chemistry'},
  {title:'Field trip',date:'2026-09-30',kind:'event',subject:''},
 ]
 const result=photo.applyAssignmentPhoto(d,pid,items,'2026-09-18')
 assert.equal(result.created.length,3)
 assert.equal(result.created.map(c=>c.key).sort().join(','),'calendarEvents,exams,tasks')
 assert.equal(result.data.tasks.length,1);assert.equal(result.data.tasks[0].needsReview,true);assert.equal(result.data.tasks[0].subjectId,'subj1')
 assert.equal(result.data.exams.length,1);assert.equal(result.data.exams[0].needsReview,true)
 const chem=result.data.subjects.find(s=>s.name==='Chemistry')
 assert.ok(chem,'a new subject is created for an unrecognized class name')
 assert.equal(result.data.exams[0].subjectId,chem.id)
 assert.equal(result.data.calendarEvents.length,1);assert.equal(result.data.calendarEvents[0].needsReview,true);assert.equal(result.data.calendarEvents[0].subjectId,'')
 // each created-item receipt carries the resolved subjectId, so the scan-results UI can show/edit it
 // without looking the entry back up in the full plan.
 assert.equal(result.created.find(c=>c.key==='tasks').subjectId,'subj1')
 assert.equal(result.created.find(c=>c.key==='exams').subjectId,chem.id)
 assert.equal(result.created.find(c=>c.key==='calendarEvents').subjectId,'')
})

test('an item with no date lands on today rather than being dropped, still flagged for review',()=>{
 const d=make(),pid=d.activeProfileId
 const result=photo.applyAssignmentPhoto(d,pid,[{title:'Mystery due date',date:null,kind:'task',subject:''}],'2026-09-18')
 assert.equal(result.data.tasks[0].due,'2026-09-18')
 assert.equal(result.data.tasks[0].needsReview,true)
})

test('a subject name matches an existing one case-insensitively instead of creating a duplicate',()=>{
 const d=make(),pid=d.activeProfileId
 d.subjects=[{id:'subj1',profileId:pid,name:'Biology',color:'#000',resources:[]}]
 const result=photo.applyAssignmentPhoto(d,pid,[{title:'HW',date:'2026-09-22',kind:'task',subject:'biology'}],'2026-09-18')
 assert.equal(result.data.subjects.length,1)
 assert.equal(result.data.tasks[0].subjectId,'subj1')
})

test('applying to a profile other than the active one is refused',()=>{
 const d=make()
 assert.throws(()=>photo.applyAssignmentPhoto(d,'someone-else',[{title:'X',date:null,kind:'task',subject:''}],'2026-09-18'),/profile changed/)
})

test('the prompt asks for a per-item kidName and an eventKind, so a family calendar screenshot\'s per-person color-coded items come through tagged',()=>{
 const prompt=photo.__test__.buildAssignmentPhotoPrompt('2026-09-18')
 assert.ok(prompt.includes('"kidName"'))
 assert.ok(prompt.includes('"eventKind"'))
 assert.ok(prompt.toLowerCase().includes('family'))
})

test('parsing accepts eventKind and kidName, and defaults eventKind to "other" when missing or invalid',()=>{
 const parsed=photo.__test__.parseAssignmentPhoto(JSON.stringify({items:[
  {title:'Hockey practice',date:'2026-09-24',kind:'event',eventKind:'sports',subject:'',kidName:'Knox'},
  {title:'Family bike ride',date:'2026-09-26',kind:'event',subject:'',kidName:''},
  {title:'Birthday party',date:'2026-09-27',kind:'event',eventKind:'not-a-kind',subject:'',kidName:'Ivy'},
 ]}))
 assert.equal(parsed[0].eventKind,'sports');assert.equal(parsed[0].kidName,'Knox')
 assert.equal(parsed[1].eventKind,'other');assert.equal(parsed[1].kidName,'')
 assert.equal(parsed[2].eventKind,'other');assert.equal(parsed[2].kidName,'Ivy')
})

// Modeled directly on the real family-calendar screenshots shared alongside this feature request:
// several kids (Blair, Knox, Justin, Nikki, Ivy, Parker), each with their own color-coded events --
// hockey, soccer, dance, tennis -- scanned from a shared calendar app's agenda view.
test('applying a scanned family calendar creates one kid per name, each with its own color, and tags every item to the right one',()=>{
 const d=make(),pid=d.activeProfileId
 const items=[
  {title:'Dance',date:'2026-09-24',kind:'event',eventKind:'personal',subject:'',kidName:'Blair'},
  {title:'Hockey',date:'2026-09-24',kind:'event',eventKind:'sports',subject:'',kidName:'Knox'},
  {title:'Soccer',date:'2026-09-23',kind:'event',eventKind:'sports',subject:'',kidName:'Ivy'},
  {title:'Soccer',date:'2026-09-23',kind:'event',eventKind:'sports',subject:'',kidName:'Parker'},
  {title:'Tennis lesson',date:'2026-09-25',kind:'event',eventKind:'sports',subject:'',kidName:'Nikki'},
  {title:'Hockey',date:'2026-09-27',kind:'event',eventKind:'sports',subject:'',kidName:'Justin'},
 ]
 const result=photo.applyAssignmentPhoto(d,pid,items,'2026-09-18')
 const kidNames=result.data.kids.map(k=>k.name).sort()
 assert.deepEqual(kidNames,['Blair','Ivy','Justin','Knox','Nikki','Parker'])
 const colors=new Set(result.data.kids.map(k=>k.color))
 assert.equal(colors.size,6,'expected every kid to get a distinct color')
 for(const event of result.data.calendarEvents){
  const kid=result.data.kids.find(k=>k.id===event.kidId)
  assert.ok(kid,'every scanned item should resolve to a real kid')
  if(event.title==='Dance')assert.equal(kid.name,'Blair')
  if(event.title==='Tennis lesson')assert.equal(kid.name,'Nikki')
 }
 // the receipt (what the scan-results UI shows/edits) carries kidId too, without a lookup
 assert.equal(result.created.every(c=>c.kidId),true)
})

test('a scanned event\'s kind (e.g. sports) is preserved on the created calendarEvent instead of always becoming "other"',()=>{
 const d=make(),pid=d.activeProfileId
 const result=photo.applyAssignmentPhoto(d,pid,[{title:'Soccer game',date:'2026-09-23',kind:'event',eventKind:'sports',subject:'',kidName:'Ivy'}],'2026-09-18')
 assert.equal(result.data.calendarEvents[0].kind,'sports')
})

test('a kid name matches an existing kid case-insensitively instead of creating a duplicate',()=>{
 const d=make(),pid=d.activeProfileId
 d.kids=[{id:'kid1',profileId:pid,name:'Knox',color:'#7f9fc9'}]
 const result=photo.applyAssignmentPhoto(d,pid,[{title:'Hockey',date:'2026-09-24',kind:'event',eventKind:'sports',subject:'',kidName:'knox'}],'2026-09-18')
 assert.equal(result.data.kids.length,1)
 assert.equal(result.data.calendarEvents[0].kidId,'kid1')
})

test('an item with no kidName is left unassigned rather than getting tagged to an arbitrary kid',()=>{
 const d=make(),pid=d.activeProfileId
 d.kids=[{id:'kid1',profileId:pid,name:'Knox',color:'#7f9fc9'}]
 const result=photo.applyAssignmentPhoto(d,pid,[{title:'Family dinner',date:'2026-09-24',kind:'event',eventKind:'personal',subject:'',kidName:''}],'2026-09-18')
 assert.equal(result.data.calendarEvents[0].kidId,undefined)
 assert.equal(result.data.kids.length,1,'no new kid should be created for an unassigned item')
})

test('the prompt asks for a 24-hour start time and end time, pulling both ends of a written range',()=>{
 const prompt=photo.__test__.buildAssignmentPhotoPrompt('2026-09-18')
 assert.ok(prompt.includes('"time"'))
 assert.ok(prompt.includes('"endTime"'))
 assert.ok(prompt.toLowerCase().includes('24-hour'))
 assert.ok(prompt.toLowerCase().includes("range's start"))
})

test('normalizeClockTime accepts 24-hour and common 12-hour forms, straight off the real screenshots (5:30p, 8:30p, 10:30a)',()=>{
 assert.equal(photo.__test__.normalizeClockTime('17:30'),'17:30')
 assert.equal(photo.__test__.normalizeClockTime('5:30p'),'17:30')
 assert.equal(photo.__test__.normalizeClockTime('5:30pm'),'17:30')
 assert.equal(photo.__test__.normalizeClockTime('5:30 PM'),'17:30')
 assert.equal(photo.__test__.normalizeClockTime('8:30p'),'20:30')
 assert.equal(photo.__test__.normalizeClockTime('10:30a'),'10:30')
 assert.equal(photo.__test__.normalizeClockTime('9a'),'09:00')
 assert.equal(photo.__test__.normalizeClockTime('12:00a'),'00:00')
 assert.equal(photo.__test__.normalizeClockTime('12:00p'),'12:00')
 assert.equal(photo.__test__.normalizeClockTime(null),undefined)
 assert.equal(photo.__test__.normalizeClockTime(''),undefined)
 assert.equal(photo.__test__.normalizeClockTime('sometime this afternoon'),undefined)
})

test('parsing normalizes a well-formed time and drops a malformed one to null rather than failing the item',()=>{
 const parsed=photo.__test__.parseAssignmentPhoto(JSON.stringify({items:[
  {title:'Dance',date:'2026-09-24',time:'17:30',kind:'event',eventKind:'personal',subject:'',kidName:'Blair'},
  {title:'Bike ride',date:'2026-09-26',time:null,kind:'event',eventKind:'personal',subject:'',kidName:''},
  {title:'Something',date:'2026-09-27',time:'not a time',kind:'event',eventKind:'other',subject:'',kidName:''},
 ]}))
 assert.equal(parsed[0].time,'17:30')
 assert.equal(parsed[1].time,null)
 assert.equal(parsed[2].time,null)
})

// The real screenshots write every item as a range (e.g. "5:30p 530-630pm", "8:30p 830pm") -- the AI is
// asked for the start time only, which is what applyAssignmentPhoto should carry onto the event.
test('applying a scanned item with a time sets it on the created calendarEvent and its receipt',()=>{
 const d=make(),pid=d.activeProfileId
 const result=photo.applyAssignmentPhoto(d,pid,[{title:'Dance',date:'2026-09-24',time:'17:30',kind:'event',eventKind:'personal',subject:'',kidName:'Blair'}],'2026-09-18')
 assert.equal(result.data.calendarEvents[0].time,'17:30')
 assert.equal(result.created[0].time,'17:30')
})

test('an item with no time leaves the created calendarEvent\'s time undefined rather than a placeholder',()=>{
 const d=make(),pid=d.activeProfileId
 const result=photo.applyAssignmentPhoto(d,pid,[{title:'All-day thing',date:'2026-09-24',time:null,kind:'event',eventKind:'other',subject:'',kidName:''}],'2026-09-18')
 assert.equal(result.data.calendarEvents[0].time,undefined)
})

test('a time on a task or exam is simply not applied -- neither model has a time field',()=>{
 const d=make(),pid=d.activeProfileId
 const result=photo.applyAssignmentPhoto(d,pid,[
  {title:'Worksheet',date:'2026-09-24',time:'09:00',kind:'task',eventKind:'other',subject:'',kidName:''},
  {title:'Quiz',date:'2026-09-25',time:'10:00',kind:'exam',eventKind:'other',subject:'',kidName:''},
 ],'2026-09-18')
 assert.equal(result.data.tasks[0].time,undefined)
 assert.equal(result.data.exams[0].time,undefined)
})

// The real screenshots write every item as a range (e.g. "5:30-6:30p") -- endTime is the range's other
// end, kept alongside the already-captured start time rather than discarded.
test('parsing normalizes a well-formed end time alongside a start time',()=>{
 const parsed=photo.__test__.parseAssignmentPhoto(JSON.stringify({items:[
  {title:'Hockey practice',date:'2026-09-24',time:'17:30',endTime:'18:30',kind:'event',eventKind:'sports',subject:'',kidName:'Knox'},
  {title:'Something',date:'2026-09-27',time:'20:30',endTime:'not a time',kind:'event',eventKind:'other',subject:'',kidName:''},
 ]}))
 assert.equal(parsed[0].endTime,'18:30')
 assert.equal(parsed[1].endTime,null)
})

test('an end time with no start time is dropped rather than implying a start-less block',()=>{
 const parsed=photo.__test__.parseAssignmentPhoto(JSON.stringify({items:[
  {title:'Odd item',date:'2026-09-24',time:null,endTime:'18:30',kind:'event',eventKind:'other',subject:'',kidName:''},
 ]}))
 assert.equal(parsed[0].time,null)
 assert.equal(parsed[0].endTime,null)
})

test('applying a scanned item with a start and end time sets both on the created calendarEvent and its receipt',()=>{
 const d=make(),pid=d.activeProfileId
 const result=photo.applyAssignmentPhoto(d,pid,[{title:'Hockey practice',date:'2026-09-24',time:'17:30',endTime:'18:30',kind:'event',eventKind:'sports',subject:'',kidName:'Knox'}],'2026-09-18')
 assert.equal(result.data.calendarEvents[0].time,'17:30')
 assert.equal(result.data.calendarEvents[0].endTime,'18:30')
 assert.equal(result.created[0].time,'17:30')
 assert.equal(result.created[0].endTime,'18:30')
})

test('an item with only a start time leaves the created calendarEvent\'s endTime undefined',()=>{
 const d=make(),pid=d.activeProfileId
 const result=photo.applyAssignmentPhoto(d,pid,[{title:'Dance',date:'2026-09-24',time:'17:30',endTime:null,kind:'event',eventKind:'personal',subject:'',kidName:'Blair'}],'2026-09-18')
 assert.equal(result.data.calendarEvents[0].endTime,undefined)
})

test('an end time on a task or exam is simply not applied -- neither model has an endTime field',()=>{
 const d=make(),pid=d.activeProfileId
 const result=photo.applyAssignmentPhoto(d,pid,[
  {title:'Worksheet',date:'2026-09-24',time:'09:00',endTime:'10:00',kind:'task',eventKind:'other',subject:'',kidName:''},
  {title:'Quiz',date:'2026-09-25',time:'10:00',endTime:'11:00',kind:'exam',eventKind:'other',subject:'',kidName:''},
 ],'2026-09-18')
 assert.equal(result.data.tasks[0].endTime,undefined)
 assert.equal(result.data.exams[0].endTime,undefined)
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} assignment-photo regression groups passed.`)
