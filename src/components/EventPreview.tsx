import type {CSSProperties} from 'react'
import {classTime} from '../store/classSchedule'
import './quick-add-event.css'

const KINDS:Record<string,[string,string]>={personal:['🗓️','#7a5cc0'],appointment:['🩺','#3f7fb0'],sports:['⚽','#2f8f5a'],activity:['🎨','#c2477a'],lesson:['📖','#b5772a'],study:['📚','#4f78b8'],work:['💼','#6b7280'],other:['✨','#8a5a78'],exam:['📝','#c2477a'],test:['📝','#c2477a'],quiz:['📝','#c2477a'],assignment:['📌','#7a5cc0']}
/** A new event as it'll look on the calendar, while you fill it in: its day, its type, its title, its time and
 * whose it is, in that person's color (or its type's). */
export default function EventPreview({date,kind,title,time,endTime,people}:{date?:string;kind?:string;title?:string;time?:string;endTime?:string;people:{name:string;color:string}[]}){
 const [icon,color]=KINDS[kind??'personal']??KINDS.personal
 const tint=people.length===1?people[0].color:color
 const day=date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}):''
 return <div className="qfa-preview" style={{'--qfa':tint} as CSSProperties} aria-hidden="true">
  <span className="qfa-preview-day">{day||'New event'}</span>
  <div className="qfa-preview-card"><i>{icon}</i><span><b>{title?.trim()||'What’s happening?'}</b><small>{time?classTime(time)+(endTime?' – '+classTime(endTime):''):'Any time'}{people.length?' · '+people.map(p=>p.name).join(' & '):''}</small></span></div>
 </div>
}
