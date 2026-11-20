import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { DailyWeatherForecast } from '../game/weather/liveWeather'
import type { useMusicController } from '../hooks/useComfort'
import MusicPlayer from './MusicPlayer'
import BrandLogo from './BrandLogo'
import Icon from './Icon'

const navItems=['Today','Planner','Kids','Subjects','Study','Notes','K-Quiz','Exams','Sanctuary','Settings'] as const
/** Notes, K-Quiz and Exams are Study's pages: the navigation shows Study for them. */
const studyPages=new Set<string>(['Notes','K-Quiz','Exams'])
/** What a tab is called, where it isn't its page's name (the Sanctuary is KONO's page; Kids is the family's). */
const navLabel=(item:string)=>item==='Sanctuary'?'KONO':item==='Kids'?'Family':item==='Subjects'?'Classes':item
export type ViewName=typeof navItems[number]

/** Each tab's icon (components/Icon): one drawn set for every look. */
const tabIcon:Record<ViewName,string>={Today:'today',Planner:'planner',Kids:'family',Subjects:'classes',Study:'study',Notes:'notes','K-Quiz':'kquiz',Exams:'tests',Sanctuary:'kono',Settings:'settings'}
export function NavIcon({name}:{name:ViewName;experience?:string}){
 return <Icon name={tabIcon[name]??'info'} className="nav-glyph"/>
}

const weatherEmoji:Record<DailyWeatherForecast['weather'],string>={clear:'☀️',cloudy:'☁️',rain:'🌧️',wind:'💨',snow:'❄️'}
const weekdayShort=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})

export function WeekWeather({days,location}:{days:DailyWeatherForecast[];location?:string}){
 if(!days.length)return null
 const cells=days.slice(0,7).map((day,i)=><div className="mobile-week-weather-day" key={day.date}><small>{i===0?'Today':weekdayShort(day.date)}</small><span aria-hidden="true">{weatherEmoji[day.weather]}</span><b>{day.highF}°</b><i>{day.lowF}°</i></div>)
 // Opens the saved location's forecast on weather.com in a new tab -- only when a location is actually
 // configured; with none, this stays a plain (non-interactive) readout instead of linking nowhere useful.
 if(location?.trim())return <a className="mobile-week-weather" aria-label={`Weekly weather forecast for ${location.trim()} — opens weather.com`} href={`https://weather.com/weather/today/l/${encodeURIComponent(location.trim())}`} target="_blank" rel="noopener noreferrer">{cells}</a>
 return <div className="mobile-week-weather" aria-label="Weekly weather forecast">{cells}</div>
}

/** A small mark on the current tab. When the tab changes it slides over from the previous one: each
 * mark starts at the old tab's position and animates to its own (Web Animations API, no library). */
function NavIndicator({nav}:{nav:string}){return <b className="nav-indicator" data-nav={nav} aria-hidden="true"/>}
function useSlidingIndicator(view:string){
 const last=useRef(new Map<string,{x:number;y:number}>())
 useLayoutEffect(()=>{
  for(const mark of document.querySelectorAll<HTMLElement>('.nav-indicator[data-nav]')){
   const tab=mark.parentElement;if(!tab)continue
   const now={x:tab.offsetLeft,y:tab.offsetTop},before=last.current.get(mark.dataset.nav!)
   last.current.set(mark.dataset.nav!,now)
   if(!before||!tab.offsetWidth||document.documentElement.dataset.motion!=='full'||typeof mark.animate!=='function')continue
   mark.animate([{transform:`translate(${before.x-now.x}px,${before.y-now.y}px)`},{transform:'none'}],{duration:340,easing:'cubic-bezier(.3,1.25,.5,1)'})
  }
 },[view])
}

