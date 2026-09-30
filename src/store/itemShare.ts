import {uid,type AppData,type Exam,type Task} from './model'

/** Sharing one assignment or exam with a connected classmate (supabase/migrations/0010). Only what's
 * here is sent: the title, due date, the subject's name, the details and the time estimate. Never
 * subtasks, the kid, planned times, colors or anything else in the plan. */
export type ShareKind='task'|'exam'
export type SharedItem={title:string;due:string;subject:string;notes:string;estimatedMinutes?:number}
export type ReceivedItem={id:string;senderId:string;kind:ShareKind;item:SharedItem;createdAt:string}

const LIMITS={title:200,subject:120,notes:1500}
const clip=(value:unknown,max:number)=>String(value??'').replace(/\s+$/,'').slice(0,max)
const isDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(value+'T12:00:00').getTime())

export const shareKindFor=(key:string):ShareKind|null=>key==='tasks'?'task':key==='exams'?'exam':null

/** What a classmate receives for this assignment or exam. */
export function sharePayload(data:AppData,entry:Pick<Task,'title'|'due'|'subjectId'|'notes'>&{estimatedMinutes?:number}):SharedItem{
 const subject=data.subjects.find(s=>s.id===entry.subjectId)?.name??''
 const minutes=Number(entry.estimatedMinutes)
 return {title:clip(entry.title,LIMITS.title).trim(),due:entry.due,subject:clip(subject,LIMITS.subject).trim(),notes:clip(entry.notes,LIMITS.notes),...(Number.isInteger(minutes)&&minutes>0&&minutes<=600?{estimatedMinutes:minutes}:{})}
}

/** A shared item as it arrives, checked: anything malformed is dropped, not guessed at. */
export function readSharedItem(value:unknown):SharedItem|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const v=value as Record<string,unknown>
 const title=clip(v.title,LIMITS.title).trim(),due=String(v.due??'')
 if(!title||!isDate(due))return null
 const minutes=Number(v.estimatedMinutes)
 return {title,due,subject:clip(v.subject,LIMITS.subject).trim(),notes:clip(v.notes,LIMITS.notes),...(Number.isInteger(minutes)&&minutes>0&&minutes<=600?{estimatedMinutes:minutes}:{})}
}

const same=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase()

/** Already in this plan: the same title on the same day. */
export function alreadyInPlan(data:AppData,kind:ShareKind,item:SharedItem){
 const list:(Task|Exam)[]=kind==='task'?data.tasks:data.exams
 return list.some(e=>e.profileId===data.activeProfileId&&e.due===item.due&&same(e.title,item.title))
}

/** Adds a shared item to the active plan as an assignment or exam, under the subject with the same
 * name if there is one. The details note who shared it. */
export function addSharedItem(data:AppData,kind:ShareKind,item:SharedItem,from:string):AppData{
 if(alreadyInPlan(data,kind,item))return data
 const profileId=data.activeProfileId
 const subjectId=item.subject?data.subjects.find(s=>s.profileId===profileId&&same(s.name,item.subject))?.id??'':''
 const notes=[from?'Shared by '+from+'.':'',item.notes].filter(Boolean).join('\n')
 if(kind==='task'){
  const task:Task={id:uid('tasks'),profileId,subjectId,title:item.title,due:item.due,done:false,notes,...(item.estimatedMinutes?{estimatedMinutes:item.estimatedMinutes}:{})}
  return {...data,tasks:[...data.tasks,task]}
 }
 const exam:Exam={id:uid('exams'),profileId,subjectId,title:item.title,due:item.due,notes,done:false}
 return {...data,exams:[...data.exams,exam]}
}
