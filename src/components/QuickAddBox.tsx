import {useState,type FormEvent,type KeyboardEvent} from 'react'
import {parseQuickAdd,type QuickAddGuess} from '../store/quickAdd'
import {classTime} from '../store/classSchedule'
import {repeatLabel} from '../store/familyTodos'
import type {Remembered} from '../store/eventMemory'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
/** Several things at once: one per line, or separated by " / " or ";". */
const splitLines=(text:string)=>text.split(/\n|\s+\/\s+|;/).map(l=>l.trim()).filter(Boolean)

/** "＋ Add" › Type it: one line in plain words, with a live preview of what KONO understood. Add saves
 * it as shown; Edit details opens the full editor with it filled in. Several lines add several things at
 * once. An event typed again ("soccer practice") takes last time's time, people, place and driver for
 * whatever the line doesn't say. */
type WithLink=QuickAddGuess&{link?:string}
export default function QuickAddBox({clashes,subjects,people=[],today,initialText='',link='',recall,onAdd,onAddMany,onEdit}:{subjects:{id:string;name:string}[];people?:{id:string;name:string}[];clashes?:(guess:QuickAddGuess)=>{date:string;text:string}[];today:string;initialText?:string;link?:string;recall?:(title:string)=>Remembered|undefined;onAdd:(guess:WithLink)=>void;onAddMany?:(list:QuickAddGuess[])=>void;onEdit:(guess:WithLink)=>void}){
 const [text,setText]=useState(initialText)
 const read=(line:string):QuickAddGuess=>{
  const g=parseQuickAdd(line,subjects,today,people),m=g.event?recall?.(g.title):undefined
  if(!g.event||!m)return g
  const ev=g.event,time=g.time??m.time
  return {...g,...(time?{time}:{}),event:{...ev,remembered:true,...(!g.time&&m.endTime&&!ev.endTime?{endTime:m.endTime}:{}),...(!ev.location&&m.location?{location:m.location}:{}),...(!ev.location&&m.travelMinutes?{travelMinutes:m.travelMinutes}:{}),...(m.driver?{driver:m.driver}:{}),...(!ev.kidIds.length&&m.kidIds.length?{kidIds:m.kidIds,people:m.kidIds.map(id=>people.find(p=>p.id===id)?.name).filter((n):n is string=>!!n)}:{}),...(ev.kind==='personal'?{kind:m.kind}:{})}}
 }
 const lines=splitLines(text),many=lines.length>1&&!!onAddMany
 const parsed=!many&&text.trim()?read(text):null,guess:WithLink|null=parsed&&link?{...parsed,link}:parsed
 const list=many?lines.slice(0,20).map(read):[]
 const submit=(e:FormEvent)=>{e.preventDefault();if(many)onAddMany!(list);else if(guess)onAdd(guess)}
 // Enter adds; Shift+Enter starts another line.
 const keys=(e:KeyboardEvent<HTMLTextAreaElement>)=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}
 const kindOf=(g:QuickAddGuess)=>g.key==='familyTodos'?'To-do':g.key==='exams'?'Exam':g.key==='calendarEvents'?'Event':'Assignment'
 const detail=(g:QuickAddGuess)=>g.todo?[g.due?niceDate(g.due):'Any day',g.todo.repeat?'🔁 '+repeatLabel(g.todo.repeat).toLowerCase():'',g.todo.kidName?'For '+g.todo.kidName:''].filter(Boolean).join(' · ')
  :g.event?[g.event.repeatLabel?g.event.repeatLabel+', from '+niceDate(g.due)+' to '+niceDate(g.event.until):niceDate(g.due)+(g.dateFound?'':' (no date found, so tomorrow)'),g.time?classTime(g.time)+(g.event.endTime?'–'+classTime(g.event.endTime):''):'',g.event.people.length?'For '+g.event.people.join(' & '):'',g.event.location?'📍 '+g.event.location:'',g.event.driver?'🚗 '+g.event.driver:'',g.event.remembered?'like last time':''].filter(Boolean).join(' · ')
  :[g.subjectName,niceDate(g.due)+(g.dateFound?'':' (no date found, so tomorrow)'),g.time?classTime(g.time):''].filter(Boolean).join(' · ')
 const hint=people.length?'Try “soccer every Tue and Thu 4pm for Emma”, “dentist fri 3pm” or “clean house every sat”. Several at once: one per line.'.replace('Emma',people[0].name):'Try “math test thursday”, “essay due 10/12” or “soccer every Tue and Thu 4pm”. Several at once: one per line.'
 return <form className="quick-add-box" onSubmit={submit}>
  <label>Type it<textarea rows={many||text.includes('\n')?Math.min(6,Math.max(2,lines.length+1)):1} value={text} onChange={e=>setText(e.target.value)} onKeyDown={keys} autoFocus={!!initialText||!!link} placeholder="bio worksheet due fri" autoComplete="off" enterKeyHint="done" aria-describedby="quick-add-preview"/></label>
  {many?<div id="quick-add-preview" className="quick-add-preview quick-add-many" aria-live="polite"><strong>{list.length} things to add</strong><ul>{list.map((g,i)=><li key={i}><strong>{kindOf(g)}: {g.title}</strong><span>{detail(g)}</span></li>)}</ul>{lines.length>20&&<small>Only the first 20 lines are added.</small>}</div>
  :<p id="quick-add-preview" className="quick-add-preview" aria-live="polite">{guess?<><strong>{kindOf(guess)}: {guess.title}</strong><span>{detail(guess)}</span>{link&&<span>🔗 {link.replace(/^https?:\/\//,'').slice(0,60)}</span>}</>:<span className="wb-muted">{hint}</span>}</p>}
  {(()=>{const all=many?list.flatMap(g=>g.event&&clashes?clashes(g):[]):guess?.event&&clashes?clashes(guess):[];return all.length?<div className="clash-warning" role="status"><strong>⚠️ Heads up</strong><ul>{all.slice(0,2).map(c=><li key={c.date+c.text}>{c.text}</li>)}</ul></div>:null})()}
  <div className="wb-toolbar"><button type="submit" className="primary" disabled={many?!list.length:!guess}>{many?'Add all '+list.length:'Add'}</button>{!many&&guess?.key!=='familyTodos'&&<button type="button" disabled={!guess} onClick={()=>guess&&onEdit(guess)}>Edit details</button>}</div>
 </form>
}
