import {useEffect,useState} from 'react'
import type {PlannerRepository} from '../store/repository'
import type {ClassmateProfile} from '../store/supabaseRemote'
import type {AppData} from '../store/model'
import {sharePayload,type ShareKind} from '../store/itemShare'
import './peer-connections.css'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
const nameOf=(p:ClassmateProfile)=>p.displayName||'@'+p.username

/** Assignment/exam editor › Share with a classmate: shows exactly what they'll get, then one Send per
 * connected classmate. It lands in their "Shared with you" to add to their own plan. */
export default function ShareWithClassmate({repository,data,kind,entry}:{repository:PlannerRepository;data:AppData;kind:ShareKind;entry:{title:string;due:string;subjectId:string;notes:string;estimatedMinutes?:number}}){
 const [classmates,setClassmates]=useState<ClassmateProfile[]|null>(null),[sent,setSent]=useState<string[]>([])
 const [busy,setBusy]=useState(''),[message,setMessage]=useState('')
 useEffect(()=>{let gone=false;repository.classmates().then(list=>{if(!gone)setClassmates(list)},e=>{if(!gone){setClassmates([]);setMessage(e instanceof Error?e.message:'Couldn’t load your classmates.')}});return()=>{gone=true}},[repository])
 const item=sharePayload(data,entry)
 const ready=!!item.title&&/^\d{4}-\d{2}-\d{2}$/.test(item.due)
 const send=async(p:ClassmateProfile)=>{
  setBusy(p.userId);setMessage('')
  try{await repository.shareItem(p.userId,kind,item);setSent(s=>[...s,p.userId])}
  catch(e){setMessage(e instanceof Error?e.message:'Couldn’t share it. Try again.')}
  finally{setBusy('')}
 }
 return <section className="share-classmate" aria-label="Share with a classmate">
  {ready?<div className="share-classmate-preview"><small>They’ll get</small><strong>{item.title}</strong><span>{kind==='task'?'Assignment':'Exam'} · due {niceDate(item.due)}{item.subject?' · '+item.subject:''}{item.estimatedMinutes?' · about '+(item.estimatedMinutes>=60?(item.estimatedMinutes/60)+' h':item.estimatedMinutes+' min'):''}</span>{item.notes&&<p>{item.notes}</p>}</div>:<p role="alert">Add a title and date first.</p>}
  {classmates===null?<p className="wb-muted" aria-live="polite">Loading your classmates…</p>
   :!classmates.length?<p className="wb-muted">You haven’t connected with any classmates yet. Find them in Settings › Plans &amp; account › Friends.</p>
   :<ul className="share-classmate-list">{classmates.map(p=><li key={p.userId}><span>{nameOf(p)}{p.displayName&&<small>@{p.username}</small>}</span>{sent.includes(p.userId)?<span role="status">Sent ✓</span>:<button type="button" disabled={!ready||!!busy} onClick={()=>void send(p)}>{busy===p.userId?'Sending…':'Send to '+nameOf(p)}</button>}</li>)}</ul>}
  {message&&<p role="alert">{message}</p>}
  <p className="wb-muted">Only what’s shown above is sent{kind==='task'?' (not your steps or planned time)':''}. They choose whether to add it to their plan.</p>
 </section>
}
