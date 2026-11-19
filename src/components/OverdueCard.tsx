import type {Task} from '../store/model'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})

/** Today and the Planner: assignments whose due date has passed and aren't done, each with one tap to finish it
 * or move it to today, or all at once. "Later" hides the card until tomorrow. `onFocus` (Today): the card is
 * Up next, the first one big with ▶ Focus (a full-screen timer), the rest listed under it. */
export default function OverdueCard({tasks,subjectName,onDone,onMove,onLater,onFocus}:{tasks:Task[];subjectName:(id:string)=>string;onDone:(id:string)=>void;onMove:(ids:string[])=>void;onLater:()=>void;onFocus?:(id:string,minutes?:number)=>void}){
 if(!tasks.length)return null
 const heading=(tasks.length===1?'1 assignment is':tasks.length+' assignments are')+' overdue'
 const meta=(t:Task)=>[subjectName(t.subjectId),'was due '+niceDate(t.due)].filter(Boolean).join(' · ')
 const row=(t:Task)=><li key={t.id}>
  <div><strong>{t.title||'Untitled'}</strong><small>{meta(t)}</small></div>
  <div className="wb-toolbar"><button type="button" className="primary" onClick={()=>onDone(t.id)} aria-label={'Done: '+t.title}>Done</button><button type="button" onClick={()=>onMove([t.id])} aria-label={'Move to today: '+t.title}>Move to today</button></div>
 </li>
 if(onFocus){
  const [first,...rest]=tasks,shown=rest.slice(0,4)
  return <section className="up-next is-late overdue-card" aria-label="Overdue">
   <h2 className="up-next-tag"><span aria-hidden="true">⚠</span> <span>{heading}</span></h2>
   <h3>{first.title||'Untitled'}</h3>
   <p>{meta(first)}</p>
   <div className="up-next-actions"><button type="button" className="up-next-focus" aria-label={'Focus on: '+first.title} onClick={()=>onFocus(first.id,first.estimatedMinutes)}>▶ Focus {first.estimatedMinutes||25} min</button><button type="button" className="up-next-done" onClick={()=>onDone(first.id)} aria-label={'Done: '+first.title}>✓ Done</button></div>
   <div className="up-next-links"><button type="button" onClick={()=>onMove([first.id])} aria-label={'Move to today: '+first.title}>Move to today</button>{tasks.length>1&&<button type="button" onClick={()=>onMove(tasks.map(t=>t.id))}>Move all to today</button>}<button type="button" onClick={onLater}>Later</button></div>
   {shown.length>0&&<ul className="up-next-more">{shown.map(row)}</ul>}
   {rest.length>shown.length&&<p className="up-next-note">+{rest.length-shown.length} more in the Planner.</p>}
  </section>
 }
 const shown=tasks.slice(0,5)
 return <section className="wb-panel overdue-card" aria-label="Overdue">
  <div className="wb-section-head"><div><small>CATCH UP</small><h2>{heading}</h2></div><div className="wb-toolbar">{tasks.length>1&&<button type="button" onClick={()=>onMove(tasks.map(t=>t.id))}>Move all to today</button>}<button type="button" className="link-button" onClick={onLater}>Later</button></div></div>
  <ul>{shown.map(row)}</ul>
  {tasks.length>shown.length&&<p className="wb-muted">+{tasks.length-shown.length} more in the Planner.</p>}
 </section>
}
