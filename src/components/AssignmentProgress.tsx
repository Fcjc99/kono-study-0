import type {Task} from '../store/model'

// A quick "how much of tonight's/today's work is done" readout — assignments only (exams already get
// their own countdown/reminders, and appointments aren't something you "complete"). A ring fills as work
// is checked off; Today also shows the streak and the week. Always renders (with a "nothing due" caption
// at zero) so the feature reads as present, not silently missing.
export default function AssignmentProgress({tasks,date,label,streak,week}:{tasks:Task[];date:string;label:string;streak?:number;week?:{done:number;total:number}}){
 const due=tasks.filter(t=>t.due===date)
 const completed=due.filter(t=>t.done).length
 const all=due.length>0&&completed===due.length
 return <div className={'assignment-progress'+(all?' is-all-done':'')} role="group" aria-label={label+' assignment progress'}>
  {due.length>0&&<svg className="assignment-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" pathLength={100}/>{completed>0&&<circle className="is-done" cx="18" cy="18" r="15" pathLength={100} strokeDasharray={completed/due.length*100+' 100'}/>}{all&&<text x="18" y="22.5" textAnchor="middle">✓</text>}</svg>}
  <small>{due.length>0?completed+'/'+due.length+' assignment'+(due.length===1?'':'s')+' completed':'No assignments due'}</small>
  {(!!streak||!!week?.total)&&<span className="assignment-progress-extra">{!!streak&&<span title="Days in a row you finished something">🔥 {streak}-day streak</span>}{!!week?.total&&<span title="Assignments due this week">{week.done}/{week.total} this week</span>}</span>}
 </div>
}
