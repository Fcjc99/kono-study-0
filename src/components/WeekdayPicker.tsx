import {dayNames} from '../store/model'

/** A voice command can name one or two weekdays reliably, but a pattern like "Monday, Wednesday,
 * Friday" isn't something free speech reliably captures — this "Every day" shortcut gives a fast
 * manual alternative to tapping each box, without touching the individual-day checkboxes it sits
 * beside (still the way to build a M/W/F-style pattern). */
export default function WeekdayPicker({weekdays,onChange,label='Repeat on weekdays',short=false}:{weekdays:number[];onChange:(weekdays:number[])=>void;label?:string;short?:boolean}){
 const everyDay=weekdays.length===7
 return <div className="wb-toolbar wb-weekday-picker" role="group" aria-label={label}>
  <label className="wb-check wb-weekday-all"><input type="checkbox" checked={everyDay} onChange={e=>onChange(e.target.checked?[0,1,2,3,4,5,6]:[])}/>Every day</label>
  {dayNames.map((day,i)=><label className="wb-check" key={day}><input type="checkbox" checked={weekdays.includes(i)} onChange={e=>onChange(e.target.checked?[...weekdays,i]:weekdays.filter(d=>d!==i))}/>{short?day.slice(0,3):day}</label>)}
 </div>
}
