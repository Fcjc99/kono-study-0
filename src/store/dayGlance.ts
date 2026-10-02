import type {AppData} from './model'
import {classOccurrences,classTime} from './classSchedule'
import {schoolDay} from './schoolCalendar'

/** "and" between the last two: "Biology, Algebra and Art". */
const join=(items:string[])=>items.length<2?items.join(''):items.slice(0,-1).join(', ')+' and '+items.at(-1)
/** A day in one sentence, for KONO's good morning ("Today: …") and goodnight ("Tomorrow: …"): the
 * classes (how many, and the first), a test, what's due and the first event. */
export function dayGlance(data:AppData,date:string):string{
 const pid=data.activeProfileId
 const classes=classOccurrences(data,date).filter(c=>c.block.kind!=='break'&&!c.block.skippedDates?.includes(date)&&!c.timePending)
  .map(c=>({start:c.displayStart??c.block.start,label:c.block.label})).sort((a,b)=>a.start.localeCompare(b.start))
 const tests=data.exams.filter(e=>e.profileId===pid&&e.due===date&&!e.done)
 const due=data.tasks.filter(t=>t.profileId===pid&&t.due===date&&!t.done)
 const events=data.calendarEvents.filter(e=>e.profileId===pid&&e.date===date&&!e.done).sort((a,b)=>(a.time??'99').localeCompare(b.time??'99'))
 const closed=data.studySeasons.filter(s=>s.profileId===pid&&s.active&&s.school).map(s=>schoolDay(s,date)).find(d=>d?.closed&&d.exception)
 const parts:string[]=[]
 if(closed?.exception)parts.push('no school ('+closed.exception.label+')')
 if(classes.length===1)parts.push(classes[0].label+' at '+classTime(classes[0].start))
 else if(classes.length)parts.push(classes.length+' classes, starting with '+classes[0].label+' at '+classTime(classes[0].start))
 if(tests.length)parts.push(tests.length===1?(/\b(test|quiz|exam|final|midterm)\b/i.test(tests[0].title)?'the '+tests[0].title:'the '+tests[0].title+' test'):tests.length+' tests')
 if(due.length)parts.push(due.length===1?due[0].title+' is due':due.length+' things are due')
 if(events.length)parts.push(events[0].title+(events[0].time?' at '+classTime(events[0].time):'')+(events.length>1?' and '+(events.length-1)+' more':''))
 return parts.length?join(parts)+'.':'nothing on the plan.'
}
