import {addDays} from './studyScheduler'

/** Stickers: island decorations earned by studying (Decorate › Stickers). Each one unlocks from
 * the plan's own history (tasks, exams, study sessions and the days with a completion), so nothing
 * extra is saved; a sticker already on the island stays there either way. */
export type Sticker={id:string;emoji:string;label:string;how:string}

export const STICKERS:Sticker[]=[
 {id:'first-done',emoji:'🌱',label:'First sprout',how:'Finish your first assignment.'},
 {id:'streak-3',emoji:'🔥',label:'Campfire',how:'Study 3 days in a row.'},
 {id:'streak-5',emoji:'⭐',label:'Gold star',how:'Study 5 days in a row.'},
 {id:'streak-14',emoji:'🌈',label:'Rainbow',how:'Study 14 days in a row.'},
 {id:'streak-30',emoji:'🏆',label:'Trophy',how:'Study 30 days in a row.'},
 {id:'on-time-week',emoji:'🎯',label:'Bullseye',how:'Finish every assignment in a week on time (at least 3).'},
 {id:'early-bird',emoji:'🐦',label:'Early bird',how:'Finish an assignment 2 days before it’s due.'},
 {id:'test-prep',emoji:'📚',label:'Book stack',how:'Study for a test at least 2 days ahead.'},
 {id:'test-done',emoji:'🎓',label:'Graduation cap',how:'Check off your first test.'},
 {id:'weekend',emoji:'🧁',label:'Weekend cupcake',how:'Finish something on a Saturday or Sunday.'},
 {id:'done-25',emoji:'🍀',label:'Lucky clover',how:'Finish 25 assignments.'},
 {id:'done-100',emoji:'💎',label:'Gem',how:'Finish 100 assignments.'},
]

type DoneTask={due:string;done:boolean;completedAt?:string}
type History={tasks:DoneTask[];exams:{subjectId:string;due:string;done:boolean}[];studySessions:{subjectId:string;date:string}[];completionDates:Record<string,number>;today:string}

const dayOf=(iso:string)=>{const d=new Date(iso);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const weekday=(date:string)=>new Date(date+'T12:00:00').getDay()
/** Longest run of days in a row with at least one completion. */
export function longestStreak(completionDates:Record<string,number>){
 const days=new Set(Object.keys(completionDates).filter(d=>completionDates[d]>0))
 let best=0
 for(const d of days){if(days.has(addDays(d,-1)))continue;let n=0,cursor=d;while(days.has(cursor)){n++;cursor=addDays(cursor,1)}best=Math.max(best,n)}
 return best
}

/** The ids of every sticker this history has earned. */
export function earnedStickers({tasks,exams,studySessions,completionDates,today}:History):Set<string>{
 const earned=new Set<string>()
 const done=tasks.filter(t=>t.done),finishedOn=(t:DoneTask)=>t.completedAt?dayOf(t.completedAt):''
 const streak=longestStreak(completionDates)
 if(done.length>0)earned.add('first-done')
 for(const n of [3,5,14,30])if(streak>=n)earned.add('streak-'+n)
 if(done.length>=25)earned.add('done-25')
 if(done.length>=100)earned.add('done-100')
 if(done.some(t=>{const f=finishedOn(t);return !!f&&f<=addDays(t.due,-2)}))earned.add('early-bird')
 if(done.some(t=>{const f=finishedOn(t);return !!f&&(weekday(f)===0||weekday(f)===6)})||Object.keys(completionDates).some(d=>completionDates[d]>0&&(weekday(d)===0||weekday(d)===6)))earned.add('weekend')
 if(exams.some(e=>e.done))earned.add('test-done')
 if(exams.some(e=>studySessions.some(s=>s.subjectId===e.subjectId&&s.date<=today&&s.date<=addDays(e.due,-2)&&s.date>=addDays(e.due,-14))))earned.add('test-prep')
 // A week (Monday to Sunday) with at least 3 assignments due, every one finished on or before its day.
 const weeks=new Map<string,DoneTask[]>()
 for(const t of tasks){const monday=addDays(t.due,-((weekday(t.due)+6)%7));weeks.set(monday,[...weeks.get(monday)??[],t])}
 for(const list of weeks.values())if(list.length>=3&&list.every(t=>t.done&&!!finishedOn(t)&&finishedOn(t)<=t.due)){earned.add('on-time-week');break}
 return earned
}

/** A round die-cut sticker: the emoji on a white disc with a soft edge, as an image the island can place. */
export const stickerSrc=(emoji:string)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="84" r="70" fill="#000" opacity=".16"/><circle cx="80" cy="78" r="70" fill="#fff"/><circle cx="80" cy="78" r="64" fill="#fffaf2" stroke="#f1e4d4" stroke-width="2"/><text x="80" y="80" font-size="82" text-anchor="middle" dominant-baseline="central" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text></svg>`)
