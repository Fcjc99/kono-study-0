import {useEffect,useState,type CSSProperties} from 'react'
import {localDate,type AppData} from '../store/model'
import {kidItemsForDate,type KidItem} from '../store/kids'
import {classTime} from '../store/classSchedule'
import {addDays} from '../store/studyScheduler'
import type {DailyWeatherForecast} from '../game/weather/liveWeather'
import Avatar from './Avatar'
import './wall-display.css'

type Person={id:string;name:string;emoji?:string;photo?:string;color:string}
const weatherEmoji:Record<DailyWeatherForecast['weather'],string>={clear:'☀️',cloudy:'☁️',rain:'🌧️',wind:'💨',snow:'❄️'}
const kindIcon:Record<KidItem['kind'],string>={task:'📌',exam:'📝',event:'',class:''}

/** Wall display: a big, always-on view of today and tomorrow for the whole family, for an old tablet on
 * the fridge (like a family wall calendar). The clock ticks, the day rolls over at midnight, changes
 * from other devices show up as they sync, and the screen is kept awake where the browser allows it. */
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
 const day=(date:string,label:string)=>{
  const items=itemsFor(date),nowClock=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')
  return <section className="wall-day" aria-label={label}>
   <h2>{label}<small>{new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</small></h2>
   {items.length?<ul>{items.map(i=>{const p=personFor(i.kidId),past=date===today&&!!i.time&&i.time<nowClock&&i.kind!=='task';return <li key={i.kind+i.id+(i.kidId??'')} className={'wall-item is-'+i.kind+(i.done?' is-done':'')+(past?' is-past':'')} style={{'--person':p.color} as CSSProperties}>
    <span className="wall-time">{i.time?classTime(i.time):i.kind==='task'?'Due':i.kind==='exam'?'Test':'All day'}</span>
    <Avatar className="wall-face" who={p}/>
    <span className="wall-title">{kindIcon[i.kind]&&<span aria-hidden="true">{kindIcon[i.kind]} </span>}{i.title}<small>{p.name}</small></span>
   </li>})}</ul>:<p className="wall-empty">Nothing planned.</p>}
  </section>
 }
 return <div className="wall-display" role="dialog" aria-modal="true" aria-label="Wall display">
  <header className="wall-head">
   <div><p className="wall-clock">{clock}</p><p className="wall-date">{now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p></div>
   {forecast&&<p className="wall-weather" aria-label={'Weather: high '+Math.round(forecast.highF)+', low '+Math.round(forecast.lowF)}><span aria-hidden="true">{weatherEmoji[forecast.weather]}</span>{Math.round(forecast.highF)}°<small>{Math.round(forecast.lowF)}°</small></p>}
   <button type="button" className="wall-close" onClick={close}>Close</button>
  </header>
  <div className="wall-days">{day(today,'Today')}{day(tomorrow,'Tomorrow')}</div>
  <footer className="wall-people" aria-label="Who's who">{people.map(p=><span key={p.id} style={{'--person':p.color} as CSSProperties}><Avatar who={p}/>{p.name}</span>)}</footer>
 </div>
}
