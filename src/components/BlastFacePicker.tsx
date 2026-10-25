import {useEffect,useRef,useState,type PointerEvent} from 'react'
import {clampFrame,cropFace,placement,readBlastFace,saveBlastFace,startFrame,type Frame} from '../store/blastFace'

/** KONO blast's start card: use a photo of your face for the blocks. Pick one (or take one on a phone), drag
 * it and zoom so your face fills the square, and Use this face; the blocks show it tinted in their colors.
 * Remove goes back to plain blocks. The photo stays on this device (store/blastFace). */
export default function BlastFacePicker({onChange}:{onChange?:(face:string|null)=>void}){
 const [face,setFace]=useState(()=>readBlastFace())
 const [img,setImg]=useState<HTMLImageElement|null>(null),[frame,setFrame]=useState<Frame>({zoom:1,x:0,y:0}),[error,setError]=useState('')
 const drag=useRef<{x:number;y:number;f:Frame}|null>(null),box=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null)
 const SIDE=200
 useEffect(()=>()=>{if(img)URL.revokeObjectURL(img.src)},[img])
 const pick=(file:File|undefined)=>{
  setError('')
  if(!file)return
  if(!file.type.startsWith('image/')){setError('That isn’t a photo. Pick a picture file.');return}
  const url=URL.createObjectURL(file),im=new Image()
  im.onload=()=>{setImg(im);setFrame(startFrame(im.naturalWidth,im.naturalHeight))}
  im.onerror=()=>{URL.revokeObjectURL(url);setError('KONO couldn’t open that photo. Try another one.')}
  im.src=url
 }
 const set=(f:Frame)=>{if(img)setFrame(clampFrame(img.naturalWidth,img.naturalHeight,f))}
 const down=(e:PointerEvent<HTMLDivElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,f:frame}}
 const move=(e:PointerEvent<HTMLDivElement>)=>{const d=drag.current;if(!d)return;set({...d.f,x:d.f.x+(e.clientX-d.x)/SIDE,y:d.f.y+(e.clientY-d.y)/SIDE})}
 const use=()=>{
  if(!img)return
  const out=cropFace(img,frame)
  saveBlastFace(out);setFace(out);onChange?.(out);setImg(null)
 }
 const remove=()=>{saveBlastFace(null);setFace(null);onChange?.(null)}
 const p=img?placement(img.naturalWidth,img.naturalHeight,SIDE,frame):null
 return <div className="blast-face" role="group" aria-label="Face blocks">
  <input ref={input} type="file" accept="image/*" hidden aria-label="Photo for the blocks" onChange={e=>{pick(e.target.files?.[0]);e.target.value=''}}/>
  <input ref={camera} type="file" accept="image/*" capture="user" hidden aria-label="Take a photo for the blocks" onChange={e=>{pick(e.target.files?.[0]);e.target.value=''}}/>
  {img&&p?<>
   <p className="blast-face-how">Drag your face into the square and zoom to fit.</p>
   <div ref={box} className="blast-face-crop" style={{width:SIDE,height:SIDE}} onPointerDown={down} onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
    <img src={img.src} alt="Your photo" draggable={false} style={{width:p.dw,height:p.dh,left:p.dx,top:p.dy}}/>
   </div>
   <label className="blast-face-zoom">Zoom <input type="range" min={1} max={4} step={0.05} value={frame.zoom} onChange={e=>set({...frame,zoom:Number(e.target.value)})}/></label>
   <div className="blast-face-actions"><button type="button" className="primary" onClick={use}>Use this face</button><button type="button" onClick={()=>setImg(null)}>Cancel</button></div>
  </>:face?<div className="blast-face-row">
   <span className="blast-face-preview" aria-hidden="true">{[0,1,2,3].map(i=><i key={i} className={'is-c'+[0,2,4,6][i]} style={{backgroundImage:`url(${face})`}}/>)}</span>
   <span className="blast-face-text"><b>Face blocks on</b><small>Your photo stays on this device.</small></span>
   <button type="button" onClick={()=>input.current?.click()}>Change</button><button type="button" onClick={remove}>Remove</button>
  </div>:<div className="blast-face-add">
   <p><b><span aria-hidden="true">😀</span> Use your face for the blocks</b><small>Your photo stays on this device.</small></p>
   <div className="blast-face-actions"><button type="button" onClick={()=>input.current?.click()}>🖼️ Choose a photo</button><button type="button" onClick={()=>camera.current?.click()}>📷 Take a photo</button></div>
  </div>}
  {error&&<p className="blast-face-error" role="alert">{error}</p>}
 </div>
}
