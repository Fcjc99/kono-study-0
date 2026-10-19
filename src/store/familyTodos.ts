import type {AppData,FamilyTodo,TodoRepeat} from './model'
import {addDays} from './studyScheduler'

/** Family to-dos with a day (and maybe a repeat): "Clean house · Saturday · every week",
 * "Trash out · every 2 weeks", "Pay rent · the 1st · every month". */
const dayNumber=(date:string)=>Math.round(Date.parse(date+'T12:00:00Z')/86400000)
const daysIn=(year:number,month:number)=>new Date(Date.UTC(year,month,0)).getUTCDate()

export const TODO_REPEATS:{id:TodoRepeat;label:string}[]=[{id:'week',label:'Every week'},{id:'2weeks',label:'Every 2 weeks'},{id:'month',label:'Every month'}]
export const repeatLabel=(repeat:TodoRepeat)=>TODO_REPEATS.find(r=>r.id===repeat)?.label??''

/** The day of the month a monthly to-do keeps to: its own (monthDay), so one on the 31st that lands on
 * Nov 30 goes back to the 31st in December. */
const monthDayOf=(t:FamilyTodo)=>t.monthDay??Number(t.due!.slice(8,10))
/** A repeat as saved: "every week" also keeps the older weekly flag, so an older copy of the app (another
 * phone not updated yet) still sees it repeat; a monthly one keeps its day of the month. */
export const repeatFields=(repeat:TodoRepeat|undefined,due:string|undefined,monthDay?:number)=>!repeat||!due?{}:{repeat,...(repeat==='week'?{weekly:true}:{}),...(repeat==='month'?{monthDay:monthDay??Number(due.slice(8,10))}:{})}

/** Does this to-do fall on this date: its own day, or (for a repeat) a later turn of it. A monthly one on
 * the 31st lands on the last day of shorter months. */
export function todoOn(t:FamilyTodo,date:string):boolean{
 if(!t.due)return false
 if(t.due===date)return true
 if(!t.repeat||date<t.due)return false
 if(t.repeat!=='month'){const gap=dayNumber(date)-dayNumber(t.due);return gap%(t.repeat==='2weeks'?14:7)===0}
 const [y,m,d]=date.split('-').map(Number),want=monthDayOf(t)
 return d===Math.min(want,daysIn(y,m))
}
/** The next turn of a repeating to-do after a date. */
export function nextTurn(t:FamilyTodo,after:string):string{
 if(!t.due||!t.repeat)return t.due??after
 if(t.repeat!=='month'){const step=t.repeat==='2weeks'?14:7,gap=dayNumber(after)-dayNumber(t.due),turns=gap<0?0:Math.floor(gap/step)+1;return addDays(t.due,turns*step)}
 const want=monthDayOf(t)
 let [y,m]=after.split('-').map(Number)
 for(let i=0;i<14;i++){const date=y+'-'+String(m).padStart(2,'0')+'-'+String(Math.min(want,daysIn(y,m))).padStart(2,'0');if(date>after&&date>=t.due)return date;m++;if(m>12){m=1;y++}}
 return addDays(after,30)
}
/** Open to-dos that fall on this date. */
export function todosOn(data:Pick<AppData,'familyTodos'>,profileId:string,date:string):FamilyTodo[]{
 return (data.familyTodos??[]).filter(t=>t.profileId===profileId&&!t.done&&todoOn(t,date))
}
/** Ticking a repeating to-do moves it to its next turn, instead of crossing it off: the turn after the one
 * ticked (on, from the Planner) or after its own day, and never one already past (a missed turn moves to
 * today's, if today is one). */
export function tickTodo(t:FamilyTodo,today:string,on?:string):FamilyTodo{
 if(t.repeat&&t.due&&!t.done){let next=nextTurn(t,on??t.due);for(let i=0;i<500&&next<today;i++)next=nextTurn(t,next);return {...t,due:next,doneAt:new Date().toISOString()}}
 return {...t,done:!t.done,doneAt:t.done?undefined:new Date().toISOString()}
}
/** "Saturday", "Today", "Tomorrow" or "Nov 1" for a to-do's day. */
export function todoDayLabel(due:string,today:string):string{
 if(due===today)return 'Today'
 if(due===addDays(today,1))return 'Tomorrow'
 const d=new Date(due+'T12:00:00'),days=dayNumber(due)-dayNumber(today)
 return days>0&&days<7?d.toLocaleDateString(undefined,{weekday:'long'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'})
}
