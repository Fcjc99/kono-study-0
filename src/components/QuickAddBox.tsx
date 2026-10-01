import {useState,type FormEvent} from 'react'
import {parseQuickAdd,type QuickAddGuess} from '../store/quickAdd'
import {classTime} from '../store/classSchedule'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})

/** "＋ Add" › Type it: one line in plain words, with a live preview of what KONO understood. Add saves
 * it as shown; Edit details opens the full editor with it filled in. */
export default function QuickAddBox({subjects,today,onAdd,onEdit}:{subjects:{id:string;name:string}[];today:string;onAdd:(guess:QuickAddGuess)=>void;onEdit:(guess:QuickAddGuess)=>void}){
 const [text,setText]=useState('')
 const guess=text.trim()?parseQuickAdd(text,subjects,today):null
 const submit=(e:FormEvent)=>{e.preventDefault();if(guess)onAdd(guess)}
 return <form className="quick-add-box" onSubmit={submit}>
  <label>Type it<input value={text} onChange={e=>setText(e.target.value)} placeholder="bio worksheet due fri" autoComplete="off" enterKeyHint="done" aria-describedby="quick-add-preview"/></label>
  <p id="quick-add-preview" className="quick-add-preview" aria-live="polite">{guess?<><strong>{guess.key==='exams'?'Exam':'Assignment'}: {guess.title}</strong><span>{[guess.subjectName,niceDate(guess.due)+(guess.dateFound?'':' (no date found, so tomorrow)'),guess.time?classTime(guess.time):''].filter(Boolean).join(' · ')}</span></>:<span className="wb-muted">Try “math test thursday” or “english essay due 10/12 at 4pm”.</span>}</p>
  <div className="wb-toolbar"><button type="submit" className="primary" disabled={!guess}>Add</button><button type="button" disabled={!guess} onClick={()=>guess&&onEdit(guess)}>Edit details</button></div>
 </form>
}
