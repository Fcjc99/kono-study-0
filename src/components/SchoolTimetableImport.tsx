import {useEffect,useRef,useState} from 'react'
import {type StudySeason} from '../store/model'
import {addTimetableRows,parseNdaSixDaySchedule,parseWeeklyCollegeSchedule,suggestRotatingClasses,type RotatingImportRow} from '../store/schoolImport'
import {reportError} from '../store/errorReporter'
import {suggestSchedule} from '../store/scheduleImport'
import {dayNames,uid} from '../store/model'
import {useAiHelper} from '../hooks/useAiHelper'
import {classTime} from '../store/classSchedule'
import {AiHelperSettings} from './AiHelper'
import ClassGrid from './ClassGrid'
import {addBellBlocks,applyBells,bellScheduleFor,periodNumber,periodProblems} from '../store/bellSchedules'
export default function SchoolTimetableImport({season,change,onReview}:{season:StudySeason;change:(s:StudySeason)=>void;onReview:()=>void}){
 const [file,setFile]=useState<File|null>(null),[text,setText]=useState(''),[rows,setRows]=useState<RotatingImportRow[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[missed,setMissed]=useState(false)
 const cancel=useRef<AbortController|null>(null)
 const ai=useAiHelper(season.profileId)
 useEffect(()=>()=>cancel.current?.abort(),[])
 const patch=(id:string,p:Partial<RotatingImportRow>)=>{setRows(rows.map(r=>r.id===id?{...r,...p}:r));}
 // Schedules that list "Period 1…5" without clock times: one set of times per period fills every class in it.
 // A school KONO knows the bell schedule for (Duxbury High, Duxbury Middle) gets them filled in, and at
 // Duxbury High each class's lunch wave too.
 const bells=bellScheduleFor(season.school)
 // Numbered periods, then any other untimed row the schedule has (like Duxbury Middle's ASP), each set once.
 const periods=[...new Set(rows.filter(r=>periodNumber(r.slot)||(r.slot&&rows.some(x=>x.slot===r.slot&&(!x.start||!x.end)))).map(r=>r.slot))].sort((a,b)=>(periodNumber(a)||99)-(periodNumber(b)||99))
 const lunchRows=bells?.lunch?rows.filter(r=>r.include&&r.kind==='study'&&periodNumber(r.slot)===bells.lunch!.period):[]
 const problems=bells||periods.length?periodProblems(rows,season.school!.cycle,bells):[]
 const setPeriod=(period:string,key:'start'|'end',value:string)=>setRows(rows.map(r=>r.slot===period?{...r,[key]:value}:r))
 const untimed=rows.filter(r=>r.include&&(!r.start||!r.end)).length
 const weekly=season.school?.pattern==='weekly'
 const lastClass=season.school!.lastClassDate||season.end
 // College classes: the table reader first, then the same reader Import & export › Import a schedule uses.
 const weeklyClasses=(value:string)=>{
  const table=parseWeeklyCollegeSchedule(value,season.start,lastClass,season.school!.cycle)
  if(table.length)return table
  return suggestSchedule(value,season.start,lastClass,'mdy').filter(r=>r.kind==='class'&&r.start&&r.end&&r.end>r.start).flatMap(r=>r.weekdays.map(d=>dayNames[d]).filter(day=>season.school!.cycle.includes(day)).map(day=>({id:uid('import-block'),include:true,day,label:r.title,slot:'',start:r.start,end:r.end,dateStart:season.start,dateEnd:lastClass,kind:'study' as const,location:r.location})))
 }
 const find=(value:string,picked:File|null=file):number=>{try{const nda=season.school!.cycle.length===6&&/6-Day Schedule/i.test(value),found=weekly?weeklyClasses(value):nda?parseNdaSixDaySchedule(value,season.start,lastClass):suggestRotatingClasses(value,season.school!.cycle,season.start,lastClass).map(r=>({...r,include:!!(r.day&&r.label&&r.start&&r.end&&r.end>r.start)&&r.kind==='study'}));setRows(applyBells(found,bells));const classes=found.filter(r=>r.kind==='study').length;setMissed(!classes);setMessage(classes?'Found '+classes+' classes and '+found.filter(r=>r.kind!=='study').length+' schedule blocks. Check them, then continue to your calendar preview.':'KONO couldn’t find classes in this layout. Try “Read with AI helper” below, or add your classes by hand.')
  // Tell KONO support that a schedule layout wasn't understood: the kind of file and schedule only, never its text.
  if(!classes&&picked)reportError('Schedule upload found no classes ('+(weekly?'weekly college':season.school!.cycle.length+'-day rotation')+')',{detail:'File: '+(/\.pdf$/i.test(picked.name)?'PDF':'photo')+' · text read: '+value.length+' characters · column headings found: '+(/(^|\t)(time|days?)(\t|$)/im.test(value)?'yes':'no')+' · school: '+season.school!.name})
  return classes
 }catch(e){setRows([]);setMessage(e instanceof Error?e.message:'Could not recognize this timetable.');return 0}}
 // One upload: KONO's own reader goes first, on this device. If it finds no classes and the AI helper is
 // ready, the AI reads the same file straight away, so nobody has to know which reader to pick.
 const read=async(picked:File)=>{if(busy)return;const controller=new AbortController();cancel.current=controller;setBusy(true);setRows([]);setMissed(false);setMessage('Reading on this device…')
  try{const reader=await import('../store/readSchedulePdf');const mode=weekly?'class-table' as const:season.school!.cycle.length===6?'six-day' as const:true;const value=/\.pdf$/i.test(picked.name)?await reader.readSchedulePdf(picked,1,2,controller.signal,setMessage,false,mode):await reader.readSchedulePhoto(picked,controller.signal,setMessage);setText(value)
   if(!find(value,picked)&&ai.ready){setMessage('KONO’s reader couldn’t find classes in this layout, so KONO’s AI is reading it…');await aiRead(picked,value)}
  }catch(e){setMessage(e instanceof Error?e.message:'Could not read.')}finally{setBusy(false)}}
 const readWithAi=async()=>{if(busy)return;setBusy(true);setMessage('Asking your AI helper…');try{await aiRead(file,text)}finally{setBusy(false)}}
 const aiRead=async(file:File|null,text:string)=>{
  try{
   const {readClassScheduleWithAi}=await import('../store/aiClassSchedule')
   // A picture-only PDF goes to the AI as the picture, not as recognized text.
   const pdfPicture=file&&/\.pdf$/i.test(file.name)?await (await import('../store/readSchedulePdf')).pdfPageImage(file):null
   const photo=pdfPicture??(file&&!/\.pdf$/i.test(file.name)?{base64:await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]??'');r.onerror=()=>reject(new Error('Could not read that photo.'));r.readAsDataURL(file)}),mimeType:file.type||'image/jpeg'}:undefined)
   const read=await readClassScheduleWithAi({text,photo},season.school!.cycle,season.start,lastClass,ai.provider,ai.apiKey,bells?.periods.length,bells?.extraRows),found=applyBells(read,bells)
   setRows(found);setMissed(false);setMessage('Your AI helper found '+found.length+' classes. '+(read.some(r=>!r.start)?bells?'Each period’s times come from '+season.school!.name+'’s bell schedule. ':'Your schedule shows periods but no times, so enter each period’s times below. ':'')+'Check each one against your schedule, then continue.')
  }catch(e){
   const why=e instanceof Error?e.message:'The AI helper could not read this schedule.'
   setMessage(why)
   // KONO's reader and the AI both came up empty: which kind of schedule and school, never its contents.
   if(/found no classes/i.test(why))reportError('Schedule upload: the AI found no classes either ('+(weekly?'weekly college':season.school!.cycle.length+'-day rotation')+')',{detail:'File: '+(file&&!/\.pdf$/i.test(file.name)?'photo':'PDF')+' · school: '+season.school!.name})
  }
 }
 const add=()=>{
  try{
   change(addBellBlocks(addTimetableRows(season,rows),rows));setRows([]);setText('');setFile(null);setMissed(false);onReview()
  }catch(e){setMessage(e instanceof Error?e.message:'Check the selected classes.')}
 }
 return <section className="timetable-import" aria-label="Upload your schedule"><p>KONO reads it on this device first; if it can’t, KONO’s AI reads it{ai.ready?'':' once the AI helper is set up'}. The file isn’t saved. Crop out student email and locker details.</p><label className="schedule-upload">Upload my schedule<small>PDF, photo or screenshot</small><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={e=>{const picked=e.target.files?.[0]??null;e.target.value='';setFile(picked);setRows([]);setText('');setMessage('');setMissed(false);if(picked)void read(picked)}}/></label>{busy&&<button onClick={()=>cancel.current?.abort()}>Cancel reading</button>}<p role="status">{message}</p>{(missed||(text&&rows.length>0))&&<div className="ai-class-fallback"><p className="wb-muted">{missed?'Every school prints schedules differently.':'Missing a class?'} Your AI helper can read almost any layout. {file&&!/\.pdf$/i.test(file.name)?'The photo':'The text KONO read (or, for a scanned PDF, the page as a picture)'} goes from this browser to your AI provider; you check the classes before anything is saved.</p>{ai.ready?<button type="button" disabled={busy||(!text.trim()&&!file)} onClick={()=>void readWithAi()}>Read with AI helper</button>:<details><summary>Set up the AI helper (a free Gemini key works)</summary><AiHelperSettings profileId={season.profileId}/></details>}</div>}<details><summary>View or correct extracted text</summary><label>Extracted text<textarea maxLength={100000} rows={8} value={text} onChange={e=>{setText(e.target.value);setRows([]);}}/></label><button disabled={busy||!text.trim()} onClick={()=>find(text,null)}>Find classes again</button></details><p>{weekly?'Dates default to your fall/semester range. KONO reads each weekday, class name, course code, time, building and room, then makes one calendar class for every meeting day.':'Dates default to your selected school year. Confirm each class’s semester dates before saving. In A/E mode, Days 1, 3, 5 become A day and Days 2, 4, 6 become E day. Homeroom is optional; check its meeting days before including it.'}</p>
 {rows.length>0&&<ClassGrid cycle={season.school!.cycle} classes={rows.filter(r=>r.include).map(r=>({...r,column:weekly?undefined:r.slot||undefined}))} caption="What KONO found"/>}
 {rows.length>0&&<details className="timetable-rows"><summary>Fix a class or leave one out ({rows.filter(r=>r.include).length} of {rows.length} included)</summary>{rows.map(r=><article className="wb-record" key={r.id}><label className="wb-check"><input type="checkbox" checked={r.include} onChange={e=>patch(r.id,{include:e.target.checked})}/>Include this class</label><strong>{r.label || 'Unnamed class'}</strong><p>{r.day || (weekly?'Choose weekday':'Choose rotation day')} · {r.start || 'Choose start'}–{r.end || 'Choose end'}{r.location?' · '+r.location:''}</p><details><summary>Edit class, time or semester dates</summary><div className="wb-form-grid"><label>{weekly?'Weekday':'Rotation day'}<select value={r.day} onChange={e=>patch(r.id,{day:e.target.value})}><option value="">{weekly?'Choose weekday':'Choose day from original'}</option>{season.school!.cycle.map(d=><option key={d}>{d}</option>)}</select></label><label>Class name<input maxLength={200} value={r.label} onChange={e=>patch(r.id,{label:e.target.value})}/></label><label>{weekly?'Course code':'Block letter'}<input maxLength={30} value={r.slot} onChange={e=>patch(r.id,{slot:e.target.value})}/></label><label>Building / room<input maxLength={160} value={r.location??''} onChange={e=>patch(r.id,{location:e.target.value})}/></label><label>Starts<input type="time" value={r.start} onInput={e=>patch(r.id,{start:e.currentTarget.value})}/></label><label>Ends<input type="time" value={r.end} onInput={e=>patch(r.id,{end:e.currentTarget.value})}/></label><label>First class date<input type="date" value={r.dateStart} onInput={e=>patch(r.id,{dateStart:e.currentTarget.value})}/></label><label>Last class date<input type="date" value={r.dateEnd} onInput={e=>patch(r.id,{dateEnd:e.currentTarget.value})}/></label><label>Type<select value={r.kind} onChange={e=>patch(r.id,{kind:e.target.value as RotatingImportRow['kind']})}><option value="study">Class</option><option value="break">Free period</option><option value="routine">Advisory / routine</option><option value="hobby">Club / activity</option></select></label> </div></details></article>)}</details>}
 {periods.length>0&&<fieldset className="period-times"><legend>Period times</legend><p className="wb-muted">{bells?'Filled in from '+season.school!.name+'’s bell schedule. If a time is different at your school, change it here and every class in that period gets it.'+(bells.after?' '+bells.after.label+' ('+classTime(bells.after.start)+'–'+classTime(bells.after.end)+') always follows Period '+bells.after.period+', with your Period '+bells.after.period+' class.':'')+(bells.extraRows?.length?' Set '+bells.extraRows.join(' and ')+'’s time from your schedule.':''):'Your schedule lists periods without clock times. Enter each period’s times once, from your school’s bell schedule, and every class in that period gets them.'}</p>{periods.map(p=>{const first=rows.find(r=>r.slot===p);return <div key={p} className="period-times-row"><strong>{p}</strong><label>Starts<input type="time" aria-label={p+' starts'} value={first?.start??''} onInput={e=>setPeriod(p,'start',e.currentTarget.value)}/></label><label>Ends<input type="time" aria-label={p+' ends'} value={first?.end??''} onInput={e=>setPeriod(p,'end',e.currentTarget.value)}/></label></div>})}</fieldset>}
 {lunchRows.length>0&&bells?.lunch&&<fieldset className="period-times lunch-waves"><legend>Lunch</legend><p className="wb-muted">Lunch is during Period {bells.lunch.period}, and your lunch wave depends on the department of your Period {bells.lunch.period} class: 1st lunch for science, math and technology, 2nd for history and world languages, 3rd for English, the arts, PE / health and everything else. Check it against your school’s lunch schedule.</p>{lunchRows.map(r=><div key={r.id} className="period-times-row"><strong>{r.day} · {r.label}</strong><label>Lunch<select aria-label={r.day+' lunch'} value={r.lunchWave??''} onChange={e=>patch(r.id,{lunchWave:e.target.value?Number(e.target.value) as 1|2|3:undefined,lunchSure:true})}>{([1,2,3] as const).map(w=><option key={w} value={w}>{['1st','2nd','3rd'][w-1]} lunch · {classTime(bells.lunch!.waves[w][0])}–{classTime(bells.lunch!.waves[w][1])}</option>)}<option value="">No lunch shown</option></select></label>{r.lunchWave&&!r.lunchSure&&<small className="wb-muted">Guessed. Pick the right one.</small>}</div>)}</fieldset>}
 {problems.length>0&&<ul className="period-problems" aria-label="Check these days">{problems.map(p=><li key={p}>{p}</li>)}</ul>}
 {!!rows.length&&<>{untimed>0&&<p className="wb-muted">{untimed} selected class{untimed===1?' needs':'es need'} a start and end time before you continue.</p>}<button className="primary" disabled={!rows.some(r=>r.include)||busy||untimed>0} onClick={add}>Continue to calendar preview</button></>}
 </section>
}
