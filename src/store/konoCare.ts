/** Taking care of KONO (Sanctuary › "KONO today"): three gentle meters (full, rested, happy) and snacks
 * earned by finishing work. Kind by design: meters drift slowly and never reach zero, nothing is lost
 * for being away (KONO "goes on a little trip" and comes back happy), and snacks are only ever earned,
 * never bought.
 *
 * What's saved is a short log of feedings and pats (AppData.konoCare), one entry each with its own
 * ID, so two devices adding to it at the same time merge cleanly. Everything else is worked out from
 * that log, finished assignments and the clock. */
export type CareEvent={id:string;kind:'feed'|'pet';at:string;taskId?:string}
export type KonoCareState={profileId:string;log:CareEvent[]}
export type KonoMeters={full:number;rested:number;happy:number;asleep:boolean;away:boolean}
export type Treat={id:string;emoji:string;name:string}
export type PantryItem={taskId:string;treat:Treat}

type Done={id:string;done:boolean;completedAt?:string;estimatedMinutes?:number;subtasks?:unknown[]}

const HOUR=3_600_000,DAY=24*HOUR
/** Snacks stay in the pantry for two weeks after the work is finished; the log keeps a month. */
export const TREAT_DAYS=14,LOG_DAYS=30,LOG_MAX=300
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
 const {rested,asleep}=restedAt(now)
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
 const since=now.getTime()-LOG_DAYS*DAY
 const log=(state?.log??[]).filter(e=>time(e.at)>=since)
 if(event.kind==='pet'){const lastPet=Math.max(-Infinity,...log.filter(e=>e.kind==='pet').map(e=>time(e.at)));if(now.getTime()-lastPet<PET_EVERY_MS)return {profileId,log}}
 if(event.kind==='feed'&&event.taskId&&log.some(e=>e.kind==='feed'&&e.taskId===event.taskId))return {profileId,log}
 return {profileId,log:[...log,event].slice(-LOG_MAX)}
}

/** Reads a saved care log, quietly dropping anything it doesn't understand: it's only for fun, so it
 * must never stop a plan from opening. */
export function readCareState(raw:unknown,profileId:string):KonoCareState{
 const value=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{}
 const log=(Array.isArray(value.log)?value.log:[]).flatMap((e:unknown)=>{
  if(!e||typeof e!=='object')return []
  const x=e as Record<string,unknown>
  if(typeof x.id!=='string'||!x.id||x.id.length>150||(x.kind!=='feed'&&x.kind!=='pet')||typeof x.at!=='string'||!Number.isFinite(Date.parse(x.at)))return []
  const event:CareEvent={id:x.id,kind:x.kind,at:new Date(x.at).toISOString()}
  if(typeof x.taskId==='string'&&x.taskId&&x.taskId.length<=150)event.taskId=x.taskId
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
