import {useState} from 'react'
import {useDraftState} from '../hooks/useDraftState'
import {dayNames,localDate,type AppData} from '../store/model'
import {addWeeklyClass,weeklyClassDates,weeklyConflicts,type WeeklyClassInput} from '../store/weeklyClass'
import {addDays} from '../store/studyScheduler'
import type {PlannerRepository} from '../store/repository'
import WeekdayPicker from './WeekdayPicker'
import {WORK_SUFFIX} from '../store/workShifts'

/** Planner › ＋ Add to my calendar › My work schedule: shifts that repeat each week (Tue and Thu 4–8, …).
 * They go on the calendar like any weekly activity, and Plan my week plans study time around them
 * (store/weekPlan › busyTimes). Several entries cover shifts that differ by day. */
export {WORK_SUFFIX}
export default function WorkSetup({data,save,draftKey}:{data:AppData;save:PlannerRepository['update'];draftKey:string}){
 const today=localDate()
 const initial:WeeklyClassInput={title:'',subjectId:'',activity:true,location:'',weekdays:[],start:'16:00',end:'20:00',first:today,last:addDays(today,182),blockKind:'routine'}
 const [input,setInput]=useDraftState(draftKey,initial),[allow,setAllow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const change=(patch:Partial<WeeklyClassInput>)=>{setInput({...input,...patch});setAllow(false);setMessage('')}
 let dates:string[]=[],conflicts:string[]=[]
 try{dates=weeklyClassDates({...input,title:input.title||'Work'});conflicts=weeklyConflicts(data,input)}catch{/* Shown on save. */}
 const shifts=data.studySeasons.filter(s=>s.profileId===data.activeProfileId&&s.name.endsWith(WORK_SUFFIX))
 const submit=async()=>{
  if(busy)return;setBusy(true);setMessage('')
  try{
   const title=input.title.trim()||'Work'
   const ok=await save(d=>{const next=addWeeklyClass(d,data.activeProfileId,{...input,title,activity:true,blockKind:'routine'},allow);const season=next.studySeasons.at(-1);if(season)season.name=title+WORK_SUFFIX;return next})
   if(ok){setInput({...input,weekdays:[]});setAllow(false);setMessage('Added. Your shifts are on the calendar, and Plan my week works around them.')}
  }catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}
 }
 const remove=(id:string)=>void save(d=>({...d,studySeasons:d.studySeasons.filter(s=>s.id!==id)}))
 const daysOf=(s:AppData['studySeasons'][number])=>dayNames.filter(d=>(s.week[d]??[]).length).map(d=>d.slice(0,3)).join(', ')
 const hoursOf=(s:AppData['studySeasons'][number])=>{const b=dayNames.flatMap(d=>s.week[d]??[])[0];return b?b.start+'–'+b.end:''}
 return <section className="wb-panel school-setup work-setup" aria-label="My work schedule">
  <p>Add the shifts you work each week. They show on your calendar, and KONO plans study time around them.</p>
  {shifts.length>0&&<ul className="work-shift-list" aria-label="Your work shifts">{shifts.map(s=><li key={s.id}><strong>{s.name.slice(0,-WORK_SUFFIX.length)}</strong><span>{daysOf(s)} · {hoursOf(s)}</span><small>until {s.end}</small><button type="button" onClick={()=>remove(s.id)} aria-label={'Remove '+s.name.slice(0,-WORK_SUFFIX.length)}>Remove</button></li>)}</ul>}
  <form onSubmit={e=>{e.preventDefault();void submit()}}><fieldset disabled={busy}>
   <label>Job<input placeholder="Cafe, Babysitting, Grocery store…" maxLength={200} value={input.title} onChange={e=>change({title:e.target.value})}/></label>
   <WeekdayPicker weekdays={input.weekdays} onChange={weekdays=>change({weekdays})} label="Shift days"/>
   <div className="wb-form-grid"><label>Starts at<input required type="time" value={input.start} onInput={e=>change({start:e.currentTarget.value})}/></label><label>Ends at<input required type="time" value={input.end} onInput={e=>change({end:e.currentTarget.value})}/></label><label>From<input required type="date" value={input.first} onInput={e=>change({first:e.currentTarget.value})}/></label><label>Until<input required type="date" value={input.last} onInput={e=>change({last:e.currentTarget.value})}/></label></div>
   <label>Where (optional)<input maxLength={200} value={input.location} onChange={e=>change({location:e.target.value})}/></label>
   {!!dates.length&&input.weekdays.length>0&&<p className="school-day-label">{dates.length} shifts · first {dates[0]} · last {dates.at(-1)}</p>}
   {!!conflicts.length&&<div role="alert"><p>{conflicts.length} shifts overlap something else. First ones:</p><ul>{conflicts.slice(0,3).map((x,i)=><li key={i}>{x}</li>)}</ul><label className="wb-check"><input type="checkbox" checked={allow} onChange={e=>setAllow(e.target.checked)}/>Add them anyway</label></div>}
   <button type="submit" className="primary" disabled={!input.weekdays.length||!!conflicts.length&&!allow}>{busy?'Saving…':'Add my shifts'}</button>{message&&<p role="status">{message}</p>}
  </fieldset></form>
 </section>
}
