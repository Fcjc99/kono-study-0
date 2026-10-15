import {useRef,useState,type CSSProperties,type DragEvent,type ReactNode,type TouchEvent} from 'react'
import {dayNames,localDate,type AppData,type SettingsData,type Task} from '../store/model'
import {titleOf,type Collection,type Entry} from '../store/workspace'
import {addDays} from '../store/studyScheduler'
import {classKid,classOccurrences,type ClassOccurrence} from '../store/classSchedule'
import {PLANNER_SOURCES,classSource,entrySource,sourcesInPlan,type PlannerSource} from '../store/plannerSources'
import {holidayOn,schoolDayLabels} from '../store/schoolCalendar'
import {specialOn} from '../store/specialDays'
import {findClashes} from '../store/clashes'
import {weekdayDates} from '../store/eventRepeat'
import {useLocalSetting} from '../hooks/useLocalSetting'
import {usePhoneWidth} from '../hooks/useComfort'
import {lazyPanel} from '../lazyPanel'
import {own,dateLabel,entryDate,isImportantEntry,type Page} from '../workspaceShared'
import Modal from './Modal'
import Avatar from './Avatar'
import './month-grid.css'
import AssignmentProgress from './AssignmentProgress'
import type {WeekItem} from './WeekGrid'
import type * as Screens from '../WorkspaceSettings'

const WeekGrid=lazyPanel(()=>import('./WeekGrid'))
const QuickFamilyAdd=lazyPanel<Parameters<typeof Screens.QuickFamilyAdd>[0]>(()=>import('../WorkspaceSettings').then(m=>({default:m.QuickFamilyAdd})))

