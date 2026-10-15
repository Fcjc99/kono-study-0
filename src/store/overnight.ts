import {addDays} from './studyScheduler'

/** Late-night events: one that ends before it starts (a sleepover 7 PM–9 AM, a shift 10 PM–2 AM) runs past
 * midnight into the next morning. */
export const isOvernight=(e:{time?:string;endTime?:string})=>!!(e.time&&e.endTime&&/^\d{2}:\d{2}$/.test(e.time)&&/^\d{2}:\d{2}$/.test(e.endTime)&&e.endTime<e.time)
/** The day before's late-night events that are still going on this date. */
export const carriedOver=<T extends {date:string;time?:string;endTime?:string}>(events:T[],date:string)=>{const before=addDays(date,-1);return events.filter(e=>e.date===before&&isOvernight(e))}
/** Minutes from the start of its own date to its end (past 24:00 when it runs overnight; an hour when it has no end). */
export const endMinutes=(time:string,endTime?:string)=>{const m=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5)),s=m(time);if(!endTime||endTime===time)return s+60;return endTime>time?m(endTime):m(endTime)+1440}
