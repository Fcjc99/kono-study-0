// KONO's phone apps (store/nativeBridge.ts): widget data and reminders scheduled on the phone, against a stand-in native layer.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
const calls=[],store=new Map()
const plugin=name=>new Proxy({},{get:(_,method)=>async options=>{calls.push({plugin:name,method,options})
 if(method==='checkPermissions')return {display:sandbox.permission};if(method==='requestPermissions'){sandbox.permission='granted';return {display:'granted'}}
 if(method==='getPending')return {notifications:[{id:7},{id:8}]};return {}}})
const sandbox={permission:'prompt',Capacitor:{isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{KonoWidget:plugin('KonoWidget'),LocalNotifications:plugin('LocalNotifications')}},
 localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))}}
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const resolveLocal=name=>{const at=path.resolve(path.dirname(file),name.replace(/\.js$/,''));return fs.existsSync(at+'.ts')?at+'.ts':at+'.tsx'}
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(resolveLocal(name)):require(name)
 const context={module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console,URL,JSON,Promise,Object,Array,Number,String,...sandbox}
 context.globalThis=context
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,context)
 return module.exports
}
let passed=0
const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
const bridge=load('src/store/nativeBridge.ts'),model=load('src/store/model.ts')
;(async()=>{
await test('widget data is trimmed to what a widget can show',()=>{
 const s=bridge.widgetSnapshot({name:'A'.repeat(90),next:[1,2,3,4].map(i=>({title:'T'.repeat(200)+i,why:'w'})),today:{done:1,left:2},kono:{mood:'happy',line:'L'.repeat(300),full:79.6,happy:12.2,asleep:false}},new Date('2026-10-28T12:00:00Z'))
 assert.equal(s.updated,'2026-10-28T12:00:00.000Z');assert.equal(s.name.length,40);assert.equal(s.next.length,3);assert.equal(s.next[0].title.length,80);assert.equal(s.kono.line.length,90);assert.equal(s.kono.full,80);assert.equal(s.kono.happy,12)
})
await test('reminder ids are positive 32-bit numbers, the same for the same reminder',()=>{
 const a=bridge.reminderId('week-2026-10-26'),b=bridge.reminderId('week-2026-10-26'),c=bridge.reminderId('task-1')
 assert.equal(a,b);assert.notEqual(a,c);assert.ok(a>0&&a<2**31)
})
await test('reminders: permission is asked once, old ones are cleared, and the plan’s next reminders are scheduled on the phone',async()=>{
 const data=model.createFreshData(),pid=data.activeProfileId,now=new Date('2026-10-26T08:00:00')
 data.tasks.push({id:'task-1',profileId:pid,subjectId:'',title:'Lab report',due:'2026-10-28',done:false,notes:''})
 const n=await bridge.scheduleReminders(data,now)
 assert.ok(n>0,'something to remind about')
 const methods=calls.map(c=>c.method)
 assert.deepEqual(methods.slice(0,2),['checkPermissions','requestPermissions'])
 const cancel=calls.find(c=>c.method==='cancel');assert.equal(JSON.stringify(cancel.options),JSON.stringify({notifications:[{id:7},{id:8}]}))
 const sched=calls.find(c=>c.method==='schedule').options.notifications
 assert.equal(sched.length,n);assert.ok(sched.every(x=>x.schedule.at instanceof Date&&x.schedule.at>now&&x.id>0&&x.title))
 assert.ok(sched.some(x=>/Lab report/.test(x.body+x.title)),'the assignment is in a reminder')
 // Turned down: never asked again.
 calls.length=0;sandbox.permission='prompt';store.set('kono-native-reminders-asked','1')
 assert.equal(await bridge.scheduleReminders(data,now),0)
 assert.ok(!calls.some(c=>c.method==='requestPermissions'||c.method==='schedule'))
})
console.log(passed+'/3 phone-app groups passed.')
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
