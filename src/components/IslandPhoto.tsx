import {useEffect,useState} from 'react'
import Modal from './Modal'

/** Photo mode: a clean picture of the island, with no buttons in it. The island itself is a canvas; the
 * decorations placed in Decorate sit on top as pictures, so they're drawn in at the same spots. */
async function capture(stage:HTMLElement):Promise<Blob>{
 const canvas=stage.querySelector('canvas')
 if(!canvas)throw Error('The island is still opening. Try again in a moment.')
 const box=canvas.getBoundingClientRect(),out=document.createElement('canvas')
 out.width=canvas.width;out.height=canvas.height
 const g=out.getContext('2d');if(!g)throw Error('Could not make the picture.')
 g.drawImage(canvas,0,0)
 const sx=canvas.width/box.width,sy=canvas.height/box.height
 for(const img of stage.querySelectorAll<HTMLImageElement>('.build-hotspot-layer img')){
  if(!img.complete||!img.naturalWidth)continue
  const r=img.getBoundingClientRect()
  try{g.drawImage(img,(r.left-box.left)*sx,(r.top-box.top)*sy,r.width*sx,r.height*sy)}catch{/* one picture can't stop the photo */}
 }
 return new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('Could not make the picture.')),'image/png'))
}

export default function IslandPhoto({stage,close}:{stage:HTMLElement;close:()=>void}){
 const [url,setUrl]=useState(''),[file,setFile]=useState<File|null>(null),[error,setError]=useState('')
 useEffect(()=>{
  let made=''
  capture(stage).then(blob=>{const f=new File([blob],'kono-island.png',{type:'image/png'});made=URL.createObjectURL(blob);setFile(f);setUrl(made)}).catch(e=>setError(e instanceof Error?e.message:'Could not make the picture.'))
  return()=>{if(made)URL.revokeObjectURL(made)}
 },[stage])
 const canShare=!!file&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]})
 return <Modal title="Island photo" close={close}><div className="island-photo">
  {error?<p role="alert">{error}</p>:url?<img src={url} alt="Your island"/>:<p className="lazy-panel-loading" aria-live="polite">Taking the picture…</p>}
  {url&&<div className="wb-toolbar"><a className="button-link primary" href={url} download="kono-island.png">⬇ Save picture</a>{canShare&&<button type="button" onClick={()=>void navigator.share({files:[file!],title:'My KONO island'}).catch(()=>undefined)}>Share</button>}</div>}
  <p className="wb-muted">Saved pictures make a nice phone or desktop wallpaper.</p>
 </div></Modal>
}
