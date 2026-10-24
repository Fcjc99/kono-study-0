/** The AI try-on's server half: swaps the secret DECART_API_KEY for a short-lived client key the browser can
 * use, limited to the try-on model, to the page's own origin and to a few minutes of video. Shared by the
 * Vercel function (api/tryon-token.ts) and the local/worker server (server/index.ts). */
export const TRYON_MODEL='lucy-vton-latest'
/** Seconds a try-on session may run before Decart ends it (each one costs realtime credits). */
export const TRYON_SESSION_SECONDS=180
const DECART_API='https://api.decart.ai'

type Deps={apiKey?:string;fetch:typeof fetch;allowedOrigins?:string}
export type TokenResult={status:number;body:{apiKey?:string;expiresAt?:string;error?:string}}

/** Origins that may mint: the site itself, plus any listed in KONO_SHOP_ORIGINS (comma separated). */
export function originAllowed(origin:string|undefined,host:string|undefined,extra=''):origin is string{
 if(!origin||!host)return false
 let url:URL
 try{url=new URL(origin)}catch{return false}
 if(url.host===host&&(url.protocol==='https:'||['localhost','127.0.0.1'].includes(url.hostname)))return true
 return extra.split(',').map(s=>s.trim()).filter(Boolean).includes(url.origin)
}

export async function mintTryOnToken(origin:string,deps:Deps):Promise<TokenResult>{
 if(!deps.apiKey)return {status:503,body:{error:'The AI fitting room isn’t switched on yet.'}}
 const response=await deps.fetch(DECART_API+'/v1/client/tokens',{
  method:'POST',
  headers:{'X-API-KEY':deps.apiKey,'content-type':'application/json'},
  body:JSON.stringify({expiresIn:120,allowedModels:[TRYON_MODEL],allowedOrigins:[origin],constraints:{realtime:{maxSessionDuration:TRYON_SESSION_SECONDS}},metadata:{app:'kono-shop'}}),
 })
 if(!response.ok)return {status:502,body:{error:'The AI fitting room is busy. Try again in a moment.'}}
 const data=await response.json() as {apiKey?:string;expiresAt?:string}
 if(!data.apiKey)return {status:502,body:{error:'The AI fitting room is busy. Try again in a moment.'}}
 return {status:200,body:{apiKey:data.apiKey,expiresAt:data.expiresAt}}
}
