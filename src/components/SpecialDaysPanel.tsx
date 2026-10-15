import {useState,type FormEvent} from 'react'
import {uid,type AppData,type Kid,type SpecialDay} from '../store/model'
import {nextDate,specialIcon,upcomingSpecial,daysAwayLabel} from '../store/specialDays'
import type {PlannerRepository} from '../store/repository'
import Modal from './Modal'

const niceDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})

/** Birthdays & countdowns: add a birthday once (it comes back every year) or a date to count down to
 * ("Disney trip", "Last day of school"). They show on the Planner, Home and the wall display. */
export default function SpecialDaysPanel({data,profileId,kids,today,save,close}:{data:AppData;profileId:string;kids:Kid[];today:string;save:PlannerRepository['update'];close:()=>void}){
 const [kind,setKind]=useState<SpecialDay['kind']>('birthday'),[title,setTitle]=useState(''),[date,setDate]=useState(''),[kidId,setKidId]=useState(''),[emoji,setEmoji]=useState(''),[error,setError]=useState('')
 const mine=(data.specialDays??[]).filter(s=>s.profileId===profileId)
 const soon=upcomingSpecial(data,profileId,today,400)
 const ordered=[...mine].sort((a,b)=>(nextDate(a,today)??'9999').localeCompare(nextDate(b,today)??'9999'))
 const pickKid=(id:string)=>{setKidId(id);const k=kids.find(x=>x.id===id);if(k&&!title.trim())setTitle(k.name)}
 const add=async(e:FormEvent)=>{
  e.preventDefault();setError('')
  const name=title.trim();if(!name||!date){setError(kind==='birthday'?'Add whose birthday it is and the date.':'Add what you’re counting down to and the date.');return}
  if(kind==='countdown'&&date<today){setError('Pick a date that’s still coming up.');return}
  const item:SpecialDay={id:uid('special'),profileId,kind,title:name.slice(0,200),date,...(kind==='birthday'&&kidId?{kidId}:{}),...(emoji.trim()?{emoji:emoji.trim()}:{})}
  if(await save(d=>({...d,specialDays:[...(d.specialDays??[]),item]}))){setTitle('');setDate('');setKidId('');setEmoji('')}else setError('Not saved yet. Try again.')
 }
 const remove=(id:string)=>void save(d=>({...d,specialDays:(d.specialDays??[]).filter(s=>s.id!==id)}))
 return <Modal title="Birthdays & countdowns" close={close}><div className="special-days">
  {soon[0]&&<p className="special-days-next"><span aria-hidden="true">{soon[0].icon}</span> Next up: <strong>{soon[0].label}</strong> · {daysAwayLabel(soon[0].daysAway)}</p>}
  <form className="special-days-add" onSubmit={e=>void add(e)}>
   <div className="calendar-views" role="group" aria-label="Kind">{([['birthday','🎂 Birthday'],['countdown','🎉 Countdown']] as const).map(([k,label])=><button type="button" key={k} aria-pressed={kind===k} onClick={()=>setKind(k)}>{label}</button>)}</div>
   {kind==='birthday'&&kids.length>0&&<label>Whose (optional)<select value={kidId} onChange={e=>pickKid(e.target.value)}><option value="">Someone else</option>{kids.map(k=><option key={k.id} value={k.id}>{(k.emoji?k.emoji+' ':'')+k.name}</option>)}</select></label>}
   <label>{kind==='birthday'?'Name':'What’s coming'}<input value={title} maxLength={200} onChange={e=>setTitle(e.target.value)} placeholder={kind==='birthday'?'Grandma':'Disney trip'}/></label>
   <label>{kind==='birthday'?'Birthday (with the year they were born)':'Date'}<input type="date" value={date} min={kind==='countdown'?today:undefined} onChange={e=>setDate(e.target.value)}/></label>
   {kind==='countdown'&&<label>Emoji (optional)<input value={emoji} maxLength={8} onChange={e=>setEmoji(e.target.value)} placeholder="🏖️"/></label>}
   <button type="submit" className="primary">{kind==='birthday'?'Add birthday':'Add countdown'}</button>
   {error&&<p role="alert">{error}</p>}
  </form>
  {ordered.length>0?<ul className="special-days-list" aria-label="Your birthdays and countdowns">{ordered.map(s=>{const next=nextDate(s,today),away=soon.find(x=>x.day.id===s.id);return <li key={s.id}><span className="special-days-icon" aria-hidden="true">{specialIcon(s)}</span><span><strong>{s.kind==='birthday'?s.title+'’s birthday':s.title}</strong><small>{s.kind==='birthday'?'Born '+niceDate(s.date)+(next?' · next '+niceDate(next):''):niceDate(s.date)}{away?' · '+daysAwayLabel(away.daysAway):next?'':' · passed'}</small></span><button type="button" className="link-button" aria-label={'Remove '+(s.kind==='birthday'?s.title+'’s birthday':s.title)} onClick={()=>remove(s.id)}>Remove</button></li>})}</ul>:<p className="wb-muted">Nothing yet. Birthdays come back every year on their own.</p>}
 </div></Modal>
}
