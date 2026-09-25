import {useState,type CSSProperties,type FormEvent,type SetStateAction} from 'react'
import type { SanctuaryWeather } from './game/sanctuary/types'
import { isValidWeatherLocation, normalizeWeatherLocation, type LiveWeatherState } from './game/weather/liveWeather'
import { notificationsSupported, requestNotificationPermission } from './hooks/useDueNotifications'
import { createSanctuaryProgress } from './game/progression/progressionEngine'
import { uid, localDate as iso, type AppData, type ProfileKind, type SettingsData } from './store/model'
import SafeNoteBody from './components/SafeNoteBody'
import './production.css'
import './App.css'
import './foundation.css'
import './identity.css'
import './coral.css'
import './sanctuary.css'

type SetAppData=(action:SetStateAction<AppData>)=>Promise<boolean>


const timeParts=(value:string)=>{const [rawHour='0',minute='00']=value.split(':');const hour24=Number(rawHour)||0;return {hour:String(hour24%12||12),minute:minute.padStart(2,'0'),period:(hour24>=12?'PM':'AM') as 'AM'|'PM'}}
const to24Hour=(hour:string,minute:string,period:'AM'|'PM')=>{let h=Math.max(1,Math.min(12,Number(hour)||12));if(period==='AM'&&h===12)h=0;if(period==='PM'&&h!==12)h+=12;return `${String(h).padStart(2,'0')}:${minute.padStart(2,'0')}`}
export function TwelveHourTimeInput({value,onChange,label}:{value:string;onChange:(value:string)=>void;label:string}){const parts=timeParts(value);const update=(next:Partial<typeof parts>)=>{const merged={...parts,...next};onChange(to24Hour(merged.hour,merged.minute,merged.period))};return <div className="time-12-input" aria-label={label}><select aria-label={`${label} hour`} value={parts.hour} onChange={e=>update({hour:e.target.value})}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}</option>)}</select><span>:</span><select aria-label={`${label} minute`} value={parts.minute} onChange={e=>update({minute:e.target.value})}>{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m} value={m}>{m}</option>)}</select><select aria-label={`${label} AM or PM`} value={parts.period} onChange={e=>update({period:e.target.value as 'AM'|'PM'})}><option value="AM">AM</option><option value="PM">PM</option></select></div>}


type StickyNoteViewProps={
  kind:'note'|'exam'|'preview-note'|'preview-exam'
  color:string
  textColor:string
  font?:string
  pinned?:boolean
  completed?:boolean
  pinIndex?:number
  subject?:string
  subjectGlyph?:string
  title:string
  body?:string
  highlight?:string
  dateLabel?:string
  countdown?:number
  sourceLabel?:string
  onEdit?:()=>void
  onDelete?:()=>void
  onTogglePin?:()=>void
  onToggleComplete?:()=>void
}

export function StickyNoteView({kind,color,textColor,font='rounded',pinned=false,completed=false,pinIndex=0,subject='Subject',subjectGlyph='•',title,body='',highlight='transparent',dateLabel,countdown,sourceLabel,onEdit,onDelete,onTogglePin,onToggleComplete}:StickyNoteViewProps){
 const preview=kind.startsWith('preview')
 const exam=kind.includes('exam')
 return <article className={`kono-sticky sticky-note-system kono-sticky-${preview?'preview':'full'} kono-sticky-${exam?'exam':'note'} note-font-${font} ${pinned?'is-pinned':''} ${completed?'is-complete':''}`} style={{'--paper':color,'--ink':textColor,color:textColor} as CSSProperties}>
  <span className={`kono-pin pin-${pinIndex%5}`} aria-hidden="true"/>
  <span className="kono-fold" aria-hidden="true"/>
  {onDelete&&<button type="button" className="kono-sticky-delete" aria-label={`Delete ${exam?'exam':'note'}`} onClick={onDelete}>×</button>}
  <span className="kono-sticky-subject"><b>{subjectGlyph}</b>{subject}</span>
  {exam&&typeof countdown==='number'&&<div className="kono-countdown"><b>{countdown}</b><small>days</small></div>}
  <h3>{title}</h3>
  <div className="kono-sticky-body" style={{background:highlight}} ><SafeNoteBody text={body||'Add details here.'}/></div>
  <footer className="kono-sticky-footer">
   <span>{dateLabel||sourceLabel||(pinned?'Pinned note':exam?'Upcoming exam':'Study note')}</span>
   <div className="kono-sticky-actions">
    {onEdit&&<button type="button" onClick={onEdit}>✎ Edit</button>}
    {onTogglePin&&<button type="button" onClick={onTogglePin}>{pinned?'📌 Unpin':'📍 Pin'}</button>}
    {onToggleComplete&&<button type="button" className="bubble-complete" onClick={onToggleComplete}><span>★</span>{completed?'Reopen':'Finish'}</button>}
   </div>
  </footer>
 </article>
}

