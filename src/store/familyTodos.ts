import type {AppData,FamilyTodo} from './model'
import {addDays} from './studyScheduler'

/** Family to-dos with a day (and maybe a weekly repeat): "Clean house · Saturday · every week". */
const dayNumber=(date:string)=>Math.round(Date.parse(date+'T12:00:00Z')/86400000)

/** Open to-dos that fall on this date: ones for that day, and weekly ones on their weekday from their
 * first day on. */
export function todosOn(data:Pick<AppData,'familyTodos'>,profileId:string,date:string):FamilyTodo[]{
 return (data.familyTodos??[]).filter(t=>t.profileId===profileId&&!t.done&&t.due&&(t.due===date||t.weekly&&date>t.due&&(dayNumber(date)-dayNumber(t.due))%7===0))
}
/** Ticking a weekly to-do moves it to the same day next week (after today), instead of crossing it off. */
export function tickTodo(t:FamilyTodo,today:string):FamilyTodo{
 if(t.weekly&&t.due&&!t.done){let next=addDays(t.due,7);while(next<=today)next=addDays(next,7);return {...t,due:next,doneAt:new Date().toISOString()}}
 return {...t,done:!t.done,doneAt:t.done?undefined:new Date().toISOString()}
}
/** "Sat", "Today", "Tomorrow" for a to-do's day. */
export function todoDayLabel(due:string,today:string):string{
 if(due===today)return 'Today'
 if(due===addDays(today,1))return 'Tomorrow'
 const d=new Date(due+'T12:00:00'),days=dayNumber(due)-dayNumber(today)
 return days>0&&days<7?d.toLocaleDateString(undefined,{weekday:'long'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'})
}