/** Planner's calendar (month, week and day views), split from Workspace so it loads with the Planner page. */
export default function PlannerCalendar({onWall,openSpecial,data,tasks,date,selectDate,create,render,renderClass,reschedule,planAt,stretchTo,edit,navigate,parentMode,quickAddEvent,personShown,peopleFilter}:{data:AppData;tasks:Task[];date:string;selectDate:(date:string)=>void;create:(key:Collection,date?:string,subjectId?:string,seed?:Partial<Entry>)=>void;render:(key:Collection,entry:Entry,compact?:boolean)=>ReactNode;renderClass:(item:ClassOccurrence)=>ReactNode;reschedule:(key:Collection,entry:Entry,date:string)=>void;planAt:(key:Collection,entry:Entry,day:string,time:string)=>void;stretchTo:(key:Collection,entry:Entry,end:string)=>void;edit:(key:Collection,entry:Entry)=>void;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>;navigate:(page:Page)=>void;parentMode:boolean;quickAddEvent:(date:string,payload:Screens.QuickFamilyPayload)=>Promise<boolean>;personShown:(x?:unknown)=>boolean;peopleFilter:ReactNode;onWall?:()=>void;openSpecial?:()=>void}){
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
 // Whose things show (Me and each kid) is Workspace's filter, shared with Home.
 const kidVisible=personShown
 const kidOf=(kidId?:string)=>kidId?kids.find(k=>k.id===kidId):undefined
 const scheduleClasses=(day:string)=>classOccurrences(data,day).filter(c=>shown(classSource(c))&&kidVisible(c.block.kidId?c.block:c.season))
 const entries=[
  ...tasks.filter(t=>kidVisible(t)).map(t=>({key:'tasks' as Collection,entry:t as unknown as Entry,date:t.due})),
  ...own(data,'exams').filter(e=>kidVisible(e)).map(e=>({key:'exams' as Collection,entry:e,date:String(e.due)})),
  ...own(data,'notes').filter(n=>entryDate(n)).map(n=>({key:'notes' as Collection,entry:n,date:entryDate(n)})),
  ...own(data,'calendarEvents').filter(e=>kidVisible(e)).map(e=>({key:'calendarEvents' as Collection,entry:e,date:String(e.date)})),
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
 // In a family plan your own things wear your profile color (Settings › Plans & account), like each kid's.
 const myColor=parentMode?data.profiles.find(p=>p.id===data.activeProfileId)?.color:undefined
 const dotColor=(entry:{key:Collection;entry:Entry})=>kidOf(entry.entry.kidId as string|undefined)?.color??(dayHasPriority(entry)?'#d24864':myColor??data.subjects.find(s=>s.id===entry.entry.subjectId)?.color??'#d9828a')
 const classDotColor=(c:ClassOccurrence)=>kidOf(classKid(c))?.color??data.subjects.find(s=>s.id===c.block.subjectId)?.color??'#b77c98'
 // Week view: Sunday to Saturday around the selected date, classes and timed items at their hour.
 // On an iPhone seven columns are too narrow to read, so it shows three days from the selected one.
 // How many days the week view shows: 1, 3 or the whole week, remembered on this device (phones start at 3).
 const [spanSetting,setSpan]=useLocalSetting('kono-planner-days','')
 const span=['1','3','7'].includes(spanSetting)?Number(spanSetting):phone?3:7,whole=span===7
 const weekStart=whole?addDays(date,-new Date(date+'T12:00:00').getDay()):date,weekDays=Array.from({length:span},(_,i)=>addDays(weekStart,i)),weekStep=span
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
 // On a phone, 1 or 3 days: a quick sideways swipe goes to the next or previous days (a hold still drags).
 const swipeStart=useRef<{x:number;y:number;t:number}|null>(null)
 const swipe={
  onTouchStart:(e:TouchEvent)=>{const t=e.touches[0];swipeStart.current=e.touches.length===1&&t&&!(e.target as Element).closest?.('.week-item.is-movable')?{x:t.clientX,y:t.clientY,t:Date.now()}:null},
  onTouchEnd:(e:TouchEvent)=>{const s=swipeStart.current,t=e.changedTouches[0];swipeStart.current=null;if(!s||!t||Date.now()-s.t>600)return;const dx=t.clientX-s.x,dy=t.clientY-s.y;if(Math.abs(dx)>60&&Math.abs(dx)>2*Math.abs(dy))selectDate(addDays(date,dx<0?weekStep:-weekStep))},
 }
 // Quick add's repeat runs to the end of the school year (or ten weeks), and suggests drivers already used.
 const schoolYearEnd=(from:string)=>data.studySeasons.filter(x=>x.active&&x.school&&x.profileId===data.activeProfileId&&x.school.lastClassDate>from).map(x=>x.school!.lastClassDate).sort().at(-1)??addDays(from,70)
 const me=data.profiles.find(p=>p.id===data.activeProfileId)?.name
 const drivers=[...new Set([...(me&&me!=='Learner'?[me]:[]),...data.calendarEvents.map(e=>e.driver).filter((d):d is string=>!!d)])].slice(0,12)
 const addAt=(day:string,time:string)=>{selectDate(day);if(parentMode)setQuickAdd({date:day,time});else create('calendarEvents',day,undefined,{time,endTime:later(time,60)})}
 // One switcher, like a family wall calendar: Day, 3 days and Week are the hour grid; Month; and Schedule
 // (the list of what's coming, day by day).
 const views:[string,string,()=>void,boolean][]=[['Day','day',()=>{setMode('week');setSpan('1')},mode==='week'&&span===1],['3 days','3days',()=>{setMode('week');setSpan('3')},mode==='week'&&span===3],['Week','week',()=>{setMode('week');setSpan('7')},mode==='week'&&span===7],['Month','month',()=>setMode('month'),mode==='month'],['Schedule','schedule',()=>setMode('agenda'),mode==='agenda']]
 // Month: each day's things as small pills in that person's color (a class's pill is lighter), the
 // timed ones in time order; a pill opens the item, and one you can move drags to another day.
 const shortTime=(t?:string)=>{if(!t)return '';const h=Number(t.slice(0,2)),m=t.slice(3,5);return (h%12||12)+(m==='00'?'':':'+m)+(h<12?'a':'p')}
 const personOf=(kidId?:string)=>{const k=kidOf(kidId);return k?{name:k.name,emoji:k.emoji,photo:k.photo,color:k.color}:undefined}
 // Birthdays, countdowns and school holidays: all-day, first in the day.
 const specials=(day:string)=>specialOn(data,data.activeProfileId,day)
 const specialColor=(kidId?:string)=>kidOf(kidId)?.color??myColor??'#d9828a'
 const dayBanners=(day:string)=>{const holiday=holidayOn(data,day),list=specials(day);return holiday||list.length?<div className="special-day-banners">{holiday&&<p className="special-day-banner is-holiday"><span aria-hidden="true">🏖️ </span>No school: {holiday}</p>}{list.map(x=><p key={x.day.id} className="special-day-banner" style={{'--pill':specialColor(x.day.kidId)} as CSSProperties}><span aria-hidden="true">{x.icon} </span>{x.label}</p>)}</div>:null}
 const monthPills=(day:string)=>[
  ...(holidayOn(data,day)?[{key:'holiday',time:'00:00',important:true,node:<span key="holiday" className="month-pill is-holiday" style={{'--pill':'#8fb3d9'} as CSSProperties}>{!phone&&<span className="month-pill-text">🏖️ {holidayOn(data,day)}</span>}</span>}]:[]),
  ...specials(day).map(x=>({key:'s'+x.day.id,time:'00:01',important:true,node:<button type="button" key={'s'+x.day.id} className="month-pill is-special" style={{'--pill':specialColor(x.day.kidId)} as CSSProperties} aria-label={x.label+' · '+dateLabel(day)} onClick={()=>openSpecial?.()}>{!phone&&<span className="month-pill-text">{x.icon} {x.label}</span>}</button>})),
  ...scheduleClasses(day).map(c=>({key:'c'+c.id,time:c.timePending?undefined:c.displayStart??c.block.start,important:false,node:<button type="button" key={'c'+c.id} className="month-pill is-class" style={{'--pill':classDotColor(c)} as CSSProperties} aria-label={c.block.label+' (class) · '+dateLabel(day)} onClick={()=>setClassOpen({day,id:c.id})}>{!phone&&<span className="month-pill-text">{c.block.label}</span>}</button>})),
  ...entries.filter(e=>e.date===day).map(e=>{const time=entryTime(e),who=personOf(e.entry.kidId as string|undefined),title=titleOf(e.entry)||'Untitled',important=dayHasPriority(e);return {key:e.key+e.entry.id,time,important,node:<button type="button" key={e.key+e.entry.id} className={'month-pill'+(important?' is-priority':'')+(e.entry.done?' is-done':'')} style={{'--pill':dotColor(e)} as CSSProperties} draggable={e.key!=='notes'} onDragStart={ev=>{ev.stopPropagation();dragEntry(ev,e)}} aria-label={(important?'Important: ':'')+title+(time?' · '+shortTime(time):'')+(who?' · '+who.name:'')+' · '+dateLabel(day)} onClick={()=>edit(e.key,e.entry)}>{!phone&&<>{who&&<Avatar className="month-pill-face" who={who}/>}{time&&<time>{shortTime(time)}</time>}<span className="month-pill-text">{important?'★ ':''}{title}</span></>}</button>}}),
 ].sort((a,b)=>Number(b.important)-Number(a.important)||(a.time??'99:99').localeCompare(b.time??'99:99'))
 // Tapping a day (or "+3 more") shows that day's page under the month.
 const dayPaper=useRef<HTMLDivElement>(null)
 const openDay=(day:string)=>{selectDate(day);requestAnimationFrame(()=>dayPaper.current?.scrollIntoView({behavior:'smooth',block:'nearest'}))}
 const heroDate=new Date(date+'T12:00:00')
 return <section className="wb-panel cozy-calendar-shell"><div className="calendar-hero"><div className="calendar-hero-date"><small>{date===todayDate?'Today · ':''}{heroDate.toLocaleDateString(undefined,{weekday:'long'})}</small><h2>{heroDate.toLocaleDateString(undefined,{month:'long',day:'numeric'})}</h2></div><div className="calendar-hero-tools">{date!==todayDate&&<button type="button" className="calendar-today" title="Go back to today on the calendar and daily page" onClick={()=>{selectDate(todayDate);setMonth(todayDate.slice(0,7))}}>↩ Back to today</button>}{onWall&&<button type="button" className="calendar-wall" title="A big always-on view of today and tomorrow, for a tablet on the wall" onClick={onWall}><span aria-hidden="true">📺</span> Wall display</button>}<div className="calendar-views" role="group" aria-label="Calendar view">{views.map(([label,id,pick,on])=><button type="button" key={id} className={'calendar-view-'+id} aria-pressed={on} onClick={pick}>{label}</button>)}</div></div></div>
  <div className="planner-filters">
  {available.length>1&&<div className="planner-source-chips" role="group" aria-label="Show on calendar">{PLANNER_SOURCES.filter(s=>available.includes(s.id)).map(s=><button type="button" key={s.id} title={s.title} aria-pressed={shown(s.id)} className={'source-chip source-'+s.id} onClick={()=>toggleSource(s.id)}>{s.label}</button>)}</div>}

  {peopleFilter}
  </div>
  {mode==='week'&&<><div className="wb-section-head week-grid-nav"><button aria-label={whole?'Previous week':span===1?'Previous day':'Previous days'} onClick={()=>selectDate(addDays(date,-weekStep))}>‹</button><h3>{new Date(weekDays[0]+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})} – {new Date(weekDays[weekDays.length-1]+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</h3><button aria-label={whole?'Next week':span===1?'Next day':'Next days'} onClick={()=>selectDate(addDays(date,weekStep))}>›</button></div><p className="wb-muted week-grid-hint">{phone?(span<7?'Swipe for more days. ':'')+'Tap to open or add. Hold to move; drag the bottom edge to make it longer.':'Tap anything to open it, or an empty time to add something then. Drag something to move it; drag its bottom edge to make it longer.'}</p><div className={'week-grid-scroll'+(phone&&span>3?' is-wide':'')} {...(phone&&span<7?swipe:{})}><WeekGrid days={weekDays} items={weekItems} selected={date} onSelect={selectDate} onAddAt={addAt} onOpen={openOnWeek} onDrop={dropOnWeek} onStretch={stretchOnWeek} dayLabel={dateLabel}/></div></>}
  {openClass&&<Modal title={dateLabel(openClass.date)} close={()=>setClassOpen(null)}><div className="week-class-sheet">{renderClass(openClass)}</div></Modal>}
  {mode==='month'&&<><div className="wb-section-head"><button aria-label="Previous month" onClick={()=>shift(-1)}>‹</button><h3>{start.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><button aria-label="Next month" onClick={()=>shift(1)}>›</button></div><div className={'month-grid'+(phone?' is-phone':'')}>{dayNames.map(d=><span className="month-grid-head" key={d}>{d.slice(0,phone?1:3)}</span>)}{Array.from({length:42},(_,i)=>addDays(gridStart,i)).map(day=>{const dayEntriesForDate=entries.filter(e=>e.date===day),classes=scheduleClasses(day),important=dayEntriesForDate.filter(dayHasPriority),pills=monthPills(day),fit=phone?3:4,shownPills=pills.length>fit?pills.slice(0,fit-1):pills,more=pills.length-shownPills.length;return <div key={day} className={'month-cell'+(day.slice(0,7)!==month?' is-other-month':'')+(day===todayDate?' is-today':'')+(date===day?' is-selected':'')+(important.length?' has-priority':'')+(dropTarget===day?' drop-target':'')} {...dropOn(day)}><button type="button" className="month-day" aria-label={dateLabel(day)+' · '+(dayEntriesForDate.length+classes.length)+' entries · '+important.length+' important · '+schoolDayLabels(data,day).join(' · ')} aria-pressed={date===day} onClick={()=>openDay(day)}><span className="month-day-num">{Number(day.slice(-2))}</span>{!phone&&<span className="school-day-mini">{schoolDayLabels(data,day).map(label=>label.slice(label.indexOf(':')+1).trim()).join(' · ')}</span>}</button>{shownPills.length>0&&<div className="month-pills">{shownPills.map(p=>p.node)}{more>0&&<button type="button" className="month-more" aria-label={more+' more on '+dateLabel(day)} onClick={()=>openDay(day)}>+{more}{phone?'':' more'}</button>}</div>}</div>})}</div></>}
  {mode==='agenda'&&<div className="wb-agenda-upcoming"><h4>This week</h4>{dayEntries.map(({day,entries:dayEntriesForDate,classes:dayClasses},i)=>{if(i>=2&&!parentMode&&!dayClasses.length&&!dayEntriesForDate.length)return null;const important=dayEntriesForDate.filter(dayHasPriority).length;return <div key={day} className={'wb-agenda-day-wrap'+(parentMode?' has-add':'')}><details open={i===0} className={'wb-agenda-day'+(dropTarget===day?' drop-target':'')} {...dropOn(day)}><summary><h3>{i===0?'Today':i===1?'Tomorrow':dateLabel(day)}{i<2&&<small className="wb-agenda-day-date"> · {dateLabel(day)}</small>}</h3><span className="wb-agenda-day-meta"><small>{dayClasses.length+dayEntriesForDate.length} item{dayClasses.length+dayEntriesForDate.length===1?'':'s'}{important?' · '+important+' important':''}</small></span></summary>{dayBanners(day)}{schoolDayLabels(data,day).map(label=><p className="school-day-label" key={label}>{label}</p>)}{importantFirst(dayEntriesForDate.filter(e=>e.key==='exams'||!attachedToClass(e,dayClasses))).map(draggableEntry)}{dayClasses.map(renderClass)}{!dayClasses.length&&!dayEntriesForDate.length&&<p className="wb-muted">Nothing scheduled.</p>}</details>{parentMode&&<button type="button" className="quick-add-kid-event wb-agenda-add" aria-label={'Add for '+dateLabel(day)} onClick={()=>setQuickAdd({date:day})}>＋ Add</button>}</div>})}{!parentMode&&dayEntries.slice(2).every(d=>!d.classes.length&&!d.entries.length)&&<p className="wb-muted wb-agenda-empty-note">Nothing else scheduled this week.</p>}</div>}
  {/* Only shown in Month view: in Agenda mode the selected date is always day 0 of "This week"
      above (dayEntries starts counting from `date`), so this would just repeat that day's own
      list. Month view has no other per-day detail panel, so a clicked date still needs one here. */}
  {mode!=='agenda'&&<div className="planner-day-paper" ref={dayPaper}><header><small>YOUR DAILY PAGE</small><div className="planner-day-nav"><button type="button" aria-label="Previous day" onClick={()=>{const d=addDays(date,-1);selectDate(d);setMonth(d.slice(0,7))}}>‹</button><h3>{date===todayDate?'Today · ':''}{dateLabel(date)}</h3><button type="button" aria-label="Next day" onClick={()=>{const d=addDays(date,1);selectDate(d);setMonth(d.slice(0,7))}}>›</button></div></header>
  {/* The same layout as the Sanctuary's "Today's schedule": progress, the school-day note, the day's
      classes as compact cards (with what's due for each), then everything else under "Also". */}
  {dayBanners(date)}<AssignmentProgress tasks={tasks} date={date} label={dateLabel(date)}/>{schoolDayLabels(data,date).map(label=><p className="school-day-label" key={label}>{label}</p>)}
  <section className={'planner-day-board'+(dropTarget===date?' drop-target':'')} aria-label={'Plan for '+dateLabel(date)} {...dropOn(date)}>{selectedClasses.length>0&&<div className="today-schedule-list">{selectedClasses.map(renderClass)}</div>}{dayLoose.length>0&&<div className="tomorrow-extra-list"><strong>{selectedClasses.length?(date===todayDate?'Also today':'Also on this day'):(date===todayDate?'Today':'On this day')}</strong>{importantFirst(dayLoose).map(draggableEntry)}</div>}{!selectedClasses.length&&!dayLoose.length&&<p className="wb-muted">Nothing planned for this day.</p>}</section>
  <div className="planner-date-tools">{parentMode&&<button type="button" className="quick-add-kid-event" onClick={()=>setQuickAdd({date})}>＋ Quick add for this day</button>}<details className="planner-add-menu"><summary>＋ Add to this date</summary><div><button onClick={()=>create('tasks',date)}>Assignment</button><button onClick={()=>create('notes',date)}>Study note</button><button className="is-priority" onClick={()=>create('exams',date)}>★ Exam / project</button><button onClick={()=>create('calendarEvents',date,undefined,{kind:'lesson'})}>Lesson</button><button onClick={()=>create('calendarEvents',date,undefined,{kind:'work'})}>Work</button><button onClick={()=>create('calendarEvents',date)}>Reminder / event</button></div></details></div>
  </div>}
  {quickAdd&&<Modal title={'Add for '+dateLabel(quickAdd.date)} close={()=>setQuickAdd(null)}>{kids.length?<QuickFamilyAdd kids={kids} time={quickAdd.time} date={quickAdd.date} until={schoolYearEnd(quickAdd.date)} drivers={drivers} clashes={p=>findClashes(data,data.activeProfileId,{dates:[quickAdd.date,...weekdayDates(quickAdd.date,p.repeatDays,p.until)],time:p.time,endTime:p.endTime,kidIds:p.kidIds,driver:p.driver},dateLabel)} onCancel={()=>setQuickAdd(null)} onSave={async payload=>{if(await quickAddEvent(quickAdd.date,payload))setQuickAdd(null)}}/>:<><p className="wb-muted">No kids added yet.</p><button type="button" onClick={()=>{setQuickAdd(null);navigate('Kids')}}>Manage kids</button></>}</Modal>}
  </section>
}
