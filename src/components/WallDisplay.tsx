import {useEffect,useState,type CSSProperties} from 'react'
import {localDate,type AppData} from '../store/model'
import {kidItemsForDate,type KidItem} from '../store/kids'
import {classTime} from '../store/classSchedule'
import {addDays} from '../store/studyScheduler'
import type {DailyWeatherForecast} from '../game/weather/liveWeather'
import {specialOn,upcomingSpecial,daysAwayLabel} from '../store/specialDays'
import Avatar from './Avatar'
import './wall-display.css'

type Person={id:string;name:string;emoji?:string;photo?:string;color:string}
const weatherEmoji:Record<DailyWeatherForecast['weather'],string>={clear:'☀️',cloudy:'☁️',rain:'🌧️',wind:'💨',snow:'❄️'}
const kindIcon:Record<KidItem['kind'],string>={task:'📌',exam:'📝',event:'',class:''}

/** Night mode: from 8 PM to 6 AM the wall dims to a dark, low-glare look and leads with tomorrow. */
export const NIGHT_FROM=20,NIGHT_UNTIL=6
const NIGHT_KEY='kono-wall-night'
type NightSetting='auto'|'night'|'day'

/** Wall display: a big, always-on view of today and tomorrow for the whole family, for an old tablet on
 * the fridge (like a family wall calendar), plus the rest of the week on a wide screen. The clock ticks,
 * the day rolls over at midnight, it dims at night, changes from other devices show up as they sync, and
 * the screen is kept awake where the browser allows it. */
