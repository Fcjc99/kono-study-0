// KONO Stack and Snack sort: the rules (store/stack, store/snackSort), no browser.
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
const st=load('src/store/stack.ts'),ss=load('src/store/snackSort.ts'),coins=load('src/store/konoCoins.ts')
;(async()=>{
await test('KONO Stack: an exact drop is Perfect and keeps the width, an off one is trimmed, three Perfects grow it back, a miss ends it',()=>{
 let t=st.newTower();const base=t.layers[0]
 assert.equal(t.moving.x,100-t.moving.w,'the first comes in from the right')
 t={...t,moving:{...t.moving,x:base.x}}
 let r=st.drop(t);assert.equal(r.result,'perfect');assert.equal(r.tower.layers[1].w,base.w);t=r.tower
 t={...t,moving:{...t.moving,x:t.layers[1].x+10}};r=st.drop(t);assert.equal(r.result,'trim');assert.equal(Math.round(r.tower.layers[2].w),base.w-10,'the overhang falls off');assert.equal(r.tower.cuts.at(-1).side,'right');t=r.tower
 const w=t.layers[2].w
 for(let i=0;i<3;i++){t={...t,moving:{...t.moving,x:t.layers.at(-1).x}};t=st.drop(t).tower}
 assert.equal(t.streak,3);assert.equal(t.layers.at(-1).w,w+st.STACK.grow,'three Perfects in a row make it bigger');assert.equal(st.score(t),5)
 assert.ok(t.speed>st.STACK.speed,'it gets faster')
 t={...t,moving:{...t.moving,x:t.layers.at(-1).x+t.layers.at(-1).w+1}};r=st.drop(t);assert.equal(r.result,'miss');assert.equal(r.tower.over,true);assert.equal(st.score(r.tower),5)
 let s=st.newTower();for(let i=0;i<500;i++)s=st.slide(s,3);assert.ok(s.moving.x>=0&&s.moving.x<=100-s.moving.w,'sliding stays on the plate')
 assert.equal(st.toppingAt(10),'🍓');assert.equal(st.toppingAt(9),'')
})
await test('Snack sort: pours go onto the same snack or an empty jar (as many as fit), sorted means one snack per jar, every dealt level can be solved',()=>{
 const J=[['🍓','🫐','🫐'],['🫐'],[],['🍋','🍋','🍋','🍋']]
 assert.equal(ss.canPour(J,0,1),2,'both blueberries go onto the blueberry');assert.equal(ss.canPour(J,0,3),0,'not into a full jar');assert.equal(ss.canPour(J,1,0),1);assert.equal(ss.canPour(J,2,0),0,'nothing to pour from an empty jar')
 const after=ss.pour(J,0,1);assert.equal(after[1].join(''),'🫐🫐🫐');assert.equal(after[0].join(''),'🍓')
 assert.equal(ss.canPour([['🍓','🍓','🍓'],['🍋','🍋','🍋','🍓']],0,1),0)
 assert.equal(ss.canPour([['🫐','🫐','🫐'],['🍋','🫐']],0,1),2,'only as many as fit')
 assert.equal(ss.sorted([['🍓','🍓','🍓','🍓'],[]]),true);assert.equal(ss.sorted([['🍓','🍓','🍓'],['🍓']]),false)
 let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}
 for(const level of [1,2,5,9,14]){const jars=ss.deal(level,rnd),{kinds,spare}=ss.levelShape(level)
  assert.equal(jars.length,kinds+spare);assert.equal(jars.flat().length,kinds*ss.JAR);assert.ok(!ss.sorted(jars),'not already sorted');assert.ok(ss.solvable(jars,200000),'level '+level+' can be solved')}
 assert.equal(ss.levelShape(1).kinds,3);assert.equal(ss.levelShape(30).kinds,ss.SNACKS.length)
 assert.equal(ss.sortStars(9,3,false),3);assert.equal(ss.sortStars(9,3,true),2);assert.equal(ss.sortStars(40,3,false),1)
})
await test('Coins: a stack and a sorted pantry earn coins like the other games',()=>{
 assert.equal(coins.gameCoins('stack',0),0);assert.equal(coins.gameCoins('stack',20),20);assert.equal(coins.gameCoins('stack',300),50,'capped')
 assert.equal(coins.gameCoins('sort',9),18);assert.equal(coins.gameCoins('sort',1),5,'at least 5 for any win')
})
console.log(passed+'/3 KONO Stack and Snack sort groups passed.')
})().catch(error=>{console.error('FAIL',error);process.exit(1)})
