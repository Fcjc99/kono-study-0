import type {Task} from '../store/model'

// A quick "how much of tonight's/today's work is done" readout — assignments only (exams already get
// their own countdown/reminders, and appointments aren't something you "complete"). Always renders
// (with a "nothing due" caption at zero) so the feature reads as present, not silently missing.
export default function AssignmentProgress({tasks,date,label}:{tasks:Task[];date:string;label:string}){
 const due=tasks.filter(t=>t.due===date)
 const completed=due.filter(t=>t.done).length
 return <div className="assignment-progress" role="group" aria-label={label+' assignment progress'}>
  {due.length>0&&<div className="assignment-progress-bar">{due.map(t=><span key={t.id} className={t.done?'is-filled':''}/>)}</div>}
  <small>{due.length>0?completed+'/'+due.length+' assignment'+(due.length===1?'':'s')+' completed':'No assignments due'}</small>
 </div>
}
