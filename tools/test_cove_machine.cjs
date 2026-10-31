// Medal Cove's machine (store/coveMachine): the shelf, the pile, the hole, the tower and the save, in real
// physics (Rapier), no browser.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const src=ts.transpileModule(fs.readFileSync(path.join(root,'src/store/coveMachine.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
const mod={exports:{}};new Function('module','exports','require',src)(mod,mod.exports,require)
const C=mod.exports,RAPIER=require('@dimforge/rapier3d-compat')
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}
const inside=mc=>[...mc.pieces.values()].filter(p=>!p.counted).every(p=>{const t=p.body.translation();return Math.abs(t.x)<C.M.W+0.4&&t.z>C.M.BACK-0.2&&t.y<5})
RAPIER.init().then(()=>{
 test('the pile settles inside the machine and the shelf moves forward and back',()=>{
  const mc=C.createMachine(RAPIER,null,rnd);assert.ok(mc.pieces.size>80,'a pile to start ('+mc.pieces.size+')');assert.ok(inside(mc))
  const faces=[];for(let f=0;f<C.M.PERIOD;f++){mc.step();faces.push(mc.face())}
  assert.ok(Math.min(...faces)<C.M.FACE_MIN+0.05&&Math.max(...faces)>C.M.FACE_MAX-0.05,'the shelf goes all the way');assert.ok(inside(mc))
  mc.free()
 })
 test('drops: you spend from your hand, the pile pays off the front, and what lands in the hole builds the tower one medal at a time',()=>{
  seed=7;const mc=C.createMachine(RAPIER,null,rnd);let caught=0,fed=0,stages=[]
  for(let f=0;f<60*80;f++){const e=mc.step(f%30===0&&mc.state.hand>0?(f/30%3===0?0:(rnd()-.5)*4):null);caught+=e.caught;if(e.fed)fed++;if(e.stageChanged)stages.push(e.stageChanged)}
  assert.ok(mc.state.won>10,'medals come off the front ('+mc.state.won+')');assert.ok(caught>3,'some go in the hole ('+caught+')');assert.ok(fed>=6,'the feeder places them ('+fed+')')
  assert.ok(stages.includes('release')&&stages.includes('lower')&&stages.includes('free'),'a full tower is released onto the field ('+stages.join()+')');assert.ok(inside(mc))
  mc.free()
 })
 test('the save: the machine comes back as it was, with nothing counted twice',()=>{
  seed=3;const mc=C.createMachine(RAPIER,null,rnd);for(let f=0;f<600;f++)mc.step(f%40===0?0.5:null)
  const saved=mc.save(),text=JSON.stringify(saved);mc.free()
  const back=C.readSaved(text);assert.ok(back,'it reads back');assert.equal(back.hand,saved.hand);assert.equal(back.coins.length,saved.coins.length)
  const again=C.createMachine(RAPIER,back,rnd);assert.equal(again.pieces.size,saved.coins.length,'every medal in play is back');assert.equal(again.state.won,saved.won,'nothing paid again')
  let won=0;for(let f=0;f<120;f++)won+=again.step().won
  assert.ok(won<=6,'restoring doesn’t shake medals off ('+won+')');assert.ok(inside(again));again.free()
  assert.equal(C.readSaved('{"v":1,"hand":3,"coins":[[1,2]]}'),null,'a broken save is ignored');assert.equal(C.readSaved('nope'),null)
 })
 console.log(passed+' cove machine tests passed')
})
