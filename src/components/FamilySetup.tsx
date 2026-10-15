import {useState,type CSSProperties,type FormEvent} from 'react'
import {uid,peopleOf,type AppData,type CalendarEvent,type Kid} from '../store/model'
import {nextKidColor} from '../store/kids'
import {parseQuickEvent} from '../store/quickAdd'
import {repeatCopy,weekdayDates} from '../store/eventRepeat'
import {classTime} from '../store/classSchedule'
import type {PlannerRepository} from '../store/repository'
import Modal from './Modal'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
type Line={text:string;kidId:string}
const EXAMPLES=['soccer every Tue and Thu 4pm','piano every Wed 4:30pm','swim every Sat 9-10am','scouts every Mon 6:30pm']

/** Family setup in about two minutes: the kids' names, then each one's weekly activities typed in plain
 * words ("soccer every Tue and Thu 4pm"), then where to go next. Everything is saved at the end, at once. */
export default function FamilySetup({data,profileId,today,save,close,next}:{data:AppData;profileId:string;today:string;save:PlannerRepository['update'];close:()=>void;next:{schools:()=>void;birthdays:()=>void;wall:()=>void;share:()=>void}}){
 const existing=data.kids.filter(k=>k.profileId===profileId)
 const [step,setStep]=useState(existing.length?2:1),[kids,setKids]=useState<Kid[]>(existing),[name,setName]=useState('')
 const [lines,setLines]=useState<Line[]>([]),[drafts,setDrafts]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState('')
 const newKids=kids.filter(k=>!existing.some(e=>e.id===k.id))
 const addKid=(e:FormEvent)=>{e.preventDefault();const n=name.trim();if(!n)return;if(kids.some(k=>k.name.toLowerCase()===n.toLowerCase())){setError(n+' is already here.');return}setError('');setKids([...kids,{id:uid('kid'),profileId,name:n.slice(0,200),color:nextKidColor(kids)}]);setName('')}
 // Read as this kid's, so a one-off like "choir Thursday 4pm" counts as an event too.
 const read=(text:string,kidId:string)=>{const k=kids.find(x=>x.id===kidId);return parseQuickEvent((k?k.name+' ':'')+text,today,k?[{id:k.id,name:k.name}]:[])}
 const parse=(l:Line)=>read(l.text,l.kidId)
 const addLine=(kidId:string)=>{const text=(drafts[kidId]??'').trim();if(!text)return;if(!read(text,kidId)?.event){setError('Add a day or time, like “piano every Wed 4pm”.');return}setError('');setLines([...lines,{text,kidId}]);setDrafts({...drafts,[kidId]:''})}
 const finish=async()=>{
  setBusy(true);setError('')
  const events:CalendarEvent[]=[]
  for(const l of lines){
   const g=parse(l);if(!g?.event)continue
   const recurringId=g.event.repeatDays.length?uid('recurring'):undefined
   const base:CalendarEvent={id:uid('event'),profileId,date:g.due,title:g.title,kind:g.event.kind,notes:'',done:false,kidId:l.kidId,...(g.time?{time:g.time}:{}),...(g.event.endTime?{endTime:g.event.endTime}:{}),...(g.event.location?{location:g.event.location}:{}),...(recurringId?{recurringId}:{})}
   events.push(base,...weekdayDates(g.due,g.event.repeatDays,g.event.until).map(date=>repeatCopy(base,date,recurringId!)))
  }
  const ok=await save(d=>({...d,settings:{...d.settings,parentMode:true},kids:[...d.kids,...newKids],calendarEvents:[...d.calendarEvents,...events]}))
  setBusy(false)
  if(!ok){setError('Not saved yet. Try again.');return}
  try{localStorage.removeItem('kono-family-setup')}catch{/* best effort */}
  const n=lines.length,parts=[...(newKids.length?[newKids.length+' kid'+(newKids.length===1?'':'s')]:[]),...(n?[n+' activit'+(n===1?'y':'ies')+(events.length>n?' ('+events.length+' dates on the calendar)':'')]:[])]
  setDone(parts.length?parts.join(' and ')+' added.':'Nothing new added.');setStep(3)
 }
 return <Modal title="Set up your family" close={close}><div className="family-setup">
  <ol className="family-setup-steps" aria-label="Steps">{['Kids','Activities','Done'].map((s,i)=><li key={s} aria-current={step===i+1?'step':undefined}>{s}</li>)}</ol>
  {step===1&&<>
   <h3>Who are the kids?</h3>
   <form className="family-setup-add" onSubmit={addKid}><label>Kid’s name<input value={name} maxLength={200} onChange={e=>setName(e.target.value)} placeholder="Emma" autoFocus/></label><button type="submit">Add</button></form>
   {kids.length>0&&<ul className="family-setup-kids" aria-label="Kids">{kids.map(k=><li key={k.id} style={{'--kid-color':k.color} as CSSProperties}><span>{k.name}</span>{!existing.some(e=>e.id===k.id)&&<button type="button" className="link-button" aria-label={'Remove '+k.name} onClick={()=>setKids(kids.filter(x=>x.id!==k.id))}>Remove</button>}</li>)}</ul>}
   {error&&<p role="alert">{error}</p>}
   <div className="wb-toolbar"><button type="button" className="primary" disabled={!kids.length} onClick={()=>{setError('');setStep(2)}}>Next</button></div>
  </>}
  {step===2&&<>
   <h3>What do they do each week?</h3>
   <p className="wb-muted">Type each activity in plain words, then press Add. Try “soccer every Tue and Thu 4-5:30pm at Riverside Park” or “piano every Wed 4pm”. You can skip this.</p>
   {kids.map((k,ki)=><section key={k.id} className="family-setup-kid" style={{'--kid-color':k.color} as CSSProperties} aria-label={k.name+'’s activities'}>
    <h4>{k.name}</h4>
    {(()=>{const have=[...new Map(data.calendarEvents.filter(e=>e.profileId===profileId&&e.date>=today&&peopleOf(e).includes(k.id)).map(e=>[e.recurringId??e.id,e.title])).values()].slice(0,6);return have.length?<p className="wb-muted family-setup-have">Already on the calendar: {have.join(', ')}</p>:null})()}
    <ul>{lines.map((l,i)=>({l,i})).filter(x=>x.l.kidId===k.id).map(({l,i})=>{const g=parse(l)!;return <li key={i}><span><strong>{g.title}</strong> · {g.event?.repeatLabel??niceDate(g.due)}{g.time?' · '+classTime(g.time)+(g.event?.endTime?'–'+classTime(g.event.endTime):''):''}{g.event?.location?' · 📍 '+g.event.location:''}</span><button type="button" className="link-button" aria-label={'Remove '+g.title+' for '+k.name} onClick={()=>setLines(lines.filter((_,j)=>j!==i))}>Remove</button></li>})}</ul>
    <form className="family-setup-add" onSubmit={e=>{e.preventDefault();addLine(k.id)}}><label>Add an activity for {k.name}<input value={drafts[k.id]??''} onChange={e=>setDrafts({...drafts,[k.id]:e.target.value})} placeholder={EXAMPLES[ki%EXAMPLES.length]} autoComplete="off"/></label><button type="submit">Add</button></form>
   </section>)}
   {error&&<p role="alert">{error}</p>}
   <div className="wb-toolbar"><button type="button" onClick={()=>setStep(1)}>{existing.length?'Add another kid':'Back'}</button><button type="button" className="primary" disabled={busy} onClick={()=>void finish()}>{busy?'Saving…':'Finish'}</button></div>
  </>}
  {step===3&&<>
   <h3>All set! 🎉</h3>
   {done&&<p role="status">{done}</p>}
   <p className="wb-muted">A few more things you might want, any time:</p>
   <div className="family-setup-next">
    <button type="button" onClick={next.schools}>🏫 Add school schedules</button>
    <button type="button" onClick={next.birthdays}>🎂 Add birthdays</button>
    <button type="button" onClick={next.wall}>📺 Try the wall display</button>
    <button type="button" onClick={next.share}>👵 Share with grandparents</button>
   </div>
   <div className="wb-toolbar"><button type="button" className="primary" onClick={close}>Done</button></div>
  </>}
 </div></Modal>
}
