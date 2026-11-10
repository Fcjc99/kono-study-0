// KONO Teeter Tower: the pieces, and how high a tower counts as.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const load=relative=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Math});return module.exports}
const {SHAPES,COLORS,towerHeight,SPECIALS,specialFor,seeded,dailySeed,puzzleLevel,isPerfect,lockLine}=load('src/store/teeter.ts')
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
console.log(passed+' teeter tests passed')
