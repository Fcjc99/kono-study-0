// Mirrors tools/test_ics_export.cjs's loader: real TS transpile + a fresh VM per module, recursive
// relative-import resolution, real npm packages for anything non-relative -- including jspdf itself,
// which runs fine in plain Node (it falls back to Node's own Blob when no DOM is present).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto')
const root=path.resolve(__dirname,'..'),deps=path.join(root,'node_modules')
const ts=require(path.join(deps,'typescript'))
const modules=new Map()
function load(rel){
 if(modules.has(rel))return modules.get(rel)
 const file=path.join(root,rel),source=fs.readFileSync(file,'utf8')
 const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,mod={exports:{}}
 const requireIn=name=>name==='react'?{}:!name.startsWith('.')?require(path.join(deps,name)):load(path.normalize(path.join(path.dirname(rel),name+'.ts')))
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:requireIn,crypto:{randomUUID},console,Date,Math,Set,Map,Object,Promise,structuredClone})
 modules.set(rel,mod.exports);return mod.exports
}
const {buildKQuizSetPdf,__test__:{parseBlocks}}=load('src/store/kquizPdf.ts')

const tests=[]
function test(name,fn){tests.push({name,fn})}
const asyncTests=[]
function atest(name,fn){asyncTests.push({name,fn})}
// Return values cross a vm.runInNewContext realm boundary, so plain-object/array identity checks need
// a JSON round trip first (mirrors tools/test_time_blocking.cjs's own `same` helper).
const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)))

const set=(overrides)=>({id:'set1',profileId:'p1',subjectId:'',title:'Cell Biology',createdAt:'2026-09-19T12:00:00.000Z',...overrides})

test('headings, bullets and plain paragraphs are classified, and ** bold ** markers are stripped',()=>{
 const blocks=parseBlocks('# Big heading with **bold**\n### Small heading\n- first item\n* second item\nJust a paragraph.')
 same(blocks.map(b=>b.type),['h2','h3','li','li','p'])
 assert.equal(blocks[0].text,'Big heading with bold')
 assert.equal(blocks[2].text,'first item')
 assert.equal(blocks[4].text,'Just a paragraph.')
})

test('blank lines are skipped rather than producing empty blocks',()=>{
 const blocks=parseBlocks('First line.\n\n\nSecond line.')
 assert.equal(blocks.length,2)
})

atest('a set with both a summary and a study guide produces a valid, non-trivial PDF',async()=>{
 const blob=await buildKQuizSetPdf(set({summary:'# Overview\n- mitochondria\n- ribosomes',studyGuide:'## Key terms\nOrganelle: a specialized subunit.'}),'Biology')
 assert.equal(blob.type,'application/pdf')
 const bytes=Buffer.from(await blob.arrayBuffer())
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-')
 assert.ok(bytes.length>500,'expected a non-trivial PDF, got '+bytes.length+' bytes')
})

atest('a set with only a summary still produces a valid PDF (no "Study guide" section to render)',async()=>{
 const blob=await buildKQuizSetPdf(set({summary:'Just a short summary.',studyGuide:undefined}),'')
 assert.equal(blob.type,'application/pdf')
 assert.equal(Buffer.from(await blob.arrayBuffer()).subarray(0,5).toString(),'%PDF-')
})

atest('a set with neither a summary nor a study guide still produces a valid PDF rather than throwing',async()=>{
 const blob=await buildKQuizSetPdf(set({summary:undefined,studyGuide:undefined}),'')
 assert.equal(blob.type,'application/pdf')
 assert.equal(Buffer.from(await blob.arrayBuffer()).subarray(0,5).toString(),'%PDF-')
})

atest('a very long study guide spans more bytes than a short one, confirming pagination actually renders the extra content',async()=>{
 const short=await buildKQuizSetPdf(set({summary:undefined,studyGuide:'One short paragraph.'}),'')
 const longText=Array.from({length:120},(_,i)=>'Paragraph number '+i+' with enough words to wrap across the page more than once per line.').join('\n')
 const long=await buildKQuizSetPdf(set({summary:undefined,studyGuide:longText}),'')
 assert.ok(long.size>short.size*2,`expected the long guide's PDF (${long.size}b) to be meaningfully bigger than the short one's (${short.size}b)`)
})

let passed=0,total=tests.length+asyncTests.length
async function main(){
 for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
 for(const t of asyncTests){try{await t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
 console.log(`${passed}/${total} kquiz-pdf regression groups passed.`)
}
main()
