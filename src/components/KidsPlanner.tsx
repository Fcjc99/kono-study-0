import {Fragment,lazy,Suspense,useEffect,useRef,useState,type CSSProperties} from 'react'
import {uid,type AppData,type FamilyTodo,type Kid,type Routine,type TodoRepeat} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {STARTER_ROUTINES,STICKERS,checkOf,choresOn,partOfDay,partPassed,pictureFor,routineFrom,sayTime,setSticker,sleepsUntil,stickersOn,tickStep,untickChore} from '../store/kidPlanner'
import {balance,starsAfterTick,starsOf} from '../store/choreStars'
import {TODO_REPEATS,repeatFields,repeatLabel,tickTodo,withChanges} from '../store/familyTodos'
import TodoEditor from './TodoEditor'
import {classTime} from '../store/classSchedule'
import Avatar from './Avatar'
import KonoSprite from './KonoSprite'
import './kids-planner.css'

const VisualTimer=lazy(()=>import('./VisualTimer'))

/** One thing on the day, whatever it is (event, class, homework, to-do), for the picture schedule. */
export type KidItem={id:string;title:string;time?:string;end?:string;kind?:string;people:string[];done?:boolean;location?:string;open?:()=>void}
type Person={id:string;name:string;color:string;kid?:Kid;emoji?:string;photo?:string}

const addDays=(iso:string,n:number)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toLocaleDateString('en-CA')}
const nowClock=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
const speak=(text:string)=>{try{const s=window.speechSynthesis;if(!s)return;s.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.95;u.pitch=1.1;s.speak(u)}catch{/* no voice here */}}
const sayItem=(i:KidItem)=>[sayTime(i.time),i.title,i.location?'at '+i.location:''].filter(Boolean).join(', ')+'.'

/** Planner › 🧸 Kids and the wall's Chores tab: the day as pictures, Skylight-style -- a column for each
 * person (the family, then each kid, in their color) with how much of the day is done, what's on (a KONO
 * "you are here" between done and next), their chores for the day (tap to tick; a kid's earn stars; add one
 * in a tap, just today or on repeat), their routines (the part of the day that's gone folds away) and a
 * sticker for the day. Across the top: "sleeps until" countdowns, 🔊 read the day aloud and ⏳ a timer.
 * Locked (the wall's kid lock), kids can tick but not add or change anything. */
