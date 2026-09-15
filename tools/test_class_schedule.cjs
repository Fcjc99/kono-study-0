// Actual application functions with isolated fixtures; no browser or user-data writes.
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
const model=load('src/store/model.ts'),c=load('src/store/classSchedule.ts'),{mergeData}=load('src/store/merge.ts')
const base=model.createFreshData(),season=base.studySeasons[0]
season.start='2026-09-01';season.end='2026-12-31'
season.week.Tuesday=[{id:'bio',label:'Biology',start:'10:00',end:'12:00',kind:'study',dateStart:'2026-09-08',dateEnd:'2026-10-06',occurrenceNotes:{}}]
const data=model.normalizeData(base),first=c.classOccurrences(data,'2026-09-08')[0]
assert.equal(c.classOccurrences(data,'2026-09-01').length,0)
assert.equal(c.classOccurrences(data,'2026-09-09').length,0)
assert.equal(c.classOccurrences(data,'2026-09-15').length,1)
assert.equal(c.classOccurrences(data,'2026-10-06').length,1)
assert.equal(c.classOccurrences(data,'2026-10-13').length,0)
assert.equal(c.nextClassDate(first),'2026-09-15')
const noted=model.normalizeData(c.saveClassNote(data,first,'Bring book next week'))
assert.equal(c.classOccurrences(noted,'2026-09-08')[0].block.occurrenceNotes['2026-09-08'],'Bring book next week')
assert.equal(c.classOccurrences(noted,'2026-09-15')[0].block.occurrenceNotes['2026-09-15'],undefined)
const future=c.classOccurrences(data,'2026-09-15')[0]
const remote=c.saveClassNote(data,future,'Lab coat')
const merged=mergeData(data,noted,remote)
assert.equal(merged.conflicts.length,0)
assert.equal(c.classOccurrences(merged.data,'2026-09-15')[0].block.occurrenceNotes['2026-09-15'],'Lab coat')
assert.throws(()=>c.saveClassNote(noted,first,'overwrite'),/changed elsewhere/)
const skipped=c.updateClass(data,first,b=>({...b,skippedDates:['2026-09-15']}))
assert.equal(c.nextClassDate(c.classOccurrences(skipped,'2026-09-08')[0]),'2026-09-22')
assert.equal(c.nextClassDate(c.classOccurrences(data,'2026-10-06')[0]),undefined)
const wrong=structuredClone(data);wrong.activeProfileId='foreign'
assert.throws(()=>c.saveClassNote(wrong,first,'No'),/profile/)
assert.equal(c.classOccurrences(wrong,'2026-09-08').length,0)
const legacy=structuredClone(base);legacy.schemaVersion=3;delete legacy.studySeasons[0].week.Tuesday[0].occurrenceNotes
assert.equal(model.normalizeData(legacy).schemaVersion,6)
assert.equal(c.classTime('10:00'),'10:00 AM');assert.equal(c.classTime('12:00'),'12:00 PM')
console.log('PASS recurring classes: inclusive dates, weekdays, one-date notes, concurrent different-date notes, stale-note protection, skipped next class, ownership and legacy migration.')
for(const experience of ['cozy','simplified','modern']){const themed=structuredClone(noted);themed.settings.experience=experience;const restored=model.normalizeData(themed);assert.equal(restored.settings.experience,experience);assert.equal(JSON.stringify(restored.tasks),JSON.stringify(noted.tasks));assert.equal(restored.studySeasons[0].week.Tuesday[0].occurrenceNotes['2026-09-08'],'Bring book next week')}
console.log('PASS all three experiences preserve classes, dated notes and tasks through normalization.')
