import { useEffect, useId, useRef, useState } from 'react'
import { useSpeechToText } from '../hooks/useSpeechToText'
import Avatar from './Avatar'
/** One search result. Plan items carry their type (`group`), date, people and done state, so the quick
 * filters (This week, Late, a person) can narrow them; pages and settings have no date. */
export type Command={label:string;hint:string;run:()=>void;group?:string;date?:string;kidIds?:string[];done?:boolean}
type Filter={id:string;label:string;test:(c:Command)=>boolean}

const localToday=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const plusDays=(day:string,n:number)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
const GROUP_ORDER=['Assignments','Exams','Events','Notes','Subjects','Kids','Pages & settings']

export default function CommandPalette({commands,onClose,people=[]}:{commands:Command[];onClose:()=>void;people?:{id:string;name:string;emoji?:string;photo?:string;color?:string}[]}){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null)
 const [query,setQuery]=useState(''),[active,setActive]=useState(0),[filter,setFilter]=useState('all')
 const today=localToday(),weekEnd=plusDays(today,7)
 const filters:Filter[]=[
  {id:'all',label:'All',test:()=>true},
  {id:'week',label:'This week',test:c=>!!c.date&&c.date>=today&&c.date<=weekEnd},
  {id:'late',label:'Late',test:c=>!!c.date&&c.date<today&&c.done===false},
  ...people.map(p=>({id:'kid:'+p.id,label:p.name,test:(c:Command)=>!!c.kidIds?.includes(p.id)})),
 ]
 const chosen=filters.find(f=>f.id===filter)??filters[0]
 const terms=query.toLowerCase().split(/\s+/).filter(Boolean)
 const showAll=terms.length>0||filter!=='all'
 const found=showAll?commands.filter(c=>chosen.test(c)&&terms.every(t=>(c.label+' '+c.hint).toLowerCase().includes(t))):[]
 const groups=GROUP_ORDER.map(g=>({group:g,items:found.filter(c=>(c.group??'Pages & settings')===g).slice(0,8)})).filter(g=>g.items.length)
 const matches=groups.flatMap(g=>g.items),index=Math.min(active,Math.max(0,matches.length-1))
 const id=useId()
 const voice=useSpeechToText(text=>{setQuery(text);setActive(0)})
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null;dialog.current?.showModal();input.current?.focus();return()=>opener?.focus()},[])
 const run=(command?:Command)=>{if(command){command.run();onClose()}}
 let n=-1
 return <dialog ref={dialog} className="command-palette command-dialog" aria-label="Search your work" onCancel={onClose}><div className="command-input"><span aria-hidden="true">⌕</span><input ref={input} role="combobox" aria-label="Search assignments, notes, exams, and pages" aria-expanded="true" aria-controls={id} aria-autocomplete="list" aria-activedescendant={matches.length?`${id}-${index}`:undefined} value={query} onChange={e=>{setQuery(e.target.value);setActive(0)}} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive((index+(e.key==='ArrowDown'?1:-1)+matches.length)%Math.max(1,matches.length))}if(e.key==='Enter'){e.preventDefault();run(matches[index])}}} placeholder="Search your study plan…"/>{voice.supported&&<button type="button" className={'voice-input-button'+(voice.listening?' is-listening':'')} aria-pressed={voice.listening} aria-label={voice.listening?'Stop voice search':'Search by voice'} onClick={voice.toggle}>🎙️</button>}<button type="button" onClick={onClose} aria-label="Close search">×</button></div>
  <div className="command-filters" role="group" aria-label="Show">{filters.map(f=><button type="button" key={f.id} aria-pressed={f.id===filter} onClick={()=>{setFilter(f.id);setActive(0)}}>{(()=>{const p=people.find(x=>'kid:'+x.id===f.id);return p?<Avatar who={p}/>:null})()}{f.label}</button>)}</div>
  {voice.error&&<p role="alert" className="voice-input-error">{voice.error}</p>}
  <div id={id} role="listbox" className="command-results" aria-label="Matching actions">{groups.map(g=><div role="group" key={g.group} aria-label={g.group} className="command-group"><div className="command-group-title" aria-hidden="true">{g.group}</div>{g.items.map(c=>{n++;const i=n;return <div role="option" aria-selected={index===i} id={`${id}-${i}`} key={i} onMouseDown={e=>e.preventDefault()} onClick={()=>run(c)} className={index===i?'active':''}><strong>{c.label}</strong><small>{c.hint}</small>{(c.kidIds??[]).length>0&&<span className="command-people">{people.filter(p=>c.kidIds!.includes(p.id)).map(p=><Avatar key={p.id} who={p}/>)}</span>}</div>})}</div>)}{showAll&&!matches.length&&<p>No matching command.</p>}{!showAll&&<p className="command-hint">Type to search, or pick This week, Late or a name.</p>}</div><footer>↑↓ Navigate · Enter Open · Escape Close</footer></dialog>
}
