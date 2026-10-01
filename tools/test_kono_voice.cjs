// Ask KONO's voice: the server reads answers aloud only after the sign-in and its own daily allowance
// are checked (src/store/voiceProxy.ts), and the device voice picker prefers Premium, then Enhanced or
// natural voices, never Apple's novelty voices (src/store/konoVoice.ts).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const load=file=>{const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,JSON,console,btoa,Uint8Array,String,Math});return mod.exports}
const {handleVoice,readVoiceRequest,MAX_VOICE_TEXT}=load('src/store/voiceProxy.ts')
const {bestVoice,hasNaturalVoice,isAppleMobile,voiceQuality}=load('src/store/konoVoice.ts')
let passed=0
const test=(name,fn)=>Promise.resolve().then(fn).then(()=>{passed++;console.log('PASS '+name)})

const json=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body})
function fakes({user=true,allowed=true,used=3,speech={status:200,bytes:[73,68,51]}}={}){
 const calls=[]
 const fetch=async(url,init={})=>{calls.push({url,init})
  if(url.endsWith('/auth/v1/user'))return user?json(200,{id:'u1'}):json(401,{})
  if(url.endsWith('/rpc/kono_voice_take'))return json(200,{allowed,used,limit:40})
  if(url.endsWith('/rpc/kono_ai_take'))throw Error('the voice must not use AI requests')
  if(url==='https://api.openai.com/v1/audio/speech')return {ok:speech.status===200,status:speech.status,arrayBuffer:async()=>new Uint8Array(speech.bytes).buffer}
  throw Error('unexpected '+url)}
 return {calls,deps:{fetch,openaiKey:'sk-test',supabaseUrl:'https://x.supabase.co',supabaseKey:'pub'}}
}

;(async()=>{
 await test('natural voice: sign-in and the voice allowance (not the AI one) are checked before OpenAI; the clip comes back as base64 MP3',async()=>{
  let f=fakes(),r=await handleVoice('tok',{text:'  Today,\n Wednesday. '},f.deps)
  assert.equal(r.status,200);assert.equal(r.body.audio,'SUQz');assert.equal(r.body.type,'audio/mpeg');assert.equal(r.body.used,3)
  const call=f.calls.find(c=>c.url.includes('openai')),sent=JSON.parse(call.init.body)
  assert.equal(call.init.headers.authorization,'Bearer sk-test')
  assert.equal(sent.model,'gpt-4o-mini-tts');assert.equal(sent.voice,'coral');assert.equal(sent.input,'Today, Wednesday.');assert.match(sent.instructions,/warm/)
  f=fakes();await handleVoice('tok',{text:'Hi'},{...f.deps,model:'tts-1',voice:'nova'})
  const old=JSON.parse(f.calls.at(-1).init.body);assert.equal(old.voice,'nova');assert.equal(old.instructions,undefined,'older models don’t take directions')
 })
 await test('natural voice: off without a key, signed out, expired, over the 40 a day, or with bad text, and OpenAI is never called',async()=>{
  let f=fakes(),r=await handleVoice('tok',{text:'x'},{...f.deps,openaiKey:undefined});assert.equal(r.status,503);assert.equal(f.calls.length,0)
  f=fakes();r=await handleVoice('',{text:'x'},f.deps);assert.equal(r.status,401);assert.equal(f.calls.length,0)
  f=fakes({user:false});r=await handleVoice('bad',{text:'x'},f.deps);assert.equal(r.status,401);assert.ok(!f.calls.some(c=>c.url.includes('openai')))
  f=fakes({allowed:false,used:40});r=await handleVoice('tok',{text:'x'},f.deps);assert.equal(r.status,429);assert.match(r.body.error,/40 answers a day/);assert.ok(!f.calls.some(c=>c.url.includes('openai')))
  for(const bad of [{},{text:''},{text:'   '},{text:42},{text:'x'.repeat(MAX_VOICE_TEXT+1)}]){
   assert.equal(typeof readVoiceRequest(bad),'object',JSON.stringify(bad).slice(0,40))
   f=fakes();r=await handleVoice('tok',bad,f.deps);assert.equal(r.status,400);assert.equal(f.calls.length,0)
  }
  f=fakes({speech:{status:500,bytes:[]}});r=await handleVoice('tok',{text:'x'},f.deps);assert.equal(r.status,502)
  f=fakes({speech:{status:200,bytes:[]}});r=await handleVoice('tok',{text:'x'},f.deps);assert.equal(r.status,502,'an empty clip is an error')
 })
 await test('device voice: Premium beats Enhanced beats the standard voice; novelty voices and other languages never win',()=>{
  const iphone=[
   {name:'Albert',lang:'en-US',voiceURI:'com.apple.speech.synthesis.voice.Albert'},
   {name:'Samantha',lang:'en-US',voiceURI:'com.apple.voice.compact.en-US.Samantha'},
   {name:'Amélie',lang:'fr-CA',voiceURI:'com.apple.voice.premium.fr-CA.Amelie'},
   {name:'Zoe (Enhanced)',lang:'en-US',voiceURI:'com.apple.voice.enhanced.en-US.Zoe'},
   {name:'Ava (Premium)',lang:'en-US',voiceURI:'com.apple.voice.premium.en-US.Ava'},
  ]
  assert.equal(bestVoice(iphone,'en-US').name,'Ava (Premium)')
  assert.equal(bestVoice(iphone.slice(0,4),'en-US').name,'Zoe (Enhanced)')
  assert.equal(bestVoice(iphone.slice(0,2),'en-US').name,'Samantha','a novelty voice never beats a normal one')
  assert.equal(hasNaturalVoice(iphone.slice(0,2),'en-US'),false,'no Premium or Enhanced voice: iPhone shows how to download one')
  assert.equal(hasNaturalVoice(iphone,'en-US'),true)
  assert.equal(bestVoice([{name:'Daniel',lang:'en-GB'},{name:'Karen',lang:'en-AU'},{name:'Samantha',lang:'en-US'}],'en-US').name,'Samantha','the exact region first')
  assert.equal(bestVoice([{name:'Daniel',lang:'en_GB'}],'en-US').name,'Daniel','another English voice beats none')
  assert.equal(bestVoice([{name:'Thomas',lang:'fr-FR'}],'en-US'),undefined)
  const edge=[{name:'Microsoft David - English (United States)',lang:'en-US'},{name:'Microsoft Aria Online (Natural) - English (United States)',lang:'en-US'}]
  assert.equal(bestVoice(edge,'en-US').name,'Microsoft Aria Online (Natural) - English (United States)')
  assert.equal(voiceQuality({name:'Google US English',lang:'en-US'}),1)
 })
 await test('iPhone and iPad (including iPadOS, which says it’s a Mac) use the device voice; a Mac or Android doesn’t',()=>{
  assert.ok(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'))
  assert.ok(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15','MacIntel',5),'iPadOS')
  assert.ok(!isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15','MacIntel',0))
  assert.ok(!isAppleMobile('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36','Linux armv8l',5))
 })
 console.log(passed+'/4 voice groups passed.')
})().catch(e=>{console.error(e);process.exit(1)})
