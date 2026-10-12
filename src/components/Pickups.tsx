import Modal from './Modal'
import {peopleOf,type AppData,type CalendarEvent} from '../store/model'
import {classTime} from '../store/classSchedule'
import {addDays} from '../store/studyScheduler'

const dayName=(date:string,today:string)=>date===today?'Today':date===addDays(today,1)?'Tomorrow':new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})

/** Pickups & drop-offs (Planner ⋯ in the family plan): the next week's timed events for the kids, day by
 * day, with who's driving, so a missing driver stands out. Tapping one opens it to set the driver. */
export default function Pickups({data,profileId,today,close,onOpen}:{data:AppData;profileId:string;today:string;close:()=>void;onOpen:(event:CalendarEvent)=>void}){
 const kids=data.kids.filter(k=>k.profileId===profileId)
 const last=addDays(today,6)
 const events=data.calendarEvents.filter(e=>e.profileId===profileId&&e.date>=today&&e.date<=last&&e.time&&(e.driver||peopleOf(e).length))
  .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))
 const days=[...new Set(events.map(e=>e.date))]
 const who=(e:CalendarEvent)=>peopleOf(e).map(id=>kids.find(k=>k.id===id)).filter(Boolean).map(k=>(k!.emoji?k!.emoji+' ':'')+k!.name).join(' & ')
 return <Modal title="Pickups & drop-offs" close={close}><div className="pickups">
  {!days.length&&<p className="wb-muted">Nothing with a time for the kids this week. Add a practice or appointment with a start time, and who’s driving, from the Planner.</p>}
  {days.map(day=><section key={day} aria-label={dayName(day,today)}><h3>{dayName(day,today)}</h3><ul>{events.filter(e=>e.date===day).map(e=><li key={e.id}>
   <button type="button" onClick={()=>{close();onOpen(e)}}>
    <time>{classTime(e.time!)}{e.endTime?'–'+classTime(e.endTime):''}</time>
    <span><strong>{e.title}</strong>{who(e)&&<small>{who(e)}</small>}</span>
    <span className={'pickups-driver'+(e.driver?'':' is-missing')}>{e.driver?'🚗 '+e.driver:'Who’s driving?'}</span>
   </button>
  </li>)}</ul></section>)}
 </div></Modal>
}