const settingUpdater=(setData:SetAppData)=><K extends keyof SettingsData>(key:K,value:SettingsData[K])=>setData(d=>({...d,settings:{...d.settings,[key]:value}}))
const activeProfile=(data:AppData)=>data.profiles.find(p=>p.id===data.activeProfileId)??data.profiles[0]
/** Switch, create or delete plans, and reset the active plan's progress. */
export function PlanSettings({data,setData,onDeleteProfile}:{data:AppData;setData:SetAppData;onDeleteProfile?:(id:string)=>void}){
 const profile=activeProfile(data)
 const [name,setName]=useState(profile.name)
 const [label,setLabel]=useState('New School Year')
 const [kind,setKind]=useState<ProfileKind>('school')
 const add=(e:FormEvent)=>{e.preventDefault();const id=uid('profile');setData(d=>{const start=iso(new Date()),end=iso(new Date(Date.now()+180*86400000));return {...d,profiles:[...d.profiles,{id,name,label,kind,start,end}],sanctuaryProgress:{...d.sanctuaryProgress,[id]:createSanctuaryProgress(id)},activeProfileId:id}})}
 return <div className="settings-stack">
  <section id="profile-settings" className="card"><div className="card-head"><div><span className="eyebrow">Profiles</span><h3>Switch active plan</h3></div></div><div className="profile-grid">{data.profiles.map(p=><button type="button" key={p.id} className={data.activeProfileId===p.id?'active':''} onClick={()=>setData(d=>({...d,activeProfileId:p.id}))}><strong>{p.label}</strong><span>{p.name} · {p.kind}</span><small>{p.start} – {p.end}</small></button>)}</div></section>
  <div className="profile-delete-list">{onDeleteProfile&&data.profiles.map(p=><div className="wb-toolbar" key={p.id}><strong>{p.label}{p.id===data.activeProfileId?' · Active':''}</strong><button disabled={data.profiles.length<2} onClick={()=>onDeleteProfile(p.id)}>Delete plan</button></div>)}<p>Deleting a plan includes its saved work. Keep at least one plan. Export a backup (Import &amp; export) first.</p></div>
  <form className="card profile-form" onSubmit={add}><div><span className="eyebrow">Create profile</span><h3>Add summer, school year, or semester</h3></div><input maxLength={200} required aria-label="Student name" value={name} onChange={e=>setName(e.target.value)} placeholder="Student name"/><input maxLength={200} required aria-label="Plan name" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Profile label"/><select value={kind} onChange={e=>setKind(e.target.value as ProfileKind)}><option value="summer">Summer</option><option value="school">School year</option><option value="college">College semester</option><option value="custom">Custom</option></select><button className="primary">＋ Create profile</button></form>
  <details className="wb-panel settings-group"><summary>Reset this plan’s progress</summary><section className="card danger-zone"><h3>Reset this plan’s progress</h3><p>Keeps your assignments and notes, reopens assignments, and resets only this plan’s Sanctuary. Export a backup first.</p><button className="secondary" onClick={()=>{if(!window.confirm('Reopen every assignment and reset Sanctuary progress for '+profile.label+'?'))return;setData(d=>({...d,profiles:d.profiles.map(p=>p.id===profile.id?{...p,progressEpoch:uid('epoch')}:p),tasks:d.tasks.map(t=>t.profileId===profile.id?{...t,done:false,completedAt:undefined}:t),sanctuaryProgress:{...d.sanctuaryProgress,[profile.id]:createSanctuaryProgress(profile.id)}}))}}>Reset this plan’s progress</button></section></details>
 </div>
}
/** Live, manual or clear Sanctuary weather, and the live-weather location. */
export function WeatherSettings({data,setData,weatherState}:{data:AppData;setData:SetAppData;weatherState:LiveWeatherState}){
 const profile=activeProfile(data),updateSetting=settingUpdater(setData)
 const savedLocation=data.settings.sanctuaryWeatherLocations[profile.id]??data.settings.sanctuaryZipCodes[profile.id]??''
 const [locationDraft,setLocationDraft]=useState(savedLocation)
 const [locationMessage,setLocationMessage]=useState('')
 const saveLocation=(event:FormEvent)=>{event.preventDefault();const normalized=normalizeWeatherLocation(locationDraft);if(!isValidWeatherLocation(normalized)){setLocationMessage('Enter a city, region, country, or 5-digit U.S. ZIP code.');return}setData(d=>({...d,settings:{...d.settings,sanctuaryWeatherLocations:{...d.settings.sanctuaryWeatherLocations,[profile.id]:normalized}}}));setLocationDraft(normalized);setLocationMessage('Weather location saved. Updating the Sanctuary…')}
 const applyWeatherPreset=(value:string)=>{setLocationDraft(value);setLocationMessage('');setData(d=>({...d,settings:{...d.settings,sanctuaryWeatherLocations:{...d.settings.sanctuaryWeatherLocations,[profile.id]:value}}}))}
 const weatherUpdated=weatherState.reading?new Date(weatherState.reading.fetchedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''
 return <section id="weather-settings" className="card live-weather-settings"><div className="card-head"><div><span className="eyebrow">Living Sanctuary</span><h3>Weather location</h3><p>Use a U.S. ZIP code or any city, province/state, and country. Montréal, Quebec, Canada is included as a one-tap preset.</p></div><div className={`weather-source-badge ${weatherState.source}`}>{weatherState.source==='live'?'● Live':weatherState.source==='cache'?'◐ Cached':weatherState.source==='loading'?'○ Updating':'○ Fallback'}</div></div>
   <div className="weather-mode-grid">
    <button type="button" className={data.settings.sanctuaryWeatherMode==='live'?'active':''} onClick={()=>updateSetting('sanctuaryWeatherMode','live')}><span>{data.settings.sanctuaryWeatherMode==='live'?'●':'○'}</span><div><strong>Live weather</strong><small>Match the Sanctuary to your saved location.</small></div></button>
    <button type="button" className={data.settings.sanctuaryWeatherMode==='manual'?'active':''} onClick={()=>updateSetting('sanctuaryWeatherMode','manual')}><span>{data.settings.sanctuaryWeatherMode==='manual'?'●':'○'}</span><div><strong>Manual weather</strong><small>Choose a fixed ambience for the Sanctuary.</small></div></button>
    <button type="button" className={data.settings.sanctuaryWeatherMode==='clear'?'active':''} onClick={()=>updateSetting('sanctuaryWeatherMode','clear')}><span>{data.settings.sanctuaryWeatherMode==='clear'?'●':'○'}</span><div><strong>Clear only</strong><small>Keep the Sanctuary calm and precipitation-free.</small></div></button>
   </div>
   {data.settings.sanctuaryWeatherMode==='live'&&<div className="live-weather-editor"><div className="weather-location-presets"><button type="button" className={savedLocation==='Montreal, Quebec, Canada'?'active':''} onClick={()=>applyWeatherPreset('Montreal, Quebec, Canada')}><span>🍁</span><div><strong>Montréal, Quebec, Canada</strong><small>Use Montréal weather for this profile</small></div></button><button type="button" className={savedLocation==='02050'?'active':''} onClick={()=>applyWeatherPreset('02050')}><span>⌂</span><div><strong>02050 · Massachusetts</strong><small>Keep the original U.S. ZIP option</small></div></button></div><form onSubmit={saveLocation}><label htmlFor="sanctuary-weather-location"><strong>Weather location for {profile.label}</strong><small>Examples: Montreal, Quebec, Canada · Boston, MA, USA · 02050</small></label><div className="weather-location-entry"><input id="sanctuary-weather-location" value={locationDraft} onChange={e=>{setLocationDraft(e.target.value);setLocationMessage('')}} placeholder="Montreal, Quebec, Canada"/><button className="primary">Save location</button></div>{locationMessage&&<p className={locationMessage.startsWith('Enter')?'zip-message error':'zip-message'}>{locationMessage}</p>}</form><div className={`weather-reading-card ${weatherState.weather}`}><span className="weather-reading-icon" aria-hidden="true">{weatherState.weather==='rain'?'☂':weatherState.weather==='snow'?'❄':weatherState.weather==='wind'?'⌁':weatherState.weather==='cloudy'?'☁':'☀'}</span><div>{weatherState.reading?<><strong>{weatherState.reading.locationName}{weatherState.reading.region?`, ${weatherState.reading.region}`:''}{weatherState.reading.country?` · ${weatherState.reading.country}`:''}</strong><span>{weatherState.reading.condition} · {weatherState.reading.temperatureF}°F</span><small>{weatherState.reading.cloudCover}% cloud cover · {weatherState.reading.windMph} mph wind{weatherUpdated?` · Updated ${weatherUpdated}`:''}</small></>:<><strong>{weatherState.source==='loading'?'Finding current weather…':'Live weather unavailable'}</strong><span>{weatherState.error??'KONO is using the manual fallback until weather data returns.'}</span><small>Saved location: {savedLocation||'None'}</small></>}</div></div></div>}
   {data.settings.sanctuaryWeatherMode==='manual'&&<label className="manual-weather-row"><div><strong>Manual Sanctuary weather</strong><small>Debug controls can still temporarily override this selection.</small></div><select value={data.settings.sanctuaryWeather} onChange={e=>updateSetting('sanctuaryWeather',e.target.value as SanctuaryWeather)}><option value="clear">Clear</option><option value="cloudy">Cloudy</option><option value="rain">Rain</option><option value="wind">Breezy</option><option value="snow">Snow</option></select></label>}
  <small className="weather-attribution">Weather data by Open-Meteo. City and regional searches use the Open-Meteo geocoding service.</small></section>
}
/** Sounds and motion: part of how KONO looks and feels. */
export function SoundMotionSettings({data,setData}:{data:AppData;setData:SetAppData}){
 const updateSetting=settingUpdater(setData)
 return <section className="card settings-list"><label><div><strong>Completion sound</strong><small>Play your uploaded confirmation sound when a task is checked off</small></div><input type="checkbox" checked={data.settings.sound} onChange={e=>updateSetting('sound',e.target.checked)}/></label><label><div><strong>Ambient sound</strong><small>Soft piano and sanctuary ambience</small></div><input type="checkbox" checked={data.settings.ambient} onChange={e=>updateSetting('ambient',e.target.checked)}/></label><label><div><strong>Motion preference</strong><small>Applies to the Sanctuary and interface</small></div><select value={data.settings.motionPreference??'system'} onChange={e=>updateSetting('motionPreference',e.target.value as SettingsData['motionPreference'])}><option value="system">Follow device</option><option value="reduced">Reduced motion</option><option value="full">Full animation</option></select></label></section>
}
/** Reminders while KONO is open, the due-soon summary, and browser notifications. */
export function ReminderSettings({data,setData}:{data:AppData;setData:SetAppData}){
 const updateSetting=settingUpdater(setData)
 return <section className="card settings-list"><label><div><strong>Gentle reminders</strong><small>Show due and overdue work while KONO is open; no background notifications</small></div><input type="checkbox" checked={data.settings.reminders} onChange={e=>updateSetting('reminders',e.target.checked)}/></label><label><div><strong>What's due soon, on open</strong><small>Show a dismissible summary of what's due in the next 3 days each time you open KONO</small></div><input type="checkbox" checked={data.settings.loginDigest!==false} onChange={e=>updateSetting('loginDigest',e.target.checked)}/></label>{notificationsSupported()&&<label><div><strong>Browser notifications</strong><small>One daily digest listing what's due today, plus a nudge when a time you planned for an assignment (see its Estimated time field) actually arrives — even in another tab. Stays quiet during a class on your own schedule. Your browser asks to allow this once.</small></div><input type="checkbox" checked={Boolean(data.settings.browserNotifications)&&Notification.permission==='granted'} onChange={e=>{if(!e.target.checked){updateSetting('browserNotifications',false);return}void requestNotificationPermission().then(permission=>{updateSetting('browserNotifications',permission==='granted')})}}/></label>}{Boolean(data.settings.browserNotifications)&&notificationsSupported()&&Notification.permission!=='granted'&&<p className="wb-muted">Notifications were blocked. Allow them for this site in your browser settings, then turn this back on.</p>}</section>
}
