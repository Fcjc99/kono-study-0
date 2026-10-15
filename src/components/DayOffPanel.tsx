import {useState,type CSSProperties} from 'react'
import type {AppData,DayOff,Kid} from '../store/model'
import {DAY_OFF_REASONS,addDayOff,removeDayOff,daysOffOn,dayOffIcon,dayOffLabel} from '../store/daysOff'
import type {PlannerRepository} from '../store/repository'
import Modal from './Modal'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})

/** Out sick or a snow day: pick the day, who's out (or everyone) and why. Their classes that day are skipped
 * (a snow day closes the school) and their activities show as off, on every screen; Take back undoes it. */
export default function DayOffPanel({data,profileId,kids,date:start,save,close}:{data:AppData;profileId:string;kids:Kid[];date:string;save:PlannerRepository['update'];close:()=>void}){
 const [date,setDate]=useState(start),[reason,setReason]=useState<DayOff['reason']>('sick'),[who,setWho]=useState<string[]>(kids.length===1?[kids[0].id]:[]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const already=daysOffOn(data,profileId,date)
 const everyone=!who.length
 const toggle=(id:string)=>setWho(who.includes(id)?who.filter(x=>x!==id):[...who,id])
 const add=async()=>{
  if(!date){setError('Pick a day.');return}
  setBusy(true);setError('')
  const ok=await save(d=>addDayOff(d,profileId,date,who,reason))
  setBusy(false)
  if(ok)close();else setError('Not saved yet. Try again.')
 }
 const takeBack=(id:string)=>void save(d=>removeDayOff(d,id))
 return <Modal title="Out sick or a snow day" close={close}><div className="day-off">
  <label>Day<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
  <div className="calendar-views day-off-reasons" role="group" aria-label="Why">{DAY_OFF_REASONS.map(r=><button type="button" key={r.id} aria-pressed={reason===r.id} onClick={()=>setReason(r.id)}><span aria-hidden="true">{r.icon}</span> {r.label}</button>)}</div>
  {kids.length>1&&<div className="day-off-who" role="group" aria-label="Who’s out"><button type="button" aria-pressed={everyone} onClick={()=>setWho([])}>Everyone</button>{kids.map(k=><button type="button" key={k.id} aria-pressed={who.includes(k.id)} style={{'--kid':k.color} as CSSProperties} onClick={()=>toggle(k.id)}>{k.emoji?k.emoji+' ':''}{k.name}</button>)}</div>}
  <p className="wb-muted">{reason==='snow'?(everyone?'School is closed for everyone that day: classes come off the calendar, and a rotating school’s day waits, the way the school counts snow days. Activities stay; delete any that are canceled.':'Their classes that day come off the calendar. Activities stay; delete any that are canceled.'):'Their classes that day are skipped, and their activities show as off.'} Take it back any time.</p>
  {error&&<p role="alert">{error}</p>}
  <div className="wb-toolbar"><button type="button" className="primary" disabled={busy} onClick={()=>void add()}>{busy?'Saving…':'Mark '+(reason==='snow'?'the snow day':reason==='sick'?'out sick':'the day off')}</button></div>
  {already.length>0&&<section className="day-off-list" aria-label={'Already marked for '+niceDate(date)}><h3>{niceDate(date)}</h3><ul>{already.map(d=><li key={d.id}><span><span aria-hidden="true">{dayOffIcon(d.reason)} </span>{dayOffLabel(data,d)}</span><button type="button" className="link-button" onClick={()=>takeBack(d.id)}>Take back</button></li>)}</ul></section>}
 </div></Modal>
}
