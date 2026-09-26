// Mirrors tools/test_kquiz.cjs's loader: real TS transpile + a fresh VM per module, recursive
// relative-import resolution, real npm packages for anything non-relative.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto')
const root=path.resolve(__dirname,'..'),deps=path.join(root,'node_modules')
const ts=require(path.join(deps,'typescript'))
const modules=new Map()
function load(rel){
 if(modules.has(rel))return modules.get(rel)
 const file=path.join(root,rel),source=fs.readFileSync(file,'utf8')
 const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,mod={exports:{}}
 const requireIn=name=>name==='react'?{}:!name.startsWith('.')?require(path.join(deps,name)):load(path.normalize(path.join(path.dirname(rel),name.replace(/\.js$/,'')+'.ts')))
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:requireIn,crypto:{randomUUID},console,Date,Math,Set,Map,Object,Promise,TextEncoder,structuredClone,process:{env:{}},fetch:(...a)=>globalThis.fakeFetch(...a)})
 modules.set(rel,mod.exports);return mod.exports
}
const model=load('src/store/model.ts')
const {buildIcs}=load('src/store/icsExport.ts')

const tests=[]
function test(name,fn){tests.push({name,fn})}
const make=()=>model.createFreshData()

test('produces a valid VCALENDAR wrapper with CRLF line endings',()=>{
 const d=make()
 const ics=buildIcs(d,d.activeProfileId)
 assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
 assert.ok(ics.trim().endsWith('END:VCALENDAR'))
 assert.ok(ics.includes('VERSION:2.0\r\n'))
 assert.ok(!ics.includes('\n\n')) // no bare LF-only line breaks slipped in
})

test('a task becomes an all-day VEVENT with its due date, title and subject as CATEGORIES',()=>{
 const d=make(),pid=d.activeProfileId
 d.subjects=[{id:'subj1',profileId:pid,name:'Biology',color:'#000',resources:[]}]
 d.tasks=[{id:'t1',profileId:pid,subjectId:'subj1',title:'Lab report',due:'2026-09-25',done:false,notes:'Bring goggles'}]
 const ics=buildIcs(d,pid)
 assert.ok(ics.includes('UID:task-t1@kono-study-sanctuary\r\n'))
 assert.ok(ics.includes('DTSTART;VALUE=DATE:20260925\r\n'))
 assert.ok(ics.includes('SUMMARY:Lab report\r\n'))
 assert.ok(ics.includes('DESCRIPTION:Bring goggles\r\n'))
 assert.ok(ics.includes('CATEGORIES:Biology\r\n'))
})

test('an exam is prefixed "Exam:" so it reads distinctly from a plain assignment in a calendar app',()=>{
 const d=make(),pid=d.activeProfileId
 d.exams=[{id:'e1',profileId:pid,subjectId:'',title:'Midterm',due:'2026-10-01',notes:'',done:false}]
 const ics=buildIcs(d,pid)
 assert.ok(ics.includes('SUMMARY:Exam: Midterm\r\n'))
})

test('a calendar event with a time renders a timed DTSTART; without one it stays all-day',()=>{
 const d=make(),pid=d.activeProfileId
 d.calendarEvents=[
  {id:'c1',profileId:pid,date:'2026-09-20',title:'Soccer practice',kind:'sports',notes:'',time:'15:30'},
  {id:'c2',profileId:pid,date:'2026-09-21',title:'Doctor appointment',kind:'appointment',notes:''},
 ]
 const ics=buildIcs(d,pid)
 assert.ok(ics.includes('DTSTART:20260920T153000\r\n'))
 assert.ok(ics.includes('DTSTART;VALUE=DATE:20260921\r\n'))
})

test('only the given profile\'s entries are included',()=>{
 const d=make()
 const otherProfileId='profile-other'
 d.profiles=[...d.profiles,{id:otherProfileId,name:'Sibling',label:'Sibling plan'}]
 d.tasks=[
  {id:'mine',profileId:d.activeProfileId,subjectId:'',title:'Mine',due:'2026-09-25',done:false,notes:''},
  {id:'theirs',profileId:otherProfileId,subjectId:'',title:'Theirs',due:'2026-09-25',done:false,notes:''},
 ]
 const ics=buildIcs(d,d.activeProfileId)
 assert.ok(ics.includes('SUMMARY:Mine\r\n'))
 assert.ok(!ics.includes('SUMMARY:Theirs\r\n'))
})

