import {useState} from 'react'
import {useDraftState} from '../hooks/useDraftState'
import {localDate,type AppData} from '../store/model'
import {addWeeklyClass,weeklyClassDates,weeklyConflicts,type WeeklyClassInput} from '../store/weeklyClass'
import type {PlannerRepository} from '../store/repository'
import SchoolCalendarPanel from './SchoolCalendarPanel'
import SportsSetup from './SportsSetup'
import WeekdayPicker from './WeekdayPicker'
import SchedulePanel from './SchedulePanel'
type CatalogAccess={fetchCatalog:PlannerRepository['fetchSchoolCatalog'];submitCatalogEntry:PlannerRepository['submitSchoolCatalogEntry']}
export default function ScheduleSetup({data,save,draftKey,fetchCatalog,submitCatalogEntry}:{data:AppData;save:PlannerRepository['update'];draftKey:string}&CatalogAccess){
 const [flow,setFlow]=useDraftState(draftKey+':flow','manual')
 return <section className="schedule-setup"><div className="wb-panel"><h2>Set up my schedule</h2><div className="experience-choices" aria-label="Schedule setup options">{[['manual','Work & weekly activities','Name your schedule and set repeating days and hours.'],['college','College semester','Weekly classes with term dates, breaks and makeup schedules.'],['school','Rotating school','A/E or Day 1–6, with the school calendar.'],['sports','Sports','Recurring practices, plus a games/matches schedule you upload.']].map(([id,title,description])=><button key={id} aria-pressed={flow===id} onClick={()=>setFlow(id)} className="experience-choice"><strong>{title}</strong><span>{description}</span></button>)}</div></div>
 <div hidden={flow!=='manual'}><WeeklyHome data={data} save={save} draftKey={draftKey}/></div>
 <div hidden={flow!=='college'}><SchoolCalendarPanel data={data} save={save} draftKey={draftKey+':college'} flow="college" fetchCatalog={fetchCatalog} submitCatalogEntry={submitCatalogEntry}/></div>
 <div hidden={flow!=='school'}><SchoolCalendarPanel data={data} save={save} draftKey={draftKey+':school'} flow="school" fetchCatalog={fetchCatalog} submitCatalogEntry={submitCatalogEntry}/></div>
 <div hidden={flow!=='sports'}><SportsSetup data={data} save={save} draftKey={draftKey+':sports'}/><SchedulePanel data={data} save={save} draftKey={draftKey+':sports-list'} title="Your sports seasons" filter={s=>s.category==='sports'}/></div>
 </section>
}
export type {CatalogAccess}
/** Work & weekly activities: the saved schedules, and one button that opens the form to add another. */
function WeeklyHome({data,save,draftKey}:{data:AppData;save:PlannerRepository['update'];draftKey:string}){
 const hasAny=data.studySeasons.some(s=>s.profileId===data.activeProfileId&&!s.school)
 const [adding,setAdding]=useState(false),open=adding||!hasAny
 return <SchedulePanel data={data} save={save} draftKey={draftKey+':schedule'} title="Your weekly schedules" addLabel="Add a weekly activity" onAdd={open?undefined:()=>setAdding(true)}>
  {open&&<ManualWeekly data={data} save={save} draftKey={draftKey+':manual'} onClose={hasAny?()=>setAdding(false):undefined}/>}
 </SchedulePanel>
}
function ManualWeekly({data,save,draftKey,onClose}:{data:AppData;save:PlannerRepository['update'];draftKey:string;onClose?:()=>void}){
 const profile=data.profiles.find(p=>p.id===data.activeProfileId)!
 const initial:WeeklyClassInput={title:'',subjectId:'',kidId:'',activity:true,location:'',weekdays:[],start:'10:00',end:'11:00',first:localDate(),last:profile.end<localDate()?localDate():profile.end}
 const [input,setInput]=useDraftState(draftKey,initial),[allow,setAllow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const change=(patch:Partial<WeeklyClassInput>)=>{setInput({...input,...patch});setAllow(false);setMessage('')}
 let dates:string[]=[],conflicts:string[]=[]
 try{dates=weeklyClassDates(input);conflicts=weeklyConflicts(data,input)}catch{/* Validation is shown on submit, not before the student starts. */}
 const submit=async()=>{if(busy)return;setBusy(true);setMessage('');try{const ok=await save(d=>addWeeklyClass(d,data.activeProfileId,{...input,activity:!input.subjectId},allow));if(ok){setInput({...input,weekdays:[]});setAllow(false);setMessage('Added to Calendar, Planner and Today. It’s in your weekly schedules below. To add another day with different hours under the same name, choose it here and add again.')}else setMessage('Not saved yet. Your draft is still here.')}catch(e){setMessage(e instanceof Error?e.message:'Could not save schedule.')}finally{setBusy(false)}}
 return <form className="wb-record weekly-add" onSubmit={e=>{e.preventDefault();void submit()}}><fieldset disabled={busy}><h3>Add a weekly activity</h3><p>For example: name it Work, add Monday 8 AM–4 PM, then Tuesday 9 AM–3 PM. Select several days together when their hours match. Each date has its own notes and completion controls.</p><label>Link a subject (optional)<select value={input.subjectId} onChange={e=>{const subject=data.subjects.find(s=>s.id===e.target.value);change({subjectId:e.target.value,title:subject?.name??input.title})}}><option value="">No subject — work or personal activity</option>{data.subjects.filter(s=>s.profileId===data.activeProfileId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{data.kids.some(k=>k.profileId===data.activeProfileId)&&<label>Kid (optional)<select value={input.kidId??''} onChange={e=>change({kidId:e.target.value})}><option value="">Whole family / unassigned</option>{data.kids.filter(k=>k.profileId===data.activeProfileId).map(k=><option key={k.id} value={k.id}>{(k.emoji?k.emoji+' ':'')+k.name}</option>)}</select></label>}<label>Schedule name<input placeholder="Work, Gym, Volunteering…" required maxLength={200} value={input.title} onChange={e=>change({title:e.target.value})}/></label>
 <WeekdayPicker weekdays={input.weekdays} onChange={weekdays=>change({weekdays})} label="Repeat on weekdays"/>
 <div className="wb-form-grid"><label>Starts at<input required type="time" value={input.start} onInput={e=>change({start:e.currentTarget.value})}/></label><label>Ends at<input required type="time" value={input.end} onInput={e=>change({end:e.currentTarget.value})}/></label><label>From date<input required type="date" value={input.first} onInput={e=>change({first:e.currentTarget.value})}/></label><label>Through date<input required type="date" value={input.last} onInput={e=>change({last:e.currentTarget.value})}/></label></div><label>Room / location (optional)<input maxLength={200} value={input.location} onChange={e=>change({location:e.target.value})}/></label>
 {!!dates.length&&<p className="school-day-label">{dates.length} sessions · first {dates[0]} · last {dates.at(-1)}</p>}
 {!!conflicts.length&&<div role="alert"><p>{conflicts.length} overlapping sessions. First conflicts:</p><ul>{conflicts.slice(0,3).map((x,i)=><li key={i}>{x}</li>)}</ul><label className="wb-check"><input type="checkbox" checked={allow} onChange={e=>setAllow(e.target.checked)}/>I reviewed these overlaps; keep both entries.</label></div>}
 <div className="wb-toolbar"><button type="submit" className="primary" disabled={!!conflicts.length&&!allow}>{busy?'Saving…':'Add to my calendar'}</button>{onClose&&<button type="button" onClick={onClose}>Done</button>}</div><p className="wb-muted">This repeats on the selected weekdays without school holidays. Choose College semester or Rotating school when you want academic-calendar exceptions.</p>{message&&<p role="status">{message}</p>}</fieldset></form>
}
