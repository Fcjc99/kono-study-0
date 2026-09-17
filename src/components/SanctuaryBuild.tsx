import {useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent} from 'react'
import {uid, type AppData, type BuildPlacement, type SignTextFont} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {BUILD_ASSETS, BUILD_ASSET_BY_ID, BUILD_CATEGORIES, BUILD_CATEGORY_LABELS, SIGN_TEXT_DEFAULTS, buildAssetSrc, buildItemStyle, signTextStyle, type BuildAsset, type BuildCategory} from '../game/data/buildAssets'
import {useResolvedDayPhase} from '../hooks/useResolvedDayPhase'
import type {PhaseMode} from '../game/sanctuary/types'
import DecorateDebugHUD from './DecorateDebugHUD'
import './sanctuary-build.css'

const nextRotation=(r:0|90|180|270):0|90|180|270=>r===0?90:r===90?180:r===180?270:0
const DRAG_THRESHOLD=5
// MAX_SCALE used to go to 3x — but most decorations (signs, lanterns, study/cafe props) are anchored
// near their own base and already fill most of the frame's height at 1x, so anything much past ~1.3x
// pushed the recognizable part of the art above the visible island before the clip fix even had a
// chance to show it — the slider's upper range was effectively producing an invisible result. 2x still
// gives real, visible growth for every category without running out of headroom immediately.
const MIN_SCALE=0.3,MAX_SCALE=2,MIN_SKEW=-45,MAX_SKEW=45
// Mirrors model.ts's placementCoord clamp — x/y is the anchor point on an item's own art, so keeping
// it inset from the canvas edge (not the raw 0-1 range) guarantees the item's rendered box always
// overlaps the visible, clickable canvas near that point. Clamping here too means a drag never shows
// the item drifting past the edge only to snap back once it's saved.
const PLACEMENT_MIN=0.06,PLACEMENT_MAX=0.94
const clampCoord=(v:number):number=>Math.min(PLACEMENT_MAX,Math.max(PLACEMENT_MIN,v))

