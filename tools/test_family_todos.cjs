// Family to-dos with a day and a repeat: every week, every 2 weeks or every month (store/familyTodos).
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
const {todosOn,tickTodo,todoDayLabel,nextTurn}=load('src/store/familyTodos.ts')
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const t=(id,extra)=>({id,profileId:'p',title:id,done:false,...extra})
test('a to-do shows on its day, a weekly one on that weekday every week from its first day',()=>{
 const data={familyTodos:[t('clean',{due:'2026-10-17',repeat:'week'}),t('slip',{due:'2026-10-16'}),t('any',{}),t('done',{due:'2026-10-17',done:true}),t('other',{due:'2026-10-17',profileId:'q'})]}
 assert.deepEqual(todosOn(data,'p','2026-10-17').map(x=>x.id),['clean'])
 assert.deepEqual(todosOn(data,'p','2026-10-24').map(x=>x.id),['clean'],'next Saturday too')
 assert.deepEqual(todosOn(data,'p','2026-10-10').map(x=>x.id),[],'not before it starts')
 assert.deepEqual(todosOn(data,'p','2026-10-16').map(x=>x.id),['slip'])
 assert.deepEqual(todosOn(data,'p','2026-10-18').map(x=>x.id),[])
})
test('ticking a weekly to-do moves it to next week; a one-off is crossed off',()=>{
 const w=tickTodo(t('clean',{due:'2026-10-17',repeat:'week'}),'2026-10-17')
 assert.equal(w.due,'2026-10-24');assert.equal(w.done,false)
 const late=tickTodo(t('clean',{due:'2026-10-03',repeat:'week'}),'2026-10-17')
 assert.equal(late.due,'2026-10-17','a missed one moves to today’s turn, skipping the past weeks')
 assert.equal(tickTodo(t('clean',{due:'2026-10-17',repeat:'week'}),'2026-10-15').due,'2026-10-24','ticked early: this Saturday is done')
 const one=tickTodo(t('slip',{due:'2026-10-16'}),'2026-10-15')
 assert.equal(one.done,true)
})
test('day labels',()=>{
 assert.equal(todoDayLabel('2026-10-15','2026-10-15'),'Today');assert.equal(todoDayLabel('2026-10-16','2026-10-15'),'Tomorrow')
 assert.equal(todoDayLabel('2026-10-17','2026-10-15'),new Date('2026-10-17T12:00:00').toLocaleDateString(undefined,{weekday:'long'}))
})
test('every 2 weeks and every month',()=>{
 const trash=t('trash',{due:'2026-10-16',repeat:'2weeks'})
 assert.deepEqual(['2026-10-16','2026-10-23','2026-10-30'].map(d=>todosOn({familyTodos:[trash]},'p',d).length),[1,0,1])
 assert.equal(tickTodo(trash,'2026-10-16').due,'2026-10-30')
 assert.equal(tickTodo(trash,'2026-10-25').due,'2026-10-30','late: the next turn from today on')
 const rent=t('rent',{due:'2026-10-31',repeat:'month'})
 assert.equal(todosOn({familyTodos:[rent]},'p','2026-11-30').length,1,'the 31st lands on the last day of November')
 assert.equal(todosOn({familyTodos:[rent]},'p','2026-11-01').length,0)
 assert.equal(nextTurn(rent,'2026-10-31'),'2026-11-30')
 assert.equal(nextTurn(rent,'2026-11-30'),'2026-12-31')
 assert.equal(nextTurn(t('pay',{due:'2026-10-01',repeat:'month'}),'2026-12-15'),'2027-01-01')
})
test('a monthly one keeps to its day after a short month; a missed Planner turn lands on today’s',()=>{
 const rent={...t('rent',{due:'2027-01-31',repeat:'month',monthDay:31})}
 const feb=tickTodo(rent,'2027-01-31');assert.equal(feb.due,'2027-02-28')
 assert.equal(tickTodo(feb,'2027-02-28').due,'2027-03-31','back to the 31st')
 assert.equal(tickTodo(t('clean',{due:'2026-10-12',repeat:'week'}),'2026-10-19','2026-10-12').due,'2026-10-19','ticking last week’s turn leaves today’s')
})
test('ticking a later turn (from the Planner) moves past that turn',()=>{
 assert.equal(tickTodo(t('clean',{due:'2026-10-17',repeat:'week'}),'2026-10-15','2026-10-24').due,'2026-10-31')
})
test('a saved weekly to-do from before reads as every week',()=>{
 const {normalizeData,createFreshData}=load('src/store/model.ts')
 const base=createFreshData(),pid=base.activeProfileId
 const out=normalizeData({...base,familyTodos:[{id:'a',profileId:pid,title:'Clean',done:false,due:'2026-10-17',weekly:true},{id:'b',profileId:pid,title:'Rent',done:false,due:'2026-10-01',repeat:'month'},{id:'c',profileId:pid,title:'Odd',done:false,repeat:'week'}]})
 assert.deepEqual(out.familyTodos.map(x=>x.repeat),['week','month',undefined])
 assert.equal(out.familyTodos[0].weekly,true,'every week keeps the older weekly flag for older copies of the app')
 assert.equal(out.familyTodos[1].monthDay,1)
})
console.log(passed+'/7 family to-do groups passed.')
