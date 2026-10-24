// The shop's AI fitting room token logic (src/shop/tryonToken.ts) with a fake Decart: only our own pages can
// mint, the secret key is only ever sent to Decart, and the client key is limited to the try-on model, the
// asking origin and a short session.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const file=path.join(root,'src/shop/tryonToken.ts'),mod={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,JSON,URL})
const {mintTryOnToken,originAllowed,TRYON_MODEL,TRYON_SESSION_SECONDS}=mod.exports
;(async()=>{
 assert.ok(originAllowed('https://kono.shop','kono.shop'))
 assert.ok(originAllowed('http://localhost:5173','localhost:5173'),'local development')
 assert.ok(!originAllowed('http://kono.shop','kono.shop'),'plain http is refused off localhost')
 assert.ok(!originAllowed('https://evil.example','kono.shop'))
 assert.ok(!originAllowed(undefined,'kono.shop'),'no Origin header, no token')
 assert.ok(!originAllowed('not a url','kono.shop'))
 assert.ok(originAllowed('https://www.kono.app','kono.shop','https://kono.app, https://www.kono.app'),'extra origins from KONO_SHOP_ORIGINS')
 const calls=[]
 const fetch=async(url,init)=>{calls.push({url,init});return {ok:true,status:200,json:async()=>({apiKey:'ek_1',expiresAt:'soon'})}}
 let r=await mintTryOnToken('https://kono.shop',{apiKey:'sk_secret',fetch})
 assert.equal(r.status,200);assert.deepEqual({...r.body},{apiKey:'ek_1',expiresAt:'soon'})
 assert.equal(calls[0].url,'https://api.decart.ai/v1/client/tokens');assert.equal(calls[0].init.headers['X-API-KEY'],'sk_secret')
 const sent=JSON.parse(calls[0].init.body)
 assert.deepEqual(sent.allowedModels,[TRYON_MODEL]);assert.deepEqual(sent.allowedOrigins,['https://kono.shop'])
 assert.equal(sent.constraints.realtime.maxSessionDuration,TRYON_SESSION_SECONDS);assert.ok(sent.expiresIn<=300)
 assert.ok(!JSON.stringify(r.body).includes('sk_secret'),'the secret key never comes back')
 calls.length=0;r=await mintTryOnToken('https://kono.shop',{apiKey:undefined,fetch});assert.equal(r.status,503);assert.equal(calls.length,0)
 r=await mintTryOnToken('https://kono.shop',{apiKey:'sk',fetch:async()=>({ok:false,status:401,json:async()=>({})})});assert.equal(r.status,502)
 r=await mintTryOnToken('https://kono.shop',{apiKey:'sk',fetch:async()=>({ok:true,status:200,json:async()=>({})})});assert.equal(r.status,502)
 console.log('PASS try-on tokens: own origins only, secret stays on the server, keys limited to the try-on model')
})().catch(e=>{console.error(e);process.exit(1)})
