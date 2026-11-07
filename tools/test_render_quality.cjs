// Medal Cove's drawing quality on slower phones (src/store/renderQuality.ts): HD until frames run slow, then
// lighter, then lite; never back up during a round; pauses don't count.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const mod={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/store/renderQuality.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Math})
const Q=mod.exports
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const run=(w,ms,n)=>{const out=[];for(let i=0;i<n;i++){const c=w.frame(ms);if(c!==null)out.push(c)}return out}
test('a phone at 60 fps stays HD',()=>{const w=Q.createQualityWatch();assert.deepEqual(run(w,16.7,2000),[]);assert.equal(w.level,0)})
test('a struggling phone steps down to lighter, then lite, and stops there',()=>{const w=Q.createQualityWatch();assert.deepEqual(run(w,40,2000),[1,2]);assert.equal(w.level,2)})
test('one stutter doesn’t count: it takes a slow stretch',()=>{const w=Q.createQualityWatch();run(w,16.7,200);assert.deepEqual(run(w,60,5),[]);assert.deepEqual(run(w,16.7,500),[])})
test('pauses (a hidden tab, long gaps) are ignored',()=>{const w=Q.createQualityWatch();assert.deepEqual(run(w,5000,500),[]);assert.deepEqual(run(w,0,500),[]);assert.equal(w.level,0)})
test('a phone that recovers at the lighter level stays lighter (no flicker back to HD)',()=>{const w=Q.createQualityWatch();run(w,40,Q.SETTLE+Q.WINDOW+1);assert.equal(w.level,1);assert.deepEqual(run(w,16.7,3000),[]);assert.equal(w.level,1)})
test('the levels: HD keeps the screen’s sharpness; lighter and lite cut sharpness, shadows and glow',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(Q.qualityAt(0,2))),{level:0,pixelRatio:2,shadow:2048,bloomScale:1})
 assert.deepEqual(JSON.parse(JSON.stringify(Q.qualityAt(1,2))),{level:1,pixelRatio:1.25,shadow:1024,bloomScale:0.6})
 assert.deepEqual(JSON.parse(JSON.stringify(Q.qualityAt(2,1.5))),{level:2,pixelRatio:1,shadow:512,bloomScale:0.5})
 assert.equal(Q.qualityAt(1,1).pixelRatio,1,'never sharper than the device asks')
})
console.log(passed+' Medal Cove quality tests passed')
