import {useMemo,useState} from 'react'
import {localDate,normalizeData,type AppData} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {classTime} from '../store/classSchedule'
import {useAiHelper} from '../hooks/useAiHelper'
import {useLocalSetting} from '../hooks/useLocalSetting'
import {applyWeekPlan,clearUpcomingPlanned,defaultWeekPlanOptions,freeSlots,planWeekSimple,planWeekWithAi,unplanned,upcomingPlanned,weekWork,type WeekPlanOptions,type WeekSession,type WeekWork} from '../store/weekPlan'

const dayLabel=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})
const shortDay=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})
const clockNow=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
const limits=[60,90,120,150,180,240]
const hours=(m:number)=>m%60?(m/60).toFixed(1).replace(/\.0$/,'')+' h':m/60+' h'
function readOptions(raw:string):WeekPlanOptions{
 try{
  const o=JSON.parse(raw) as Partial<WeekPlanOptions>,d=defaultWeekPlanOptions
  const t=(v:unknown,f:string)=>typeof v==='string'&&/^\d{2}:\d{2}$/.test(v)?v:f
  return {weekday:{from:t(o.weekday?.from,d.weekday.from),to:t(o.weekday?.to,d.weekday.to)},weekend:{from:t(o.weekend?.from,d.weekend.from),to:t(o.weekend?.to,d.weekend.to)},maxPerDay:limits.includes(Number(o.maxPerDay))?Number(o.maxPerDay):d.maxPerDay}
 }catch{return defaultWeekPlanOptions}
}

/** "Plan my week" on the Planner page: study sessions for what's due soon, fitted around classes and
 * events, reviewed before they're added to the Calendar. */
