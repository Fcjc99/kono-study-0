import {useState,type CSSProperties,type DragEvent,type ReactNode} from 'react'
import {dayNames,localDate,type AppData,type CalendarEventKind,type SettingsData,type Task} from '../store/model'
import {titleOf,type Collection,type Entry} from '../store/workspace'
import {addDays} from '../store/studyScheduler'
import {classOccurrences,type ClassOccurrence} from '../store/classSchedule'
import {PLANNER_SOURCES,classSource,entrySource,sourcesInPlan,type PlannerSource} from '../store/plannerSources'
import {schoolDayLabels} from '../store/schoolCalendar'
import {useLocalSetting} from '../hooks/useLocalSetting'
import {usePhoneWidth} from '../hooks/useComfort'
import {lazyPanel} from '../lazyPanel'
import {own,dateLabel,entryDate,isImportantEntry,type Page} from '../workspaceShared'
import Modal from './Modal'
import AssignmentProgress from './AssignmentProgress'
import type {WeekItem} from './WeekGrid'
import type * as Screens from '../WorkspaceSettings'

const WeekGrid=lazyPanel(()=>import('./WeekGrid'))
const QuickFamilyAdd=lazyPanel<Parameters<typeof Screens.QuickFamilyAdd>[0]>(()=>import('../WorkspaceSettings').then(m=>({default:m.QuickFamilyAdd})))

