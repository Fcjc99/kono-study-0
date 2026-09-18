// Mirrors tools/test_time_blocking.cjs's loader: real TS transpile + a fresh VM per module, recursive
// relative-import resolution, real npm packages for anything non-relative. 'react' resolves to {} since
// isTimeBlockDue is a plain function that never calls useEffect -- it's never invoked here.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto')
const root=path.resolve(__dirname,'..'),deps=path.join(root,'node_modules')
const ts=require(path.join(deps,'typescript'))
const modules=new Map()
function load(rel){
 if(modules.has(rel))return modules.get(rel)
 const file=path.join(root,rel),source=fs.readFileSync(file,'utf8')
 const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,mod={exports:{}}
 const requireIn=name=>name==='react'?{}:!name.startsWith('.')?require(path.join(deps,name)):load(path.normalize(path.join(path.dirname(rel),name+'.ts')))
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:requireIn,crypto:{randomUUID},console,Date,Math,Set,Map,Object,Promise,structuredClone})
 modules.set(rel,mod.exports);return mod.exports
}
const {isTimeBlockDue}=load('src/hooks/useDueNotifications.ts')

const tests=[]
function test(name,fn){tests.push({name,fn})}

const TODAY='2026-09-18'
const item=(overrides)=>({due:TODAY,done:false,plannedTime:'09:00',...overrides})
const minutes=(h,m)=>h*60+m

test('due right at the planned time',()=>{
 assert.equal(isTimeBlockDue(item(),TODAY,minutes(9,0)),true)
})

test('still due up to 15 minutes after the planned time',()=>{
 assert.equal(isTimeBlockDue(item(),TODAY,minutes(9,15)),true)
})

test('no longer due 16 minutes after the planned time',()=>{
 assert.equal(isTimeBlockDue(item(),TODAY,minutes(9,16)),false)
})

test('not due before the planned time arrives',()=>{
 assert.equal(isTimeBlockDue(item(),TODAY,minutes(8,59)),false)
})

test('a completed task is never due, even at its planned time',()=>{
 assert.equal(isTimeBlockDue(item({done:true}),TODAY,minutes(9,0)),false)
})

test('a task with no planned time is never due',()=>{
 assert.equal(isTimeBlockDue(item({plannedTime:undefined}),TODAY,minutes(9,0)),false)
})

test('a task due on a different day is never due today, regardless of the clock',()=>{
 assert.equal(isTimeBlockDue(item({due:'2026-09-19'}),TODAY,minutes(9,0)),false)
})

test('a tab opened hours later does not surface a long-past block',()=>{
 assert.equal(isTimeBlockDue(item({plannedTime:'07:00'}),TODAY,minutes(18,0)),false)
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} time-block-notification regression groups passed.`)
