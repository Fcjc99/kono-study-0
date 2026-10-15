import type {AppData,SpecialDay} from './model'

const pad=(n:number)=>String(n).padStart(2,'0')
const daysIn=(year:number,month:number)=>new Date(year,month,0).getDate()
const dayNumber=(date:string)=>Math.round(new Date(date+'T12:00:00Z').getTime()/86400000)

/** Where a special day falls on or after `from`: a countdown on its date (if it hasn't passed), a birthday
 * on its month and day this year or next (Feb 29 is Feb 28 in other years). */
export function nextDate(day:SpecialDay,from:string):string|null{
 if(day.kind==='countdown')return day.date>=from?day.date:null
 const [,m,d]=day.date.split('-').map(Number),year=Number(from.slice(0,4))
 for(const y of [year,year+1]){const date=y+'-'+pad(m)+'-'+pad(Math.min(d,daysIn(y,m)));if(date>=from&&date>=day.date)return date}
 return null
}

/** "Emma’s birthday (9)" / "🎉 Disney trip": what a special day reads as on `date`. */
export function specialLabel(day:SpecialDay,date:string):string{
 if(day.kind==='countdown')return day.title
 const age=Number(date.slice(0,4))-Number(day.date.slice(0,4))
 return day.title+'’s birthday'+(age>0&&age<130?' ('+age+')':'')
}
export const specialIcon=(day:SpecialDay)=>day.emoji||(day.kind==='birthday'?'🎂':'🎉')

export type SpecialOn={day:SpecialDay;date:string;label:string;icon:string;daysAway:number}

/** The plan's special days that land on `date`. */
export function specialOn(data:Pick<AppData,'specialDays'>,profileId:string,date:string):SpecialOn[]{
 return (data.specialDays??[]).filter(s=>s.profileId===profileId&&nextDate(s,date)===date).map(day=>({day,date,label:specialLabel(day,date),icon:specialIcon(day),daysAway:0}))
}

/** What's coming up within `within` days of today, soonest first: for Home, the wall display and the share page. */
export function upcomingSpecial(data:Pick<AppData,'specialDays'>,profileId:string,today:string,within=60):SpecialOn[]{
 return (data.specialDays??[]).filter(s=>s.profileId===profileId).flatMap(day=>{const date=nextDate(day,today);if(!date)return [];const daysAway=dayNumber(date)-dayNumber(today);return daysAway<=within?[{day,date,label:specialLabel(day,date),icon:specialIcon(day),daysAway}]:[]}).sort((a,b)=>a.daysAway-b.daysAway||a.label.localeCompare(b.label))
}

/** "Today!", "Tomorrow", "12 days". */
export const daysAwayLabel=(n:number)=>n===0?'Today!':n===1?'Tomorrow':n+' days'
