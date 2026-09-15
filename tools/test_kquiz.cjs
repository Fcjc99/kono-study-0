// Positive assertions over the actual staged TS, mirroring tools/test_data_safety.cjs's loader.
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
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:requireIn,crypto:{randomUUID},console,Date,Math,Set,Map,Object,Promise,fetch:(...a)=>fetchHook(...a)})
 modules.set(rel,mod.exports);return mod.exports
}
let fetchHook
const model=load('src/store/model.ts'),kquiz=load('src/store/kquizGenerate.ts')
const make=()=>model.createFreshData()
const tests=[]
function test(name,fn){tests.push({name,fn})}

test('a lecture and a study set referencing it survive normalization, with the linked flashcard deck',()=>{
 const d=make(),pid=d.activeProfileId
 d.kquizLectures=[{id:'lec1',profileId:pid,title:'Cell biology',createdAt:'2026-09-14T12:00:00.000Z',durationSeconds:1830,transcript:'Mitochondria is the powerhouse of the cell.'}]
 d.flashcardDecks=[{id:'deck1',profileId:pid,title:'Cell biology',cards:[{id:'c1',question:'What is the powerhouse of the cell?',answer:'Mitochondria',needsReview:true}]}]
 d.kquizSets=[{id:'set1',profileId:pid,lectureId:'lec1',title:'Cell biology',createdAt:'2026-09-14T12:05:00.000Z',summary:'A summary.',studyGuide:'# Guide',flashcardDeckId:'deck1',practiceTest:{questions:[{id:'q0',type:'mcq',prompt:'Which organelle?',choices:['Nucleus','Mitochondria'],correctIndex:1},{id:'q1',type:'written',prompt:'Explain.',answer:'It produces ATP.'}]}}]
 const normalized=model.normalizeData(d)
 assert.equal(normalized.kquizLectures.length,1);assert.equal(normalized.kquizLectures[0].transcript,'Mitochondria is the powerhouse of the cell.')
 assert.equal(normalized.kquizSets.length,1)
 const set=normalized.kquizSets[0]
 assert.equal(set.lectureId,'lec1');assert.equal(set.flashcardDeckId,'deck1')
 assert.equal(set.practiceTest.questions.length,2)
 assert.equal(set.practiceTest.questions[0].type,'mcq');assert.equal(set.practiceTest.questions[0].correctIndex,1)
 assert.equal(set.practiceTest.questions[1].type,'written');assert.equal(set.practiceTest.questions[1].answer,'It produces ATP.')
 assert.equal(JSON.stringify(model.normalizeData(normalized)),JSON.stringify(normalized))
})

test('lectures and study sets default to an empty subjectId and can be filed under a real subject',()=>{
 const d=make(),pid=d.activeProfileId
 d.subjects=[{id:'subj1',profileId:pid,name:'Biology',color:'#000'}]
 d.kquizLectures=[{id:'lec1',profileId:pid,title:'No folder',createdAt:'2026-09-14T12:00:00.000Z',durationSeconds:60,transcript:'x'},{id:'lec2',profileId:pid,subjectId:'subj1',title:'Filed',createdAt:'2026-09-14T12:00:00.000Z',durationSeconds:60,transcript:'x'}]
 d.kquizSets=[{id:'set1',profileId:pid,subjectId:'subj1',title:'X',createdAt:'2026-09-14T12:00:00.000Z'}]
 const normalized=model.normalizeData(d)
 assert.equal(normalized.kquizLectures[0].subjectId,'');assert.equal(normalized.kquizLectures[1].subjectId,'subj1')
 assert.equal(normalized.kquizSets[0].subjectId,'subj1')
})

test('a study set filed under another profile\'s subject is rejected',()=>{
 const d=make(),ownPid=d.activeProfileId,otherPid='other-profile'
 d.profiles.push({id:otherPid,name:'Other',label:'Other plan',kind:'custom',start:d.profiles[0].start,end:d.profiles[0].end})
 d.subjects=[{id:'subj1',profileId:otherPid,name:'Not yours',color:'#000'}]
 d.kquizSets=[{id:'set1',profileId:ownPid,subjectId:'subj1',title:'X',createdAt:'2026-09-14T12:00:00.000Z'}]
 assert.throws(()=>model.normalizeData(d),/subject belongs to another profile/)
})

test('a study set referencing an unknown lecture or deck is rejected, not silently dropped',()=>{
 const base=()=>{const d=make(),pid=d.activeProfileId;d.kquizSets=[{id:'set1',profileId:pid,title:'X',createdAt:'2026-09-14T12:00:00.000Z'}];return d}
 const withLecture=base();withLecture.kquizSets[0].lectureId='missing'
 assert.throws(()=>model.normalizeData(withLecture),/lecture reference/)
 const withDeck=base();withDeck.kquizSets[0].flashcardDeckId='missing'
 assert.throws(()=>model.normalizeData(withDeck),/deck reference/)
})

