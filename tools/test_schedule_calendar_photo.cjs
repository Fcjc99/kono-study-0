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
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:requireIn,crypto:{randomUUID},console,Date,Math,Set,Map,Object,Promise})
 modules.set(rel,mod.exports);return mod.exports
}
const photo=load('src/store/scheduleCalendarPhoto.ts')

const tests=[]
function test(name,fn){tests.push({name,fn})}

test('the prompt asks for day-of-week-anchored items, not calendar dates the AI would have to guess',()=>{
 const prompt=photo.__test__.buildPlannerPhotoPrompt()
 assert.ok(prompt.includes('Monday'))
 assert.ok(prompt.includes('"weekday"'))
 assert.ok(prompt.includes('"items"'))
})

test('parsing accepts a well-formed response and rejects an empty or malformed one',()=>{
 const good=JSON.stringify({items:[
  {weekday:'Monday',title:'Math HW pg 12',time:null,kind:'task'},
  {weekday:'Wednesday',title:'Chem lab report due',time:'3pm',kind:'task'},
  {weekday:'Friday',title:'History exam',time:null,kind:'exam'},
  {weekday:'Saturday',title:'Dentist appointment',time:'10am',kind:'event'},
 ]})
 const parsed=photo.__test__.parsePlannerPhoto(good)
 assert.equal(parsed.length,4)
 assert.equal(parsed[0].weekday,'Monday');assert.equal(parsed[0].kind,'task');assert.equal(parsed[0].time,null)
 assert.equal(parsed[1].time,'3pm')
 assert.equal(parsed[2].kind,'exam')
 assert.throws(()=>photo.__test__.parsePlannerPhoto('not json'))
 assert.throws(()=>photo.__test__.parsePlannerPhoto(JSON.stringify({})))
 assert.throws(()=>photo.__test__.parsePlannerPhoto(JSON.stringify({items:[]})))
})

test('an item with no title, an unrecognized weekday, or missing altogether is dropped rather than failing the whole batch',()=>{
 const mixed=JSON.stringify({items:[
  {weekday:'Monday',title:'Good item',time:null,kind:'task'},
  {weekday:'Someday',title:'Bad weekday',time:null,kind:'task'},
  {weekday:'Tuesday',title:'',time:null,kind:'task'},
  {weekday:'Tuesday',kind:'task'},
  null,
  'not an object',
 ]})
 const parsed=photo.__test__.parsePlannerPhoto(mixed)
 assert.equal(parsed.length,1)
 assert.equal(parsed[0].title,'Good item')
})

test('an unrecognized kind defaults to "event" rather than being dropped',()=>{
 const parsed=photo.__test__.parsePlannerPhoto(JSON.stringify({items:[{weekday:'Monday',title:'Something',time:null,kind:'birthday'}]}))
 assert.equal(parsed[0].kind,'event')
})

test('items map onto real calendar dates anchored to the given Monday, in weekday order regardless of input order',()=>{
 const items=[
  {weekday:'Friday',title:'History exam',time:null,kind:'exam'},
  {weekday:'Monday',title:'Math HW',time:null,kind:'task'},
  {weekday:'Sunday',title:'Family dinner',time:'6pm',kind:'event'},
 ]
 const rows=photo.plannerPhotoToImportRows(items,'2026-09-14')
 const byTitle=Object.fromEntries(rows.map(r=>[r.title,r]))
 assert.equal(byTitle['Math HW'].date,'2026-09-14')
 assert.equal(byTitle['History exam'].date,'2026-09-18')
 assert.equal(byTitle['Family dinner'].date,'2026-09-20')
 assert.equal(byTitle['History exam'].kind,'exam')
 assert.equal(byTitle['Family dinner'].kind,'event')
 assert.ok(byTitle['Family dinner'].source.includes('Sunday'))
 assert.ok(byTitle['Family dinner'].source.includes('6pm'))
 // Rows always start unselected/unfiled and untimed -- a human must review before anything commits,
 // same safety gate the PDF importer's suggestions go through.
 assert.ok(rows.every(r=>r.include===false&&r.subject===''&&r.weekdays.length===0&&r.start===''&&r.end===''))
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} planner-photo-import regression groups passed.`)
