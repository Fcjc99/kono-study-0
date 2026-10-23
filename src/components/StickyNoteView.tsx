import type {CSSProperties} from 'react'
import SafeNoteBody from './SafeNoteBody'

/** A note or exam drawn as a sticky note (Notes, Exams and Home's Notes & reminders). Loaded with the first
 * note shown, so it doesn't add to the app's startup. */
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

export default function StickyNoteView({kind,color,textColor,font='rounded',pinned=false,completed=false,pinIndex=0,subject='Subject',subjectGlyph='•',title,body='',highlight='transparent',dateLabel,countdown,sourceLabel,onEdit,onDelete,onTogglePin,onToggleComplete}:StickyNoteViewProps){
 const preview=kind.startsWith('preview')
 const exam=kind.includes('exam')
 return <article className={`kono-sticky sticky-note-system kono-sticky-${preview?'preview':'full'} kono-sticky-${exam?'exam':'note'} note-font-${font} ${pinned?'is-pinned':''} ${completed?'is-complete':''}`} style={{'--paper':color,'--ink':textColor,color:textColor} as CSSProperties}>
  <span className={`kono-pin pin-${pinIndex%5}`} aria-hidden="true"/>
  <span className="kono-fold" aria-hidden="true"/>
  {onDelete&&<button type="button" className="kono-sticky-delete" aria-label={`Delete ${exam?'exam':'note'}`} onClick={onDelete}>×</button>}
  <span className="kono-sticky-subject"><b>{subjectGlyph}</b>{subject}</span>
  {exam&&typeof countdown==='number'&&<div className="kono-countdown"><b>{countdown}</b><small>days</small></div>}
  <h3>{title}</h3>
  {body.trim()&&<div className="kono-sticky-body" style={{background:highlight}} ><SafeNoteBody text={body}/></div>}
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