test('special characters in the title/notes are escaped per RFC 5545',()=>{
 const d=make(),pid=d.activeProfileId
 d.tasks=[{id:'t1',profileId:pid,subjectId:'',title:'Ch. 4, 5; review\nand notes',due:'2026-09-25',done:false,notes:''}]
 const ics=buildIcs(d,pid)
 assert.ok(ics.includes('SUMMARY:Ch. 4\\, 5\\; review\\nand notes\r\n'))
})

test('a very long title is folded onto continuation lines starting with a space, not left as one raw long line',()=>{
 const d=make(),pid=d.activeProfileId
 const longTitle='A'.repeat(200)
 d.tasks=[{id:'t1',profileId:pid,subjectId:'',title:longTitle,due:'2026-09-25',done:false,notes:''}]
 const ics=buildIcs(d,pid)
 const rawLines=ics.split('\r\n')
 for(const line of rawLines){
  if(line.startsWith(' '))continue // a folded continuation line
  assert.ok(new TextEncoder().encode(line).length<=75,'line exceeds 75 octets: '+line.slice(0,20)+'…')
 }
 assert.ok(ics.includes('\r\n '),'expected at least one folded continuation line for the long title')
 assert.ok(ics.includes(longTitle.slice(0,10))) // the content itself survives folding intact once unfolded
})

test('the subscribed-calendar version has a name and refresh hint, and leaves out private notes',()=>{
 const d=make(),pid=d.activeProfileId
 d.tasks=[{id:'t1',profileId:pid,subjectId:'',title:'Lab report',due:'2026-09-25',done:false,notes:'Locker code 1234'}]
 d.exams=[{id:'e1',profileId:pid,subjectId:'',title:'Bio',due:'2026-10-01',done:false,notes:'Private exam note'}]
 const plain=buildIcs(d,pid),feed=buildIcs(d,pid,{subscribe:true})
 assert.ok(plain.includes('DESCRIPTION:Locker code 1234'))
 assert.ok(!feed.includes('DESCRIPTION:'),'no notes in a link anyone with the URL can read')
 assert.ok(feed.includes('SUMMARY:Lab report\r\n'));assert.ok(feed.includes('SUMMARY:Exam: Bio\r\n'))
 assert.match(feed,/X-WR-CALNAME:KONO · /);assert.ok(feed.includes('REFRESH-INTERVAL;VALUE=DURATION:PT4H\r\n'))
 assert.ok(!plain.includes('X-WR-CALNAME'))
})

test('api/ics: a valid link serves the subscribed calendar; bad or turned-off links get 404 without a database call for bad ones',async()=>{
 const handler=load('api/ics.ts').default,d=make(),pid=d.activeProfileId,calls=[]
 d.tasks=[{id:'t1',profileId:pid,subjectId:'',title:'Lab report',due:'2026-09-25',done:false,notes:'Locker code 1234'}]
 globalThis.fakeFetch=async(url,init)=>{const body=JSON.parse(init.body);calls.push({url,body});return {ok:true,json:async()=>body.p_token==='a'.repeat(48)?{profileId:pid,data:d}:null}}
 const call=async query=>{const res={code:0,body:'',headers:{},status(c){this.code=c;return this},setHeader(k,v){this.headers[k]=v},send(b){this.body=b}};await handler({method:'GET',query},res);return res}
 const ok=await call({t:'a'.repeat(48)})
 assert.equal(ok.code,200);assert.match(ok.headers['content-type'],/text\/calendar/)
 assert.ok(ok.body.includes('SUMMARY:Lab report'));assert.ok(!ok.body.includes('Locker code'))
 assert.match(calls[0].url,/\/rest\/v1\/rpc\/kono_calendar_feed$/)
 assert.equal((await call({t:'b'.repeat(48)})).code,404,'a turned-off link')
 const before=calls.length
 for(const t of ['',"x' or 1=1",'A'.repeat(48),'a'.repeat(20)])assert.equal((await call({t})).code,404)
 assert.equal(calls.length,before,'malformed tokens never reach the database')
})

;(async()=>{
let passed=0
for(const t of tests){try{await t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} ics-export regression groups passed.`)
})()
