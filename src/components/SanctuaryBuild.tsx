import {useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent} from 'react'
import {uid, type AppData, type BuildPlacement} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {BUILD_ASSETS, BUILD_ASSET_BY_ID, BUILD_CATEGORIES, BUILD_CATEGORY_LABELS, type BuildAsset, type BuildCategory} from '../game/data/buildAssets'
import {HOME_STYLES, homeStyleTexturePath} from '../game/data/homeStyles'
import {POND_STYLES, pondStyleThumbnailPath} from '../game/data/pondStyles'
import {TREE_STYLES, treeStyleTexturePath} from '../game/data/treeStyles'
import {minutesFromDate, phaseBlendForMinutes} from '../game/sanctuary/timeEngine'
import type {DayPhase, PhaseMode} from '../game/sanctuary/types'
import './sanctuary-build.css'

const nextRotation=(r:0|90|180|270):0|90|180|270=>r===0?90:r===90?180:r===180?270:0
const DRAG_THRESHOLD=5
const MIN_SCALE=0.3,MAX_SCALE=3,MIN_SKEW=-45,MAX_SKEW=45
const MIN_STYLE_SCALE=0.5,MAX_STYLE_SCALE=2
// The default ground anchor each style renders at when nobody has dragged it yet — mirrors the
// contain-fit math in HomeEvolutionSystem/PondEvolutionSystem/TreeEvolutionSystem as a fraction of
// the scene bounds, so the drag handle starts out sitting where the art actually is.
const HOME_STYLE_DEFAULT_X=0.2417,HOME_STYLE_DEFAULT_Y=0.6906
const POND_STYLE_DEFAULT_X=0.5076,POND_STYLE_DEFAULT_Y=0.7366
const TREE_STYLE_DEFAULT_X=0.4862,TREE_STYLE_DEFAULT_Y=0.2505

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
 const decorFor=(d:AppData)=>d.sanctuaryDecor[profileId]??{profileId,placements:[],homeStyle:null,pondStyle:null,treeStyle:null,homeStyleScale:1,homeStyleFlipX:false,pondStyleScale:1,pondStyleFlipX:false,treeStyleScale:1,treeStyleFlipX:false,homeStyleX:null,homeStyleY:null,pondStyleX:null,pondStyleY:null,treeStyleX:null,treeStyleY:null}
 const decor=decorFor(data)
 const [category,setCategory]=useState<BuildCategory|null>(BUILD_CATEGORIES[0]??null)
 const [armed,setArmed]=useState<string|null>(null)
 const [selected,setSelected]=useState<string|null>(null)
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const canvasRef=useRef<HTMLDivElement|null>(null)
 const [dragId,setDragId]=useState<string|null>(null)
 const [dragPos,setDragPos]=useState<{x:number;y:number}|null>(null)
 const dragStart=useRef<{x:number;y:number;moved:boolean}|null>(null)
 const [styleDragId,setStyleDragId]=useState<'home'|'pond'|'tree'|null>(null)
 const [styleDragPos,setStyleDragPos]=useState<{x:number;y:number}|null>(null)
 const styleDragStart=useRef<{x:number;y:number;moved:boolean}|null>(null)

 const withCurrent=(d:AppData,patch:Partial<ReturnType<typeof decorFor>>)=>{
  const current=decorFor(d)
  return {...d,sanctuaryDecor:{...d.sanctuaryDecor,[profileId]:{profileId,placements:current.placements,homeStyle:current.homeStyle,pondStyle:current.pondStyle,treeStyle:current.treeStyle,homeStyleScale:current.homeStyleScale,homeStyleFlipX:current.homeStyleFlipX,homeStyleX:current.homeStyleX,homeStyleY:current.homeStyleY,pondStyleScale:current.pondStyleScale,pondStyleFlipX:current.pondStyleFlipX,pondStyleX:current.pondStyleX,pondStyleY:current.pondStyleY,treeStyleScale:current.treeStyleScale,treeStyleFlipX:current.treeStyleFlipX,treeStyleX:current.treeStyleX,treeStyleY:current.treeStyleY,...patch}}}
 }
 const commit=async(placements:BuildPlacement[])=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{placements})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setHomeStyle=async(homeStyle:string|null)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{homeStyle})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setPondStyle=async(pondStyle:string|null)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{pondStyle})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setHomeStyleScale=async(homeStyleScale:number)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{homeStyleScale})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setHomeStyleFlipX=async(homeStyleFlipX:boolean)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{homeStyleFlipX})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setPondStyleScale=async(pondStyleScale:number)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{pondStyleScale})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setPondStyleFlipX=async(pondStyleFlipX:boolean)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{pondStyleFlipX})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setHomeStylePosition=async(homeStyleX:number,homeStyleY:number)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{homeStyleX,homeStyleY})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setPondStylePosition=async(pondStyleX:number,pondStyleY:number)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{pondStyleX,pondStyleY})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setTreeStyle=async(treeStyle:string|null)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{treeStyle})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setTreeStyleScale=async(treeStyleScale:number)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{treeStyleScale})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setTreeStyleFlipX=async(treeStyleFlipX:boolean)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{treeStyleFlipX})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const setTreeStylePosition=async(treeStyleX:number,treeStyleY:number)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return withCurrent(d,{treeStyleX,treeStyleY})});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
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
  const placement:BuildPlacement={id:uid('placement'),assetId,x,y,rotation:0,scale:asset?.defaultScale??1,skewX:0}
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

 const homeStylePos={x:decor.homeStyleX??HOME_STYLE_DEFAULT_X,y:decor.homeStyleY??HOME_STYLE_DEFAULT_Y}
 const pondStylePos={x:decor.pondStyleX??POND_STYLE_DEFAULT_X,y:decor.pondStyleY??POND_STYLE_DEFAULT_Y}
 const treeStylePos={x:decor.treeStyleX??TREE_STYLE_DEFAULT_X,y:decor.treeStyleY??TREE_STYLE_DEFAULT_Y}
 const styleHandlePointerDown=(e:ReactPointerEvent<HTMLButtonElement>,which:'home'|'pond'|'tree')=>{
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
  styleDragStart.current={x:e.clientX,y:e.clientY,moved:false}
  setStyleDragId(which);setStyleDragPos(which==='home'?homeStylePos:which==='pond'?pondStylePos:treeStylePos)
 }
 const styleHandlePointerMove=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  if(!styleDragId)return
  if(styleDragStart.current&&(Math.abs(e.clientX-styleDragStart.current.x)>DRAG_THRESHOLD||Math.abs(e.clientY-styleDragStart.current.y)>DRAG_THRESHOLD))styleDragStart.current.moved=true
  setStyleDragPos(fractionFromEvent(e))
 }
 const styleHandlePointerUp=(e:ReactPointerEvent<HTMLButtonElement>,which:'home'|'pond'|'tree')=>{
  e.stopPropagation()
  const moved=styleDragStart.current?.moved??false,finalPos=styleDragPos
  styleDragStart.current=null;setStyleDragId(null);setStyleDragPos(null)
  if(moved&&finalPos){if(which==='home')void setHomeStylePosition(finalPos.x,finalPos.y);else if(which==='pond')void setPondStylePosition(finalPos.x,finalPos.y);else void setTreeStylePosition(finalPos.x,finalPos.y)}
 }

 const selectedPlacement=decor.placements.find(p=>p.id===selected)??null

 return <>
  <div ref={canvasRef} className="build-hotspot-layer" onPointerDown={placeArmedAt} onDragOver={e=>e.preventDefault()} onDrop={onCanvasDrop}>
   {decor.placements.map(p=>{
    const asset=BUILD_ASSET_BY_ID[p.assetId]
    if(!asset)return null
    const pos=dragId===p.id&&dragPos?dragPos:p
    return <button type="button" key={p.id} className={'build-item'+(selected===p.id?' is-selected':'')+(dragId===p.id?' is-dragging':'')} style={{left:(pos.x*100)+'%',top:(pos.y*100)+'%',width:(asset.width/1448*100)+'%',transform:`translate(-50%,-${asset.anchor.y*100}%) rotate(${p.rotation}deg) skewX(${p.skewX}deg) scale(${p.scale})`}} onPointerDown={e=>itemPointerDown(e,p)} onPointerMove={itemPointerMove} onPointerUp={e=>itemPointerUp(e,p)} aria-label={asset.label}>
     <img src={assetSrc(asset)} alt=""/>
    </button>
   })}
   {decor.homeStyle&&<button type="button" className={'build-style-handle'+(styleDragId==='home'?' is-dragging':'')} style={{left:((styleDragId==='home'&&styleDragPos?styleDragPos.x:homeStylePos.x)*100)+'%',top:((styleDragId==='home'&&styleDragPos?styleDragPos.y:homeStylePos.y)*100)+'%'}} onPointerDown={e=>styleHandlePointerDown(e,'home')} onPointerMove={styleHandlePointerMove} onPointerUp={e=>styleHandlePointerUp(e,'home')} aria-label="Move home">⠿</button>}
   {decor.pondStyle&&<button type="button" className={'build-style-handle'+(styleDragId==='pond'?' is-dragging':'')} style={{left:((styleDragId==='pond'&&styleDragPos?styleDragPos.x:pondStylePos.x)*100)+'%',top:((styleDragId==='pond'&&styleDragPos?styleDragPos.y:pondStylePos.y)*100)+'%'}} onPointerDown={e=>styleHandlePointerDown(e,'pond')} onPointerMove={styleHandlePointerMove} onPointerUp={e=>styleHandlePointerUp(e,'pond')} aria-label="Move pond">⠿</button>}
   {decor.treeStyle&&<button type="button" className={'build-style-handle'+(styleDragId==='tree'?' is-dragging':'')} style={{left:((styleDragId==='tree'&&styleDragPos?styleDragPos.x:treeStylePos.x)*100)+'%',top:((styleDragId==='tree'&&styleDragPos?styleDragPos.y:treeStylePos.y)*100)+'%'}} onPointerDown={e=>styleHandlePointerDown(e,'tree')} onPointerMove={styleHandlePointerMove} onPointerUp={e=>styleHandlePointerUp(e,'tree')} aria-label="Move tree">⠿</button>}
   {selectedPlacement&&<div className="build-item-panel">
    <label>Size<input type="range" min={MIN_SCALE} max={MAX_SCALE} step={0.05} value={selectedPlacement.scale} onChange={e=>setSelectedScale(Number(e.target.value))}/></label>
    <label>Skew<input type="range" min={MIN_SKEW} max={MAX_SKEW} step={1} value={selectedPlacement.skewX} onChange={e=>setSelectedSkew(Number(e.target.value))}/></label>
    <div className="build-item-actions"><button type="button" onClick={rotateSelected} aria-label="Rotate">⟳</button><button type="button" onClick={removeSelected} aria-label="Remove">🗑</button><button type="button" onClick={()=>setSelected(null)} aria-label="Done">✕</button></div>
   </div>}
  </div>
  <section className="sanctuary-build">
   <p className="wb-muted">Home style</p>
   <div className="build-home-styles" role="group" aria-label="Home style">
    <button type="button" aria-pressed={!decor.homeStyle} onClick={()=>setHomeStyle(null)} className="build-home-style-item"><span className="build-home-style-thumb build-home-style-thumb-default">🏠</span><small>Default cottage</small></button>
    {HOME_STYLES.map(style=><button type="button" key={style.id} aria-pressed={decor.homeStyle===style.id} onClick={()=>setHomeStyle(style.id)} className="build-home-style-item"><span className="build-home-style-thumb"><img src={homeStyleTexturePath(style.id,'afternoon')} alt=""/></span><small>{style.label}</small></button>)}
   </div>
   {decor.homeStyle&&<div className="build-style-transform" aria-label="Home style size and mirror">
    <label>Size<input type="range" min={MIN_STYLE_SCALE} max={MAX_STYLE_SCALE} step={0.05} value={decor.homeStyleScale??1} onChange={e=>setHomeStyleScale(Number(e.target.value))}/></label>
    <button type="button" aria-pressed={!!decor.homeStyleFlipX} onClick={()=>setHomeStyleFlipX(!decor.homeStyleFlipX)}>Mirror</button>
   </div>}
   <p className="wb-muted">Pond style</p>
   <div className="build-home-styles" role="group" aria-label="Pond style">
    <button type="button" aria-pressed={!decor.pondStyle} onClick={()=>setPondStyle(null)} className="build-home-style-item"><span className="build-home-style-thumb build-home-style-thumb-default">💧</span><small>No pond (empty)</small></button>
    {POND_STYLES.map(style=><button type="button" key={style.id} aria-pressed={decor.pondStyle===style.id} onClick={()=>setPondStyle(style.id)} className="build-home-style-item"><span className="build-home-style-thumb"><img src={pondStyleThumbnailPath(style.id)} alt=""/></span><small>{style.label}</small></button>)}
   </div>
   {decor.pondStyle&&<div className="build-style-transform" aria-label="Pond style size and mirror">
    <label>Size<input type="range" min={MIN_STYLE_SCALE} max={MAX_STYLE_SCALE} step={0.05} value={decor.pondStyleScale??1} onChange={e=>setPondStyleScale(Number(e.target.value))}/></label>
    <button type="button" aria-pressed={!!decor.pondStyleFlipX} onClick={()=>setPondStyleFlipX(!decor.pondStyleFlipX)}>Mirror</button>
   </div>}
   <p className="wb-muted">Tree style</p>
   <div className="build-home-styles" role="group" aria-label="Tree style">
    <button type="button" aria-pressed={!decor.treeStyle} onClick={()=>setTreeStyle(null)} className="build-home-style-item"><span className="build-home-style-thumb build-home-style-thumb-default">🌳</span><small>Default cherry tree</small></button>
    {TREE_STYLES.map(style=><button type="button" key={style.id} aria-pressed={decor.treeStyle===style.id} onClick={()=>setTreeStyle(style.id)} className="build-home-style-item"><span className="build-home-style-thumb"><img src={treeStyleTexturePath(style.id,'afternoon')} alt=""/></span><small>{style.label}</small></button>)}
   </div>
   {decor.treeStyle&&<div className="build-style-transform" aria-label="Tree style size and mirror">
    <label>Size<input type="range" min={MIN_STYLE_SCALE} max={MAX_STYLE_SCALE} step={0.05} value={decor.treeStyleScale??1} onChange={e=>setTreeStyleScale(Number(e.target.value))}/></label>
    <button type="button" aria-pressed={!!decor.treeStyleFlipX} onClick={()=>setTreeStyleFlipX(!decor.treeStyleFlipX)}>Mirror</button>
   </div>}
   {BUILD_CATEGORIES.length>0?<><p className="wb-muted">Drag an item onto your island, or tap it then tap a spot. Drag a placed item anywhere to move it, or tap it once to resize, skew, rotate, or remove it.</p>
    <nav className="build-category-tabs" aria-label="Decoration categories">{BUILD_CATEGORIES.map(c=><button type="button" key={c} aria-current={category===c?'page':undefined} onClick={()=>{setCategory(c);setSelected(null)}}>{BUILD_CATEGORY_LABELS[c]}</button>)}</nav>
    <div className="build-palette">{BUILD_ASSETS.filter(a=>a.category===category).map(a=>{
     const arm=()=>{setArmed(armed===a.id?null:a.id);setSelected(null)}
     return <div role="button" tabIndex={0} draggable key={a.id} className={'build-palette-item'+(armed===a.id?' is-armed':'')} onDragStart={e=>{e.dataTransfer.setData('text/plain',a.id);e.dataTransfer.effectAllowed='copy'}} onClick={arm} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();arm()}}} aria-pressed={armed===a.id} aria-label={a.label}><span className="build-palette-thumb"><img src={assetSrc(a)} alt="" draggable={false}/></span><small>{a.label}</small></div>
    })}</div>
   </>:<p className="wb-muted">No decorations available yet — check back soon.</p>}
  </section>
  {message&&<p role="status">{message}</p>}
 </>
}
