import type { ReactNode } from 'react'

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
// Journal, Dashboard, Zine and Arcade each get their own icon set instead of sharing the default
// outline glyphs recolored — a diary reads as sketched motifs (house-with-a-heart, an open book, a
// lightbulb, a medal, a pen nib), a dashboard as literal widgets (gauge, bar chart, a checked KPI
// card, sliders), a zine as bold solid stickers (fill, not stroke), an arcade as a retro pixel HUD
// (blocky house, joystick, coin, power switch) — real shape differences, not a palette swap.
const themedIconPaths:Partial<Record<string,Record<ViewName,ReactNode>>>={
 journal:{
  Sanctuary:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M10.4 16.6c-1.5-1.2-1.5-2.8 0-3.3.85-.3 1.25.2 1.4.55.15-.35.55-.85 1.4-.55 1.5.5 1.5 2.1 0 3.3L12.2 17.3Z"/></>,
  Planner:<><path d="M12 6.2c-1.9-1.2-4.7-1.4-6.6-.8v12.4c1.9-.7 4.7-.5 6.6.8 1.9-1.3 4.7-1.5 6.6-.8V5.4c-1.9-.6-4.7-.4-6.6.8Z"/><path d="M12 6.2v12.4"/></>,
  Subjects:<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z"/></>,
  Notes:<><path d="M5.5 4h11l3 3v13.5h-14z"/><path d="m5.5 4 3 3-3 2.6M9 12.5h7M9 16h7"/></>,
  'K-Quiz':<><path d="M9.2 18.5h5.6M10.2 21h3.6"/><path d="M12 3.2a6 6 0 0 0-3.4 10.9c.6.5.9 1.2.9 2h5c0-.8.3-1.5.9-2A6 6 0 0 0 12 3.2Z"/></>,
  Exams:<><circle cx="12" cy="9" r="5"/><path d="m9 13.3-2 7.2 5-2.6 5 2.6-2-7.2"/></>,
  Settings:<><path d="M12 3 6.2 15 12 21l5.8-6Z"/><path d="M12 9.5v7.5"/></>,
 },
 dashboard:{
  Sanctuary:<><path d="M4 15.2a8 8 0 0 1 16 0"/><path d="M12 15.2 16.2 9"/><circle cx="12" cy="15.2" r="1.3"/></>,
  Planner:<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7 3v4M17 3v4M3.5 9.5h17"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/></>,
  Subjects:<><rect x="4" y="14" width="4" height="6"/><rect x="10" y="9" width="4" height="11"/><rect x="16" y="4" width="4" height="16"/></>,
  Notes:<><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 12.5h8M8 16h5"/></>,
  'K-Quiz':<><circle cx="12" cy="12" r="8"/><path d="M12 12 12 4A8 8 0 0 1 19.2 16.4Z"/></>,
  Exams:<><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12.3 2.8 2.8L16.5 9"/></>,
  Settings:<><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h12M19.5 17H21"/><circle cx="14.5" cy="7" r="2"/><circle cx="7.5" cy="12" r="2"/><circle cx="16.5" cy="17" r="2"/></>,
 },
 zine:{
  Sanctuary:<path d="M12 3 2 12h3v8h6v-5h2v5h6v-8h3z"/>,
  Planner:<path d="M6 2h2v2h8V2h2v2h3v18H3V4h3zm-2 8v10h16V10z"/>,
  Subjects:<path d="M4 4a2 2 0 0 1 2-2h6v20H6a2 2 0 0 1-2-2zm10-2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-6z"/>,
  Notes:<><path d="M6 2h9l5 5v15H6Z"/><path d="M15 2v5h5Z" fill="var(--wb-surface,#fff)"/></>,
  'K-Quiz':<path d="M13 2 4 14h6l-1 8 9-12h-6Z"/>,
  Exams:<path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6Z"/>,
  Settings:<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9.5 5.4-2 1.6c.04.34.06.66.06 1s-.02.66-.06 1l2 1.6-2 3.4-2.4-1a7.7 7.7 0 0 1-1.9 1.1L14.6 24h-4l-.5-2.9a7.7 7.7 0 0 1-1.9-1.1l-2.4 1-2-3.4 2-1.6a8 8 0 0 1 0-2l-2-1.6 2-3.4 2.4 1c.58-.46 1.22-.83 1.9-1.1L9.6 6h4l.5 2.9c.68.27 1.32.64 1.9 1.1l2.4-1z"/>,
 },
 arcade:{
  Sanctuary:<path d="M4 11h2v9h5v-5h2v5h5v-9h2L12 4Z"/>,
  Planner:<><rect x="3.5" y="5" width="17" height="15"/><path d="M3.5 10h17M8.5 5v15M15.5 5v15"/></>,
  Subjects:<><rect x="4" y="5" width="6" height="14"/><rect x="14" y="5" width="6" height="14"/></>,
  Notes:<><rect x="3" y="5" width="18" height="14"/><path d="M6.5 9.5h5M6.5 12.5h8M6.5 15.5h6"/></>,
  'K-Quiz':<><circle cx="12" cy="7" r="3"/><path d="M12 10v6"/><rect x="6" y="16" width="12" height="5"/></>,
  Exams:<><circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M9 9.8h4.2a1.9 1.9 0 0 1 0 3.8H10a1.9 1.9 0 0 0 0 3.8h4.4"/></>,
  Settings:<><path d="M12 3v8"/><path d="M7 6.7a7 7 0 1 0 10 0"/></>,
 },
}
export function NavIcon({name,experience}:{name:ViewName;experience?:string}){
 const themed=experience?themedIconPaths[experience]?.[name]:undefined
 const blocky=experience==='arcade'
 return <svg viewBox="0 0 24 24" aria-hidden="true" fill={experience==='zine'?'currentColor':'none'} stroke="currentColor" strokeWidth={blocky?2.2:1.8} strokeLinecap={blocky?'square':'round'} strokeLinejoin={blocky?'miter':'round'}>{themed??iconPaths[name]}</svg>
}

