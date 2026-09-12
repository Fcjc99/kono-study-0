// Validate the NDA six-day grid with the real user-supplied PDF.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console})
 return module.exports
}
async function main(){
 const {pdfSixDayTimetableText}=load('src/store/pdfTimetableText.ts'),{parseNdaSixDaySchedule}=load('src/store/schoolImport.ts')
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2])),useSystemFonts:true}).promise
 const text=pdfSixDayTimetableText((await (await doc.getPage(1)).getTextContent()).items),rows=parseNdaSixDaySchedule(text,'2026-09-09','2027-06-02')
 assert.equal(rows.length,46);assert.equal(rows.filter(r=>r.kind==='study').length,25)
 assert.ok(rows.some(r=>r.day==='Day 1'&&r.label==='AP U.S. History'&&r.start==='09:56'&&r.end==='10:56'))
 assert.ok(rows.some(r=>r.day==='Day 5'&&r.label==='NDA Clubs'&&r.slot==='J'))
 assert.ok(rows.some(r=>r.day==='Day 5'&&r.label==='NDA Clubs'&&r.slot==='K'))
 assert.ok(rows.some(r=>r.day==='Day 3'&&r.label==='Honors Spanish IV'&&r.start==='10:59'))
 assert.ok(rows.some(r=>r.day==='Day 2'&&r.label==='Honors Language Literature & Composition'&&r.start==='07:50'))
 assert.ok(!rows.some(r=>/Sophia|Locker|Grade 11/i.test(r.label)))
 console.log('PASS NDA PDF: 46 blocks across six days, including merged and split periods.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
