import {useState} from 'react'
import type {StudySeason} from '../store/model'
import {nextSchoolDate} from '../store/schoolCalendar'
import {bellScheduleFor,duxburyLunchWave,periodNumber,renameClass,switchClass,type LunchWave} from '../store/bellSchedules'
import {classTime} from '../store/classSchedule'

const dayAfter=(iso:string)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)}

/** Change a class after the schedule is made: a semester class that becomes a different class partway
 * through the year (on every rotation day it meets), or a name that needs fixing everywhere. */
export default function ClassChanges({season,change}:{season:StudySeason;change:(s:StudySeason)=>void}){
 const classes=[...new Set(Object.values(season.week).flat().filter(b=>b.kind==='study').map(b=>b.label.trim()))].sort((a,b)=>a.localeCompare(b))
 const semesterEnd=season.school?.exceptions.find(e=>/(first|1st) semester ends|semester 1 ends|end of (the )?first semester/i.test(e.label))?.end
 const suggested=semesterEnd?nextSchoolDate(season,dayAfter(semesterEnd))??'':''
 const bells=bellScheduleFor(season.school)
 const [picked,setPicked]=useState(''),[mode,setMode]=useState<'switch'|'rename'>('switch'),[label,setLabel]=useState(''),[location,setLocation]=useState(''),[from,setFrom]=useState(suggested),[wave,setWave]=useState<LunchWave|''>(''),[message,setMessage]=useState(''),[error,setError]=useState('')
 if(!classes.length)return null
 const inLunch=!!bells?.lunch&&Object.values(season.week).flat().some(b=>b.label.trim()===picked&&periodNumber(b.slot)===bells.lunch!.period)
 const lunch=wave||(label.trim()?duxburyLunchWave(label).wave:'')
 const apply=()=>{
  setError('');setMessage('')
  try{
   if(!picked)throw Error('Choose the class that changes.')
   if(mode==='rename'){change(renameClass(season,picked,label));setMessage(picked+' is now '+label.trim()+' on every day it meets. Review and save to keep it.')}
   else{change(switchClass(season,picked,{label,location,from,lunchWave:inLunch&&lunch?lunch:undefined}));setMessage(label.trim()+' takes '+picked+'’s place from '+from+'. Review and save to keep it.')}
   setPicked('');setLabel('');setLocation('');setWave('')
  }catch(e){setError(e instanceof Error?e.message:'Could not change this class.')}
 }
 return <details className="class-changes-panel"><summary>Change a class (new semester, or fix a name)</summary>
  <div className="class-changes">
   <p className="wb-muted">A semester class that ends partway through the year can be switched for the class that replaces it. It changes on every rotation day it meets, and your notes on the old class stay with it.</p>
   <label>Class that changes<select value={picked} onChange={e=>{setPicked(e.target.value);setError('')}}><option value="">Choose a class</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label>
   <fieldset className="wb-choice-row"><legend>What changes?</legend>
    <label className="wb-check"><input type="radio" name="class-change" checked={mode==='switch'} onChange={()=>setMode('switch')}/>It becomes a different class from a date (like second semester)</label>
    <label className="wb-check"><input type="radio" name="class-change" checked={mode==='rename'} onChange={()=>setMode('rename')}/>Just fix its name everywhere</label>
   </fieldset>
   <label>{mode==='switch'?'New class':'New name'}<input maxLength={200} value={label} onChange={e=>setLabel(e.target.value)}/></label>
   {mode==='switch'&&<>
    <label>New class starts<input type="date" min={season.start} max={season.school?.lastClassDate||season.end} value={from} onInput={e=>setFrom(e.currentTarget.value)}/></label>
    {!semesterEnd&&<p className="wb-muted">Use the first day of second semester from your school’s calendar.</p>}
    <label>Building / room (optional)<input maxLength={160} value={location} onChange={e=>setLocation(e.target.value)}/></label>
    {inLunch&&bells?.lunch&&<label>Lunch with the new class<select value={lunch} onChange={e=>setWave(e.target.value?Number(e.target.value) as LunchWave:'')}>{([1,2,3] as const).map(w=><option key={w} value={w}>{['1st','2nd','3rd'][w-1]} lunch · {classTime(bells.lunch!.waves[w][0])}–{classTime(bells.lunch!.waves[w][1])}</option>)}</select></label>}
   </>}
   <button type="button" disabled={!picked||!label.trim()||(mode==='switch'&&!from)} onClick={apply}>{mode==='switch'?'Switch class':'Rename class'}</button>
   {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  </div>
 </details>
}
