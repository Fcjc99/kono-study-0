import {useEffect,useRef,useState} from 'react'
import {dayNames,localDate,normalizeData,uid,type AppData} from '../store/model'
import {addDays} from '../store/studyScheduler'
import type {PlannerRepository} from '../store/repository'
import {applyScheduleImport,suggestSchedule,validDate,type ImportRow} from '../store/scheduleImport'
import {readPlannerPhoto,plannerPhotoToImportRows} from '../store/scheduleCalendarPhoto'
import {useLocalSetting} from '../hooks/useLocalSetting'
import './schedule-import.css'

// Monday of the current week, as a sane default for "which week is this photo of" -- dateNumber-style
// UTC-noon anchoring avoids the off-by-one a plain `new Date(dateString)` risks near midnight.
const mondayOfThisWeek=()=>{const today=localDate(),jsDay=new Date(today+'T12:00:00Z').getUTCDay();return addDays(today,jsDay===0?-6:1-jsDay)}

export default function ScheduleImport({data,save}:{data:AppData;save:PlannerRepository['update']}){
 const profile=data.profiles.find(p=>p.id===data.activeProfileId)!
 const [scanAll,setScanAll]=useState(true),[open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[text,setText]=useState(''),[rows,setRows]=useState<ImportRow[]>([])
 const [start,setStart]=useState(profile.start),[end,setEnd]=useState(profile.end),[order,setOrder]=useState<'mdy'|'dmy'>('mdy')
 const [first,setFirst]=useState(1),[last,setLast]=useState(1),[busy,setBusy]=useState(false),[reading,setReading]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false)
 const [receipt,setReceipt]=useState<{before:AppData;after:AppData}|null>(null)
 // Shares K-Quiz's exact provider/key storage (same localStorage keys) -- it is the same browser-side
 // AI call either way, so setting it up once in either place works in both.
 const [photoProvider,setPhotoProvider]=useLocalSetting('kono-kquiz:'+profile.id+':provider','gemini')
 const [photoApiKey,setPhotoApiKey]=useLocalSetting('kono-kquiz:'+profile.id+':key','')
 const [photoFile,setPhotoFile]=useState<File|null>(null),[mondayDate,setMondayDate]=useState(mondayOfThisWeek()),[photoReading,setPhotoReading]=useState(false)
 const active=useRef<AbortController|null>(null),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.abort()}},[])
 const update=(id:string,patch:Partial<ImportRow>)=>{setReviewed(false);setRows(current=>current.map(r=>r.id===id?{...r,...patch}:r))}
 const read=async()=>{
  if(!file||busy)return;setBusy(true);setReading(true);setError('');setStatus('Preparing the PDF reader…');const controller=new AbortController();active.current=controller
  const timeout=window.setTimeout(()=>controller.abort(),180000)
  try{const {readSchedulePdf}=await import('../store/readSchedulePdf');const result=await readSchedulePdf(file,first,last,controller.signal,m=>{if(mounted.current)setStatus(m)},scanAll);if(!mounted.current)return;setText(result);setRows([]);setReviewed(false);setStatus('Text is ready. Check it below, then find schedule items.')}catch(e){if(mounted.current){setStatus('');setError(controller.signal.aborted?'Reading stopped. Try one page at a time or a clearer scan.':e instanceof Error?e.message:'Could not read this PDF. Try a clearer scan.')}}finally{clearTimeout(timeout);if(mounted.current){setBusy(false);setReading(false)}active.current=null}
 }
 const commit=async()=>{
  if(busy||!reviewed)return;setBusy(true);setError('');let result:ReturnType<typeof applyScheduleImport>|undefined;let before:AppData|undefined
  try{const saved=await save(current=>{before=normalizeData(current);result=applyScheduleImport(current,profile.id,rows,start,end);return result.data});if(saved&&result&&before){setReceipt(result.added?{before,after:result.data}:null);setStatus(result.added+' records added; '+result.skipped+' duplicates skipped. Find classes in your daily schedule and Planner.');setRows([]);setReviewed(false);setText('');setFile(null)}else setError('Not saved yet. Your reviewed items remain here; check the save status before retrying.')}catch(e){setError(e instanceof Error?e.message:'Could not import.')}finally{setBusy(false)}
 }
 const undo=async()=>{
  if(!receipt||busy)return;setBusy(true);setError('')
  try{const saved=await save(current=>{if(JSON.stringify(normalizeData(current))!==JSON.stringify(receipt.after))throw Error('Your plan has changed since importing. Use the individual items’ Trash actions to avoid losing newer work.');return receipt.before});if(saved){setReceipt(null);setStatus('The entire import was undone.')}else setError('Undo was not saved. Your import is still available.')}catch(e){setError(e instanceof Error?e.message:'Could not undo.')}finally{setBusy(false)}
 }
 const suggestions=()=>{setRows(suggestSchedule(text,start,end,order));setReviewed(false);setStatus('Review every suggestion. Unrecognized lines stay in the source text; add missing items manually.')}
 const readPhoto=async()=>{
  if(!photoFile||busy)return
  if(photoFile.size>8_000_000){setError('Choose a photo under 8 MB.');return}
  if(!photoApiKey.trim()){setError('Add an AI API key below first.');return}
  if(!validDate(mondayDate)){setError('Choose the Monday this planner page covers.');return}
  setBusy(true);setPhotoReading(true);setError('');setStatus('Reading the photo…')
  try{
   const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]??'');reader.onerror=()=>reject(new Error('Could not read that photo.'));reader.readAsDataURL(photoFile)})
   const items=await readPlannerPhoto({base64,mimeType:photoFile.type||'image/jpeg'},photoProvider==='openai'?'openai':'gemini',photoApiKey)
   const found=plannerPhotoToImportRows(items,mondayDate)
   setRows(found);setReviewed(false);setText('');setFile(null);setPhotoFile(null)
   setStatus(found.length+' item'+(found.length===1?'':'s')+' found. Check each one against the photo below, then add the ones you want.')
  }catch(e){setError(e instanceof Error?e.message:'Could not read that photo.')}
  finally{setBusy(false);setPhotoReading(false)}
 }
 return <section className="wb-panel schedule-import"><div className="wb-section-head"><div><h2>Import a schedule</h2><p>Scanned PDF → review → your Planner</p></div><button onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?'Hide importer':'Import PDF'}</button></div>
 {open&&<><p>English printed schedules and syllabuses. No paid AI. The PDF stays on this device; only the items you approve are saved to your plan. Keep this page open while reading. Closing the page discards the unsaved scan.</p>
 <fieldset disabled={busy}><label>Choose PDF (up to 20 MB)<input type="file" accept="application/pdf,.pdf" onChange={e=>{setFile(e.target.files?.[0]??null);setError('');e.target.value=''}}/></label>{file&&<p>{file.name}</p>}<div className="import-fields"><label>First page<input type="number" min="1" max="1000" value={first} onChange={e=>setFirst(Number(e.target.value))}/></label><label>Last page<input type="number" min={first} max={first+4} value={last} onChange={e=>setLast(Number(e.target.value))}/></label></div><p>Read up to five pages at a time. Start with one on an iPhone. Blurry text, handwriting and timetable columns need extra checking.</p><label className="import-select"><input type="checkbox" checked={scanAll} onChange={e=>setScanAll(e.target.checked)}/> Read scanned images on every page (recommended for scans)</label><button disabled={!file} onClick={()=>void read()}>Read selected pages</button></fieldset>
 {reading&&<button onClick={()=>active.current?.abort()}>Cancel reading</button>}
 <fieldset disabled={busy} className="schedule-photo-import"><legend>Or scan a photo of a handwritten weekly planner</legend>
 <p>Real handwriting needs an actual AI vision model to read reliably, unlike the PDF reader above. Uses the same AI key as K-Quiz — set it up once in either place and it works in both. The photo and key go straight to your chosen provider from this browser; nothing is stored anywhere else.</p>
 <details><summary>AI settings</summary><label>Provider<select value={photoProvider} onChange={e=>setPhotoProvider(e.target.value)}><option value="gemini">Google Gemini (free tier available)</option><option value="openai">OpenAI</option></select></label><label>API key<input type="password" autoComplete="off" value={photoApiKey} onChange={e=>setPhotoApiKey(e.target.value)} placeholder="Paste your API key"/></label><p className="wb-muted ai-key-help">Don't have one? <a href={photoProvider==='openai'?'https://platform.openai.com/api-keys':'https://aistudio.google.com/apikey'} target="_blank" rel="noopener noreferrer">{photoProvider==='openai'?'Get an OpenAI key':'Get a free Gemini key'} →</a></p></details>
 <label>Week starting (Monday)<input type="date" value={mondayDate} onInput={e=>setMondayDate(e.currentTarget.value)}/></label>
 <label>Choose photo<input type="file" accept="image/*" onChange={e=>{setPhotoFile(e.target.files?.[0]??null);setError('');e.target.value=''}}/></label>{photoFile&&<p>{photoFile.name}</p>}
 <button disabled={!photoFile||photoReading} onClick={()=>void readPhoto()}>{photoReading?'Reading photo…':'Read photo'}</button>
 </fieldset>
 <fieldset disabled={busy}><div className="import-fields"><label>Classes start<input type="date" value={start} onInput={e=>{setStart(e.currentTarget.value);setReviewed(false)}}/></label><label>Classes end<input type="date" value={end} onInput={e=>{setEnd(e.currentTarget.value);setReviewed(false)}}/></label><label>Dates in this document<select value={order} onChange={e=>{setOrder(e.target.value as typeof order);setReviewed(false)}}><option value="mdy">Month / day / year</option><option value="dmy">Day / month / year</option></select></label></div>
 <label>Recognized text (editable)<textarea rows={8} maxLength={100000} value={text} onChange={e=>{setText(e.target.value);setReviewed(false)}} placeholder="Read a PDF or paste schedule text here. Example: Biology Tuesday 10am–12pm"/></label><button disabled={!text.trim()} onClick={suggestions}>Find schedule items</button><button onClick={()=>{setReviewed(false);setRows(v=>[...v,{id:uid('import-row'),include:false,kind:'class',title:'',subject:'',date:'',weekdays:[],start:'',end:'',source:'Added manually'}])}} disabled={rows.length>=100}>＋ Add missing item</button>
 {rows.length>0&&<><h3>Review suggestions</h3><p>Check the original PDF. Nothing below is selected automatically. Fix missing dates or AM/PM before importing. Only selected items will be added.</p><datalist id="import-subject-names">{data.subjects.filter(s=>s.profileId===profile.id).map(s=><option key={s.id} value={s.name}/>)}</datalist>{rows.map((row,i)=><fieldset className="import-row" key={row.id}><legend>Item {i+1}</legend><label className="import-select"><input type="checkbox" checked={row.include} onChange={e=>update(row.id,{include:e.target.checked})}/> Add this item</label><details><summary>Source text</summary><p>{row.source}</p></details><div className="import-fields"><label>Type<select value={row.kind} onChange={e=>update(row.id,{kind:e.target.value as ImportRow['kind']})}><option value="class">Recurring class</option><option value="exam">Exam / quiz</option><option value="task">Assignment</option><option value="event">Calendar event</option><option value="subject">Subject only</option></select></label><label>Title<input maxLength={200} value={row.title} onChange={e=>update(row.id,{title:e.target.value})}/></label>{row.kind!=='subject'&&<label>Subject (existing name or new)<input list="import-subject-names" maxLength={200} value={row.subject} onChange={e=>update(row.id,{subject:e.target.value})}/></label>}</div>
 {row.kind==='class'?<><div className="import-weekdays">{dayNames.map((day,d)=><label key={day}><input type="checkbox" checked={row.weekdays.includes(d)} onChange={e=>update(row.id,{weekdays:e.target.checked?[...row.weekdays,d]:row.weekdays.filter(n=>n!==d)})}/>{day}</label>)}</div><div className="import-fields"><label>Start time<input type="time" value={row.start} onInput={e=>update(row.id,{start:e.currentTarget.value})}/></label><label>End time<input type="time" value={row.end} onInput={e=>update(row.id,{end:e.currentTarget.value})}/></label></div><p>Repeats on the checked weekdays from {start||'…'} through {end||'…'}. Holidays and exceptions can be skipped afterward.</p></>:row.kind!=='subject'&&<label>Date<input type="date" value={row.date} onInput={e=>update(row.id,{date:e.currentTarget.value})}/></label>}<button onClick={()=>{setRows(v=>v.filter(r=>r.id!==row.id));setReviewed(false)}}>Remove suggestion</button></fieldset>)}
 <label className="import-select"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> I checked the selected subjects, dates, weekdays and times against my schedule.</label><button className="primary" disabled={!reviewed||!rows.some(r=>r.include)} onClick={()=>void commit()}>Add {rows.filter(r=>r.include).length} selected items to my Planner</button></>}
 </fieldset></>}
 {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}{receipt&&<button disabled={busy} onClick={()=>void undo()}>Undo entire import</button>}
 </section>
}
