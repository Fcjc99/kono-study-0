// Quick add ("＋ Add" › Type it): one typed line becomes an assignment or exam with its class, date and time.
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
const {parseQuickAdd}=load('src/store/quickAdd.ts')
const subjects=[{id:'bio',name:'Biology'},{id:'alg',name:'Algebra II'},{id:'eng',name:'English 10'},{id:'hist',name:'US History II'},{id:'span',name:'Spanish III'},{id:'chem',name:'Chemistry I'},{id:'calc',name:'AP Calculus AB'}]
const today='2026-09-30' // a Wednesday
const q=text=>{const r=parseQuickAdd(text,subjects,today);return [r.key,r.title,r.subjectId,r.due,r.time??''].join(' | ')}

test('short class names, weekdays and exam words',()=>{
 assert.equal(q('bio worksheet due fri'),'tasks | Worksheet | bio | 2026-10-02 | ')
 assert.equal(q('math test thursday'),'exams | Test | alg | 2026-10-01 | ')
 assert.equal(q('spanish quiz next wed'),'exams | Quiz | span | 2026-10-07 | ')
 assert.equal(q('apush reading due next fri'),'tasks | Reading | hist | 2026-10-09 | ')
 assert.equal(q('chem lab wed'),'tasks | Lab | chem | 2026-10-07 | ','the same weekday means next week')
})
test('dates: tomorrow, today, in N days, next week, 10/12, Oct 5',()=>{
 assert.equal(q('read ch 4 tomorrow'),'tasks | Read ch 4 |  | 2026-10-01 | ')
 assert.equal(q('calc due today'),'tasks | AP Calculus AB assignment | calc | 2026-09-30 | ')
 assert.equal(q('history project in 3 days at 4'),'tasks | Project | hist | 2026-10-03 | 16:00')
 assert.equal(q('english essay due 10/12'),'tasks | Essay | eng | 2026-10-12 | ')
 assert.equal(q('Chemistry lab report due Oct 5'),'tasks | Lab report | chem | 2026-10-05 | ')
 assert.equal(q('vocab quiz next week'),'exams | Vocab quiz |  | 2026-10-05 | ')
 assert.equal(q('bio essay in a week'),'tasks | Essay | bio | 2026-10-07 | ')
})
test('times: 7pm, at 8:30, and none for exams',()=>{
 assert.equal(q('biology worksheet tonight at 7pm'),'tasks | Worksheet | bio | 2026-09-30 | 19:00')
 assert.equal(q('practice problems fri at 8:30am'),'tasks | Practice problems |  | 2026-10-02 | 08:30')
 assert.equal(q('bio test mon 8am'),'exams | Test | bio | 2026-10-05 | ')
})
test('no date: tomorrow, and it says so; nothing but a class still gets a title',()=>{
 const r=parseQuickAdd('permission slip',subjects,today)
 assert.equal(r.due,'2026-10-01');assert.equal(r.dateFound,false);assert.equal(r.title,'Permission slip')
 assert.equal(q('worksheet due'),'tasks | Worksheet |  | 2026-10-01 | ')
 assert.equal(q('spanish'),'tasks | Spanish III assignment | span | 2026-10-01 | ')
 assert.equal(parseQuickAdd('essay fri',[],today).subjectId,'','no classes: no subject')
})
console.log(`${passed}/4 quick-add groups passed.`)