/** Planner's calendar (month, week and day views), split from Workspace so it loads with the Planner page. */
export default function PlannerCalendar({data,tasks,date,selectDate,create,render,renderClass,reschedule,planAt,stretchTo,edit,navigate,parentMode,quickAddEvent}:{data:AppData;tasks:Task[];date:string;selectDate:(date:string)=>void;create:(key:Collection,date?:string,subjectId?:string,seed?:Partial<Entry>)=>void;render:(key:Collection,entry:Entry,compact?:boolean)=>ReactNode;renderClass:(item:ClassOccurrence)=>ReactNode;reschedule:(key:Collection,entry:Entry,date:string)=>void;planAt:(key:Collection,entry:Entry,day:string,time:string)=>void;stretchTo:(key:Collection,entry:Entry,end:string)=>void;edit:(key:Collection,entry:Entry)=>void;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>;navigate:(page:Page)=>void;parentMode:boolean;quickAddEvent:(date:string,payload:{title:string;kind:CalendarEventKind;kidId?:string;time?:string;endTime?:string})=>Promise<boolean>}){
 // Week by default (three days at a time on an iPhone); Month and Agenda are in the picker.
 const [mode,setMode]=useState('week'),[month,setMonth]=useState(()=>localDate().slice(0,7))
 const [dropTarget,setDropTarget]=useState('')
 // The class tapped on the week (by date and ID, so its card shows the latest after a change).
 const [classOpen,setClassOpen]=useState<{day:string;id:string}|null>(null)
 // Parent mode's whole point is speed: click a date, pick who/what/when, done -- without opening the
 // full assignment/exam/note/event editor. Only ever offered when parentMode is on (see the toolbar
 // and Agenda-day buttons below); the state itself just tracks which date's popup is open, if any.
 const [quickAdd,setQuickAdd]=useState<{date:string;time?:string}|null>(null),phone=usePhoneWidth()
 // Source chips (School · Canvas · Google · Sports · Mine): which sources are hidden, per device.
 const [hiddenRaw,setHiddenRaw]=useLocalSetting('kono-planner-hidden-sources:'+data.activeProfileId,'')
 const hiddenSources=new Set(hiddenRaw.split(',').filter(Boolean)),shown=(s:PlannerSource)=>!hiddenSources.has(s)
 const toggleSource=(s:PlannerSource)=>{const next=new Set(hiddenSources);if(next.has(s))next.delete(s);else next.add(s);setHiddenRaw([...next].join(','))}
 const available=sourcesInPlan(data)
 const kids=data.kids.filter(k=>k.profileId===data.activeProfileId)
 // Which kid a day's items belong to is a filter on top of the academic/sports/appointments one, not
 // a replacement for it -- both narrow the same one shared calendar together. Kept as local state
 // (not a persisted setting, unlike the checkboxes above) so a newly added kid shows by default: it's
 // simply absent from "hidden" until someone unchecks them, same pattern as the old Family page.
 const [hiddenKids,setHiddenKids]=useState<Set<string>>(()=>new Set())
 const kidVisible=(kidId?:string)=>!kidId||!hiddenKids.has(kidId)
 const toggleKid=(id:string)=>setHiddenKids(v=>{const next=new Set(v);if(next.has(id))next.delete(id);else next.add(id);return next})
 const kidOf=(kidId?:string)=>kidId?kids.find(k=>k.id===kidId):undefined
 const scheduleClasses=(day:string)=>classOccurrences(data,day).filter(c=>shown(classSource(c))&&kidVisible(c.block.kidId))
 const entries=[
  ...tasks.filter(t=>kidVisible(t.kidId)).map(t=>({key:'tasks' as Collection,entry:t as unknown as Entry,date:t.due})),
  ...own(data,'exams').filter(e=>kidVisible(e.kidId as string|undefined)).map(e=>({key:'exams' as Collection,entry:e,date:String(e.due)})),
  ...own(data,'notes').filter(n=>entryDate(n)).map(n=>({key:'notes' as Collection,entry:n,date:entryDate(n)})),
  ...own(data,'calendarEvents').filter(e=>kidVisible(e.kidId as string|undefined)).map(e=>({key:'calendarEvents' as Collection,entry:e,date:String(e.date)})),
 ].filter(e=>shown(entrySource(e.key,e.entry)))
 const selectedEntries=entries.filter(entry=>entry.date===date)
 const selectedClasses=scheduleClasses(date)
 const start=new Date(month+'-01T12:00:00'),gridStart=addDays(month+'-01',-start.getDay())
 const shift=(by:number)=>{const next=new Date(start);next.setMonth(next.getMonth()+by);setMonth(localDate(next).slice(0,7))}
 const dragEntry=(e:DragEvent<HTMLElement>,item:{key:Collection;entry:Entry})=>{e.dataTransfer.setData('application/json',JSON.stringify({key:item.key,id:item.entry.id}));e.dataTransfer.effectAllowed='move'}
 const dropOn=(day:string)=>({onDragOver:(e:DragEvent<HTMLElement>)=>{e.preventDefault();e.dataTransfer.dropEffect='move'},onDragEnter:()=>setDropTarget(day),onDragLeave:()=>setDropTarget(t=>t===day?'':t),onDrop:(e:DragEvent<HTMLElement>)=>{e.preventDefault();setDropTarget('');const raw=e.dataTransfer.getData('application/json');if(!raw)return;try{const dropped=JSON.parse(raw) as {key:Collection;id:string},item=entries.find(x=>x.entry.id===dropped.id&&x.key===dropped.key);if(item&&item.date!==day)reschedule(item.key,item.entry,day)}catch{/* Ignore a drag payload from outside this calendar. */}}})
 const dayHasPriority=(entry:{key:Collection;entry:Entry})=>isImportantEntry(entry.key,entry.entry)
 const draggableEntry=(e:{key:Collection;entry:Entry})=><div key={e.entry.id} className="wb-draggable" draggable onDragStart={ev=>dragEntry(ev,e)}>{render(e.key,e.entry,dayHasPriority(e))}</div>
 // An exam/important item still floats to the top regardless of its time, but everything else sorts
 // chronologically -- so a day's events read top-to-bottom in time order, the same order their times
 // line up visually in the new family-event tile (see RecordCard's calendarEvents branch).
 const entryTime=(entry:{key:Collection;entry:Entry})=>entry.key==='calendarEvents'?entry.entry.time as string|undefined:entry.key==='tasks'?entry.entry.plannedTime as string|undefined:undefined
 const importantFirst=<T extends {key:Collection;entry:Entry}>(list:T[]):T[]=>[...list].sort((a,b)=>Number(dayHasPriority(b))-Number(dayHasPriority(a))||(entryTime(a)??'99:99').localeCompare(entryTime(b)??'99:99'))
 const attachedToClass=(entry:{key:Collection;entry:Entry;date:string},classes:ClassOccurrence[])=>Boolean(entry.entry.subjectId&&classes.some(c=>c.block.subjectId===entry.entry.subjectId&&c.date===entry.date))
 // The daily page: what isn't already listed under one of the day's classes.
 const dayLoose=selectedEntries.filter(e=>e.key==='exams'||!attachedToClass(e,selectedClasses)),todayDate=localDate()
 const dayEntries=Array.from({length:7},(_,i)=>({day:addDays(date,i),entries:entries.filter(e=>e.date===addDays(date,i)),classes:scheduleClasses(addDays(date,i))}))
 // A dot/list-item's color: whichever kid it's tagged to, so a parent scanning the grid sees "whose"
 // before "what subject" -- falling back to the subject color (and the priority red) exactly as
 // before for anything not tagged to a kid.
 const dotColor=(entry:{key:Collection;entry:Entry})=>kidOf(entry.entry.kidId as string|undefined)?.color??(dayHasPriority(entry)?'#d24864':data.subjects.find(s=>s.id===entry.entry.subjectId)?.color??'#d9828a')
 const classDotColor=(c:ClassOccurrence)=>kidOf(c.block.kidId)?.color??data.subjects.find(s=>s.id===c.block.subjectId)?.color??'#b77c98'
 // Week view: Sunday to Saturday around the selected date, classes and timed items at their hour.
 // On an iPhone seven columns are too narrow to read, so it shows three days from the selected one.
 const weekStart=phone?date:addDays(date,-new Date(date+'T12:00:00').getDay()),weekDays=Array.from({length:phone?3:7},(_,i)=>addDays(weekStart,i)),weekStep=phone?3:7
 const later=(t:string,by:number)=>{const m=Math.min(24*60-1,Number(t.slice(0,2))*60+Number(t.slice(3,5))+by);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
 const weekItems:WeekItem[]=mode!=='week'?[]:weekDays.flatMap(day=>[
  ...scheduleClasses(day).map(c=>({id:c.id,day,title:c.block.label,start:c.timePending?undefined:c.displayStart??c.block.start,end:c.displayEnd??c.block.end,color:classDotColor(c)})),
  ...entries.filter(e=>e.date===day).map(e=>{const start=entryTime(e);return {id:e.key+':'+e.entry.id,drag:e.key==='notes'?undefined:e.key+':'+e.entry.id,stretch:!!start&&(e.key==='calendarEvents'||e.key==='tasks'),day,title:titleOf(e.entry)||'Untitled',start,end:e.key==='calendarEvents'?e.entry.endTime as string|undefined:start?later(start,Number(e.entry.estimatedMinutes)||60):undefined,color:dotColor(e),important:dayHasPriority(e)}}),
 ])
 const dropOnWeek=(drag:string,day:string,time?:string)=>{
  const item=entries.find(e=>e.key+':'+e.entry.id===drag)
  if(!item)return
  if(time)planAt(item.key,item.entry,day,time);else if(item.date!==day)reschedule(item.key,item.entry,day)
 }
 const stretchOnWeek=(drag:string,end:string)=>{const item=entries.find(e=>e.key+':'+e.entry.id===drag);if(item)stretchTo(item.key,item.entry,end)}
 // Tapping something on the week opens it right there: an assignment, exam or event in its editor, a
 // class as its card (notes, skip, add for this class), so there's no scrolling down to the daily page.
 const openOnWeek=(item:WeekItem)=>{
  const entry=entries.find(e=>e.key+':'+e.entry.id===item.id)
  if(entry){edit(entry.key,entry.entry);return}
  const occurrence=scheduleClasses(item.day).find(c=>c.id===item.id)
  if(occurrence)setClassOpen({day:item.day,id:occurrence.id});else selectDate(item.day)
 }
 const openClass=classOpen?scheduleClasses(classOpen.day).find(c=>c.id===classOpen.id):undefined
 const addAt=(day:string,time:string)=>{selectDate(day);if(parentMode)setQuickAdd({date:day,time});else create('calendarEvents',day,undefined,{time,endTime:later(time,60)})}
 return <section className="wb-panel cozy-calendar-shell"><div className="wb-section-head"><h2>Your calendar</h2><div className="wb-toolbar">{date!==todayDate&&<button type="button" title="Go back to today on the calendar and daily page" onClick={()=>{selectDate(todayDate);setMonth(todayDate.slice(0,7))}}>↩ Back to today</button>}<label>Calendar view<select value={mode} onChange={e=>setMode(e.target.value)}><option value="week">Week</option><option value="month">Month</option><option value="agenda">Agenda</option></select></label></div></div>
  {available.length>1&&<div className="planner-source-chips" role="group" aria-label="Show on calendar">{PLANNER_SOURCES.filter(s=>available.includes(s.id)).map(s=><button type="button" key={s.id} title={s.title} aria-pressed={shown(s.id)} className={'source-chip source-'+s.id} onClick={()=>toggleSource(s.id)}>{s.label}</button>)}</div>}

  {kids.length>0&&<div className="family-kid-list" role="group" aria-label="Filter calendar by kid">{kids.map(k=><label key={k.id} className="family-kid-chip" style={{'--kid-color':k.color} as CSSProperties}><input type="checkbox" checked={!hiddenKids.has(k.id)} onChange={()=>toggleKid(k.id)}/><i className="family-kid-swatch" aria-hidden="true"/>{(k.emoji?k.emoji+' ':'')+k.name}</label>)}</div>}
  {mode==='week'&&<><div className="wb-section-head week-grid-nav"><button aria-label={phone?'Previous days':'Previous week'} onClick={()=>selectDate(addDays(date,-weekStep))}>‹</button><h3>{new Date(weekDays[0]+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})} – {new Date(weekDays[weekDays.length-1]+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</h3><button aria-label={phone?'Next days':'Next week'} onClick={()=>selectDate(addDays(date,weekStep))}>›</button></div><p className="wb-muted week-grid-hint">{phone?'Tap to open or add. Hold to move; drag the bottom edge to make it longer.':'Tap anything to open it, or an empty time to add something then. Drag something to move it; drag its bottom edge to make it longer.'}</p><WeekGrid days={weekDays} items={weekItems} selected={date} onSelect={selectDate} onAddAt={addAt} onOpen={openOnWeek} onDrop={dropOnWeek} onStretch={stretchOnWeek} dayLabel={dateLabel}/></>}
  {openClass&&<Modal title={dateLabel(openClass.date)} close={()=>setClassOpen(null)}><div className="week-class-sheet">{renderClass(openClass)}</div></Modal>}
  {mode==='month'&&<><div className="wb-section-head"><button aria-label="Previous month" onClick={()=>shift(-1)}>‹</button><h3>{start.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><button aria-label="Next month" onClick={()=>shift(1)}>›</button></div><div className="wb-calendar">{dayNames.map(d=><span key={d}>{d.slice(0,3)}</span>)}{Array.from({length:42},(_,i)=>addDays(gridStart,i)).map(day=>{const dayEntriesForDate=entries.filter(e=>e.date===day),classes=scheduleClasses(day),important=dayEntriesForDate.filter(dayHasPriority);return <button key={day} aria-label={dateLabel(day)+' · '+(dayEntriesForDate.length+classes.length)+' entries · '+important.length+' important · '+schoolDayLabels(data,day).join(' · ')} aria-pressed={date===day} className={(day.slice(0,7)!==month?'muted-day ':'')+(important.length?'has-priority':'')+(dropTarget===day?' drop-target':'')} onClick={()=>{selectDate(day);if(parentMode)setQuickAdd({date:day})}} {...dropOn(day)}><span className="calendar-date-row"><strong>{Number(day.slice(-2))}</strong>{important.length>0&&<b title="Exam or project">★ {important.length}</b>}</span><small>{dayEntriesForDate.length+classes.length||''}{dayEntriesForDate.length+classes.length?' entries':''}</small><span className="school-day-mini">{schoolDayLabels(data,day).map(label=>label.slice(label.indexOf(':')+1).trim()).join(' · ')}</span><span className="calendar-class-preview">{classes.slice(0,2).map(c=><span key={c.id}>{c.block.label}</span>)}</span><span className="calendar-entry-preview">{dayEntriesForDate.slice(0,2).map(e=><span className={dayHasPriority(e)?'is-priority':''} key={e.entry.id}>{dayHasPriority(e)?'★ ':''}{titleOf(e.entry)}</span>)}</span><span className="wb-cal-dots" aria-hidden="true">{classes.slice(0,5).map(c=><i key={c.id} style={{background:classDotColor(c)}}/>)}{dayEntriesForDate.slice(0,4).map(e=><i key={e.entry.id} style={{background:dotColor(e)}}/>)}</span></button>})}</div></>}
  {mode==='agenda'&&<div className="wb-agenda-upcoming"><h4>This week</h4>{dayEntries.map(({day,entries:dayEntriesForDate,classes:dayClasses},i)=>{if(i>=2&&!parentMode&&!dayClasses.length&&!dayEntriesForDate.length)return null;const important=dayEntriesForDate.filter(dayHasPriority).length;return <details key={day} open={i===0} className={'wb-agenda-day'+(dropTarget===day?' drop-target':'')} {...dropOn(day)}><summary><h3>{i===0?'Today':i===1?'Tomorrow':dateLabel(day)}{i<2&&<small className="wb-agenda-day-date"> · {dateLabel(day)}</small>}</h3><span className="wb-agenda-day-meta"><small>{dayClasses.length+dayEntriesForDate.length} item{dayClasses.length+dayEntriesForDate.length===1?'':'s'}{important?' · '+important+' important':''}</small>{parentMode&&<button type="button" className="quick-add-kid-event" onClick={e=>{e.preventDefault();e.stopPropagation();setQuickAdd({date:day})}}>＋ Add</button>}</span></summary>{schoolDayLabels(data,day).map(label=><p className="school-day-label" key={label}>{label}</p>)}{importantFirst(dayEntriesForDate.filter(e=>e.key==='exams'||!attachedToClass(e,dayClasses))).map(draggableEntry)}{dayClasses.map(renderClass)}{!dayClasses.length&&!dayEntriesForDate.length&&<p className="wb-muted">Nothing scheduled.</p>}</details>})}{!parentMode&&dayEntries.slice(2).every(d=>!d.classes.length&&!d.entries.length)&&<p className="wb-muted wb-agenda-empty-note">Nothing else scheduled this week.</p>}</div>}
  {/* Only shown in Month view: in Agenda mode the selected date is always day 0 of "This week"
      above (dayEntries starts counting from `date`), so this would just repeat that day's own
      list. Month view has no other per-day detail panel, so a clicked date still needs one here. */}
  {mode!=='agenda'&&<div className="planner-day-paper"><header><small>YOUR DAILY PAGE</small><div className="planner-day-nav"><button type="button" aria-label="Previous day" onClick={()=>{const d=addDays(date,-1);selectDate(d);setMonth(d.slice(0,7))}}>‹</button><h3>{date===todayDate?'Today · ':''}{dateLabel(date)}</h3><button type="button" aria-label="Next day" onClick={()=>{const d=addDays(date,1);selectDate(d);setMonth(d.slice(0,7))}}>›</button></div></header>
  {/* The same layout as the Sanctuary's "Today's schedule": progress, the school-day note, the day's
      classes as compact cards (with what's due for each), then everything else under "Also". */}
  <AssignmentProgress tasks={tasks} date={date} label={dateLabel(date)}/>{schoolDayLabels(data,date).map(label=><p className="school-day-label" key={label}>{label}</p>)}
  <section className={'planner-day-board'+(dropTarget===date?' drop-target':'')} aria-label={'Plan for '+dateLabel(date)} {...dropOn(date)}>{selectedClasses.length>0&&<div className="today-schedule-list">{selectedClasses.map(renderClass)}</div>}{dayLoose.length>0&&<div className="tomorrow-extra-list"><strong>{selectedClasses.length?(date===todayDate?'Also today':'Also on this day'):(date===todayDate?'Today':'On this day')}</strong>{importantFirst(dayLoose).map(draggableEntry)}</div>}{!selectedClasses.length&&!dayLoose.length&&<p className="wb-muted">Nothing planned for this day.</p>}</section>
  <div className="planner-date-tools"><details className="planner-add-menu"><summary>＋ Add to this date</summary><div><button onClick={()=>create('tasks',date)}>Assignment</button><button onClick={()=>create('notes',date)}>Study note</button><button className="is-priority" onClick={()=>create('exams',date)}>★ Exam / project</button><button onClick={()=>create('calendarEvents',date,undefined,{kind:'lesson'})}>Lesson</button><button onClick={()=>create('calendarEvents',date,undefined,{kind:'work'})}>Work</button><button onClick={()=>create('calendarEvents',date)}>Reminder / event</button></div></details></div>
  </div>}
  {quickAdd&&<Modal title={'Add for '+dateLabel(quickAdd.date)} close={()=>setQuickAdd(null)}>{kids.length?<QuickFamilyAdd kids={kids} time={quickAdd.time} onCancel={()=>setQuickAdd(null)} onSave={async payload=>{if(await quickAddEvent(quickAdd.date,payload))setQuickAdd(null)}}/>:<><p className="wb-muted">No kids added yet.</p><button type="button" onClick={()=>{setQuickAdd(null);navigate('Kids')}}>Manage kids</button></>}</Modal>}
  </section>
}
