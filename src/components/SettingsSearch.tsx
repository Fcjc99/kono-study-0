import {useState} from 'react'
import type {SettingsTab} from '../workspaceShared'

/** What lives on each Settings tab, so "dark", "pin" or "backup" finds its place. `find` is text on the
 * page to scroll to once the tab opens. */
const INDEX:{label:string;tab:SettingsTab;find:string;words:string}[]=[
 {label:'KONO experience (Cozy, Simplified, Clean, Zen Ink)',tab:'Look & feel',find:'experience',words:'look style theme design clean modern zen cozy simplified'},
 {label:'Color palette',tab:'Look & feel',find:'color palette',words:'colors colour theme coral sakura lavender mint ocean'},
 {label:'Team colors',tab:'Look & feel',find:'team colors',words:'school team jersey colors sports'},
 {label:'Dark mode',tab:'Look & feel',find:'dark mode',words:'dark night light black'},
 {label:'Text size',tab:'Look & feel',find:'text size',words:'font bigger larger small read'},
 {label:'Sound & motion',tab:'Look & feel',find:'sound',words:'sound music audio motion animation reduce'},
 {label:'Sanctuary weather',tab:'Look & feel',find:'sanctuary weather',words:'weather rain snow island location zip'},
 {label:'Reminders and notifications',tab:'Notifications',find:'notifications',words:'reminders alerts notify lock screen push phone due'},
 {label:'Kids',tab:'Family',find:'kids',words:'children family kid add rename names'},
 {label:'Kids’ appearance',tab:'Family',find:'appearance',words:'kid colors emoji avatar border'},
 {label:'Parent PIN and locking a kid’s device',tab:'Family',find:'pin',words:'pin lock parent password device'},
 {label:'Classes and school schedule',tab:'Schedules',find:'schedule',words:'classes school bell rotation day periods timetable'},
 {label:'Sports season and work shifts',tab:'Schedules',find:'schedule',words:'sports practice games work shifts job'},
 {label:'Back up or restore your plan',tab:'Import & export',find:'import',words:'backup restore download file export import save copy'},
 {label:'Show KONO in Google or Apple Calendar',tab:'Import & export',find:'google calendar',words:'calendar google apple ical ics sync subscribe'},
 {label:'Share a schedule',tab:'Import & export',find:'share a schedule',words:'share send schedule friend'},
 {label:'AI helper key',tab:'Import & export',find:'ai helper',words:'ai gemini openai key api scan'},
 {label:'Plans (rename, switch, delete)',tab:'Plans & account',find:'plans',words:'plan rename delete switch family master profile name'},
 {label:'Start over',tab:'Plans & account',find:'start over',words:'reset start over clear erase everything'},
 {label:'Account and sign in',tab:'Plans & account',find:'account',words:'account email sign in sign out login logout'},
 {label:'Friends',tab:'Plans & account',find:'friends',words:'friends classmates connect share'},
]

export default function SettingsSearch({onOpen}:{onOpen:(tab:SettingsTab,find:string)=>void}){
 const [q,setQ]=useState('')
 const terms=q.toLowerCase().split(/\s+/).filter(Boolean)
 const hits=terms.length?INDEX.filter(i=>terms.every(t=>(i.label+' '+i.tab+' '+i.words).toLowerCase().includes(t))).slice(0,6):[]
 return <div className="settings-search" role="search">
  <input type="search" aria-label="Search settings" placeholder="Search settings: dark mode, kids, backup…" value={q} onChange={e=>setQ(e.target.value)}/>
  {terms.length>0&&<ul className="settings-search-results" aria-label="Matching settings">{hits.length?hits.map(h=><li key={h.label}><button type="button" onClick={()=>{setQ('');onOpen(h.tab,h.find)}}><span>{h.label}</span><small>{h.tab}</small></button></li>):<li className="settings-search-none">Nothing matches “{q}”.</li>}</ul>}
 </div>
}
