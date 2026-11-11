// KONO Teeter Tower: the pieces, and how high a tower counts as.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const cache=new Map()
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:requireLocal,Math,Date,JSON,Set,Map,Number,String,Object,Array,console,localStorage:{getItem:()=>null,setItem(){}}})
 return module.exports
}
const {SHAPES,COLORS,towerHeight,SPECIALS,specialFor,seeded,dailySeed,puzzleLevel,isPerfect,lockLine,SKINS,skinsOwned,skinItem,dailyScoreEvent,familyBoard,EVENTS,EVENT_BLOCKS,eventFor}=load('src/store/teeter.ts')
const {addCareEvent,readCareState}=load('src/store/konoCare.ts')
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
test('seven pieces of four blocks each, no block twice, each with its own color',()=>{
 assert.equal(Object.keys(SHAPES).length,7)
 for(const [id,cells] of Object.entries(SHAPES)){assert.equal(cells.length,4,id);assert.equal(new Set(cells.map(c=>c.join())).size,4,id);assert.match(COLORS[id],/^#[0-9a-f]{6}$/)}
 assert.equal(new Set(Object.values(COLORS)).size,7)
})
test('the height is the top of the highest block at rest, in whole blocks; a moving block does not count yet',()=>{
 assert.equal(towerHeight([],560,26),0)
 assert.equal(towerHeight([{top:560-26*3,speed:0}],560,26),3)
 assert.equal(towerHeight([{top:560-26*3,speed:0},{top:560-26*8,speed:2}],560,26),3)
 assert.equal(towerHeight([{top:560-26*5+2,speed:0.1}],560,26),5) // a block tipped a little still counts
 assert.equal(towerHeight([{top:600,speed:0}],560,26),0) // fallen below the island
})
test('special blocks: none in the first four, then about one in six; each has an emoji, name and color',()=>{
 const r=seeded('x');for(let i=0;i<4;i++)assert.equal(specialFor(r,i),null)
 let n=0;for(let i=0;i<2000;i++)if(specialFor(r,10))n++
 assert.ok(n>250&&n<470,'about 18% special, got '+n)
 for(const v of Object.values(SPECIALS)){assert.ok(v.emoji&&v.name);assert.match(v.color,/^#[0-9a-f]{6}$/)}
})
test('today’s tower: the same seed gives the same blocks, another day different ones; the seed is the local date',()=>{
 const a=seeded('teeter 2026-11-10'),b=seeded('teeter 2026-11-10'),c=seeded('teeter 2026-11-11')
 const take=r=>Array.from({length:8},()=>r())
 const x=take(a);assert.deepEqual(x,take(b));assert.notDeepEqual(x,take(c))
 assert.ok(x.every(v=>v>=0&&v<1))
 assert.equal(dailySeed(new Date(2026,0,5,23,30)),'2026-01-05')
})
test('puzzle levels get taller and tighter, and always give at least one spare block',()=>{
 let prev=puzzleLevel(1);assert.deepEqual({...prev},{goal:5,blocks:10})
 for(let n=2;n<=40;n++){const l=puzzleLevel(n);assert.ok(l.goal>=prev.goal&&l.goal<=30);assert.ok(l.blocks>l.goal,'level '+n);prev=l}
})
test('a Perfect is a block that settled where and how it was let go',()=>{
 assert.ok(isPerfect({x:100,angle:0},{x:101.5,angle:0.01}))
 assert.ok(!isPerfect({x:100,angle:0},{x:106,angle:0}))
 assert.ok(!isPerfect({x:100,angle:0},{x:100,angle:0.2}))
})
test('every ten rows the base turns to stone, leaving the top three rows loose',()=>{
 assert.equal(lockLine(9,560,26),null)
 assert.equal(lockLine(10,560,26),560-7*26)
 assert.equal(lockLine(23,560,26),560-17*26)
})
test('skins: pastel is free and always owned; a bought skin ("skin:jelly" in the care log) is owned for good',()=>{
 assert.deepEqual([...skinsOwned([])],['pastel'])
 const owned=skinsOwned([{kind:'buy',item:'skin:jelly'},{kind:'buy',item:'food:cookie'},{kind:'buy',item:'skin:nope'}])
 assert.ok(owned.has('jelly')&&owned.has('pastel')&&!owned.has('nope'))
 const it=skinItem('rainbow');assert.equal(it.key,'skin:rainbow');assert.equal(it.kind,'skin');assert.equal(it.price,SKINS.find(x=>x.id==='rainbow').price)
 assert.equal(SKINS[0].price,0)
})
test('today’s family board: one score a day per player, replaced only by a better one; sorted highest first',()=>{
 const now=new Date('2026-11-10T18:00:00Z'),seed='2026-11-10'
 let a=addCareEvent(undefined,'a',dailyScoreEvent(seed,7,now),now)
 a=addCareEvent(a,'a',dailyScoreEvent(seed,5,now),now)
 assert.equal(a.log.filter(e=>e.kind==='score').length,1);assert.equal(a.log.find(e=>e.kind==='score').n,7)
 a=addCareEvent(a,'a',dailyScoreEvent(seed,12,now),now)
 assert.equal(a.log.filter(e=>e.kind==='score').length,1);assert.equal(a.log.find(e=>e.kind==='score').n,12)
 const b=addCareEvent(undefined,'b',dailyScoreEvent(seed,9,now),now)
 const old=addCareEvent(undefined,'c',dailyScoreEvent('2026-11-09',30,now),now)
 const board=familyBoard([{id:'a',name:'Ava'},{id:'b',name:'Ben',avatar:'🐻'},{id:'c',name:'Cy'}],{a,b,c:old},seed,'b')
 assert.deepEqual(board.map(r=>[r.name,r.height,r.me]),[['Ava',12,false],['Ben',9,true]])
})
test('a score survives a save and reload; a malformed one is dropped',()=>{
 const now=new Date('2026-11-10T18:00:00Z')
 const st=addCareEvent(undefined,'a',dailyScoreEvent('2026-11-10',4,now),now)
 const back=readCareState(JSON.parse(JSON.stringify(st)),'a')
 assert.equal(back.log.find(e=>e.kind==='score').n,4)
 const bad=readCareState({log:[{id:'x',kind:'score',at:now.toISOString(),item:'teeter:soon',n:3},{id:'y',kind:'score',at:now.toISOString(),item:'teeter:2026-11-10',n:-1}]},'a')
 assert.equal(bad.log.length,0)
})
test('tower events: none before the sixth block or within eight blocks of the last; then about one block in three, lasting three blocks',()=>{
 const r=seeded('ev')
 for(let b=0;b<6;b++)assert.equal(eventFor(r,b,-99),null)
 for(let b=10;b<18;b++)assert.equal(eventFor(r,b,10),null)
 let n=0;const kinds=new Set();for(let i=0;i<3000;i++){const e=eventFor(r,30,0);if(e){n++;kinds.add(e)}}
 assert.ok(n>900&&n<1200,'about 35%, got '+n);assert.deepEqual([...kinds].sort(),['big','hurry','slippery'])
 assert.equal(EVENT_BLOCKS,3);for(const v of Object.values(EVENTS))assert.ok(v.emoji&&v.name&&v.line)
})
test('the jelly block is one of the specials',()=>{assert.equal(SPECIALS.jelly.emoji,'🍮');assert.match(SPECIALS.jelly.color,/^#[0-9a-f]{6}$/)})
console.log(passed+' teeter tests passed')
