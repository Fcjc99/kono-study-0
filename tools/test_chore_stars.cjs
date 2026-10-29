// The star chart and meals: actual store functions, no browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const resolveLocal=name=>{const bare=name.replace(/\.js$/,''),at=path.resolve(path.dirname(file),bare);return fs.existsSync(at+'.ts')?at+'.ts':at+'.tsx'}
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(resolveLocal(name)):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console,URL,Response,AbortSignal,TextEncoder,JSON})
 return module.exports
}
let passed=0
const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
// Star chart (store/choreStars) and meals (store/meals): what a tick, an untick and a reward do.
const model=load('src/store/model.ts'),stars=load('src/store/choreStars.ts'),meals=load('src/store/meals.ts'),{tickTodo}=load('src/store/familyTodos.ts')
;(async()=>{
await test('a kid’s chore earns its stars on a tick, unticking takes them back, and a repeat earns on every turn',()=>{
 const data=model.createFreshData(),pid=data.activeProfileId
 data.kids.push({id:'kid-a',profileId:pid,name:'Ava',color:'#e0607a'})
 const once={id:'t1',profileId:pid,title:'Feed the cat',done:false,forKidId:'kid-a',stars:3}
 let log=stars.starsAfterTick([],once,tickTodo(once,'2026-10-29'))
 assert.equal(stars.balance(log,'kid-a'),3)
 const ticked=tickTodo(once,'2026-10-29');log=stars.starsAfterTick(log,ticked,tickTodo(ticked,'2026-10-29'))
 assert.equal(stars.balance(log,'kid-a'),0,'unticking takes them back')
 const weekly={id:'t2',profileId:pid,title:'Bins out',done:false,forKidId:'kid-a',due:'2026-10-27',repeat:'week',weekly:true}
 let t=weekly;log=[]
 for(let i=0;i<3;i++){const next=tickTodo(t,'2026-10-29');log=stars.starsAfterTick(log,t,next);t=next}
 assert.equal(stars.balance(log,'kid-a'),3,'1 star a turn by default')
 assert.equal(stars.starsAfterTick([],{...once,forKidId:undefined},tickTodo({...once,forKidId:undefined},'2026-10-29')).length,0,'family to-dos for everyone earn nothing')
 // The log and a chore's stars survive saving; a reward costs stars and can't go below zero.
 const saved=model.normalizeData({...data,familyTodos:[once],starLog:log,starRewards:[{id:'r1',profileId:pid,title:'Movie night',cost:2,emoji:'🎬'}]})
 assert.equal(saved.familyTodos[0].stars,3);assert.equal(saved.starLog.length,3);assert.equal(saved.starRewards[0].cost,2)
 const spent=stars.redeem(saved.starLog,'kid-a',saved.starRewards[0]);assert.equal(stars.balance(spent,'kid-a'),1)
 assert.equal(stars.redeem(spent,'kid-a',{...saved.starRewards[0],cost:5}),null,'not enough stars')
 assert.equal(model.normalizeData({...saved,starLog:[...saved.starLog,{id:'x',profileId:pid,kidId:'gone',at:new Date().toISOString(),n:5,note:''}]}).starLog.length,3,'stars for a removed kid are dropped')
})
await test('dinners: set, replace and clear a day; groceries skip repeats, tick, and clear what’s bought',()=>{
 let data=model.createFreshData();const pid=data.activeProfileId
 data=meals.setDinner(data,pid,'2026-10-29','Tacos','2026-10-29')
 data=meals.setDinner(data,pid,'2026-10-29','  Pasta ','2026-10-29')
 assert.equal(meals.dinnerOn(data,pid,'2026-10-29').title,'Pasta');assert.equal(data.meals.length,1)
 data={...data,meals:[...data.meals,{id:'old',profileId:pid,date:'2026-06-01',title:'Old',meal:'dinner'}]}
 data=meals.setDinner(data,pid,'2026-10-30','Soup','2026-10-29')
 assert.ok(!data.meals.some(m=>m.id==='old'),'two-month-old dinners are let go')
 data=meals.setDinner(data,pid,'2026-10-29','','2026-10-29')
 assert.equal(meals.dinnerOn(data,pid,'2026-10-29'),undefined,'an empty title clears the day')
 data=meals.addGroceries(data,pid,'Milk, eggs\napples, milk,  ')
 assert.equal(JSON.stringify(data.groceries.map(g=>g.title)),JSON.stringify(['Milk','eggs','apples']))
 assert.equal(meals.addGroceries(data,pid,'MILK'),data,'already on the list')
 data=meals.toggleGrocery(data,data.groceries[0].id)
 assert.equal(meals.addGroceries(data,pid,'Milk').groceries.length,4,'bought milk can go back on')
 data=meals.clearBought(data,pid)
 assert.equal(JSON.stringify(data.groceries.map(g=>g.title)),JSON.stringify(['eggs','apples']))
 const back=model.normalizeData(JSON.parse(JSON.stringify(data)))
 assert.equal(back.meals.length,1);assert.equal(back.groceries.length,2,'they survive a save')
})
console.log(passed+'/2 star chart and meal groups passed.')
})().catch(error=>{console.error('FAIL',error);process.exit(1)})
