import type { ReactNode } from 'react'
import type { DailyWeatherForecast } from '../game/weather/liveWeather'

const navItems=['Sanctuary','Planner','Subjects','Notes','K-Quiz','Exams','Settings'] as const
export type ViewName=typeof navItems[number]

const iconPaths:Record<ViewName,ReactNode>={
 Sanctuary:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9 20v-6h6v6"/></>,
 Planner:<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7 3v4M17 3v4M3.5 9.5h17"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/></>,
 Subjects:<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z"/></>,
 Notes:<><path d="M6 3.5h9l3 3V20.5H6z"/><path d="M15 3.5v3h3M9 11h6M9 15h6"/></>,
 'K-Quiz':<><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M9 20h6M12 16v4"/><circle cx="12" cy="10" r="2.4"/></>,
 Exams:<><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
 Settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.38.37.72.6 1 .3.35.7.55 1.1.6h.1v4h-.1c-.4.05-.8.25-1.1.6-.23.28-.44.62-.6 1z"/></>
}
export function NavIcon({name,experience}:{name:ViewName;experience?:string}){
 return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={experience==='sumi'?1.2:experience==='modern'?1.5:1.8} strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>
}

const weatherEmoji:Record<DailyWeatherForecast['weather'],string>={clear:'☀️',cloudy:'☁️',rain:'🌧️',wind:'💨',snow:'❄️'}
const weekdayShort=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})

export function WeekWeather({days}:{days:DailyWeatherForecast[]}){
 if(!days.length)return null
 return <div className="mobile-week-weather" aria-label="Weekly weather forecast">{days.slice(0,7).map((day,i)=><div className="mobile-week-weather-day" key={day.date}><small>{i===0?'Today':weekdayShort(day.date)}</small><span aria-hidden="true">{weatherEmoji[day.weather]}</span><b>{day.highF}°</b><i>{day.lowF}°</i></div>)}</div>
}

type ProfileOption={id:string;label:string}
export default function Sidebar({view,onView,profile='Sophia',schoolYear='Summer 2026',profiles=[],activeProfileId,onProfileChange,musicPlayer,weekWeather=[]}:{view:ViewName;onView:(v:ViewName)=>void;profile?:string;schoolYear?:string;profiles?:ProfileOption[];activeProfileId?:string;onProfileChange?:(id:string)=>void;musicPlayer?:ReactNode;weekWeather?:DailyWeatherForecast[]}){
 return <><aside className="sidebar"><div className="brand"><div className="brand-mark" aria-hidden="true"><span>K</span><i>✿</i></div><div><h1>KONO</h1><p>Study Sanctuary</p></div></div><div className="sidebar-section-label">Notebook tabs</div><nav className="nav-list">{navItems.map(item=><button className={`nav-button ${view===item?'active':''}`} key={item} onClick={()=>onView(item)}><span className="nav-icon"><NavIcon name={item}/></span><span>{item}</span><i className="nav-petal" aria-hidden="true">✦</i></button>)}</nav><div className="sidebar-player-slot">{musicPlayer}</div><section className="season-card profile-dock"><div className="profile-avatar">{profile.slice(0,1).toUpperCase()}</div><div className="profile-dock-copy"><span>{profile}</span><strong>{schoolYear}</strong><small>Active study profile</small></div>{profiles.length>0&&<select aria-label="Switch study profile" value={activeProfileId} onChange={e=>onProfileChange?.(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>}</section></aside><header className="mobile-desk-header"><div className="mobile-brand-row"><div className="mobile-brand-lockup"><div className="brand-mark" aria-hidden="true"><span>K</span><i>✿</i></div><div><h1>KONO</h1><p>Study Sanctuary</p></div></div><div className="mobile-profile-chip"><span>{profile}</span><small>{schoolYear}</small>{profiles.length>0&&<select aria-label="Switch study profile" value={activeProfileId} onChange={e=>onProfileChange?.(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>}</div></div><div className="mobile-tabs-label">Notebook tabs</div><nav className="mobile-nav">{navItems.map(item=><button className={view===item?'active':''} key={item} onClick={()=>onView(item)}><span><NavIcon name={item}/></span><small>{item}</small><i aria-hidden="true">✦</i></button>)}</nav><WeekWeather days={weekWeather}/><div className="mobile-player-slot">{musicPlayer}</div></header></>
}
