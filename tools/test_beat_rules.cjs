// KONO Beat's rules (src/store/rhythm.ts): charts to plays (with each tile's melody pitch), judging taps,
// and Classic's wrong-column check.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
function load(relative){
 const file=path.resolve(root,relative),module={exports:{}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,Math,JSON,localStorage:{getItem:()=>null,setItem(){}}})
 return module.exports
}
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const R=load('src/store/rhythm.ts')
const charts=JSON.parse(fs.readFileSync(path.join(root,'src/game/data/rhythmCharts.json'),'utf8')).songs

test('every chart note carries its melody pitch (MIDI E3-E6), taps and long tiles alike',()=>{
 for(const s of charts)for(const [lv,c] of Object.entries(s.charts)){
  const p=R.playOf(c,s.bpm)
  assert.ok(p.notes.length>20,s.id+' '+lv)
  for(const n of p.notes)assert.ok(Number.isInteger(n.midi)&&n.midi>=52&&n.midi<=88,s.id+' '+lv+' '+JSON.stringify(n))
  assert.ok(p.notes.every((n,i)=>!i||p.notes[i-1].t<=n.t),'in time order')
 }
})
test('a long tile keeps its pitch and end',()=>{
 const p=R.playOf({tap:[[1000,0,60]],hold:[[2000,2,3000,67]],sky:[],ribbon:[]},120)
 assert.deepEqual(JSON.parse(JSON.stringify(p.notes.map(n=>[n.kind,n.midi,n.end??null]))),[['tap',60,null],['hold',67,3000]])
 assert.ok(p.ticks.length>=3&&p.total===2+p.ticks.length)
})
test('judging: windows by level, the nearest waiting tile in the column',()=>{
 assert.equal(R.judge(30,'easy'),'perfect');assert.equal(R.judge(-100,'easy'),'great');assert.equal(R.judge(200,'easy'),'miss')
 const notes=R.playOf({tap:[[1000,1,60],[1500,1,62]],hold:[],sky:[],ribbon:[]},120).notes
 assert.equal(R.hitIn(notes,1,1040,'medium'),0);assert.equal(R.hitIn(notes,2,1040,'medium'),-1);assert.equal(R.hitIn(notes,1,1250,'medium'),-1)
 notes[0].hit='perfect';assert.equal(R.hitIn(notes,1,1450,'medium'),1)
})
test('Classic: a tap on the wrong column while a tile waits elsewhere; an empty board or a tile in the column is fine',()=>{
 const notes=R.playOf({tap:[[1000,1,60],[3000,3,64]],hold:[],sky:[],ribbon:[]},120).notes
 assert.equal(R.wrongColumn(notes,0,1000,'medium'),true)
 assert.equal(R.wrongColumn(notes,1,1000,'medium'),false)
 assert.equal(R.wrongColumn(notes,0,2000,'medium'),false,'nothing near: tapping along is free')
 notes[0].hit='great';assert.equal(R.wrongColumn(notes,0,1000,'medium'),false,'a tile already hit doesn’t count')
})
test('Classic and Tap notes settings: Tap notes on unless turned off, Classic off unless turned on',()=>{
 assert.equal(R.readKeys(),true);assert.equal(R.readClassic(),false)
})
test('a miss while auto-sync settles costs no gauge (Jeff tier included); after, it does',()=>{
 const t=R.freshTally('jeff');assert.equal(R.count(t,'miss','jeff',100,{free:true}).gauge,100);assert.ok(R.count(t,'miss','jeff',100,{}).gauge<100)
})
test('Timing suggestion after a song: the middle of the hits, to the nearest 5 ms; nothing with too few hits or when already close',()=>{
 assert.equal(R.timingDrift(Array(20).fill(62)),60);assert.equal(R.timingDrift(Array(20).fill(-88)),-90)
 assert.equal(R.timingDrift(Array(11).fill(80)),null,'too few hits to tell')
 assert.equal(R.timingDrift([...Array(15).fill(10),...Array(5).fill(200)]),null,'the middle is close: a few wild taps don’t count')
 assert.equal(R.timingDrift(Array(20).fill(900)),300,'never past ±300')
})
console.log(passed+' KONO Beat rule tests passed')
