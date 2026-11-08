import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react'
import './time-field.css'
import {parseTime,showTime} from '../store/timeText'

/** A time, typed the way people say it or picked from a short list, instead of the phone's clock dial.
 * Typing understands "3:30 pm", "330p", "3p", "15:30", "1530", "noon" and "midnight"; a bare hour reads as
 * the likely one (1-6 → PM, 7-11 → AM; an end time goes after its start). The list holds every quarter hour,
 * opened at the time typed so far or at `near` (an end time opens just after its start). The value is
 * "HH:MM" (24-hour), or "" for none. */
const QUARTERS=Array.from({length:96},(_,i)=>String(Math.floor(i/4)).padStart(2,'0')+':'+String(i%4*15).padStart(2,'0'))

export default function TimeField({value,onChange,required=false,near,after,placeholder='e.g. 3:30 pm',id,ariaLabel}:{value:string;onChange:(v:string)=>void;required?:boolean;near?:string;after?:string;placeholder?:string;id?:string;ariaLabel?:string}){
 const [text,setText]=useState(showTime(value)),[open,setOpen]=useState(false),[bad,setBad]=useState(false)
 const listId=useId(),listRef=useRef<HTMLUListElement>(null),wrap=useRef<HTMLDivElement>(null)
 // A value set from outside (a quick length, a repeat) shows here.
 const [shown,setShown]=useState(value)
 if(shown!==value){setShown(value);setText(showTime(value));setBad(false)}
 const commit=(raw:string)=>{const v=parseTime(raw,after);if(v===null){setBad(true);return}setBad(false);setText(showTime(v));if(v!==value)onChange(v)}
 // Open the list at the current value, or near the given time, or after the start.
 const anchor=value||(after?QUARTERS[(Number(after.slice(0,2))*4+Math.floor(Number(after.slice(3,5))/15)+2)%96]:near)||'15:00'
 useEffect(()=>{if(!open||!listRef.current)return
  const at=Number(anchor.slice(0,2))*60+Number(anchor.slice(3,5)),target=listRef.current.querySelector<HTMLElement>('[data-at="'+QUARTERS[Math.floor(at/15)]+'"]')
  if(target)listRef.current.scrollTop=target.offsetTop-listRef.current.clientHeight/2+target.clientHeight/2},[open,anchor])
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!wrap.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open])
 const key=(e:KeyboardEvent<HTMLInputElement>)=>{if(e.key==='Enter'){e.preventDefault();commit(text);setOpen(false)}else if(e.key==='Escape')setOpen(false);else if(e.key==='ArrowDown')setOpen(true)}
 return <div className={'time-field'+(bad?' is-bad':'')} ref={wrap}>
  <span className="time-field-box">
  <input id={id} type="text" inputMode="text" autoComplete="off" spellCheck={false} role="combobox" aria-expanded={open} aria-controls={listId} aria-label={ariaLabel} aria-invalid={bad||undefined} required={required}
   placeholder={placeholder} value={text}
   onChange={e=>{const raw=e.target.value;setText(raw);setBad(false);const v=parseTime(raw,after);if(v!==null&&v!==value&&/(\d{2}:\d{2}|[ap]m?|noon|midnight)$/i.test(raw.trim()))onChange(v)}}
   onBlur={()=>commit(text)} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} onKeyDown={key}/>
  {value&&!required&&<button type="button" className="time-field-clear" aria-label="Clear time" onClick={()=>{setText('');setBad(false);onChange('');setOpen(false)}}>×</button>}
  </span>
  {bad&&<small className="time-field-hint" role="alert">Try “3:30 pm” or “15:30”.</small>}
  {open&&<ul className="time-field-list" id={listId} role="listbox" ref={listRef}>{QUARTERS.map(q=><li key={q} role="option" data-at={q} aria-selected={q===value}><button type="button" tabIndex={-1} onPointerDown={e=>e.preventDefault()} onClick={()=>{setText(showTime(q));setBad(false);onChange(q);setOpen(false)}}>{showTime(q)}{after&&q>after&&<small>{(()=>{const d=(Number(q.slice(0,2))*60+Number(q.slice(3)))-(Number(after.slice(0,2))*60+Number(after.slice(3)));return d<60?d+' min':(d/60).toFixed(d%60?1:0).replace('.0','')+' hr'})()}</small>}</button></li>)}</ul>}
 </div>
}
