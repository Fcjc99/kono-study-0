import {useEffect,useRef,useState} from 'react'
import {type StudySeason} from '../store/model'
import {addTimetableRows,parseNdaSixDaySchedule,parseWeeklyCollegeSchedule,suggestRotatingClasses,type RotatingImportRow} from '../store/schoolImport'
import {reportError} from '../store/errorReporter'
import {suggestSchedule} from '../store/scheduleImport'
import {dayNames,uid} from '../store/model'
import {useAiHelper} from '../hooks/useAiHelper'
import {AiHelperSettings} from './AiHelper'
export default function SchoolTimetableImport({season,change,onReview}:{season:StudySeason;change:(s:StudySeason)=>void;onReview:()=>void}){
 const [file,setFile]=useState<File|null>(null),[text,setText]=useState(''),[rows,setRows]=useState<RotatingImportRow[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[missed,setMissed]=useState(false)
 const cancel=useRef<AbortController|null>(null)
 const ai=useAiHelper(season.profileId)
 useEffect(()=>()=>cancel.current?.abort(),[])
 const patch=(id:string,p:Partial<RotatingImportRow>)=>{setRows(rows.map(r=>r.id===id?{...r,...p}:r));}
 const weekly=season.school?.pattern==='weekly'
 const lastClass=season.school!.lastClassDate||season.end
 // College classes: the table reader first, then the same reader Import & export › Import a schedule uses.
 const weeklyClasses=(value:string)=>{
  const table=parseWeeklyCollegeSchedule(value,season.start,lastClass,season.school!.cycle)
  if(table.length)return table
  return suggestSchedule(value,season.start,lastClass,'mdy').filter(r=>r.kind==='class'&&r.start&&r.end&&r.end>r.start).flatMap(r=>r.weekdays.map(d=>dayNames[d]).filter(day=>season.school!.cycle.includes(day)).map(day=>({id:uid('import-block'),include:true,day,label:r.title,slot:'',start:r.start,end:r.end,dateStart:season.start,dateEnd:lastClass,kind:'study' as const,location:r.location})))
 }
 const find=(value:string,picked=file)=>{try{const nda=season.school!.cycle.length===6&&/6-Day Schedule/i.test(value),found=weekly?weeklyClasses(value):nda?parseNdaSixDaySchedule(value,season.start,lastClass):suggestRotatingClasses(value,season.school!.cycle,season.start,lastClass).map(r=>({...r,include:!!(r.day&&r.label&&r.start&&r.end&&r.end>r.start)&&r.kind==='study'}));setRows(found);const classes=found.filter(r=>r.kind==='study').length;setMissed(!classes);setMessage(classes?'Found '+classes+' classes and '+found.filter(r=>r.kind!=='study').length+' schedule blocks. Check them, then continue to your calendar preview.':'KONO couldn’t find classes in this layout. Try “Read with AI helper” below, or add your classes by hand.')
  // Tell KONO support that a schedule layout wasn't understood: the kind of file and schedule only, never its text.
  if(!classes&&picked)reportError('Schedule upload found no classes ('+(weekly?'weekly college':season.school!.cycle.length+'-day rotation')+')',{detail:'File: '+(/\.pdf$/i.test(picked.name)?'PDF':'photo')+' · text read: '+value.length+' characters · column headings found: '+(/(^|\t)(time|days?)(\t|$)/im.test(value)?'yes':'no')})
 }catch(e){setRows([]);setMessage(e instanceof Error?e.message:'Could not recognize this timetable.')}}
 const read=async()=>{if(!file||busy)return;const controller=new AbortController();cancel.current=controller;setBusy(true);setRows([]);setMissed(false);setMessage('Reading on this device…');try{const reader=await import('../store/readSchedulePdf');const mode=weekly?'class-table' as const:season.school!.cycle.length===6?'six-day' as const:true;const value=/\.pdf$/i.test(file.name)?await reader.readSchedulePdf(file,1,2,controller.signal,setMessage,false,mode):await reader.readSchedulePhoto(file,controller.signal,setMessage);setText(value);find(value)}catch(e){setMessage(e instanceof Error?e.message:'Could not read.')}finally{setBusy(false)}}
 const readWithAi=async()=>{
  if(busy)return;setBusy(true);setMessage('Asking your AI helper…')
  try{
   const {readClassScheduleWithAi}=await import('../store/aiClassSchedule')
   const photo=file&&!/\.pdf$/i.test(file.name)?{base64:await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]??'');r.onerror=()=>reject(new Error('Could not read that photo.'));r.readAsDataURL(file)}),mimeType:file.type||'image/jpeg'}:undefined
   const found=await readClassScheduleWithAi({text,photo},season.school!.cycle,season.start,lastClass,ai.provider,ai.apiKey)
   setRows(found);setMissed(false);setMessage('Your AI helper found '+found.length+' classes. Check each one against your schedule, then continue.')
  }catch(e){setMessage(e instanceof Error?e.message:'The AI helper could not read this schedule.')}finally{setBusy(false)}
 }
 const add=()=>{
  try{
   change(addTimetableRows(season,rows));setRows([]);setText('');setFile(null);setMissed(false);onReview()
  }catch(e){setMessage(e instanceof Error?e.message:'Check the selected classes.')}
 }
 return <details open><summary>Import class timetable · PDF or photo</summary><p>KONO reads it on this device for free; the file isn’t saved. Crop out student email and locker details. Reads the first two PDF pages.</p><input aria-label="Class timetable file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setRows([]);setText('');setMessage('');setMissed(false)}}/><button disabled={busy||!file} onClick={()=>void read()}>Read timetable & find classes</button>{busy&&<button onClick={()=>cancel.current?.abort()}>Cancel reading</button>}<p role="status">{message}</p>{(missed||(text&&rows.length>0))&&<div className="ai-class-fallback"><p className="wb-muted">{missed?'Every school prints schedules differently.':'Missing a class?'} Your AI helper can read almost any layout. {file&&!/\.pdf$/i.test(file.name)?'The photo':'The text KONO read'} goes from this browser to your AI provider; you check the classes before anything is saved.</p>{ai.apiKey.trim()?<button type="button" disabled={busy||(!text.trim()&&!file)} onClick={()=>void readWithAi()}>Read with AI helper</button>:<details><summary>Set up the AI helper (a free Gemini key works)</summary><AiHelperSettings profileId={season.profileId}/></details>}</div>}<details><summary>View or correct extracted text</summary><label>Extracted text<textarea maxLength={100000} rows={8} value={text} onChange={e=>{setText(e.target.value);setRows([]);}}/></label><button disabled={busy||!text.trim()} onClick={()=>find(text,null)}>Find classes again</button></details><p>{weekly?'Dates default to your fall/semester range. KONO reads each weekday, class name, course code, time, building and room, then makes one calendar class for every meeting day.':'Dates default to your selected school year. Confirm each class’s semester dates before saving. In A/E mode, Days 1, 3, 5 become A day and Days 2, 4, 6 become E day. Homeroom is optional; check its meeting days before including it.'}</p>
 {rows.map(r=><article className="wb-record" key={r.id}><label className="wb-check"><input type="checkbox" checked={r.include} onChange={e=>patch(r.id,{include:e.target.checked})}/>Include this class</label><strong>{r.label || 'Unnamed class'}</strong><p>{r.day || (weekly?'Choose weekday':'Choose rotation day')} · {r.start || 'Choose start'}–{r.end || 'Choose end'}{r.location?' · '+r.location:''}</p><details><summary>Edit class, time or semester dates</summary><div className="wb-form-grid"><label>{weekly?'Weekday':'Rotation day'}<select value={r.day} onChange={e=>patch(r.id,{day:e.target.value})}><option value="">{weekly?'Choose weekday':'Choose day from original'}</option>{season.school!.cycle.map(d=><option key={d}>{d}</option>)}</select></label><label>Class name<input maxLength={200} value={r.label} onChange={e=>patch(r.id,{label:e.target.value})}/></label><label>{weekly?'Course code':'Block letter'}<input maxLength={30} value={r.slot} onChange={e=>patch(r.id,{slot:e.target.value})}/></label><label>Building / room<input maxLength={160} value={r.location??''} onChange={e=>patch(r.id,{location:e.target.value})}/></label><label>Starts<input type="time" value={r.start} onInput={e=>patch(r.id,{start:e.currentTarget.value})}/></label><label>Ends<input type="time" value={r.end} onInput={e=>patch(r.id,{end:e.currentTarget.value})}/></label><label>First class date<input type="date" value={r.dateStart} onInput={e=>patch(r.id,{dateStart:e.currentTarget.value})}/></label><label>Last class date<input type="date" value={r.dateEnd} onInput={e=>patch(r.id,{dateEnd:e.currentTarget.value})}/></label><label>Type<select value={r.kind} onChange={e=>patch(r.id,{kind:e.target.value as RotatingImportRow['kind']})}><option value="study">Class</option><option value="break">Free period</option><option value="routine">Advisory / routine</option><option value="hobby">Club / activity</option></select></label></div></details></article>)}
 {!!rows.length&&<button className="primary" disabled={!rows.some(r=>r.include)||busy} onClick={add}>Continue to calendar preview</button>}
 </details>
}
