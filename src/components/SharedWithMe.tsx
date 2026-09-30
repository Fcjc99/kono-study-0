import {useEffect,useState} from 'react'
import type {PlannerRepository} from '../store/repository'
import type {ClassmateProfile} from '../store/supabaseRemote'
import type {AppData} from '../store/model'
import {addSharedItem,alreadyInPlan,type ReceivedItem} from '../store/itemShare'
import './peer-connections.css'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
const nameOf=(p:ClassmateProfile|undefined)=>p?p.displayName||'@'+p.username:'A classmate'

/** Assignments and exams classmates shared with this account, each to add to the plan or dismiss.
 * Shows nothing when there aren't any. */
export default function SharedWithMe({repository,data,save}:{repository:PlannerRepository;data:AppData;save:PlannerRepository['update']}){
 const [items,setItems]=useState<ReceivedItem[]>([]),[senders,setSenders]=useState<Record<string,ClassmateProfile>>({})
 const [busy,setBusy]=useState(''),[message,setMessage]=useState('')
 useEffect(()=>{let gone=false;repository.sharedWithMe().then(r=>{if(!gone){setItems(r.items);setSenders(r.senders)}},()=>undefined);return()=>{gone=true}},[repository])
 const clear=async(id:string)=>{await repository.clearSharedItem(id);setItems(list=>list.filter(i=>i.id!==id))}
 const add=async(r:ReceivedItem)=>{
  setBusy(r.id);setMessage('')
  try{
   const from=nameOf(senders[r.senderId])
   if(!await save(d=>addSharedItem(d,r.kind,r.item,from)))throw Error('Couldn’t add it to your plan. Try again.')
   setMessage('Added “'+r.item.title+'” to your plan.')
   // Already in the plan now, so if this fails it just shows as "Already in your plan" next time.
   await clear(r.id).catch(()=>undefined)
  }catch(e){setMessage(e instanceof Error?e.message:'Couldn’t add it.')}
  finally{setBusy('')}
 }
 const dismiss=async(r:ReceivedItem)=>{
  setBusy(r.id);setMessage('')
  try{await clear(r.id)}catch(e){setMessage(e instanceof Error?e.message:'Couldn’t dismiss it.')}
  finally{setBusy('')}
 }
 if(!items.length&&!message)return null
 return <section className="wb-panel shared-with-me" aria-label="Shared with you">
  <div className="wb-section-head"><div><small>FROM CLASSMATES</small><h2>Shared with you</h2></div></div>
  {message&&<p role="status">{message}</p>}
  <ul>{items.map(r=>{const have=alreadyInPlan(data,r.kind,r.item);return <li key={r.id}>
   <div><small>{nameOf(senders[r.senderId])} shared {r.kind==='task'?'an assignment':'an exam'}</small><strong>{r.item.title}</strong><span>Due {niceDate(r.item.due)}{r.item.subject?' · '+r.item.subject:''}</span>{r.item.notes&&<p>{r.item.notes}</p>}</div>
   <div className="wb-toolbar">{have?<><span className="wb-muted">Already in your plan</span><button type="button" disabled={!!busy} onClick={()=>void dismiss(r)}>Clear</button></>:<><button type="button" className="primary" disabled={!!busy} onClick={()=>void add(r)} aria-label={'Add to my plan: '+r.item.title}>{busy===r.id?'Adding…':'Add to my plan'}</button><button type="button" disabled={!!busy} onClick={()=>void dismiss(r)} aria-label={'Dismiss: '+r.item.title}>Dismiss</button></>}</div>
  </li>})}</ul>
 </section>
}
