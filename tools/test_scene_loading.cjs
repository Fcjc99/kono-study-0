const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const ROOT = path.resolve(__dirname, '..')
const ts = require(path.join(ROOT, 'node_modules/typescript'))
const Emitter = require(path.join(ROOT, 'node_modules/eventemitter3'))
const cache = new Map()
const phaser = { Scene: class {}, Math: { Clamp: (v,a,b)=>Math.max(a,Math.min(b,v)), DegToRad:v=>v*Math.PI/180 }, Geom: { Rectangle: class {} }, Loader: { Events: { ADD:'addfile', COMPLETE:'complete' } }, Scenes: { Events: { DESTROY:'destroy', SHUTDOWN:'shutdown' } } }
function load(file) {
  if(cache.has(file)) return cache.get(file).exports
  const m={exports:{}}; cache.set(file,m)
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const req=id=>id==='phaser'?{__esModule:true,default:phaser}:id.startsWith('.')?load(path.resolve(path.dirname(file),id)+'.ts'):require(path.join(ROOT,'node_modules',id))
  new vm.Script('(function(require,module,exports){'+js+'\n})',{filename:file}).runInThisContext()(req,m,m.exports)
  return m.exports
}
const Scene=load(path.join(ROOT,'src/game/scenes/Stage0Scene.ts')).default
const events=load(path.join(ROOT,'src/game/sanctuary/runtime.ts')).SANCTUARY_EVENTS
function setup(phase='afternoon') {
  const scene=Object.create(Scene.prototype)
  const textures=new Set(), requests=[], queued=new Map(), batches=[], statuses=[], commits=[]
  const loader=new Emitter()
  loader.image=(key,url)=>{
    if(!textures.has(key)&&!queued.has(key)) { queued.set(key,url);requests.push({key,url});loader.emit('addfile',key,'image',loader) }
    return loader
  }
  loader.start=()=>{batches.push([...queued.keys()]);return loader}
  const gameEvents=new Emitter();gameEvents.on(events.load,p=>statuses.push(p))
  Object.assign(scene,{load:loader,events:new Emitter(),game:{events:gameEvents},registry:{get:key=>key==='sanctuaryPhase'?phase:undefined},settings:{phaseMode:'auto',debugMinutes:null},readyPhases:new Set(),failedPhases:new Set(),pendingBlend:null,loadingPhase:null,loadingImageKeys:[],bootImageKeys:[],phaseGateDisposed:false,sceneReady:false,textures:{exists:key=>textures.has(key)},commitBlend:(blend,daylight)=>commits.push({phase:blend.dominant,daylight})})
  const finish=(missing=[])=>{for(const key of queued.keys())if(!missing.includes(key))textures.add(key);queued.clear();loader.emit('complete',loader)}
  const boot=()=>{scene.preload();finish();scene.readyPhases.add(scene.paintedPhase)}
  const request=(phase,daylight=1)=>scene.applyBlend({dominant:phase,from:phase,to:phase,amount:0},daylight,false)
  return {scene,requests,queued,batches,statuses,commits,textures,loader,finish,boot,request}
}
const tests=[]
function test(name,body){body();tests.push(name)}
test('Every manual boot requests exactly one phase, 212 textures, existing packaged assets',()=>{
  for(const phase of ['morning','afternoon','evening','night']){
    const s=setup(phase);s.scene.preload()
    assert.equal(s.scene.paintedPhase,phase)
    assert.equal(s.requests.length,212)
    for(const req of s.requests){
      assert.equal(fs.existsSync(path.join(ROOT,'dist/client',req.url)),true,req.url)
      const match=req.url.match(/morning|afternoon|evening|night/)
      if(match)assert.equal(match[0],phase,req.url)
    }
    assert.equal(s.scene.bootImageKeys.length,212)
  }
})
test('Missing boot image emits error and update safely does nothing',()=>{
  const s=setup('night');s.scene.preload();s.finish([s.scene.bootImageKeys[0]])
  s.scene.create();s.scene.update(0,16)
  assert.equal(s.scene.sceneReady,false)
  assert.deepEqual(s.statuses.at(-1),{status:'error',phase:'night',boot:true})
})
test('A -> B -> A never commits stale B; B pack has only 63 uncached textures',()=>{
  const s=setup();s.boot();s.request('night');s.request('afternoon');s.finish()
  assert.equal(s.batches[0].length,63)
  assert.deepEqual(s.commits.map(x=>x.phase),['afternoon'])
  assert.equal(s.scene.readyPhases.has('night'),true)
})
test('A -> B -> C serializes batches and commits only C',()=>{
  const s=setup();s.boot();s.request('night');s.request('morning');s.finish()
  assert.equal(s.commits.length,0);assert.equal(s.batches.length,2)
  s.finish();assert.deepEqual(s.commits.map(x=>x.phase),['morning'])
})
test('Automatic repeated same-phase requests preserve latest daylight',()=>{
  const s=setup();s.boot();s.request('night',0.2);s.request('night',0.1);s.finish()
  assert.equal(s.batches.length,1);assert.deepEqual(s.commits,[{phase:'night',daylight:0.1}])
})
test('Missing runtime image blocks switch, suppresses retry loop, retry fetches one image',()=>{
  const s=setup();s.boot();s.request('night');const missing=s.batches[0][0]
  s.finish([missing]);s.request('night');s.request('night')
  assert.equal(s.commits.length,0);assert.equal(s.batches.length,1)
  assert.equal(s.statuses.at(-1).status,'error')
  s.scene.handlePhaseRetry();assert.deepEqual(s.batches[1],[missing]);s.finish()
  assert.deepEqual(s.commits.map(x=>x.phase),['night'])
})
test('DESTROY invalidates pending phase completion',()=>{
  const s=setup();s.boot();s.request('night');s.scene.events.emit('destroy');s.finish()
  assert.equal(s.commits.length,0)
})
test('Staged SHUTDOWN cleanup removes pending completion and runs systems only once',()=>{
  const s=setup();s.boot();s.request('night')
  const destroyed=[]
  const names=['konoInteractions','konoMascot','fluid','clouds','atmosphere','vegetation','lighting','weatherSystem','pondEvolution','homeEvolution','gardenEvolution','critters','evolutionCoordinator','evolution']
  for(const name of names)s.scene[name]={destroy:()=>destroyed.push(name)}
  Object.assign(s.scene,{systemsDisposed:false,sceneReady:true,scale:{off(){}},tweens:{killAll(){}},ambientSprites:new Set(),popupObjects:[]})
  s.scene.events.once('shutdown',s.scene.handleShutdown,s.scene)
  s.scene.events.emit('shutdown')
  assert.equal(s.loader.listenerCount('complete'),0)
  assert.equal(s.scene.sceneReady,false)
  assert.equal(s.scene.phaseGateDisposed,true)
  assert.equal(s.scene.pendingBlend,null)
  assert.deepEqual(destroyed,names)
  s.scene.handleShutdown();s.finish()
  assert.deepEqual(destroyed,names)
  assert.equal(s.commits.length,0)
})
console.log(JSON.stringify({passed:true,scope:'Actual staged scene preload/gate methods with mocked loader/renderer; not browser integration.',tests},null,2))
