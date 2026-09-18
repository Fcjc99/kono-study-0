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
const {planExamReview}=load('src/store/examReview.ts')

const tests=[]
function test(name,fn){tests.push({name,fn})}

const pid='p1',subjectId='subj-bio'
const deck=(id,title)=>({id,profileId:pid,title,cards:[]})
const kset=(id,flashcardDeckId)=>({id,profileId:pid,subjectId,title:'Set',createdAt:'2026-09-01T00:00:00.000Z',flashcardDeckId})

test('with no flashcard decks for the subject, review scheduling is refused',()=>{
 const result=planExamReview({profileId:pid,subjectId,examTitle:'Midterm',due:'2026-10-15',today:'2026-09-18',kquizSets:[],flashcardDecks:[],calendarEvents:[]})
 assert.equal(result.ok,false)
 assert.match(result.message,/generate a study set/)
})

test('a subject with a linked deck schedules review sessions at 14/7/3/1 days out, clamped to today and before the exam',()=>{
 const kquizSets=[kset('set1','deck1')],flashcardDecks=[deck('deck1','Cell biology')]
 const result=planExamReview({profileId:pid,subjectId,examTitle:'Midterm',due:'2026-10-15',today:'2026-09-18',kquizSets,flashcardDecks,calendarEvents:[]})
 assert.equal(result.ok,true)
 if(!result.ok)return
 assert.equal(result.events.map(e=>e.date).join(','),'2026-10-01,2026-10-08,2026-10-12,2026-10-14')
 assert.ok(result.events.every(e=>e.kind==='study'))
 assert.ok(result.events.every(e=>e.title==='Review — Midterm'))
 assert.ok(result.events.every(e=>e.subjectId===subjectId&&e.profileId===pid))
 assert.ok(result.events[0].notes.includes('Cell biology'))
})

test('an exam happening today, where every offset lands before today, is refused rather than silently truncated to nothing',()=>{
 const kquizSets=[kset('set1','deck1')],flashcardDecks=[deck('deck1','Cell biology')]
 const result=planExamReview({profileId:pid,subjectId,examTitle:'Pop quiz',due:'2026-09-18',today:'2026-09-18',kquizSets,flashcardDecks,calendarEvents:[]})
 assert.equal(result.ok,false)
 assert.match(result.message,/too close/)
})

test('an exam exactly one day out schedules a single same-day review session',()=>{
 const kquizSets=[kset('set1','deck1')],flashcardDecks=[deck('deck1','Cell biology')]
 const result=planExamReview({profileId:pid,subjectId,examTitle:'Pop quiz',due:'2026-09-19',today:'2026-09-18',kquizSets,flashcardDecks,calendarEvents:[]})
 assert.equal(result.ok,true)
 if(!result.ok)return
 assert.equal(result.events.map(e=>e.date).join(','),'2026-09-18')
})

test('re-running after sessions already exist only fills the gaps, never duplicates a date',()=>{
 const kquizSets=[kset('set1','deck1')],flashcardDecks=[deck('deck1','Cell biology')]
 const existing=[{id:'e1',profileId:pid,subjectId,title:'Review — Midterm',kind:'study',date:'2026-10-01',notes:'',done:false}]
 const result=planExamReview({profileId:pid,subjectId,examTitle:'Midterm',due:'2026-10-15',today:'2026-09-18',kquizSets,flashcardDecks,calendarEvents:existing})
 assert.equal(result.ok,true)
 if(!result.ok)return
 assert.equal(result.events.map(e=>e.date).join(','),'2026-10-08,2026-10-12,2026-10-14')
})

test('once every offset date is already scheduled, running again is refused rather than creating duplicates',()=>{
 const kquizSets=[kset('set1','deck1')],flashcardDecks=[deck('deck1','Cell biology')]
 const existing=['2026-10-01','2026-10-08','2026-10-12','2026-10-14'].map((date,i)=>({id:'e'+i,profileId:pid,subjectId,title:'Review — Midterm',kind:'study',date,notes:'',done:false}))
 const result=planExamReview({profileId:pid,subjectId,examTitle:'Midterm',due:'2026-10-15',today:'2026-09-18',kquizSets,flashcardDecks,calendarEvents:existing})
 assert.equal(result.ok,false)
 assert.match(result.message,/already scheduled/)
})

test('a deck belonging to another profile or filed under a different subject is not counted',()=>{
 const kquizSets=[kset('set1','deck1'),{...kset('set2','deck2'),profileId:'other-profile'},{...kset('set3','deck3'),subjectId:'other-subject'}]
 const flashcardDecks=[deck('deck1','Mine'),deck('deck2','Not mine'),deck('deck3','Wrong subject')]
 const result=planExamReview({profileId:pid,subjectId,examTitle:'Midterm',due:'2026-10-15',today:'2026-09-18',kquizSets,flashcardDecks,calendarEvents:[]})
 assert.equal(result.ok,true)
 if(!result.ok)return
 assert.ok(result.events[0].notes.includes('Mine'))
 assert.ok(!result.events[0].notes.includes('Not mine'))
 assert.ok(!result.events[0].notes.includes('Wrong subject'))
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} exam-review regression groups passed.`)
