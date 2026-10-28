// Two-way Canvas: the server side (canvasApi) against a fake Canvas, and the plan merge (canvasSync). No network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const resolveLocal=name=>{const bare=name.replace(/\.js$/,''),at=path.resolve(path.dirname(file),bare);return fs.existsSync(at+'.ts')?at+'.ts':at+'.tsx'}
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(resolveLocal(name)):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console,URL,Response,AbortSignal,TextEncoder,JSON})
 return module.exports
}
let passed=0
// Results come from another realm (vm), so compare as JSON.
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m)
const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
const {canvasBase,canvasItems,canvasMark}=load('src/store/canvasApi.ts'),{mergeCanvas,pendingPushes,linkedDone,localDue}=load('src/store/canvasSync.ts'),model=load('src/store/model.ts')
const TOKEN='1234~abcdefghijklmnopqrstuvwxyz0123456789'
const publicDns=async()=>['93.184.216.34'],privateDns=async()=>['10.0.0.8']
/** A fake Canvas: routes by method + path; records every call. */
function fakeCanvas(routes){
 const calls=[]
 const f=async(href,init={})=>{const u=new URL(href);calls.push({method:init.method??'GET',href,auth:init.headers?.authorization,body:init.body})
  const r=routes[(init.method??'GET')+' '+u.pathname+u.search]??routes[(init.method??'GET')+' '+u.pathname]
  if(!r)return new Response('{}',{status:404})
  return new Response(JSON.stringify(r.body??{}),{status:r.status??200,headers:r.headers??{}})}
 return {f,calls}
}
const row=(type,id,title,due,extra={})=>({plannable_type:type,plannable_id:id,plannable_date:due,context_name:'BIOL 1100',html_url:'/courses/1/assignments/'+id,plannable:{title,due_at:due},submissions:{submitted:false},...extra})

