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

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} assignment-photo regression groups passed.`)
