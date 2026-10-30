// Your own Home page (src/store/homeLayout.ts): the widgets' order and which are hidden, kept as one line.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const file=path.resolve(__dirname,'../src/store/homeLayout.ts'),mod={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Set})
const h=mod.exports
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
test('the default Home: Sanctuary, the family schedule, the schedule, the next 7 days, then notes; the week strip is off (This week shows the same days)',()=>{
 const l=h.readLayout('')
 assert.equal(l.order.slice(0,6).join(),'week,sanctuary,family,schedule,weekAhead,notes')
 assert.deepEqual([...l.hidden],['week']);assert.ok(h.isDefault(l))
 assert.equal(h.writeLayout(l),h.DEFAULT_LINE)
})
test('a saved order and hidden widgets come back as saved; unknown and repeated names are dropped',()=>{
 const l=h.readLayout('notes,-sanctuary,schedule,bogus,notes,week,family,weekAhead,todos,comingUp,focus')
 assert.equal(l.order.join(),'notes,sanctuary,schedule,week,family,weekAhead,todos,meals,comingUp,focus')
 assert.ok(l.hidden.has('sanctuary'));assert.equal(l.hidden.size,1)
 assert.equal(h.writeLayout(l),'notes,-sanctuary,schedule,week,family,weekAhead,todos,meals,comingUp,focus')
 assert.ok(!h.isDefault(l))
})
test('a widget the saved line doesn’t know yet joins after the one before it in the default order',()=>{
 const l=h.readLayout('schedule,sanctuary,week')
 assert.equal(l.order.join(),'schedule,weekAhead,notes,todos,meals,comingUp,focus,sanctuary,family,week','each new one follows the nearest one before it: the next 7 days after the schedule, the family schedule after Sanctuary')
})
console.log(passed+'/'+passed+' home layout checks passed.')
