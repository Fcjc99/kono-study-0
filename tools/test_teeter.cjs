// KONO Teeter Tower: the pieces, and how high a tower counts as.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const load=relative=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Math});return module.exports}
const {SHAPES,COLORS,towerHeight}=load('src/store/teeter.ts')
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
console.log(passed+' teeter tests passed')
