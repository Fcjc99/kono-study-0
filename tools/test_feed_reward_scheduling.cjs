const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');
function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Math,Number,Array,Set});return m.exports}
const P=load('src/store/pusher.ts'),I=load('src/store/interaction.ts'),R=load('src/store/rewardRoute.ts');
let c=P.newCove(()=>.5,100,true),q=[];
for(let i=0;i<100;i++)if(I.feederHasRoom(q.length,c.medals.filter(m=>m.y<0).length))c=P.drop(c,i);
assert.equal(c.dropped,2);assert.equal(c.hand,98);assert.equal(c.medals.length,2);
q.push(...c.medals);c=P.spawned(c);assert.equal(I.feederHasRoom(q.length,0),false);
assert.equal(q.shift().x,4);assert.equal(I.feederHasRoom(q.length,0),true);
c=P.drop(c,90);assert.equal(c.hand,97);assert.equal(q[0].x,4);assert.equal(c.medals[0].x,90);
const f=I.createFeedControl();f.begin('pointer',0);assert.equal(f.tick(200,true,false),false);assert.equal(f.active,true);assert.equal(f.tick(5000,true,true),true);assert.equal(f.tick(5000,true,true),false);f.stop();assert.equal(f.tick(6000,true,true),false);
// Every captured challenge can present while an immutable Tide waits/delivers.
c={...P.newCove(()=>.5,100,true),dishQueue:3,tideBusy:true,tides:[{id:1,n:100,at:0,practice:false}]};let draws=0,randoms=0;
for(let i=0;i<1000;i++){const prev=c;c=P.step(c,()=>{randoms++;return 0});if(c.dish&&!prev.dish)draws++;assert.ok(!(c.dish&&c.chance));assert.equal(c.tides[0].n,100)}
assert.equal(draws,3);assert.equal(c.dishQueue,0);assert.equal(c.fieldAwards,30);assert.equal(randoms,63); // 3 draw picks, 30 rain medals × 2 coordinates.
// Fixed result dwells and keeps the next entitlement without an extra draw.
c={...P.newCove(()=>.5,100,true),queue:1,spinning:{reels:['🗼','🗼','🗼'],prize:{kind:'tower',n:20},at:0},frame:P.SPIN_FRAMES-1};let rng=0;
c=P.step(c,()=>{rng++;return .1});assert.equal(c.queue,1);assert.equal(c.spinsDone,1);assert.equal(rng,1);
for(let i=1;i<P.REEL_RESULT_FRAMES;i++){c=P.step(c,()=>{rng++;return .1});assert.equal(c.spinning,null);assert.equal(c.queue,1)}
assert.equal(rng,1);c=P.step(c,()=>{rng++;return .1});assert.ok(c.spinning);assert.equal(c.queue,0);
const route=R.createRewardRoute(),both={safe:true,pending:true};assert.equal(route.update(both,both),'tower');assert.equal(route.update({safe:false,pending:true},both),'tower');assert.equal(route.update(both,both),'tide');assert.equal(route.update(both,{safe:false,pending:true}),'tide');assert.equal(route.update(both,both),'tower');
console.log('PASS feeder conservation/FIFO/hold recovery, independent draw lane, 72-frame reel dwell, safe alternating ownership');
