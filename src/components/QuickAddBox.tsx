import {useState,type FormEvent} from 'react'
import {parseQuickAdd,type QuickAddGuess} from '../store/quickAdd'
import {classTime} from '../store/classSchedule'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})

/** "＋ Add" › Type it: one line in plain words, with a live preview of what KONO understood. Add saves
 * it as shown; Edit details opens the full editor with it filled in. */
type WithLink=QuickAddGuess&{link?:string}
export default function QuickAddBox({clashes,subjects,people=[],today,initialText='',link='',onAdd,onEdit}:{subjects:{id:string;name:string}[];people?:{id:string;name:string}[];clashes?:(guess:QuickAddGuess)=>{date:string;text:string}[];today:string;initialText?:string;link?:string;onAdd:(guess:WithLink)=>void;onEdit:(guess:WithLink)=>void}){
 const [text,setText]=useState(initialText)
 const parsed=text.trim()?parseQuickAdd(text,subjects,today,people):null,guess:WithLink|null=parsed&&link?{...parsed,link}:parsed
 const submit=(e:FormEvent)=>{e.preventDefault();if(guess)onAdd(guess)}
 return <form className="quick-add-box" onSubmit={submit}>
  <label>Type it<input value={text} onChange={e=>setText(e.target.value)} autoFocus={!!initialText||!!link} placeholder="bio worksheet due fri" autoComplete="off" enterKeyHint="done" aria-describedby="quick-add-preview"/></label>
  <p id="quick-add-preview" className="quick-add-preview" aria-live="polite">{guess?<><strong>{guess.key==='exams'?'Exam':guess.key==='calendarEvents'?'Event':'Assignment'}: {guess.title}</strong>{guess.event?<span>{[guess.event.repeatLabel?guess.event.repeatLabel+', from '+niceDate(guess.due)+' to '+niceDate(guess.event.until):niceDate(guess.due)+(guess.dateFound?'':' (no date found, so tomorrow)'),guess.time?classTime(guess.time)+(guess.event.endTime?'–'+classTime(guess.event.endTime):''):'',guess.event.people.length?'For '+guess.event.people.join(' & '):'',guess.event.location?'📍 '+guess.event.location:''].filter(Boolean).join(' · ')}</span>:<span>{[guess.subjectName,niceDate(guess.due)+(guess.dateFound?'':' (no date found, so tomorrow)'),guess.time?classTime(guess.time):''].filter(Boolean).join(' · ')}</span>}{link&&<span>🔗 {link.replace(/^https?:\/\//,'').slice(0,60)}</span>}</>:<span className="wb-muted">Try “math test thursday”, “essay due 10/12” or “soccer every Tue and Thu 4pm”.</span>}</p>
  {(()=>{const list=guess?.event&&clashes?clashes(guess):[];return list.length?<div className="clash-warning" role="status"><strong>⚠️ Heads up</strong><ul>{list.slice(0,2).map(c=><li key={c.date+c.text}>{c.text}</li>)}</ul></div>:null})()}
  <div className="wb-toolbar"><button type="submit" className="primary" disabled={!guess}>Add</button><button type="button" disabled={!guess} onClick={()=>guess&&onEdit(guess)}>Edit details</button></div>
 </form>
}