;(async()=>{
await test('the Canvas address: a bare school address or a pasted page becomes https://host; private and odd addresses are refused',()=>{
 assert.equal(canvasBase('myschool.instructure.com').href,'https://myschool.instructure.com/')
 assert.equal(canvasBase('http://canvas.school.edu/courses/12?x=1').href,'https://canvas.school.edu/')
 assert.throws(()=>canvasBase(''),/Canvas address/)
 assert.throws(()=>canvasBase('localhost'),/public/)
 assert.throws(()=>canvasBase('https://10.0.0.1'),/public/)
})

await test('the to-do list: pages are followed on the same host only, kinds KONO uses are kept, done comes from submitted or ticked',async()=>{
 const {f,calls}=fakeCanvas({
  'GET /api/v1/users/self':{body:{name:'Jo Student',short_name:'Jo'}},
  'GET /api/v1/planner/items?start_date=2026-10-01&end_date=2026-12-01&per_page=100':{body:[row('assignment',11,'Essay 1','2026-10-06T03:59:00Z'),row('quiz',12,'Cell quiz','2026-10-08T14:00:00Z',{submissions:{graded:true}}),row('calendar_event',13,'Field trip','2026-10-09T14:00:00Z'),row('planner_note',14,'my note','2026-10-09T14:00:00Z')],headers:{link:'<https://myschool.instructure.com/api/v1/planner/items?page=2>; rel="next"'}},
  'GET /api/v1/planner/items?page=2':{body:[row('discussion_topic',15,'Reply to Ana','2026-10-10T14:00:00Z',{planner_override:{marked_complete:true}})],headers:{link:'<https://evil.example.com/steal>; rel="next"'}},
 })
 const r=await canvasItems('myschool.instructure.com',TOKEN,'2026-10-01','2026-12-01',f,publicDns)
 assert.equal(r.name,'Jo')
 assert.deepEqual(r.items.map(i=>i.type+':'+i.id+':'+i.done).join(),'assignment:11:false,quiz:12:true,discussion_topic:15:true')
 assert.equal(r.items[0].url,'https://myschool.instructure.com/courses/1/assignments/11')
 assert.ok(calls.every(c=>c.href.startsWith('https://myschool.instructure.com/')),'the token only goes to the school’s Canvas')
 assert.ok(calls.every(c=>c.auth==='Bearer '+TOKEN))
})

await test('a Canvas name that resolves to a private network is never called, and bad tokens are refused before any call',async()=>{
 const {f,calls}=fakeCanvas({})
 await assert.rejects(canvasItems('rebind.example.com',TOKEN,'2026-10-01','2026-12-01',f,privateDns),/public web address/)
 await assert.rejects(canvasItems('myschool.instructure.com','short','2026-10-01','2026-12-01',f,publicDns),/access token/)
 assert.equal(calls.length,0)
})

await test('Canvas errors read plainly: an expired token, a school that turned tokens off, a redirect away',async()=>{
 await assert.rejects(canvasItems('a.instructure.com',TOKEN,'2026-10-01','2026-12-01',fakeCanvas({'GET /api/v1/users/self':{status:401}}).f,publicDns),/didn’t accept this token/)
 await assert.rejects(canvasItems('a.instructure.com',TOKEN,'2026-10-01','2026-12-01',fakeCanvas({'GET /api/v1/users/self':{status:403}}).f,publicDns),/calendar link/)
 await assert.rejects(canvasItems('a.instructure.com',TOKEN,'2026-10-01','2026-12-01',fakeCanvas({'GET /api/v1/users/self':{status:302,headers:{location:'https://login.example.com'}}}).f,publicDns),/isn’t your school’s Canvas/)
})

await test('ticking in Canvas: a new override is created; if one exists it is found and changed',async()=>{
 const first=fakeCanvas({'POST /api/v1/planner/overrides':{status:200}})
 await canvasMark('a.instructure.com',TOKEN,'assignment','11',true,first.f,publicDns)
 assert.deepEqual(JSON.parse(first.calls[0].body),{plannable_type:'assignment',plannable_id:11,marked_complete:true})
 const again=fakeCanvas({'POST /api/v1/planner/overrides':{status:400},'GET /api/v1/planner/overrides?per_page=100':{body:[{id:7,plannable_type:'assignment',plannable_id:99},{id:8,plannable_type:'assignment',plannable_id:11}]},'PUT /api/v1/planner/overrides/8':{status:200}})
 await canvasMark('a.instructure.com',TOKEN,'assignment','11',false,again.f,publicDns)
 assert.equal(again.calls.at(-1).method,'PUT');assert.deepEqual(JSON.parse(again.calls.at(-1).body),{marked_complete:false})
 await assert.rejects(canvasMark('a.instructure.com',TOKEN,'calendar_event','11',true,first.f,publicDns),/isn’t a Canvas item/)
})

await test('merging into the plan: new items come in under their course, quizzes as exams, calendar-link imports get linked, dates move, done comes back',()=>{
 const data=model.createFreshData(),pid=data.activeProfileId
 const essayDue=localDue('2026-10-06T03:59:00Z').date
 data.tasks.push({id:'task-from-feed',profileId:pid,subjectId:'',title:'Essay 1',due:essayDue,done:false,notes:'',source:'canvas'})
 const items=[{type:'assignment',id:'11',title:'Essay 1',at:'2026-10-06T03:59:00Z',done:false,course:'BIOL 1100'},{type:'quiz',id:'12',title:'Cell quiz',at:'2026-10-08T14:00:00Z',done:true,course:'BIOL 1100'},{type:'discussion_topic',id:'15',title:'Reply to Ana',at:'2026-10-10T14:00:00Z',done:false}]
 const r=mergeCanvas(data,pid,items)
 assert.equal(r.added,2);assert.equal(r.linked,1)
 const essay=r.data.tasks.find(t=>t.id==='task-from-feed');assert.equal(essay.canvasRef,'assignment:11','the calendar-link copy is linked, not doubled')
 assert.equal(r.data.tasks.filter(t=>t.title==='Essay 1').length,1)
 const quiz=r.data.exams.find(e=>e.canvasRef==='quiz:12');assert.ok(quiz&&quiz.done&&quiz.source==='canvas')
 assert.equal(r.data.subjects.filter(s=>s.name==='BIOL 1100').length,1,'one subject for the course')
 // Canvas moves the essay and marks it submitted.
 const moved=mergeCanvas(r.data,pid,[{...items[0],at:'2026-10-13T03:59:00Z',done:true}])
 const after=moved.data.tasks.find(t=>t.id==='task-from-feed')
 assert.equal(moved.moved,1);assert.equal(moved.done,1);assert.equal(after.due,localDue('2026-10-13T03:59:00Z').date);assert.ok(after.done&&after.completedAt)
 // Not done in Canvas never unticks KONO.
 const kept=mergeCanvas(moved.data,pid,[{...items[0],at:'2026-10-13T03:59:00Z',done:false}])
 assert.equal(kept.data.tasks.find(t=>t.id==='task-from-feed').done,true)
 assert.equal(model.normalizeData(kept.data).tasks.find(t=>t.id==='task-from-feed').canvasRef,'assignment:11','the link survives saving')
})

await test('what goes back to Canvas: only linked items whose tick differs from what Canvas last had',()=>{
 const data=model.createFreshData(),pid=data.activeProfileId
 data.tasks.push({id:'a',profileId:pid,subjectId:'',title:'A',due:'2026-10-01',done:true,notes:'',canvasRef:'assignment:1'},{id:'b',profileId:pid,subjectId:'',title:'B',due:'2026-10-01',done:false,notes:'',canvasRef:'assignment:2'},{id:'c',profileId:pid,subjectId:'',title:'C',due:'2026-10-01',done:true,notes:''})
 same(linkedDone(data,pid),{'assignment:1':true,'assignment:2':false})
 same(pendingPushes(data,pid,{'assignment:1':false,'assignment:2':false}),[['assignment:1',true]])
 same(pendingPushes(data,pid,{}),[],'nothing Canvas hasn’t listed yet')
 assert.equal(model.normalizeData({...data,tasks:[{...data.tasks[0],canvasRef:'calendar_event:1'}]}).tasks[0].canvasRef,undefined,'only kinds KONO syncs are kept')
})

console.log(passed+'/7 Canvas groups passed.')
})().catch(error=>{console.error('FAIL',error);process.exit(1)})