export default function WeekPlanner({data,save}:{data:AppData;save:PlannerRepository['update']}){
 const profileId=data.activeProfileId,today=localDate()
 const {provider,apiKey,ready}=useAiHelper(profileId)
 const [raw,setRaw]=useLocalSetting('kono-week-plan:'+profileId,JSON.stringify(defaultWeekPlanOptions))
 const options=useMemo(()=>readOptions(raw),[raw])
 const setOptions=(next:WeekPlanOptions)=>setRaw(JSON.stringify(next))
 const [plan,setPlan]=useState<{sessions:WeekSession[];work:WeekWork[]}|null>(null)
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('')
 const [receipt,setReceipt]=useState<{before:AppData;after:AppData}|null>(null)
 const earlier=upcomingPlanned(data,today).length
 const make=async()=>{
  if(busy)return;setBusy(true);setError('');setStatus('');setPlan(null);setReceipt(null)
  try{
   const work=weekWork(data,today)
   if(!work.length){setStatus('Nothing due in the next week still needs study time planned. Enjoy it!');return}
   const slots=freeSlots(data,today,clockNow(),options)
   if(!slots.length){setError('There’s no free time in your study hours this week. Widen the hours above and try again.');return}
   let sessions:WeekSession[]=[],byAi=false,note=''
   if(ready){
    setStatus('KONO’s AI is planning your week…')
    try{sessions=await planWeekWithAi(work,slots,options.maxPerDay,today,provider,apiKey);byAi=sessions.length>0}
    catch(e){note=(e instanceof Error?e.message:'The AI couldn’t plan this week.')+' KONO planned it on its own instead.'}
   }
   if(!sessions.length)sessions=planWeekSimple(work,slots,options.maxPerDay)
   if(!sessions.length){setStatus('');setError('KONO couldn’t fit study time before these are due. Try longer study hours or a higher daily limit.');return}
   setPlan({sessions,work})
   setStatus((note?note+' ':'')+sessions.length+' study session'+(sessions.length===1?'':'s')+' planned'+(byAi?' with KONO’s AI':'')+'. Untick any you don’t want, then add them.')
  }catch(e){setStatus('');setError(e instanceof Error?e.message:'Could not plan your week.')}finally{setBusy(false)}
 }
 const chosen=plan?plan.sessions.filter(s=>s.include).length:0
 const add=async()=>{
  if(!plan||busy||!chosen)return;setBusy(true);setError('')
  let before:AppData|undefined,result:ReturnType<typeof applyWeekPlan>|undefined
  try{
   const ok=await save(d=>{before=normalizeData(d);result=applyWeekPlan(d,profileId,plan.sessions,plan.work);return result.data})
   if(ok&&result&&before){setReceipt(result.added?{before,after:result.data}:null);setPlan(null);setStatus(result.added+' study session'+(result.added===1?'':'s')+' added to your Calendar. With lock-screen reminders on, you’ll get a nudge when each one starts.')}
   else setError('Not saved yet. Your plan is still here.')
  }catch(e){setError(e instanceof Error?e.message:'Could not add these sessions.')}finally{setBusy(false)}
 }
 const undo=async()=>{
  if(!receipt||busy)return;setBusy(true)
  try{const ok=await save(d=>{if(JSON.stringify(normalizeData(d))!==JSON.stringify(receipt.after))throw Error('Your plan changed since then. Remove single sessions from the Calendar instead.');return receipt.before});if(ok){setReceipt(null);setStatus('The week plan was undone.')}}
  catch(e){setError(e instanceof Error?e.message:'Could not undo.')}finally{setBusy(false)}
 }
 const clear=async()=>{
  if(busy||!window.confirm('Remove the '+earlier+' upcoming study session'+(earlier===1?'':'s')+' from your earlier week plans? Finished ones are kept.'))return
  setBusy(true);setError('')
  try{if(await save(d=>clearUpcomingPlanned(d,today))){setReceipt(null);setStatus('Earlier planned sessions removed. Tap Plan my week to plan again.')}}
  catch(e){setError(e instanceof Error?e.message:'Could not remove them.')}finally{setBusy(false)}
 }
 const byRef=new Map(plan?.work.map(w=>[w.ref,w])??[])
 const days=plan?[...new Set(plan.sessions.map(s=>s.date))]:[]
 const left=plan?unplanned(plan.work,plan.sessions):[]
 const time=(label:string,value:string,set:(v:string)=>void)=><label>{label}<input type="time" step={900} value={value} onChange={e=>{if(/^\d{2}:\d{2}$/.test(e.target.value))set(e.target.value)}}/></label>
 return <div className="week-planner">
  <p>KONO looks at what’s due in the next week and fits study sessions into the free time around your classes and events. You check the plan before anything is added.</p>
  <fieldset disabled={busy} className="week-planner-hours">
   <legend>When can you study?</legend>
   <div>{time('School days from',options.weekday.from,v=>setOptions({...options,weekday:{...options.weekday,from:v}}))}{time('School days until',options.weekday.to,v=>setOptions({...options,weekday:{...options.weekday,to:v}}))}</div>
   <div>{time('Weekends from',options.weekend.from,v=>setOptions({...options,weekend:{...options.weekend,from:v}}))}{time('Weekends until',options.weekend.to,v=>setOptions({...options,weekend:{...options.weekend,to:v}}))}</div>
   <label>Most study time in a day<select value={options.maxPerDay} onChange={e=>setOptions({...options,maxPerDay:Number(e.target.value)})}>{limits.map(m=><option key={m} value={m}>{hours(m)}</option>)}</select></label>
  </fieldset>
  <div className="wb-toolbar"><button type="button" className="primary" disabled={busy} onClick={()=>void make()}>{busy&&!plan?'Planning…':'✨ Plan my week'}</button>{earlier>0&&<button type="button" disabled={busy} onClick={()=>void clear()}>Clear {earlier} planned session{earlier===1?'':'s'}</button>}</div>
  {!ready&&<p className="wb-muted">Sign in with your email (or add your own AI key under Import &amp; export) for a plan made by KONO’s AI. Without it, KONO plans the soonest-due work first.</p>}
  {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  {receipt&&<button type="button" disabled={busy} onClick={()=>void undo()}>Undo this week plan</button>}
  {plan&&<div className="week-planner-review">
   {days.map(date=><section key={date}><h4>{dayLabel(date)}</h4><ul>{plan.sessions.filter(s=>s.date===date).map(s=>{const w=byRef.get(s.ref);return <li key={s.id}><label className="wb-check"><input type="checkbox" checked={s.include} onChange={e=>setPlan({...plan,sessions:plan.sessions.map(x=>x.id===s.id?{...x,include:e.target.checked}:x)})}/><span><strong>{classTime(s.start)}–{classTime(s.end)}</strong> · {s.title}{w&&<><br/><small className="wb-muted">For {w.title}{w.subject?' · '+w.subject:''} · {w.kind==='exam'?'exam':'due'} {shortDay(w.due)}</small></>}</span></label></li>})}</ul></section>)}
   {left.length>0&&<p className="wb-muted">Didn’t fit this week: {left.map(x=>x.work.title+' (about '+x.left+' min more)').join(', ')}. Longer study hours or a higher daily limit would make room.</p>}
   <button type="button" className="primary" disabled={busy||!chosen} onClick={()=>void add()}>{busy?'Adding…':'Add '+chosen+' session'+(chosen===1?'':'s')+' to my Calendar'}</button>
  </div>}
 </div>
}
