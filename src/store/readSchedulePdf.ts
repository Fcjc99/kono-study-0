import {pdfClassTableText,pdfSixDayTimetableText,pdfTimetableText} from './pdfTimetableText'
import type {Worker} from 'tesseract.js'

export async function readSchedulePdf(file:File,first:number,last:number,signal:AbortSignal,progress:(message:string)=>void,scanAll=true,preserveColumns:boolean|'six-day'|'class-table'|'find-class-table'=false){
 if(file.size>20*1024*1024)throw Error('Choose a PDF smaller than 20 MB. Split a large scan into smaller files.')
 if(!Number.isInteger(first)||!Number.isInteger(last)||first<1||last<first||last-first>=5)throw Error('Read up to five pages at a time.')
 const magic=new TextDecoder().decode(await file.slice(0,5).arrayBuffer());if(magic!=='%PDF-')throw Error('Choose a valid PDF file.')
 const pdfjs=await import('pdfjs-dist'),workerUrl=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
 pdfjs.GlobalWorkerOptions.workerSrc=workerUrl
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true})
 let worker:Worker|undefined
 const abort=()=>{void task.destroy();void worker?.terminate()}
 signal.addEventListener('abort',abort,{once:true})
 const check=()=>{if(signal.aborted)throw new DOMException('Reading canceled.','AbortError')}
 try{
  check();const doc=await task.promise;check();if(first>doc.numPages)throw Error('This PDF has only '+doc.numPages+' pages.')
  const stop=Math.min(last,doc.numPages),pages:string[]=[]
  for(let number=first;number<=stop;number++){
   check();progress('Reading page '+number+' of '+doc.numPages+'…')
   const page=await doc.getPage(number),content=await page.getTextContent()
   let text='',lastY:number|undefined
   for(const item of content.items){if(!('str' in item))continue;const y=item.transform[5];if(lastY!==undefined&&Math.abs(lastY-y)>3)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=y}
   // A class table found in the PDF's own text beats reading the page as a picture.
   const table=preserveColumns==='class-table'||preserveColumns==='find-class-table'?pdfClassTableText(content.items):null
   if(table)text=table
   else if(preserveColumns==='six-day')text=pdfSixDayTimetableText(content.items)
   else if(preserveColumns&&preserveColumns!=='find-class-table')text=pdfTimetableText(content.items)
   if(!table&&(scanAll||text.replace(/\s/g,'').length<40)){
    progress('Reading scanned page '+number+'… Keep KONO open.')
    if(!worker){const {createWorker}=await import('tesseract.js');check();worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',workerBlobURL:false,cacheMethod:'none',logger:m=>{if(!signal.aborted&&m.status==='recognizing text')progress('Scanned page '+number+' · '+Math.round(m.progress*100)+'%')}});check()}
    const native=page.getViewport({scale:1}),scale=Math.min(2.5,2200/Math.max(native.width,native.height)),viewport=page.getViewport({scale}),canvas=document.createElement('canvas')
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
    try{await page.render({canvas,viewport}).promise;check();text=(await worker.recognize(canvas)).data.text;check()}finally{canvas.width=0;canvas.height=0}
   }
   pages.push('Page '+number+'\n'+text.trim());page.cleanup()
   if(pages.join('\n').length>100000)throw Error('Too much text. Read fewer pages at a time.')
  }
  return pages.join('\n\n')
 }finally{signal.removeEventListener('abort',abort);await worker?.terminate();await task.destroy()}
}
/** Photos are processed in this browser. Only reviewed schedule records are saved. */
export async function readSchedulePhoto(file:File,signal:AbortSignal,progress:(message:string)=>void){
 if(file.size>20*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG or WebP image under 20 MB.')
 let worker:Worker|undefined
 const abort=()=>{void worker?.terminate()}
 signal.addEventListener('abort',abort,{once:true})
 const check=()=>{if(signal.aborted)throw new DOMException('Reading canceled.','AbortError')}
 const bitmap=await createImageBitmap(file)
 const canvas=document.createElement('canvas')
 try{
  check();if(bitmap.width*bitmap.height>30000000)throw Error('Crop or resize this image to less than 30 megapixels.')
  const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale)
  canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height)
  const {createWorker}=await import('tesseract.js');check()
  worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',workerBlobURL:false,cacheMethod:'none',logger:m=>{if(!signal.aborted&&m.status==='recognizing text')progress('Reading photo · '+Math.round(m.progress*100)+'%')}})
  check();const text=(await worker.recognize(canvas)).data.text;check();if(text.length>100000)throw Error('Crop this image to the schedule area.');return text
 }finally{signal.removeEventListener('abort',abort);bitmap.close();canvas.width=0;canvas.height=0;await worker?.terminate()}
}
