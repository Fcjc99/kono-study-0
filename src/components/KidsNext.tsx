import type {CSSProperties} from 'react'
import type {AppData} from '../store/model'
import {kidGlance} from '../store/kidGlance'
import {classTime} from '../store/classSchedule'
import {leaveBy} from '../store/leaveBy'
import {daysOffOn,dayOffIcon} from '../store/daysOff'

/** Inside the family plan's Today card: one short line per kid with what's next for them today (and when
 * to leave), or that they're out. The whole picture of each kid is on the Kids page. */
export default function KidsNext({data,profileId,today,nowClock}:{data:AppData;profileId:string;today:string;nowClock:string}){
 const off=daysOffOn(data,profileId,today)
 const rows=kidGlance(data,profileId,today,nowClock).flatMap(r=>{
  const out=off.find(d=>!d.kidIds.length||d.kidIds.includes(r.kid.id))
  const text=out?dayOffIcon(out.reason)+' '+(out.reason==='sick'?'Out sick today':out.reason==='snow'?'Snow day':'Day off')
   :r.next?r.next.title+' '+classTime(r.next.time)+(r.next.travelMinutes?' · leave '+classTime(leaveBy(r.next.time,r.next.travelMinutes)!):'')+(r.laterToday?' (+'+r.laterToday+')':''):''
  return text?[{kid:r.kid,text}]:[]
 })
 if(!rows.length)return null
 return <ul className="kids-next" aria-label="What’s next for the kids">{rows.map(r=><li key={r.kid.id} style={{'--kid-color':r.kid.color} as CSSProperties}><strong>{r.kid.emoji?r.kid.emoji+' ':''}{r.kid.name}</strong> {r.text}</li>)}</ul>
}
