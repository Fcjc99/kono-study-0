// Family to-dos with a day and a weekly repeat (store/familyTodos).
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
const {todosOn,tickTodo,todoDayLabel}=load('src/store/familyTodos.ts')
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const t=(id,extra)=>({id,profileId:'p',title:id,done:false,...extra})
test('a to-do shows on its day, a weekly one on that weekday every week from its first day',()=>{
 const data={familyTodos:[t('clean',{due:'2026-10-17',weekly:true}),t('slip',{due:'2026-10-16'}),t('any',{}),t('done',{due:'2026-10-17',done:true}),t('other',{due:'2026-10-17',profileId:'q'})]}
 assert.deepEqual(todosOn(data,'p','2026-10-17').map(x=>x.id),['clean'])
 assert.deepEqual(todosOn(data,'p','2026-10-24').map(x=>x.id),['clean'],'next Saturday too')
 assert.deepEqual(todosOn(data,'p','2026-10-10').map(x=>x.id),[],'not before it starts')
 assert.deepEqual(todosOn(data,'p','2026-10-16').map(x=>x.id),['slip'])
 assert.deepEqual(todosOn(data,'p','2026-10-18').map(x=>x.id),[])
})
test('ticking a weekly to-do moves it to next week; a one-off is crossed off',()=>{
 const w=tickTodo(t('clean',{due:'2026-10-17',weekly:true}),'2026-10-17')
 assert.equal(w.due,'2026-10-24');assert.equal(w.done,false)
 const late=tickTodo(t('clean',{due:'2026-10-03',weekly:true}),'2026-10-17')
 assert.equal(late.due,'2026-10-24','skips past weeks')
 const one=tickTodo(t('slip',{due:'2026-10-16'}),'2026-10-15')
 assert.equal(one.done,true)
})
test('day labels',()=>{
 assert.equal(todoDayLabel('2026-10-15','2026-10-15'),'Today');assert.equal(todoDayLabel('2026-10-16','2026-10-15'),'Tomorrow')
 assert.equal(todoDayLabel('2026-10-17','2026-10-15'),new Date('2026-10-17T12:00:00').toLocaleDateString(undefined,{weekday:'long'}))
})
console.log(passed+'/3 family to-do groups passed.')
