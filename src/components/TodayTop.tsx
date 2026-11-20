import type {Exam,Task} from '../store/model'
import type {KonoMood} from '../store/konoMood'
import {addDays} from '../store/studyScheduler'
import './today.css'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
const dueLabel=(due:string,today:string)=>due===today?'due today':due===addDays(today,1)?'due tomorrow':'due '+niceDate(due)

/** The top of Today: KONO in one line (how it's doing, your coins; tapping it opens KONO's page), then the one
 * thing to do next, with Focus (a full-screen timer) and Done. When work is late, the Overdue card is Up next
 * (passed in as `overdue`), so lateness is said once. */
export default function TodayTop({name,hour,mood,lateCount,coins,coinLabel,showKono,onKono,onTown,overdue,next,subjectName,today,onFocus,onStudy,onDone}:{
 name:string;hour:number;mood:KonoMood;lateCount:number;coins:number;coinLabel:string;showKono:boolean;onKono:()=>void;onTown:()=>void
 overdue:React.ReactNode;next:{task?:Task;exam?:Exam}|null;subjectName:(id:string)=>string;today:string
 onFocus:(taskId:string,minutes?:number)=>void;onStudy:(label:string)=>void;onDone:(id:string)=>void
}){
 const hello=hour<5?'Hi':hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'
 const line=lateCount?(lateCount===1?'One thing is late. Clear it and KONO can relax.':lateCount+' things are late. One at a time, KONO’s with you.'):mood.line
 const t=next?.task,e=next?.exam
 return <div className="today-top">
  {showKono&&<section className="today-kono" aria-label="KONO">
   <button type="button" className="today-kono-face" aria-label="Visit KONO’s island" onClick={onKono}><img src={mood.pose} alt="" width={44} height={44}/></button>
   <p><b>{hello}{name?', '+name:''}.</b> {line}</p>
   <button type="button" className="today-coins" aria-label={coinLabel} onClick={onTown}><span aria-hidden="true">🪙</span> {Math.max(0,coins).toLocaleString()}</button>
  </section>}
  {overdue??(t?<section className="up-next" aria-label="Up next">
   <h2 className="up-next-tag">Up next{t.subjectId&&subjectName(t.subjectId)?' · '+subjectName(t.subjectId):''} · {dueLabel(t.due,today)}{t.plannedTime?' · '+t.plannedTime:''}</h2>
   <h3>{t.title||'Untitled'}</h3>
   {t.notes&&<p>{t.notes.replace(/<[^>]*>/g,'').slice(0,140)}</p>}
   <div className="up-next-actions"><button type="button" className="up-next-focus" aria-label={'Focus on: '+t.title} onClick={()=>onFocus(t.id,t.estimatedMinutes)}>▶ Focus {t.estimatedMinutes?t.estimatedMinutes:25} min</button><button type="button" className="up-next-done" aria-label={'Done: '+t.title} onClick={()=>onDone(t.id)}>✓ Done</button></div>
  </section>:e?<section className="up-next" aria-label="Up next">
   <h2 className="up-next-tag">Coming up · {e.subjectId&&subjectName(e.subjectId)?subjectName(e.subjectId)+' · ':''}{dueLabel(e.due,today)}</h2>
   <h3>Study for {e.title||'your test'}</h3>
   <div className="up-next-actions"><button type="button" className="up-next-focus" onClick={()=>onStudy('Study for '+(e.title||'your test'))}>▶ Study 25 min</button></div>
  </section>:<section className="up-next is-clear" aria-label="Up next"><h2 className="up-next-tag">Up next</h2><h3>All caught up</h3><p>Nothing due this week. Add something with ＋, or enjoy the break.</p><div className="up-next-actions"><button type="button" className="up-next-focus" onClick={()=>onStudy('Study time')}>▶ Focus anyway</button></div></section>)}
 </div>
}

/** Today's "Then": the next few things after Up next (store/upNext thenList), each with a tick to finish it and
 * ▶ to focus on it, or Study for a test. Beside Up next on a wide screen, under it on a phone. */
export function TodayThen({items,today,subjectName,onFocus,onStudy,onDone}:{
 items:{task?:Task;exam?:Exam}[];today:string;subjectName:(id:string)=>string
 onFocus:(taskId:string,minutes?:number)=>void;onStudy:(label:string)=>void;onDone:(id:string)=>void
}){
 if(!items.length)return null
 return <section className="wb-panel today-then" aria-label="Then">
   <h2>Then</h2>
   <ul>{items.map(i=>i.task?<li key={i.task.id}>
    <button type="button" className="today-then-tick" aria-label={'Done: '+i.task.title} onClick={()=>onDone(i.task!.id)}/>
    <div><b>{i.task.title||'Untitled'}</b><small>{dueLabel(i.task.due,today)}{i.task.subjectId&&subjectName(i.task.subjectId)?' · '+subjectName(i.task.subjectId):''}{i.task.plannedTime?' · '+i.task.plannedTime:''}</small></div>
    <button type="button" className="today-then-go" aria-label={'Focus on: '+i.task.title} onClick={()=>onFocus(i.task!.id,i.task!.estimatedMinutes)}>▶</button>
   </li>:<li key={i.exam!.id}>
    <span className="today-then-icon" aria-hidden="true">📝</span>
    <div><b>{i.exam!.title||'Test'}</b><small>{dueLabel(i.exam!.due,today)}{i.exam!.subjectId&&subjectName(i.exam!.subjectId)?' · '+subjectName(i.exam!.subjectId):''}</small></div>
    <button type="button" className="today-then-study" onClick={()=>onStudy('Study for '+(i.exam!.title||'your test'))}>Study 25m</button>
   </li>)}</ul>
  </section>
}
