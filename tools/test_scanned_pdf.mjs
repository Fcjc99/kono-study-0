// Image-only PDF fixture entirely in memory. No personal document or network OCR.
import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createCanvas} from '@napi-rs/canvas'
import {createWorker} from 'tesseract.js'
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs'

const canvas=createCanvas(1400,600),ctx=canvas.getContext('2d')
ctx.fillStyle='white';ctx.fillRect(0,0,1400,600);ctx.fillStyle='black';ctx.font='42px sans-serif'
ctx.fillText('Biology Tuesday 10am-12pm',70,120)
ctx.fillText('Midterm 10/06/2026',70,220)
ctx.fillText('Read chapter 1 due 09/15/2026',70,320)
const jpeg=canvas.toBuffer('image/jpeg'),draw=Buffer.from('q 1400 0 0 600 0 0 cm /Im0 Do Q')
const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1400 600] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),Buffer.concat([Buffer.from('<< /Type /XObject /Subtype /Image /Width 1400 /Height 600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n'),jpeg,Buffer.from('\nendstream')]),Buffer.concat([Buffer.from('<< /Length '+draw.length+' >>\nstream\n'),draw,Buffer.from('\nendstream')])]
let pdf=Buffer.from('%PDF-1.4\n'),offsets=[0]
objects.forEach((object,i)=>{offsets.push(pdf.length);pdf=Buffer.concat([pdf,Buffer.from((i+1)+' 0 obj\n'),object,Buffer.from('\nendobj\n')])})
const xref=pdf.length
pdf=Buffer.concat([pdf,Buffer.from('xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF')])
const loading=getDocument({data:new Uint8Array(pdf),useSystemFonts:true}),document=await loading.promise
let worker
try{
 const page=await document.getPage(1);assert.equal((await page.getTextContent()).items.length,0)
 const rendered=createCanvas(1400,600)
 await page.render({canvasContext:rendered.getContext('2d'),viewport:page.getViewport({scale:1})}).promise
 worker=await createWorker('eng',1,{langPath:resolve('node_modules/@tesseract.js-data/eng/4.0.0'),cacheMethod:'none'})
 const {data:{text}}=await worker.recognize(rendered.toBuffer('image/png'))
 assert.match(text,/Biology Tuesday/i);assert.match(text,/10\/06\/2026/);assert.match(text,/chapter 1/i)
 console.log('PASS image-only PDF rendering and English OCR recovered class, exam and assignment text without a paid service.')
}finally{await worker?.terminate();await loading.destroy()}