export default function KidsPlanner({data,date,today,selectDate,items,kids,familyName,me,locked=false,save}:{data:AppData;date:string;today:string;selectDate:(d:string)=>void;items:KidItem[];kids:Kid[];familyName:string;me?:{emoji?:string;photo?:string;color?:string};locked?:boolean;save:PlannerRepository['update']}){
 const pid=data.activeProfileId
 const people:Person[]=[{id:'',name:familyName,color:me?.color??'#8c7265',emoji:me?.emoji??(me?.photo?undefined:'👪'),photo:me?.photo},...kids.map(k=>({id:k.id,name:k.name,color:k.color,kid:k,emoji:k.emoji,photo:k.photo}))]
 const [timer,setTimer]=useState(false),[cheer,setCheer]=useState<{who:string;text:string;at:number}|null>(null),[adding,setAdding]=useState(''),[editing,setEditing]=useState('')
 const [choreFor,setChoreFor]=useState(''),[choreText,setChoreText]=useState(''),[choreRepeat,setChoreRepeat]=useState<TodoRepeat|''>(''),[earlier,setEarlier]=useState(''),[editChore,setEditChore]=useState('')
 // A cheer shows for a few seconds, then goes (so "Morning done!" doesn't stay after a step is unticked).
 useEffect(()=>{if(!cheer)return;const t=window.setTimeout(()=>setCheer(null),4500);return()=>window.clearTimeout(t)},[cheer])
 const [clock,setClock]=useState(nowClock)
 useEffect(()=>{const t=window.setInterval(()=>setClock(nowClock()),60000);return()=>window.clearInterval(t)},[])
 const cols=useRef<HTMLDivElement>(null)
 const jump=(id:string)=>cols.current?.querySelector<HTMLElement>('[data-person="'+id+'"]')?.scrollIntoView({behavior:'smooth',inline:'start',block:'nearest'})
 const sleeps=sleepsUntil(data,pid,today)
 const dayName=new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'}),dateText=new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric'})
 const forPerson=(p:Person)=>items.filter(i=>p.id?i.people.includes(p.id):!i.people.length).sort((a,b)=>(a.time??'').localeCompare(b.time??''))
 const routinesOf=(p:Person)=>(data.routines??[]).filter(r=>r.profileId===pid&&(r.kidId??'')===p.id).sort((a,b)=>['morning','afternoon','evening'].indexOf(a.when)-['morning','afternoon','evening'].indexOf(b.when))
 const choresOf=(p:Person)=>choresOn(data,pid,p.id,date,today)
 const readDay=()=>{const parts=people.flatMap(p=>{const list=forPerson(p),chores=choresOf(p).open;const said=[...list.map(sayItem),...(chores.length?['Chores: '+chores.map(t=>t.title).join(', ')+'.']:[])];return said.length?[(p.id?p.name+': ':'')+said.join(' ')]:[]});speak((date===today?'Today':dayName)+'. '+(parts.join(' ')||'Nothing planned. A free day!'))}
 // Chores: ticking earns a kid's stars (a repeat moves on to its next turn); a done one ticks back.
 const tickChore=(t:FamilyTodo,who:string)=>{let earned=0;void save(d=>{const cur=(d.familyTodos??[]).find(x=>x.id===t.id);if(!cur)return d;const after=tickTodo(cur,today,date);earned=cur.forKidId?starsOf(cur):0;return {...d,familyTodos:(d.familyTodos??[]).map(x=>x.id===t.id?after:x),starLog:starsAfterTick(d.starLog??[],cur,after)}},{undoable:false}).then(ok=>{if(ok)setCheer({who,text:'✅ '+t.title+(earned>0?' · +'+earned+'⭐':''),at:Date.now()})})}
 const untick=(t:FamilyTodo)=>void save(d=>{const cur=(d.familyTodos??[]).find(x=>x.id===t.id);if(!cur)return d;const log=d.starLog??[],last=cur.forKidId?[...log].reverse().find(e=>e.todoId===cur.id&&e.n>0):undefined;return {...d,familyTodos:(d.familyTodos??[]).map(x=>x.id===t.id?untickChore(cur,date):x),starLog:last?log.filter(e=>e!==last):log}},{undoable:false})
 const addChore=(p:Person,title:string)=>{const words=title.trim().slice(0,300);if(!words)return;const repeat=choreRepeat||undefined
  void save(d=>({...d,familyTodos:[...(d.familyTodos??[]),{id:uid('todo'),profileId:pid,title:words,done:false,...(p.id?{forKidId:p.id}:{}),due:date,...repeatFields(repeat,date)}]})).then(ok=>{if(ok)setChoreText('')})}
 const tick=(r:Routine,stepId:string,who:string)=>{let earned=0;void save(d=>{const out=tickStep(d,r,date,stepId);earned=out.earned;return out.data},{undoable:false}).then(ok=>{if(ok&&earned){setCheer({who,text:'🎉 '+r.title+' done! +'+earned+'⭐',at:Date.now()});speak('Great job! '+r.title+' is done!')}})}
 const addRoutine=(p:Person,i:number)=>{setAdding('');void save(d=>({...d,routines:[...(d.routines??[]),routineFrom(STARTER_ROUTINES[i],pid,p.id||undefined)]}))}
 const nowPart=date===today?partOfDay(clock):'night'
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
  {people.length>2&&<div className="kids-planner-jump" role="group" aria-label="Jump to">{people.map(p=><button type="button" key={p.id||'family'} style={{'--kid-color':p.color} as CSSProperties} onClick={()=>jump(p.id||'family')}>{p.emoji??p.name.trim()[0]?.toUpperCase()} {p.name}</button>)}</div>}
  <div className="kids-planner-cols" ref={cols}>{people.map(p=>{
   const list=forPerson(p),routines=routinesOf(p),next=date===today?list.findIndex(i=>(i.end??i.time??'99')>clock&&!i.done):-1
   const sticker=stickersOn(data,pid,date).find(s=>(s.kidId??'')===p.id)
   const chores=choresOf(p),key=p.id||'family'
   const stepsOf=(r:Routine)=>checkOf(data,r.id,date)?.steps??[]
   const finished=(r:Routine)=>r.steps.length>0&&r.steps.every(s=>stepsOf(r).includes(s.id))
   // The rest of the day: a routine whose part of the day has gone by, or that's all done, folds into one line.
   const folded=routines.filter(r=>finished(r)||partPassed(r.when,date,today,clock)),current=routines.filter(r=>!folded.includes(r))
   const total=chores.open.length+chores.done.length+routines.reduce((n,r)=>n+r.steps.length,0)
   const doneCount=chores.done.length+routines.reduce((n,r)=>n+r.steps.filter(s=>stepsOf(r).includes(s.id)).length,0)
   const card=(i:KidItem)=>{const past=date<today||(date===today&&(i.done||(!!(i.end??i.time)&&(i.end??i.time)!<=clock)))
    return <li key={i.id} className={'kids-card'+(past?' is-past':'')}>
     <button type="button" className="kids-card-main" onClick={i.open} disabled={!i.open}><span className="kids-card-pic" aria-hidden="true">{pictureFor(i.title,i.kind)}</span><span className="kids-card-text"><strong>{i.title}</strong><small>{i.time?classTime(i.time)+(i.end?' – '+classTime(i.end):''):'Any time'}{i.location?' · 📍 '+i.location:''}</small></span>{past&&<span className="kids-card-done" aria-label="Done">✅</span>}</button>
     <button type="button" className="kids-card-say" aria-label={'Read aloud: '+i.title} onClick={()=>speak(sayItem(i))}>🔊</button>
    </li>}
   const routine=(r:Routine)=>{const done=stepsOf(r),all=finished(r),now=date===today&&nowPart===r.when
    return <section key={r.id} className={'kids-routine'+(all?' is-done':'')+(now?' is-now':'')} aria-label={r.title+' routine'}>
     <header><span aria-hidden="true">{r.emoji}</span><strong>{r.title}</strong>{now&&!all&&<em className="kids-now-tag">Now</em>}<small>{r.steps.filter(s=>done.includes(s.id)).length}/{r.steps.length}{r.kidId&&r.stars?' · '+r.stars+'⭐':''}</small>{!locked&&<button type="button" className="kids-routine-edit" aria-label={'Change '+r.title} aria-expanded={editing===r.id} onClick={()=>setEditing(e=>e===r.id?'':r.id)}>✎</button>}</header>
     {editing===r.id&&!locked?<div className="kids-routine-editor">
      <label>Stars for finishing<select value={r.stars} onChange={e=>editRoutine(r.id,x=>({...x,stars:Number(e.target.value)}))}>{[0,1,2,3,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <label>When<select value={r.when} onChange={e=>editRoutine(r.id,x=>({...x,when:e.target.value as Routine['when']}))}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></label>
      <ul>{r.steps.map(s=><li key={s.id}><span>{s.emoji} {s.title}</span><button type="button" aria-label={'Remove step '+s.title} onClick={()=>editRoutine(r.id,x=>({...x,steps:x.steps.filter(y=>y.id!==s.id)}))}>✕</button></li>)}</ul>
      <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),title=String(f.get('step')??'').trim(),emoji=String(f.get('emoji')??'').trim()||pictureFor(title).replace('📌','⭐');if(!title)return;editRoutine(r.id,x=>({...x,steps:[...x.steps,{id:crypto.randomUUID(),title:title.slice(0,80),emoji:emoji.slice(0,8)}]}));e.currentTarget.reset()}}><input name="emoji" aria-label="Step picture" placeholder="⭐" maxLength={8} className="kids-step-emoji"/><input name="step" aria-label="New step" placeholder="Feed the fish" maxLength={80}/><button type="submit">Add</button></form>
      <div className="kids-routine-editor-foot"><button type="button" className="link-button" onClick={()=>{if(confirm('Remove the '+r.title+' routine?')){setEditing('');editRoutine(r.id,()=>null)}}}>Remove this routine</button><button type="button" onClick={()=>setEditing('')}>Done</button></div>
     </div>
     :<ul className="kids-steps">{r.steps.map(s=>{const on=done.includes(s.id);return <li key={s.id}><button type="button" aria-pressed={on} onClick={()=>tick(r,s.id,p.id)}><span className="kids-step-pic" aria-hidden="true">{on?'✅':s.emoji}</span><span>{s.title}</span></button></li>})}</ul>}
    </section>}
   const missing=STARTER_ROUTINES.map((t,i)=>[t,i] as const).filter(([t])=>!routines.some(r=>r.title===t.title))
   return <article key={key} data-person={key} className="kids-col" style={{'--kid-color':p.color} as CSSProperties} aria-label={p.name+'’s day'}>
    <header className="kids-col-head">
     <Avatar className="kids-col-face" who={{name:p.name,emoji:p.emoji,photo:p.photo,color:p.color}}/>
     <div className="kids-col-name"><strong>{p.name}</strong>{total>0&&<small>{doneCount===total?'All done 🎉':doneCount+' of '+total+' done'}</small>}</div>
     {p.kid&&<span className="kids-col-stars" aria-label={balance(data.starLog??[],p.kid.id)+' stars'}>⭐ {balance(data.starLog??[],p.kid.id)}</span>}
    </header>
    {total>0&&<div className="kids-col-progress" aria-hidden="true"><u style={{width:doneCount/total*100+'%'}}/></div>}
    {cheer?.who===p.id&&<p className="kids-col-cheer" role="status" key={cheer.at}>{cheer.text}</p>}
    {list.length>0&&<ol className="kids-cards" aria-label={p.name+'’s plans'}>
     {list.map((i,n)=><Fragment key={i.id}>{n===next&&<li className="kids-now" aria-label={'Now. Next up: '+i.title}><KonoSprite size={44} pose="/garden/kono/happy.webp" fallback={<img src="/garden/kono/happy.webp" alt="" width={44}/>}/><span>Now · next up: <b>{i.title}</b></span></li>}{card(i)}</Fragment>)}
    </ol>}
    {!list.length&&!chores.open.length&&!chores.done.length&&!routines.length&&<p className="kids-col-empty">🌈 Nothing planned. A free day!</p>}
    <section className="kids-chores" aria-label={p.name+'’s chores'}>
     <h4><span aria-hidden="true">✅</span> {p.id?'Chores':'To-dos'}<small>{chores.open.length?chores.open.length+' left':chores.done.length?'All done':''}</small></h4>
     {chores.open.length+chores.done.length>0&&<ul className="kids-chore-list">
      {chores.open.map(t=>editChore===t.id&&!locked?<li key={t.id} className="kids-chore-editing"><TodoEditor todo={t} kids={kids} onCancel={()=>setEditChore('')} onDelete={()=>{setEditChore('');void save(d=>({...d,familyTodos:(d.familyTodos??[]).filter(x=>x.id!==t.id)}))}} onSave={changes=>{setEditChore('');void save(d=>({...d,familyTodos:(d.familyTodos??[]).map(x=>x.id===t.id?withChanges(x,changes):x)}))}}/></li>:<li key={t.id} className="kids-chore-row"><button type="button" className="kids-chore" aria-pressed="false" aria-label={'Done: '+t.title} onClick={()=>tickChore(t,p.id)}><span className="kids-chore-pic" aria-hidden="true">{pictureFor(t.title).replace('📌','⭐')}</span><span className="kids-chore-text"><b>{t.title}</b>{(t.repeat||(t.due&&t.due<date)||(p.id&&starsOf(t)>0))&&<small>{[p.id&&starsOf(t)>0?'+'+starsOf(t)+'⭐':'',t.due&&t.due<date&&!t.repeat?'from '+new Date(t.due+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'}):t.repeat?'🔁 '+repeatLabel(t.repeat).toLowerCase():''].filter(Boolean).join(' · ')}</small>}</span><span className="kids-chore-box" aria-hidden="true"/></button>{!locked&&<button type="button" className="kids-chore-edit" aria-label={'Change '+t.title} onClick={()=>setEditChore(t.id)}>✎</button>}</li>)}
      {chores.done.map(t=><li key={t.id}><button type="button" className="kids-chore is-done" aria-pressed="true" aria-label={'Not done yet: '+t.title} onClick={()=>untick(t)}><span className="kids-chore-pic" aria-hidden="true">{pictureFor(t.title).replace('📌','⭐')}</span><span className="kids-chore-text"><b>{t.title}</b></span><span className="kids-chore-box" aria-hidden="true">✓</span></button></li>)}
     </ul>}
     {!locked&&(choreFor===key?<form className="kids-chore-add" onSubmit={e=>{e.preventDefault();addChore(p,choreText)}}>
      <div className="kids-chore-add-row"><input autoFocus aria-label={'New chore for '+p.name} placeholder={(p.id?'Your chore':'Your to-do')+', e.g. '+(p.id?'Feed Biscuit':'Pay the water bill')} value={choreText} maxLength={300} onChange={e=>setChoreText(e.target.value)}/><button type="submit" className="primary" disabled={!choreText.trim()}>Add</button></div>
      <div className="kids-chore-repeat" role="group" aria-label="How often">{([['','Just '+(date===today?'today':dayName)],...TODO_REPEATS.slice(0,2).map(r=>[r.id,r.label])] as [TodoRepeat|'',string][]).map(([id,label])=><button type="button" key={id||'once'} aria-pressed={choreRepeat===id} onClick={()=>setChoreRepeat(id)}>{label}</button>)}</div>
      <button type="button" className="link-button kids-chore-close" onClick={()=>{setChoreFor('');setChoreText('')}}>Close</button>
     </form>:<button type="button" className="kids-chore-new" onClick={()=>{setChoreFor(key);setChoreText('');setChoreRepeat('')}}>＋ Add {p.id?'a chore':'a to-do'}</button>)}
     {locked&&!chores.open.length&&!chores.done.length&&<p className="kids-chore-none">No chores {date===today?'today':'this day'}.</p>}
    </section>
    {(routines.length>0||!locked)&&<div className="kids-routines">
     {folded.length>0&&<div className="kids-earlier">{folded.map(r=><button type="button" key={r.id} className={'kids-earlier-chip'+(finished(r)?' is-done':'')} aria-expanded={earlier===r.id} onClick={()=>setEarlier(e=>e===r.id?'':r.id)}><span aria-hidden="true">{r.emoji}</span> {r.title} <small>{finished(r)?'✓ done':stepsOf(r).filter(id=>r.steps.some(s=>s.id===id)).length+'/'+r.steps.length}</small></button>)}</div>}
     {folded.filter(r=>earlier===r.id).map(routine)}
     {current.map(routine)}
     {!locked&&(adding===key?<div className="kids-routine-add" role="group" aria-label={'Add a routine for '+p.name}>{missing.map(([t,i])=><button type="button" key={t.title} onClick={()=>addRoutine(p,i)}>{t.emoji} {t.title}</button>)}<button type="button" className="link-button" onClick={()=>setAdding('')}>Cancel</button></div>
     :missing.length>0&&<button type="button" className="kids-routine-new" onClick={()=>setAdding(key)}>＋ Routine</button>)}
    </div>}
    <details className="kids-sticker" open={!!sticker||undefined}>
     <summary>{sticker?<>Today’s sticker <span className="kids-sticker-on" aria-hidden="true">{sticker.emoji}</span></>:'How was the day?'}</summary>
     <div role="group" aria-label={'Sticker for '+p.name+' on '+dayName}>{STICKERS.map(e=><button type="button" key={e} aria-pressed={sticker?.emoji===e} onClick={()=>void save(d=>setSticker(d,pid,date,e,p.id||undefined))}>{e}</button>)}</div>
    </details>
   </article>})}</div>
  {timer&&<Suspense fallback={null}><VisualTimer onClose={()=>setTimer(false)}/></Suspense>}
 </section>
}
