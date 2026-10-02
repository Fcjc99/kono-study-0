// KONO’s friends (src/store/konoFriends.ts): after a good week a friend visits the island for the day; once met it can go on the island (Decorate › Friends).
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
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const {FRIENDS,lastWeek,weekKind,visitorToday,visitEvent,visitEventId,friendsMet,visitLine,friendHow}=load('src/store/konoFriends.ts')
const {addCareEvent}=load('src/store/konoCare.ts')
const today='2026-10-12'
const done=(day,due=day)=>({done:true,due,completedAt:day+'T12:00:00'})
const good=[done('2026-10-06'),done('2026-10-08'),done('2026-10-11')]
const great=[...good,done('2026-10-07'),done('2026-10-09'),done('2026-10-10')]

test('a good week is 3+ things finished in the 7 days before today, at most one late; a great week 6+, none late',()=>{
 assert.deepEqual({...lastWeek(good,today)},{finished:3,late:0})
 assert.equal(weekKind(lastWeek(good,today)),'good')
 assert.equal(weekKind(lastWeek(great,today)),'great')
 assert.equal(weekKind(lastWeek([...great.slice(1),done('2026-10-06','2026-10-05')],today)),'good','one late: good, not great')
 assert.equal(weekKind(lastWeek([done('2026-10-06','2026-10-01'),done('2026-10-07','2026-10-01'),done('2026-10-08')],today)),null,'two late')
 assert.equal(weekKind(lastWeek([...good.slice(0,2),done(today)],today)),null,'today doesn’t count yet')
 assert.equal(weekKind(lastWeek([...good.slice(1),done('2026-10-04')],today)),null,'8 days ago doesn’t count')
 assert.equal(weekKind(lastWeek([...good.slice(0,2),{done:false,due:'2026-10-09'}],today)),null)
})
test('no visitor after a slow week; after a good week only the everyday friends, the shy ones after a great week',()=>{
 assert.equal(visitorToday(good.slice(0,2),[],today),null)
 const goods=new Set(),greats=new Set()
 const iso=d=>d.toISOString().slice(0,10)
 for(let d=10;d<=40;d++){const day=iso(new Date(Date.UTC(2026,10,d))),before=n=>done(iso(new Date(Date.UTC(2026,10,d-n))))
  goods.add(visitorToday([1,2,3].map(before),[],day)?.id);greats.add(visitorToday([1,2,3,4,5,6].map(before),[],day)?.id)}
 assert.ok([...goods].every(id=>FRIENDS.find(f=>f.id===id)?.tier==='good'),'good weeks bring only everyday friends')
 assert.ok(goods.size>1&&!goods.has(undefined),'a friend every good-week day')
 assert.ok([...greats].some(id=>FRIENDS.find(f=>f.id===id)?.tier==='great'),'great weeks can bring the fox or the owl')
})
test('someone new first, then any of them; the same friend all day, on every device',()=>{
 const met=FRIENDS.filter(f=>f.tier==='good'&&f.id!=='owl').slice(0,5).map((f,i)=>visitEvent('2026-09-0'+(i+1),f))
 assert.equal(visitorToday(good,met,today).id,FRIENDS.filter(f=>f.tier==='good')[5].id,'the one not met yet')
 const all=[...met,visitEvent('2026-09-06',FRIENDS[5])]
 assert.ok(visitorToday(good,all,today))
 const came=[visitEvent(today,FRIENDS[6])]
 assert.equal(visitorToday([],came,today).id,FRIENDS[6].id,'whoever came today stays, even if the week changed')
 assert.equal(visitEvent(today,FRIENDS[0]).id,visitEventId(today))
})
test('visits are saved once a day and kept for good, so friends stay met',()=>{
 const now=new Date('2026-10-12T15:00:00')
 let state=addCareEvent(undefined,'p',visitEvent(today,FRIENDS[0]),now)
 state=addCareEvent(state,'p',visitEvent(today,FRIENDS[1]),now)
 assert.equal(state.log.length,1,'a second device saving the same day keeps the first')
 state=addCareEvent(state,'p',{id:'x',kind:'pet',at:'2027-03-01T10:00:00.000Z'},new Date('2027-03-01T10:00:00'))
 assert.equal(friendsMet(state.log).get('cat'),1,'still met months later')
 assert.match(visitLine(FRIENDS[0],true),/^🐱 Mochi the cat came to visit the island! .*Decorate › Friends\.$/)
 assert.match(visitLine(FRIENDS[0],false),/visiting the island again today!$/)
 assert.match(friendHow(FRIENDS[6]),/great week/)
})
console.log(passed+' KONO friends test groups passed')
