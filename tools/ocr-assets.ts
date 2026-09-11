import {readFileSync,copyFileSync,mkdirSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import type {Plugin} from 'vite'

// Explicit same-origin assets; no document is sent to an OCR service or CDN.
const files:Record<string,string>={
 '/ocr/tesseract-license.txt':'tesseract.js/LICENSE.md',
 '/ocr/tesseract-core-license.txt':'tesseract.js-core/LICENSE',
 '/ocr/pdfjs-license.txt':'pdfjs-dist/LICENSE',
 '/ocr/worker.min.js':'tesseract.js/dist/worker.min.js',
 '/ocr/eng.traineddata.gz':'@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',
 ...Object.fromEntries(['lstm','simd-lstm','relaxedsimd-lstm'].flatMap(name=>['wasm.js','wasm'].map(ext=>['/ocr/tesseract-core-'+name+'.'+ext,'tesseract.js-core/tesseract-core-'+name+'.'+ext])))
}
export function ocrAssets(ssr:boolean):Plugin{return {
 name:'kono-local-ocr-assets',
 configureServer(server){server.middlewares.use((req,res,next)=>{const key=(req.url??'').split('?')[0],path=files[key];if(!path)return next();try{res.setHeader('Content-Type',key.endsWith('.js')?'text/javascript':key.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.end(readFileSync(resolve('node_modules',path)))}catch{res.statusCode=503;res.end('OCR resources unavailable.')}})},
 closeBundle(){if(ssr)return;for(const [url,path] of Object.entries(files)){const target=resolve('dist/client','.'+url);mkdirSync(dirname(target),{recursive:true});copyFileSync(resolve('node_modules',path),target)}}
}}
