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

/** Home in the family plan: each kid at a glance (school day, due tomorrow, late work, done today, tests
 * this week). Tapping a kid opens their plan, or the Kids page if they don't have one yet. A kid with a
 * plan of their own can be sent a snack for their KONO with a note (🎁). */
export default function KidsGlance({data,profileId,today,from,save,onOpen,onDayOff}:{data:AppData;profileId:string;today:string;from:string;save:PlannerRepository['update'];onOpen:(kid:Kid,planId?:string)=>void;onDayOff?:()=>void}){
 const now=new Date(),rows=kidGlance(data,profileId,today,String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'))
 const [gift,setGift]=useState<{kid:Kid;planId:string}|null>(null)
 if(!rows.length)return null
 // Out sick or a snow day today: said on the kid's row instead of their school day.
 const off=daysOffOn(data,profileId,today),outFor=(kidId:string)=>off.find(d=>!d.kidIds.length||d.kidIds.includes(kidId))
 return <section className="wb-panel kids-glance" aria-label="Kids today"><div className="wb-section-head"><h2>Kids today</h2>{onDayOff&&<button type="button" className="link-button" onClick={onDayOff}>{off.length?'Change who’s out':'🤒 Out sick or snow day?'}</button>}</div><ul>{rows.map(r=><li key={r.kid.id} style={{'--kid-color':r.kid.color} as CSSProperties}>
  <button type="button" onClick={()=>onOpen(r.kid,r.planId)} aria-label={'Open '+r.kid.name+(r.planId?'’s plan':' on Kids')}>
   <span className={'kids-glance-face'+(ring(r)!==null?' has-ring':'')} aria-hidden="true" style={ring(r)!==null?{'--done':ring(r)} as CSSProperties:undefined}>{r.kid.photo?<img className="avatar-img" src={r.kid.photo} alt="" draggable={false}/>:r.kid.emoji||r.kid.name.charAt(0).toUpperCase()}</span>
   <span className="kids-glance-main">
    <strong>{r.kid.name}{(()=>{const o=outFor(r.kid.id);return o?<small className="kids-glance-day is-out">{dayOffIcon(o.reason)} {o.reason==='sick'?'Out sick':o.reason==='snow'?'Snow day':'Day off'}</small>:r.school&&<small className="kids-glance-day">{r.school}</small>})()}</strong>
    <span className="kids-glance-facts">
     {r.classes.length>0&&<span className="is-classes">🏫 {r.classes.slice(0,3).join(', ')}{r.classes.length>3?' +'+(r.classes.length-3):''}</span>}
     {r.next&&<span className="is-next">🕒 {r.next.title} {classTime(r.next.time)}{r.next.travelMinutes?' · leave '+classTime(leaveBy(r.next.time,r.next.travelMinutes)!):''}{r.laterToday?' (+'+r.laterToday+' more)':''}</span>}
     <span>{r.dueTonight.length?'📌 '+r.dueTonight.length+' due tomorrow':'Nothing due tomorrow'}</span>
     {r.late>0&&<span className="is-late">⚠ {r.late} late</span>}
     {r.doneToday.length>0&&<span className="is-done" title={r.doneToday.join(', ')}>✓ {r.doneToday.length} done today{r.doneToday.length<=2?': '+r.doneToday.join(', '):''}</span>}
     {r.tests.map(t=><span key={t.title+t.due} className="is-test">📝 {t.title} · {t.due===today?'today':weekday(t.due)}</span>)}
    </span>
   </span>
  </button>
  {r.planId&&<button type="button" className="kids-glance-gift" aria-label={'Send '+r.kid.name+'’s KONO a snack'} title={'Send '+r.kid.name+'’s KONO a snack'} onClick={()=>setGift({kid:r.kid,planId:r.planId!})}>🎁</button>}
 </li>)}</ul>
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
