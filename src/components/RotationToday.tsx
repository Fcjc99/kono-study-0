import {useEffect,useState} from 'react'
import type {AppData,Kid} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {classTime} from '../store/classSchedule'
import {correctRotation,rotationNow,type BlockNow} from '../store/rotationToday'

const inWords=(m:number)=>m<60?m+' min':Math.floor(m/60)+' h'+(m%60?' '+m%60+' min':'')
const what=(b:BlockNow)=>(b.slot&&/^(Period|Block) /.test(b.slot)?b.slot.replace('Period','Block')+' · ':'')+b.label

/** Home › Today at a rotation school: the rotation day, the block going on now or next (with a
 * countdown), and "Not Day 7?" to fix the day if the school's count is different. Parents see one line
 * for each kid's school. Updates every half minute. */
export default function RotationToday({data,save,today,kids,onOpenClass}:{data:AppData;save:PlannerRepository['update'];today:string;kids:Kid[];onOpenClass?:(label:string)=>void}){
 const [now,setNow]=useState(()=>new Date()),[fixing,setFixing]=useState(''),[picked,setPicked]=useState(''),[error,setError]=useState('')
 useEffect(()=>{const t=window.setInterval(()=>setNow(new Date()),30000);return()=>window.clearInterval(t)},[])
 const rows=rotationNow(data,now)
 if(!rows.length)return null
 const fix=async(seasonId:string)=>{
  setError('')
  try{const ok=await save(d=>({...d,studySeasons:d.studySeasons.map(s=>s.id===seasonId?correctRotation(s,today,picked):s)}));if(ok){setFixing('');setPicked('')}}
  catch(e){setError(e instanceof Error?e.message:'Could not change the rotation day.')}
 }
 return <div className="rotation-today" role="group" aria-label="Today at school">{rows.map(r=>{
  const kid=kids.find(k=>k.id===r.kidId),who=kid?(kid.emoji?kid.emoji+' ':'')+kid.name:''
  return <div key={r.season.id} className={'rotation-today-row'+(r.now?' is-in-class':'')} style={kid?{borderColor:kid.color}:undefined}>
   <div className="rotation-today-day"><small>{who||r.season.school!.name}</small><strong>{r.closed?'No school':r.cycleDay}</strong></div>
   <div className="rotation-today-now">
    {r.closed?<span>{r.label}{r.tomorrow?' · next school day is '+r.tomorrow:''}</span>
     :r.now?<><span className="rotation-today-tag">Now</span> <button type="button" className="rotation-today-class" onClick={()=>onOpenClass?.(r.now!.label)}>{what(r.now)}</button> <small>until {classTime(r.now.end)}</small>{r.next&&<small className="rotation-today-then"> · then {what(r.next)} at {classTime(r.next.start)}</small>}</>
     :r.next?<><span className="rotation-today-tag">Next</span> <button type="button" className="rotation-today-class" onClick={()=>onOpenClass?.(r.next!.label)}>{what(r.next)}</button> <small>at {classTime(r.next.start)} · in {inWords(r.minutesToNext!)}</small></>
     :r.done?<span>School’s done for today{r.tomorrow?' · tomorrow is '+r.tomorrow:''}</span>
     :<span>No classes set up for {r.cycleDay} yet</span>}
   </div>
   {!r.closed&&r.cycleDay&&(fixing===r.season.id
    ?<div className="rotation-today-fix"><label>Today is<select aria-label={'Rotation day today'+(who?' for '+who:'')} value={picked} onChange={e=>setPicked(e.target.value)}><option value="">Choose…</option>{r.season.school!.cycle.map(d=><option key={d} value={d}>{d}</option>)}</select></label><button type="button" className="primary" disabled={!picked||picked===r.cycleDay} onClick={()=>void fix(r.season.id)}>Set</button><button type="button" onClick={()=>{setFixing('');setPicked('')}}>Cancel</button></div>
    :<button type="button" className="rotation-today-wrong" onClick={()=>{setFixing(r.season.id);setPicked('')}}>Not {r.cycleDay}?</button>)}
  </div>})}
  {error&&<p role="alert">{error}</p>}
 </div>
}
