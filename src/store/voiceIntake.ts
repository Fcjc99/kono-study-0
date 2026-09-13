import {dateFrom} from './scheduleImport'
import type {Collection} from './workspace'
import type {CalendarEventKind} from './model'

export type VoiceIntakeGuess={key:Collection;title:string;subjectId:string;date:string;kind?:CalendarEventKind}

const EXAM_WORDS=/\b(exam|midterm|final|quiz|test)\b/i
const APPOINTMENT_WORDS=/\b(appointment|doctor|dentist|orthodontist|checkup|appt|meeting)\b/i
const TASK_WORDS=/\b(due|assignment|homework|submit|turn in|project|paper|worksheet|read chapter|study for)\b/i
const NOTE_WORDS=/\b(note|remember|idea|reminder to myself)\b/i

/** A spoken sentence, not a table row — so unlike scheduleImport's line-by-line parser, there is
 * no reliable field boundary to strip. The whole utterance becomes the title; the user reviews and
 * can trim it in the editor this opens into (voice never creates a record unattended). */
export function classifyVoiceInput(text:string,subjects:{id:string;name:string}[],today:string,addDays:(date:string,days:number)=>string):VoiceIntakeGuess{
 const title=text.trim().slice(0,200)
 const lower=title.toLowerCase()
 const key:Collection=EXAM_WORDS.test(title)?'exams':APPOINTMENT_WORDS.test(title)?'calendarEvents':NOTE_WORDS.test(title)&&!TASK_WORDS.test(title)?'notes':'tasks'
 const date=/\btoday\b/.test(lower)?today:/\btomorrow\b/.test(lower)?addDays(today,1):dateFrom(title,today,addDays(today,365),'mdy')||today
 const subjectId=subjects.find(s=>s.name.trim()&&lower.includes(s.name.toLowerCase()))?.id??''
 return {key,title,subjectId,date,kind:key==='calendarEvents'?'appointment':undefined}
}
