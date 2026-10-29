import type {Repeatable} from '../store/eventMemory'
import {classTime} from '../store/classSchedule'

/** Adding to a day: what was on this weekday before, one tap to fill the form with it ("Soccer 4–5 PM"). */
export default function RepeatSuggestions({list,date,onPick}:{list:Repeatable[];date:string;onPick:(r:Repeatable)=>void}){
 if(!list.length)return null
 const day=new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'})
 return <div className="repeat-suggestions" role="group" aria-label={'Same as a past '+day}>
  <small>Same as last {day}?</small>
  <div>{list.map(r=><button type="button" key={r.title} onClick={()=>onPick(r)}><strong>{r.title}</strong>{r.time&&<span>{classTime(r.time)}{r.endTime?'–'+classTime(r.endTime):''}</span>}</button>)}</div>
 </div>
}
