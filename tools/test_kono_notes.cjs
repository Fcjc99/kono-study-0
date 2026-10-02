// KONO's notes (src/store/konoNotes.ts): good luck the evening before a test, the headband on test day, How did it go? after it (asked once), and otherwise one gentle nudge a day.
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
const {konoNote,testDay,testsFrom,noteText,examEventId,nudgeEventId,moodLine}=load('src/store/konoNotes.ts')
const kind=n=>n?n.kind+':'+(n.test?n.test.title:n.item.title):'none'
const bio={id:'bio',title:'Bio test',due:'2026-10-08'}
const nudge={id:'essay',title:'Essay',why:'It’s due tomorrow.',minutes:25}

test('the evening before: good luck (not before 3 PM); on the day: the headband and a cheer',()=>{
 assert.equal(kind(konoNote([bio],[],[],'2026-10-07',10)),'none')
 assert.equal(kind(konoNote([bio],[],[],'2026-10-07',18)),'luck:Bio test')
 assert.match(noteText(konoNote([bio],[],[],'2026-10-07',18)),/^🍀 Good luck on Bio test tomorrow!/)
 assert.equal(kind(konoNote([bio],[],[],'2026-10-08',8)),'testday:Bio test')
 assert.equal(testDay([bio],'2026-10-08'),true)
 assert.equal(testDay([bio],'2026-10-07'),false)
})
test('after it (from 2 PM, or the next day): How did it go? until answered, on any device',()=>{
 assert.equal(kind(konoNote([bio],[],[],'2026-10-08',15)),'ask:Bio test')
 assert.equal(kind(konoNote([bio],[],[],'2026-10-09',9)),'ask:Bio test')
 const answered=[{id:examEventId(bio),kind:'exam',at:'2026-10-08T20:00:00.000Z',item:'good'}]
 assert.equal(kind(konoNote([bio],[],answered,'2026-10-09',9)),'none')
 assert.equal(kind(konoNote([bio],[],answered,'2026-10-08',16)),'none','answered on the day: no more test-day note')
 assert.equal(kind(konoNote([bio],[],[],'2026-10-10',9)),'none','two days later it isn’t asked')
 assert.match(moodLine('good','Bio test'),/^Yay!/)
 assert.match(moodLine('rough','Bio test'),/proud of you/)
})
test('otherwise one gentle nudge a day: Start or Not now hides it until tomorrow',()=>{
 assert.equal(kind(konoNote([],[nudge],[],'2026-10-07',9)),'nudge:Essay')
 assert.match(noteText(konoNote([],[nudge],[],'2026-10-07',9)),/^📌 Essay: It’s due tomorrow\. Start with 25 minutes\?$/)
 const later=[{id:nudgeEventId('2026-10-07'),kind:'nudge',at:'2026-10-07T13:00:00.000Z',item:'later'}]
 assert.equal(kind(konoNote([],[nudge],later,'2026-10-07',16)),'none')
 assert.equal(kind(konoNote([],[nudge],later,'2026-10-08',9)),'nudge:Essay','a new day, a new nudge')
 assert.equal(kind(konoNote([bio],[nudge],[],'2026-10-07',18)),'luck:Bio test','a test note comes first')
})
test('tests are exams plus test, quiz and exam events',()=>{
 const t=testsFrom([{id:'e1',title:'Unit test',due:'2026-10-09'}],[{id:'c1',title:'Quiz',date:'2026-10-10',kind:'quiz'},{id:'c2',title:'Dentist',date:'2026-10-10',kind:'appointment'}])
 assert.equal(JSON.stringify(t.map(x=>x.title+'@'+x.due)),'["Unit test@2026-10-09","Quiz@2026-10-10"]')
})
console.log(passed+'/4 KONO note groups passed.')
