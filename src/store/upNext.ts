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
