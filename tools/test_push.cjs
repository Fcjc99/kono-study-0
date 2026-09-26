// Actual application functions with isolated fixtures; no browser or user-data writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console})
 return module.exports
}
// Lock-screen reminders: what the app queues for the week, and how the server sends due ones.
const model=load('src/store/model.ts'),{buildReminders}=load('src/store/pushReminders.ts'),{sendDueReminders,sameSecret}=load('src/store/pushSender.ts')
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
console.log('PASS reminder planner: morning summary, exam eve, classes 15 min before, study blocks, skipped/breaks/past left out')

;(async()=>{
 const sent=[],forgotten=[]
 const due=[{endpoint:'https://push/a',p256dh:'k',auth:'a',title:'Due today: Essay',body:'ENGL',tag:'due'},{endpoint:'https://push/gone',p256dh:'k',auth:'a',title:'One',body:'',tag:null},{endpoint:'https://push/gone',p256dh:'k',auth:'a',title:'Two',body:'',tag:null},{endpoint:'https://push/flaky',p256dh:'k',auth:'a',title:'Three',body:'',tag:null}]
 const result=await sendDueReminders({claim:async()=>due,forget:async e=>{forgotten.push(e)},send:async(sub,payload)=>{if(sub.endpoint.endsWith('gone'))throw Object.assign(Error('gone'),{statusCode:410});if(sub.endpoint.endsWith('flaky'))throw Object.assign(Error('busy'),{statusCode:503});sent.push([sub.endpoint,JSON.parse(payload)])}})
 assert.equal(result.sent,1);assert.equal(result.failed,1);assert.equal(result.forgotten,1)
 assert.equal(sent[0][1].title,'Due today: Essay');assert.equal(forgotten.join(),'https://push/gone','a gone device is forgotten once, and not retried')
 assert.equal(sameSecret('abc123','abc123'),true);assert.equal(sameSecret('abc123','abc124'),false);assert.equal(sameSecret('',''),false);assert.equal(sameSecret('abc','abcd'),false)
 console.log('PASS reminder sender: sends each, forgets gone devices, keeps going after errors; secrets compared safely')
})().catch(e=>{console.error(e);process.exit(1)})
