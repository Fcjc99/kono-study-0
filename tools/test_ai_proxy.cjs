// KONO's built-in AI server logic (src/store/aiProxy.ts) with fake Supabase and OpenAI: sign-in and daily
// allowance are checked before OpenAI is ever called, and bad input never reaches it.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const file=path.join(root,'src/store/aiProxy.ts'),mod={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,JSON,console})
const {handleAi,readAiRequest}=mod.exports
const json=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body})
function fakes({user=true,allowed=true,used=3,openai={status:200,body:{choices:[{message:{content:'{"items":[]}'}}]}}}={}){
 const calls=[]
 const fetch=async(url,init={})=>{calls.push({url,init});if(url.endsWith('/auth/v1/user'))return user?json(200,{id:'u1'}):json(401,{});if(url.endsWith('/rpc/kono_ai_take'))return json(200,{allowed,used,limit:40});if(url.startsWith('https://api.openai.com/'))return json(openai.status,openai.body);throw Error('unexpected '+url)}
 return {calls,deps:{fetch,openaiKey:'sk-test',supabaseUrl:'https://x.supabase.co',supabaseKey:'pub'}}
}
;(async()=>{
 let f=fakes(),r=await handleAi('tok',{prompt:'Read this JSON'},f.deps)
 assert.equal(r.status,200);assert.equal(r.body.text,'{"items":[]}');assert.equal(r.body.used,3)
 const openaiCall=f.calls.find(c=>c.url.startsWith('https://api.openai.com/'))
 assert.equal(openaiCall.init.headers.authorization,'Bearer sk-test');assert.equal(JSON.parse(openaiCall.init.body).model,'gpt-4o-mini')
 assert.equal(f.calls[0].init.headers.authorization,'Bearer tok','the person’s own token checks the sign-in')
 f=fakes();r=await handleAi('tok',{prompt:'Photo JSON',photo:{base64:'aGVsbG8=',mimeType:'image/jpeg'}},f.deps)
 assert.equal(r.status,200);assert.match(JSON.parse(f.calls.at(-1).init.body).messages[0].content[1].image_url.url,/^data:image\/jpeg;base64,aGVsbG8=$/)
 f=fakes();r=await handleAi('tok',{prompt:'x'},{...f.deps,openaiKey:undefined});assert.equal(r.status,503);assert.equal(f.calls.length,0)
 f=fakes();r=await handleAi('',{prompt:'x'},f.deps);assert.equal(r.status,401);assert.equal(f.calls.length,0)
 f=fakes({user:false});r=await handleAi('bad',{prompt:'x'},f.deps);assert.equal(r.status,401);assert.ok(!f.calls.some(c=>c.url.includes('openai')))
 f=fakes({allowed:false,used:40});r=await handleAi('tok',{prompt:'x'},f.deps);assert.equal(r.status,429);assert.match(r.body.error,/40 AI requests/);assert.ok(!f.calls.some(c=>c.url.includes('openai')),'over the limit never reaches OpenAI')
 f=fakes({openai:{status:429,body:{}}});r=await handleAi('tok',{prompt:'x'},f.deps);assert.equal(r.status,502);assert.match(r.body.error,/busy/)
 for(const bad of [{},{prompt:''},{prompt:'x'.repeat(60001)},{prompt:'x',photo:{base64:'***',mimeType:'image/jpeg'}},{prompt:'x',photo:{base64:'aGk=',mimeType:'text/html'}},{prompt:'x',photo:{base64:'a'.repeat(3500001),mimeType:'image/png'}}]){
  assert.equal(typeof readAiRequest(bad),'string',JSON.stringify(bad).slice(0,60))
  f=fakes();r=await handleAi('tok',bad,f.deps);assert.equal(r.status,400);assert.equal(f.calls.length,0,'bad input is refused before anything is called')
 }
 console.log('PASS built-in AI: sign-in and daily allowance checked first, bad input refused, OpenAI errors handled')
})().catch(e=>{console.error(e);process.exit(1)})
