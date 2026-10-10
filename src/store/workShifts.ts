import type {AppData, StudySeason} from './model'
import {classOccurrences} from './classSchedule'

/** Work shifts (Planner › ＋ Add to my calendar › My work schedule) are weekly activities whose name ends
 * in " · work". Plan my week already plans around them (store/weekPlan › busyTimes); reminders and
 * KONO's nudges keep quiet during them, and the Sunday card shows them. */
export const WORK_SUFFIX=' · work'
export const isWorkSeason=(s:Pick<StudySeason,'name'>)=>s.name.endsWith(WORK_SUFFIX)
export const jobName=(s:Pick<StudySeason,'name'>)=>s.name.slice(0,-WORK_SUFFIX.length)

export type Shift={job:string;date:string;start:string;end:string;where?:string}
const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
export const shiftMinutes=(s:Shift)=>Math.max(0,minutes(s.end)-minutes(s.start))

/** The shifts on one day, earliest first. */
export function shiftsOn(data:Pick<AppData,'activeProfileId'|'studySeasons'>,date:string):Shift[]{
 return classOccurrences(data,date).filter(c=>isWorkSeason(c.season)&&!c.block.skippedDates?.includes(date)&&c.block.start&&c.block.end)
  .map(c=>({job:jobName(c.season),date,start:c.block.start,end:c.block.end,...(c.block.location?{where:c.block.location}:{})}))
}

const pad=(n:number)=>String(n).padStart(2,'0')
const dayOf=(d:Date)=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())
const clockOf=(d:Date)=>pad(d.getHours())+':'+pad(d.getMinutes())

/** The shift going on at this moment, if any. */
export function shiftAt(data:Pick<AppData,'activeProfileId'|'studySeasons'>,when:Date):Shift|undefined{
 const clock=clockOf(when)
 return shiftsOn(data,dayOf(when)).find(s=>s.start<=clock&&clock<s.end)
}
