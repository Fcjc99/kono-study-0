import type {Exam,Task} from './model'
import {addDays} from './studyScheduler'

/** What Up next shows when nothing is late: the next unfinished assignment due within a week, else the next
 * test within a week to study for, else nothing. */
export function upNext(tasks:Task[],exams:Exam[],today:string):{task?:Task;exam?:Exam}|null{
 const soon=addDays(today,7)
 const task=tasks.filter(t=>!t.done&&t.due>=today&&t.due<=soon).sort((a,b)=>a.due.localeCompare(b.due)||(a.plannedTime??'').localeCompare(b.plannedTime??''))[0]
 if(task)return {task}
 const exam=exams.filter(e=>!e.done&&e.due>=today&&e.due<=soon).sort((a,b)=>a.due.localeCompare(b.due))[0]
 return exam?{exam}:null
}

/** Today's "Then": the next few things after Up next, within a week: unfinished assignments and tests, soonest
 * first, leaving out the one Up next already shows (and anything late, which the Overdue card has). */
export function thenList(tasks:Task[],exams:Exam[],today:string,skip:string|undefined,limit=3):({task:Task;exam?:undefined}|{exam:Exam;task?:undefined})[]{
 const soon=addDays(today,7)
 const items=[
  ...tasks.filter(t=>!t.done&&t.id!==skip&&t.due>=today&&t.due<=soon).map(task=>({task,due:task.due,at:task.plannedTime??''})),
  ...exams.filter(e=>!e.done&&e.id!==skip&&e.due>=today&&e.due<=soon).map(exam=>({exam,due:exam.due,at:''})),
 ].sort((a,b)=>a.due.localeCompare(b.due)||a.at.localeCompare(b.at))
 return items.slice(0,limit).map(i=>'task' in i?{task:i.task}:{exam:i.exam})
}
