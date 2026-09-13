// Actual classifyVoiceInput function; no browser or user-data writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,console})
 return module.exports
}
const {classifyVoiceInput}=load('src/store/voiceIntake.ts')
const {addDays}=load('src/store/studyScheduler.ts')
const today='2026-09-13'
const subjects=[{id:'sub-bio',name:'Biology'},{id:'sub-math',name:'Math'}]

const homework=classifyVoiceInput('Biology homework due tomorrow',subjects,today,addDays)
assert.equal(homework.key,'tasks');assert.equal(homework.subjectId,'sub-bio');assert.equal(homework.date,addDays(today,1))

const exam=classifyVoiceInput('Chemistry midterm next week',subjects,today,addDays)
assert.equal(exam.key,'exams')

const appointment=classifyVoiceInput('Dentist appointment on 10/15',subjects,today,addDays)
assert.equal(appointment.key,'calendarEvents');assert.equal(appointment.kind,'appointment');assert.equal(appointment.date,'2026-10-15')

const note=classifyVoiceInput('Remember to bring my calculator',subjects,today,addDays)
assert.equal(note.key,'notes')

// A task word wins over a bare "remember" mention, since assignments matter more than a soft note cue.
const taskOverNote=classifyVoiceInput('Remember the Math homework is due today',subjects,today,addDays)
assert.equal(taskOverNote.key,'tasks');assert.equal(taskOverNote.subjectId,'sub-math');assert.equal(taskOverNote.date,today)

const fallback=classifyVoiceInput('Pick up posterboard for the science fair',subjects,today,addDays)
assert.equal(fallback.key,'tasks')

console.log('PASS voice intake: homework/exam/appointment/note classification, subject detection, today/tomorrow/explicit dates, default fallback.')
