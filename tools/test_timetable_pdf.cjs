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
async function main(){
 const {pdfTimetableText}=load('src/store/pdfTimetableText.ts'),{suggestRotatingClasses,addTimetableRows}=load('src/store/schoolImport.ts')
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2])),useSystemFonts:true}).promise
 const text=pdfTimetableText((await (await doc.getPage(1)).getTextContent()).items)
 console.log(text)
 const rows=suggestRotatingClasses(text,['A day','E day'],'2026-09-02','2027-06-17')
 assert.equal(rows.filter(r=>r.kind==='study').length,8)
 assert.equal(rows.find(r=>r.label==='Physics Honors').start,'08:00')
 assert.equal(rows.find(r=>r.label==='AP Statistics').start,'13:06')
 assert.equal(rows.find(r=>r.label==='AP English Lang & Comp').end,'13:02')
 assert.equal(rows.find(r=>r.label==='Chamber Orchestra').day,'A day')
 assert.equal(rows.find(r=>r.label==='Health Grade 11').day,'E day')
 assert.equal(rows.filter(r=>r.kind==='routine').length,2)
 assert.ok(rows.every(r=>r.start&&r.end&&r.day))
 assert.equal(suggestRotatingClasses(text,Array.from({length:6},(_,i)=>'Day '+(i+1)),'2026-09-02','2027-06-17').filter(r=>r.kind==='study').length,24)
 assert.equal(suggestRotatingClasses('Physics\tTeacher\tA\t8:00 - 9:24 AM Days 1,5',['A day','E day'],'2026-09-02','2027-06-17')[0].day,'')

 const {schoolPreset}=load('src/store/schoolPresets.ts'),model=load('src/store/model.ts'),{classOccurrences}=load('src/store/classSchedule.ts')
 const data=model.createFreshData(),season=schoolPreset(data.activeProfileId,'marshfield')
 season.school.grade='11';season.school.anchorDate='2026-09-02';season.school.anchorDay='A day'
 const selected=rows.map(r=>({...r,include:r.kind==='study'})),ready=addTimetableRows(season,selected)
 data.studySeasons=[ready]
 assert.equal(classOccurrences(data,'2026-09-02').length,4)
 assert.equal(classOccurrences(data,'2026-09-03').length,4)
 assert.equal(classOccurrences(data,'2026-09-07').length,0)
 assert.equal(Object.values(addTimetableRows(ready,selected).week).flat().length,8)
 assert.equal(Object.values(season.week).flat().length,0)
 assert.throws(()=>addTimetableRows(ready,[{...selected[0],label:'Overlapping class'}]),/overlaps/)
 assert.throws(()=>addTimetableRows(season,[{...selected[0],start:''}]),/Check/)
 await doc.loadingTask.destroy()
 console.log('PASS real PDF: eight clean classes, A/E and six-day mapping, AM/PM, optional homeroom, incomplete-day guard.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
