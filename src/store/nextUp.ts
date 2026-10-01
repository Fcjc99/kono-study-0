import {addDays} from './studyScheduler'

/** "What should I do now?" (Sanctuary › KONO today): the open assignments in the order to work on
 * them, each with why it's next. Late work comes first (oldest first), then today's, then tomorrow's,
 * then the rest of the week; within the week a big one comes before a small one, so it gets started
 * early. A task with steps (subtasks) points at its next unfinished step. A test in the next two days
 * comes in as "Study for …" right after today's work. A project whose next step has a day goes by that
 * day, so a step planned for today comes up today even when the project is due next week. */
export type NextUp={id:string;title:string;step?:string;why:string;minutes:number;exam?:boolean}
type Item={id:string;title:string;due:string;done:boolean;estimatedMinutes?:number;subtasks?:{title:string;done:boolean;due?:string}[]}

const dayName=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'})
const DEFAULT_MINUTES=25

export function nextUpList(tasks:Item[],today:string,exams:{id:string;title:string;due:string;done:boolean}[]=[]):NextUp[]{
 const tomorrow=addDays(today,1),weekEnd=addDays(today,7)
 const nextStep=(t:Item)=>t.subtasks?.find(s=>!s.done)
 const stepDue=(t:Item)=>{const d=nextStep(t)?.due;return d&&d<t.due?d:undefined}
 const when=(t:Item)=>stepDue(t)??t.due
 const bucket=(t:Item)=>{const d=when(t);return d<today?0:d===today?1:d===tomorrow?2:3}
 const open=tasks.filter(t=>!t.done&&when(t)<=weekEnd)
 open.sort((a,b)=>bucket(a)-bucket(b)||(bucket(a)===3?(b.estimatedMinutes??0)-(a.estimatedMinutes??0):0)||when(a).localeCompare(when(b))||a.title.localeCompare(b.title))
 const work=open.map(t=>{
  const minutes=t.estimatedMinutes&&t.estimatedMinutes>0?Math.min(t.estimatedMinutes,120):DEFAULT_MINUTES
  const b=bucket(t),big=(t.estimatedMinutes??0)>=60,planned=stepDue(t)
  const why=planned?(b===0?'This step was planned for '+dayName(planned)+', so it’s a little behind.':b===1?'Today’s step for this project.':b===2?'This step is planned for tomorrow.':'This step is planned for '+dayName(planned)+'.')
   :b===0?'It’s late, so finishing it clears it off your plate.':b===1?'It’s due today.':b===2?'It’s due tomorrow.':'It’s due '+dayName(t.due)+(big?'. It’s a big one, so starting early helps.':'.')
  const step=nextStep(t)?.title
  return step?{id:t.id,title:t.title,step,why,minutes}:{id:t.id,title:t.title,why,minutes}
 })
 const study=exams.filter(e=>!e.done&&e.due>=today&&e.due<=tomorrow).sort((a,b)=>a.due.localeCompare(b.due)).map(e=>({id:e.id,title:'Study for '+e.title,why:e.due===today?'The test is today, so a quick review helps.':'The test is tomorrow.',minutes:DEFAULT_MINUTES,exam:true}))
 const after=work.findIndex((_,i)=>bucket(open[i])>1)
 return after<0?[...work,...study]:[...work.slice(0,after),...study,...work.slice(after)]
}
