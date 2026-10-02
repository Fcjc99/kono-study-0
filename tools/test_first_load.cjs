// Budgets for what a first visit downloads before the Sanctuary shows (checks the production build in
// dist/client, so run after `npm run build`). Measured on a slow-4G phone when these were set:
// splash at 0.3s, Sanctuary at 2.2s, island picture at 2.9s, live island at 4.7s.
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib')
const ROOT=path.join(__dirname,'..'),CLIENT=path.join(ROOT,'dist','client')

if(!fs.existsSync(path.join(CLIENT,'index.html'))){console.error('No build in dist/client: run `npm run build` first.');process.exit(1)}
const html=fs.readFileSync(path.join(CLIENT,'index.html'),'utf8')
const gz=file=>zlib.gzipSync(fs.readFileSync(path.join(CLIENT,file)),{level:9}).length
const kb=n=>(n/1024).toFixed(1)+' KB'

let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS',name)}

const scripts=[...html.matchAll(/<script type="module" crossorigin src="\/([^"]+)"/g)].map(m=>m[1])
const preloads=[...html.matchAll(/<link rel="modulepreload" crossorigin (fetchpriority="low" )?href="\/([^"]+)"/g)]
const startupJs=[...scripts,...preloads.filter(m=>!m[1]).map(m=>m[2])]
const signIn=preloads.filter(m=>m[1]).map(m=>m[2])
const sheets=[...html.matchAll(/<link rel="stylesheet" crossorigin href="\/([^"]+)"/g)].map(m=>m[1])

test('the startup scripts fit in 170 KB gzipped, and heavy tools (Phaser, PDF, OCR, picture export) aren’t among them',()=>{
 const total=startupJs.reduce((sum,f)=>sum+gz(f),0)
 console.log('  startup JS:',kb(total),'in',startupJs.length,'files')
 assert.ok(total<=170*1024,'startup JS is '+kb(total)+'; lazy-load what the Sanctuary doesn’t need (see src/lazyPanel.tsx)')
 for(const heavy of ['phaser','pdf','jspdf','html2canvas','tesseract','Stage0Scene','StudyPlanner','SanctuaryBuild-'])assert.ok(!startupJs.some(f=>f.includes(heavy)),heavy+' is in the startup download')
})

test('the stylesheet fits in 85 KB gzipped and imports nothing from other sites (Google Fonts would block the first paint)',()=>{
 assert.equal(sheets.length,1)
 const size=gz(sheets[0]),css=fs.readFileSync(path.join(CLIENT,sheets[0]),'utf8')
 console.log('  startup CSS:',kb(size))
 assert.ok(size<=85*1024,'startup CSS is '+kb(size))
 assert.ok(!/@import\s+url\(\s*['"]?https?:/i.test(css),'the CSS @imports another site; load it from src/main.tsx instead')
})

test('a splash is in the page itself and the stylesheet comes after it, so something shows before any download finishes',()=>{
 const root=html.indexOf('<div id="root">'),sheet=html.indexOf('<link rel="stylesheet"')
 assert.ok(root>0&&sheet>root,'the stylesheet should come after #root')
 assert.match(html.slice(root,sheet),/Opening your study plan/)
 assert.ok(!html.slice(0,html.indexOf('</head>')).includes('rel="stylesheet"'),'a stylesheet in <head> holds back the splash')
})

test('the sign-in code downloads alongside the main script (low priority), not after it',()=>{
 assert.equal(signIn.length,1)
 assert.match(signIn[0],/supabaseRemote-/)
 const size=gz(signIn[0])
 console.log('  sign-in:',kb(size))
 assert.ok(size<=65*1024,'sign-in code is '+kb(size))
})

test('the island shows a small picture first (the full one and Phaser load behind it)',()=>{
 const card=fs.readFileSync(path.join(ROOT,'src','components','GardenCard.tsx'),'utf8')
 assert.match(card,/-poster\.webp/)
 // The Halloween island (October) has its own pictures too.
 for(const folder of ['','halloween'])for(const phase of ['morning','afternoon','evening','night']){
  const file=path.join(CLIENT,'garden','terrace-23.0',folder,phase+'-poster.webp')
  assert.ok(fs.existsSync(file),(folder?folder+' ':'')+phase+' poster missing from the build (tools/public-allowlist.json)')
  assert.ok(fs.statSync(file).size<=60*1024,(folder?folder+' ':'')+phase+' poster is '+kb(fs.statSync(file).size))
  if(folder)assert.ok(fs.existsSync(path.join(CLIENT,'garden','terrace-23.0',folder,phase+'.webp')),folder+' '+phase+' map missing from the build')
 }
})

test('offline: the service worker precaches the sign-in code and the island, and matches cached files whatever their Vary header',()=>{
 const sw=fs.readFileSync(path.join(CLIENT,'sw.js'),'utf8')
 const list=JSON.parse(sw.match(/const PRECACHE=(\[.*\])/)[1])
 for(const name of ['supabaseRemote-','Stage0Scene-','phaser'])assert.ok(list.some(f=>f.includes(name)),name+' is not precached')
 for(const file of [...startupJs,...sheets])assert.ok(list.includes('/'+file),file+' is not precached')
 assert.ok(!/caches\.match\((?![^)]*ignoreVary:true)[^)]*\)/.test(sw),'every cache lookup needs ignoreVary')
})

console.log(`${passed}/6 first-load groups passed.`)
