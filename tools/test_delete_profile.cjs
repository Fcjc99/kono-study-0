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
const {createFreshData,normalizeData}=load('src/store/model.ts'),{deleteProfile}=load('src/store/deleteProfile.ts'),{captureDeletions}=load('src/store/workspace.ts')
const a=createFreshData(),b=createFreshData(),id=a.activeProfileId,other=b.activeProfileId
const season=(sid,pid)=>({id:sid,profileId:pid,name:'Fall',start:'2026-09-01',end:'2026-12-20',active:true,week:{Sunday:[],Monday:[],Tuesday:[],Wednesday:[],Thursday:[],Friday:[],Saturday:[]}})
const data=normalizeData({...a,profiles:[...a.profiles,...b.profiles],studySeasons:[season('s-mine',id),season('s-theirs',other)],tasks:[{id:'mine',profileId:id,subjectId:'',title:'Mine',due:'2026-09-10',done:false,notes:''},{id:'theirs',profileId:other,subjectId:'',title:'Keep',due:'2026-09-10',done:false,notes:''}],sanctuaryProgress:{...a.sanctuaryProgress,...b.sanctuaryProgress}})
const next=normalizeData(captureDeletions(data,deleteProfile(data,id)))
assert.equal(next.activeProfileId,other)
assert.equal(next.profiles.length,1)
assert.equal(next.tasks.length,1)
assert.equal(next.tasks[0].id,'theirs')
assert.equal(next.studySeasons[0].profileId,other)
assert.equal(next.trash.length,0)
assert.equal(data.tasks.length,2)
assert.throws(()=>deleteProfile(a,id),/last plan/)
assert.throws(()=>deleteProfile(data,'missing'),/no longer/)
assert.equal(deleteProfile(data,other).activeProfileId,id)
// A family: deleting the family plan moves the kids to another own plan; their own plans stay linked.
const kidPlan={id:'kid-plan',name:'Emma',label:'Emma’s plan',kind:'school',start:'2026-09-01',end:'2027-06-30',kidId:'k1'}
const fam=normalizeData({...data,profiles:[...data.profiles,kidPlan],kids:[{id:'k1',profileId:id,name:'Emma',color:'#6a8fc7'}],tasks:[...data.tasks,{id:'tag',profileId:other,subjectId:'',kidId:'k1',title:'Tagged',due:'2026-09-10',done:false,notes:''}]})
const moved=deleteProfile(fam,id)
assert.equal(moved.kids[0].profileId,other,'the kids move to the other plan')
assert.equal(moved.profiles.find(p=>p.id==='kid-plan').kidId,'k1','Emma’s plan stays hers')
assert.equal(moved.tasks.find(t=>t.id==='tag').kidId,'k1')
// Only kid plans left: the kid goes and their plan becomes an ordinary plan.
const lone=normalizeData({...a,profiles:[...a.profiles,kidPlan],kids:[{id:'k1',profileId:id,name:'Emma',color:'#6a8fc7'}]})
const solo=deleteProfile(lone,id)
assert.equal(solo.kids.length,0);assert.equal(solo.profiles[0].kidId,undefined);assert.equal(solo.activeProfileId,'kid-plan')
console.log('PASS profile deletion: exact scope, active fallback, other work preserved, missing/last profile guarded, no invalid trash, original unmodified; a family plan’s kids move to another plan.')
