// Mirrors tools/test_ics_export.cjs's loader: real TS transpile + a fresh VM per module, recursive
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
const {findOpenSlots}=load('src/store/timeBlocking.ts')

const tests=[]
function test(name,fn){tests.push({name,fn})}
// Return values cross a vm.runInNewContext realm boundary, so plain-object identity checks need a
// JSON round trip first (mirrors tools/test_study_scheduler.cjs's own `same` helper).
const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)))

const PROFILE='profile-1'
// 2026-09-21 is a Monday.
const MONDAY='2026-09-21'
const block=(overrides)=>({id:'block-'+Math.random(),label:'Class',kind:'study',start:'09:00',end:'10:00',occurrenceNotes:{},completedDates:[],skippedDates:[],...overrides})
const season=(overrides)=>({id:'season-'+Math.random(),profileId:PROFILE,name:'Fall',start:'2026-08-01',end:'2026-12-01',active:true,week:{Sunday:[],Monday:[],Tuesday:[],Wednesday:[],Thursday:[],Friday:[],Saturday:[]},...overrides})
const data=(studySeasons)=>({activeProfileId:PROFILE,studySeasons})

test('with no schedule at all, the whole default day window is one open slot',()=>{
 const slots=findOpenSlots(data([]),MONDAY,60)
 assert.equal(slots.length,1)
 same(slots[0],{start:'07:00',end:'08:00'})
})

test('a class in the middle of the day splits the window into a slot before and a slot after it',()=>{
 const s=season({week:{...season().week,Monday:[block({start:'09:00',end:'10:00'})]}})
 const slots=findOpenSlots(data([s]),MONDAY,60)
 same(slots,[{start:'07:00',end:'08:00'},{start:'10:00',end:'11:00'}])
})

test('a "break" block is free time, not a commitment, so it never blocks a suggestion',()=>{
 const s=season({week:{...season().week,Monday:[
  block({start:'08:00',end:'09:00',kind:'study'}),
  block({start:'09:00',end:'09:30',kind:'break'}),
  block({start:'09:30',end:'10:30',kind:'study'}),
 ]}})
 // The only fully open gap of at least 30 minutes before the default window ends is the break itself.
 const slots=findOpenSlots(data([s]),MONDAY,30,'08:00','10:30')
 same(slots,[{start:'09:00',end:'09:30'}])
})

test('a day fully booked back-to-back across the whole window has no open slots',()=>{
 const s=season({week:{...season().week,Monday:[block({start:'07:00',end:'22:00'})]}})
 same(findOpenSlots(data([s]),MONDAY,15),[])
})

test('a duration longer than any single gap finds nothing, even though shorter durations fit',()=>{
 const s=season({week:{...season().week,Monday:[block({start:'08:00',end:'21:00'})]}})
 // Open gaps are 07:00-08:00 and 21:00-22:00, each 60 minutes.
 same(findOpenSlots(data([s]),MONDAY,90),[])
 assert.equal(findOpenSlots(data([s]),MONDAY,60).length,2)
})

test('overlapping blocks from different seasons are merged, not double-counted as separate gaps',()=>{
 const a=season({id:'a',week:{...season().week,Monday:[block({start:'09:00',end:'11:00'})]}})
 const b=season({id:'b',week:{...season().week,Monday:[block({start:'10:00',end:'12:00'})]}})
 const slots=findOpenSlots(data([a,b]),MONDAY,60)
 same(slots,[{start:'07:00',end:'08:00'},{start:'12:00',end:'13:00'}])
})

test('an inactive season or one belonging to another profile is ignored',()=>{
 const inactive=season({active:false,week:{...season().week,Monday:[block({start:'09:00',end:'10:00'})]}})
 const otherProfile=season({profileId:'someone-else',week:{...season().week,Monday:[block({start:'11:00',end:'12:00'})]}})
 const slots=findOpenSlots(data([inactive,otherProfile]),MONDAY,60)
 assert.equal(slots.length,1)
 same(slots[0],{start:'07:00',end:'08:00'})
})

test('an empty date or a non-positive duration is refused rather than returning a bogus slot',()=>{
 same(findOpenSlots(data([]),'',60),[])
 same(findOpenSlots(data([]),MONDAY,0),[])
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} time-blocking regression groups passed.`)
