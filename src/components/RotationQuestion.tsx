import {useState} from 'react'
import {localDate,type StudySeason} from '../store/model'
import {nextSchoolDate,rotationPreview,schoolDay} from '../store/schoolCalendar'

const nice=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})
const short=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})

/** A rotating school needs one known day to count from ("Monday, September 28 is Day 4"). Asked up front
 * until it's answered, then shown with the next few school days so a wrong answer is easy to spot. */
export default function RotationQuestion({season,onAnswer}:{season:StudySeason;onAnswer:(anchorDate:string,anchorDay:string)=>void}){
 const school=season.school!,answered=school.cycle.includes(school.anchorDay)
 const suggested=nextSchoolDate(season,localDate())??season.start
 const [editing,setEditing]=useState(false),[date,setDate]=useState(answered?school.anchorDate:suggested),[day,setDay]=useState(answered?school.anchorDay:'')
 const example=school.cycle.includes('Day 4')?'Day 4':school.cycle[Math.min(3,school.cycle.length-1)]
 if(answered&&!editing){
  const known=schoolDay(season,school.anchorDate),preview=rotationPreview(season,localDate()>school.anchorDate?localDate():school.anchorDate,6)
  return <section className="rotation-question is-answered" aria-label="Rotation day">
   <p><strong>✓ {nice(school.anchorDate)} is {school.anchorDay}.</strong> <button type="button" className="link-button" onClick={()=>{setDate(school.anchorDate);setDay(school.anchorDay);setEditing(true)}}>Change</button></p>
   {known?.closed?<p role="alert">KONO has {nice(school.anchorDate)} as a day with no school ({known.label}). Pick a day that has classes.</p>:
    preview.length>0&&<p className="wb-muted">Coming up: {preview.map(p=>short(p.date)+' · '+p.cycleDay).join(', ')}. If these don’t match your school, change the day above.</p>}
  </section>
 }
 const save=()=>{if(date&&day){onAnswer(date,day);setEditing(false)}}
 const closed=date?schoolDay(season,date)?.closed:false
 return <section className="rotation-question" aria-label="Rotation day">
  <h3>Which rotation day is it?</h3>
  <p>Pick a school day you know and its day number, so KONO can count the rest of the year from it. For example: {nice(suggested)} is {example}.</p>
  <div className="rotation-question-fields">
   <label>School day<input type="date" min={season.start} max={school.lastClassDate||season.end} value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>is<select value={day} onChange={e=>setDay(e.target.value)}><option value="">Choose the day</option>{school.cycle.map(d=><option key={d}>{d}</option>)}</select></label>
   <button type="button" className="primary" disabled={!date||!day||closed} onClick={save}>Set rotation</button>
   {answered&&<button type="button" onClick={()=>setEditing(false)}>Cancel</button>}
  </div>
  {closed&&<p role="alert">{nice(date)} has no school on this calendar. Pick a day with classes.</p>}
  <p className="wb-muted">Not sure? Your school’s calendar, homepage or a teacher can tell you what day it is.</p>
 </section>
}
