import {useState} from 'react'
import type {AppData, SanctuaryDecorState} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {DECOR_CATALOG, DECOR_CATEGORY_LABELS, type DecorOption} from '../game/data/decorCatalog'
import './sanctuary-decorator.css'

type SingleKey='houseStyle'|'door'|'window'|'chimney'|'tree'
type MultiKey='exteriorDecor'|'pondItems'|'terraceItems'
const SINGLE_KEYS:SingleKey[]=['houseStyle','door','window','chimney','tree']
const MULTI_KEYS:MultiKey[]=['exteriorDecor','pondItems','terraceItems']

const swatch=(option:DecorOption,selected:boolean,onSelect:()=>void,draggable:boolean)=>
 <button
  key={option.id}
  type="button"
  aria-pressed={selected}
  className={'decor-swatch'+(selected?' is-selected':'')}
  draggable={draggable}
  onDragStart={e=>e.dataTransfer.setData('text/plain',option.id)}
  onClick={onSelect}
  style={{'--swatch-color':option.swatch} as React.CSSProperties}
 ><span className="decor-swatch-color"/><small>{option.label}</small></button>

export default function SanctuaryDecorator({data,save}:{data:AppData;save:PlannerRepository['update']}){
 const profileId=data.activeProfileId
 const decor:SanctuaryDecorState=data.sanctuaryDecor[profileId]??{profileId,exteriorDecor:[],pondItems:[],terraceItems:[]}
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const commit=async(next:SanctuaryDecorState)=>{
  if(busy)return;setBusy(true);setMessage('')
  try{
   const ok=await save(d=>{if(d.activeProfileId!==profileId)throw Error('Your profile changed. Reopen this page.');return {...d,sanctuaryDecor:{...d.sanctuaryDecor,[profileId]:next}}})
   setMessage(ok?'Saved.':'Not saved yet. Check the save status and try again.')
  }catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}
  finally{setBusy(false)}
 }
 const selectSingle=(key:SingleKey,id:string)=>void commit({...decor,[key]:decor[key]===id?undefined:id})
 const selectMulti=(key:MultiKey,id:string)=>{
  const list=decor[key]
  const next=list.includes(id)?list.filter(x=>x!==id):list.length>=8?list:[...list,id]
  void commit({...decor,[key]:next})
 }
 const dropOn=(onDrop:(id:string)=>void)=>({
  onDragOver:(e:React.DragEvent)=>e.preventDefault(),
  onDrop:(e:React.DragEvent)=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(id)onDrop(id)},
 })
 const singleSection=(key:SingleKey)=>{
  const chosen=DECOR_CATALOG[key].find(o=>o.id===decor[key])
  return <section className="decor-category" key={key}>
   <h3>{DECOR_CATEGORY_LABELS[key]}</h3>
   <div className="decor-slot" {...dropOn(id=>selectSingle(key,id))}>
    {chosen?<><span className="decor-swatch-color" style={{'--swatch-color':chosen.swatch} as React.CSSProperties}/><span>{chosen.label}</span><button type="button" onClick={()=>selectSingle(key,chosen.id)}>Clear</button></>:<span className="wb-muted">Drag a {DECOR_CATEGORY_LABELS[key].toLowerCase()} here, or tap one below</span>}
   </div>
   <div className="decor-palette">{DECOR_CATALOG[key].map(o=>swatch(o,decor[key]===o.id,()=>selectSingle(key,o.id),true))}</div>
  </section>
 }
 const multiSection=(key:MultiKey)=>{
  const chosen=decor[key]
  return <section className="decor-category" key={key}>
   <h3>{DECOR_CATEGORY_LABELS[key]}</h3>
   <div className="decor-slot decor-slot-multi" {...dropOn(id=>{if(!chosen.includes(id))selectMulti(key,id)})}>
    {chosen.length?chosen.map(id=>{const option=DECOR_CATALOG[key].find(o=>o.id===id);return option&&<span className="decor-chip" key={id}><span className="decor-swatch-color" style={{'--swatch-color':option.swatch} as React.CSSProperties}/>{option.label}<button type="button" onClick={()=>selectMulti(key,id)}>×</button></span>})
     :<span className="wb-muted">Drag up to 8 items here, or tap below</span>}
   </div>
   <div className="decor-palette">{DECOR_CATALOG[key].map(o=>swatch(o,chosen.includes(o.id),()=>selectMulti(key,o.id),true))}</div>
  </section>
 }
 return <section className="wb-panel sanctuary-decorator">
  <div className="wb-section-head"><div><small>YOUR ISLAND</small><h2>Decorate your Sanctuary</h2></div></div>
  <p>Pick a look for your house, then add trees, pond decorations and terrace furniture. Drag an option onto its spot, or just tap it — everything saves as you go. These are placeholder colors until real art ships; your choices are kept either way.</p>
  {SINGLE_KEYS.map(singleSection)}
  {MULTI_KEYS.map(multiSection)}
  {message&&<p role="status">{message}</p>}
 </section>
}
