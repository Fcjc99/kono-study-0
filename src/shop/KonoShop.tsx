import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import './shop.css'
import { POLOS, POLO_DETAILS, SIZES } from './polos'
import { defaultFit, drawPolo, ease, fitFromPose, loadPose, type Fit } from './tryOn'

type Source='none'|'camera'|'photo'
const NO_TWEAK={scale:1,dx:0,dy:0}
const MAX_PHOTO=1400
const price=(p:number|null)=>p==null?'Coming soon':new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(p)

/** Every polo image loaded once, so switching colours mid-try-on is instant. */
const shirtImages=new Map<string,HTMLImageElement>()
const shirtFor=(src:string)=>{let img=shirtImages.get(src);if(!img){img=new Image();img.src=src;shirtImages.set(src,img)}return img}

/** kono.shop: the polo collection with a live try-on. The camera or a photo stays in the browser; a pose model
 * (served from /tryon) finds the shoulders and hips and the polo is drawn over them, frame by frame. */
export default function KonoShop(){
 const [poloId,setPoloId]=useState(POLOS[0].id)
 const [size,setSize]=useState<string>('M')
 const [source,setSource]=useState<Source>('none')
 const [status,setStatus]=useState('')
 const [busy,setBusy]=useState(false)
 const [tweak,setTweak]=useState(NO_TWEAK)
 const [found,setFound]=useState(true)
 const polo=POLOS.find(p=>p.id===poloId)??POLOS[0]
 const canvasRef=useRef<HTMLCanvasElement>(null)
 const videoRef=useRef<HTMLVideoElement>(null)
 const fileRef=useRef<HTMLInputElement>(null)
 const stageRef=useRef<HTMLDivElement>(null)
 const photoRef=useRef<HTMLImageElement|null>(null)
 const poseRef=useRef<PoseLandmarker|null>(null)
 const fitRef=useRef<Fit|null>(null)
 const live=useRef({polo,tweak})
 useEffect(()=>{live.current={polo,tweak}},[polo,tweak])
 const drag=useRef<{x:number;y:number;dx:number;dy:number}|null>(null)

 useEffect(()=>{POLOS.forEach(p=>shirtFor(p.image))},[])
 useEffect(()=>{document.title='KONO Shop: Polos';return()=>{document.title='KONO — Study Sanctuary'}},[])

 const stopCamera=useCallback(()=>{
  const video=videoRef.current,stream=video?.srcObject as MediaStream|null
  stream?.getTracks().forEach(t=>t.stop())
  if(video)video.srcObject=null
 },[])
 useEffect(()=>stopCamera,[stopCamera])

 const pose=async(mode:'VIDEO'|'IMAGE')=>{
  setStatus('Getting the fitting room ready…')
  const p=poseRef.current??(poseRef.current=await loadPose())
  await p.setOptions({runningMode:mode})
  return p
 }

 /** Camera: each new video frame is drawn, the pose read, and the polo eased onto it. */
 useEffect(()=>{
  if(source!=='camera')return
  const video=videoRef.current,canvas=canvasRef.current,ctx=canvas?.getContext('2d')
  if(!video||!canvas||!ctx)return
  let raf=0,last=-1,misses=0
  const tick=()=>{
   raf=requestAnimationFrame(tick)
   if(video.readyState<2||video.currentTime===last)return
   last=video.currentTime
   if(canvas.width!==video.videoWidth){canvas.width=video.videoWidth;canvas.height=video.videoHeight}
   const {width:w,height:h}=canvas
   ctx.drawImage(video,0,0,w,h)
   const lm=poseRef.current?.detectForVideo(video,performance.now()).landmarks[0]
   const next=fitFromPose(lm,w,h)
   if(next){misses=0;fitRef.current=ease(fitRef.current,next);setFound(true)}
   else if(++misses>20){fitRef.current=null;setFound(false)}
   if(fitRef.current)drawPolo(ctx,shirtFor(live.current.polo.image),fitRef.current,live.current.tweak)
  }
  raf=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(raf)
 },[source])

 /** Photo: drawn once per change (polo, size tweak), on the fit found when it was chosen. */
 const drawPhoto=useCallback(()=>{
  const img=photoRef.current,canvas=canvasRef.current,ctx=canvas?.getContext('2d')
  if(!img||!canvas||!ctx)return
  ctx.drawImage(img,0,0,canvas.width,canvas.height)
  const shirt=shirtFor(polo.image)
  const draw=()=>drawPolo(ctx,shirt,fitRef.current??defaultFit(canvas.width,canvas.height),tweak)
  if(shirt.complete)draw();else shirt.onload=()=>{ctx.drawImage(img,0,0,canvas.width,canvas.height);draw()}
 },[polo.image,tweak])
 useEffect(()=>{if(source==='photo')drawPhoto()},[source,drawPhoto])

 const startCamera=async()=>{
  if(!navigator.mediaDevices?.getUserMedia){setStatus('This browser can’t open a camera. Try a photo instead.');return}
  setBusy(true);setTweak(NO_TWEAK);fitRef.current=null
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false})
   const video=videoRef.current!
   video.srcObject=stream
   await video.play()
   await pose('VIDEO')
   setSource('camera');setStatus('');stageRef.current?.scrollIntoView({behavior:'smooth',block:'center'})
  }catch(error){
   stopCamera()
   setStatus(error instanceof DOMException&&error.name==='NotAllowedError'?'Camera access was blocked. Allow it in your browser, or upload a photo instead.':'The camera didn’t start. You can upload a photo instead.')
  }finally{setBusy(false)}
 }

 const choosePhoto=async(file:File|undefined)=>{
  if(!file)return
  setBusy(true);setTweak(NO_TWEAK);stopCamera();setSource('none')
  try{
   const img=new Image()
   img.src=URL.createObjectURL(file)
   await img.decode()
   const canvas=canvasRef.current!,k=Math.min(1,MAX_PHOTO/Math.max(img.naturalWidth,img.naturalHeight))
   canvas.width=Math.round(img.naturalWidth*k);canvas.height=Math.round(img.naturalHeight*k)
   photoRef.current=img
   let fit:Fit|null=null
   try{const p=await pose('IMAGE');fit=fitFromPose(p.detect(img).landmarks[0],img.naturalWidth,img.naturalHeight)}catch{/* falls back to placing by hand */}
   fitRef.current=fit&&{...fit,x:fit.x*k,y:fit.y*k,sx:fit.sx*k,sy:fit.sy*k}
   setFound(!!fit);setSource('photo');setStatus('')
   stageRef.current?.scrollIntoView({behavior:'smooth',block:'center'})
  }catch{setStatus('That file didn’t open as a photo. Try a JPG or PNG.')}
  finally{setBusy(false);if(fileRef.current)fileRef.current.value=''}
 }

 const close=()=>{stopCamera();setSource('none');setStatus('');fitRef.current=null;photoRef.current=null}

 const snapshot=()=>canvasRef.current?.toBlob(blob=>{
  if(!blob)return
  const a=document.createElement('a')
  a.href=URL.createObjectURL(blob);a.download=`kono-${polo.id}.png`;a.click()
  setTimeout(()=>URL.revokeObjectURL(a.href),4000)
 },'image/png')

 /** Drag the polo into place; the camera view is mirrored, so sideways moves are flipped to match. */
 const onDown=(e:ReactPointerEvent<HTMLCanvasElement>)=>{if(source==='none')return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,dx:tweak.dx,dy:tweak.dy}}
 const onMove=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
  const d=drag.current,c=e.currentTarget
  if(!d)return
  const k=c.width/c.getBoundingClientRect().width,flip=source==='camera'?-1:1
  setTweak(t=>({...t,dx:d.dx+(e.clientX-d.x)*k*flip,dy:d.dy+(e.clientY-d.y)*k}))
 }
 const onUp=()=>{drag.current=null}

 const pick=(id:string)=>{setPoloId(id);if(source==='none')stageRef.current?.scrollIntoView({behavior:'smooth',block:'center'})}

 return <div className="kshop" style={{'--polo':polo.accent} as CSSProperties}>
  <header className="kshop-bar">
   <a className="kshop-brand" href="/shop" aria-label="KONO shop home"><img src="/brand-logo.svg" alt="" width={28} height={28}/><b>KONO</b><span>shop</span></a>
   <nav><a href="#collection">Collection</a><a href="#fitting">Try on</a><a className="kshop-app" href="/">Open the KONO app</a></nav>
  </header>

  <section className="kshop-hero" id="fitting">
   <div className="kshop-stage" ref={stageRef}>
    <div className={'kshop-frame'+(source!=='none'?' is-live':'')+(source==='camera'?' is-mirror':'')}>
     <video ref={videoRef} playsInline muted hidden/>
     <canvas ref={canvasRef} hidden={source==='none'} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label={`You wearing the ${polo.name} in ${polo.colorway}`}/>
     {source==='none'&&<div className="kshop-idle">
      <img key={polo.id} className="kshop-idle-polo" src={polo.image} alt={`${polo.name}, ${polo.colorway}`} width={796} height={1000}/>
      <div className="kshop-idle-cta">
       <p>See it on you</p>
       <div className="kshop-buttons">
        <button type="button" className="kshop-btn is-primary" onClick={startCamera} disabled={busy}>{busy?'Opening…':'Use my camera'}</button>
        <button type="button" className="kshop-btn" onClick={()=>fileRef.current?.click()} disabled={busy}>Upload a photo</button>
       </div>
      </div>
     </div>}
     {source!=='none'&&!found&&<p className="kshop-hint">{source==='camera'?'Step back so your shoulders are in view':'Couldn’t find shoulders. Drag the polo into place.'}</p>}
     {source!=='none'&&<button type="button" className="kshop-close" onClick={close} aria-label="Close the fitting room">×</button>}
    </div>
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e=>choosePhoto(e.target.files?.[0])}/>
    {status&&<p className="kshop-status" role="status">{status}</p>}
    {source!=='none'&&<div className="kshop-tools">
     <label>Size on you<input type="range" min={.8} max={1.3} step={.01} value={tweak.scale} onChange={e=>setTweak(t=>({...t,scale:+e.target.value}))}/></label>
     <button type="button" className="kshop-btn is-small" onClick={()=>setTweak(NO_TWEAK)}>Reset fit</button>
     <button type="button" className="kshop-btn is-small" onClick={()=>fileRef.current?.click()}>{source==='photo'?'Another photo':'Use a photo'}</button>
     {source==='photo'&&<button type="button" className="kshop-btn is-small" onClick={startCamera}>Use camera</button>}
     <button type="button" className="kshop-btn is-small is-primary" onClick={snapshot}>Save picture</button>
    </div>}
    <p className="kshop-private">Your camera and photos never leave this device. Nothing is uploaded.</p>
   </div>

   <div className="kshop-info">
    <span className="kshop-eyebrow">Summer collection</span>
    <h1>{polo.name}</h1>
    <p className="kshop-colorway">{polo.colorway}</p>
    <p className="kshop-price">{price(polo.price)}</p>
    <p className="kshop-blurb">{polo.blurb}</p>
    <div className="kshop-field"><span>Colour</span><div className="kshop-swatches" role="radiogroup" aria-label="Colour">
     {POLOS.map(p=><button key={p.id} type="button" role="radio" aria-checked={p.id===poloId} aria-label={p.colorway} className="kshop-swatch" style={{background:p.swatch}} onClick={()=>setPoloId(p.id)}><img src={p.image} alt="" width={796} height={1000}/></button>)}
    </div></div>
    <div className="kshop-field"><span>Size</span><div className="kshop-sizes" role="radiogroup" aria-label="Size">
     {SIZES.map(s=><button key={s} type="button" role="radio" aria-checked={s===size} className="kshop-size" onClick={()=>setSize(s)}>{s}</button>)}
    </div></div>
    <button type="button" className="kshop-btn is-primary is-wide" disabled={polo.price==null}>{polo.price==null?'Coming soon':`Add ${size} to bag`}</button>
    <ul className="kshop-details">{POLO_DETAILS.map(d=><li key={d}>{d}</li>)}</ul>
   </div>
  </section>

  <section className="kshop-collection" id="collection">
   <h2>The polos</h2>
   <div className="kshop-grid">
    {POLOS.map(p=><button key={p.id} type="button" className={'kshop-card'+(p.id===poloId?' is-on':'')} style={{'--card':p.swatch} as CSSProperties} onClick={()=>pick(p.id)}>
     <span className="kshop-card-art"><img src={p.image} alt="" width={796} height={1000} loading="lazy"/></span>
     <span className="kshop-card-text"><b>{p.name}</b><span>{p.colorway}</span><em>{price(p.price)}</em></span>
     <span className="kshop-card-try">Try it on</span>
    </button>)}
   </div>
  </section>

  <footer className="kshop-foot"><span>© KONO</span><a href="/">Back to your study sanctuary</a></footer>
 </div>
}