export default function SanctuaryBuild({data,save,phase}:{data:AppData;save:PlannerRepository['update'];phase:PhaseMode}){
 const profileId=data.activeProfileId
 const resolvedPhase=useResolvedDayPhase(phase)
 const assetSrc=(asset:BuildAsset):string=>buildAssetSrc(asset,resolvedPhase)
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
 const [liveText,setLiveText]=useState<{id:string;value:string}|null>(null)
 const [liveTextSize,setLiveTextSize]=useState<{id:string;value:number}|null>(null)
 const [liveTextColor,setLiveTextColor]=useState<{id:string;value:string}|null>(null)
 const scaleCommitTimer=useRef<number|undefined>(undefined)
 const skewCommitTimer=useRef<number|undefined>(undefined)
 const textCommitTimer=useRef<number|undefined>(undefined)
 const textSizeCommitTimer=useRef<number|undefined>(undefined)

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
  return {x:clampCoord((e.clientX-rect.left)/rect.width),y:clampCoord((e.clientY-rect.top)/rect.height)}
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
  // Base-anchored decorations (signs, lanterns, study/cafe props — anchor.y near the bottom of their
  // own art) grow upward from wherever they land: dropping them at the canvas's vertical middle, like
  // centered decorations (roads, homes, ponds, trees) can, left them already almost touching the top
  // of the frame at 1x with zero headroom for the Size slider to do anything visible. Standing them
  // nearer the "ground" by default gives them real room to grow into.
  const asset=BUILD_ASSET_BY_ID[assetId]
  const baseY=asset&&asset.anchor.y>0.8?0.8:0.5
  place(assetId,Math.min(0.9,0.5+offset),Math.min(0.92,baseY+offset))
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
 const setSelectedText=(text:string)=>{
  if(!selected)return
  setLiveText({id:selected,value:text})
  window.clearTimeout(textCommitTimer.current)
  textCommitTimer.current=window.setTimeout(()=>{void commit(decor.placements.map(p=>p.id===selected?{...p,text}:p))},400)
 }
 const setSelectedTextSize=(textSize:number)=>{
  if(!selected)return
  setLiveTextSize({id:selected,value:textSize})
  window.clearTimeout(textSizeCommitTimer.current)
  textSizeCommitTimer.current=window.setTimeout(()=>{void commit(decor.placements.map(p=>p.id===selected?{...p,textSize}:p))},150)
 }
 const setSelectedTextColor=(textColor:string)=>{
  if(!selected)return
  setLiveTextColor({id:selected,value:textColor})
  void commit(decor.placements.map(p=>p.id===selected?{...p,textColor}:p))
 }
 const setSelectedTextFont=(textFont:SignTextFont)=>{
  if(!selected)return
  void commit(decor.placements.map(p=>p.id===selected?{...p,textFont}:p))
 }
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

 // The Size/Skew controls sit in normal document flow below the canvas (see sanctuary-build.css) —
 // on a short phone screen, scrolling down to reach them can carry the canvas itself off the top of
 // the viewport, so dragging the slider produces a real, immediate change with no visible feedback at
 // all. Centering the canvas in view as soon as something is selected gives it a fighting chance of
 // starting out visible; workbench.css's sticky positioning (see --wb-sticky-top below) is what keeps
 // it that way once the controls below get scrolled further.
 useEffect(()=>{if(selected)canvasRef.current?.scrollIntoView({block:'center',behavior:'smooth'})},[selected])
 // Sticky positioning pins the canvas near the top of the viewport while decorating, but a themed
 // app header can be sticky too — without clearing its height, the canvas would stick right
 // underneath it, hidden. Measuring whichever header is actually on screen, instead of hardcoding a
 // height per theme, keeps this correct across every experience/theme and on rotation/resize.
 useEffect(()=>{
  const apply=()=>{
   const header=document.querySelector('.mobile-desk-header,.topbar,.wb-header')
   const clearance=header&&['sticky','fixed'].includes(getComputedStyle(header).position)?header.getBoundingClientRect().height:0
   document.documentElement.style.setProperty('--wb-sticky-top',(clearance+8)+'px')
  }
  apply()
  window.addEventListener('resize',apply)
  return ()=>{window.removeEventListener('resize',apply);document.documentElement.style.removeProperty('--wb-sticky-top')}
 },[])

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
    const signText=liveText&&liveText.id===p.id?liveText.value:p.text
    const signTextSize=liveTextSize&&liveTextSize.id===p.id?liveTextSize.value:p.textSize
    const signTextColor=liveTextColor&&liveTextColor.id===p.id?liveTextColor.value:p.textColor
    const signStyle=asset.signArea&&signText?signTextStyle(asset,{flipX:p.flipX,textSize:signTextSize,textColor:signTextColor,textFont:p.textFont}):null
    return <button type="button" key={p.id} className={'build-item'+(isSelected?' is-selected':'')+(dragId===p.id?' is-dragging':'')} style={buildItemStyle(asset,{x:pos.x,y:pos.y,rotation:p.rotation,scale,skewX,flipX:p.flipX})} onPointerDown={e=>itemPointerDown(e,p)} onPointerMove={itemPointerMove} onPointerUp={e=>itemPointerUp(e,p)} aria-label={asset.label}>
     <img src={assetSrc(asset)} alt=""/>
     {signStyle&&<span className="build-sign-text" style={signStyle}>{signText}</span>}
    </button>
   })}
  </div>
  <section className="sanctuary-build">
   {selectedPlacement&&(()=>{
    // A fixed control bar below the map, in normal document flow — not floating over the canvas,
    // which on a narrow phone screen could cover most of the art being edited, and not built from
    // custom pointer-drag gestures for size/skew, which turned out not to land reliably across real
    // touch devices. Every control here is a plain native input or button.
    const scale=liveScale&&liveScale.id===selectedPlacement.id?liveScale.value:selectedPlacement.scale
    const skewX=liveSkew&&liveSkew.id===selectedPlacement.id?liveSkew.value:selectedPlacement.skewX
    const signText=liveText&&liveText.id===selectedPlacement.id?liveText.value:selectedPlacement.text??''
    const signTextSize=liveTextSize&&liveTextSize.id===selectedPlacement.id?liveTextSize.value:selectedPlacement.textSize??SIGN_TEXT_DEFAULTS.size
    const signTextColor=liveTextColor&&liveTextColor.id===selectedPlacement.id?liveTextColor.value:selectedPlacement.textColor??SIGN_TEXT_DEFAULTS.color
    const signTextFont=selectedPlacement.textFont??SIGN_TEXT_DEFAULTS.font
    const signable=!!BUILD_ASSET_BY_ID[selectedPlacement.assetId]?.signArea
    return <div className="build-item-panel">
     {signable&&<label>Sign text<input type="text" maxLength={120} value={signText} onChange={e=>setSelectedText(e.target.value)} placeholder="Write on this sign"/></label>}
     {signable&&signText&&<div className="build-sign-style-controls">
      <label>Text size<input type="range" min={0.6} max={2.2} step={0.1} value={signTextSize} onChange={e=>setSelectedTextSize(Number(e.target.value))}/></label>
      <label>Text color<input type="color" value={signTextColor} onChange={e=>setSelectedTextColor(e.target.value)}/></label>
      <label>Font<select value={signTextFont} onChange={e=>setSelectedTextFont(e.target.value as SignTextFont)}>
       <option value="hand">Handwritten</option>
       <option value="serif">Storybook</option>
       <option value="sans">Clean</option>
      </select></label>
     </div>}
     <label>Size<input type="range" min={MIN_SCALE} max={MAX_SCALE} step={0.05} value={scale} onChange={e=>setSelectedScale(Number(e.target.value))}/></label>
     <label>Skew<input type="range" min={MIN_SKEW} max={MAX_SKEW} step={1} value={skewX} onChange={e=>setSelectedSkew(Number(e.target.value))}/></label>
     <div className="build-item-actions">
      <button type="button" onClick={rotateSelected} aria-label="Rotate">⟳</button>
      <button type="button" aria-pressed={selectedPlacement.flipX} onClick={mirrorSelected} aria-label="Mirror">⇋</button>
      <button type="button" onClick={duplicateSelected} aria-label="Duplicate">⧉</button>
      <button type="button" onClick={removeSelected} aria-label="Remove">🗑</button>
      <button type="button" onClick={()=>setSelected(null)} aria-label="Done">✕</button>
     </div>
    </div>
   })()}
   <p className="wb-muted">Tap an item to add it to your island, or drag it on to choose where it lands. Drag a placed item anywhere to move it, or tap it once to select it — then use the controls above to resize, skew, rotate, mirror, duplicate, or remove it. A few items (like signs and the chalkboard) let you write your own text on them, too. Place as many of anything as you like.</p>
   <nav className="build-category-tabs" aria-label="Decoration categories">{BUILD_CATEGORIES.map(c=><button type="button" key={c} aria-current={category===c?'page':undefined} onClick={()=>{setCategory(c);setSelected(null)}}>{BUILD_CATEGORY_LABELS[c]}</button>)}</nav>
   <div className="build-palette">{BUILD_ASSETS.filter(a=>a.category===category).map(a=>
    <div role="button" tabIndex={0} draggable key={a.id} className="build-palette-item" onDragStart={e=>{e.dataTransfer.setData('text/plain',a.id);e.dataTransfer.effectAllowed='copy'}} onClick={()=>placeDefault(a.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();placeDefault(a.id)}}} aria-label={'Add '+a.label}><span className="build-palette-thumb"><img src={assetSrc(a)} alt="" draggable={false}/></span><small>{a.label}</small></div>
   )}</div>
  </section>
  {message&&<p role="status">{message}</p>}
  <DecorateDebugHUD mode="decorate"/>
 </>
}
