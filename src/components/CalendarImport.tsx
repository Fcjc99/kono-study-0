import {useState} from 'react'
import {dayNames,localDate,normalizeData,type AppData} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {classTime} from '../store/classSchedule'
import {applyIcsImport,parseIcs,type IcsImport} from '../store/icsImport'

const dateLabel=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})

/** Import from Google Calendar or Apple Calendar: a .ics file, or the calendar's subscription link. */
export default function CalendarImport({data,save}:{data:AppData;save:PlannerRepository['update']}){
 const profile=data.profiles.find(p=>p.id===data.activeProfileId)!
 const [parsed,setParsed]=useState<IcsImport|null>(null),[source,setSource]=useState(''),[link,setLink]=useState('')
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('')
 const [receipt,setReceipt]=useState<{before:AppData;after:AppData}|null>(null)
 const load=(text:string,name:string)=>{
  const result=parseIcs(text,localDate())
  if(!result.events.length&&!result.weekly.length)throw Error('Nothing from today onward was found in this calendar.')
  setParsed(result);setSource(result.calendarName||name);setReceipt(null)
  setStatus('Found '+result.weekly.length+' weekly repeat'+(result.weekly.length===1?'':'s')+' and '+result.events.length+' event'+(result.events.length===1?'':'s')+' in the next 12 months'+(result.skipped?' ('+result.skipped+' more left out)':'')+'. Untick anything you don’t want, then add them.')
 }
 const fromFile=async(file:File)=>{
  setError('');setStatus('');setParsed(null)
  if(file.size>5_000_000){setError('This calendar file is too large. Export a smaller date range.');return}
  try{load(await file.text(),file.name.replace(/\.ics$/i,''))}catch(e){setError(e instanceof Error?e.message:'Could not read this calendar file.')}
 }
 const fromLink=async()=>{
  if(!link.trim()||busy)return;setBusy(true);setError('');setStatus('Getting your calendar…');setParsed(null)
  try{
   const response=await fetch('/api/calendar-feed',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:link.trim()})})
   const text=await response.text()
   if(!response.ok){let message='Couldn’t get that calendar. Check the link and try again.';try{message=(JSON.parse(text) as {error?:string}).error||message}catch{/* not JSON: keep the general message */}throw Error(message)}
   load(text,/icloud/i.test(link)?'Apple Calendar':/google/i.test(link)?'Google Calendar':'Calendar')
  }catch(e){setStatus('');setError(e instanceof Error&&e.message!=='Failed to fetch'?e.message:'Couldn’t reach KONO’s server. Check your connection, or use a .ics file instead.')}finally{setBusy(false)}
 }
 const toggleAll=(include:boolean)=>parsed&&setParsed({...parsed,events:parsed.events.map(e=>({...e,include})),weekly:parsed.weekly.map(w=>({...w,include}))})
 const chosen=parsed?parsed.events.filter(e=>e.include).length+parsed.weekly.filter(w=>w.include).length:0
 const add=async()=>{
  if(!parsed||busy||!chosen)return;setBusy(true);setError('')
  let before:AppData|undefined,result:ReturnType<typeof applyIcsImport>|undefined
  try{
   const ok=await save(d=>{before=normalizeData(d);result=applyIcsImport(d,profile.id,parsed,source);return result.data})
   if(ok&&result&&before){setReceipt(result.added?{before,after:result.data}:null);setStatus(result.added+' added'+(result.skipped?', '+result.skipped+' already in your plan':'')+'. One-time events are in your Calendar; weekly repeats are under Settings › Schedules › Your weekly schedules.');setParsed(null)}
   else setError('Not saved yet. Your list is still here.')
  }catch(e){setError(e instanceof Error?e.message:'Could not add these events.')}finally{setBusy(false)}
 }
 const undo=async()=>{
  if(!receipt||busy)return;setBusy(true)
  try{const ok=await save(d=>{if(JSON.stringify(normalizeData(d))!==JSON.stringify(receipt.after))throw Error('Your plan changed since the import. Remove single items from the Calendar instead.');return receipt.before});if(ok){setReceipt(null);setStatus('The calendar import was undone.')}}catch(e){setError(e instanceof Error?e.message:'Could not undo.')}finally{setBusy(false)}
 }
 return <div className="calendar-import">
  <p>Bring in events from the calendar you already use. Weekly repeats (classes, practice, shifts) become a weekly schedule; everything else in the next 12 months becomes Calendar events. You choose what to add, and importing again only adds what’s new.</p>
  <fieldset disabled={busy} className="calendar-import-sources">
   <label>Calendar file (.ics)<input type="file" accept=".ics,text/calendar" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void fromFile(f)}}/></label>
   <div className="calendar-import-link"><label>Or paste a calendar link<input type="url" inputMode="url" placeholder="https://calendar.google.com/… or webcal://…icloud.com/…" value={link} onChange={e=>setLink(e.target.value)}/></label><button type="button" disabled={!link.trim()} onClick={()=>void fromLink()}>Get calendar</button></div>
   <p className="wb-muted">A calendar link is sent once to KONO’s server to fetch the calendar, and isn’t saved. Anyone with a private calendar link can see that calendar, so don’t share it elsewhere.</p>
  </fieldset>
  <details><summary>How to get it from Google Calendar</summary><ol><li>On a computer, open calendar.google.com › ⚙ Settings › <strong>Import &amp; export</strong> › <strong>Export</strong>. Unzip the download and choose the .ics file above.</li><li>Or, for a link (works from a phone): Settings › under “Settings for my calendars” pick the calendar › <strong>Integrate calendar</strong> › copy <strong>Secret address in iCal format</strong> and paste it above.</li></ol></details>
  <details><summary>How to get it from Apple Calendar</summary><ol><li>On a Mac: Calendar › select the calendar › <strong>File › Export › Export…</strong>, then choose the .ics file above.</li><li>From an iPhone or iPad: Calendar app › <strong>Calendars</strong> › ⓘ next to the calendar › turn on <strong>Public Calendar</strong> › <strong>Share Link</strong> › Copy, and paste it above. You can turn Public Calendar off again after importing.</li></ol></details>
  {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  {receipt&&<button type="button" disabled={busy} onClick={()=>void undo()}>Undo this import</button>}
  {parsed&&<div className="calendar-import-review">
   <div className="wb-toolbar"><button type="button" onClick={()=>toggleAll(true)}>Select all</button><button type="button" onClick={()=>toggleAll(false)}>Select none</button></div>
   {!!parsed.weekly.length&&<><h4>Weekly repeats → a weekly schedule “{(source||'Imported calendar')} · weekly”</h4><ul>{parsed.weekly.map(w=><li key={w.key}><label className="wb-check"><input type="checkbox" checked={w.include} onChange={e=>setParsed({...parsed,weekly:parsed.weekly.map(x=>x.key===w.key?{...x,include:e.target.checked}:x)})}/><span><strong>{w.title}</strong> · {w.days.map(d=>dayNames[d].slice(0,3)).join(', ')} · {classTime(w.start)}–{classTime(w.end)}{w.location?' · '+w.location:''}<br/><small className="wb-muted">{dateLabel(w.from)} – {dateLabel(w.until)}{w.skipped.length?' · '+w.skipped.length+' dates cancelled':''}</small></span></label></li>)}</ul></>}
   {!!parsed.events.length&&<><h4>Events → your Calendar</h4><ul>{parsed.events.map(e=><li key={e.key}><label className="wb-check"><input type="checkbox" checked={e.include} onChange={ev=>setParsed({...parsed,events:parsed.events.map(x=>x.key===e.key?{...x,include:ev.target.checked}:x)})}/><span><strong>{e.title}</strong> · {dateLabel(e.date)}{e.time?' · '+classTime(e.time)+(e.endTime?'–'+classTime(e.endTime):''):' · all day'}{e.location?' · '+e.location:''}</span></label></li>)}</ul></>}
   <button type="button" className="primary" disabled={busy||!chosen} onClick={()=>void add()}>{busy?'Adding…':'Add '+chosen+' to my plan'}</button>
  </div>}
 </div>
}
