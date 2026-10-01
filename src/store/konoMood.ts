import {addDays} from './studyScheduler'

/** How KONO feels about today, from the plan: shown on the Sanctuary ("Kono today") and as the
 * mic button's face. Kind, never scolding: late work makes KONO a little worried, not upset. */
export type KonoMoodId='celebrate'|'happy'|'sleepy'|'worried'|'busy'|'calm'
export type KonoMood={id:KonoMoodId;pose:string;line:string}

const POSES:Record<KonoMoodId,string>={celebrate:'excited',happy:'happy',sleepy:'sleep',worried:'question',busy:'read',calm:'tea'}
const mood=(id:KonoMoodId,line:string):KonoMood=>({id,pose:'/garden/kono/'+POSES[id]+'.webp',line})
const plural=(n:number,word:string)=>n+' '+word+(n===1?'':'s')

type Item={due:string;done:boolean}
export function konoMood({tasks,exams,today,hour}:{tasks:Item[];exams:Item[];today:string;hour:number}):KonoMood{
 const day=new Date(today+'T12:00:00').getDay(),monday=addDays(today,-((day+6)%7)),friday=addDays(monday,4)
 const week=[...tasks,...exams].filter(t=>t.due>=monday&&t.due<=friday)
 const overdue=tasks.filter(t=>!t.done&&t.due<today).length
 const openToday=[...tasks,...exams].filter(t=>!t.done&&t.due===today).length
 const doneToday=[...tasks,...exams].filter(t=>t.done&&t.due===today).length
 // Friday through Sunday, once everything due this school week is checked off.
 if((day===5||day===6||day===0)&&week.length>=3&&week.every(t=>t.done))return mood('celebrate','The whole week is done! KONO is doing a happy dance.')
 if(hour>=22||hour<5)return mood('sleepy',openToday||overdue?'It’s late. KONO is yawning. The rest can wait for a fresh start tomorrow.':'It’s late. KONO is curled up for the night. Sleep well!')
 if(overdue)return mood('worried','KONO is a little worried about '+plural(overdue,'late assignment')+'. One at a time?')
 if(openToday)return mood('busy',plural(openToday,'thing')+' due today. KONO has a book out to study with you.')
 if(doneToday)return mood('happy','Everything due today is done. KONO is so happy!')
 return mood('calm','Nothing due today. KONO is having a cup of tea.')
}
