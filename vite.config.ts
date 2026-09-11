import { defineConfig } from 'vite'
import {ocrAssets} from './tools/ocr-assets.ts'
import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'
import { localApi } from './tools/vite-local-api.ts'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export default defineConfig(({isSsrBuild,command})=>({
  define:{
    __KONO_SUPABASE_URL__:JSON.stringify(process.env.VITE_SUPABASE_URL??'https://ooavktekwoguhttauvte.supabase.co'),
    __KONO_SUPABASE_ANON_KEY__:JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY??'sb_publishable_5GOB_LMND1W2NSNmXwQLBA_RTFVemNR'),
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
    },
  }],
  ssr:{noExternal:true},
  build: {
    outDir:isSsrBuild?'dist/server':'dist/client',
    emptyOutDir:true,
    rollupOptions:isSsrBuild?{output:{entryFileNames:'index.js'}}:undefined,
    // Phaser is loaded lazily by GardenCard as a dedicated Sanctuary engine chunk.
    // The limit reflects that intentional game-engine payload instead of treating it
    // like an oversized application route.
    chunkSizeWarningLimit: 1400,
  },
}))
