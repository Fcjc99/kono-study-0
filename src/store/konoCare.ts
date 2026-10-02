/** Taking care of KONO (Sanctuary › "KONO today"): three gentle meters (full, rested, happy) and snacks
 * earned by finishing work. Kind by design: meters drift slowly and never reach zero, nothing is lost
 * for being away (KONO "goes on a little trip" and comes back happy), and snacks are only ever earned,
 * never bought.
 *
 * What's saved is a short log of feedings and pats (AppData.konoCare), one entry each with its own
 * ID, so two devices adding to it at the same time merge cleanly. Everything else is worked out from
 * that log, finished assignments and the clock. */
export type CareKind='feed'|'pet'|'sleep'|'wake'|'wish'|'wear'|'find'
/** `item` is the outfit put on for a 'wear' entry ("" = taking it off; store/konoWardrobe), or what KONO
 * found for a 'find' entry (store/konoFinds). */
export type CareEvent={id:string;kind:CareKind;at:string;taskId?:string;item?:string}
const KINDS:CareKind[]=['feed','pet','sleep','wake','wish','wear','find']
export type KonoCareState={profileId:string;log:CareEvent[]}
export type KonoMeters={full:number;rested:number;happy:number;asleep:boolean;away:boolean}
export type Treat={id:string;emoji:string;name:string}
export type PantryItem={taskId:string;treat:Treat}

type Done={id:string;done:boolean;completedAt?:string;estimatedMinutes?:number;subtasks?:unknown[]}

const HOUR=3_600_000,DAY=24*HOUR
/** Snacks stay in the pantry for two weeks after the work is finished; the log keeps a month. */
export const TREAT_DAYS=14,LOG_DAYS=30,LOG_MAX=600
/** A pat counts toward "happy" once every ten minutes (more taps still get a reaction). */
export const PET_EVERY_MS=10*60_000
export const FLOOR={full:20,rested:25,happy:30} as const

const SNACKS:Treat[]=[
 {id:'onigiri',emoji:'🍙',name:'rice ball'},{id:'dumpling',emoji:'🥟',name:'dumpling'},{id:'dango',emoji:'🍡',name:'dango'},
 {id:'strawberry',emoji:'🍓',name:'strawberry'},{id:'cookie',emoji:'🍪',name:'cookie'},{id:'peach',emoji:'🍑',name:'peach'},
]
/** Fancier snacks for big work: an hour or more, or a project with steps. */
const FEASTS:Treat[]=[{id:'bento',emoji:'🍱',name:'bento box'},{id:'cake',emoji:'🍰',name:'slice of cake'},{id:'boba',emoji:'🧋',name:'boba tea'}]

const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
export function treatFor(task:Done):Treat{
 const big=(task.estimatedMinutes??0)>=60||(task.subtasks?.length??0)>=3
 const menu=big?FEASTS:SNACKS
 return menu[hash(task.id)%menu.length]
}

const time=(iso:string|undefined)=>{const t=iso?Date.parse(iso):NaN;return Number.isFinite(t)?t:NaN}
const fedIds=(log:CareEvent[])=>new Set(log.filter(e=>e.kind==='feed'&&e.taskId).map(e=>e.taskId!))

/** Snacks waiting to be eaten: work finished in the last two weeks that KONO hasn't eaten yet, oldest first. */
export function pantry(tasks:Done[],log:CareEvent[],now:Date):PantryItem[]{
 const fed=fedIds(log),since=now.getTime()-TREAT_DAYS*DAY
 return tasks.filter(t=>t.done&&time(t.completedAt)>=since&&!fed.has(t.id))
  .sort((a,b)=>time(a.completedAt)-time(b.completedAt))
  .map(t=>({taskId:t.id,treat:treatFor(t)}))
}

/** Rested follows the day: fresh in the morning, sleepier toward bedtime, asleep from 10 PM to 6 AM. */
export function restedAt(now:Date){
 const h=now.getHours()+now.getMinutes()/60
 if(h>=22||h<6){const slept=h>=22?h-22:h+2;return {rested:Math.round(FLOOR.rested+(100-FLOOR.rested)*slept/8),asleep:true}}
 return {rested:Math.round(Math.max(FLOOR.rested,Math.min(100,100-(h-7)*5))),asleep:false}
}

/** Full and happy start at a comfortable middle two days back, rise with snacks, pats and finished
 * work, and drift down slowly in between (full about 3 an hour, happy 2), never below their floors.
 * `away` (the first visit in three or more days, see AWAY_DAYS) means KONO is back from a trip:
 * comfortable again, not hungry or sad. */
export function careMeters(log:CareEvent[],tasks:Done[],now:Date,away=false):KonoMeters{
 const end=now.getTime(),start=end-2*DAY
 const done=tasks.map(t=>time(t.completedAt)).filter(t=>Number.isFinite(t)&&t<=end)
 const clock=restedAt(now),rested=clock.rested,asleep=clock.asleep||bedtime(log,now).tucked
 if(away)return {full:65,rested,happy:75,asleep,away:true}
 type Step={at:number;full:number;happy:number}
 const steps:Step[]=[
  ...log.filter(e=>e.kind==='feed').map(e=>({at:time(e.at),full:25,happy:4})),
  ...log.filter(e=>e.kind==='pet').map(e=>({at:time(e.at),full:0,happy:6})),
  ...done.map(at=>({at,full:0,happy:10})),
 ].filter(s=>s.at>start&&s.at<=end).sort((a,b)=>a.at-b.at)
 let full=60,happy=60,at=start
 const drift=(until:number)=>{const hours=(until-at)/HOUR;full=Math.max(FLOOR.full,full-3*hours);happy=Math.max(FLOOR.happy,happy-2*hours);at=until}
 for(const s of steps){drift(s.at);full=Math.min(100,full+s.full);happy=Math.min(100,happy+s.happy)}
 drift(end)
 return {full:Math.round(full),rested,happy:Math.round(happy),asleep,away:false}
}

