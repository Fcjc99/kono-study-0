// KONO Stack and KONO Bloom: the rules (store/stack, store/bloom), no browser.
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
const st=load('src/store/stack.ts'),bl=load('src/store/bloom.ts'),coins=load('src/store/konoCoins.ts')
;(async()=>{
await test('KONO Stack: floors slide along x then z; an exact drop is Perfect and keeps the size, an off one is trimmed (the overhang breaks off), three Perfects grow it back, a miss ends it',()=>{
 let t=st.newTower();const base=t.floors[0]
 assert.equal(t.moving.axis,'x');assert.equal(Math.abs(t.moving.x),st.STACK.reach,'it comes in from the side')
 t={...t,moving:{...t.moving,x:0.5}};let r=st.drop(t);assert.equal(r.result,'perfect');assert.equal(r.tower.floors[1].x,0);assert.equal(r.tower.floors[1].w,base.w);t=r.tower
 assert.equal(t.moving.axis,'z','the next one slides the other way')
 t={...t,moving:{...t.moving,z:6}};r=st.drop(t);assert.equal(r.result,'trim');assert.equal(r.tower.floors[2].d,base.d-6,'the overhang breaks off');assert.equal(r.tower.floors[2].z,3);assert.equal(r.tower.floors[2].w,base.w,'the other side is untouched')
 const chip=r.tower.chips.at(-1);assert.equal(chip.d,6);assert.equal(chip.side,1);assert.equal(chip.z,23);t=r.tower
 const d=t.floors[2].d
 for(let i=0;i<3;i++){const top=t.floors.at(-1);t={...t,moving:{...t.moving,[t.moving.axis]:top[t.moving.axis]}};t=st.drop(t).tower}
 assert.equal(t.streak,3);assert.equal(t.floors.at(-1).d,d+st.STACK.grow,'three Perfects in a row make it bigger');assert.equal(st.score(t),5)
 assert.ok(t.speed>st.STACK.speed,'it gets faster')
 const top=t.floors.at(-1),a=t.moving.axis;t={...t,moving:{...t.moving,[a]:top[a]+(a==='x'?top.w:top.d)+1}};r=st.drop(t);assert.equal(r.result,'miss');assert.equal(r.tower.over,true);assert.equal(st.score(r.tower),5)
 let s=st.newTower();for(let i=0;i<800;i++){s=st.slide(s,3);assert.ok(Math.abs(s.moving.x)<=st.STACK.reach+1e-9,'it turns back at the far side')}
})
await test('KONO Bloom: a drop falls and settles on the soil, two the same grow into the next one (and score), two Great Trees make a rainbow, a jar filled past the line ends it',()=>{
 let seed=3;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}
 let g=bl.newGarden(rnd);assert.ok(g.next>=0&&g.next<=2,'it starts with something small')
 g={...g,next:0};g=bl.drop(g,50,rnd);for(let i=0;i<400;i++)g=bl.step(g)
 const b=g.balls[0];assert.ok(Math.abs(b.y-(bl.JAR.h-bl.RADIUS[0]))<0.6,'it lands on the soil');assert.ok(Math.abs(b.vy)<0.2,'and stays')
 g={...g,next:0};g=bl.drop(g,50,rnd);for(let i=0;i<400;i++)g=bl.step(g)
 assert.equal(g.balls.length,1);assert.equal(g.balls[0].tier,1,'two beans grow into a sprout');assert.equal(g.score,bl.points(1));assert.equal(g.best,1)
 let t=bl.newGarden(rnd);const R=bl.RADIUS[10]
 t={...t,balls:[{id:1,tier:10,x:R,y:bl.JAR.h-R,vx:0,vy:0,age:200},{id:2,tier:10,x:R*2-1,y:bl.JAR.h-R,vx:0,vy:0,age:200}],nextId:3}
 t=bl.step(t);assert.equal(t.balls.length,0,'two Great Trees leave room');assert.equal(t.rainbows,1);assert.equal(t.score,100)
 assert.equal(bl.clampX(-5,3),bl.RADIUS[3]);assert.equal(bl.clampX(500,3),bl.JAR.w-bl.RADIUS[3])
 // Something settled sticking up past the line for about 2 seconds ends it; one just dropped doesn't count.
 const high=(age,danger)=>({...bl.newGarden(rnd),balls:[{id:1,tier:5,x:50,y:20,vx:0,vy:0,age}],nextId:2,danger})
 assert.equal(bl.step(high(200,120)).over,true,'over the line too long ends the round')
 assert.equal(bl.step(high(200,10)).over,false,'not yet');assert.ok(bl.step(high(200,10)).danger>10,'the danger builds')
 assert.equal(bl.step(high(5,120)).danger<120,true,'a fresh drop passing the line doesn’t count')
 for(let i=0;i<200;i++)assert.ok(bl.dropTier(rnd,0)<=2,'small drops to start');assert.ok([...Array(300)].some(()=>bl.dropTier(rnd,9)===4),'bigger once you have grown big ones')
})
await test('Coins: a stack and a garden earn coins like the other games',()=>{
 assert.equal(coins.gameCoins('stack',0),0);assert.equal(coins.gameCoins('stack',20),20);assert.equal(coins.gameCoins('stack',300),50,'capped')
 assert.equal(coins.gameCoins('bloom',600),20);assert.equal(coins.gameCoins('bloom',10),5,'at least 5 for any score')
})
console.log(passed+'/3 KONO Stack and KONO Bloom groups passed.')
})().catch(error=>{console.error('FAIL',error);process.exit(1)})
