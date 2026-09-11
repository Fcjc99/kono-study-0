import type { Plugin } from 'vite'
import { openLocalDatabase } from './local-database.ts'
/** Registered after Sites' dev auth middleware, which strips spoofed identity headers. */
export function localApi():Plugin{return {name:'kono-local-api',configureServer(server){
 const DB=openLocalDatabase(server.config.root)
 server.httpServer?.once('close',()=>DB.close())
 server.middlewares.use(async(req,res,next)=>{
  if(!req.url?.startsWith('/api/'))return next()
  try{
   const authority=new URL('http://'+req.headers.host)
   if(!['localhost','127.0.0.1','[::1]'].includes(authority.hostname)){res.statusCode=403;res.end('Local development only');return}
   const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value)
   const buffers:Buffer[]=[];let size=0
   for await(const value of req){const chunk=Buffer.from(value);size+=chunk.length;if(size>800000){res.statusCode=413;res.end('Request too large');return}buffers.push(chunk)}
   const request=new Request(new URL(req.url,authority),{method:req.method,headers,body:['GET','HEAD'].includes(req.method??'GET')?undefined:Buffer.concat(buffers)})
   const module=await server.ssrLoadModule('/server/index.ts')
   const response:Response=await module.default.fetch(request,{DB,ASSETS:{fetch:async()=>new Response('Not found',{status:404})}})
   res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(Buffer.from(await response.arrayBuffer()))
  }catch{res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Local API unavailable. Check the development terminal.'}))}
 })
}}}
