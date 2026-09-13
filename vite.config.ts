import { defineConfig } from 'vite'
import {ocrAssets} from './tools/ocr-assets.ts'
import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'
import { localApi } from './tools/vite-local-api.ts'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'

type ManifestChunk={file:string;css?:string[];imports?:string[]}
function precacheList(manifest:Record<string,ManifestChunk>):string[]{
  const entryKey=Object.keys(manifest).find(k=>(manifest[k] as ManifestChunk&{isEntry?:boolean}).isEntry)
  if(!entryKey)return []
  const seen=new Set<string>(),files=new Set<string>()
  const walk=(key:string)=>{
    if(seen.has(key))return
    seen.add(key)
    const chunk=manifest[key];if(!chunk)return
    files.add('/'+chunk.file)
    for(const css of chunk.css??[])files.add('/'+css)
    for(const dep of chunk.imports??[])walk(dep)
  }
  walk(entryKey)
  return [...files]
}
function writeServiceWorker(outDir:string){
  const manifest=JSON.parse(readFileSync(resolve(outDir,'.vite/manifest.json'),'utf8')) as Record<string,ManifestChunk>
  const assets=precacheList(manifest)
  const precache=['/','/favicon.svg',...assets]
  const version=createHash('sha256').update(precache.slice().sort().join('|')).digest('hex').slice(0,12)
  const sw=`// Generated at build time — do not edit. Precaches the app shell so KONO can open offline.
const VERSION=${JSON.stringify(version)}
const PRECACHE_NAME='kono-precache-'+VERSION
const RUNTIME_NAME='kono-runtime'
const PRECACHE=${JSON.stringify(precache)}
self.addEventListener('install',event=>{event.waitUntil(caches.open(PRECACHE_NAME).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting()))})
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==PRECACHE_NAME&&key!==RUNTIME_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',event=>{
 const request=event.request
 if(request.method!=='GET')return
 const url=new URL(request.url)
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.match('/',{cacheName:PRECACHE_NAME})))
  return
 }
 event.respondWith((async()=>{
  const cached=await caches.match(request,{cacheName:PRECACHE_NAME})??await caches.match(request,{cacheName:RUNTIME_NAME})
  if(cached){event.waitUntil(fetch(request).then(response=>{if(response.ok)caches.open(RUNTIME_NAME).then(cache=>cache.put(request,response))}).catch(()=>{}));return cached}
  try{
   const response=await fetch(request)
   if(response.ok){
    const copy=response.clone()
    caches.open(RUNTIME_NAME).then(cache=>cache.put(request,copy)).catch(()=>{})
   }
   return response
  }catch(error){
   const fallback=await caches.match(request,{cacheName:RUNTIME_NAME})
   if(fallback)return fallback
   throw error
  }
 })())
})
`
  writeFileSync(resolve(outDir,'sw.js'),sw)
}

export default defineConfig(({isSsrBuild,command})=>({
  define:{
    // trim+|| (not ??) so an env var present but blank/whitespace-only still falls back, instead of
    // silently disabling cloud sign-in the way an unset var would not.
    __KONO_SUPABASE_URL__:JSON.stringify(process.env.VITE_SUPABASE_URL?.trim()||'https://ooavktekwoguhttauvte.supabase.co'),
    __KONO_SUPABASE_ANON_KEY__:JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY?.trim()||'sb_publishable_5GOB_LMND1W2NSNmXwQLBA_RTFVemNR'),
  },
  publicDir:command==='serve'?(process.env.KONO_ASSET_SOURCE??'public'):false,
  plugins: [react(),sites(),ocrAssets(Boolean(isSsrBuild)),...(command==='serve'?[localApi()]:[]),{
    name:'kono-production-assets',
    resolveId(id){if(id==='virtual:kono-shell')return '\0virtual:kono-shell'},
    load(id){if(id==='\0virtual:kono-shell')return 'export default '+JSON.stringify(command==='serve'?'':readFileSync('dist/client/index.html','utf8'))},
    closeBundle(){
      if(isSsrBuild)return
      const source=process.env.KONO_ASSET_SOURCE??resolve('public')
      const files=JSON.parse(readFileSync('tools/public-allowlist.json','utf8')) as string[]
      for(const path of files){if(!path.startsWith('/')||path.includes('..'))throw new Error('Invalid public asset path');const dest=resolve('dist/client','.'+path);mkdirSync(dirname(dest),{recursive:true});copyFileSync(resolve(source,'.'+path),dest)}
      writeServiceWorker(resolve('dist/client'))
    },
  }],
  ssr:{noExternal:true},
  build: {
    outDir:isSsrBuild?'dist/server':'dist/client',
    emptyOutDir:true,
    manifest:!isSsrBuild,
    rollupOptions:isSsrBuild?{output:{entryFileNames:'index.js'}}:undefined,
    // Phaser is loaded lazily by GardenCard as a dedicated Sanctuary engine chunk.
    // The limit reflects that intentional game-engine payload instead of treating it
    // like an oversized application route.
    chunkSizeWarningLimit: 1400,
  },
}))
