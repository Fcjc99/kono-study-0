import type {CSSProperties} from 'react'
import type {AppData} from '../store/model'
import {kidGlance} from '../store/kidGlance'
import {classTime} from '../store/classSchedule'
import {leaveBy} from '../store/leaveBy'
import {daysOffOn,dayOffIcon} from '../store/daysOff'

/** Inside the family plan's Today card: one short line per kid with what's next for them today (and when
 * to leave), or that they're out. From 6 PM, once a kid has nothing more tonight, their line is tomorrow's
 * first thing instead ("Tomorrow: Soccer 4:00 PM"). The whole picture of each kid is on the Kids page. */
export const EVENING='18:00'
const addDay=(date:string)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const outText=(reason:string,when:string)=>dayOffIcon(reason as 'sick')+' '+(reason==='sick'?'Out sick '+when:reason==='snow'?'Snow day'+(when==='today'?'':' tomorrow'):'Day off'+(when==='today'?'':' tomorrow'))
export default function KidsNext({data,profileId,today,nowClock}:{data:AppData;profileId:string;today:string;nowClock:string}){
 const evening=nowClock>=EVENING,off=daysOffOn(data,profileId,today),offTomorrow=evening?daysOffOn(data,profileId,addDay(today)):[]
 const outOf=(list:typeof off,kidId:string)=>list.find(d=>!d.kidIds.length||d.kidIds.includes(kidId))
 const rows=kidGlance(data,profileId,today,nowClock).flatMap(r=>{
  const out=outOf(off,r.kid.id),next=r.next&&!out?r.next:undefined,first=r.tomorrow.find(e=>e.time)??r.tomorrow[0],outTomorrow=outOf(offTomorrow,r.kid.id)
  const line=(e:{title:string;time?:string;travelMinutes?:number})=>e.title+(e.time?' '+classTime(e.time):'')+(e.time&&e.travelMinutes?' · leave '+classTime(leaveBy(e.time,e.travelMinutes)!):'')
  const text=next?line(next)+(r.laterToday?' (+'+r.laterToday+')':'')
   :evening&&outTomorrow?outText(outTomorrow.reason,'tomorrow')
   :evening&&first?'Tomorrow: '+line(first)+(r.tomorrow.length>1?' (+'+(r.tomorrow.length-1)+')':'')
   :out?outText(out.reason,'today'):''
  return text?[{kid:r.kid,text,tomorrow:!next&&evening}]:[]
 })
 if(!rows.length)return null
 return <ul className={'kids-next'+(evening&&rows.every(r=>r.tomorrow)?' is-tomorrow':'')} aria-label="What’s next for the kids">{rows.map(r=><li key={r.kid.id} style={{'--kid-color':r.kid.color} as CSSProperties}><strong>{r.kid.emoji?r.kid.emoji+' ':''}{r.kid.name}</strong> {r.text}</li>)}</ul>
}