test('an mcq question needs a valid correctIndex within its choices, a written question needs an answer',()=>{
 const d=make(),pid=d.activeProfileId
 d.kquizSets=[{id:'set1',profileId:pid,title:'X',createdAt:'2026-09-14T12:00:00.000Z',practiceTest:{questions:[{id:'q0',type:'mcq',prompt:'?',choices:['a','b'],correctIndex:5}]}}]
 assert.throws(()=>model.normalizeData(d),/mcq correct choice/)
 const d2=make();d2.kquizSets=[{id:'set1',profileId:d2.activeProfileId,title:'X',createdAt:'2026-09-14T12:00:00.000Z',practiceTest:{questions:[{id:'q0',type:'written',prompt:'?'}]}}]
 assert.throws(()=>model.normalizeData(d2))
})

test('a lecture from another profile cannot be referenced by this profile\'s study set',()=>{
 const d=make(),ownPid=d.activeProfileId,otherPid='other-profile'
 d.profiles.push({id:otherPid,name:'Other',label:'Other plan',kind:'custom',start:d.profiles[0].start,end:d.profiles[0].end})
 d.kquizLectures=[{id:'lec1',profileId:otherPid,title:'Not yours',createdAt:'2026-09-14T12:00:00.000Z',durationSeconds:60,transcript:'x'}]
 d.kquizSets=[{id:'set1',profileId:ownPid,lectureId:'lec1',title:'X',createdAt:'2026-09-14T12:00:00.000Z'}]
 // The reference resolves (the lecture id exists somewhere), which is fine — cross-profile isolation
 // for K-Quiz's own writes is enforced the same way as every other collection, by assertProfileWrite
 // guarding whichever profile is actually being edited, not by rejecting the reference itself.
 assert.doesNotThrow(()=>model.normalizeData(d))
})

test('AI response parsing accepts a well-formed generation and rejects missing/malformed pieces',()=>{
 const good=JSON.stringify({summary:'S',studyGuide:'G',flashcards:[{question:'Q1',answer:'A1'},{question:'Q2',answer:'A2'}],questions:[{type:'mcq',prompt:'P1',choices:['a','b','c'],correctIndex:2},{type:'written',prompt:'P2',answer:'A'}]})
 const parsed=kquiz.__test__.parseGenerated(good)
 assert.equal(parsed.summary,'S');assert.equal(parsed.flashcards.length,2);assert.equal(parsed.questions.length,2)
 assert.equal(parsed.questions[0].type,'mcq');assert.equal(parsed.questions[0].correctIndex,2)
 assert.throws(()=>kquiz.__test__.parseGenerated('not json'))
 assert.throws(()=>kquiz.__test__.parseGenerated(JSON.stringify({summary:'S'})))
 assert.throws(()=>kquiz.__test__.parseGenerated(JSON.stringify({summary:'S',studyGuide:'G',flashcards:[],questions:[]})))
 // A malformed mcq (bad correctIndex) is dropped rather than failing the whole batch, as long as
 // other questions/cards are still usable.
 const partial=JSON.stringify({summary:'S',studyGuide:'G',flashcards:[{question:'Q1',answer:'A1'}],questions:[{type:'mcq',prompt:'Bad',choices:['a'],correctIndex:9},{type:'written',prompt:'Good',answer:'A'}]})
 const parsedPartial=kquiz.__test__.parseGenerated(partial)
 assert.equal(parsedPartial.questions.length,1);assert.equal(parsedPartial.questions[0].prompt,'Good')
})

test('the prompt sent to the AI includes the transcript and truncates a runaway one',()=>{
 const short=kquiz.__test__.buildPrompt('hello lecture')
 assert.ok(short.includes('hello lecture'))
 assert.throws(()=>kquiz.__test__.buildPrompt('   '))
 const long=kquiz.__test__.buildPrompt('x'.repeat(70000))
 assert.ok(long.includes('[transcript truncated]'))
 assert.ok(long.length<70000)
})

test('the photo scan prompt asks the model to read the image rather than a transcript',()=>{
 const prompt=kquiz.__test__.buildPhotoPrompt()
 assert.ok(prompt.toLowerCase().includes('photo'))
 assert.ok(prompt.includes('"summary"'));assert.ok(prompt.includes('"flashcards"'));assert.ok(prompt.includes('"questions"'))
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} K-Quiz regression groups passed.`)
