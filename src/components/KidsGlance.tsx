import {useState,type CSSProperties} from 'react'
import Modal from './Modal'
import {kidGlance} from '../store/kidGlance'
import {addCareEvent,SNACKS} from '../store/konoCare'
import {uid,type AppData,type Kid} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {daysOffOn,dayOffIcon} from '../store/daysOff'
import {classTime} from '../store/classSchedule'
import {leaveBy} from '../store/leaveBy'

// How much of what's on a kid's plate today is done: done today out of done + due tomorrow + late.
const ring=(r:{doneToday:string[];dueTonight:string[];late:number})=>{const total=r.doneToday.length+r.dueTonight.length+r.late;return total?r.doneToday.length/total:null}
const weekday=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})
const addDays=(date:string,n:number)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

/** The Kids page: one card per kid, with today (school day, classes, what's next, late work, done today),
 * tomorrow (due, activities) and the rest of the week (activities and tests). The name opens their plan;
 * a kid without one gets "Make …’s plan". 🎁 sends a snack for their KONO with a note; Edit and 🗑 are
 * the kid's own details. */
export default function KidsGlance({data,profileId,today,from,save,onOpen,onMakePlan,onEdit,onRemove,onDayOff}:{data:AppData;profileId:string;today:string;from:string;save:PlannerRepository['update'];onOpen:(kid:Kid,planId?:string)=>void;onMakePlan?:(kid:Kid)=>void;onEdit?:(kid:Kid)=>void;onRemove?:(kid:Kid)=>void;onDayOff?:()=>void}){
 const now=new Date(),rows=kidGlance(data,profileId,today,String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'))
 const [gift,setGift]=useState<{kid:Kid;planId:string}|null>(null)
 if(!rows.length)return null
 // Out sick or a snow day today: said on the kid's card instead of their school day.
 const off=daysOffOn(data,profileId,today),outFor=(kidId:string)=>off.find(d=>!d.kidIds.length||d.kidIds.includes(kidId))
 const list=(items:string[],more=0)=>items.length?<>{items.map(t=><span key={t}>{t}</span>)}{more>0&&<span className="is-more">+{more} more</span>}</>:null
 return <section className="kids-glance kid-cards" aria-label="Your kids">{onDayOff&&<div className="kid-cards-tools">{onDayOff&&<button type="button" className="link-button" onClick={onDayOff}>{off.length?'Change who’s out':'🤒 Out sick or snow day?'}</button>}</div>}<ul>{rows.map(r=>{
  const o=outFor(r.kid.id),face=<span className={'kids-glance-face'+(ring(r)!==null?' has-ring':'')} aria-hidden="true" style={ring(r)!==null?{'--done':ring(r)} as CSSProperties:undefined}>{r.kid.photo?<img className="avatar-img" src={r.kid.photo} alt="" draggable={false}/>:r.kid.emoji||r.kid.name.charAt(0).toUpperCase()}</span>
  const name=<><strong>{r.kid.name}</strong>{o?<small className="kids-glance-day is-out">{dayOffIcon(o.reason)} {o.reason==='sick'?'Out sick':o.reason==='snow'?'Snow day':'Day off'}</small>:r.school&&<small className="kids-glance-day">{r.school}</small>}</>
  const todayLines=[
   ...(r.classes.length?['🏫 '+r.classes.slice(0,3).join(', ')+(r.classes.length>3?' +'+(r.classes.length-3):'')]:[]),
   ...(r.next?['🕒 '+r.next.title+' '+classTime(r.next.time)+(r.next.travelMinutes?' · leave '+classTime(leaveBy(r.next.time,r.next.travelMinutes)!):'')+(r.laterToday?' (+'+r.laterToday+' more)':'')]:[]),
   ...(r.late?['⚠ '+r.late+' late']:[]),
   ...(r.doneToday.length?['✓ '+r.doneToday.length+' done today'+(r.doneToday.length<=2?': '+r.doneToday.join(', '):'')]:[]),
   ...r.tests.filter(t=>t.due===today).map(t=>'📝 '+t.title+' today'),
  ]
  const tomorrowLines=[...(r.dueTonight.length?['📌 '+r.dueTonight.length+' due: '+r.dueTonight.slice(0,2).join(', ')+(r.dueTonight.length>2?'…':'')]:[]),...r.tomorrow.map(e=>'🗓️ '+e.title+(e.time?' '+classTime(e.time):'')),...r.tests.filter(t=>t.due===addDays(today,1)).map(t=>'📝 '+t.title)]
  const laterLines=r.later.map(x=>weekday(x.date)+' · '+(x.test?'📝 ':'')+x.title+(x.time?' '+classTime(x.time):''))
  return <li key={r.kid.id} className="kid-card" style={{'--kid-color':r.kid.color} as CSSProperties}>
   <div className="kid-card-head">
    {r.planId?<button type="button" className="kid-card-open" onClick={()=>onOpen(r.kid,r.planId)} aria-label={'Open '+r.kid.name+'’s plan'}>{face}<span className="kid-card-name">{name}</span><span className="kid-card-go" aria-hidden="true">›</span></button>:<div className="kid-card-open">{face}<span className="kid-card-name">{name}</span></div>}
    <div className="kid-card-tools">
     {!r.planId&&onMakePlan&&<button type="button" className="kid-plan-open" onClick={()=>onMakePlan(r.kid)}>Make {r.kid.name}’s plan</button>}
     {r.planId&&<button type="button" className="kids-glance-gift" aria-label={'Send '+r.kid.name+'’s KONO a snack'} title={'Send '+r.kid.name+'’s KONO a snack'} onClick={()=>setGift({kid:r.kid,planId:r.planId!})}>🎁</button>}
     {onEdit&&<button type="button" aria-label={'Edit '+r.kid.name} onClick={()=>onEdit(r.kid)}>Edit</button>}
     {onRemove&&<button type="button" className="kid-roster-remove" aria-label={'Move '+r.kid.name+' to Trash'} title="Move to Trash" onClick={()=>onRemove(r.kid)}>🗑</button>}
    </div>
   </div>
   <dl className="kid-card-days">
    <div><dt>Today</dt><dd>{list(todayLines)??<span className="wb-muted">Nothing else today</span>}</dd></div>
    <div><dt>Tomorrow</dt><dd>{list(tomorrowLines)??<span className="wb-muted">Nothing yet</span>}</dd></div>
    <div><dt>Later this week</dt><dd>{list(laterLines.slice(0,4),laterLines.length-4)??<span className="wb-muted">A quiet week</span>}</dd></div>
   </dl>
  </li>})}</ul>
 {gift&&<GiftSheet kid={gift.kid} planId={gift.planId} from={from} save={save} close={()=>setGift(null)}/>}
 </section>
}

/** A “great job” for a kid: a snack for their KONO and a short note, waiting on their island. */
function GiftSheet({kid,planId,from,save,close}:{kid:Kid;planId:string;from:string;save:PlannerRepository['update'];close:()=>void}){
 const [snack,setSnack]=useState(SNACKS[0].id),[note,setNote]=useState('Great job!'),[busy,setBusy]=useState(false)
 const send=async()=>{setBusy(true);const now=new Date();const ok=await save(d=>({...d,konoCare:{...d.konoCare,[planId]:addCareEvent(d.konoCare[planId],planId,{id:uid('gift'),kind:'gift',at:now.toISOString(),item:snack,from:from.slice(0,60),note:note.trim().slice(0,140)},now)}}));setBusy(false);if(ok)close()}
 return <Modal title={'A treat for '+kid.name+'’s KONO'} close={close}><form className="gift-sheet" onSubmit={e=>{e.preventDefault();void send()}}>
  <fieldset><legend>Pick a snack</legend><div className="gift-snacks">{SNACKS.map(s=><label key={s.id} className={snack===s.id?'is-picked':''}><input type="radio" name="gift-snack" checked={snack===s.id} onChange={()=>setSnack(s.id)}/><span aria-hidden="true">{s.emoji}</span> {s.name}</label>)}</div></fieldset>
  <label>Note for {kid.name}<input maxLength={140} value={note} onChange={e=>setNote(e.target.value)}/></label>
  <button type="submit" className="primary" disabled={busy}>🎁 Send to {kid.name}’s KONO</button>
 </form></Modal>
}
