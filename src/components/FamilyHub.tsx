import {lazy,Suspense,useCallback,useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react'
import {localDate,uid,type AppData,type Kid} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {kidItemsForDate,type KidItem as DayItem} from '../store/kids'
import {classTime} from '../store/classSchedule'
import {addDays} from '../store/studyScheduler'
import type {DailyWeatherForecast} from '../game/weather/liveWeather'
import {specialOn} from '../store/specialDays'
import {daysOffOn,dayOffIcon,dayOffLabel} from '../store/daysOff'
import {todosOn} from '../store/familyTodos'
import {dinnerOn,addGroceries,toggleGrocery,clearBought} from '../store/meals'
import {pictureFor,progressToday,sleepsUntil} from '../store/kidPlanner'
import {PANELS,PANEL_NAMES,checkPin,hasPin,isQuiet,readPanels,readQuiet,setPin,withoutDuplicates,writePanels,writeQuiet,type Panel,type Quiet} from '../store/familyHub'
import type {TodoOps} from './TodoEditor'
import type {KidItem} from './KidsPlanner'
import Avatar from './Avatar'
import KonoSprite from './KonoSprite'
import './family-hub.css'

const KidsPlanner=lazy(()=>import('./KidsPlanner'))
const MealPlan=lazy(()=>import('./MealPlan'))

type Person={id:string;name:string;emoji?:string;photo?:string;color:string}
type Tab='home'|'calendar'|'chores'|'meals'|'lists'
const weatherEmoji:Record<DailyWeatherForecast['weather'],string>={clear:'☀️',cloudy:'☁️',rain:'🌧️',wind:'💨',snow:'❄️'}
const TABS:[Tab,string,string][]=[['home','🏠','Home'],['calendar','🗓️','Calendar'],['chores','✅','Chores'],['meals','🍽️','Meals'],['lists','📝','Lists']]
const nowMs=()=>Date.now()
const IDLE_MS=5*60_000,WAKE_MS=5*60_000
const LOCK_KEY='kono-hub-locked',DAYS_KEY='kono-hub-days'
const clockOf=(d:Date)=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')
const readLocal=(k:string)=>{try{return localStorage.getItem(k)}catch{return null}}
const writeLocal=(k:string,v:string)=>{try{localStorage.setItem(k,v)}catch{/* per device */}}
// "9:30 – 10:30 AM", the way a wall calendar writes it.
const span=(from?:string,to?:string)=>{if(!from)return '';if(!to)return classTime(from);const a=classTime(from),b=classTime(to);return (a.slice(-2)===b.slice(-2)?a.slice(0,-3).replace(/:00$/,''):a.replace(/:00 /,' '))+' – '+b.replace(/:00 /,' ')}

/** Tablet & wall mode: KONO laid out for an 11-inch-or-bigger screen on the wall or the counter, after
 * Skylight and Cozyla -- a rail of big tabs (Home, Calendar, Chores, Meals, Lists), a header with the
 * family, clock, weather and everyone's colors, and Home as day columns beside the family's panels.
 * It keeps the screen awake (asked for from a tap, as iPads need), goes dark for quiet hours, drifts into
 * a clock-and-KONO screen when nobody's touched it for a while, checks for changes when it wakes, and can
 * be locked so kids can tick chores but not change the calendar (a grown-up PIN unlocks it). */
export default function FamilyHub({data,save,me,familyName,weather,todoOps,refresh,onAdd,onOpen,close,startTapped}:{data:AppData;save:PlannerRepository['update'];me:Person;familyName:string;weather:DailyWeatherForecast[];todoOps:TodoOps;refresh:()=>void;onAdd:()=>void;onOpen:(item:DayItem)=>void;close:()=>void;startTapped:boolean}){
 const pid=data.activeProfileId
 const [now,setNow]=useState(()=>new Date())
 const [tab,setTab]=useState<Tab>('home')
 const [started,setStarted]=useState(startTapped)
 const [locked,setLocked]=useState(()=>readLocal(LOCK_KEY)==='1')
 const [hidden,setHidden]=useState<Set<string>>(new Set())
 const [days,setDays]=useState(()=>Number(readLocal(DAYS_KEY))||4),[offset,setOffset]=useState(0)
 const [quiet,setQuietState]=useState<Quiet>(readQuiet)
 const [panels,setPanels]=useState(readPanels)
 const [idle,setIdle]=useState(false),[wokeUntil,setWokeUntil]=useState(0)
 const [setup,setSetup]=useState(false),[pinFor,setPinFor]=useState<null|{why:string;then:()=>void}>(null)
 const [choresDate,setChoresDate]=useState(()=>localDate())
 const lastTouch=useRef(0),lock=useRef<{release:()=>Promise<void>}|null>(null)
 const today=localDate(now),clock=clockOf(now),quietNow=isQuiet(quiet,clock)&&now.getTime()>wokeUntil

 useEffect(()=>{lastTouch.current=nowMs();const t=window.setInterval(()=>{setNow(new Date());if(nowMs()-lastTouch.current>IDLE_MS)setIdle(true)},15000);return()=>window.clearInterval(t)},[])
 useEffect(()=>{document.documentElement.classList.add('wall-open');return()=>document.documentElement.classList.remove('wall-open')},[])
 // Keep the screen on: asked for from a tap (iPads only allow that), again whenever the page comes back,
 // and let go in quiet hours so the tablet can sleep.
 const askWake=useCallback(()=>{
  const nav=navigator as Navigator&{wakeLock?:{request:(type:'screen')=>Promise<{release:()=>Promise<void>}>}}
  if(!nav.wakeLock||lock.current||document.visibilityState!=='visible')return
  void nav.wakeLock.request('screen').then(l=>{lock.current=l;(l as unknown as EventTarget).addEventListener?.('release',()=>{if(lock.current===l)lock.current=null})}).catch(()=>undefined)
 },[])
 useEffect(()=>{if(quietNow){void lock.current?.release().catch(()=>undefined);lock.current=null}else if(started)askWake()},[quietNow,started,askWake])
 useEffect(()=>{const back=()=>{if(document.visibilityState==='visible'){refresh();if(started&&!quietNow)askWake()}};document.addEventListener('visibilitychange',back);return()=>document.removeEventListener('visibilitychange',back)},[refresh,started,quietNow,askWake])
 useEffect(()=>()=>{void lock.current?.release().catch(()=>undefined)},[])
 const touched=()=>{lastTouch.current=nowMs();if(idle){setIdle(false);refresh()}if(!lock.current&&started&&!quietNow)askWake()}
 const start=()=>{setStarted(true);askWake();const el=document.documentElement;if(!document.fullscreenElement&&el.requestFullscreen)void el.requestFullscreen().catch(()=>undefined)}
 const withPin=(why:string,then:()=>void)=>{if(!hasPin())then();else setPinFor({why,then})}
 const setLock=(on:boolean)=>{setLocked(on);writeLocal(LOCK_KEY,on?'1':'0')}
 const exit=()=>withPin('leave wall mode',()=>{if(document.fullscreenElement)void document.exitFullscreen().catch(()=>undefined);close()})
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!pinFor&&!setup&&!document.querySelector('dialog[open]'))exit()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)})

 const kids:Kid[]=data.kids.filter(k=>k.profileId===pid)
 const people:Person[]=[me,...kids.map(k=>({id:k.id,name:k.name,emoji:k.emoji,photo:k.photo,color:k.color}))]
 const personFor=(kidId?:string)=>people.find(p=>p.id===kidId)??me
 const shown=(kidId?:string)=>!hidden.has(kidId&&kids.some(k=>k.id===kidId)?kidId:'me')
 const toggle=(id:string)=>setHidden(h=>{const n=new Set(h);if(n.has(id))n.delete(id);else n.add(id);return n})
 const clean={...data,calendarEvents:withoutDuplicates(data.calendarEvents)}
 const itemsFor=(date:string)=>kidItemsForDate(clean,pid,date).filter(i=>shown(i.kidId)).sort((a,b)=>(a.until?'00:00':a.time??'99:99').localeCompare(b.until?'00:00':b.time??'99:99')||a.title.localeCompare(b.title))
 const forecastFor=(date:string)=>weather.find(w=>w.date===date)
 const todayWeather=forecastFor(today)
 const openItem=(i:DayItem)=>{touched();if(locked||i.kind==='class')return;onOpen(i)}

 const dayName=(date:string)=>date===today?'Today':date===addDays(today,1)?'Tomorrow':new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'})
 const column=(date:string,dense=false)=>{const items=itemsFor(date),timed=items.filter(i=>i.time&&!i.until),allDay=items.filter(i=>!i.time||i.until),w=forecastFor(date)
  return <section key={date} className={'hub-day'+(date===today?' is-today':'')} aria-label={dayName(date)}>
   <header><b>{dense&&date!==today?new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'}):dayName(date)}</b><small>{new Date(date+'T12:00:00').toLocaleDateString(undefined,dense?{day:'numeric'}:{month:'short',day:'numeric'})}</small>{w&&<span className="hub-day-weather" aria-label={'High '+Math.round(w.highF)}>{weatherEmoji[w.weather]} {Math.round(w.highF)}°</span>}</header>
   {daysOffOn(data,pid,date).map(d=><p key={d.id} className="hub-banner is-off">{dayOffIcon(d.reason)} {dayOffLabel(data,d)}</p>)}
   {specialOn(data,pid,date).map(x=><p key={x.day.id} className="hub-banner" style={{'--p':personFor(x.day.kidId).color} as CSSProperties}>{x.icon} {x.label}</p>)}
   {allDay.map(i=>card(i,date,true))}
   {timed.map(i=>card(i,date,false))}
   {todosOn(data,pid,date).filter(t=>shown(t.forKidId)).length>0&&<ul className="hub-day-todos" aria-label={dayName(date)+'’s to-dos'}>{todosOn(data,pid,date).filter(t=>shown(t.forKidId)).map(t=>{const p=t.forKidId?personFor(t.forKidId):undefined;return <li key={t.id} style={{'--p':(p??me).color} as CSSProperties}><span aria-hidden="true">✔</span> {t.title}{p&&<small>{p.name}</small>}</li>})}</ul>}
   {!items.length&&!daysOffOn(data,pid,date).length&&!todosOn(data,pid,date).length&&<p className="hub-empty">Nothing planned</p>}
  </section>}
 const card=(i:DayItem,date:string,allDay:boolean)=>{const p=personFor(i.kidId),past=date<today||(date===today&&!!(i.endTime??i.time)&&(i.endTime??i.time)!<clock&&i.kind!=='task')
  return <button type="button" key={i.kind+i.id+(i.kidId??'')} className={'hub-card'+(allDay?' is-allday':'')+(past||i.done?' is-past':'')+(i.off?' is-off':'')} style={{'--p':p.color} as CSSProperties} onClick={()=>openItem(i)} aria-label={i.title+(i.time?', '+span(i.time,i.endTime):'')+', '+p.name}>
   <span className="hub-card-title">{i.kind==='task'?'📌 ':i.kind==='exam'?'📝 ':''}{i.title}</span>
   {!allDay&&<small>{i.until?'until '+classTime(i.until):span(i.time,i.endTime)}</small>}
   <i className="hub-card-who" aria-hidden="true">{(p.name.trim()[0]??'').toUpperCase()}</i>
  </button>}

 // Home's panels
 const timedToday=itemsFor(today).filter(i=>i.time&&!i.done&&i.kind!=='task')
 const next=timedToday.find(i=>(i.endTime??i.time)!>clock)
 const minsTo=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m-(now.getHours()*60+now.getMinutes())}
 const openTodos=(data.familyTodos??[]).filter(t=>t.profileId===pid&&!t.done&&(!t.due||t.due<=today)&&shown(t.forKidId))
 const todosToday=[...todosOn(data,pid,today).filter(t=>shown(t.forKidId)),...openTodos.filter(t=>!t.due)].filter((t,i,a)=>a.findIndex(x=>x.id===t.id)===i)
 const groceriesLeft=(data.groceries??[]).filter(g=>g.profileId===pid&&!g.done)
 const dinner=dinnerOn(data,pid,today)
 const panel:Record<Panel,ReactNode>={
  next:<section className="hub-panel hub-next" aria-label="Up next"><h3>Up next</h3>{next?<button type="button" className="hub-next-card" style={{'--p':personFor(next.kidId).color} as CSSProperties} onClick={()=>openItem(next)}><span aria-hidden="true">{pictureFor(next.title)}</span><b>{next.title}</b><small>{minsTo(next.time!)>0?'in '+(minsTo(next.time!)>=60?Math.floor(minsTo(next.time!)/60)+' h '+(minsTo(next.time!)%60?minsTo(next.time!)%60+' min':''):minsTo(next.time!)+' min'):'now'} · {span(next.time,next.endTime)} · {personFor(next.kidId).name}</small></button>:<p className="hub-empty">Nothing else today 🌙</p>}</section>,
  routines:<section className="hub-panel" aria-label="Routines and chores"><h3>Routines & chores</h3>{people.filter(p=>shown(p.id==='me'?undefined:p.id)).map(p=>{const pr=progressToday(data,pid,today,p.id==='me'?'':p.id);if(!pr.total)return null
   return <button type="button" key={p.id} className="hub-progress" style={{'--p':p.color} as CSSProperties} onClick={()=>{touched();setTab('chores')}}><Avatar className="hub-face" who={p}/><span><b>{p.name}</b><small>{pr.done}/{pr.total}{pr.done===pr.total?' 🎉':''}</small><em><u style={{width:pr.done/pr.total*100+'%'}}/></em></span></button>})}
   {people.every(p=>!progressToday(data,pid,today,p.id==='me'?'':p.id).total)&&<p className="hub-empty">No routines or chores today. Add them in Chores.</p>}</section>,
  todos:<section className="hub-panel" aria-label="To-dos"><h3>To-dos</h3>{todosToday.length?<ul className="hub-todos">{todosToday.slice(0,6).map(t=><li key={t.id}><button type="button" aria-label={'Done: '+t.title} onClick={()=>{touched();todoOps.tick(t.id,today)}}><span aria-hidden="true">○</span>{t.title}{t.forKidId&&<i style={{'--p':personFor(t.forKidId).color} as CSSProperties}>{personFor(t.forKidId).name}</i>}</button></li>)}</ul>:<p className="hub-empty">All clear ✨</p>}</section>,
  dinner:<section className="hub-panel" aria-label="Dinner"><h3>Dinner tonight</h3><button type="button" className="hub-dinner" onClick={()=>{touched();setTab('meals')}}><span aria-hidden="true">🍽️</span><b>{dinner?.title??'Not planned yet'}</b><small>🛒 {groceriesLeft.length} on the grocery list</small></button></section>,
  countdowns:<section className="hub-panel" aria-label="Counting down"><h3>Counting down</h3>{sleepsUntil(data,pid,today,90).length?<ul className="hub-sleeps">{sleepsUntil(data,pid,today,90).map(s=><li key={s.label}><span aria-hidden="true">{s.icon}</span><b>{s.sleeps}</b><small>{s.sleeps===1?'sleep':'sleeps'} until {s.label}</small></li>)}</ul>:<p className="hub-empty">Add birthdays and countdowns from the Planner.</p>}</section>,
 }

 // Chores tab: the Kids view, for a chosen day
 const kidItems=(date:string):KidItem[]=>itemsFor(date).map(i=>({id:i.kind+':'+i.id+':'+(i.kidId??''),title:i.title,time:i.time,end:i.endTime,kind:i.kind==='exam'?'exam':i.kind==='task'?'assignment':i.kind==='class'?'lesson':undefined,people:i.kidId?[i.kidId]:[],done:i.done,open:locked||i.kind==='class'?undefined:()=>onOpen(i)}))
 const [newTodo,setNewTodo]=useState(''),[newGrocery,setNewGrocery]=useState('')
 const groceries=(data.groceries??[]).filter(g=>g.profileId===pid)

 if(!started)return <div className="family-hub hub-start" role="dialog" aria-modal="true" aria-label="Wall mode"><button type="button" className="hub-start-button" onClick={start}><KonoSprite size={96} pose="/garden/kono/happy.webp" fallback={<img src="/garden/kono/happy.webp" alt="" width={96}/>}/><b>Tap to start wall mode</b><small>Keeps this screen on and goes full screen</small></button><button type="button" className="link-button" onClick={close}>Not now</button></div>

 return <div className={'family-hub'+(now.getHours()>=19||now.getHours()<6?' is-evening':'')} role="dialog" aria-modal="true" aria-label="Family hub" onPointerDown={touched} onKeyDown={touched}>
  <nav className="hub-rail" aria-label="Wall mode">
   {TABS.map(([id,icon,label])=><button type="button" key={id} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}
   <span className="hub-rail-gap"/>
   <button type="button" onClick={()=>locked?withPin('unlock',()=>setLock(false)):setLock(true)} aria-pressed={locked}><span aria-hidden="true">{locked?'🔒':'🔓'}</span>{locked?'Locked':'Lock'}</button>
   <button type="button" onClick={()=>withPin('open setup',()=>setSetup(true))}><span aria-hidden="true">⚙️</span>Setup</button>
   <button type="button" onClick={exit}><span aria-hidden="true">✕</span>Exit</button>
  </nav>
  <div className="hub-main">
   <header className="hub-head">
    <div className="hub-title"><b>{familyName}</b><span className="hub-clock">{now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span>{todayWeather&&<span className="hub-weather" aria-label={'Weather: high '+Math.round(todayWeather.highF)}>{weatherEmoji[todayWeather.weather]} {Math.round(todayWeather.highF)}°</span>}<small>{now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</small></div>
    <div className="hub-people" role="group" aria-label="Show whose">{people.map(p=><button type="button" key={p.id} aria-pressed={!hidden.has(p.id)} aria-label={(hidden.has(p.id)?'Show ':'Hide ')+p.name} style={{'--p':p.color} as CSSProperties} onClick={()=>toggle(p.id)}><Avatar className="hub-face" who={p}/></button>)}</div>
    {!locked&&<button type="button" className="hub-add" onClick={()=>{touched();onAdd()}}>＋ Add</button>}
   </header>
   {tab==='home'&&<div className="hub-home">
    <div className="hub-days" style={{'--n':Math.min(days,4)} as CSSProperties}>{Array.from({length:Math.min(days,4)},(_,i)=>column(addDays(today,i)))}</div>
    <aside className="hub-panels">{panels.order.filter(p=>!panels.hidden.has(p)).map(p=><div key={p}>{panel[p]}</div>)}</aside>
   </div>}
   {tab==='calendar'&&<div className="hub-calendar">
    <div className="hub-cal-bar"><button type="button" aria-label="Earlier" onClick={()=>setOffset(o=>o-days)}>‹</button><button type="button" onClick={()=>setOffset(0)} disabled={!offset}>Today</button><button type="button" aria-label="Later" onClick={()=>setOffset(o=>o+days)}>›</button>
     <div role="group" aria-label="Days shown">{[1,3,5,7].map(n=><button type="button" key={n} aria-pressed={days===n} onClick={()=>{setDays(n);writeLocal(DAYS_KEY,String(n))}}>{n===1?'Day':n===7?'Week':n+' days'}</button>)}</div></div>
    <div className="hub-days" style={{'--n':days} as CSSProperties}>{Array.from({length:days},(_,i)=>column(addDays(today,offset+i),days>=5))}</div>
   </div>}
   {tab==='chores'&&<Suspense fallback={null}><KidsPlanner data={data} date={choresDate} today={today} selectDate={setChoresDate} items={kidItems(choresDate)} kids={kids.filter(k=>shown(k.id))} familyName={me.name} save={save}/></Suspense>}
   {tab==='meals'&&<Suspense fallback={null}><MealPlan data={data} profileId={pid} today={today} save={save}/></Suspense>}
   {tab==='lists'&&<div className="hub-lists">
    <section className="hub-panel" aria-label="Family to-dos"><h3>To-dos</h3>
     {!locked&&<form className="hub-inline-add" onSubmit={e=>{e.preventDefault();const t=newTodo.trim();if(!t)return;void save(d=>({...d,familyTodos:[...(d.familyTodos??[]),{id:uid('todo'),profileId:pid,title:t.slice(0,300),done:false}]}));setNewTodo('')}}><input aria-label="New to-do" placeholder="Add a to-do…" value={newTodo} onChange={e=>setNewTodo(e.target.value)}/><button type="submit">Add</button></form>}
     {openTodos.length?<ul className="hub-todos">{openTodos.map(t=><li key={t.id}><button type="button" aria-label={'Done: '+t.title} onClick={()=>todoOps.tick(t.id,today)}><span aria-hidden="true">○</span>{t.title}{t.forKidId&&<i style={{'--p':personFor(t.forKidId).color} as CSSProperties}>{personFor(t.forKidId).name}</i>}</button></li>)}</ul>:<p className="hub-empty">All clear ✨</p>}
    </section>
    <section className="hub-panel" aria-label="Groceries"><h3>🛒 Groceries</h3>
     <form className="hub-inline-add" onSubmit={e=>{e.preventDefault();if(!newGrocery.trim())return;void save(d=>addGroceries(d,pid,newGrocery));setNewGrocery('')}}><input aria-label="Add groceries" placeholder="Milk, eggs…" value={newGrocery} onChange={e=>setNewGrocery(e.target.value)}/><button type="submit">Add</button></form>
     {groceries.length?<ul className="hub-groceries">{[...groceries.filter(g=>!g.done),...groceries.filter(g=>g.done)].map(g=><li key={g.id}><label className={g.done?'is-done':''}><input type="checkbox" checked={g.done} onChange={()=>void save(d=>toggleGrocery(d,g.id))}/>{g.title}</label></li>)}</ul>:<p className="hub-empty">Nothing on the list.</p>}
     {groceries.some(g=>g.done)&&<button type="button" className="link-button" onClick={()=>void save(d=>clearBought(d,pid))}>Clear what’s in the cart</button>}
    </section>
   </div>}
  </div>

  {idle&&!quietNow&&<button type="button" className="hub-ambient" aria-label="Wake the screen" onClick={touched}>
   <div className="hub-ambient-drift" style={{'--x':(now.getMinutes()%5)*6-12+'px','--y':(now.getMinutes()%3)*10-10+'px'} as CSSProperties}>
    <span className="hub-ambient-clock">{now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span>
    <span className="hub-ambient-date">{now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}{todayWeather?' · '+weatherEmoji[todayWeather.weather]+' '+Math.round(todayWeather.highF)+'°':''}</span>
    {next&&<span className="hub-ambient-next">Next: {next.title} · {classTime(next.time!)}</span>}
    <KonoSprite size={110} pose="/garden/kono/sit.webp" fallback={<img src="/garden/kono/sit.webp" alt="" width={110}/>}/>
   </div>
  </button>}
  {quietNow&&<button type="button" className="hub-quiet" aria-label="Quiet hours. Tap to wake for a few minutes" onClick={()=>{setWokeUntil(nowMs()+WAKE_MS);touched()}}><span>{now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span><small>Quiet hours until {classTime(quiet!.until)} · tap to wake</small></button>}
  {pinFor&&<PinPad why={pinFor.why} onDone={ok=>{const then=pinFor.then;setPinFor(null);if(ok)then()}}/>}
  {setup&&<HubSetup quiet={quiet} onQuiet={q=>{writeQuiet(q);setQuietState(q)}} panels={panels} onPanels={(order,hiddenSet)=>{writePanels(order,hiddenSet);setPanels({order,hidden:hiddenSet})}} close={()=>setSetup(false)}/>}
 </div>
}

/** A grown-up PIN pad: big keys for a wall, four to eight digits. */
function PinPad({why,onDone}:{why:string;onDone:(ok:boolean)=>void}){
 const [pin,setPinValue]=useState(''),[wrong,setWrong]=useState(false)
 const press=(k:string)=>{setWrong(false);if(k==='⌫')setPinValue(p=>p.slice(0,-1));else if(pin.length<8)setPinValue(p=>p+k)}
 const go=async()=>{if(await checkPin(pin))onDone(true);else{setWrong(true);setPinValue('')}}
 return <div className="hub-sheet" role="dialog" aria-modal="true" aria-label="Grown-up PIN"><div className="hub-pin">
  <h2>🔒 Grown-up PIN</h2><p>To {why}</p>
  <output className={'hub-pin-dots'+(wrong?' is-wrong':'')} aria-live="polite">{wrong?'Try again':pin.replace(/./g,'●')||' '}</output>
  <div className="hub-pin-keys">{['1','2','3','4','5','6','7','8','9','⌫','0','OK'].map(k=><button type="button" key={k} onClick={()=>k==='OK'?void go():press(k)} aria-label={k==='⌫'?'Delete':k}>{k}</button>)}</div>
  <button type="button" className="link-button" onClick={()=>onDone(false)}>Cancel</button>
 </div></div>
}

/** Setup: quiet hours, a PIN, Home's panels, and how to keep a tablet on the wall. */
function HubSetup({quiet,onQuiet,panels,onPanels,close}:{quiet:Quiet;onQuiet:(q:Quiet)=>void;panels:{order:Panel[];hidden:Set<Panel>};onPanels:(order:Panel[],hidden:Set<Panel>)=>void;close:()=>void}){
 const [pinNew,setPinNew]=useState(''),[pinMsg,setPinMsg]=useState(hasPin()?'A PIN is set on this tablet.':'No PIN yet: anyone can unlock and leave wall mode.')
 const move=(p:Panel,by:number)=>{const order=[...panels.order],i=order.indexOf(p),j=i+by;if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];onPanels(order,panels.hidden)}
 return <div className="hub-sheet" role="dialog" aria-modal="true" aria-label="Wall mode setup"><div className="hub-setup">
  <header><h2>⚙️ Wall mode setup</h2><button type="button" onClick={close}>Done</button></header>
  <section><h3>🌙 Quiet hours</h3><p className="wb-muted">The screen goes dark and is allowed to sleep. Tap it to wake for a few minutes.</p>
   <label className="wb-check"><input type="checkbox" checked={!!quiet} onChange={e=>onQuiet(e.target.checked?{from:'21:30',until:'06:30'}:null)}/>Quiet hours on</label>
   {quiet&&<div className="hub-setup-row"><label>From<input type="time" value={quiet.from} onChange={e=>onQuiet({...quiet,from:e.target.value||quiet.from})}/></label><label>Until<input type="time" value={quiet.until} onChange={e=>onQuiet({...quiet,until:e.target.value||quiet.until})}/></label></div>}
  </section>
  <section><h3>🔒 Grown-up PIN</h3><p className="wb-muted">{pinMsg} It’s asked to unlock, open setup, leave wall mode and OK a kid’s reward on this tablet.</p>
   <form className="hub-setup-row" onSubmit={e=>{e.preventDefault();if(!/^\d{4,8}$/.test(pinNew)){setPinMsg('Use 4 to 8 numbers.');return}void setPin(pinNew).then(()=>{setPinNew('');setPinMsg('PIN saved on this tablet.')})}}><input inputMode="numeric" pattern="[0-9]*" maxLength={8} aria-label="New PIN" placeholder="New PIN" value={pinNew} onChange={e=>setPinNew(e.target.value.replace(/\D/g,''))}/><button type="submit">Save PIN</button>{hasPin()&&<button type="button" onClick={()=>void setPin(null).then(()=>setPinMsg('PIN removed.'))}>Remove PIN</button>}</form>
  </section>
  <section><h3>🏠 Home panels</h3><ul className="hub-setup-panels">{panels.order.map((p,i)=><li key={p}><label className="wb-check"><input type="checkbox" checked={!panels.hidden.has(p)} onChange={e=>{const h=new Set(panels.hidden);if(e.target.checked)h.delete(p);else h.add(p);onPanels(panels.order,h)}}/>{PANEL_NAMES[p]}</label><button type="button" aria-label={'Move '+PANEL_NAMES[p]+' up'} disabled={i===0} onClick={()=>move(p,-1)}>↑</button><button type="button" aria-label={'Move '+PANEL_NAMES[p]+' down'} disabled={i===PANELS.length-1} onClick={()=>move(p,1)}>↓</button></li>)}</ul></section>
  <section><h3>📲 Keep a tablet on the wall</h3>
   <details open><summary><b>iPad</b></summary><ol>
    <li>In Safari, open KONO and tap Share › <b>Add to Home Screen</b>. Open it from that icon (keeping the screen on needs iPadOS 18.4 or later for a Home Screen app).</li>
    <li>Settings › Display &amp; Brightness › Auto-Lock: <b>Never</b> (KONO still goes dark in quiet hours).</li>
    <li>Settings › Accessibility › <b>Guided Access</b>: on, with a passcode. In KONO, triple-click the top button and Start, so the tablet stays in KONO.</li>
    <li>Plug it in; Settings › Battery › Battery Health › <b>Optimized charging</b> helps a tablet that's always charging.</li>
   </ol></details>
   <details><summary><b>Android tablet</b></summary><ol>
    <li>In Chrome, open KONO and choose ⋮ › <b>Install app</b> (or Add to Home screen), then open it from the icon.</li>
    <li>Settings › Security › <b>App pinning</b> (Screen pinning): on, then pin KONO from the recent apps screen.</li>
    <li>Settings › Display › Screen timeout: the longest; KONO keeps the screen on while it's open.</li>
    <li>For a dedicated wall tablet, a kiosk browser (like Fully Kiosk) can open <code>{location.origin}/?wall=1</code> at start-up.</li>
   </ol></details>
   <p className="wb-muted">Bookmark <code>{location.origin}/?wall=1</code> to open straight into wall mode.</p>
  </section>
 </div></div>
}
