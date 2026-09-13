import {useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent} from 'react'
import type {AppData, BuildPlacement} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {BUILD_ASSETS, BUILD_ASSET_BY_ID, BUILD_CATEGORIES, BUILD_CATEGORY_LABELS, type BuildCategory} from '../game/data/buildAssets'
import './sanctuary-build.css'

const nextRotation=(r:0|90|180|270):0|90|180|270=>r===0?90:r===90?180:r===180?270:0
const DRAG_THRESHOLD=5
const MIN_SCALE=0.3,MAX_SCALE=3,MIN_SKEW=-45,MAX_SKEW=45

export default function SanctuaryBuild({data,save}:{data:AppData;save:PlannerRepository['update']}){
 const profileId=data.activeProfileId
 const decor=data.sanctuaryDecor[profileId]??{profileId,placements:[]}
 const [category,setCategory]=useState<BuildCategory|null>(BUILD_CATEGORIES[0]??null)
 const [armed,setArmed]=useState<string|null>(null)
 const [selected,setSelected]=useState<string|null>(null)
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const canvasRef=useRef<HTMLDivElement|null>(null)
 const [dragId,setDragId]=useState<string|null>(null)
 const [dragPos,setDragPos]=useState<{x:number;y:number}|null>(null)
 const dragStart=useRef<{x:number;y:number;moved:boolean}|null>(null)

 const commit=async(placements:BuildPlacement[])=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return {...d,sanctuaryDecor:{...d.sanctuaryDecor,[profileId]:{profileId,placements}}}});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }

 const fractionFromEvent=(e:{clientX:number;clientY:number}):{x:number;y:number}=>{
  const rect=canvasRef.current?.getBoundingClientRect()
  if(!rect||!rect.width||!rect.height)return {x:.5,y:.5}
  return {x:Math.min(1,Math.max(0,(e.clientX-rect.left)/rect.width)),y:Math.min(1,Math.max(0,(e.clientY-rect.top)/rect.height))}
 }

 const place=(assetId:string,x:number,y:number)=>{
  const asset=BUILD_ASSET_BY_ID[assetId]
  const placement:BuildPlacement={id:'placement-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),assetId,x,y,rotation:0,scale:asset?.defaultScale??1,skewX:0}
  void commit([...decor.placements,placement])
  setArmed(null);setSelected(placement.id)
 }
 const placeArmedAt=(e:ReactPointerEvent)=>{
  if(!armed)return
  const {x,y}=fractionFromEvent(e)
  place(armed,x,y)
 }
 const onCanvasDrop=(e:DragEvent<HTMLDivElement>)=>{
  e.preventDefault()
  const assetId=e.dataTransfer.getData('text/plain')
  if(!assetId)return
  const {x,y}=fractionFromEvent(e)
  place(assetId,x,y)
 }
 const rotateSelected=()=>{if(selected)void commit(decor.placements.map(p=>p.id===selected?{...p,rotation:nextRotation(p.rotation)}:p))}
 const removeSelected=()=>{if(selected){void commit(decor.placements.filter(p=>p.id!==selected));setSelected(null)}}
 const setSelectedScale=(scale:number)=>{if(selected)void commit(decor.placements.map(p=>p.id===selected?{...p,scale}:p))}
 const setSelectedSkew=(skewX:number)=>{if(selected)void commit(decor.placements.map(p=>p.id===selected?{...p,skewX}:p))}

 const itemPointerDown=(e:ReactPointerEvent<HTMLButtonElement>,placement:BuildPlacement)=>{
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
  dragStart.current={x:e.clientX,y:e.clientY,moved:false}
  setDragId(placement.id);setDragPos({x:placement.x,y:placement.y})
 }
 const itemPointerMove=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  if(!dragId)return
  if(dragStart.current&&(Math.abs(e.clientX-dragStart.current.x)>DRAG_THRESHOLD||Math.abs(e.clientY-dragStart.current.y)>DRAG_THRESHOLD))dragStart.current.moved=true
  setDragPos(fractionFromEvent(e))
 }
 const itemPointerUp=(e:ReactPointerEvent<HTMLButtonElement>,placement:BuildPlacement)=>{
  e.stopPropagation()
  const moved=dragStart.current?.moved??false,finalPos=dragPos
  dragStart.current=null;setDragId(null);setDragPos(null)
  if(moved&&finalPos){void commit(decor.placements.map(p=>p.id===placement.id?{...p,x:finalPos.x,y:finalPos.y}:p));setSelected(placement.id)}
  else setSelected(sel=>sel===placement.id?null:placement.id)
 }

 const selectedPlacement=decor.placements.find(p=>p.id===selected)??null

 return <>
  <div ref={canvasRef} className="build-hotspot-layer" onPointerDown={placeArmedAt} onDragOver={e=>e.preventDefault()} onDrop={onCanvasDrop}>
   {decor.placements.map(p=>{
    const asset=BUILD_ASSET_BY_ID[p.assetId]
    if(!asset)return null
    const pos=dragId===p.id&&dragPos?dragPos:p
    return <button type="button" key={p.id} className={'build-item'+(selected===p.id?' is-selected':'')+(dragId===p.id?' is-dragging':'')} style={{left:(pos.x*100)+'%',top:(pos.y*100)+'%',width:(asset.width/1448*100)+'%',transform:`translate(-50%,-${asset.anchor.y*100}%) rotate(${p.rotation}deg) skewX(${p.skewX}deg) scale(${p.scale})`}} onPointerDown={e=>itemPointerDown(e,p)} onPointerMove={itemPointerMove} onPointerUp={e=>itemPointerUp(e,p)} aria-label={asset.label}>
     <img src={asset.src} alt=""/>
    </button>
   })}
   {selectedPlacement&&<div className="build-item-panel">
    <label>Size<input type="range" min={MIN_SCALE} max={MAX_SCALE} step={0.05} value={selectedPlacement.scale} onChange={e=>setSelectedScale(Number(e.target.value))}/></label>
    <label>Skew<input type="range" min={MIN_SKEW} max={MAX_SKEW} step={1} value={selectedPlacement.skewX} onChange={e=>setSelectedSkew(Number(e.target.value))}/></label>
    <div className="build-item-actions"><button type="button" onClick={rotateSelected} aria-label="Rotate">⟳</button><button type="button" onClick={removeSelected} aria-label="Remove">🗑</button><button type="button" onClick={()=>setSelected(null)} aria-label="Done">✕</button></div>
   </div>}
  </div>
  <section className="sanctuary-build">
   {BUILD_CATEGORIES.length>0?<><p className="wb-muted">Drag an item onto your island, or tap it then tap a spot. Drag a placed item anywhere to move it, or tap it once to resize, skew, rotate, or remove it.</p>
    <nav className="build-category-tabs" aria-label="Decoration categories">{BUILD_CATEGORIES.map(c=><button type="button" key={c} aria-current={category===c?'page':undefined} onClick={()=>{setCategory(c);setSelected(null)}}>{BUILD_CATEGORY_LABELS[c]}</button>)}</nav>
    <div className="build-palette">{BUILD_ASSETS.filter(a=>a.category===category).map(a=>{
     const arm=()=>{setArmed(armed===a.id?null:a.id);setSelected(null)}
     return <div role="button" tabIndex={0} draggable key={a.id} className={'build-palette-item'+(armed===a.id?' is-armed':'')} onDragStart={e=>{e.dataTransfer.setData('text/plain',a.id);e.dataTransfer.effectAllowed='copy'}} onClick={arm} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();arm()}}} aria-pressed={armed===a.id} aria-label={a.label}><span className="build-palette-thumb"><img src={a.src} alt="" draggable={false}/></span><small>{a.label}</small></div>
    })}</div>
   </>:<p className="wb-muted">No decorations available yet — check back soon.</p>}
  </section>
  {message&&<p role="status">{message}</p>}
 </>
}