type ProfileOption={id:string;label:string}
export default function Sidebar({view,onView,profile='Sophia',schoolYear='Summer 2026',profiles=[],activeProfileId,onProfileChange,musicPlayer}:{view:ViewName;onView:(v:ViewName)=>void;profile?:string;schoolYear?:string;profiles?:ProfileOption[];activeProfileId?:string;onProfileChange?:(id:string)=>void;musicPlayer?:ReactNode}){
 return <><aside className="sidebar"><div className="brand"><div className="brand-mark" aria-hidden="true"><span>K</span><i>✿</i></div><div><h1>KONO</h1><p>Study Sanctuary</p></div></div><div className="sidebar-section-label">Notebook tabs</div><nav className="nav-list">{navItems.map(item=><button className={`nav-button ${view===item?'active':''}`} key={item} onClick={()=>onView(item)}><span className="nav-icon"><NavIcon name={item}/></span><span>{item}</span><i className="nav-petal" aria-hidden="true">✦</i></button>)}</nav><div className="sidebar-player-slot">{musicPlayer}</div><section className="season-card profile-dock"><div className="profile-avatar">{profile.slice(0,1).toUpperCase()}</div><div className="profile-dock-copy"><span>{profile}</span><strong>{schoolYear}</strong><small>Active study profile</small></div>{profiles.length>0&&<select aria-label="Switch study profile" value={activeProfileId} onChange={e=>onProfileChange?.(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>}</section></aside><header className="mobile-desk-header"><div className="mobile-brand-row"><div className="mobile-brand-lockup"><div className="brand-mark" aria-hidden="true"><span>K</span><i>✿</i></div><div><h1>KONO</h1><p>Study Sanctuary</p></div></div><div className="mobile-profile-chip"><span>{profile}</span><small>{schoolYear}</small>{profiles.length>0&&<select aria-label="Switch study profile" value={activeProfileId} onChange={e=>onProfileChange?.(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>}</div></div><div className="mobile-tabs-label">Notebook tabs</div><nav className="mobile-nav">{navItems.map(item=><button className={view===item?'active':''} key={item} onClick={()=>onView(item)}><span><NavIcon name={item}/></span><small>{item}</small><i aria-hidden="true">✦</i></button>)}</nav><div className="mobile-player-slot">{musicPlayer}</div></header></>
}
