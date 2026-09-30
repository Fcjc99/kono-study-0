import {useEffect,useRef,useState} from 'react'
import type {StudySeason} from '../store/model'
import {buildRotationWeek,classesFromRows,classesFromWeek,duxburyLunchWave,rotationGrid,type BellSchedule,type LunchWave,type RotationClass} from '../store/bellSchedules'
import {classTime} from '../store/classSchedule'
import {useAiHelper} from '../hooks/useAiHelper'
import {AiHelperSettings} from './AiHelper'
import {reportError} from '../store/errorReporter'

const blank=(n:number):RotationClass[]=>Array.from({length:n},()=>({label:'',location:'',lunchWave:3}))

/** A school where the same classes rotate through the periods in order (Duxbury High: 7 classes, 5 a
 * day). The student gives their classes once, from their schedule or by hand, and every rotation day
 * is built from them. */
export default function RotatingClasses({season,bells,change,onReview}:{season:StudySeason;bells:BellSchedule;change:(s:StudySeason)=>void;onReview:()=>void}){
 const count=bells.classes!,cycle=season.school!.cycle,grid=rotationGrid(bells,cycle.length)
 const [classes,setClasses]=useState<RotationClass[]>(()=>{const saved=classesFromWeek(season,bells);return saved.some(c=>c.label)?saved.map(c=>({label:c.label,location:c.location,lunchWave:c.lunchWave??duxburyLunchWave(c.label).wave})):blank(count)})
 const [guessed,setGuessed]=useState<boolean[]>(()=>Array(count).fill(false))
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[conflicts,setConflicts]=useState<string[]>([]),[error,setError]=useState(''),[tried,setTried]=useState(false)
 const ai=useAiHelper(season.profileId),cancel=useRef<AbortController|null>(null)
 useEffect(()=>()=>cancel.current?.abort(),[])
 const set=(i:number,p:Partial<RotationClass>)=>{setClasses(classes.map((c,j)=>j===i?{...c,...p}:c));if(p.lunchWave)setGuessed(guessed.map((g,j)=>j===i?false:g))}
 const rename=(i:number,label:string)=>{const guess=duxburyLunchWave(label);setClasses(classes.map((c,j)=>j===i?{...c,label,lunchWave:guess.wave}:c));setGuessed(guessed.map((g,j)=>j===i?!guess.sure:g))}
 const lunchPeriod=bells.lunch?.period,after=bells.after
 const read=async(file:File)=>{
  if(busy)return
  setTried(true)
  const controller=new AbortController();cancel.current=controller
  setBusy(true);setError('');setConflicts([]);setMessage('Reading your schedule…')
  try{
   const reader=await import('../store/readSchedulePdf'),{readClassScheduleWithAi}=await import('../store/aiClassSchedule')
   const pdf=/\.pdf$/i.test(file.name)
   // A picture-only PDF (or a photo) goes to the AI as the picture; a PDF with text goes as its text.
   const picture=pdf?await reader.pdfPageImage(file):{base64:await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]??'');r.onerror=()=>reject(new Error('Could not read that photo.'));r.readAsDataURL(file)}),mimeType:file.type||'image/jpeg'}
   const text=picture?undefined:await reader.readSchedulePdf(file,1,2,controller.signal,setMessage,false,true)
   setMessage('Asking KONO’s AI to find your classes…')
   const rows=await readClassScheduleWithAi({text,photo:picture??undefined},cycle,season.start,season.school!.lastClassDate||season.end,ai.provider,ai.apiKey,bells.periods.length)
   const found=classesFromRows(rows,cycle,bells)
   if(!found.classes.some(c=>c.label))throw Error('KONO couldn’t match the classes to days and periods. Type your '+count+' classes below instead.')
   setClasses(found.classes.map((c,i)=>{const guess=duxburyLunchWave(c.label);return {label:c.label||classes[i].label,location:c.location||classes[i].location,lunchWave:guess.wave}}))
   setGuessed(found.classes.map(c=>!duxburyLunchWave(c.label).sure))
   setConflicts(found.conflicts)
   const empty=found.classes.filter(c=>!c.label).length
   // Tell KONO support when a schedule is only partly read: the school and counts, never the classes.
   if(empty)reportError('Rotating-school upload found only '+(count-empty)+' of '+count+' classes',{detail:'File: '+(pdf?'PDF':'photo')+' · school: '+season.school!.name})
   setMessage('Found '+(count-empty)+' of your '+count+' classes. Check each one against your schedule'+(empty?' and fill in the missing '+(empty===1?'one':'ones'):'')+', then build your days.')
  }catch(e){
   const why=e instanceof Error?e.message:'Could not read this schedule.'
   setMessage('');setError(why)
   if(/found no classes|couldn’t match/i.test(why))reportError('Rotating-school upload found no classes',{detail:'File: '+(/\.pdf$/i.test(file.name)?'PDF':'photo')+' · school: '+season.school!.name})
  }finally{setBusy(false)}
 }
 const build=()=>{
  setError('')
  try{
   const hasClasses=Object.values(season.week).some(v=>v.length)
   if(hasClasses&&!window.confirm('Replace the classes on all '+cycle.length+' days with these '+count+'? Notes on the old classes are removed.'))return
   change(buildRotationWeek(season,classes));onReview()
  }catch(e){setError(e instanceof Error?e.message:'Check your classes.')}
 }
 const name=(n:number)=>classes[n-1]?.label.trim()||'Class '+n
 return <section className="rotating-classes" aria-label="Your classes">
  <h3>Your {count} classes</h3>
  <p>{season.school!.name} has {bells.periods.length} blocks a day and your {count} classes take turns in order: Day 1 is classes {grid[0].join('-')}, Day 2 is {grid[1].join('-')}, and so on. Enter your classes once and KONO builds all {cycle.length} days, with lunch{after?' and '+after.label:''}.</p>
  <div className="wb-record">
   <strong>Read them from your schedule</strong>
   <p className="wb-muted">A PDF or photo of your schedule. It goes to KONO’s AI to find your classes; it isn’t saved. Crop out anything personal first.</p>
   <label className="schedule-upload">Upload my schedule<small>PDF, photo or screenshot</small><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={e=>{const picked=e.target.files?.[0]??null;e.target.value='';setFile(picked);setTried(false);setMessage('');setError('');if(picked&&ai.ready)void read(picked)}}/></label>
   {!ai.ready?<details><summary>Set up the AI helper to read your schedule</summary><AiHelperSettings profileId={season.profileId}/></details>:file&&!tried&&<button type="button" disabled={busy} onClick={()=>void read(file)}>Find my classes</button>}
   {message&&<p role="status">{message}</p>}
   {conflicts.length>0&&<ul className="period-problems" aria-label="Check these classes">{conflicts.map(c=><li key={c}>{c}</li>)}</ul>}
  </div>
  <ol className="rotating-class-list">{classes.map((c,i)=><li key={i} className="period-times-row">
   <strong>Class {i+1}</strong>
   <label>Name<input aria-label={'Class '+(i+1)+' name'} maxLength={200} value={c.label} placeholder={i===0?'e.g. Chemistry I':'Class name, or Free'} onChange={e=>rename(i,e.target.value)}/></label>
   <label>Room / teacher<input aria-label={'Class '+(i+1)+' room'} maxLength={160} value={c.location} onChange={e=>set(i,{location:e.target.value})}/></label>
   {bells.lunch&&<label>Lunch<select aria-label={'Class '+(i+1)+' lunch'} value={c.lunchWave} onChange={e=>set(i,{lunchWave:Number(e.target.value) as LunchWave})}>{([1,2,3] as const).map(w=><option key={w} value={w}>{['1st','2nd','3rd'][w-1]} · {classTime(bells.lunch!.waves[w][0])}</option>)}</select></label>}
   {guessed[i]&&c.label.trim()&&<small className="wb-muted">Lunch guessed. Pick the right one.</small>}
  </li>)}</ol>
  {bells.lunch&&<p className="wb-muted">Lunch is during Block {lunchPeriod}, so each class’s lunch is used on the days it’s in Block {lunchPeriod}. It’s guessed from the department (1st for science, math and technology, 2nd for history and languages, 3rd for everything else); change any that are wrong.</p>}
  <div className="rotation-grid-wrap"><table className="rotation-grid"><caption>Your days</caption><thead><tr><th scope="col">Day</th>{bells.periods.map(([start],p)=><th scope="col" key={p}>Block {p+1}<small>{classTime(start)}</small></th>)}</tr></thead>
   <tbody>{grid.map((row,d)=><tr key={d}><th scope="row">{cycle[d]}</th>{row.map((n,p)=><td key={p}>{name(n)}{bells.lunch&&p+1===lunchPeriod&&classes[n-1]?<small>Lunch {classes[n-1].lunchWave}</small>:null}{after&&p+1===after.period?<small>+ {after.label}</small>:null}</td>)}</tr>)}</tbody></table></div>
  {error&&<p role="alert">{error}</p>}
  <button type="button" className="primary" disabled={busy} onClick={build}>Build all {cycle.length} days</button>
 </section>
}
