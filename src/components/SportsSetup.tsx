import {useEffect,useRef,useState} from 'react'
import {useDraftState} from '../hooks/useDraftState'
import {dayNames,localDate,uid,type AppData} from '../store/model'
import {addWeeklyClass,weeklyClassDates,weeklyConflicts,type WeeklyClassInput} from '../store/weeklyClass'
import {applyScheduleImport,suggestSchedule,type ImportRow} from '../store/scheduleImport'
import {addDays} from '../store/studyScheduler'
import type {PlannerRepository} from '../store/repository'
import './sports-setup.css'

/** suggestSchedule() keeps a trailing HOME/AWAY word in the title (see cleanTitle) rather than
 * discarding it — this pulls it back out to render as its own unmissable badge instead of a word
 * a student could skim past inside a long opponent name. */
const homeAwayOf=(title:string):'HOME'|'AWAY'|null=>{
 const match=title.match(/\b(HOME|AWAY)$/)
 return match?match[1] as 'HOME'|'AWAY':null
}

export default function SportsSetup({data,save,draftKey}:{data:AppData;save:PlannerRepository['update'];draftKey:string}){
 const [tab,setTab]=useDraftState(draftKey+':tab','practice')
 const [sport,setSport]=useDraftState(draftKey+':sport','')
 return <section className="wb-panel school-setup"><div className="wb-section-head"><div><small>YOUR SPORTS SCHEDULE</small><h2>Sports</h2></div></div>
 <p>Add recurring practices, then add or upload your games/matches schedule. Sports items show in Calendar and Planner, and can be viewed on their own or together with academics.</p>
 <label>What sport?<input placeholder="Soccer, Track, Swim…" maxLength={200} value={sport} onChange={e=>setSport(e.target.value)}/></label>
 <div className="wb-toolbar" role="group" aria-label="Sports setup sections">{[['practice','Practices'],['games','Games & matches']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
 <div hidden={tab!=='practice'}><SportsPractice data={data} save={save} draftKey={draftKey+':practice'} sport={sport}/></div>
 <div hidden={tab!=='games'}><SportsGames data={data} save={save} draftKey={draftKey+':games'} sport={sport}/></div>
 </section>
}

function SportsPractice({data,save,draftKey,sport}:{data:AppData;save:PlannerRepository['update'];draftKey:string;sport:string}){
 const profile=data.profiles.find(p=>p.id===data.activeProfileId)!
 const initial:WeeklyClassInput={title:sport.trim()||'Practice',subjectId:'',activity:true,location:'',weekdays:[],start:'15:30',end:'17:00',first:localDate(),last:profile.end<localDate()?localDate():profile.end,blockKind:'hobby',category:'sports'}
 const [input,setInput]=useDraftState(draftKey,initial),[allow,setAllow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const change=(patch:Partial<WeeklyClassInput>)=>{setInput({...input,...patch});setAllow(false);setMessage('')}
 let dates:string[]=[],conflicts:string[]=[]
 try{dates=weeklyClassDates(input);conflicts=weeklyConflicts(data,input)}catch{/* Validation is shown on submit, not before the student starts. */}
 const submit=async()=>{if(busy)return;setBusy(true);setMessage('');try{const ok=await save(d=>addWeeklyClass(d,data.activeProfileId,{...input,blockKind:'hobby',category:'sports'},allow));if(ok){setInput({...input,weekdays:[]});setAllow(false);setMessage('Added to Calendar, Planner and Today. Add another day and time for a different practice schedule.')}else setMessage('Not saved yet. Your draft is still here.')}catch(e){setMessage(e instanceof Error?e.message:'Could not save practice schedule.')}finally{setBusy(false)}}
 return <form className="wb-panel school-setup" onSubmit={e=>{e.preventDefault();void submit()}}><fieldset disabled={busy}><h3>Recurring practices</h3><p>Name your team or sport, then set the days and times practice repeats. Add several entries if practice times change during the season.</p>
 <label>Team / practice name<input placeholder="Soccer practice" required maxLength={200} value={input.title} onChange={e=>change({title:e.target.value})}/></label>
 <div className="wb-toolbar" role="group" aria-label="Repeat on weekdays">{dayNames.map((day,i)=><label className="wb-check" key={day}><input type="checkbox" checked={input.weekdays.includes(i)} onChange={e=>change({weekdays:e.target.checked?[...input.weekdays,i]:input.weekdays.filter(d=>d!==i)})}/>{day}</label>)}</div>
 <div className="wb-form-grid"><label>Starts at<input required type="time" value={input.start} onInput={e=>change({start:e.currentTarget.value})}/></label><label>Ends at<input required type="time" value={input.end} onInput={e=>change({end:e.currentTarget.value})}/></label><label>From date<input required type="date" value={input.first} onInput={e=>change({first:e.currentTarget.value})}/></label><label>Through date<input required type="date" value={input.last} onInput={e=>change({last:e.currentTarget.value})}/></label></div><label>Field / rink / location (optional)<input maxLength={200} value={input.location} onChange={e=>change({location:e.target.value})}/></label>
 {!!dates.length&&<p className="school-day-label">{dates.length} practices · first {dates[0]} · last {dates.at(-1)}</p>}
 {!!conflicts.length&&<div role="alert"><p>{conflicts.length} overlapping sessions. First conflicts:</p><ul>{conflicts.slice(0,3).map((x,i)=><li key={i}>{x}</li>)}</ul><label className="wb-check"><input type="checkbox" checked={allow} onChange={e=>setAllow(e.target.checked)}/>I reviewed these overlaps; keep both entries.</label></div>}
 <button type="submit" className="primary" disabled={!!conflicts.length&&!allow}>{busy?'Saving…':'Add to my calendar'}</button>{message&&<p role="status">{message}</p>}</fieldset></form>
}

function SportsGames({data,save,draftKey,sport}:{data:AppData;save:PlannerRepository['update'];draftKey:string;sport:string}){
 const profile=data.profiles.find(p=>p.id===data.activeProfileId)!
 const [file,setFile]=useState<File|null>(null),[text,setText]=useDraftState(draftKey+':text',''),[rows,setRows]=useDraftState<ImportRow[]>(draftKey+':rows',[])
 // A season upload usually happens partway through the season, so games already played (a date
 // before today) still need a valid year to resolve to — defaulting "Season starts" to the profile's
 // own start date (== today, for most profiles) silently excluded every past date from the year-
 // inference range in dateFrom(), misclassifying them as recurring weekly classes. Six months of
 // headroom on each side comfortably covers a real season's full date range either way.
 const [start,setStart]=useState(addDays(profile.start,-180)),[end,setEnd]=useState(profile.end),[order,setOrder]=useState<'mdy'|'dmy'>('mdy')
 const [busy,setBusy]=useState(false),[reading,setReading]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false)
 const active=useRef<AbortController|null>(null),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.abort()}},[])
 const update=(id:string,patch:Partial<ImportRow>)=>{setReviewed(false);setRows(rows.map(r=>r.id===id?{...r,...patch}:r))}
 const read=async()=>{
  if(!file||busy)return;setBusy(true);setReading(true);setError('');setStatus('Reading your schedule…');const controller=new AbortController();active.current=controller
  const timeout=window.setTimeout(()=>controller.abort(),180000)
  try{
   const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')
   const reader=await import('../store/readSchedulePdf')
   const result=isPdf?await reader.readSchedulePdf(file,1,5,controller.signal,m=>{if(mounted.current)setStatus(m)}):await reader.readSchedulePhoto(file,controller.signal,m=>{if(mounted.current)setStatus(m)})
   if(!mounted.current)return;setText(result);setRows([]);setReviewed(false);setStatus('Text is ready. Check it below, then find games.')
  }catch(e){if(mounted.current){setStatus('');setError(controller.signal.aborted?'Reading stopped. Try a clearer photo or fewer PDF pages.':e instanceof Error?e.message:'Could not read this file. Try a clearer scan or photo.')}}finally{clearTimeout(timeout);if(mounted.current){setBusy(false);setReading(false)}active.current=null}
 }
 const suggestions=()=>{setRows(suggestSchedule(text,start,end,order));setReviewed(false);setStatus('Review every suggestion — check the type on each row. Unrecognized lines stay in the source text; add missing games manually.')}
 const commit=async()=>{
  if(busy||!reviewed)return;setBusy(true);setError('')
  try{const seasonName=(sport.trim()||'Sports')+' season';const saved=await save(current=>applyScheduleImport(current,profile.id,rows,start,end,{eventKind:'sports',category:'sports',blockKind:'hobby',seasonName}).data);if(saved){setStatus('Games added. Find them in your Calendar and Planner, tagged as sports.');setRows([]);setReviewed(false);setText('');setFile(null)}else setError('Not saved yet. Your reviewed items remain here; check the save status before retrying.')}catch(e){setError(e instanceof Error?e.message:'Could not import.')}finally{setBusy(false)}
 }
 return <div className="wb-panel school-setup"><h3>Games & matches</h3><p>Upload a photo or PDF of your games/matches schedule, or paste the text below. Review every suggestion before it's added — nothing is saved automatically.</p>
 <fieldset disabled={busy}><label>Choose a photo or PDF (up to 20 MB)<input type="file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp" onChange={e=>{setFile(e.target.files?.[0]??null);setError('');e.target.value=''}}/></label>{file&&<p>{file.name}</p>}<button disabled={!file} onClick={()=>void read()}>Read selected file</button></fieldset>
 {reading&&<button onClick={()=>active.current?.abort()}>Cancel reading</button>}
 <fieldset disabled={busy}><div className="import-fields"><label>Season starts<input type="date" value={start} onInput={e=>{setStart(e.currentTarget.value);setReviewed(false)}}/></label><label>Season ends<input type="date" value={end} onInput={e=>{setEnd(e.currentTarget.value);setReviewed(false)}}/></label><label>Dates in this document<select value={order} onChange={e=>{setOrder(e.target.value as typeof order);setReviewed(false)}}><option value="mdy">Month / day / year</option><option value="dmy">Day / month / year</option></select></label></div>
 <label>Recognized text (editable)<textarea rows={8} maxLength={100000} value={text} onChange={e=>{setText(e.target.value);setReviewed(false)}} placeholder="Read a file or paste your games schedule here. Example: vs. Hanover — Tue 10/14 4:00pm"/></label><button disabled={!text.trim()} onClick={suggestions}>Find games</button><button onClick={()=>{setReviewed(false);setRows([...rows,{id:uid('import-row'),include:false,kind:'event',title:'',subject:'',date:'',weekdays:[],start:'',end:'',source:'Added manually'}])}} disabled={rows.length>=100}>＋ Add missing game</button>
 {rows.length>0&&<><h4>Review games</h4><p>Check each game against the original — and check the Type on each row. Only "Game / match" is tagged as sports; an exam or assignment caught up in the same paste stays an exam or assignment, not a sports item. Only selected items will be added.</p>{rows.map((row,i)=><fieldset className="import-row" key={row.id}><legend>Item {i+1}</legend><label className="import-select"><input type="checkbox" checked={row.include} onChange={e=>update(row.id,{include:e.target.checked})}/> Add this item</label><details><summary>Source text</summary><p>{row.source}</p></details><div className="import-fields"><label>Type<select value={row.kind} onChange={e=>update(row.id,{kind:e.target.value as ImportRow['kind']})}><option value="event">Game / match</option><option value="exam">Exam / test (not sports)</option><option value="task">Assignment (not sports)</option><option value="class">Recurring — repeats on weekdays</option><option value="subject">Subject only</option></select></label><label>Title<input maxLength={200} value={row.title} onChange={e=>update(row.id,{title:e.target.value})}/></label>{homeAwayOf(row.title)&&<span className={'home-away-badge is-'+homeAwayOf(row.title)!.toLowerCase()}>{homeAwayOf(row.title)}</span>}{row.kind!=='class'&&row.kind!=='subject'&&<label>Date<input type="date" value={row.date} onInput={e=>update(row.id,{date:e.currentTarget.value})}/></label>}</div>{row.kind==='class'?<><div className="import-weekdays">{dayNames.map((day,d)=><label key={day}><input type="checkbox" checked={row.weekdays.includes(d)} onChange={e=>update(row.id,{weekdays:e.target.checked?[...row.weekdays,d]:row.weekdays.filter(n=>n!==d)})}/>{day}</label>)}</div><div className="import-fields"><label>Start time<input type="time" value={row.start} onInput={e=>update(row.id,{start:e.currentTarget.value})}/></label><label>End time<input type="time" value={row.end} onInput={e=>update(row.id,{end:e.currentTarget.value})}/></label></div></>:row.kind!=='subject'&&<div className="import-fields"><label>Start time<input type="time" value={row.start} onInput={e=>update(row.id,{start:e.currentTarget.value})}/></label></div>}<button onClick={()=>{setRows(rows.filter(r=>r.id!==row.id));setReviewed(false)}}>Remove suggestion</button></fieldset>)}
 <label className="import-select"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> I checked the selected dates and times against my schedule.</label><button className="primary" disabled={!reviewed||!rows.some(r=>r.include)} onClick={()=>void commit()}>Add {rows.filter(r=>r.include).length} selected games to my Planner</button></>}
 </fieldset>
 {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
 </div>
}
