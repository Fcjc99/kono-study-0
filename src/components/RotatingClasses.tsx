import {Fragment,useEffect,useRef,useState} from 'react'
import type {StudySeason} from '../store/model'
import {buildRotationWeek,classesFromRows,classesFromWeek,duxburyLunchWave,ownClassFromWeek,rotationGrid,type BellSchedule,type LunchWave,type RotationClass} from '../store/bellSchedules'
import {classTime} from '../store/classSchedule'
import {useAiHelper} from '../hooks/useAiHelper'
import {AiHelperSettings} from './AiHelper'
import {reportError} from '../store/errorReporter'

const blank=(n:number,wave:LunchWave=3):RotationClass[]=>Array.from({length:n},()=>({label:'',location:'',lunchWave:wave}))

/** A school where the same classes rotate through the periods (Duxbury High: 7 classes in order, 5 a day;
 * Duxbury Middle: periods 1a–7b on its rotation table, 5 a day, plus ASP). The student gives their classes
 * once, from their schedule or by hand, and every rotation day is built from them. At Duxbury Middle each
 * period is usually the same class on its a and b days; the ones that alternate get a second class. */
export default function RotatingClasses({season,bells,change,onReview}:{season:StudySeason;bells:BellSchedule;change:(s:StudySeason)=>void;onReview:()=>void}){
 const count=bells.classes!,cycle=season.school!.cycle,grid=rotationGrid(bells,cycle.length),keys=bells.keys,paired=!!keys
 const guessWave=(label:string)=>bells.lunchByDepartment?duxburyLunchWave(label):{wave:1 as LunchWave,sure:false}
 const [classes,setClasses]=useState<RotationClass[]>(()=>{const saved=classesFromWeek(season,bells);return saved.some(c=>c.label)?saved.map(c=>({label:c.label,location:c.location,lunchWave:c.lunchWave??guessWave(c.label).wave})):blank(count,bells.lunchByDepartment?3:1)})
 // Duxbury Middle: which periods meet as a different class on their b days, and the ASP class.
 const [split,setSplit]=useState<boolean[]>(()=>paired?Array.from({length:count/2},(_,k)=>{const a=classes[2*k],b=classes[2*k+1];return !!b?.label&&b.label.trim().toLowerCase()!==a.label.trim().toLowerCase()}):[])
 const [own,setOwn]=useState(()=>bells.own?ownClassFromWeek(season,bells)??{label:bells.own.name,location:''}:undefined)
 // An unsplit period's b meeting is the same class as its a meeting.
 const expanded=()=>paired?classes.map((c,i)=>i%2&&!split[(i-1)/2]?{...classes[i-1]}:c):classes
 const [guessed,setGuessed]=useState<boolean[]>(()=>Array(count).fill(false))
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[conflicts,setConflicts]=useState<string[]>([]),[error,setError]=useState(''),[tried,setTried]=useState(false)
 const ai=useAiHelper(season.profileId),cancel=useRef<AbortController|null>(null)
 useEffect(()=>()=>cancel.current?.abort(),[])
 const set=(i:number,p:Partial<RotationClass>)=>{setClasses(classes.map((c,j)=>j===i?{...c,...p}:c));if(p.lunchWave)setGuessed(guessed.map((g,j)=>j===i?false:g))}
 const rename=(i:number,label:string)=>{const guess=guessWave(label);setClasses(classes.map((c,j)=>j===i?{...c,label,lunchWave:guess.wave}:c));setGuessed(guessed.map((g,j)=>j===i?!guess.sure:g))}
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
   const rows=await readClassScheduleWithAi({text,photo:picture??undefined},cycle,season.start,season.school!.lastClassDate||season.end,ai.provider,ai.apiKey,bells.periods.length,bells.extraRows)
   const found=classesFromRows(rows,cycle,bells)
   if(!found.classes.some(c=>c.label))throw Error('KONO couldn’t match the classes to days and periods. Type your '+count+' classes below instead.')
   const next=found.classes.map((c,i)=>{const guess=guessWave(c.label);return {label:c.label||classes[i].label,location:c.location||classes[i].location,lunchWave:guess.wave}})
   setClasses(next)
   setGuessed(found.classes.map(c=>bells.lunchByDepartment?!guessWave(c.label).sure:false))
   if(paired)setSplit(split.map((_,k)=>!!next[2*k+1].label&&next[2*k+1].label.trim().toLowerCase()!==next[2*k].label.trim().toLowerCase()))
   const ownRow=bells.own&&rows.find(r=>r.slot===bells.own!.label&&r.label.trim());if(ownRow)setOwn({label:ownRow.label,location:ownRow.location??''})
   setConflicts(found.conflicts)
   const empty=found.classes.filter(c=>!c.label).length
   // Tell KONO support when a schedule is only partly read: the school and counts, never the classes.
   if(empty)reportError('Rotating-school upload found only '+(count-empty)+' of '+count+' classes',{detail:'File: '+(pdf?'PDF':'photo')+' · school: '+season.school!.name})
   // Duxbury Middle counts periods (a period is found when its a meeting is).
   const total=paired?count/2:count,missed=paired?Array.from({length:total},(_,k)=>!found.classes[2*k].label).filter(Boolean).length:empty
   setMessage('Found '+(total-missed)+' of your '+total+(paired?' periods':' classes')+'. Check each one against your schedule'+(missed?' and fill in the missing '+(missed===1?'one':'ones'):'')+', then build your days.')
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
   if(hasClasses&&!window.confirm('Replace the classes on all '+cycle.length+' days with '+(paired?'these':'these '+count)+'? Notes on the old classes are removed.'))return
   change(buildRotationWeek(season,expanded(),own));onReview()
  }catch(e){setError(e instanceof Error?e.message:'Check your classes.')}
 }
 const name=(n:number)=>expanded()[n-1]?.label.trim()||(paired?'Period '+keys![n-1]:'Class '+n)
 const wave=(n:number)=>expanded()[n-1]?.lunchWave
 const lunchSelect=(i:number,aria:string)=><label>Lunch<select aria-label={aria} value={classes[i].lunchWave} onChange={e=>set(i,{lunchWave:Number(e.target.value) as LunchWave})}>{([1,2,3] as const).map(w=><option key={w} value={w}>{['1st','2nd','3rd'][w-1]} · {classTime(bells.lunch!.waves[w][0])}</option>)}</select></label>
 const classRow=(i:number,aria:string,placeholder:string)=><>
  <label>Name<input aria-label={aria+' name'} maxLength={200} value={classes[i].label} placeholder={placeholder} onChange={e=>rename(i,e.target.value)}/></label>
  <label>Room / teacher<input aria-label={aria+' room'} maxLength={160} value={classes[i].location} onChange={e=>set(i,{location:e.target.value})}/></label>
  {bells.lunch&&lunchSelect(i,aria+' lunch')}
  {guessed[i]&&classes[i].label.trim()&&<small className="wb-muted">Lunch guessed. Pick the right one.</small>}
 </>
 const ownAfter=bells.own?bells.periods.findIndex(([start])=>start>bells.own!.start):-1
 return <section className="rotating-classes" aria-label="Your classes">
  <h3>{paired?'Your '+count/2+' periods':'Your '+count+' classes'}</h3>
  {paired?<p>{season.school!.name} has {bells.periods.length} blocks a day{bells.own?' and '+bells.own.label+' ('+classTime(bells.own.start)+'–'+classTime(bells.own.end)+')':''}. Your {count/2} periods take turns through the blocks over {cycle.length} days, each meeting on an “a” day and a “b” day: Day 1 is {bells.rotation![0].join('-')}, Day 2 is {bells.rotation![1].join('-')}, and so on. Most periods are the same class on both; if one alternates (Chorus on 6a, STEM on 6b), tick it and add its b-day class. KONO builds all {cycle.length} days, with lunch{bells.own?' and '+bells.own.label:''}.</p>
  :<p>{season.school!.name} has {bells.periods.length} blocks a day and your {count} classes take turns in order: Day 1 is classes {grid[0].join('-')}, Day 2 is {grid[1].join('-')}, and so on. Enter your classes once and KONO builds all {cycle.length} days, with lunch{after?' and '+after.label:''}.</p>}
  <div className="wb-record">
   <strong>Read them from your schedule</strong>
   <p className="wb-muted">A PDF or photo of your schedule. It goes to KONO’s AI to find your classes; it isn’t saved. Crop out anything personal first.</p>
   <label className="schedule-upload">Upload my schedule<small>PDF, photo or screenshot</small><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={e=>{const picked=e.target.files?.[0]??null;e.target.value='';setFile(picked);setTried(false);setMessage('');setError('');if(picked&&ai.ready)void read(picked)}}/></label>
   {!ai.ready?<details><summary>Set up the AI helper to read your schedule</summary><AiHelperSettings profileId={season.profileId}/></details>:file&&!tried&&<button type="button" disabled={busy} onClick={()=>void read(file)}>Find my classes</button>}
   {message&&<p role="status">{message}</p>}
   {conflicts.length>0&&<ul className="period-problems" aria-label="Check these classes">{conflicts.map(c=><li key={c}>{c}</li>)}</ul>}
  </div>
  {paired?<ol className="rotating-class-list">{split.map((isSplit,k)=><li key={k} className="period-times-row">
   <strong>Period {k+1}{isSplit?'a':''}</strong>
   {classRow(2*k,'Period '+(k+1),k===0?'e.g. Literacy/Writing':'Class name, or Free')}
   <label className="wb-check"><input type="checkbox" checked={isSplit} onChange={e=>{setSplit(split.map((v,j)=>j===k?e.target.checked:v));if(e.target.checked&&classes[2*k+1].label.trim().toLowerCase()===classes[2*k].label.trim().toLowerCase())set(2*k+1,{label:'',location:''})}}/>Different class on {k+1}b days</label>
   {isSplit&&<><strong>Period {k+1}b</strong>{classRow(2*k+1,'Period '+(k+1)+'b','e.g. STEM 6')}</>}
  </li>)}
   {bells.own&&own&&<li className="period-times-row"><strong>{bells.own.label} · {classTime(bells.own.start)}</strong><label>Name<input aria-label={bells.own.label+' name'} maxLength={200} value={own.label} onChange={e=>setOwn({...own,label:e.target.value})}/></label><label>Room / teacher<input aria-label={bells.own.label+' room'} maxLength={160} value={own.location} onChange={e=>setOwn({...own,location:e.target.value})}/></label></li>}
  </ol>
  :<ol className="rotating-class-list">{classes.map((_,i)=><li key={i} className="period-times-row">
   <strong>Class {i+1}</strong>
   {classRow(i,'Class '+(i+1),i===0?'e.g. Chemistry I':'Class name, or Free')}
  </li>)}</ol>}
  {bells.lunch&&(bells.lunchByDepartment?<p className="wb-muted">Lunch is during Block {lunchPeriod}, so each class’s lunch is used on the days it’s in Block {lunchPeriod}. It’s guessed from the department (1st for science, math and technology, 2nd for history and languages, 3rd for everything else); change any that are wrong.</p>
   :<p className="wb-muted">Lunch is during Block {lunchPeriod} ({bells.lunch&&([1,2,3] as const).map(w=>['1st','2nd','3rd'][w-1]+' '+classTime(bells.lunch!.waves[w][0])).join(', ')}). Pick each period’s lunch, used on the days it’s in Block {lunchPeriod}; if your lunch is always the same, pick it for all of them.</p>)}
  <div className="rotation-grid-wrap"><table className="rotation-grid"><caption>Your days</caption><thead><tr><th scope="col">Day</th>{bells.periods.map(([start],p)=><Fragment key={p}>{p===ownAfter&&bells.own&&<th scope="col">{bells.own.label}<small>{classTime(bells.own.start)}</small></th>}<th scope="col">Block {p+1}<small>{classTime(start)}</small></th></Fragment>)}</tr></thead>
   <tbody>{grid.map((row,d)=><tr key={d}><th scope="row">{cycle[d]}</th>{row.map((n,p)=><Fragment key={p}>{p===ownAfter&&bells.own&&<td>{own?.label.trim()||bells.own.name}</td>}<td>{paired&&<small className="rotation-key">{keys![n-1]}</small>}{name(n)}{bells.lunch&&p+1===lunchPeriod&&wave(n)?<small>Lunch {wave(n)}</small>:null}{after&&p+1===after.period?<small>+ {after.label}</small>:null}</td></Fragment>)}</tr>)}</tbody></table></div>
  {error&&<p role="alert">{error}</p>}
  <button type="button" className="primary" disabled={busy} onClick={build}>Build all {cycle.length} days</button>
 </section>
}
