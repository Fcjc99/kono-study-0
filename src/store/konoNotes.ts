import type {CareEvent} from './konoCare'
import {addDays} from './studyScheduler'

/** KONO's notes in the KONO bar (Sanctuary), one at a time, most important first:
 * - after a test (later on test day, or the day after), "How did it go?" with 😊 😐 😣, asked once;
 * - on test day, KONO wears its study headband and cheers you on;
 * - the evening before, a good-luck note;
 * - otherwise, once a day, one gentle nudge about the most pressing thing due soon (Start or Not now).
 * Answers are saved in the care log with fixed IDs ('exam-<id>', 'nudge-<day>'), so two devices
 * answering save the same entry and it isn't asked again. */
export type Test={id:string;title:string;due:string}
export type Mood='good'|'ok'|'rough'
export type NudgeItem={id:string;title:string;why:string;minutes:number;exam?:boolean}
export type KonoNote=
 |{kind:'ask';test:Test}
 |{kind:'testday';test:Test}
 |{kind:'luck';test:Test}
 |{kind:'nudge';item:NudgeItem}

type ExamLike={id:string;title:string;due:string;done?:boolean}
type EventLike={id:string;title:string;date:string;kind:string;done?:boolean}
/** Tests: exams, plus calendar events that are a test, quiz or exam. */
export function testsFrom(exams:ExamLike[],events:EventLike[]):Test[]{
 return [...exams.map(e=>({id:e.id,title:e.title,due:e.due})),
  ...events.filter(e=>['exam','test','quiz'].includes(e.kind)).map(e=>({id:e.id,title:e.title,due:e.date}))]
}
export const examEventId=(test:Test)=>'exam-'+test.id
export const nudgeEventId=(today:string)=>'nudge-'+today
const answered=(log:CareEvent[],id:string)=>log.some(e=>e.id===id)

/** The note to show now (`hour` is the local hour), or none. */
export function konoNote(tests:Test[],nudges:NudgeItem[],log:CareEvent[],today:string,hour:number):KonoNote|null{
 const yesterday=addDays(today,-1),tomorrow=addDays(today,1)
 const byTitle=(a:Test,b:Test)=>a.title.localeCompare(b.title)
 const ask=tests.filter(t=>!answered(log,examEventId(t))&&(t.due===yesterday||(t.due===today&&hour>=14))).sort(byTitle)[0]
 if(ask)return {kind:'ask',test:ask}
 const todays=tests.filter(t=>t.due===today&&hour<14&&!answered(log,examEventId(t))).sort(byTitle)[0]
 if(todays)return {kind:'testday',test:todays}
 const next=tests.filter(t=>t.due===tomorrow).sort(byTitle)[0]
 if(next&&hour>=15)return {kind:'luck',test:next}
 const item=nudges[0]
 if(item&&!answered(log,nudgeEventId(today)))return {kind:'nudge',item}
 return null
}
/** KONO wears its study headband on test day. */
export const testDay=(tests:Test[],today:string)=>tests.some(t=>t.due===today)

export function noteText(note:KonoNote):string{
 if(note.kind==='ask')return 'How did '+note.test.title+' go?'
 if(note.kind==='testday')return '💪 '+note.test.title+' is today. KONO put on its study headband for you!'
 if(note.kind==='luck')return '🍀 Good luck on '+note.test.title+' tomorrow! You’ve got this.'
 return '📌 '+note.item.title+': '+note.item.why+' Start with '+note.item.minutes+' minutes?'
}
export const MOODS:{mood:Mood;emoji:string;label:string}[]=[{mood:'good',emoji:'😊',label:'Good'},{mood:'ok',emoji:'😐',label:'Okay'},{mood:'rough',emoji:'😣',label:'Rough'}]
/** What KONO says to the answer. */
export const moodLine=(mood:Mood,title:string)=>mood==='good'?'Yay! I knew you could do it! 🎉 '+title+' is done.'
 :mood==='ok'?'That’s okay. You studied, and that counts. ♡'
 :'Aww. One test doesn’t decide anything. KONO’s proud of you for showing up. ♡'
