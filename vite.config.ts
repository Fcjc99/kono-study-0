import { defineConfig } from 'vite'
import {ocrAssets} from './tools/ocr-assets.ts'
import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'
import { localApi } from './tools/vite-local-api.ts'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'

type ManifestChunk={file:string;css?:string[];imports?:string[];dynamicImports?:string[]}
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
  // Panels split out of the startup bundle (src/lazyPanel.tsx) still open offline: precache them in
  // the background. Heavy importers (PDF, OCR) stay runtime-cached only.
  for(const dep of manifest[entryKey].dynamicImports??[])if(dep.startsWith('src/components/'))walk(dep)
  // Opening KONO offline also needs the sign-in code (a signed-in student's plan is under their
  // account) and the Sanctuary island, the first page. PDF, OCR and the rest stay runtime-cached.
  for(const dep of ['src/store/supabaseRemote.ts','src/game/scenes/Stage0Scene.ts'])walk(dep)
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
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==PRECACHE_NAME&&key!==RUNTIME_NAME&&key!=='kono-voice'&&key!=='kono-prefs').map(key=>caches.delete(key)))).then(()=>self.clients.claim()))})
// Lock-screen reminders (api/push-send): show them, and open KONO when one is tapped.
// The 7 AM "due today" reminder also puts that count on the app icon, so it's right each morning even
// before KONO is opened ("Due today: X" is 1, "3 things due today" is 3). The open app keeps it current
// after that, and writes kono-prefs/badge-off when the person turns the number off (store/appBadge.ts).
const morningBadge=d=>{
 if(!String(d.tag||'').startsWith('due-')||typeof self.navigator.setAppBadge!=='function')return Promise.resolve()
 const count=Number((String(d.title||'').match(/^(\\d+) things due today/)||[])[1]||1)
 return caches.open('kono-prefs').then(cache=>cache.match('/badge-off')).then(off=>off?undefined:self.navigator.setAppBadge(count)).catch(()=>{})
}
self.addEventListener('push',event=>{
 let d={}
 try{d=event.data?event.data.json():{}}catch{d={title:'KONO',body:event.data?event.data.text():''}}
 event.waitUntil(Promise.all([self.registration.showNotification(d.title||'KONO',{body:d.body||'',tag:d.tag||undefined,icon:'/icons/kono-192.png',badge:'/icons/kono-badge.png'}),morningBadge(d)]))
})
self.addEventListener('notificationclick',event=>{
 event.notification.close()
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list)if('focus' in client)return client.focus();return self.clients.openWindow('/')}))
})
self.addEventListener('fetch',event=>{
 const request=event.request
 if(request.method!=='GET')return
 const url=new URL(request.url)
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.match('/',{cacheName:PRECACHE_NAME,ignoreVary:true})))
  return
 }
 event.respondWith((async()=>{
  // ignoreVary: module scripts are requested with an Origin header and precached without one, so a
  // "Vary: Origin" response would otherwise never match offline. Same-origin files don't vary by it.
  const cached=await caches.match(request,{cacheName:PRECACHE_NAME,ignoreVary:true})??await caches.match(request,{cacheName:RUNTIME_NAME,ignoreVary:true})
  if(cached){event.waitUntil(fetch(request).then(response=>{if(response.ok)caches.open(RUNTIME_NAME).then(cache=>cache.put(request,response))}).catch(()=>{}));return cached}
  try{
   const response=await fetch(request)
   if(response.ok){
    const copy=response.clone()
    caches.open(RUNTIME_NAME).then(cache=>cache.put(request,copy)).catch(()=>{})
   }
   return response
  }catch(error){
   const fallback=await caches.match(request,{cacheName:RUNTIME_NAME,ignoreVary:true})
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
    // The sign-in code is needed before KONO can open (a signed-in plan lives in the account), but it's
    // a dynamic import, so the browser only asks for it once the main script has run. Preloading it
    // downloads it alongside the main script instead of after.
    // The stylesheet moves from <head> to just after the splash in #root: a stylesheet only holds back
    // the page after it, so the splash paints at once instead of after the CSS download. The app's
    // script still waits for the stylesheet before it runs, so nothing shows unstyled.
    transformIndexHtml:{order:'post',handler(html,ctx){
      if(!ctx.bundle)return html
      const chunk=Object.values(ctx.bundle).find(c=>c.type==='chunk'&&c.facadeModuleId?.endsWith('/src/store/supabaseRemote.ts'))
      if(chunk)html=html.replace('</head>',`  <link rel="modulepreload" crossorigin fetchpriority="low" href="/${chunk.fileName}">\n  </head>`)
      const sheet=html.match(/\s*<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">/)
      if(sheet&&html.includes('<div id="root">'))html=html.replace(sheet[0],'').replace(/(<div id="root">[\s\S]*?<\/div>)/,'$1\n    '+sheet[0].trim())
      return html
    }},
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
