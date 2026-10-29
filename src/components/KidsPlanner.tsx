import {Fragment,lazy,Suspense,useEffect,useRef,useState,type CSSProperties} from 'react'
import type {AppData,Kid,Routine} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {STARTER_ROUTINES,STICKERS,checkOf,pictureFor,routineFrom,sayTime,setSticker,sleepsUntil,stickersOn,tickStep} from '../store/kidPlanner'
import {balance} from '../store/choreStars'
import {classTime} from '../store/classSchedule'
import Avatar from './Avatar'
import KonoSprite from './KonoSprite'
import './kids-planner.css'

const VisualTimer=lazy(()=>import('./VisualTimer'))

/** One thing on the day, whatever it is (event, class, homework, to-do), for the picture schedule. */
export type KidItem={id:string;title:string;time?:string;end?:string;kind?:string;people:string[];done?:boolean;location?:string;open?:()=>void}
type Person={id:string;name:string;color:string;kid?:Kid}

const addDays=(iso:string,n:number)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toLocaleDateString('en-CA')}
const nowClock=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
const speak=(text:string)=>{try{const s=window.speechSynthesis;if(!s)return;s.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.95;u.pitch=1.1;s.speak(u)}catch{/* no voice here */}}
const sayItem=(i:KidItem)=>[sayTime(i.time),i.title,i.location?'at '+i.location:''].filter(Boolean).join(', ')+'.'

/** Planner › 🧸 Kids: the day as pictures, Skylight-style -- a column for each person (the family, then
 * each kid, in their color) with what's on, a KONO "you are here" between done and next, their routines
 * (tap each step; finishing earns stars) and a sticker for the day. Across the top: "sleeps until"
 * countdowns, 🔊 read the day aloud and ⏳ a visual timer. */
