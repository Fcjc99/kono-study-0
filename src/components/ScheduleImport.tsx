import {useEffect,useRef,useState} from 'react'
import {dayNames,localDate,normalizeData,uid,type AppData} from '../store/model'
import {addDays} from '../store/studyScheduler'
import type {PlannerRepository} from '../store/repository'
import {applyScheduleImport,suggestSchedule,validDate,type ImportRow} from '../store/scheduleImport'
import {readPlannerPhoto,plannerPhotoToImportRows} from '../store/scheduleCalendarPhoto'
import {addImportedClassesToSeason} from '../store/schoolImport'
import {reportError} from '../store/errorReporter'
import './schedule-import.css'
import './upload-drop.css'
import {AiHelperStatus} from './AiHelper'
import {useAiHelper} from '../hooks/useAiHelper'
import { aiReady, needsAiMessage } from '../store/aiProvider'

// Monday of the current week, as a sane default for "which week is this photo of" -- dateNumber-style
// UTC-noon anchoring avoids the off-by-one a plain `new Date(dateString)` risks near midnight.
const mondayOfThisWeek=()=>{const today=localDate(),jsDay=new Date(today+'T12:00:00Z').getUTCDay();return addDays(today,jsDay===0?-6:1-jsDay)}

export default function ScheduleImport({data,save}:{data:AppData;save:PlannerRepository['update']}){
 const profile=data.profiles.find(p=>p.id===data.activeProfileId)!
 const [scanAll,setScanAll]=useState(true),[more,setMore]=useState(false),[editing,setEditing]=useState<string[]>([]),[file,setFile]=useState<File|null>(null),[text,setText]=useState(''),[rows,setRows]=useState<ImportRow[]>([])
 const [start,setStart]=useState(profile.start),[end,setEnd]=useState(profile.end),[order,setOrder]=useState<'mdy'|'dmy'>('mdy')
 const [first,setFirst]=useState(1),[last,setLast]=useState(1),[busy,setBusy]=useState(false),[reading,setReading]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false)
 const [receipt,setReceipt]=useState<{before:AppData;after:AppData}|null>(null)
 const semesters=data.studySeasons.filter(s=>s.profileId===profile.id&&s.school?.pattern==='weekly')
 const [target,setTarget]=useState(()=>(semesters.find(s=>s.active)??semesters[0])?.id??'')
 const intoSemester=semesters.find(s=>s.id===target)
 const {provider:photoProvider,apiKey:photoApiKey}=useAiHelper(profile.id)
 const [photoFile,setPhotoFile]=useState<File|null>(null),[mondayDate,setMondayDate]=useState(mondayOfThisWeek()),[photoReading,setPhotoReading]=useState(false)
 const active=useRef<AbortController|null>(null),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.abort()}},[])
 const update=(id:string,patch:Partial<ImportRow>)=>{setReviewed(false);setRows(current=>current.map(r=>r.id===id?{...r,...patch}:r))}
 const read=async(picked:File|null=file,from=first,to=last)=>{
  if(!picked||busy)return;setBusy(true);setReading(true);setError('');setStatus('Preparing the PDF reader…');const controller=new AbortController();active.current=controller
  const timeout=window.setTimeout(()=>controller.abort(),180000)
  try{const {readSchedulePdf}=await import('../store/readSchedulePdf');const result=await readSchedulePdf(picked,from,to,controller.signal,m=>{if(mounted.current)setStatus(m)},scanAll,'find-class-table');if(!mounted.current)return;setText(result);suggestions(result,picked)}catch(e){if(mounted.current){setStatus('');setError(controller.signal.aborted?'Reading stopped. Try one page at a time or a clearer scan.':e instanceof Error?e.message:'Could not read this PDF. Try a clearer scan.')}}finally{clearTimeout(timeout);if(mounted.current){setBusy(false);setReading(false)}active.current=null}
 }
 const commit=async()=>{
  if(busy||!reviewed)return;setBusy(true);setError('');let result:ReturnType<typeof applyScheduleImport>|undefined;let before:AppData|undefined
  const selected=rows.filter(r=>r.include),classes=intoSemester?selected.filter(r=>r.kind==='class'):[],others=intoSemester?selected.filter(r=>r.kind!=='class'):selected
  try{const saved=await save(current=>{
   before=normalizeData(current);let next={data:current,added:0,skipped:0}
   if(others.length)next=applyScheduleImport(current,profile.id,others,start,end)
   // Weekly classes join the chosen semester, so its breaks and holidays apply to them.
   if(classes.length&&intoSemester){const c=addImportedClassesToSeason(next.data,profile.id,intoSemester.id,classes);next={data:c.data,added:next.added+c.added,skipped:next.skipped+c.skipped}}
   result=next;return next.data
  });if(saved&&result&&before){setReceipt(result.added?{before,after:result.data}:null);setStatus(result.added+' records added; '+result.skipped+' duplicates skipped. '+(classes.length&&intoSemester?'Classes are in '+intoSemester.name+'.':'Find classes in your daily schedule and Planner.'));setRows([]);setReviewed(false);setText('');setFile(null)}else setError('Not saved yet. Your reviewed items remain here; check the save status before retrying.')}catch(e){setError(e instanceof Error?e.message:'Could not import.')}finally{setBusy(false)}
 }
 const undo=async()=>{
  if(!receipt||busy)return;setBusy(true);setError('')
  try{const saved=await save(current=>{if(JSON.stringify(normalizeData(current))!==JSON.stringify(receipt.after))throw Error('Your plan has changed since importing. Use the individual items’ Trash actions to avoid losing newer work.');return receipt.before});if(saved){setReceipt(null);setStatus('The entire import was undone.')}else setError('Undo was not saved. Your import is still available.')}catch(e){setError(e instanceof Error?e.message:'Could not undo.')}finally{setBusy(false)}
 }
 // A suggestion with everything it needs starts ticked; one missing a date or time starts unticked, so it gets a look.
 const complete=(r:ImportRow)=>!!r.title.trim()&&(r.kind==='class'?r.weekdays.length>0&&!!r.start&&!!r.end:r.kind==='subject'||validDate(r.date))
 const clock=(t:string)=>{const [h,m]=t.split(':').map(Number);return Number.isFinite(h)?((h+11)%12+1)+':'+String(m||0).padStart(2,'0')+(h<12?' AM':' PM'):'no time'}
 const summary=(r:ImportRow)=>r.kind==='class'?(r.weekdays.length?[...r.weekdays].sort().map(d=>dayNames[d].slice(0,3)).join(', '):'No days yet')+' · '+(r.start&&r.end?clock(r.start)+' – '+clock(r.end):'no time yet'):r.kind==='subject'?'Subject':({exam:'Exam',task:'Assignment',event:'Event'} as Record<string,string>)[r.kind]+' · '+(validDate(r.date)?new Date(r.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}):'no date yet')
 const suggestions=(source:string=text,from:File|null=file)=>{const found=suggestSchedule(source,start,end,order).map(r=>({...r,include:complete(r)})),ready=found.filter(r=>r.include).length;setRows(found);setEditing(found.filter(r=>!r.include).map(r=>r.id));setReviewed(false);if(!found.length)setMore(true)
  setStatus(found.length?found.length+' item'+(found.length===1?'':'s')+' found'+(ready<found.length?'; '+(found.length-ready)+' need'+(found.length-ready===1?'s':'')+' a date or time before '+(found.length-ready===1?'it':'they')+' can be added':'')+'. Check them below, then add them.':'Nothing to add was found in this PDF. Open “More options” to try other pages or fix the text, or add items by hand. For a class schedule, “My school schedule” or “My college classes” can read it with your AI helper.')
  // Tell KONO support a layout wasn't understood: its size only, never its text.
  if(!found.length&&from)reportError('Schedule import found nothing to add (PDF)',{detail:'text read: '+source.length+' characters · column headings found: '+(/(^|\t)(time|days?)(\t|$)/im.test(source)?'yes':'no')})}
 const readPhoto=async()=>{
  if(!photoFile||busy)return
  if(photoFile.size>8_000_000){setError('Choose a photo under 8 MB.');return}
  if(!aiReady(photoApiKey)){setError(needsAiMessage);return}
  if(!validDate(mondayDate)){setError('Choose the Monday this planner page covers.');return}
  setBusy(true);setPhotoReading(true);setError('');setStatus('Reading the photo…')
  try{
   const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]??'');reader.onerror=()=>reject(new Error('Could not read that photo.'));reader.readAsDataURL(photoFile)})
   const items=await readPlannerPhoto({base64,mimeType:photoFile.type||'image/jpeg'},photoProvider,photoApiKey)
   const found=plannerPhotoToImportRows(items,mondayDate)
   setRows(found);setReviewed(false);setText('');setFile(null);setPhotoFile(null)
   setStatus(found.length+' item'+(found.length===1?'':'s')+' found. Check each one against the photo below, then add the ones you want.')
  }catch(e){setError(e instanceof Error?e.message:'Could not read that photo.')}
  finally{setBusy(false);setPhotoReading(false)}
 }
 return <section className="wb-panel schedule-import"><div className="wb-section-head"><div><h2>Import a schedule</h2><p>Choose a PDF. KONO finds the dates and classes, you check them, and they go on your Planner.</p></div></div>
 <fieldset disabled={busy}><label className="upload-drop">{file?'📄 '+file.name:'📄 Choose a PDF'}<small>{file?'Tap to choose a different PDF':'A syllabus, assignment list or class calendar, up to 20 MB'}</small><input type="file" aria-label="Choose PDF (up to 20 MB)" accept="application/pdf,.pdf" onChange={e=>{const f=e.target.files?.[0]??null;setFile(f);setError('');e.target.value='';if(f){setFirst(1);setLast(5);void read(f,1,5)}}}/></label>
 <p className="wb-muted">The PDF stays on this device. Only the items you approve are saved to your plan.</p></fieldset>
 {reading&&<button onClick={()=>active.current?.abort()}>Cancel reading</button>}
 {status&&<p role="status" className="import-status">{status}</p>}{error&&<p role="alert">{error}</p>}{receipt&&<button disabled={busy} onClick={()=>void undo()}>Undo entire import</button>}
 <fieldset disabled={busy}>
 {rows.length>0&&<><h3>Review suggestions</h3>{rows.some(r=>r.kind==='class')&&(semesters.length?<label className="import-semester">Put weekly classes in<select value={target} onChange={e=>{setTarget(e.target.value);setReviewed(false)}}>{semesters.map(s=><option key={s.id} value={s.id}>{s.name}{s.active?'':' (inactive)'}</option>)}<option value="">A new separate schedule (no semester breaks)</option></select></label>:<p className="wb-muted">Tip: set up your semester first in Settings › Schedules › College semester, so its breaks and holidays apply to these classes.</p>)}<p className="wb-muted">Compare these with your PDF. Items missing a date or time start unticked: fill them in, then tick them. Only ticked items are added.</p><datalist id="import-subject-names">{data.subjects.filter(s=>s.profileId===profile.id).map(s=><option key={s.id} value={s.name}/>)}</datalist>{rows.map((row,i)=>{const open=editing.includes(row.id);return <fieldset className={'import-row'+(row.include?' is-in':'')} key={row.id}><legend>Item {i+1}</legend><div className="import-row-head"><label className="import-select"><input type="checkbox" aria-label="Add this item" checked={row.include} onChange={e=>update(row.id,{include:e.target.checked})}/><span><b>{row.title||'Untitled item'}</b><small>{summary(row)}</small></span></label><button aria-expanded={open} onClick={()=>setEditing(v=>open?v.filter(id=>id!==row.id):[...v,row.id])}>{open?'Done':'Edit'}</button></div>
 {open&&<><div className="import-fields"><label>Type<select value={row.kind} onChange={e=>update(row.id,{kind:e.target.value as ImportRow['kind']})}><option value="class">Recurring class</option><option value="exam">Exam / quiz</option><option value="task">Assignment</option><option value="event">Calendar event</option><option value="subject">Subject only</option></select></label><label>Title<input maxLength={200} value={row.title} onChange={e=>update(row.id,{title:e.target.value})}/></label>{row.kind!=='subject'&&<label>Subject (existing name or new)<input list="import-subject-names" maxLength={200} value={row.subject} onChange={e=>update(row.id,{subject:e.target.value})}/></label>}</div>
 {row.kind==='class'?<><div className="import-weekdays">{dayNames.map((day,d)=><label key={day}><input type="checkbox" aria-label={day} checked={row.weekdays.includes(d)} onChange={e=>update(row.id,{weekdays:e.target.checked?[...row.weekdays,d]:row.weekdays.filter(n=>n!==d)})}/><span aria-hidden="true">{day.slice(0,3)}</span></label>)}</div><div className="import-fields import-times"><label>Start time<input type="time" value={row.start} onInput={e=>update(row.id,{start:e.currentTarget.value})}/></label><label>End time<input type="time" value={row.end} onInput={e=>update(row.id,{end:e.currentTarget.value})}/></label></div><p>Repeats on the checked weekdays from {start||'…'} through {end||'…'}. Holidays and exceptions can be skipped afterward.</p></>:row.kind!=='subject'&&<label>Date<input type="date" value={row.date} onInput={e=>update(row.id,{date:e.currentTarget.value})}/></label>}<details><summary>Source text</summary><p>{row.source}</p></details><button onClick={()=>{setRows(v=>v.filter(r=>r.id!==row.id));setReviewed(false)}}>Remove suggestion</button></>}</fieldset>})}
 <label className="import-select"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> I checked the selected subjects, dates, weekdays and times against my schedule.</label><button className="primary" disabled={!reviewed||!rows.some(r=>r.include)} onClick={()=>void commit()}>Add {rows.filter(r=>r.include).length} selected items to my Planner</button></>}

 <button onClick={()=>{setReviewed(false);{const id=uid('import-row');setEditing(v=>[...v,id]);setRows(v=>[...v,{id,include:false,kind:'class',title:'',subject:'',date:'',weekdays:[],start:'',end:'',source:'Added manually'}])}}} disabled={rows.length>=100}>＋ Add an item by hand</button>
 </fieldset>
 <details className="import-more" open={more} onToggle={e=>setMore(e.currentTarget.open)}><summary>More options</summary>
 <fieldset disabled={busy}><p>KONO reads the first five pages. For a longer PDF, choose which pages to read (up to five at a time). Blurry text, handwriting and timetable columns need extra checking.</p><div className="import-fields"><label>First page<input type="number" min="1" max="1000" value={first} onChange={e=>setFirst(Number(e.target.value))}/></label><label>Last page<input type="number" min={first} max={first+4} value={last} onChange={e=>setLast(Number(e.target.value))}/></label></div><label className="import-select"><input type="checkbox" checked={scanAll} onChange={e=>setScanAll(e.target.checked)}/> Read scanned images on every page (recommended for scans)</label><button disabled={!file} onClick={()=>void read()}>Read selected pages</button>
 <div className="import-fields"><label>Classes start<input type="date" value={start} onInput={e=>{setStart(e.currentTarget.value);setReviewed(false)}}/></label><label>Classes end<input type="date" value={end} onInput={e=>{setEnd(e.currentTarget.value);setReviewed(false)}}/></label><label>Dates in this document<select value={order} onChange={e=>{setOrder(e.target.value as typeof order);setReviewed(false)}}><option value="mdy">Month / day / year</option><option value="dmy">Day / month / year</option></select></label></div>
 <label>Text KONO read (you can fix it or paste your own)<textarea rows={8} maxLength={100000} value={text} onChange={e=>{setText(e.target.value);setReviewed(false)}} placeholder="Example: Biology Tuesday 10am–12pm"/></label><button disabled={!text.trim()} onClick={()=>suggestions()}>Find schedule items</button></fieldset>
 <fieldset disabled={busy} className="schedule-photo-import"><legend>A photo of a handwritten weekly planner</legend>
 <p>Handwriting is read by your AI helper. The photo goes straight from this browser to its provider; nothing is stored anywhere else.</p>
 <AiHelperStatus profileId={profile.id}/>
 <label>Week starting (Monday)<input type="date" value={mondayDate} onInput={e=>setMondayDate(e.currentTarget.value)}/></label>
 <label>Choose photo<input type="file" accept="image/*" onChange={e=>{setPhotoFile(e.target.files?.[0]??null);setError('');e.target.value=''}}/></label>{photoFile&&<p>{photoFile.name}</p>}
 <button disabled={!photoFile||photoReading} onClick={()=>void readPhoto()}>{photoReading?'Reading photo…':'Read photo'}</button>
 </fieldset></details>
 </section>
}
