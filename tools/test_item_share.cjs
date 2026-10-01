// Sharing one assignment or exam with a classmate (src/store/itemShare.ts): what is sent, what is accepted, how it is added.
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
const model=load('src/store/model.ts'),share=load('src/store/itemShare.ts')
function plan(){
 const d=model.createFreshData(),id=d.activeProfileId
 d.subjects.push({id:'chem',profileId:id,name:'Chemistry',color:'#4169a8',resources:[]})
 d.tasks.push({id:'lab',profileId:id,subjectId:'chem',kidId:'kid-1',title:'Lab report  ',due:'2026-10-02',done:false,notes:'Pages 40–52',estimatedMinutes:90,plannedTime:'19:00',subtasks:[{id:'s',title:'Private step',done:false}]})
 return d
}

test('only the title, due date, subject name, details and estimate are sent (never steps, kid, planned time or ids)',()=>{
 const d=plan(),item=share.sharePayload(d,d.tasks[0])
 assert.equal(JSON.stringify(item),JSON.stringify({title:'Lab report',due:'2026-10-02',subject:'Chemistry',notes:'Pages 40–52',estimatedMinutes:90}))
 assert.equal(share.shareKindFor('tasks'),'task');assert.equal(share.shareKindFor('exams'),'exam');assert.equal(share.shareKindFor('notes'),null)
 const long=share.sharePayload(d,{...d.tasks[0],title:'x'.repeat(500),notes:'y'.repeat(5000),estimatedMinutes:9999})
 assert.equal(long.title.length,200);assert.equal(long.notes.length,1500);assert.equal(long.estimatedMinutes,undefined)
})

test('a received item is checked: no title, a bad date or a non-object is dropped; extra fields are ignored',()=>{
 assert.equal(share.readSharedItem(null),null);assert.equal(share.readSharedItem('Lab'),null);assert.equal(share.readSharedItem([]),null)
 assert.equal(share.readSharedItem({title:'  ',due:'2026-10-02'}),null)
 assert.equal(share.readSharedItem({title:'Lab',due:'next week'}),null)
 assert.equal(share.readSharedItem({title:'Lab',due:'2026-13-45'}),null)
 const item=share.readSharedItem({title:'Lab',due:'2026-10-02',subject:7,notes:null,estimatedMinutes:-5,subjectId:'theirs',kidId:'k',done:true})
 assert.equal(JSON.stringify(item),JSON.stringify({title:'Lab',due:'2026-10-02',subject:'7',notes:''}))
})

test('adding puts it in the active plan under the subject with the same name, says who shared it, and never adds it twice',()=>{
 const d=model.createFreshData(),id=d.activeProfileId
 d.subjects.push({id:'mine',profileId:id,name:'chemistry',color:'#000',resources:[]},{id:'other',profileId:'someone-else',name:'Chemistry',color:'#000',resources:[]})
 const item={title:'Lab report',due:'2026-10-02',subject:'Chemistry',notes:'Pages 40–52',estimatedMinutes:90}
 const next=share.addSharedItem(d,'task',item,'Maya')
 const task=next.tasks.at(-1)
 assert.equal(task.profileId,id);assert.equal(task.subjectId,'mine');assert.equal(task.done,false);assert.equal(task.estimatedMinutes,90)
 assert.equal(task.notes,'Shared by Maya.\nPages 40–52')
 assert.equal(share.alreadyInPlan(next,'task',{...item,title:'LAB REPORT'}),true)
 assert.equal(share.addSharedItem(next,'task',item,'Maya'),next,'the same title on the same day is not added again')
 const exam=share.addSharedItem(d,'exam',{title:'Unit test',due:'2026-10-05',subject:'Physics',notes:''},'')
 assert.equal(exam.exams.at(-1).subjectId,'','no matching subject: unassigned');assert.equal(exam.exams.at(-1).notes,'')
 assert.equal(exam.tasks.length,d.tasks.length)
})

test('links and photo ids on assignments and exams are kept when the plan is saved and loaded; anything else is dropped',()=>{
 const d=plan(),id=d.activeProfileId
 d.tasks[0].link='https://docs.google.com/document/d/abc';d.tasks[0].photos=['photo-1234abcd','not-a-photo','photo-5678efgh']
 d.exams.push({id:'ex',profileId:id,subjectId:'chem',title:'Unit test',due:'2026-10-05',done:false,notes:'',link:'javascript:alert(1)',photos:['photo-aaaa1111']})
 const back=model.normalizeData(JSON.parse(JSON.stringify(d)))
 assert.equal(back.tasks[0].link,'https://docs.google.com/document/d/abc')
 assert.equal(back.tasks[0].photos.join(),'photo-1234abcd,photo-5678efgh')
 const exam=back.exams.find(e=>e.id==='ex')
 assert.equal(exam.link,undefined,'only http(s) links');assert.equal(exam.photos.join(),'photo-aaaa1111')
 assert.equal(JSON.stringify(share.sharePayload(back,back.tasks[0])).includes('photo-'),false,'photos and links are never shared with classmates')
})
console.log(`${passed}/4 item-sharing groups passed.`)
