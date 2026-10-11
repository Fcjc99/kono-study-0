import Modal from './Modal'
import type {AppData} from '../store/model'
import {classOccurrences,classTime,type ClassOccurrence} from '../store/classSchedule'
import {addDays} from '../store/studyScheduler'

const shortDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
const sameClass=(a:ClassOccurrence,b:ClassOccurrence)=>a.season.id===b.season.id&&(a.block.subjectId&&b.block.subjectId?a.block.subjectId===b.block.subjectId:a.block.label.trim().toLowerCase()===b.block.label.trim().toLowerCase())

/** A class's page (tap a class's name on Home, the Planner or a subject): when it meets next, what's
 * due for it, and its notes, with ＋ Homework and ＋ Note already set to this class. At a rotation school
 * the next meetings follow the rotation (a class can be in a different block each day). */
export default function ClassSheet({item,data,today,close,onAdd,onToggleTask,onOpenNote,onOpenSubject}:{
 item:ClassOccurrence;data:AppData;today:string;close:()=>void
 onAdd:(kind:'tasks'|'notes'|'exams',date:string,subjectId:string)=>void
 onToggleTask:(id:string)=>void;onOpenNote:(id:string)=>void;onOpenSubject:(subjectId:string)=>void
}){
 const subjectId=item.block.subjectId??'',profileId=data.activeProfileId
 // The next three meetings, from today on, in this class's season.
 const next:ClassOccurrence[]=[]
 for(let d=today;next.length<3&&d<=addDays(today,45);d=addDays(d,1))for(const c of classOccurrences({activeProfileId:profileId,studySeasons:[item.season]},d))if(next.length<3&&sameClass(c,item)&&!c.block.skippedDates?.includes(d))next.push(c)
 const nextDate=next.find(c=>c.date>today)?.date??next[0]?.date??today
 const tasks=subjectId?data.tasks.filter(t=>t.profileId===profileId&&t.subjectId===subjectId&&!t.done).sort((a,b)=>a.due.localeCompare(b.due)):[]
 const exams=subjectId?data.exams.filter(e=>e.profileId===profileId&&e.subjectId===subjectId&&!e.done&&e.due>=today).sort((a,b)=>a.due.localeCompare(b.due)):[]
 const notes=subjectId?data.notes.filter(n=>n.profileId===profileId&&n.subjectId===subjectId&&!n.completed).sort((a,b)=>b.created.localeCompare(a.created)).slice(0,6):[]
 const classNotes=Object.entries(item.block.occurrenceNotes??{}).filter(([,t])=>t.trim()).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,3)
 const where=[item.block.slot,item.block.location].filter(Boolean).join(' · ')
 return <Modal title={item.block.label} close={close}>
  <div className="class-sheet">
   {where&&<p className="class-sheet-where">{where}</p>}
   <section aria-label="Next classes"><h3>Next classes</h3>{next.length?<ul className="class-sheet-next">{next.map(c=><li key={c.id}><strong>{c.date===today?'Today':shortDate(c.date)}</strong> <span>{classTime(c.displayStart??c.block.start)}{c.block.slot?' · '+c.block.slot:''}</span></li>)}</ul>:<p className="wb-muted">Not meeting in the next few weeks.</p>}</section>
   <div className="class-sheet-actions"><button type="button" className="primary" disabled={!subjectId} onClick={()=>{close();onAdd('tasks',nextDate,subjectId)}}>＋ Homework</button><button type="button" disabled={!subjectId} onClick={()=>{close();onAdd('exams',nextDate,subjectId)}}>＋ Test</button><button type="button" disabled={!subjectId} onClick={()=>{close();onAdd('notes',today,subjectId)}}>＋ Note</button></div>
   {!subjectId&&<p className="wb-muted">Save this schedule to link the class to its subject, then homework and notes can go with it.</p>}
   {subjectId&&<>
    <section aria-label="Due for this class"><h3>Due</h3>{tasks.length||exams.length?<ul className="class-sheet-due">
     {exams.map(e=><li key={e.id} className="is-exam"><span aria-hidden="true">★</span> {e.title} <small>{shortDate(e.due)}</small></li>)}
     {tasks.map(t=><li key={t.id}><label className="wb-check"><input type="checkbox" checked={false} onChange={()=>onToggleTask(t.id)} aria-label={'Done: '+t.title}/>{t.title}</label> <small className={t.due<today?'is-late':''}>{t.due<today?'late · ':''}{shortDate(t.due)}</small></li>)}
    </ul>:<p className="wb-muted">Nothing due. Nice.</p>}</section>
    <section aria-label="Notes for this class"><h3>Notes</h3>{notes.length||classNotes.length?<ul className="class-sheet-notes">
     {classNotes.map(([d,t])=><li key={'occ-'+d}><small>{shortDate(d)} in class</small> {t.slice(0,140)}</li>)}
     {notes.map(n=><li key={n.id}><button type="button" className="class-sheet-note" onClick={()=>{close();onOpenNote(n.id)}}><strong>{n.title||'Note'}</strong> <small>{n.body.replace(/[*_#>`~]/g,'').replace(/\s+/g,' ').slice(0,100)}</small></button></li>)}
    </ul>:<p className="wb-muted">No notes yet.</p>}</section>
    <button type="button" className="class-sheet-subject" onClick={()=>{close();onOpenSubject(subjectId)}}>Everything for this subject →</button>
   </>}
  </div>
 </Modal>
}
