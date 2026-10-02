import {useState,type FormEvent} from 'react'
import {parseQuickAdd} from '../store/quickAdd'

/** Sanctuary › Today's / Tomorrow's schedule › "＋ Add": one line for that day, right in the card. It
 * becomes an assignment or test due that day, or an event (at a time, if given), and shows up in the
 * card and on the Planner calendar like anything else. The class and a time in the words are picked
 * up too ("bio worksheet", "math test at 3"). */
export type QuickDayItem={key:'tasks'|'exams'|'calendarEvents';title:string;subjectId:string;time?:string}
type Kind=QuickDayItem['key']
const KINDS:[Kind,string][]=[['tasks','Assignment'],['exams','Test'],['calendarEvents','Event']]

export default function QuickDayAdd({date,dayName,subjects,onAdd,onClose}:{date:string;dayName:string;subjects:{id:string;name:string}[];onAdd:(item:QuickDayItem)=>void;onClose:()=>void}){
 const [text,setText]=useState(''),[picked,setPicked]=useState<Kind|null>(null),[time,setTime]=useState('')
 const guess=text.trim()?parseQuickAdd(text,subjects,date):null
 // Until a type is picked, a test word ("quiz", "exam") makes it a test.
 const kind:Kind=picked??(guess?.key==='exams'?'exams':'tasks')
 const at=time||guess?.time||''
 const submit=(e:FormEvent)=>{
  e.preventDefault()
  if(!guess)return
  onAdd({key:kind,title:guess.title,subjectId:guess.subjectId,...(at?{time:at}:{})})
  setText('');setTime('');setPicked(null)
 }
 return <form className="quick-day-add" onSubmit={submit} aria-label={'Add for '+dayName}>
  <input value={text} onChange={e=>setText(e.target.value)} autoFocus placeholder={'Add for '+dayName+': bio worksheet, math test…'} aria-label={'What to add for '+dayName} autoComplete="off" enterKeyHint="done" maxLength={300}/>
  <div className="quick-day-add-row">
   <div className="quick-day-kinds" role="radiogroup" aria-label="Type">{KINDS.map(([value,label])=><button type="button" key={value} role="radio" aria-checked={kind===value} onClick={()=>setPicked(value)}>{label}</button>)}</div>
   <label className="quick-day-time">Time<input type="time" value={at} onChange={e=>setTime(e.target.value)}/></label>
   <button type="submit" className="primary" disabled={!guess}>Add</button>
   <button type="button" onClick={onClose}>Done</button>
  </div>
  {guess&&guess.subjectName&&<p className="wb-muted quick-day-hint">For {guess.subjectName}</p>}
 </form>
}