/** Adds a feeding or pat, dropping entries older than a month (and keeping at most 300). A pat within
 * ten minutes of the last one isn't saved. */
export function addCareEvent(state:KonoCareState|undefined,profileId:string,event:CareEvent,now:Date):KonoCareState{
 const since=now.getTime()-LOG_DAYS*DAY,all=state?.log??[]
 // Granted wishes count toward outfits for good, finds stay in the collection, and the outfit KONO has
 // on stays on: all three are kept.
 const lastWear=all.filter(e=>e.kind==='wear').sort((a,b)=>a.at.localeCompare(b.at)).at(-1)
 const kept=(e:CareEvent)=>e.kind==='wish'||e.kind==='find'
 const log=all.filter(e=>kept(e)||e===lastWear||time(e.at)>=since)
 if(event.kind==='wish'&&log.some(e=>e.id===event.id))return {profileId,log}
 if(event.kind==='pet'){const lastPet=Math.max(-Infinity,...log.filter(e=>e.kind==='pet').map(e=>time(e.at)));if(now.getTime()-lastPet<PET_EVERY_MS)return {profileId,log}}
 if(event.kind==='sleep'&&bedtime(log,now).tucked)return {profileId,log}
 if(event.kind==='wake'&&!bedtime(log,now).canWake)return {profileId,log}
 if(event.kind==='feed'&&event.taskId&&log.some(e=>e.kind==='feed'&&e.taskId===event.taskId))return {profileId,log}
 const next=[...log,event]
 // Over the cap: drop the oldest everyday entries, never wishes or what KONO is wearing.
 while(next.length>LOG_MAX){const i=next.findIndex(e=>!kept(e)&&e!==event&&!(e.kind==='wear'&&event.kind!=='wear'&&e===lastWear));if(i<0)break;next.splice(i,1)}
 return {profileId,log:next}
}

/** Reads a saved care log, quietly dropping anything it doesn't understand: it's only for fun, so it
 * must never stop a plan from opening. */
export function readCareState(raw:unknown,profileId:string):KonoCareState{
 const value=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{}
 const log=(Array.isArray(value.log)?value.log:[]).flatMap((e:unknown)=>{
  if(!e||typeof e!=='object')return []
  const x=e as Record<string,unknown>
  if(typeof x.id!=='string'||!x.id||x.id.length>150||!KINDS.includes(x.kind as CareKind)||typeof x.at!=='string'||!Number.isFinite(Date.parse(x.at)))return []
  const event:CareEvent={id:x.id,kind:x.kind as CareKind,at:new Date(x.at).toISOString()}
  if(typeof x.taskId==='string'&&x.taskId&&x.taskId.length<=150)event.taskId=x.taskId
  if((event.kind==='wear'||event.kind==='find')&&typeof x.item==='string'&&x.item.length<=40)event.item=x.item
  return [event]
 }).slice(-LOG_MAX)
 return {profileId,log}
}

/** What KONO says after being fed or patted, shown in place of the day's line for a moment. */
export const fedLine=(treat:Treat)=>'Yum! '+treat.emoji+' KONO loved the '+treat.name+'. Thank you!'
export const PET_LINES=['KONO giggles and wiggles happily.','KONO leans into the pat. ♡','KONO does a happy little spin!']
/** A visit after this many days away is a homecoming. */
export const AWAY_DAYS=3
export const isAwayVisit=(lastVisit:number,now:Date)=>Number.isFinite(lastVisit)&&lastVisit>0&&now.getTime()-lastVisit>AWAY_DAYS*DAY
export const AWAY_LINE='KONO just got back from a little trip and missed you! 🧳'

/** Bedtime and wake-up. From 7 PM KONO can be tucked in (once a night); it then sleeps until morning
 * and the island goes dark. From 6 AM until noon KONO can be woken (once a day) and says what's
 * on today. A night runs 7 PM to 6 AM and belongs to the evening's date. */
export const localDay=(d:Date)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
export const nightOf=(d:Date)=>{const x=new Date(d.getTime());if(x.getHours()<6)x.setDate(x.getDate()-1);return localDay(x)}
const isNight=(d:Date)=>d.getHours()>=19||d.getHours()<6
export function bedtime(log:CareEvent[],now:Date){
 const night=isNight(now),tonight=nightOf(now)
 const lastSleep=log.filter(e=>e.kind==='sleep'&&isNight(new Date(e.at))&&nightOf(new Date(e.at))===tonight).map(e=>time(e.at)).sort((a,b)=>b-a)[0]
 const tucked=night&&lastSleep!==undefined&&!log.some(e=>e.kind==='wake'&&time(e.at)>lastSleep)
 const h=now.getHours(),morning=h>=6&&h<12
 const wokeToday=log.some(e=>e.kind==='wake'&&localDay(new Date(e.at))===localDay(now))
 return {tucked,canTuck:night&&!tucked,canWake:morning&&!wokeToday}
}
export const ASLEEP_LINE='KONO is fast asleep. Sweet dreams! 🌙'
