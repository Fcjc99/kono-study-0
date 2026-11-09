// Person colors on calendar tiles (src/store/tones.ts): whatever color someone picks, the tile's text reads and
// its bar stands out, in light and dark (WCAG: text 4.5:1, a bar 3:1).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const file=path.resolve(__dirname,'..','src','store','tones.ts'),mod={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Math,Map,parseInt,Number})
const {tones,toneVars,contrast,tooClose}=mod.exports
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const picks=['#ffd34d','#f0e442','#e69f00','#56b4e9','#009e73','#0072b2','#d55e00','#cc79a7','#8a2be2','#7f9cc9','#d98f8f','#ffffff','#000000','#a3e635','#22d3ee','#ff0000','#00ff00','#0000ff','#fde68a','#1e293b','#abc']
test('every pick: text at least 4.5:1 on its tile and the bar at least 3:1, in light and dark',()=>{
 for(const c of picks){const t=tones(c)
  assert.ok(contrast(t.fg,t.bg)>=4.5,c+' text');assert.ok(contrast(t.bar,t.bg)>=3,c+' bar');assert.ok(contrast(t.bar,'#ffffff')>=3,c+' bar on white')
  assert.ok(contrast(t.fgDark,t.bgDark)>=4.5,c+' dark text');assert.ok(contrast(t.barDark,t.bgDark)>=3,c+' dark bar')
  // White initials on the bar (light) and the fill's color on the bar (dark).
  assert.ok(contrast('#ffffff',t.bar)>=4.5,c+' initials');assert.ok(contrast(t.bgDark,t.barDark)>=4.5,c+' dark initials')}
})
test('the hue is kept, and a color that isn\'t one gives nothing',()=>{
 const red=tones('#d55e00'),blue=tones('#0072b2');assert.notEqual(red.bar,blue.bar)
 assert.equal(tones('banana'),null);assert.equal(tones(undefined),null);assert.equal(Object.keys(toneVars('nope')).length,0)
 assert.deepEqual([...Object.keys(toneVars('#8a2be2'))],['--t-bg','--t-bar','--t-fg','--t-bg-d','--t-bar-d','--t-fg-d'])
})
test('two kids in nearly the same color are flagged; the eight colors offered never are',()=>{
 assert.equal(tooClose('#8a2be2','#9030e0'),true);assert.equal(tooClose('#ff0000','#ee1100'),true);assert.equal(tooClose('#8a2be2','#f0e442'),false)
 const offered=['#7ca982','#d9908c','#7f9fc9','#c69a65','#9a86bd','#5da8a1','#ba7f9d','#8b9a72']
 for(const a of offered)for(const b of offered)if(a!==b)assert.equal(tooClose(a,b),false,a+' '+b)
})
console.log(`${passed}/3 tile-color groups passed.`)
