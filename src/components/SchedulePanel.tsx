import {useState,type FormEvent,type ReactNode} from 'react'
import {TwelveHourTimeInput} from '../LegacyApp'
import {classTime} from '../store/classSchedule'
import {useDraftState} from '../hooks/useDraftState'
import {dayNames,localDate,uid,type AppData,type StudySeason,type ScheduleBlock} from '../store/model'
import type {PlannerRepository} from '../store/repository'

type EditingBlock={day:string;block:ScheduleBlock;isNew:boolean}
const short=(day:string)=>day.slice(0,3)

/** "Work · Mon, Tue · 8:00 AM–4:00 PM": one line per activity and time, however many days it repeats on. */
function summary(season:StudySeason){
 const lines=new Map<string,{label:string;start:string;end:string;days:string[]}>()
 for(const day of dayNames)for(const b of season.week[day]??[]){
  const key=b.label+'|'+b.start+'|'+b.end
  const line=lines.get(key)??{label:b.label,start:b.start,end:b.end,days:[]}
  line.days.push(day);lines.set(key,line)
 }
 return [...lines.values()].sort((a,b)=>dayNames.indexOf(a.days[0] as typeof dayNames[number])-dayNames.indexOf(b.days[0] as typeof dayNames[number])||a.start.localeCompare(b.start))
}

/** Every saved weekly schedule (work, activities, sports seasons, imported or shared schedules), each with
 * Edit, Pause and Delete. The one way to add a new one is the button in the header (`addLabel`). */
