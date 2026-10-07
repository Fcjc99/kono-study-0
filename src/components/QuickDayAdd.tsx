import {useState,type FormEvent} from 'react'
import {parseQuickAdd} from '../store/quickAdd'
import type {CalendarEventKind} from '../store/model'

/** Sanctuary › Today's / Tomorrow's schedule › "＋ Add": one line for that day, right in the card. It
 * becomes an assignment or test due that day, or a lesson, appointment, practice or other event (at a
 * time, if given), and shows up in the card and on the Planner calendar like anything else. The class and a time in the words are picked
 * up too ("bio worksheet", "math test at 3"). */
export type QuickDayItem={key:'tasks'|'exams'|'calendarEvents';title:string;subjectId:string;time?:string;eventKind?:CalendarEventKind}
/** The Type choices: an assignment, a test, or one kind of calendar event. */
type Kind='tasks'|'exams'|`event:${CalendarEventKind}`
const KINDS:[Kind,string][]=[['tasks','Assignment'],['exams','Test'],['event:lesson','Lesson'],['event:appointment','Appointment'],['event:sports','Practice or game'],['event:personal','Event']]

export default function QuickDayAdd({date,dayName,subjects,onAdd,onClose}:{date:string;dayName:string;subjects:{id:string;name:string}[];onAdd:(item:QuickDayItem)=>void;onClose:()=>void}){
 const [text,setText]=useState(''),[picked,setPicked]=useState<Kind|null>(null),[time,setTime]=useState('')
 const guess=text.trim()?parseQuickAdd(text,subjects,date):null
 // Until a type is picked, a test word ("quiz", "exam") makes it a test.
 const kind:Kind=picked??(guess?.key==='exams'?'exams':'tasks')
 const at=time||guess?.time||''
 const submit=(e:FormEvent)=>{
  e.preventDefault()
  if(!guess)return
  const event=kind.startsWith('event:')?kind.slice(6) as CalendarEventKind:undefined
  onAdd({key:event?'calendarEvents':kind as 'tasks'|'exams',title:guess.title,subjectId:guess.subjectId,...(event?{eventKind:event}:{}),...(at?{time:at}:{})})
  setText('');setTime('');setPicked(null)
 }
 return <form className="quick-day-add" onSubmit={submit} aria-label={'Add for '+dayName}>
  <input value={text} onChange={e=>setText(e.target.value)} autoFocus placeholder={'Add for '+dayName+': bio worksheet, math test…'} aria-label={'What to add for '+dayName} autoComplete="off" enterKeyHint="done" maxLength={300}/>
  <div className="quick-day-add-row">
   <label className="quick-day-type">Type<select value={kind} onChange={e=>setPicked(e.target.value as Kind)}>{KINDS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label className="quick-day-time">Time<input type="time" value={at} onChange={e=>setTime(e.target.value)}/></label>
   <button type="submit" className="primary" disabled={!guess}>Add</button>
   <button type="button" onClick={onClose}>Done</button>
  </div>
  {guess&&guess.subjectName&&<p className="wb-muted quick-day-hint">For {guess.subjectName}</p>}
 </form>
}
