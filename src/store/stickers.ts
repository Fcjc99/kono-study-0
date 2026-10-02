import {addDays} from './studyScheduler'

/** Stickers: island decorations earned by studying (Decorate › Stickers). Each one unlocks from
 * the plan's own history (tasks, exams, study sessions and the days with a completion), so nothing
 * extra is saved; a sticker already on the island stays there either way. */
export type Sticker={id:string;emoji:string;label:string;how:string;season?:string}

/** Island events: a few weeks a year with their own stickers, earned only during the event (and kept
 * after it). `from`/`to` are month-day, inclusive; an event can run across New Year. */
export type SeasonRule='finish'|'streak-3'|'finish-10'|'early'
export type Season={id:string;label:string;emoji:string;from:string;to:string;until:string;stickers:(Sticker&{rule:SeasonRule})[]}
export const SEASONS:Season[]=[
 {id:'halloween',label:'Spooky season',emoji:'🎃',from:'10-01',to:'10-31',until:'Oct 31',stickers:[
  {id:'halloween-pumpkin',emoji:'🎃',label:'Pumpkin',how:'Finish an assignment in October.',rule:'finish'},
  {id:'halloween-ghost',emoji:'👻',label:'Friendly ghost',how:'Study 3 days in a row in October.',rule:'streak-3'},
  {id:'halloween-candy',emoji:'🍬',label:'Candy',how:'Finish an assignment 2 days early in October.',rule:'early'},
  {id:'halloween-bat',emoji:'🦇',label:'Bat',how:'Finish 10 assignments in October.',rule:'finish-10'},
 ]},
 {id:'winter',label:'Snow days',emoji:'⛄',from:'12-01',to:'01-06',until:'Jan 6',stickers:[
  {id:'winter-snowman',emoji:'⛄',label:'Snowman',how:'Finish an assignment between December 1 and January 6.',rule:'finish'},
  {id:'winter-gift',emoji:'🎁',label:'Gift',how:'Study 3 days in a row between December 1 and January 6.',rule:'streak-3'},
  {id:'winter-cookie',emoji:'🍪',label:'Cookie',how:'Finish an assignment 2 days early between December 1 and January 6.',rule:'early'},
  {id:'winter-snowflake',emoji:'❄️',label:'Snowflake',how:'Finish 10 assignments between December 1 and January 6.',rule:'finish-10'},
 ]},
 {id:'valentine',label:'Valentine’s week',emoji:'💝',from:'02-01',to:'02-14',until:'Feb 14',stickers:[
  {id:'valentine-heart',emoji:'💗',label:'Heart',how:'Finish an assignment during Valentine’s week (February 1–14).',rule:'finish'},
  {id:'valentine-card',emoji:'💌',label:'Love note',how:'Study 3 days in a row during Valentine’s week.',rule:'streak-3'},
  {id:'valentine-chocolate',emoji:'🍫',label:'Chocolate',how:'Finish an assignment 2 days early during Valentine’s week.',rule:'early'},
  {id:'valentine-rose',emoji:'🌹',label:'Rose',how:'Finish 10 assignments during Valentine’s week.',rule:'finish-10'},
 ]},
]
const inSeason=(season:Season,date:string)=>{const md=date.slice(5);return season.from<=season.to?md>=season.from&&md<=season.to:md>=season.from||md<=season.to}
/** The island event running on this date, if any. */
export const seasonOn=(date:string)=>SEASONS.find(s=>inSeason(s,date))??null
/** Which event a seasonal sticker belongs to; null for the everyday ones. */
const SEASON_OF:Record<string,Season>=Object.fromEntries(SEASONS.flatMap(season=>season.stickers.map(t=>[t.id,season])))
/** Whether a sticker shows in Decorate: everyday ones always; an event's only during it, or once earned. */
export const stickerOffered=(id:string,earned:Set<string>,today:string)=>!SEASON_OF[id]||earned.has(id)||inSeason(SEASON_OF[id],today)

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
 ...SEASONS.flatMap(season=>season.stickers.map(t=>({id:t.id,emoji:t.emoji,label:t.label,how:t.how,season:season.id}))),
]

type DoneTask={due:string;done:boolean;completedAt?:string}
type History={tasks:DoneTask[];exams:{subjectId:string;due:string;done:boolean}[];studySessions:{subjectId:string;date:string}[];completionDates:Record<string,number>;today:string}

const dayOf=(iso:string)=>{const d=new Date(iso);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const weekday=(date:string)=>new Date(date+'T12:00:00').getDay()
/** Longest run of days in a row with at least one completion (only counting days that pass `keep`). */
export function longestStreak(completionDates:Record<string,number>,keep:(day:string)=>boolean=()=>true){
 const days=new Set(Object.keys(completionDates).filter(d=>completionDates[d]>0&&keep(d)))
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
 // Event stickers count only what happened during an event (any year's).
 for(const season of SEASONS){
  const during=done.filter(t=>{const f=finishedOn(t);return !!f&&f<=today&&inSeason(season,f)})
  const seasonStreak=longestStreak(completionDates,d=>d<=today&&inSeason(season,d))
  for(const t of season.stickers){
   const ok=t.rule==='finish'?during.length>0:t.rule==='finish-10'?during.length>=10:t.rule==='streak-3'?seasonStreak>=3:during.some(x=>finishedOn(x)<=addDays(x.due,-2))
   if(ok)earned.add(t.id)
  }
 }
 return earned
}

/** A round die-cut sticker: the emoji on a white disc with a soft edge, as an image the island can place. */
export const stickerSrc=(emoji:string)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="84" r="70" fill="#000" opacity=".16"/><circle cx="80" cy="78" r="70" fill="#fff"/><circle cx="80" cy="78" r="64" fill="#fffaf2" stroke="#f1e4d4" stroke-width="2"/><text x="80" y="80" font-size="82" text-anchor="middle" dominant-baseline="central" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text></svg>`)
