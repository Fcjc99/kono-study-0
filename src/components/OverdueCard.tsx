import type {Task} from '../store/model'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})

/** Sanctuary and Planner: assignments whose due date has passed and aren't done, each with one tap to
 * finish it or move it to today, or all at once. "Later" hides the card until tomorrow. */
export default function OverdueCard({tasks,subjectName,onDone,onMove,onLater}:{tasks:Task[];subjectName:(id:string)=>string;onDone:(id:string)=>void;onMove:(ids:string[])=>void;onLater:()=>void}){
 if(!tasks.length)return null
 const shown=tasks.slice(0,5)
 return <section className="wb-panel overdue-card" aria-label="Overdue">
  <div className="wb-section-head"><div><small>CATCH UP</small><h2>{tasks.length===1?'1 assignment is':tasks.length+' assignments are'} overdue</h2></div><div className="wb-toolbar">{tasks.length>1&&<button type="button" onClick={()=>onMove(tasks.map(t=>t.id))}>Move all to today</button>}<button type="button" className="link-button" onClick={onLater}>Later</button></div></div>
  <ul>{shown.map(t=><li key={t.id}>
   <div><strong>{t.title||'Untitled'}</strong><small>{[subjectName(t.subjectId),'was due '+niceDate(t.due)].filter(Boolean).join(' · ')}</small></div>
   <div className="wb-toolbar"><button type="button" className="primary" onClick={()=>onDone(t.id)} aria-label={'Done: '+t.title}>Done</button><button type="button" onClick={()=>onMove([t.id])} aria-label={'Move to today: '+t.title}>Move to today</button></div>
  </li>)}</ul>
  {tasks.length>shown.length&&<p className="wb-muted">+{tasks.length-shown.length} more in the Planner.</p>}
 </section>
}
