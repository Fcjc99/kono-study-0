// The island art is served as lossless WebP under its .png names (tools/webp_art.mjs after the build, and
// vercel.json labelling /garden/*.png as image/webp). Checks the conversion on real KONO art in a scratch copy:
// smaller, WebP inside, every visible pixel the same; and that the site settings and build scripts use it.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process')
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kono-webp-')),garden=path.join(tmp,'garden')
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const samples=['garden/fx/critters/individual/birds/bird-blue.png','garden/production-atmosphere/cloud-01.png'].filter(f=>fs.existsSync(path.join(root,'public',f)))
assert.ok(samples.length>=1,'sample art exists')
for(const f of samples){fs.mkdirSync(path.dirname(path.join(tmp,f)),{recursive:true});fs.copyFileSync(path.join(root,'public',f),path.join(tmp,f))}
const before=samples.map(f=>fs.statSync(path.join(tmp,f)).size)
const out=execFileSync(process.execPath,[path.join(root,'tools/webp_art.mjs'),tmp],{encoding:'utf8'})
test('real island art becomes smaller lossless WebP under the same .png name (the script checks every visible pixel)',()=>{
 assert.match(out,/every visible pixel checked/)
 samples.forEach((f,i)=>{const b=fs.readFileSync(path.join(tmp,f));assert.equal(b.subarray(0,4).toString('latin1'),'RIFF');assert.equal(b.subarray(8,12).toString('latin1'),'WEBP');assert.ok(b.length<before[i],f+' got smaller')})
})
test('running it again leaves converted files alone',()=>{
 const again=execFileSync(process.execPath,[path.join(root,'tools/webp_art.mjs'),tmp],{encoding:'utf8'})
 assert.match(again,/0 PNGs re-saved/)
})
test('the site serves /garden/*.png as image/webp, and both builds convert',()=>{
 const v=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8')),rule=v.headers.find(h=>h.source==='/garden/(.*)\\.png')
 assert.ok(rule&&rule.headers.some(h=>h.key==='Content-Type'&&h.value==='image/webp'))
 const s=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).scripts
 assert.match(s.build,/webp_art\.mjs/);assert.match(s['build:vercel'],/webp_art\.mjs/)
})
fs.rmSync(tmp,{recursive:true,force:true})
console.log(passed+' island art (WebP) tests passed')
