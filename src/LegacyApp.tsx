import type {CSSProperties} from 'react'
import SafeNoteBody from './components/SafeNoteBody'
import './production.css'
import './App.css'
import './foundation.css'
import './identity.css'
import './coral.css'
import './sanctuary.css'



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
