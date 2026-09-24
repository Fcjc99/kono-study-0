// Loading a save must never lock someone out of their plan over a value this build doesn't know.
// These load committed save snapshots (tools/fixtures/save-*.json) and saves carrying values from a
// hypothetical newer build, through the real normalizeData.
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
const model=load('src/store/model.ts')
const json=x=>JSON.stringify(x)
const fixtures=fs.readdirSync(path.join(__dirname,'fixtures')).filter(f=>/^save-.*\.json$/.test(f))
const snapshot=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','save-2026-09.json'),'utf8'))

const tests=[]
function test(name,fn){tests.push({name,fn})}

test('every committed save snapshot still loads, and loading is stable (normalize twice = normalize once)',()=>{
 assert.ok(fixtures.length>0)
 for(const f of fixtures){
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',f),'utf8'))
  const once=model.normalizeData(raw)
  assert.equal(json(model.normalizeData(once)),json(once),f+' is not stable across reloads')
  assert.ok(once.tasks.length&&once.kids.length&&once.calendarEvents.length,f+' lost records')
 }
})

test('values from a newer build in every enum field fall back to defaults instead of failing the load',()=>{
 const d=snapshot(),future='value-from-the-future'
 d.profiles[0].kind=future
 d.calendarEvents[0].kind=future
 d.notes[0].size=future;d.notes[0].font=future
 d.exams[0].font=future
 d.studySeasons[0].week.Monday[0].kind=future
 d.studySeasons[0].category=future
 d.sanctuaryDecor[d.activeProfileId].placements[0].textFont=future
 d.kids[0].borderStyle=future;d.kids[0].borderGlow=future
 Object.assign(d.settings,{experience:future,theme:future,textSize:future,density:future,boardStyle:future,motionPreference:future,sanctuaryWeather:future,sanctuaryWeatherMode:future})
 const n=model.normalizeData(d),s=n.settings
 assert.equal(n.profiles[0].kind,'custom')
 assert.equal(n.calendarEvents[0].kind,'other')
 assert.equal(n.notes[0].size,'medium');assert.equal(n.notes[0].font,'rounded')
 assert.equal(n.studySeasons[0].week.Monday[0].kind,'study')
 assert.equal(n.kids[0].borderStyle,'modern');assert.equal(n.kids[0].borderGlow,'soft')
 assert.equal(s.textSize,'normal');assert.equal(s.density,'comfortable');assert.equal(s.boardStyle,'paper')
 // Everything that wasn't touched survives.
 assert.equal(n.tasks.length,snapshot().tasks.length);assert.equal(n.tasks[0].title,'Read chapter 3')
})

test('color formats this build does not know fall back instead of failing the load',()=>{
 const d=snapshot(),odd='rgb(10 20 30 / 50%)'
 d.subjects[0].color=odd;d.kids[0].color=odd;d.exams[0].color=odd;d.exams[0].textColor=odd;d.notes[0].highlight=odd
 d.sanctuaryDecor[d.activeProfileId].placements[0].textColor=odd
 const n=model.normalizeData(d)
 assert.equal(n.subjects[0].color,'#4169a8');assert.equal(n.kids[0].color,'#7ca982');assert.equal(n.notes[0].highlight,'transparent')
})

test('a kid border value retired in #129 migrates instead of resetting the plan (the Sept 2026 incident)',()=>{
 const d=snapshot();d.kids[0].borderStyle='fire'
 assert.equal(model.normalizeData(d).kids[0].borderStyle,'unique')
})

test('Trash stays strict about which collection an item restores into -- guessing would misplace data',()=>{
 const d=snapshot()
 d.trash=[{id:'tr-1',profileId:d.activeProfileId,collection:'somewhere-new',title:'x',payload:'{}',deletedAt:'2026-09-24T00:00:00Z'}]
 assert.throws(()=>model.normalizeData(d),/choice/)
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} save-compatibility regression groups passed.`)
