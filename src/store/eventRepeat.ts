import {addDays} from './studyScheduler'
import {uid,type CalendarEvent,type Task} from './model'

/** Repeating events (the event editor's "Repeat"): one event per date, linked by a shared recurringId
 * so a change can go to the rest of the series and the whole series can be deleted at once. Copies
 * are the student's own events: no Canvas/Google source, plan link, score or review flag. */
export type Repeat='none'|'daily'|'weekdays'|'weekly'|'biweekly'|'monthly'
export const REPEATS:[Repeat,string][]=[['none','Doesn’t repeat'],['daily','Every day'],['weekdays','Every weekday (Mon–Fri)'],['weekly','Every week'],['biweekly','Every 2 weeks'],['monthly','Every month']]
/** At most this many copies at once (a school year of weekdays). */
export const MAX_REPEATS=200
/** Until: ten weeks on by default (most of a term). */
export const defaultUntil=(start:string)=>addDays(start,70)

const weekday=(date:string)=>new Date(date+'T12:00:00').getDay()
const daysIn=(year:number,month:number)=>new Date(year,month,0).getDate()

/** The dates after `start` up to and including `until`. A monthly repeat on the 31st skips the
 * months without one. */
export function repeatDates(start:string,repeat:Repeat,until:string):string[]{
 const out:string[]=[]
 if(repeat==='none'||!start||!until||until<=start)return out
 if(repeat==='monthly'){
  const [y,m,d]=start.split('-').map(Number)
  for(let i=1;out.length<MAX_REPEATS&&i<=120;i++){
   const year=y+Math.floor((m-1+i)/12),month=(m-1+i)%12+1
   if(d>daysIn(year,month))continue
   const date=year+'-'+String(month).padStart(2,'0')+'-'+String(d).padStart(2,'0')
   if(date>until)break
   out.push(date)
  }
  return out
 }
 const step=repeat==='weekly'?7:repeat==='biweekly'?14:1
 for(let date=addDays(start,step);date<=until&&out.length<MAX_REPEATS;date=addDays(date,step)){
  if(repeat==='weekdays'&&(weekday(date)===0||weekday(date)===6))continue
  out.push(date)
 }
 return out
}

/** Practice every Tuesday and Thursday: the dates after `start` up to `until` on those weekdays (0 = Sunday). */
export function weekdayDates(start:string,days:number[],until:string):string[]{
 const out:string[]=[]
 if(!days.length||!start||!until||until<=start)return out
 for(let date=addDays(start,1);date<=until&&out.length<MAX_REPEATS;date=addDays(date,1))if(days.includes(weekday(date)))out.push(date)
 return out
}
/** A copy of `event` on `date`, in the same series. */
export function repeatCopy(event:CalendarEvent,date:string,recurringId:string):CalendarEvent{
 const copy:CalendarEvent={...event,id:uid('event'),date,done:false,recurringId}
 delete copy.source;delete copy.planFor;delete copy.result;delete copy.needsReview
 return copy
}

/** Which of a series a change goes to: just this one, this and the ones after it, or all of them. */
export type SeriesScope='one'|'following'|'all'
/** What a change to one event carries to the rest of its series (not the date). */
const SHARED=['title','subjectId','kidId','kidIds','kind','time','endTime','notes','driver'] as const
export function applyToSeries(events:CalendarEvent[],edited:CalendarEvent,from:string,scope:SeriesScope):CalendarEvent[]{
 return applyToSeriesBy(events,edited,from,scope,e=>e.date,SHARED)
}
/** The same for a repeating assignment ("spelling every Monday"): its due date stays its own. */
const SHARED_TASK=['title','subjectId','kidId','kidIds','notes','estimatedMinutes','link'] as const
export function applyToTaskSeries(tasks:Task[],edited:Task,from:string,scope:SeriesScope):Task[]{
 return applyToSeriesBy(tasks,edited,from,scope,t=>t.due,SHARED_TASK)
}
function applyToSeriesBy<T extends {id:string;profileId:string;recurringId?:string}>(items:T[],edited:T,from:string,scope:SeriesScope,dateOf:(x:T)=>string,shared:readonly string[]):T[]{
 if(scope==='one'||!edited.recurringId)return items
 return items.map(e=>{
  if(e.id===edited.id||e.recurringId!==edited.recurringId||e.profileId!==edited.profileId||(scope==='following'&&dateOf(e)<from))return e
  const next={...e} as Record<string,unknown>,src=edited as unknown as Record<string,unknown>
  for(const key of shared){if(src[key]===undefined)delete next[key];else next[key]=src[key]}
  return next as T
 })
}
