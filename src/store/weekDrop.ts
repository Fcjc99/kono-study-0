import {uid,type CalendarEvent} from './model'

/** Planner › Week: what dropping something on an hour means.
 * - An event moves there, keeping its length.
 * - An assignment on its due day gets that as its planned time; on an earlier day it gets a study
 *   session (like Plan my week makes) so the work happens before it's due; after its due date the
 *   due date would have to move, so that's asked first.
 * - An exam gets a study session on any earlier day.
 * Anything else, or an exam dropped on or after its day, does nothing. */
export type WeekDrop=
 |{kind:'patch';changes:Record<string,unknown>}
 |{kind:'session';event:CalendarEvent}
 |{kind:'move-due';changes:Record<string,unknown>;question:string}
 |{kind:'none';why:string}

type DropEntry={id:string;title?:unknown;due?:unknown;time?:unknown;endTime?:unknown;estimatedMinutes?:unknown;subjectId?:unknown;kidId?:unknown}
const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
const clock=(m:number)=>{const x=Math.max(0,Math.min(24*60-1,m));return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0')}
const nice=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})

export function weekDrop(key:string,entry:DropEntry,day:string,time:string,profileId:string):WeekDrop{
 const title=String(entry.title??'').trim()||'Untitled'
 if(key==='calendarEvents'){
  const length=typeof entry.time==='string'&&typeof entry.endTime==='string'&&entry.endTime>entry.time?minutes(entry.endTime)-minutes(entry.time):60
  return {kind:'patch',changes:{date:day,time,endTime:clock(minutes(time)+length)}}
 }
 if(key!=='tasks'&&key!=='exams')return {kind:'none',why:'Only assignments, exams and events can be planned on the week.'}
 const due=String(entry.due??''),length=key==='tasks'&&Number(entry.estimatedMinutes)>0?Number(entry.estimatedMinutes):60
 if(key==='tasks'&&day===due)return {kind:'patch',changes:{plannedTime:time}}
 if(key==='tasks'&&day>due)return {kind:'move-due',changes:{due:day,plannedTime:time},question:`“${title}” is due ${nice(due)}. Move it to ${nice(day)}?`}
 if(key==='exams'&&day>=due)return {kind:'none',why:'Plan study time before the exam day.'}
 const session:CalendarEvent={id:uid('event'),profileId,date:day,time,endTime:clock(minutes(time)+length),title:(key==='tasks'?'Work on ':'Study for ')+title,kind:'study',notes:'For '+title+' · due '+due,done:false,planFor:(key==='tasks'?'task:':'exam:')+entry.id,
  ...(typeof entry.subjectId==='string'&&entry.subjectId?{subjectId:entry.subjectId}:{}),...(typeof entry.kidId==='string'&&entry.kidId?{kidId:entry.kidId}:{})}
 return {kind:'session',event:session}
}
