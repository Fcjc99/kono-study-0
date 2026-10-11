import type {CSSProperties} from 'react'
import {kidGlance} from '../store/kidGlance'
import type {AppData,Kid} from '../store/model'

const weekday=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})

/** Home in the family plan: each kid at a glance (school day, due tomorrow, late work, tests this week).
 * Tapping a kid opens their plan, or the Kids page if they don't have one yet. */
export default function KidsGlance({data,profileId,today,onOpen}:{data:AppData;profileId:string;today:string;onOpen:(kid:Kid,planId?:string)=>void}){
 const rows=kidGlance(data,profileId,today)
 if(!rows.length)return null
 return <section className="wb-panel kids-glance" aria-label="Kids today"><h2>Kids today</h2><ul>{rows.map(r=><li key={r.kid.id} style={{'--kid-color':r.kid.color} as CSSProperties}>
  <button type="button" onClick={()=>onOpen(r.kid,r.planId)} aria-label={'Open '+r.kid.name+(r.planId?'’s plan':' on Kids')}>
   <span className="kids-glance-face" aria-hidden="true">{r.kid.emoji||r.kid.name.charAt(0).toUpperCase()}</span>
   <span className="kids-glance-main">
    <strong>{r.kid.name}{r.school&&<small className="kids-glance-day">{r.school}</small>}</strong>
    <span className="kids-glance-facts">
     <span>{r.dueTonight.length?'📌 '+r.dueTonight.length+' due tomorrow':'Nothing due tomorrow'}</span>
     {r.late>0&&<span className="is-late">⚠ {r.late} late</span>}
     {r.tests.map(t=><span key={t.title+t.due} className="is-test">📝 {t.title} · {t.due===today?'today':weekday(t.due)}</span>)}
    </span>
   </span>
  </button>
 </li>)}</ul></section>
}
