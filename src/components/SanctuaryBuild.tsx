import {useState} from 'react'
import type {AppData, BuildPlacement} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {BUILD_ASSETS, BUILD_ASSET_BY_ID, BUILD_CATEGORIES, BUILD_CATEGORY_LABELS, type BuildCategory} from '../game/data/buildAssets'
import './sanctuary-build.css'

const GRID_COLS=14,GRID_ROWS=9
const nextRotation=(r:0|90|180|270):0|90|180|270=>r===0?90:r===90?180:r===180?270:0
const ISLAND_PHASES=['morning','afternoon','evening','night'] as const
type IslandPhase=typeof ISLAND_PHASES[number]

export default function SanctuaryBuild({data,save}:{data:AppData;save:PlannerRepository['update']}){
 const profileId=data.activeProfileId
 const decor=data.sanctuaryDecor[profileId]??{profileId,placements:[]}
 const [phase,setPhase]=useState<IslandPhase>('afternoon')
 const [category,setCategory]=useState<BuildCategory>(BUILD_CATEGORIES[0])
 const [armed,setArmed]=useState<string|null>(null)
 const [selected,setSelected]=useState<string|null>(null)
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')

 const commit=async(placements:BuildPlacement[])=>{
  if(busy)return;setBusy(true);setMessage('')
  try{const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return {...d,sanctuaryDecor:{...d.sanctuaryDecor,[profileId]:{profileId,placements}}}});if(!ok)setMessage('Not saved yet. Check the save status and try again.')}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }

 const cellOccupant=(col:number,row:number)=>decor.placements.find(p=>p.col===col&&p.row===row)

 const placeAt=(col:number,row:number)=>{
  const existing=cellOccupant(col,row)
  if(existing){setSelected(existing.id);setArmed(null);return}
  if(!armed)return
  const placement:BuildPlacement={id:'placement-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),assetId:armed,col,row,rotation:0}
  void commit([...decor.placements,placement])
  setArmed(null);setSelected(placement.id)
 }
 const rotateSelected=()=>{if(selected)void commit(decor.placements.map(p=>p.id===selected?{...p,rotation:nextRotation(p.rotation)}:p))}
 const removeSelected=()=>{if(selected){void commit(decor.placements.filter(p=>p.id!==selected));setSelected(null)}}

 const cells=Array.from({length:GRID_ROWS*GRID_COLS},(_,i)=>({col:(i%GRID_COLS)+1,row:Math.floor(i/GRID_COLS)+1}))

 return <section className="sanctuary-build">
  <div className="build-toolbar"><p className="wb-muted">Tap an item below, then tap a spot on your island to place it. Tap a placed item to rotate or remove it.</p><label>Time of day<select value={phase} onChange={e=>setPhase(e.target.value as IslandPhase)}>{ISLAND_PHASES.map(p=><option key={p} value={p}>{p[0].toUpperCase()+p.slice(1)}</option>)}</select></label></div>
  <div className="build-canvas" style={{backgroundImage:'url(/garden/build/island/'+phase+'.png)'}}>
   <div className="build-grid" style={{gridTemplateColumns:'repeat('+GRID_COLS+',1fr)'}}>
    {cells.map(({col,row})=>{
     const occupant=cellOccupant(col,row)
     const asset=occupant?BUILD_ASSET_BY_ID[occupant.assetId]:undefined
     return <button type="button" key={col+':'+row} className={'build-cell'+(occupant?' has-item':'')+(selected&&occupant?.id===selected?' is-selected':'')} onClick={()=>placeAt(col,row)} aria-label={occupant?(asset?.label??'Placed item'):'Empty spot, column '+col+' row '+row}>
      {asset&&<img src={asset.src} alt="" style={{transform:'rotate('+(occupant?.rotation??0)+'deg)'}}/>}
     </button>
    })}
   </div>
   {selected&&<div className="build-item-toolbar"><button type="button" onClick={rotateSelected} aria-label="Rotate">⟳</button><button type="button" onClick={removeSelected} aria-label="Remove">🗑</button><button type="button" onClick={()=>setSelected(null)} aria-label="Done">✕</button></div>}
  </div>
  <div className="build-tray">
   <nav className="build-category-tabs" aria-label="Decoration categories">{BUILD_CATEGORIES.map(c=><button type="button" key={c} aria-current={category===c?'page':undefined} onClick={()=>{setCategory(c);setSelected(null)}}>{BUILD_CATEGORY_LABELS[c]}</button>)}</nav>
   <div className="build-palette">{BUILD_ASSETS.filter(a=>a.category===category).map(a=><button type="button" key={a.id} className={'build-palette-item'+(armed===a.id?' is-armed':'')} onClick={()=>{setArmed(armed===a.id?null:a.id);setSelected(null)}}><img src={a.src} alt=""/><small>{a.label}</small></button>)}</div>
  </div>
  {message&&<p role="status">{message}</p>}
 </section>
}
