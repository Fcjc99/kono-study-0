import { z } from 'zod'
import shell from 'virtual:kono-shell'
import { normalizeData } from '../src/store/model'
import { deletePlan, readPlan, writePlan, type Database } from './database'
export type Env={DB:Database;ASSETS?:{fetch(request:Request):Promise<Response>}}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
const version=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER-1)
const putSchema=z.object({expectedRevision:version,operationId:z.string().uuid(),data:z.unknown()}).strict()
const deleteSchema=z.object({expectedRevision:version}).strict()
async function readBody(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('Expected JSON.')
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing request body.')
 const chunks:Uint8Array[]= [];let total=0
 while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>800000){await reader.cancel();throw new Error('This plan exceeds the 750 KB cloud limit. Export a backup before reducing it.')}chunks.push(value)}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}
function authenticatedUser(request:Request){
 const id=request.headers.get('oai-authenticated-user-id')
 if(!id||id.length>200)return null
 const raw=request.headers.get('oai-authenticated-user-full-name')??''
 let name=raw
 if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8')try{name=decodeURIComponent(raw)}catch{name=''}
 return {id,email:request.headers.get('oai-authenticated-user-email')??'',name}
}
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url)
 if(!url.pathname.startsWith('/api/')){
  const response=env.ASSETS?await env.ASSETS.fetch(request):request.method==='GET'&&!url.pathname.split('/').pop()?.includes('.')?new Response(shell,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}}):new Response('Not found',{status:404})
  const secure=new Response(response.body,response)
  secure.headers.set('X-Content-Type-Options','nosniff')
  secure.headers.set('Referrer-Policy','same-origin')
  // K-Quiz records lectures (microphone, scoped to this site only) and calls the student's own AI
  // provider key directly from the browser to generate study materials — connect-src is widened to
  // just those two providers, never a general allowlist.
  secure.headers.set('Permissions-Policy','camera=(), microphone=(self), geolocation=()')
  if(secure.headers.get('Content-Type')?.includes('text/html'))secure.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://generativelanguage.googleapis.com https://api.openai.com; object-src 'none'; base-uri 'self'; form-action 'self'")
  return secure
 }
 const user=authenticatedUser(request)
 if(url.pathname==='/api/session'&&request.method==='GET')return json({user})
 if(!user)return json({error:'Sign in to access your study data.'},401)
 if(request.headers.get('X-Kono-Account-ID')!==user.id)return json({error:'The signed-in account changed. Reload KONO before continuing.'},401)
 // Reject old open tabs before they read/strip unfamiliar fields or overwrite them.
 if(request.headers.get('X-Kono-Data-Version')!=='6')return json({error:'A newer KONO version is required. Export any unsaved work, then reload the page before syncing.'},426)
 if(!env.DB)return json({error:'Cloud storage is not configured. Your local copy remains available.'},503)
 if(!['GET','PUT','DELETE'].includes(request.method))return json({error:'Method not allowed.'},405)
 if(request.method!=='GET'&&(request.headers.get('origin')!==url.origin||request.headers.get('X-Kono-Request')!=='1'||request.headers.get('sec-fetch-site')==='cross-site'))return json({error:'Use KONO from its own website to save.'},403)
 try{
  if(url.pathname==='/api/plan'){
   if(request.method==='GET'){const row=await readPlan(env.DB,user.id);return json({revision:row?.revision??0,data:row?.data?JSON.parse(row.data):null})}
   const body=await readBody(request)
   if(request.method==='PUT'){
    const input=putSchema.parse(body),data=JSON.stringify(normalizeData(input.data))
    if(new TextEncoder().encode(data).length>750000)return json({error:'This plan exceeds the 750 KB cloud limit. Your local copy is preserved; export a backup.'},413)
    const previous=await readPlan(env.DB,user.id)
    if(previous?.operation===input.operationId)return json({revision:previous.revision})
    const revision=await writePlan(env.DB,user.id,input.expectedRevision,data,input.operationId)
    return revision===undefined?json({error:'Another device changed this plan. Retry sync.'},409):json({revision})
   }
   const input=deleteSchema.parse(body),revision=await deletePlan(env.DB,user.id,input.expectedRevision)
   return revision===undefined?json({error:'Plan changed. Refresh before deleting.'},409):json({revision,data:null})
  }
  if(url.pathname==='/api/history'&&request.method==='GET'){
   const result=await env.DB.prepare('SELECT revision, created_at FROM plan_history WHERE owner = ? ORDER BY revision DESC LIMIT 20').bind(user.id).all()
   return json({history:result.results})
  }
  if(/^\/api\/history\/\d+$/.test(url.pathname)&&request.method==='GET'){
   const revision=Number(url.pathname.split('/').pop())
   const row=await env.DB.prepare('SELECT data FROM plan_history WHERE owner = ? AND revision = ?').bind(user.id,revision).first<{data:string}>()
   return row?json({version:6,data:JSON.parse(row.data)}):json({error:'Backup not found.'},404)
  }
  return json({error:'Not found.'},404)
 }catch(error){
  if(error instanceof z.ZodError||error instanceof SyntaxError||error instanceof Error&&(error.message.startsWith('Invalid saved')||error.message.startsWith('Expected')||error.message.startsWith('Missing')||error.message.startsWith('This plan')))return json({error:error instanceof z.ZodError?'Invalid request. Check the backup format.':error.message},400)
  const requestId=crypto.randomUUID();console.error('KONO storage request failed',requestId)
  return json({error:'Storage is temporarily unavailable. Your device copy is preserved.',requestId},503)
 }
}}
