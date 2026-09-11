// Actual application functions with isolated fixtures; no browser or user-data writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':'.ts'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console})
 return module.exports
}
const {createFreshData,normalizeData}=load('src/store/model.ts'),{deleteProfile}=load('src/store/deleteProfile.ts'),{captureDeletions}=load('src/store/workspace.ts')
const a=createFreshData(),b=createFreshData(),id=a.activeProfileId,other=b.activeProfileId
const data=normalizeData({...a,profiles:[...a.profiles,...b.profiles],studySeasons:[...a.studySeasons,...b.studySeasons],tasks:[{id:'mine',profileId:id,subjectId:'',title:'Mine',due:'2026-09-10',done:false,notes:''},{id:'theirs',profileId:other,subjectId:'',title:'Keep',due:'2026-09-10',done:false,notes:''}],sanctuaryProgress:{...a.sanctuaryProgress,...b.sanctuaryProgress}})
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
console.log('PASS profile deletion: exact scope, active fallback, other work preserved, missing/last profile guarded, no invalid trash, original unmodified.')
