import type {Entry} from '../store/workspace'
import type {Exam} from '../store/model'
import type {PageContext} from './pageContext'

const DAY=86_400_000
/** Exams: what's coming, soonest first, each with how many days are left, its subject and date, and what to
 * do about it (plan review with KONO's study planner, edit, mark done). Done and past exams fold away below.
 * The empty state says what an exam here is for. */
export default function ExamsPage({w}:{w:PageContext}){
 const {create,data,profile,edit,save,run,today,navigate,setPlanRequest}=w
 const mine=data.exams.filter(e=>e.profileId===profile.id)
 const upcoming=mine.filter(e=>!e.done&&e.due>=today).sort((a,b)=>a.due.localeCompare(b.due))
 const past=mine.filter(e=>e.done||e.due<today).sort((a,b)=>b.due.localeCompare(a.due))
 const days=(due:string)=>Math.round((new Date(due+'T12:00:00').getTime()-new Date(today+'T12:00:00').getTime())/DAY)
 const subjectOf=(e:Exam)=>data.subjects.find(s=>s.id===e.subjectId)
 const setDone=(e:Exam,done:boolean)=>void run(()=>save(d=>({...d,exams:d.exams.map(x=>x.id===e.id?{...x,done}:x)})),done?'Marked “'+e.title+'” done.':'Reopened “'+e.title+'”.',true)
 const planReview=()=>{setPlanRequest(n=>n+1);navigate('Planner')}
 const row=(e:Exam,isPast=false)=>{const n=days(e.due),sub=subjectOf(e),date=new Date(e.due+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
  return <li key={e.id} className={'exam-row'+(isPast?' is-past':'')+(n===0&&!isPast?' is-today':'')}>
   <div className="exam-count" aria-hidden="true">{isPast?<b>✓</b>:<><b>{n}</b><span>{n===0?'today':n===1?'day':'days'}</span></>}</div>
   <div className="exam-copy"><h3>{e.title}</h3><p>{(sub?.name??'Unassigned')+' · '+date+(isPast?'':n===0?' · today':n===1?' · tomorrow':' · in '+n+' days')}</p>{e.notes&&<p className="exam-notes">{e.notes.replace(/<[^>]*>/g,' ').slice(0,140)}</p>}</div>
   <div className="exam-actions">
    {!isPast&&<button type="button" className="primary" onClick={planReview}>Plan review</button>}
    <button type="button" onClick={()=>edit('exams',e as unknown as Entry)} aria-label={'Edit '+e.title}>Edit</button>
    <button type="button" onClick={()=>setDone(e,!e.done)} aria-label={(e.done?'Reopen ':'Mark done: ')+e.title}>{e.done?'Reopen':'Done'}</button>
   </div>
  </li>}
 return <section className="wb-panel exams-page" aria-label="Your exams">
  <div className="wb-section-head"><h2>Upcoming exams</h2><button type="button" className="primary" onClick={()=>create('exams')}>＋ Add exam</button></div>
  {upcoming.length?<ul className="exam-list">{upcoming.map(e=>row(e))}</ul>:<div className="exams-empty"><img className="kono-empty-art" src="/garden/kono/tea.webp" alt="" aria-hidden="true"/><p><strong>{mine.length?'Nothing coming up.':'No exams yet.'}</strong> Add a test with its date, and KONO counts down to it and can plan review sessions before it.</p><button type="button" className="primary" onClick={()=>create('exams')}>＋ Add exam</button></div>}
  {past.length>0&&<details className="exam-past" open={!upcoming.length}><summary>Done and past ({past.length})</summary><ul className="exam-list">{past.map(e=>row(e,true))}</ul></details>}
 </section>
}
