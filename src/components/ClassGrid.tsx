import {classTime} from '../store/classSchedule'

/** `column` groups classes by period or block (Period 1, Lunch…); without it they're grouped by start time. */
export type GridClass={day:string;label:string;start:string;end:string;column?:string;location?:string}

/** Classes as a days × blocks table, so a whole schedule can be checked against the paper one at a
 * glance. A class with no time yet goes in a "No time yet" column. */
export default function ClassGrid({cycle,classes,caption}:{cycle:string[];classes:GridClass[];caption:string}){
 if(!classes.length)return <p className="wb-muted">No classes yet.</p>
 const key=(c:GridClass)=>c.column||c.start
 const first=(k:string)=>classes.filter(c=>key(c)===k).map(c=>c.start).sort()[0]??''
 const columns=[...new Set(classes.map(key))].sort((a,b)=>first(a).localeCompare(first(b))||a.localeCompare(b))
 const days=cycle.filter(d=>!['Saturday','Sunday'].includes(d)||classes.some(c=>c.day===d))
 const unplaced=classes.filter(c=>!cycle.includes(c.day))
 const heading=(k:string)=>{
  const inColumn=classes.filter(c=>key(c)===k),starts=[...new Set(inColumn.map(c=>c.start))]
  if(!inColumn[0].column)return k?classTime(k):'No time yet'
  return <>{k}{starts.length===1&&starts[0]&&<small>{classTime(starts[0])}</small>}</>
 }
 return <div className="rotation-grid-wrap"><table className="rotation-grid class-grid"><caption>{caption}</caption>
  <thead><tr><th scope="col">Day</th>{columns.map(k=><th scope="col" key={k||'none'}>{heading(k)}</th>)}</tr></thead>
  <tbody>{days.map(day=><tr key={day}><th scope="row">{day}</th>{columns.map(k=><td key={k||'none'}>{classes.filter(c=>c.day===day&&key(c)===k).map((c,i)=><span key={i}>{(c.column&&c.label.startsWith(c.column+' · ')?c.label.slice(c.column.length+3):c.label)||'Unnamed class'}{!c.column&&c.end&&<small>until {classTime(c.end)}</small>}{c.location&&<small>{c.location}</small>}</span>)}</td>)}</tr>)}</tbody>
 </table>{unplaced.length>0&&<p role="alert">{unplaced.length===1?'1 class has':unplaced.length+' classes have'} no day yet: {unplaced.map(c=>c.label||'Unnamed class').join(', ')}. Pick {unplaced.length===1?'its':'their'} day below.</p>}</div>
}
