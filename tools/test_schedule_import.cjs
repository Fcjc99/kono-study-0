// Actual application functions with isolated fixtures; no browser or user-data writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console})
 return module.exports
}

const {suggestSchedule,applyScheduleImport,validDate}=load('src/store/scheduleImport.ts'),model=load('src/store/model.ts'),{classOccurrences}=load('src/store/classSchedule.ts')
const start='2026-09-01',end='2026-12-31'
const suggested=suggestSchedule('Biology Tuesday 10am-12pm\nMidterm 10/06/2026\nRead chapter 1 due September 15, 2026\nUnknown timetable header',start,end,'mdy')
assert.equal(suggested.length,3);assert.ok(suggested.every(r=>!r.include));assert.deepEqual([...suggested[0].weekdays],[2]);assert.equal(suggested[0].start,'10:00');assert.equal(suggested[0].end,'12:00');assert.equal(suggested[1].date,'2026-10-06')
assert.equal(suggestSchedule('Biology Tue 10-12',start,end,'mdy')[0].start,'')
assert.equal(suggestSchedule('Exam 09/10',start,end,'dmy')[0].date,'2026-10-09')
assert.equal(suggestSchedule('Exam 09/10','2026-01-01','2027-12-31','mdy')[0].date,'')
assert.equal(validDate('2026-02-30'),false)

// A sports schedule copied from a scheduling site (or read from its screenshot/PDF via OCR) puts one
// field per line — this used to both misclassify every game as a recurring weekly class (a specific
// date like "Tue, 9/8" still matched the bare weekday regex) and drop the opponent name, time and
// home/away entirely, since none of those continuation lines carry a date or weekday on their own.
const tableExport=suggestSchedule('TEAM GAME SCHEDULE\nDATE\nTIME\nTEAM / OPPONENT\nHOME / AWAY\nTue, 9/8\n4:00 PM\nSilver Lake Regional HS\nAWAY\nThu, 9/10\n4:00 PM\nNorth Quincy High School\nHOME',start,end,'mdy')
assert.equal(tableExport.length,2)
assert.equal(tableExport[0].kind,'event');assert.equal(tableExport[0].date,'2026-09-08');assert.equal(tableExport[0].title,'Silver Lake Regional HS AWAY')
assert.equal(tableExport[1].kind,'event');assert.equal(tableExport[1].date,'2026-09-10');assert.equal(tableExport[1].title,'North Quincy High School HOME')

// A trailing "Home = vs. ... | Away = @ ..." legend line (common on real exports, e.g. an Arbiter PDF)
// has no date/weekday of its own and used to glue onto the LAST game's title instead of being dropped
// like the header lines above it.
const withLegend=suggestSchedule('Tue, 9/8\n4:00 PM\nSilver Lake Regional HS\nAWAY\nHome = listed as vs. on the source schedule | Away = listed as @ on the source schedule',start,end,'mdy')
assert.equal(withLegend.length,1);assert.equal(withLegend[0].title,'Silver Lake Regional HS AWAY')
const base=model.createFreshData(),id=base.activeProfileId,rows=suggested.map(r=>({...r,include:true,subject:'Biology'}))
const imported=applyScheduleImport(base,id,rows,start,end)
assert.equal(base.subjects.length,0);assert.equal(imported.data.subjects.length,1);assert.equal(imported.data.exams.length,1);assert.equal(imported.data.tasks.length,1)
assert.equal(classOccurrences(imported.data,'2026-09-08').length,1);assert.equal(classOccurrences(imported.data,'2027-01-05').length,0)
const twice=applyScheduleImport(imported.data,id,rows,start,end)
assert.equal(twice.added,0);assert.equal(twice.skipped,3);assert.equal(twice.data.subjects.length,1)
assert.throws(()=>applyScheduleImport(base,'someone-else',rows,start,end))
assert.throws(()=>applyScheduleImport(base,id,[{...rows[0],end:'09:00'}],start,end))
assert.throws(()=>applyScheduleImport(base,id,[{...rows[1],date:'2026-02-30'}],start,end))
assert.throws(()=>applyScheduleImport(base,id,rows,'bad',end))
assert.equal(base.subjects.length,0)
const selectedOnly=applyScheduleImport(base,id,[{...rows[0],include:false},rows[1]],start,end)
assert.equal(selectedOnly.data.studySeasons.length,base.studySeasons.length)
console.log('PASS schedule import: unchecked suggestions, explicit times, date order/year ambiguity, validation, recurrence, deduplication, atomicity and profile guard.')
