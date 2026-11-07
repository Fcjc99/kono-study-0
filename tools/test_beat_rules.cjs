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
test('auto-sync: taps that land 180 ms late (a phone’s sound delay) give a +180 correction after a few taps',()=>{
 const a=R.createAutoSync();let fix=0
 for(let i=0;i<6;i++)fix=a.tap(180+(i%2?6:-6),2000+i*300)||fix
 assert.ok(Math.abs(fix-180)<=6,'correction '+fix);assert.equal(a.settled,false,'it checks again after correcting')
 for(let i=0;i<6;i++)assert.equal(a.tap(i%2?8:-8,5000+i*300),0)
 assert.equal(a.settled,true,'settles once taps sit on the tiles')
})
test('auto-sync: taps already on time settle it straight away; stray taps far from any tile are ignored; it stops waiting after 20 s',()=>{
 const a=R.createAutoSync();for(let i=0;i<6;i++)assert.equal(a.tap(i%2?10:-10,1000+i*200),0);assert.equal(a.settled,true)
 const b=R.createAutoSync();assert.equal(b.tap(900,1000),0);assert.equal(b.tap(NaN,1000),0);assert.equal(b.settled,false)
 b.tick(R.SYNC_SETTLE_MS+1);assert.equal(b.settled,true)
})
test('auto-sync: the nearest tile in the column, hit or not, within reach',()=>{
 const notes=R.playOf({tap:[[1000,1,60],[1300,1,62],[1200,2,64]],hold:[],sky:[],ribbon:[]},120).notes
 notes[0].hit='perfect'
 assert.equal(R.nearestIn(notes,1,1100),100);assert.equal(R.nearestIn(notes,1,1290),-10);assert.equal(R.nearestIn(notes,3,1200),null)
})
test('a miss while auto-sync settles costs no gauge (Jeff tier included); after, it does',()=>{
 const t=R.freshTally('jeff');assert.equal(R.count(t,'miss','jeff',100,{free:true}).gauge,100);assert.ok(R.count(t,'miss','jeff',100,{}).gauge<100)
})
console.log(passed+' KONO Beat rule tests passed')
