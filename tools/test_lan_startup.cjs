const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),webcrypto=require('node:crypto').webcrypto
// Reproduce HTTP LAN: cryptographic bytes exist, but randomUUID does not.
const crypto={getRandomValues:array=>webcrypto.getRandomValues(array)}
function load(file){
 file=path.resolve(root,file)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const local=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':'.ts'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:local,crypto,console,Date,Intl,structuredClone})
 return module.exports
}
const {randomId,createFreshData,normalizeData}=load('src/store/model.ts')
const ids=Array.from({length:1000},()=>randomId())
assert.equal(new Set(ids).size,1000)
ids.forEach(id=>assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/))
const data=normalizeData(createFreshData())
assert.ok(data.profiles.some(p=>p.id===data.activeProfileId))
crypto.randomUUID=()=> 'native-uuid'
assert.equal(randomId(),'native-uuid')
console.log('PASS HTTP LAN startup, valid v4 IDs, 1000 distinct IDs, profile initialization, native UUID path.')
