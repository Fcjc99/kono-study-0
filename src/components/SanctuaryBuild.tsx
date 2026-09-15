import {useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent} from 'react'
import {uid, type AppData, type BuildPlacement} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {BUILD_ASSETS, BUILD_ASSET_BY_ID, BUILD_CATEGORIES, BUILD_CATEGORY_LABELS, type BuildAsset, type BuildCategory} from '../game/data/buildAssets'
import {minutesFromDate, phaseBlendForMinutes} from '../game/sanctuary/timeEngine'
import type {DayPhase, PhaseMode} from '../game/sanctuary/types'
import './sanctuary-build.css'

const nextRotation=(r:0|90|180|270):0|90|180|270=>r===0?90:r===90?180:r===180?270:0
const DRAG_THRESHOLD=5
const MIN_SCALE=0.3,MAX_SCALE=3,MIN_SKEW=-45,MAX_SKEW=45

export default function SanctuaryBuild({data,save,phase}:{data:AppData;save:PlannerRepository['update'];phase:PhaseMode}){
 const profileId=data.activeProfileId
 const [liveDayPhase,setLiveDayPhase]=useState<DayPhase>(()=>phaseBlendForMinutes(minutesFromDate(new Date())).dominant)
 useEffect(()=>{
  if(phase!=='auto')return
  const tick=()=>setLiveDayPhase(phaseBlendForMinutes(minutesFromDate(new Date())).dominant)
  tick()
  const interval=setInterval(tick,60000)
  return ()=>clearInterval(interval)
 },[phase])
 const resolvedPhase:DayPhase=phase==='auto'?liveDayPhase:phase
 const assetSrc=(asset:BuildAsset):string=>typeof asset.src==='string'?asset.src:asset.src[resolvedPhase]
 const decorFor=(d:AppData)=>d.sanctuaryDecor[profileId]??{profileId,placements:[]}
 const decor=decorFor(data)
 const [category,setCategory]=useState<BuildCategory|null>(BUILD_CATEGORIES[0]??null)
 const [selected,setSelected]=useState<string|null>(null)
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const canvasRef=useRef<HTMLDivElement|null>(null)
 const [dragId,setDragId]=useState<string|null>(null)
 const [dragPos,setDragPos]=useState<{x:number;y:number}|null>(null)
 const dragStart=useRef<{x:number;y:number;moved:boolean}|null>(null)
 // Scoped by placement id rather than reset on selection change, so switching the selected item
 // naturally falls back to its own committed value with no extra effect needed.
 const [liveScale,setLiveScale]=useState<{id:string;value:number}|null>(null)
 const [liveSkew,setLiveSkew]=useState<{id:string;value:number}|null>(null)
 const scaleCommitTimer=useRef<number|undefined>(undefined)
 const skewCommitTimer=useRef<number|undefined>(undefined)
 const resizeDrag=useRef<{anchorX:number;anchorY:number;startDistance:number;startScale:number}|null>(null)
 const skewDrag=useRef<{startX:number;startSkew:number;boxWidthPx:number}|null>(null)

 const withCurrent=(d:AppData,patch:Partial<ReturnType<typeof decorFor>>)=>{
  const current=decorFor(d)
  return {...d,sanctuaryDecor:{...d.sanctuaryDecor,[profileId]:{profileId,placements:current.placements,...patch}}}
 }
 const commit=async(placements:BuildPlacement[])=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{placements})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
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
  const placement:BuildPlacement={id:uid('placement'),assetId,x,y,rotation:0,scale:asset?.defaultScale??1,skewX:0,flipX:false}
  void commit([...decor.placements,placement])
  setSelected(placement.id)
 }
 // Tapping a palette item drops it straight onto the island instead of requiring a separate "now tap
 // where you want it" step — a second precise tap is exactly what makes placement unreliable on a
 // touch screen (the two taps can land on different re-rendered layouts, or the second tap just never
 // arrives). It lands near the middle, already selected, ready to drag anywhere. Repeated taps of the
 // same item cascade slightly so they don't stack in one unreachable pile. Dragging a palette item
 // (desktop's native HTML5 drag-and-drop) still drops it exactly where it's released.
 const placeDefault=(assetId:string)=>{
  const existing=decor.placements.filter(p=>p.assetId===assetId).length
  const offset=(existing%5)*0.035
  place(assetId,Math.min(0.9,0.5+offset),Math.min(0.9,0.5+offset))
 }
 const onCanvasDrop=(e:DragEvent<HTMLDivElement>)=>{
  e.preventDefault()
  const assetId=e.dataTransfer.getData('text/plain')
  if(!assetId)return
  const {x,y}=fractionFromEvent(e)
  place(assetId,x,y)
 }
 const rotateSelected=()=>{if(selected)void commit(decor.placements.map(p=>p.id===selected?{...p,rotation:nextRotation(p.rotation)}:p))}
 const mirrorSelected=()=>{if(selected)void commit(decor.placements.map(p=>p.id===selected?{...p,flipX:!p.flipX}:p))}
 const duplicateSelected=()=>{
  const source=decor.placements.find(p=>p.id===selected)
  if(!source)return
  const copy:BuildPlacement={...source,id:uid('placement'),x:Math.min(0.96,source.x+0.04),y:Math.min(0.96,source.y+0.04)}
  void commit([...decor.placements,copy])
  setSelected(copy.id)
 }
 const removeSelected=()=>{if(selected){void commit(decor.placements.filter(p=>p.id!==selected));setSelected(null)}}
 // Committing on every slider tick would fight the in-flight-save guard in `commit` (it silently
 // drops a call while a previous save is still pending), so dragging felt sticky/laggy. Update the
 // visible value instantly via local state and only persist once the user pauses.
 const setSelectedScale=(scale:number)=>{
  if(!selected)return
  setLiveScale({id:selected,value:scale})
  window.clearTimeout(scaleCommitTimer.current)
  scaleCommitTimer.current=window.setTimeout(()=>{void commit(decor.placements.map(p=>p.id===selected?{...p,scale}:p))},150)
 }
 const setSelectedSkew=(skewX:number)=>{
  if(!selected)return
  setLiveSkew({id:selected,value:skewX})
  window.clearTimeout(skewCommitTimer.current)
  skewCommitTimer.current=window.setTimeout(()=>{void commit(decor.placements.map(p=>p.id===selected?{...p,skewX}:p))},150)
 }
 // Resize/skew handles live on the item's own bounding box rather than in the side panel, so sizing
 // an item is "grab a corner and drag" instead of hunting for a slider. Both read distance/position
 // from the pointer's screen coordinates against the item's own anchor point (the same point its CSS
 // transform-origin pivots around) rather than trying to invert the rotate/skew transform, which keeps
 // the math simple and stays correct at any of the four rotation steps.
 const handleResizeStart=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  const placement=decor.placements.find(p=>p.id===selected)
  if(!placement)return
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
  const rect=canvasRef.current?.getBoundingClientRect()
  const anchorX=rect?rect.left+placement.x*rect.width:0,anchorY=rect?rect.top+placement.y*rect.height:0
  const startDistance=Math.max(1,Math.hypot(e.clientX-anchorX,e.clientY-anchorY))
  resizeDrag.current={anchorX,anchorY,startDistance,startScale:placement.scale}
 }
 const handleResizeMove=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  const drag=resizeDrag.current
  if(!drag)return
  const distance=Math.hypot(e.clientX-drag.anchorX,e.clientY-drag.anchorY)
  setSelectedScale(Math.min(MAX_SCALE,Math.max(MIN_SCALE,drag.startScale*(distance/drag.startDistance))))
 }
 const handleResizeEnd=(e:ReactPointerEvent<HTMLButtonElement>)=>{e.stopPropagation();resizeDrag.current=null}
 const handleSkewStart=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  const placement=decor.placements.find(p=>p.id===selected)
  if(!placement)return
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
  const asset=BUILD_ASSET_BY_ID[placement.assetId]
  const rect=canvasRef.current?.getBoundingClientRect()
  const boxWidthPx=asset&&rect?(asset.width/1448)*rect.width*placement.scale:100
  skewDrag.current={startX:e.clientX,startSkew:placement.skewX,boxWidthPx:Math.max(20,boxWidthPx)}
 }
 const handleSkewMove=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  const drag=skewDrag.current
  if(!drag)return
  setSelectedSkew(Math.min(MAX_SKEW,Math.max(MIN_SKEW,drag.startSkew+(e.clientX-drag.startX)/drag.boxWidthPx*90)))
 }
 const handleSkewEnd=(e:ReactPointerEvent<HTMLButtonElement>)=>{e.stopPropagation();skewDrag.current=null}

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
  // Placing a new item renders its button right under the pointer mid-gesture: the same tap's
  // pointerup can then land on that brand-new button instead of the canvas that started it, with no
  // matching itemPointerDown here to set dragStart. Treat that as a foreign event, not a tap-to-toggle
  // — otherwise the item selects itself in place() and immediately deselects again right here.
  if(!dragStart.current)return
  const moved=dragStart.current.moved,finalPos=dragPos
  dragStart.current=null;setDragId(null);setDragPos(null)
  if(moved&&finalPos){void commit(decor.placements.map(p=>p.id===placement.id?{...p,x:finalPos.x,y:finalPos.y}:p));setSelected(placement.id)}
  else setSelected(sel=>sel===placement.id?null:placement.id)
 }

 const selectedPlacement=decor.placements.find(p=>p.id===selected)??null

 return <>
  <div ref={canvasRef} className="build-hotspot-layer" onDragOver={e=>e.preventDefault()} onDrop={onCanvasDrop}>
   {decor.placements.map(p=>{
    const asset=BUILD_ASSET_BY_ID[p.assetId]
    if(!asset)return null
    const pos=dragId===p.id&&dragPos?dragPos:p
    const isSelected=selected===p.id
    const scale=liveScale&&liveScale.id===p.id?liveScale.value:p.scale
    const skewX=liveSkew&&liveSkew.id===p.id?liveSkew.value:p.skewX
    return <button type="button" key={p.id} className={'build-item'+(isSelected?' is-selected':'')+(dragId===p.id?' is-dragging':'')} style={{left:(pos.x*100)+'%',top:(pos.y*100)+'%',width:(asset.width/1448*100)+'%',transformOrigin:`50% ${asset.anchor.y*100}%`,transform:`translate(-50%,-${asset.anchor.y*100}%) rotate(${p.rotation}deg) skewX(${skewX}deg) scale(${(p.flipX?-1:1)*scale},${scale})`}} onPointerDown={e=>itemPointerDown(e,p)} onPointerMove={itemPointerMove} onPointerUp={e=>itemPointerUp(e,p)} aria-label={asset.label}>
     <img src={assetSrc(asset)} alt=""/>
    </button>
   })}
   {selectedPlacement&&(()=>{
    // Resize/rotate/skew live directly on the selected item's own bounding box — a sibling overlay
    // sharing its exact left/top/transform, so the handles move, rotate and skew right along with the
    // art instead of a fixed side panel. `pointer-events:none` on the wrapper keeps it from stealing
    // clicks meant for the item or canvas; each handle opts back in.
    const asset=BUILD_ASSET_BY_ID[selectedPlacement.assetId]
    if(!asset)return null
    const pos=dragId===selectedPlacement.id&&dragPos?dragPos:selectedPlacement
    const scale=liveScale&&liveScale.id===selectedPlacement.id?liveScale.value:selectedPlacement.scale
    const skewX=liveSkew&&liveSkew.id===selectedPlacement.id?liveSkew.value:selectedPlacement.skewX
    const counterScale=1/Math.min(2.2,Math.max(0.6,scale))
    return <div className="build-item-handles" style={{left:(pos.x*100)+'%',top:(pos.y*100)+'%',width:(asset.width/1448*100)+'%',aspectRatio:`${asset.width} / ${asset.height}`,transformOrigin:`50% ${asset.anchor.y*100}%`,transform:`translate(-50%,-${asset.anchor.y*100}%) rotate(${selectedPlacement.rotation}deg) skewX(${skewX}deg) scale(${(selectedPlacement.flipX?-1:1)*scale},${scale})`}}>
     <button type="button" className="build-handle build-handle-rotate" style={{transform:`translate(-50%,-50%) scale(${counterScale})`}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();rotateSelected()}} aria-label="Rotate">⟳</button>
     <button type="button" className="build-handle build-handle-resize" style={{transform:`translate(50%,50%) scale(${counterScale})`}} onPointerDown={handleResizeStart} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} aria-label="Resize">⤡</button>
     <button type="button" className="build-handle build-handle-skew" style={{transform:`translate(-50%,50%) scale(${counterScale})`}} onPointerDown={handleSkewStart} onPointerMove={handleSkewMove} onPointerUp={handleSkewEnd} aria-label="Skew">⬠</button>
    </div>
   })()}
   {selectedPlacement&&(()=>{
    // Anchored beside the selected item (flipping left/right to stay on screen) rather than below/
    // above it, so the panel never sits on top of the very art it's adjusting — the item's own
    // footprint width decides how far out the panel starts.
    const selectedAsset=BUILD_ASSET_BY_ID[selectedPlacement.assetId]
    if(!selectedAsset)return null
    const halfWidthPct=(selectedAsset.width/1448*100)/2
    const onRight=selectedPlacement.x<=0.58
    const gapPct=halfWidthPct+2
    const left=onRight?`calc(${selectedPlacement.x*100}% + ${gapPct}%)`:`calc(${selectedPlacement.x*100}% - ${gapPct}%)`
    const top=`clamp(90px, ${selectedPlacement.y*100}%, calc(100% - 90px))`
    return <div className={'build-item-panel'+(onRight?' is-right':' is-left')} style={{left,top}}>
     <div className="build-item-actions">
      <button type="button" aria-pressed={selectedPlacement.flipX} onClick={mirrorSelected} aria-label="Mirror">⇋</button>
      <button type="button" onClick={duplicateSelected} aria-label="Duplicate">⧉</button>
      <button type="button" onClick={removeSelected} aria-label="Remove">🗑</button>
      <button type="button" onClick={()=>setSelected(null)} aria-label="Done">✕</button>
     </div>
    </div>
   })()}
  </div>
  <section className="sanctuary-build">
   <p className="wb-muted">Tap an item to add it to your island, or drag it on to choose where it lands. Drag a placed item anywhere to move it, or tap it once to select it — then drag the ⤡ handle to resize, ⬠ to skew, or tap ⟳ to rotate, right on the item itself. Mirror, duplicate, and remove stay in the small panel beside it. Place as many of anything as you like.</p>
   <nav className="build-category-tabs" aria-label="Decoration categories">{BUILD_CATEGORIES.map(c=><button type="button" key={c} aria-current={category===c?'page':undefined} onClick={()=>{setCategory(c);setSelected(null)}}>{BUILD_CATEGORY_LABELS[c]}</button>)}</nav>
   <div className="build-palette">{BUILD_ASSETS.filter(a=>a.category===category).map(a=>
    <div role="button" tabIndex={0} draggable key={a.id} className="build-palette-item" onDragStart={e=>{e.dataTransfer.setData('text/plain',a.id);e.dataTransfer.effectAllowed='copy'}} onClick={()=>placeDefault(a.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();placeDefault(a.id)}}} aria-label={'Add '+a.label}><span className="build-palette-thumb"><img src={assetSrc(a)} alt="" draggable={false}/></span><small>{a.label}</small></div>
   )}</div>
  </section>
  {message&&<p role="status">{message}</p>}
 </>
}