type ProfileOption={id:string;label:string;avatar?:string;photo?:string;color?:string}
export default function Sidebar({hidden=[],view:page,onView,profile='Sophia',schoolYear='Summer 2026',profiles=[],activeProfileId,onProfileChange,weekWeather=[],weatherLocation,music,parentMode=false,weatherChip,onOpenPlans,locked=false,onAdd,onMore,simple=false}:{hidden?:string[];simple?:boolean;onAdd?:()=>void;onMore?:()=>void;locked?:boolean;onOpenPlans?:()=>void;weatherChip?:ReactNode;view:ViewName;onView:(v:ViewName)=>void;profile?:string;schoolYear?:string;profiles?:ProfileOption[];activeProfileId?:string;onProfileChange?:(id:string)=>void;weekWeather?:DailyWeatherForecast[];weatherLocation?:string;music?:ReturnType<typeof useMusicController>;parentMode?:boolean}){
 // Parent mode is opt-in (see Settings > Family) so a student sharing the app never sees a nav
 // tab meant for a parent managing multiple kids.
 // A device locked to a kid's plan has no Settings tab (a parent unlocks it from Whose plan?).
 // Simple view keeps just Today, the Planner, Notes and KONO (and Settings when the device isn't locked).
 const me=profiles.find(p=>p.id===activeProfileId),view=(studyPages.has(page)?'Study':page) as ViewName
 const items=navItems.filter(item=>!studyPages.has(item)&&!hidden.includes(item)&&(item!=='Kids'||parentMode)&&!(locked&&item==='Settings')&&(!simple||['Today','Planner','Study','Sanctuary','Settings'].includes(item))&&(item!=='Study'||[...studyPages].some(x=>!hidden.includes(x))))
 // Phones: a bottom tab bar with the everyday pages (Today, the Planner, the family for a parent, KONO), ＋ Add in
 // the middle, and More for the rest.
 const everyday=(['Today','Planner',...(parentMode&&items.includes('Kids')?['Kids']:[]),'Sanctuary'] as ViewName[]).filter(i=>items.includes(i))
 const tabbar:(ViewName|'Add'|'More')[]=[...everyday.slice(0,2),...(onAdd?['Add' as const]:[]),...everyday.slice(2),'More']
 const moreActive=!everyday.includes(view)
 useSlidingIndicator(view)
 return <><aside className="sidebar"><div className="brand"><div className="brand-mark" aria-hidden="true"><BrandLogo/><i>✿</i></div><div><div className="brand-title-row"><h1 role="none">KONO</h1>{weatherChip}</div><p>Study Sanctuary</p></div></div><div className="sidebar-section-label">Notebook tabs</div><nav className="nav-list" aria-label="Notebook tabs">{items.map(item=><button className={`nav-button ${view===item?'active':''}`} key={item} data-tab={item} onClick={()=>onView(item)}><span className="nav-icon"><NavIcon name={item}/></span><span>{navLabel(item)}</span><i className="nav-petal" aria-hidden="true">✦</i>{view===item&&<NavIndicator nav="side"/>}</button>)}</nav>{music&&<div className="sidebar-music-slot"><MusicPlayer controller={music} compact/></div>}<section className="season-card profile-dock"><div className={'profile-avatar'+(me?.photo?' has-photo':me?.avatar?' has-emoji':'')} style={me?.color?{background:me.color}:undefined}>{me?.photo?<img className="avatar-img" src={me.photo} alt="" draggable={false}/>:me?.avatar||profile.slice(0,1).toUpperCase()}</div><div className="profile-dock-copy"><span>{profile}</span><strong>{schoolYear}</strong><small>{parentMode?'Family calendar':'Active study profile'}</small></div>{onOpenPlans?<button type="button" className="plan-switch-button" onClick={onOpenPlans}>Whose plan?</button>:profiles.length>0&&<select aria-label="Switch study profile" value={activeProfileId} onChange={e=>onProfileChange?.(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>}</section></aside><header className="mobile-desk-header"><div className="mobile-brand-row"><div className="mobile-brand-lockup"><div className="brand-mark" aria-hidden="true"><BrandLogo/><i>✿</i></div><div><div className="brand-title-row"><h1 role="none">KONO</h1>{weatherChip}</div><p>Study Sanctuary</p></div></div><div className="mobile-profile-chip"><i className="mobile-profile-avatar" aria-hidden="true" style={me?.color?{background:me.color}:undefined}>{me?.photo?<img className="avatar-img" src={me.photo} alt="" draggable={false}/>:me?.avatar||profile.slice(0,1).toUpperCase()}</i><span>{profile}</span><small>{schoolYear}</small>{onOpenPlans?<button type="button" className="plan-chip-open" aria-label={'Whose plan? Now: '+schoolYear} onClick={onOpenPlans}/>:profiles.length>0&&<select aria-label="Switch study profile" value={activeProfileId} onChange={e=>onProfileChange?.(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>}</div></div><div className="mobile-tabs-label">Notebook tabs</div>{onMore?<nav className="mobile-nav is-tabbar" aria-label="Pages" style={{'--tabs':tabbar.length} as CSSProperties}>{tabbar.map(item=>item==='Add'?<button key="add" type="button" className="mobile-nav-add" aria-label="Add" onClick={onAdd}><span aria-hidden="true">＋</span><small>Add</small></button>:item==='More'?<button key="more" type="button" className={moreActive?'active':''} aria-label="More" onClick={onMore}><span aria-hidden="true">⋯</span><small>More</small>{moreActive&&<NavIndicator nav="mobile"/>}</button>:<button className={view===item?'active':''} key={item} data-tab={item} aria-label={navLabel(item)} onClick={()=>onView(item)}><span><NavIcon name={item}/></span><small>{navLabel(item)}</small>{view===item&&<NavIndicator nav="mobile"/>}</button>)}</nav>
 :<nav className={'mobile-nav'+(items.length>7?' is-crowded':'')} aria-label="Pages" style={{'--nav-cols':items.length} as CSSProperties}>{items.map(item=><button className={view===item?'active':''} key={item} data-tab={item} aria-label={navLabel(item)} onClick={()=>onView(item)}><span><NavIcon name={item}/></span><small>{navLabel(item)}</small><i aria-hidden="true">✦</i>{view===item&&<NavIndicator nav="mobile"/>}</button>)}</nav>}<WeekWeather days={weekWeather} location={weatherLocation}/></header></>
}
