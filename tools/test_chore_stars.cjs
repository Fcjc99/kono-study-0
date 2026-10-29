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
await test('you, also listed as a kid: found by first name, and merged back into Me without losing anyone else',()=>{
 const sk=load('src/store/selfKid.ts'),data=model.createFreshData(),pid=data.activeProfileId
 data.profiles[0].name='Jeffrey Chang'
 data.kids.push({id:'kid-j',profileId:pid,name:'Jeffrey',color:'#888'},{id:'kid-s',profileId:pid,name:'Sylvie',color:'#e0607a'})
 assert.equal(sk.selfKid(data,data.profiles[0]).id,'kid-j')
 data.calendarEvents.push({id:'e1',profileId:pid,date:'2026-10-29',title:'Dinner',kind:'personal',notes:'',done:false,kidId:'kid-j',kidIds:['kid-j','kid-s']},{id:'e2',profileId:pid,date:'2026-10-29',title:'Gym',kind:'personal',notes:'',done:false,kidId:'kid-j'},{id:'e3',profileId:pid,date:'2026-10-29',title:'Ballet',kind:'personal',notes:'',done:false,kidId:'kid-s',kidIds:['kid-s','kid-j']})
 data.daysOff=[{id:'d1',profileId:pid,date:'2026-10-30',kidIds:['kid-j'],reason:'sick'},{id:'d2',profileId:pid,date:'2026-10-31',kidIds:['kid-j','kid-s'],reason:'off'}]
 const out=model.normalizeData(JSON.parse(JSON.stringify(sk.mergeSelfKid(data,'kid-j'))))
 const ev=id=>out.calendarEvents.find(e=>e.id===id)
 assert.equal(ev('e1').kidId,'kid-s','Sylvie keeps her dinner');assert.equal(ev('e1').kidIds,undefined)
 assert.equal(ev('e2').kidId,undefined,'Gym is yours now');assert.equal(ev('e3').kidId,'kid-s')
 assert.equal(JSON.stringify(out.daysOff.map(d=>[d.id,d.kidIds])),JSON.stringify([['d2',['kid-s']]]),'a sick day just for you goes; a shared day off stays for Sylvie')
 assert.equal(out.kids.length,1);assert.equal(sk.selfKid(out,out.profiles[0]),undefined)
 data.profiles.push({...data.profiles[0],id:'p-kid',kidId:'kid-j'})
 assert.equal(sk.selfKid(data,data.profiles[0]),undefined,'not when that kid has a plan of their own')
})
await test('adding to a day: last weeks’ events on that weekday, newest first, one per name, none already there',()=>{
 const mem=load('src/store/eventMemory.ts'),pid='p'
 const ev=(id,date,title,time)=>({id,profileId:pid,date,title,kind:'activity',notes:'',done:false,...(time?{time}:{})})
 const data={calendarEvents:[ev('a','2026-10-22','Soccer','16:00'),ev('b','2026-10-15','soccer','15:00'),ev('c','2026-10-15','Piano','18:00'),ev('d','2026-10-29','Piano','18:00'),ev('e','2026-10-21','Art','10:00'),{...ev('f','2026-10-22','Gym','07:00'),profileId:'other'}]}
 const out=mem.sameWeekdayBefore(data,pid,'2026-10-29')
 assert.equal(JSON.stringify(out.map(r=>[r.title,r.time])),JSON.stringify([['Soccer','16:00']]),'Piano is already on the day; a Wednesday and another plan’s event don’t count')
})
await test('Kids view: pictures for events, routines earn stars once a day (and give them back), stickers toggle, all survive a save',()=>{
 const kp=load('src/store/kidPlanner.ts');let data=model.createFreshData();const pid=data.activeProfileId
 assert.equal(kp.pictureFor('Soccer practice'),'⚽');assert.equal(kp.pictureFor('Dentist checkup'),'🦷');assert.equal(kp.pictureFor('Zzz','appointment'),'🩺');assert.equal(kp.pictureFor('Something'),'📌')
 data.kids.push({id:'kid-a',profileId:pid,name:'Ava',color:'#e0607a'})
 const r=kp.routineFrom(kp.STARTER_ROUTINES[0],pid,'kid-a');data={...data,routines:[r]}
 let earned=0
 for(const st of r.steps){const out=kp.tickStep(data,r,'2026-10-29',st.id);data=out.data;earned+=out.earned}
 assert.equal(earned,1);assert.equal(stars.balance(data.starLog,'kid-a'),1)
 data=kp.tickStep(data,r,'2026-10-29',r.steps[0].id).data
 assert.equal(stars.balance(data.starLog,'kid-a'),0,'unticking a step takes the star back')
 data=kp.tickStep(data,r,'2026-10-29',r.steps[0].id).data
 assert.equal(stars.balance(data.starLog,'kid-a'),1,'finishing again pays once')
 assert.equal(kp.tickStep(data,r,'2026-10-30',r.steps[0].id).earned,0,'a new day starts fresh')
 data=kp.setSticker(data,pid,'2026-10-29','🏆','kid-a');data=kp.setSticker(data,pid,'2026-10-29','🌈','kid-a')
 assert.equal(JSON.stringify(kp.stickersOn(data,pid,'2026-10-29').map(x=>x.emoji)),'["🌈"]','one sticker a day per person')
 assert.equal(kp.stickersOn(kp.setSticker(data,pid,'2026-10-29','🌈','kid-a'),pid,'2026-10-29').length,0,'the same one again takes it off')
 const back=model.normalizeData(JSON.parse(JSON.stringify(data)))
 assert.equal(back.routines.length,1);assert.equal(back.routines[0].steps.length,5);assert.equal(back.routineLog.length,1);assert.equal(back.dayStickers.length,1)
 assert.equal(kp.sayTime('16:00'),"At 4 o'clock in the afternoon");assert.equal(kp.sayTime('08:30'),'At 8:30 in the morning')
})
console.log(passed+'/5 star chart, meal, family, calendar and Kids view groups passed.')
})().catch(error=>{console.error('FAIL',error);process.exit(1)})
