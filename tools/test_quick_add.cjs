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
test('events in one line: repeats, time ranges, who and where; homework and tests stay homework and tests',()=>{
 const people=[{id:'kid-emma',name:'Emma'},{id:'kid-leo',name:'Leo'}]
 const e=text=>{const r=parseQuickAdd(text,subjects,today,people);return r.key!=='calendarEvents'?r.key:[r.title,r.due,r.time??'',r.event.endTime??'',r.event.kind,r.event.repeatDays.join('+'),r.event.kidIds.join('+'),r.event.location??''].join(' | ')}
 assert.equal(e('soccer every Tue and Thu 4pm for Emma'),'Soccer | 2026-10-01 | 16:00 |  | sports | 2+4 | kid-emma | ','first one is Thursday (today is Wednesday)')
 assert.equal(e('piano lesson thursday 4-4:45pm for Leo'),'Piano lesson | 2026-10-01 | 16:00 | 16:45 | lesson |  | kid-leo | ')
 assert.equal(e('swim practice mondays and wednesdays 5:30-6:30pm at the Y'),'Swim practice | 2026-09-30 | 17:30 | 18:30 | sports | 1+3 |  | The Y')
 assert.equal(e('Emma and Leo soccer game sat 10am at Riverside Park'),'Soccer game | 2026-10-03 | 10:00 |  | sports |  | kid-emma+kid-leo | Riverside Park')
 assert.equal(e('work every weekday 9-5'),'Work | 2026-09-30 | 09:00 | 17:00 | work | 1+2+3+4+5 |  | ')
 assert.equal(e('dentist tomorrow at 9am'),'Dentist | 2026-10-01 | 09:00 |  | appointment |  |  | ')
 const club=parseQuickAdd('book club every week on tuesday 7pm until Dec 15',subjects,today,people)
 assert.equal(club.event.until,'2026-12-15');assert.deepEqual([...club.event.repeatDays],[2]);assert.equal(club.due,'2026-10-06')
 // Longer day names, a dashed date, an eye exam and noon.
 assert.equal(e('Emma soccer every Tues and Thurs 4pm'),'Soccer | 2026-10-01 | 16:00 |  | sports | 2+4 | kid-emma | ')
 assert.equal(e('dentist 2026-10-20 at 3pm'),'Dentist | 2026-10-20 | 15:00 |  | appointment |  |  | ')
 assert.equal(e('eye exam tuesday at 3pm for Leo'),'Eye exam | 2026-10-06 | 15:00 |  | appointment |  | kid-leo | ')
 assert.equal(e('lunch with Emma at noon'),'Lunch | 2026-10-01 | 12:00 |  | personal |  | kid-emma | ')
 assert.equal(e('Leo sleepover saturday 7pm-9am'),'Sleepover | 2026-10-03 | 19:00 | 09:00 | activity |  | kid-leo | ','runs overnight')
 assert.equal(e('bio worksheet due fri'),'tasks');assert.equal(e('math test thursday'),'exams');assert.equal(e('practice problems fri at 8:30am'),'tasks');assert.equal(e('permission slip'),'familyTodos','in a family plan a slip to sign is a to-do')
})
test('in a family plan a chore or errand with no time is a family to-do, with its day and repeat',()=>{
 const people=[{id:'kid-emma',name:'Emma'},{id:'kid-leo',name:'Leo'}]
 const t=text=>{const r=parseQuickAdd(text,subjects,today,people);return r.key!=='familyTodos'?r.key:[r.title,r.due,r.todo.repeat??'',r.todo.kidId??''].join(' | ')}
 assert.equal(t('clean house every sat'),'Clean house | 2026-10-03 | week | ')
 assert.equal(t('trash out every other tue'),'Trash out | 2026-10-06 | 2weeks | ')
 assert.equal(t('pay rent on the 1st every month'),'Pay rent | 2026-10-01 | month | ')
 assert.equal(t('pay rent the 15th monthly'),'Pay rent | 2026-10-15 | month | ')
 assert.equal(t('groceries'),'Groceries |  |  | ','no day: any day')
 assert.equal(t('buy poster board for Emma tomorrow'),'Buy poster board | 2026-10-01 |  | kid-emma')
 assert.equal(t('laundry wednesdays'),'Laundry | 2026-09-30 | week | ','today counts')
 assert.equal(t('to-do: renew passport oct 20'),'Renew passport | 2026-10-20 |  | ')
 assert.equal(t('remember to call grandma'),'Call grandma |  |  | ')
 assert.equal(t('buy gift for Emma\'s party sat'),'Buy gift for Emma\'s party | 2026-10-03 |  | kid-emma','her name stays in "Emma\'s party"')
 assert.equal(t('pay rent on the 31st every month'),'Pay rent | 2026-09-30 | month | ')
 assert.equal(parseQuickAdd('pay rent on the 31st every month',subjects,today,people).todo.monthDay,31,'keeps to the 31st after a short month')
 assert.equal(t('return library book due fri'),'Return library book | 2026-10-02 |  | ')
 // Not to-dos: anything with a time, tests and plain events.
 assert.equal(parseQuickAdd('pick up dry cleaning at 5pm',subjects,today,people).key!=='familyTodos',true,'a time makes it something on the calendar')
 assert.equal(t('soccer every Tue and Thu 4pm for Emma'),'calendarEvents')
 assert.equal(t('math test thursday'),'exams')
 for(const line of ['grocery shopping saturday 10:30','clean up day at school sat 9-11','order pizza fri 6'])assert.notEqual(t(line).split(' | ').length,4,line+' has a time, so it is not a to-do')
 assert.equal(t('order of operations worksheet due fri'),'tasks','schoolwork stays homework')
 assert.equal(parseQuickAdd('clean room',subjects,today).key,'tasks','a student plan has no family to-dos')
})
console.log(`${passed}/6 quick-add groups passed.`)
