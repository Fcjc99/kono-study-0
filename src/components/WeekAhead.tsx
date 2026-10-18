import type {ReactNode} from 'react'
import type {AppData,Exam,Task} from '../store/model'
import type {WeekRecap} from '../store/weekRecap'
import {addDays} from '../store/studyScheduler'
import {classTime} from '../store/classSchedule'
import {shiftsOn} from '../store/workShifts'
import {todosOn} from '../store/familyTodos'

const weekday=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})
const dayNum=(date:string)=>new Date(date+'T12:00:00').getDate()
const shortTime=(t:string)=>classTime(t).replace(':00','').replace(' AM','a').replace(' PM','p')

/** Home on Saturday and Sunday: how last week went, then the week ahead day by day (what's due, tests and
 * work shifts), Monday's work, and Plan my week, so the week gets planned in one place. */
/** family: the family plan's version, every day: the next seven days from today, with each day's events and
 * to-dos ("🧹 Clean house") as well as homework, tests and work shifts; no study recap or Plan my week. */
export default function WeekAhead({data,monday,recap,tasks,exams,mondayWork,onPlan,onOpenDay,family=false,today,profileId}:{
 data:AppData;monday:string;recap:WeekRecap|null;tasks:Task[];exams:Exam[]
 mondayWork:ReactNode;onPlan:()=>void;onOpenDay:(date:string)=>void;family?:boolean;today?:string;profileId?:string
}){
 const start=family&&today?today:monday,pid=profileId??data.activeProfileId
 const days=Array.from({length:7},(_,i)=>{
  const date=addDays(start,i)
  return {date,due:tasks.filter(t=>!t.done&&t.due===date).length,tests:exams.filter(e=>!e.done&&e.due===date),shifts:shiftsOn(data,date),
   events:family?data.calendarEvents.filter(e=>e.profileId===pid&&e.date===date&&!e.planFor).length:0,todos:family?todosOn(data,pid,date):[]}
 })
 const weekTests=days.flatMap(d=>d.tests.map(e=>e.title+' ('+weekday(d.date)+')'))
 const busiest=[...days].sort((a,b)=>b.due+b.tests.length*2+b.shifts.length-(a.due+a.tests.length*2+a.shifts.length))[0]
 const total=days.reduce((n,d)=>n+d.due+d.tests.length,0),shiftCount=days.reduce((n,d)=>n+d.shifts.length,0)
 const eventCount=days.reduce((n,d)=>n+d.events,0),todoCount=days.reduce((n,d)=>n+d.todos.length,0)
 return <section className="wb-panel weekend-card week-ahead" aria-label="Your week ahead">
  <div className="wb-section-head"><div><small>{family?'THE NEXT SEVEN DAYS':'WEEK OF '+new Date(monday+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}).toUpperCase()}</small><h2>{family?'This week':'Your week ahead'}</h2></div>
   {!family&&<div className="wb-toolbar"><button className="primary" onClick={onPlan}>✨ Plan my week</button></div>}</div>
  {family&&<p className="week-ahead-sum">{eventCount?<><strong>{eventCount}</strong> event{eventCount===1?'':'s'}</>:'No events yet'}{todoCount>0&&<> · <strong>{todoCount}</strong> to-do{todoCount===1?'':'s'}</>}{total>0&&<> · <strong>{total}</strong> homework &amp; tests</>}</p>}
  {!family&&recap&&<p className="week-ahead-recap"><span aria-hidden="true">📊</span> Last week: <strong>{recap.assignmentsDone} done</strong>{recap.studySessions>0&&<> · {recap.studySessions} study session{recap.studySessions===1?'':'s'}</>} · {recap.activeDays} of 7 days active{recap.streak>1&&<> · 🔥 {recap.streak}-day streak</>}</p>}
  {!family&&<p className="week-ahead-sum">{total?<><strong>{total}</strong> thing{total===1?'':'s'} due</>:'Nothing due yet'}{shiftCount>0&&<> · <strong>{shiftCount}</strong> work shift{shiftCount===1?'':'s'}</>}{total>0&&busiest&&<> · busiest: <strong>{weekday(busiest.date)}</strong></>}</p>}
  <ol className="week-ahead-days" aria-label="This week, day by day">{days.map(d=><li key={d.date}>
   <button type="button" onClick={()=>onOpenDay(d.date)} aria-label={weekday(d.date)+' '+dayNum(d.date)+': '+[d.events?d.events+' event'+(d.events===1?'':'s'):'',...d.todos.map(t=>'to-do: '+t.title),d.due?d.due+' due':'',...d.tests.map(e=>'test: '+e.title),...d.shifts.map(s=>'work '+classTime(s.start)+' to '+classTime(s.end))].filter(Boolean).join(', ')||weekday(d.date)+' '+dayNum(d.date)+': nothing yet'}>
    <span className="wa-day" aria-hidden="true">{weekday(d.date)}<b>{dayNum(d.date)}</b></span>
    <span className="wa-marks" aria-hidden="true">
     {d.events>0&&<span className="wa-events">🗓️ {d.events}</span>}
     {d.todos.slice(0,2).map(t=><span key={t.id} className="wa-todo">✔ {t.title}</span>)}{d.todos.length>2&&<span className="wa-todo">+{d.todos.length-2}</span>}
     {d.due>0&&<span className="wa-due">📌 {d.due}</span>}
     {d.tests.length>0&&<span className="wa-test">📝 {d.tests.length}</span>}
     {d.shifts.map(s=><span key={s.start} className="wa-shift">💼 {shortTime(s.start)}–{shortTime(s.end)}</span>)}
    </span>
   </button>
  </li>)}</ol>
  {!family&&mondayWork}
  {family?weekTests.length>0&&<p className="weekend-tests"><strong>Tests:</strong> {weekTests.join(', ')}</p>:weekTests.length>0?<p className="weekend-tests"><strong>Tests this week:</strong> {weekTests.join(', ')}</p>:<p className="wb-muted">No tests next week.</p>}
 </section>
}