export default function WallDisplay({data,me,weather,close}:{data:AppData;me:Person;weather:DailyWeatherForecast[];close:()=>void}){
 const [now,setNow]=useState(()=>new Date())
 useEffect(()=>{const t=window.setInterval(()=>setNow(new Date()),15000);return()=>window.clearInterval(t)},[])
 // Keep the screen on, and ask again when the tab comes back (the browser lets go when it's hidden).
 useEffect(()=>{
  type Lock={release:()=>Promise<void>}
  const nav=navigator as Navigator&{wakeLock?:{request:(type:'screen')=>Promise<Lock>}}
  let lock:Lock|null=null,gone=false
  const ask=()=>{if(nav.wakeLock&&document.visibilityState==='visible')void nav.wakeLock.request('screen').then(l=>{if(gone)void l.release();else lock=l}).catch(()=>undefined)}
  ask();document.addEventListener('visibilitychange',ask)
  return()=>{gone=true;document.removeEventListener('visibilitychange',ask);void lock?.release().catch(()=>undefined)}
 },[])
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[close])
 useEffect(()=>{document.documentElement.classList.add('wall-open');return()=>document.documentElement.classList.remove('wall-open')},[])
 const [nightSetting,setNightSetting]=useState<NightSetting>(()=>{try{const v=localStorage.getItem(NIGHT_KEY);return v==='night'||v==='day'?v:'auto'}catch{return 'auto'}})
 const autoNight=now.getHours()>=NIGHT_FROM||now.getHours()<NIGHT_UNTIL
 const night=nightSetting==='auto'?autoNight:nightSetting==='night'
 // The button flips to the other look; flipping back to what the clock would pick returns to automatic.
 const toggleNight=()=>{const next:NightSetting=(!night)===autoNight?'auto':!night?'night':'day';setNightSetting(next);try{if(next==='auto')localStorage.removeItem(NIGHT_KEY);else localStorage.setItem(NIGHT_KEY,next)}catch{/* per-device nicety */}}
 const today=localDate(now),tomorrow=addDays(today,1)
 const kids=data.kids.filter(k=>k.profileId===data.activeProfileId)
 const people:Person[]=[me,...kids.map(k=>({id:k.id,name:k.name,emoji:k.emoji,photo:k.photo,color:k.color}))]
 // Untagged things in a family plan are everyone's.
 const family:Person=kids.length?{id:'family',name:'Family',emoji:'👪',color:me.color}:me
 const personFor=(kidId?:string)=>people.find(p=>p.id===kidId)??family
 // The family plan (which already carries what's in each kid's own plan, tagged to them), in time order.
 const itemsFor=(date:string)=>kidItemsForDate(data,data.activeProfileId,date).sort((a,b)=>(a.time??'99:99').localeCompare(b.time??'99:99')||a.title.localeCompare(b.title))
 const clock=now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})
 const forecast=weather.find(w=>w.date===today)
 // Countdowns (not today's or tomorrow's, which show in their day) in the header, up to three.
 const countdowns=upcomingSpecial(data,data.activeProfileId,today,90).filter(x=>x.day.kind==='countdown'&&x.daysAway>1).slice(0,3)
 // Wide screens: the rest of the week, a few lines a day.
 const week=<section className="wall-week" aria-label="Rest of the week"><h2>This week</h2>{Array.from({length:5},(_,i)=>addDays(today,i+2)).map(date=>{const items=itemsFor(date),special=specialOn(data,data.activeProfileId,date);return <div key={date} className="wall-week-day"><h3>{new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'})}<small>{new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></h3>{special.map(x=><p key={x.day.id} className="wall-week-special">{x.icon} {x.label}</p>)}{items.length?<ul>{items.slice(0,4).map(i=>{const p=personFor(i.kidId);return <li key={i.kind+i.id+(i.kidId??'')} style={{'--person':p.color} as CSSProperties}><span className="wall-week-time">{i.time?classTime(i.time):i.kind==='exam'?'Test':i.kind==='task'?'Due':''}</span><span className="wall-week-title">{i.title}</span><Avatar className="wall-week-face" who={p}/></li>})}{items.length>4&&<li className="wall-week-more">+{items.length-4} more</li>}</ul>:!special.length&&<p className="wall-week-empty">Free</p>}</div>})}</section>
 const day=(date:string,label:string)=>{
  const items=itemsFor(date),nowClock=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')
  return <section className="wall-day" aria-label={label}>
   <h2>{label}<small>{new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</small></h2>
   {specialOn(data,data.activeProfileId,date).map(x=><p key={x.day.id} className="wall-special" style={{'--person':personFor(x.day.kidId).color} as CSSProperties}><span aria-hidden="true">{x.icon}</span> {x.label}</p>)}
   {items.length?<ul>{items.map(i=>{const p=personFor(i.kidId),past=date===today&&!!i.time&&i.time<nowClock&&i.kind!=='task';return <li key={i.kind+i.id+(i.kidId??'')} className={'wall-item is-'+i.kind+(i.done?' is-done':'')+(past?' is-past':'')} style={{'--person':p.color} as CSSProperties}>
    <span className="wall-time">{i.time?classTime(i.time):i.kind==='task'?'Due':i.kind==='exam'?'Test':'All day'}</span>
    <Avatar className="wall-face" who={p}/>
    <span className="wall-title">{kindIcon[i.kind]&&<span aria-hidden="true">{kindIcon[i.kind]} </span>}{i.title}<small>{p.name}</small></span>
   </li>})}</ul>:<p className="wall-empty">Nothing planned.</p>}
  </section>
 }
 return <div className={'wall-display'+(night?' is-night':'')} role="dialog" aria-modal="true" aria-label="Wall display">
  <header className="wall-head">
   <div><p className="wall-clock">{clock}</p><p className="wall-date">{now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p></div>
   {countdowns.length>0&&<ul className="wall-countdowns" aria-label="Counting down">{countdowns.map(x=><li key={x.day.id}><span aria-hidden="true">{x.icon}</span> {x.label}<b>{daysAwayLabel(x.daysAway)}</b></li>)}</ul>}
   {forecast&&<p className="wall-weather" aria-label={'Weather: high '+Math.round(forecast.highF)+', low '+Math.round(forecast.lowF)}><span aria-hidden="true">{weatherEmoji[forecast.weather]}</span>{Math.round(forecast.highF)}°<small>{Math.round(forecast.lowF)}°</small></p>}
   <button type="button" className="wall-night" aria-pressed={night} title={night?'Back to the day look':'Dim for the night'} onClick={toggleNight}><span aria-hidden="true">{night?'☀️':'🌙'}</span> {night?'Day':'Night'}</button>
   <button type="button" className="wall-close" onClick={close}>Close</button>
  </header>
  <div className="wall-days">{night&&now.getHours()>=NIGHT_FROM?<>{day(tomorrow,'Tomorrow')}{day(today,'Today')}</>:<>{day(today,'Today')}{day(tomorrow,'Tomorrow')}</>}{week}</div>
  <footer className="wall-people" aria-label="Who's who">{people.map(p=><span key={p.id} style={{'--person':p.color} as CSSProperties}><Avatar who={p}/>{p.name}</span>)}</footer>
 </div>
}