export default function KidsPlanner({data,date,today,selectDate,items,kids,familyName,save}:{data:AppData;date:string;today:string;selectDate:(d:string)=>void;items:KidItem[];kids:Kid[];familyName:string;save:PlannerRepository['update']}){
 const pid=data.activeProfileId
 const people:Person[]=[{id:'',name:familyName,color:'#8c7265'},...kids.map(k=>({id:k.id,name:k.name,color:k.color,kid:k}))]
 const [timer,setTimer]=useState(false),[cheer,setCheer]=useState<{who:string;text:string;at:number}|null>(null),[adding,setAdding]=useState(''),[editing,setEditing]=useState('')
 const [clock,setClock]=useState(nowClock)
 useEffect(()=>{const t=window.setInterval(()=>setClock(nowClock()),60000);return()=>window.clearInterval(t)},[])
 const cols=useRef<HTMLDivElement>(null)
 const jump=(id:string)=>cols.current?.querySelector<HTMLElement>('[data-person="'+id+'"]')?.scrollIntoView({behavior:'smooth',inline:'start',block:'nearest'})
 const sleeps=sleepsUntil(data,pid,today)
 const dayName=new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'}),dateText=new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric'})
 const forPerson=(p:Person)=>items.filter(i=>p.id?i.people.includes(p.id):!i.people.length).sort((a,b)=>(a.time??'').localeCompare(b.time??''))
 const routinesOf=(p:Person)=>(data.routines??[]).filter(r=>r.profileId===pid&&(r.kidId??'')===p.id).sort((a,b)=>['morning','afternoon','evening'].indexOf(a.when)-['morning','afternoon','evening'].indexOf(b.when))
 const readDay=()=>{const parts=people.flatMap(p=>{const list=forPerson(p);return list.length?[(p.id?p.name+': ':'')+list.map(sayItem).join(' ')]:[]});speak((date===today?'Today':dayName)+'. '+(parts.join(' ')||'Nothing planned. A free day!'))}
 const tick=(r:Routine,stepId:string,who:string)=>{let earned=0;void save(d=>{const out=tickStep(d,r,date,stepId);earned=out.earned;return out.data},{undoable:false}).then(ok=>{if(ok&&earned){setCheer({who,text:'🎉 '+r.title+' done! +'+earned+'⭐',at:Date.now()});speak('Great job! '+r.title+' is done!')}})}
 const addRoutine=(p:Person,i:number)=>{setAdding('');void save(d=>({...d,routines:[...(d.routines??[]),routineFrom(STARTER_ROUTINES[i],pid,p.id||undefined)]}))}
 const editRoutine=(id:string,change:(r:Routine)=>Routine|null)=>void save(d=>({...d,routines:(d.routines??[]).flatMap(r=>{if(r.id!==id)return [r];const next=change(r);return next?[next]:[]})}))

 return <section className="kids-planner" aria-label="Kids view">
  <header className="kids-planner-top">
   <div className="kids-planner-date">
    <button type="button" aria-label="Previous day" onClick={()=>selectDate(addDays(date,-1))}>‹</button>
    <div><small>{date===today?'Today':date===addDays(today,1)?'Tomorrow':dateText}</small><h3>{dayName}</h3></div>
    <button type="button" aria-label="Next day" onClick={()=>selectDate(addDays(date,1))}>›</button>
    {date!==today&&<button type="button" className="kids-planner-today" onClick={()=>selectDate(today)}>Today</button>}
   </div>
   <div className="kids-planner-tools">
    <button type="button" onClick={readDay}>🔊 Read my day</button>
    <button type="button" onClick={()=>setTimer(true)}>⏳ Timer</button>
   </div>
  </header>
  {sleeps.length>0&&<ul className="kids-sleeps" aria-label="Sleeps until">{sleeps.map(s=><li key={s.label+s.sleeps}><span className="kids-sleeps-icon" aria-hidden="true">{s.icon}</span><div><strong>{s.sleeps} {s.sleeps===1?'sleep':'sleeps'}</strong><small>until {s.label}</small><span className="kids-sleeps-moons" aria-hidden="true">{s.sleeps<=10?'🌙'.repeat(s.sleeps):'🌙'.repeat(10)+' …'}</span></div></li>)}</ul>}
  {people.length>2&&<div className="kids-planner-jump" role="group" aria-label="Jump to">{people.map(p=><button type="button" key={p.id||'family'} style={{'--kid-color':p.color} as CSSProperties} onClick={()=>jump(p.id||'family')}>{p.kid?.emoji??(p.id?p.name[0]:'👪')} {p.name}</button>)}</div>}
  <div className="kids-planner-cols" ref={cols}>{people.map(p=>{
   const list=forPerson(p),routines=routinesOf(p),next=date===today?list.findIndex(i=>(i.end??i.time??'99')>clock&&!i.done):-1
   const sticker=stickersOn(data,pid,date).find(s=>(s.kidId??'')===p.id)
   const card=(i:KidItem)=>{const past=date<today||(date===today&&(i.done||(!!(i.end??i.time)&&(i.end??i.time)!<=clock)))
    return <li key={i.id} className={'kids-card'+(past?' is-past':'')}>
     <button type="button" className="kids-card-main" onClick={i.open} disabled={!i.open}><span className="kids-card-pic" aria-hidden="true">{pictureFor(i.title,i.kind)}</span><span className="kids-card-text"><strong>{i.title}</strong><small>{i.time?classTime(i.time)+(i.end?' – '+classTime(i.end):''):'Any time'}{i.location?' · 📍 '+i.location:''}</small></span>{past&&<span className="kids-card-done" aria-label="Done">✅</span>}</button>
     <button type="button" className="kids-card-say" aria-label={'Read aloud: '+i.title} onClick={()=>speak(sayItem(i))}>🔊</button>
    </li>}
   return <article key={p.id||'family'} data-person={p.id||'family'} className="kids-col" style={{'--kid-color':p.color} as CSSProperties} aria-label={p.name+'’s day'}>
    <header className="kids-col-head">
     <Avatar className="kids-col-face" who={{name:p.name,emoji:p.kid?.emoji??(p.id?undefined:'👪'),photo:p.kid?.photo,color:p.color}}/>
     <strong>{p.name}</strong>
     {p.kid&&<span className="kids-col-stars" aria-label={balance(data.starLog??[],p.kid.id)+' stars'}>⭐ {balance(data.starLog??[],p.kid.id)}</span>}
    </header>
    {cheer?.who===p.id&&<p className="kids-col-cheer" role="status" key={cheer.at}>{cheer.text}</p>}
    {list.length?<ol className="kids-cards">
     {list.map((i,n)=><Fragment key={i.id}>{n===next&&<li className="kids-now" aria-label={'Now. Next up: '+i.title}><KonoSprite size={44} pose="/garden/kono/happy.webp" fallback={<img src="/garden/kono/happy.webp" alt="" width={44}/>}/><span>Now · next up: <b>{i.title}</b></span></li>}{card(i)}</Fragment>)}
    </ol>:<p className="kids-col-empty">🌈 Nothing planned. A free day!</p>}
    <div className="kids-routines">
     {routines.map(r=>{const done=checkOf(data,r.id,date)?.steps??[],all=r.steps.length>0&&r.steps.every(s=>done.includes(s.id))
      return <section key={r.id} className={'kids-routine'+(all?' is-done':'')} aria-label={r.title+' routine'}>
       <header><span aria-hidden="true">{r.emoji}</span><strong>{r.title}</strong><small>{r.steps.filter(s=>done.includes(s.id)).length}/{r.steps.length}{r.kidId&&r.stars?' · '+r.stars+'⭐':''}</small><button type="button" className="kids-routine-edit" aria-label={'Change '+r.title} aria-expanded={editing===r.id} onClick={()=>setEditing(e=>e===r.id?'':r.id)}>✎</button></header>
       {editing===r.id?<div className="kids-routine-editor">
        <label>Stars for finishing<select value={r.stars} onChange={e=>editRoutine(r.id,x=>({...x,stars:Number(e.target.value)}))}>{[0,1,2,3,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        <ul>{r.steps.map(s=><li key={s.id}><span>{s.emoji} {s.title}</span><button type="button" aria-label={'Remove step '+s.title} onClick={()=>editRoutine(r.id,x=>({...x,steps:x.steps.filter(y=>y.id!==s.id)}))}>✕</button></li>)}</ul>
        <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),title=String(f.get('step')??'').trim(),emoji=String(f.get('emoji')??'').trim()||'⭐';if(!title)return;editRoutine(r.id,x=>({...x,steps:[...x.steps,{id:crypto.randomUUID(),title:title.slice(0,80),emoji:emoji.slice(0,8)}]}));e.currentTarget.reset()}}><input name="emoji" aria-label="Step picture" placeholder="⭐" maxLength={8} className="kids-step-emoji"/><input name="step" aria-label="New step" placeholder="Feed the fish" maxLength={80}/><button type="submit">Add</button></form>
        <button type="button" className="link-button" onClick={()=>{if(confirm('Remove the '+r.title+' routine?')){setEditing('');editRoutine(r.id,()=>null)}}}>Remove this routine</button>
       </div>
       :<ul className="kids-steps">{r.steps.map(s=>{const on=done.includes(s.id);return <li key={s.id}><button type="button" aria-pressed={on} onClick={()=>tick(r,s.id,p.id)}><span className="kids-step-pic" aria-hidden="true">{on?'✅':s.emoji}</span><span>{s.title}</span></button></li>})}</ul>}
      </section>})}
     {adding===(p.id||'family')?<div className="kids-routine-add" role="group" aria-label={'Add a routine for '+p.name}>{STARTER_ROUTINES.map((t,i)=><button type="button" key={t.title} onClick={()=>addRoutine(p,i)}>{t.emoji} {t.title}</button>)}<button type="button" className="link-button" onClick={()=>setAdding('')}>Cancel</button></div>
     :<button type="button" className="kids-routine-new" onClick={()=>setAdding(p.id||'family')}>＋ Routine</button>}
    </div>
    <div className="kids-sticker" role="group" aria-label={'Sticker for '+p.name+' on '+dayName}>
     <small>{sticker?'Today’s sticker':'How was the day?'}</small>
     <div>{STICKERS.map(e=><button type="button" key={e} aria-pressed={sticker?.emoji===e} onClick={()=>void save(d=>setSticker(d,pid,date,e,p.id||undefined))}>{e}</button>)}</div>
    </div>
   </article>})}</div>
  {timer&&<Suspense fallback={null}><VisualTimer onClose={()=>setTimer(false)}/></Suspense>}
 </section>
}
