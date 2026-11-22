// KONO Beat's rules (src/store/rhythm.ts): charts to plays (with each tile's melody pitch), judging taps,
// and Classic's wrong-column check.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
// This device's storage for the store (empty at the start; the settings test fills it, then empties it).
const mem=new Map(),storage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)}
function load(relative){
 const file=path.resolve(root,relative),module={exports:{}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,Math,JSON,localStorage:storage})
 return module.exports
}
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const R=load('src/store/rhythm.ts')
const charts=JSON.parse(fs.readFileSync(path.join(root,'src/game/data/rhythmCharts.json'),'utf8')).songs

const SUNG=['beijing-delai','casa-fantasma','peanut-butter-delai']
test('every chart note carries its pitch (MIDI E3-E6), taps and long tiles alike; only a sung song has notes with none (0: a rapped word or a beat between lines, which plays a tick)',()=>{
 for(const s of charts)for(const [lv,c] of Object.entries(s.charts)){
  const p=R.playOf(c,s.bpm),sung=SUNG.includes(s.id)
  assert.ok(p.notes.length>20,s.id+' '+lv)
  for(const n of p.notes)assert.ok(Number.isInteger(n.midi)&&(n.midi>=52&&n.midi<=88||sung&&n.midi===0),s.id+' '+lv+' '+JSON.stringify(n))
  if(sung)assert.ok(p.notes.some(n=>n.midi>0)&&p.notes.some(n=>n.midi===0),s.id+' '+lv+': sung notes and ticks both')
  assert.ok(p.notes.every((n,i)=>!i||p.notes[i-1].t<=n.t),'in time order')
 }
})
test('a sung song\'s lyrics: lines in time order, each word timed within its line, in order (karaoke), a line sung in one go (no gap over 2 s between its words: that was the fit stranding words on another part of the song)',()=>{
 const sung=charts.filter(s=>s.lyrics)
 assert.ok(sung.length>=1,'some song has lyrics')
 for(const s of sung){let last=-1
  for(const [start,end,text,words] of s.lyrics){
   assert.ok(start>=last&&end>start&&end<=s.ms,s.id+' '+text);last=start
   assert.equal(words.length,text.split(' ').length,s.id+' '+text)
   assert.ok(words.every((w,i)=>w>=start-1&&w<=end&&(!i||w>=words[i-1])),s.id+' '+text+' '+words)
   assert.ok(words.every((w,i)=>!i||w-words[i-1]<=2000),s.id+' '+text+': sung in one go '+words)}}
 assert.ok(charts.filter(s=>!SUNG.includes(s.id)).every(s=>!s.lyrics),'only the sung songs have lyrics')
})
test('a sung song\'s tiles follow its words: while a line is sung, Easy and Medium tiles land on words as they light; Jeff tier has a tile on nearly every word, and its extra tiles (sung syllables, the beat) sit clear of the words, never a near miss, and it never sits in one column more than 3 tiles running; no two tiles crowd one column',()=>{
 for(const s of charts.filter(s=>s.lyrics)){
  const words=s.lyrics.flatMap(l=>l[3]),inLine=t=>s.lyrics.some(l=>t>=l[0]-60&&t<=l[1]+60),dist=t=>Math.min(...words.map(w=>Math.abs(w-t)))
  for(const [lv,c] of Object.entries(s.charts)){
   const starts=[...c.tap,...c.hold].map(r=>r[0])
   if(lv==='jeff'){
    const covered=words.filter(w=>starts.some(t=>Math.abs(t-w)<=70)).length/words.length
    assert.ok(covered>=0.97,s.id+' jeff covers '+(covered*100).toFixed(1)+'% of words')
    const near=starts.filter(t=>inLine(t)&&dist(t)>70&&dist(t)<140)
    assert.equal(near.length,0,s.id+' jeff: tiles a near miss of a word, at '+near.slice(0,5).join(', ')+' ms')
    const seq=[...c.tap,...c.hold].sort((a,b)=>a[0]-b[0]);let run=1,most=1
    for(let i=1;i<seq.length;i++){run=seq[i][1]===seq[i-1][1]?run+1:1;most=Math.max(most,run)}
    assert.ok(most<=3,s.id+' jeff: '+most+' tiles in a row in one column')
   }else{
    const off=starts.filter(t=>inLine(t)&&dist(t)>70)
    assert.equal(off.length,0,s.id+' '+lv+': tiles while a line is sung but on no word, at '+off.slice(0,5).join(', ')+' ms')
   }
   for(let lane=0;lane<4;lane++){
    const ev=[...c.tap.filter(r=>r[1]===lane).map(r=>[r[0],r[0]]),...c.hold.filter(r=>r[1]===lane).map(r=>[r[0],r[2]])].sort((a,b)=>a[0]-b[0])
    for(let i=1;i<ev.length;i++)assert.ok(ev[i][0]>=ev[i-1][1]+90,s.id+' '+lv+' column '+lane+' crowded at '+ev[i][0]+' ms')
   }
  }
 }
})
test('every song, every level: the tiles step across the columns, never two in a row (or a pair after a pair) in one column, and never a tile in a column whose long tile is still running',()=>{
 for(const s of charts)for(const [lv,c] of Object.entries(s.charts)){
  const rows=[...c.tap.map(r=>[r[0],r[1],r[0]]),...c.hold.map(r=>[r[0],r[1],r[2]])].sort((a,b)=>a[0]-b[0]),groups=[]
  for(const r of rows){const g=groups[groups.length-1];if(g&&r[0]-g.t<=5)g.lanes.push(r[1]);else groups.push({t:r[0],lanes:[r[1]]})}
  for(let i=1;i<groups.length;i++)assert.ok(!groups[i].lanes.some(l=>groups[i-1].lanes.includes(l)),s.id+' '+lv+': column repeated at '+groups[i].t+' ms')
  for(const h of c.hold)assert.ok(!rows.some(r=>r[1]===h[1]&&r[0]>h[0]&&r[0]<h[2]+90),s.id+' '+lv+': a tile inside the long tile at '+h[0]+' ms')
 }
})
test('Tiles board: a tap counts while the tile is on the line (late in it is a Good), and the closer to dead on, the more it scores; the 3D road keeps its tight windows',()=>{
 const chart={tap:[[1000,0,60],[1500,1,62],[2000,2,64]],hold:[],sky:[],ribbon:[]}
 const tiles=R.playOf(chart,120,{tiles:true}).notes,road=R.playOf(chart,120).notes
 assert.equal(tiles[0].len,460,'a tile is on the line until the next row comes (less a hair)')
 assert.equal(road[0].len,undefined)
 // 300 ms late: off the road's Good window, but still inside the tile.
 assert.equal(R.hitIn(road,0,1300,'medium'),-1)
 assert.equal(R.hitIn(tiles,0,1300,'medium'),0)
 assert.equal(R.judgeNote(tiles[0],300,'medium'),'good')
 assert.equal(R.judgeNote(tiles[0],20,'medium'),'perfect')
 assert.equal(R.judgeNote(tiles[0],-60,'medium'),'great')
 assert.equal(R.judgeNote(tiles[0],-200,'medium'),'miss','too early: the tile isn\u2019t at the line yet')
 // Past the tile it's gone: missed, and a tap no longer finds it.
 assert.equal(JSON.stringify(R.missedBy(tiles,1400,'medium')),'[]')
 assert.equal(JSON.stringify(R.missedBy(tiles,1500,'medium')),'[0]')
 assert.equal(R.hitIn(tiles,0,1480,'medium'),-1)
 // Points: Perfect > Great > Good > a miss, for the same song.
 const score=j=>R.scoreOf(R.count(R.freshTally('medium'),j,'medium',10,{off:j==='perfect'?30:j==='great'?60:200}),10)
 assert.ok(score('perfect')>score('great')&&score('great')>score('good')&&score('good')>score('miss'),[score('perfect'),score('great'),score('good'),score('miss')].join(' > '))
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
test('this device remembers: the last song and level, what a hit plays (from the older Tap notes setting until chosen), and whether the first timing check is done (or a Timing already set)',()=>{
 const store=mem;store.clear()
 assert.equal(R.readLast(),null);R.saveLast('beijing-delai','medium');assert.deepEqual(R.readLast(),{song:'beijing-delai',level:'medium'})
 store.set(R.LAST_KEY,'{"song":"x","level":"hard"}');assert.equal(R.readLast(),null,'an unknown level is ignored')
 assert.equal(R.readHits(),'notes');store.set(R.KEYS_KEY,'0');assert.equal(R.readHits(),'off','Tap notes off means no sound')
 R.saveHits('ticks');assert.equal(R.readHits(),'ticks');assert.equal(store.get(R.KEYS_KEY),'1')
 assert.equal(R.readSynced(),false);store.set(R.OFFSET_KEY,'40');assert.equal(R.readSynced(),true,'a Timing set counts as done')
 store.delete(R.OFFSET_KEY);R.saveSynced();assert.equal(R.readSynced(),true)
 store.clear()
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
test('haptics: each kind of hit has its own feel (a Perfect firmer than a Good), a miss a double buzz; the switch turns it all off; an iPhone (no vibrate) flips the hidden switch instead',()=>{
 const file=path.resolve(root,'src/game/haptics.ts'),code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const make=nav=>{const module={exports:{}},store=new Map(),clicks=[],body={appendChild(){}},document={body,createElement:tag=>({tag,style:{},setAttribute(){},appendChild(){},click(){clicks.push(tag)}})}
  let clock=0;vm.runInNewContext(code,{module,exports:module.exports,navigator:nav,document,performance:{now:()=>clock+=100},localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))}});return {H:module.exports,clicks}}
 const buzz=[],{H}=make({vibrate:p=>{buzz.push(JSON.stringify(p));return true},userAgent:'Android',platform:'Linux',maxTouchPoints:5})
 H.haptic('good');H.haptic('perfect');H.haptic('miss');H.vibrate([5,5])
 assert.equal(buzz.join(' '),'16 26 [30,40,30] [5,5]')
 H.saveHaptics(false);H.haptic('perfect');H.vibrate(9);assert.equal(buzz.length,4,'off: nothing')
 H.saveHaptics(true);H.haptic('tap');assert.equal(buzz.length,5)
 const ios=make({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',platform:'iPhone',maxTouchPoints:5})
 ios.H.haptic('perfect');ios.H.haptic('great');assert.equal(ios.clicks.length,2,'an iPhone flips the switch for each')
})
console.log(passed+' KONO Beat rule tests passed')