export default function SchedulePanel({data,save,draftKey,title,filter,addLabel,onAdd,children,empty}:{draftKey:string;data:AppData;save:PlannerRepository['update'];title:string;filter?:(s:StudySeason)=>boolean;addLabel?:string;onAdd?:()=>void;children?:ReactNode;empty?:string}){
 const seasons=data.studySeasons.filter(s=>s.profileId===data.activeProfileId&&!s.school&&(!filter||filter(s)))
 const [draft,setDraft]=useDraftState<StudySeason|null>(draftKey+':season',null),[base,setBase]=useDraftState<StudySeason|null>(draftKey+':base',null)
 const [editing,setEditing]=useState<EditingBlock|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [removal,setRemoval]=useState<StudySeason|null>(null)
 const begin=(s:StudySeason)=>{setDraft(structuredClone(s));setBase(seasons.find(x=>x.id===s.id)??null);setEditing(null);setError('')}
 const close=()=>{setDraft(null);setBase(null);setEditing(null);setError('')}
 const keepTime=()=>{
  if(!draft||!editing)return
  const {day,block}=editing
  if(!block.label.trim()){setError('Name this activity.');return}
  if(!block.start||!block.end||block.end<=block.start){setError('End time must be later than start time.');return}
  if((block.dateStart??draft.start)<draft.start||(block.dateEnd??draft.end)>draft.end||(block.dateEnd??draft.end)<(block.dateStart??draft.start)){setError('Its dates must fall inside the schedule’s dates.');return}
  const week=Object.fromEntries(dayNames.map(d=>[d,(draft.week[d]??[]).filter(b=>b.id!==block.id)]))
  week[day]=[...week[day],block].sort((a,b)=>a.start.localeCompare(b.start))
  setDraft({...draft,week});setEditing(null);setError('')
 }
 const store=async(e:FormEvent)=>{
  e.preventDefault();if(!draft||busy)return
  if(editing){keepTime();return}
  setBusy(true);setError('')
  try{
   if(!draft.name.trim())throw Error('Name this schedule.')
   if(draft.end<draft.start)throw Error('End date must be on or after the start date.')
   const next={...draft,name:draft.name.trim()}
   const saved=await save(d=>{if(d.activeProfileId!==next.profileId)throw Error('Your profile changed.');const current=d.studySeasons.find(s=>s.id===next.id);if(JSON.stringify(current??null)!==JSON.stringify(base))throw Error('This schedule changed elsewhere. Reopen it before saving.');return {...d,studySeasons:current?d.studySeasons.map(s=>s.id===next.id?next:s):[...d.studySeasons,next]}})
   if(saved)close();else setError('Not saved yet. Your changes are still here.')
  }catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}
 }
 const editor=(season:StudySeason)=>draft&&draft.id===season.id&&<form className="weekly-editor" onSubmit={store}><fieldset disabled={busy}>
  <div className="wb-form-grid"><label>Schedule name<input required maxLength={200} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Starts<input required type="date" value={draft.start} onInput={e=>setDraft({...draft,start:e.currentTarget.value})}/></label><label>Ends<input required type="date" value={draft.end} onInput={e=>setDraft({...draft,end:e.currentTarget.value})}/></label></div>
  <h4>Times</h4>
  {!dayNames.some(d=>draft.week[d]?.length)&&<p className="wb-muted">No times yet.</p>}
  <ul className="weekly-times">{dayNames.flatMap(day=>(draft.week[day]??[]).map(b=><li key={b.id}><span><strong>{short(day)}</strong> {classTime(b.start)}–{classTime(b.end)} · {b.label}{b.location?' · '+b.location:''}</span><span className="wb-toolbar"><button type="button" onClick={()=>{setEditing({day,block:{...b},isNew:false});setError('')}}>Edit</button><button type="button" onClick={()=>setDraft({...draft,week:{...draft.week,[day]:draft.week[day].filter(x=>x.id!==b.id)}})}>Remove</button></span></li>))}</ul>
  {editing?<div className="wb-record weekly-time-form"><h4>{editing.isNew?'Add a time':'Edit time'}</h4>
   <div className="wb-form-grid"><label>Day<select value={editing.day} onChange={e=>setEditing({...editing,day:e.target.value})}>{dayNames.map(d=><option key={d}>{d}</option>)}</select></label><label>Activity<input autoFocus maxLength={1000} value={editing.block.label} onChange={e=>setEditing({...editing,block:{...editing.block,label:e.target.value}})}/></label></div>
   <div className="wb-form-grid"><div><label>Start time</label><TwelveHourTimeInput label="Start time" value={editing.block.start} onChange={start=>setEditing({...editing,block:{...editing.block,start}})}/></div><div><label>End time</label><TwelveHourTimeInput label="End time" value={editing.block.end} onChange={end=>setEditing({...editing,block:{...editing.block,end}})}/></div></div>
   <details><summary>More: dates, subject, location</summary>
    <div className="wb-form-grid"><label>First date<input type="date" min={draft.start} max={draft.end} value={editing.block.dateStart??draft.start} onInput={e=>setEditing({...editing,block:{...editing.block,dateStart:e.currentTarget.value}})}/></label><label>Last date<input type="date" min={editing.block.dateStart??draft.start} max={draft.end} value={editing.block.dateEnd??draft.end} onInput={e=>setEditing({...editing,block:{...editing.block,dateEnd:e.currentTarget.value}})}/></label></div>
    <label>Subject<select value={editing.block.subjectId??''} onChange={e=>setEditing({...editing,block:{...editing.block,subjectId:e.target.value||undefined}})}><option value="">General / unassigned</option>{data.subjects.filter(s=>s.profileId===data.activeProfileId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {data.kids.some(k=>k.profileId===data.activeProfileId)&&<label>Kid<select value={editing.block.kidId??''} onChange={e=>setEditing({...editing,block:{...editing.block,kidId:e.target.value||undefined}})}><option value="">Whole family / unassigned</option>{data.kids.filter(k=>k.profileId===data.activeProfileId).map(k=><option key={k.id} value={k.id}>{(k.emoji?k.emoji+' ':'')+k.name}</option>)}</select></label>}
    <label>Room / location<input maxLength={200} value={editing.block.location??''} onChange={e=>setEditing({...editing,block:{...editing.block,location:e.target.value}})}/></label>
    <label>Kind<select value={editing.block.kind} onChange={e=>setEditing({...editing,block:{...editing.block,kind:e.target.value as ScheduleBlock['kind']}})}><option value="routine">Work / routine</option><option value="study">Class / study</option><option value="hobby">Activity / hobby</option><option value="break">Break</option></select></label>
   </details>
   <div className="wb-toolbar"><button type="button" className="primary" onClick={keepTime}>{editing.isNew?'Add this time':'Keep changes'}</button><button type="button" onClick={()=>{setEditing(null);setError('')}}>Cancel</button></div>
  </div>:<button type="button" onClick={()=>{const last=dayNames.flatMap(d=>draft.week[d]??[]).at(-1);setEditing({day:'Monday',isNew:true,block:{id:uid('block'),label:last?.label??draft.name.replace(/ · weekly$/,''),start:last?.start??'09:00',end:last?.end??'10:00',kind:last?.kind??'routine',subjectId:last?.subjectId,dateStart:draft.start,dateEnd:draft.end}});setError('')}}>＋ Add a time</button>}
  {error&&<p role="alert">{error}</p>}
  <div className="wb-toolbar"><button className="primary" disabled={!!editing}>Save schedule</button><button type="button" onClick={close}>Cancel</button></div>
 </fieldset></form>
 return <section className="wb-panel weekly-schedules" id="weekly-schedules"><div className="wb-section-head"><h2>{title}</h2>{onAdd&&addLabel&&<button type="button" className="primary" onClick={onAdd}>＋ {addLabel}</button>}</div>
 {children}
 {!seasons.length&&empty&&<p className="wb-muted">{empty}</p>}
 <div className="weekly-list">{seasons.map(season=>{const lines=summary(season),ended=season.end<localDate();return <article className="wb-record weekly-card" key={season.id} aria-label={season.name}>
  <div className="weekly-card-head"><h3>{season.name}</h3><span className={'weekly-status'+(season.active&&!ended?' is-on':'')}>{ended?'Ended':season.active?'Active':'Paused'}</span></div>
  <p className="wb-muted">{season.start} – {season.end}</p>
  {lines.length?<ul className="weekly-summary">{lines.slice(0,6).map(l=><li key={l.label+l.start+l.end}>{l.label} · {l.days.map(short).join(', ')} · {classTime(l.start)}–{classTime(l.end)}</li>)}{lines.length>6&&<li>…and {lines.length-6} more</li>}</ul>:<p className="wb-muted">No times yet.</p>}
  {draft?.id===season.id?editor(season):<div className="wb-toolbar"><button type="button" onClick={()=>begin(season)}>Edit</button><button type="button" onClick={()=>void save(d=>({...d,studySeasons:d.studySeasons.map(s=>s.profileId===data.activeProfileId&&s.id===season.id?{...s,active:!s.active}:s)}))}>{season.active?'Pause':'Turn on'}</button><button type="button" onClick={()=>setRemoval(season)}>Delete</button></div>}
  {removal?.id===season.id&&<div className="wb-record" role="group" aria-label="Confirm schedule removal"><p>Delete “{season.name}” and all its weekly times? Undo (top of the page) can bring it back.</p><div className="wb-toolbar"><button type="button" onClick={()=>{void save(d=>({...d,studySeasons:d.studySeasons.filter(s=>s.id!==season.id)}));setRemoval(null);if(draft?.id===season.id)close()}}>Delete schedule</button><button type="button" onClick={()=>setRemoval(null)}>Keep it</button></div></div>}
 </article>})}</div>
 </section>
}
