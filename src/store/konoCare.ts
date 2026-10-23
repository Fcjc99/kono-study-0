/** Taking care of KONO (Sanctuary › "KONO today"): three gentle meters (full, rested, happy) and snacks
 * earned by finishing work. Kind by design: meters drift slowly and never reach zero, nothing is lost
 * for being away (KONO "goes on a little trip" and comes back happy), and snacks are only ever earned,
 * never bought.
 *
 * What's saved is a short log of feedings and pats (AppData.konoCare), one entry each with its own
 * ID, so two devices adding to it at the same time merge cleanly. Everything else is worked out from
 * that log, finished assignments and the clock. */
export type CareKind='feed'|'pet'|'sleep'|'wake'|'wish'|'wear'|'find'|'exam'|'nudge'|'visit'|'bond'|'play'|'taste'|'gift'|'coin'|'buy'|'bank'|'paint'
/** `item` is the outfit put on for a 'wear' entry ("" = taking it off; store/konoWardrobe), what KONO
 * found for a 'find' entry (store/konoFinds), how a test went for an 'exam' entry, or what was done with
 * the day's nudge for a 'nudge' entry (store/konoNotes). A 'gift' is a snack a parent sent from the family
 * plan (`item` is the snack, `from` who sent it, `note` their message); it waits in the pantry like earned ones.
 * Coins (store/konoCoins): a 'coin' entry is coins won (`n`, `item` what for: the prize wheel, a game, a
 * surprise, a quest), a 'buy' entry something bought (`item` "food:cookie", "outfit:bow" or "find:star",
 * `n` its price), and a 'bank' entry a month's coins and snacks folded into one (see foldCoins). A 'paint'
 * entry is KONO's color picked (`item`, "" for classic; store/konoLooks). */
export type CareEvent={id:string;kind:CareKind;at:string;taskId?:string;item?:string;from?:string;note?:string;n?:number}
const KINDS:CareKind[]=['feed','pet','sleep','wake','wish','wear','find','exam','nudge','visit','bond','play','taste','gift','coin','buy','bank','paint']
/** KONO's house (store/konoLooks): the furniture placed in the room. `x` and `y` (0–1) are where the
 * piece stands in the room (the middle of its bottom edge), `size` how much bigger or smaller than usual. */
export type HouseItem={id:string;item:string;x:number;y:number;size?:number;flip?:boolean}
/** `home` is the house on the island (a Decorate placement's ID) that KONO lives in and goes into; `room` is
 * the style KONO's house is in (store/konoFurniture › ROOM_STYLES). */
export type KonoCareState={profileId:string;log:CareEvent[];house?:HouseItem[];home?:string;room?:string}
/** What a care state keeps besides its log (KONO's house and which island house is its home). */
const extras=(state:KonoCareState|undefined)=>({...(state?.house?{house:state.house}:{}),...(state?.home?{home:state.home}:{}),...(state?.room?{room:state.room}:{})})
export type KonoMeters={full:number;rested:number;happy:number;asleep:boolean;away:boolean}
export type Treat={id:string;emoji:string;name:string}
export type PantryItem={taskId:string;treat:Treat}

type Done={id:string;done:boolean;completedAt?:string;estimatedMinutes?:number;subtasks?:unknown[]}

const HOUR=3_600_000,DAY=24*HOUR
/** Snacks stay in the pantry for two weeks after the work is finished; the log keeps a month. */
export const TREAT_DAYS=14,LOG_DAYS=30,LOG_MAX=600
/** A pat counts toward "happy" once every ten minutes (more taps still get a reaction). */
export const PET_EVERY_MS=10*60_000
/** Play time with KONO (a break game from KONO's corner) counts once an hour. */
export const PLAY_EVERY_MS=60*60_000
export const nextPlayAt=(log:CareEvent[])=>Math.max(-Infinity,...log.filter(e=>e.kind==='play').map(e=>time(e.at)))+PLAY_EVERY_MS
export const PLAY_LINES=['That was so fun! KONO is all smiles. 💛','KONO wants a rematch later! 😄','Best. Game. Ever! KONO bounces around. ✨']
export const FLOOR={full:20,rested:25,happy:30} as const

export const SNACKS:Treat[]=[
 {id:'onigiri',emoji:'🍙',name:'rice ball'},{id:'dumpling',emoji:'🥟',name:'dumpling'},{id:'dango',emoji:'🍡',name:'dango'},
 {id:'strawberry',emoji:'🍓',name:'strawberry'},{id:'cookie',emoji:'🍪',name:'cookie'},{id:'peach',emoji:'🍑',name:'peach'},
]
/** Fancier snacks for big work: an hour or more, or a project with steps. */
const FEASTS:Treat[]=[{id:'bento',emoji:'🍱',name:'bento box'},{id:'cake',emoji:'🍰',name:'slice of cake'},{id:'boba',emoji:'🧋',name:'boba tea'}]
/** Every snack KONO can have, for the snack book in KONO's corner. */
export const ALL_TREATS:Treat[]=[...SNACKS,...FEASTS]
/** A snack KONO tried for the first time (kept for good, one per kind of snack). */
export const tasteEventId=(treatId:string)=>'taste-'+treatId
export const tasted=(log:CareEvent[])=>new Set(log.filter(e=>e.kind==='taste'&&e.item).map(e=>e.item!))
export const tasteLine=(treat:Treat,count:number)=>'✨ New snack! '+treat.emoji+' KONO tried '+(treat.name==='boba tea'?'':'a ')+treat.name+' for the first time. ('+count+' of '+ALL_TREATS.length+' snacks tried)'

const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
export function treatFor(task:Done):Treat{
 const big=(task.estimatedMinutes??0)>=60||(task.subtasks?.length??0)>=3
 const menu=big?FEASTS:SNACKS
 return menu[hash(task.id)%menu.length]
}

const time=(iso:string|undefined)=>{const t=iso?Date.parse(iso):NaN;return Number.isFinite(t)?t:NaN}
const fedIds=(log:CareEvent[])=>new Set(log.filter(e=>e.kind==='feed'&&e.taskId).map(e=>e.taskId!))

/** KONO's favorite snack this week (Monday to Sunday): one of the everyday snacks, the same on every
 * device. Eating it makes KONO extra happy, and KONO picks it first when it's in the pantry. */
export function favoriteSnack(day:string):Treat{
 const d=new Date(day+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7))
 return SNACKS[hash('fav'+localDay(d))%SNACKS.length]
}
const isFavorite=(e:CareEvent)=>e.kind==='feed'&&!!e.item&&e.item===favoriteSnack(localDay(new Date(e.at))).id

/** Snacks waiting to be eaten: work finished in the last two weeks that KONO hasn't eaten yet, oldest first. */
export function pantry(tasks:Done[],log:CareEvent[],now:Date):PantryItem[]{
 const fed=fedIds(log),since=now.getTime()-TREAT_DAYS*DAY
 const earned=tasks.filter(t=>t.done&&time(t.completedAt)>=since&&!fed.has(t.id)).map(t=>({at:time(t.completedAt),item:{taskId:t.id,treat:treatFor(t)}}))
 // Snacks a parent sent, and snacks bought in KONO's food shop, wait here too (keyed by the entry's own ID).
 const gifts=log.filter(e=>e.kind==='gift'&&time(e.at)>=since&&!fed.has(e.id)).map(e=>({at:time(e.at),item:{taskId:e.id,treat:ALL_TREATS.find(t=>t.id===e.item)??SNACKS[0]}}))
 const bought=log.filter(e=>e.kind==='buy'&&e.item?.startsWith('food:')&&time(e.at)>=since&&!fed.has(e.id)).map(e=>({at:time(e.at),item:{taskId:e.id,treat:ALL_TREATS.find(t=>t.id===e.item!.slice(5))??SNACKS[0]}}))
 return [...earned,...gifts,...bought].sort((a,b)=>a.at-b.at).map(x=>x.item)
}
/** Gifts from a parent still waiting to be eaten, newest first (KONO's card says who sent it and their note). */
export const waitingGifts=(log:CareEvent[],now:Date)=>{const fed=fedIds(log),since=now.getTime()-TREAT_DAYS*DAY;return log.filter(e=>e.kind==='gift'&&time(e.at)>=since&&!fed.has(e.id)).sort((a,b)=>b.at.localeCompare(a.at))}

/** Rested follows bedtime. A night KONO was tucked in by 10:30 PM it wakes fully rested; tucked in
 * later, a little less; not tucked in at all, it wakes groggy. Through the day it gets sleepier (about
 * 4 an hour from waking, never below the floor), and it sleeps from 10 PM to 6 AM, or from tuck-in. */
export const EARLY_BED_HOUR=22.5
const hourOf=(d:Date)=>d.getHours()+d.getMinutes()/60
/** How last night went: tucked in (and when), so the morning knows how rested KONO is. */
export function lastNight(log:CareEvent[],now:Date){
 const yesterday=new Date(now.getTime());yesterday.setDate(yesterday.getDate()-1)
 const night=now.getHours()<6?nightOf(yesterday):localDay(yesterday)
 const sleep=log.filter(e=>e.kind==='sleep'&&nightOf(new Date(e.at))===night).map(e=>new Date(e.at)).sort((a,b)=>a.getTime()-b.getTime())[0]
 if(!sleep)return {tucked:false,early:false}
 const h=hourOf(sleep),early=h>=19&&h<=EARLY_BED_HOUR
 return {tucked:true,early}
}
export function restedFor(log:CareEvent[],now:Date){
 const h=hourOf(now)
 if(h>=22||h<6||bedtime(log,now).tucked)return restedAt(now)
 const night=lastNight(log,now),start=night.early?100:night.tucked?88:75
 const woke=log.filter(e=>e.kind==='wake'&&localDay(new Date(e.at))===localDay(now)).map(e=>hourOf(new Date(e.at)))[0]
 const from=Math.max(6,Math.min(woke??7,12))
 return {rested:Math.round(Math.max(FLOOR.rested,Math.min(100,start-Math.max(0,h-from)*4))),asleep:false}
}
/** The clock alone (no bedtime): fresh in the morning, sleepier toward bedtime, asleep from 10 PM to 6 AM. */
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
 const clock=restedFor(log,now),rested=clock.rested,asleep=clock.asleep||bedtime(log,now).tucked
 if(away)return {full:65,rested,happy:75,asleep,away:true}
 type Step={at:number;full:number;happy:number}
 const steps:Step[]=[
  ...log.filter(e=>e.kind==='feed').map(e=>({at:time(e.at),full:25,happy:isFavorite(e)?14:4})),
  ...log.filter(e=>e.kind==='pet').map(e=>({at:time(e.at),full:0,happy:6})),
  // Playing makes KONO happy, and a little hungry.
  ...log.filter(e=>e.kind==='play').map(e=>({at:time(e.at),full:-6,happy:12})),
  // Waking up after an early night: a good mood to start the day.
  ...log.filter(e=>e.kind==='wake'&&lastNight(log,new Date(e.at)).early).map(e=>({at:time(e.at),full:0,happy:10})),
  ...done.map(at=>({at,full:0,happy:10})),
 ].filter(s=>s.at>start&&s.at<=end).sort((a,b)=>a.at-b.at)
 let full=60,happy=60,at=start
 const drift=(until:number)=>{const hours=(until-at)/HOUR;full=Math.max(FLOOR.full,full-3*hours);happy=Math.max(FLOOR.happy,happy-2*hours);at=until}
 for(const s of steps){drift(s.at);full=Math.max(FLOOR.full,Math.min(100,full+s.full));happy=Math.min(100,happy+s.happy)}
 drift(end)
 return {full:Math.round(full),rested,happy:Math.round(happy),asleep,away:false}
}

/** Adds a feeding or pat, dropping entries older than a month (and keeping at most 300). A pat within
 * ten minutes of the last one isn't saved. */
export function addCareEvent(state:KonoCareState|undefined,profileId:string,event:CareEvent,now:Date):KonoCareState{
 const since=now.getTime()-LOG_DAYS*DAY,all=state?.log??[]
 // Granted wishes count toward outfits for good, finds and friends stay in the collection, days KONO was
 // cared for count toward the bond (store/konoBond), and the outfit KONO has on stays on: all are kept.
 const lastWear=all.filter(e=>e.kind==='wear').sort((a,b)=>a.at.localeCompare(b.at)).at(-1),lastPaint=all.filter(e=>e.kind==='paint').sort((a,b)=>a.at.localeCompare(b.at)).at(-1)
 // Coins won and things bought are kept too (old months are folded into one entry, see foldCoins).
 const kept=(e:CareEvent)=>e.kind==='wish'||e.kind==='find'||e.kind==='visit'||e.kind==='bond'||e.kind==='taste'||e.kind==='gift'||e.kind==='coin'||e.kind==='buy'||e.kind==='bank'
 const log=all.filter(e=>kept(e)||e===lastWear||e===lastPaint||time(e.at)>=since)
 if((event.kind==='wish'||event.kind==='exam'||event.kind==='nudge'||event.kind==='visit'||event.kind==='bond'||event.kind==='taste'||event.kind==='coin')&&log.some(e=>e.id===event.id))return {profileId,log,...extras(state)}
 if(event.kind==='play'&&now.getTime()<nextPlayAt(log))return {profileId,log,...extras(state)}
 if(event.kind==='pet'){const lastPet=Math.max(-Infinity,...log.filter(e=>e.kind==='pet').map(e=>time(e.at)));if(now.getTime()-lastPet<PET_EVERY_MS)return {profileId,log,...extras(state)}}
 if(event.kind==='sleep'&&bedtime(log,now).tucked)return {profileId,log,...extras(state)}
 if(event.kind==='wake'&&!bedtime(log,now).canWake)return {profileId,log,...extras(state)}
 if(event.kind==='feed'&&event.taskId&&log.some(e=>e.kind==='feed'&&e.taskId===event.taskId))return {profileId,log,...extras(state)}
 // The first feeding, pat, tuck-in or wake-up of a day also marks a day KONO was cared for, with a fixed
 // ID so two devices mark the same day once.
 const careDay=bondEventId(localDay(now))
 const next=['feed','pet','sleep','wake','play'].includes(event.kind)&&!log.some(e=>e.id===careDay)?[...log,event,{id:careDay,kind:'bond' as const,at:event.at}]:[...log,event]
 // Over the cap: drop the oldest everyday entries, never wishes or what KONO is wearing.
 while(next.length>LOG_MAX){const i=next.findIndex(e=>!kept(e)&&e!==event&&!(e.kind==='wear'&&event.kind!=='wear'&&e===lastWear)&&!(e.kind==='paint'&&event.kind!=='paint'&&e===lastPaint));if(i<0)break;next.splice(i,1)}
 return {profileId,log:event.kind==='coin'||event.kind==='buy'?foldCoins(next,now):next,...extras(state)}
}

/** Coins won and snacks bought more than two months ago are folded into one 'bank' entry per month (its
 * coins won minus its snacks bought), so the log doesn't grow for ever. Outfits and finds bought stay as
 * they are (they're owned for good). A month with a bank entry ignores any loose entries of that month,
 * so two devices folding at different times (or an old device sending an entry late) never count twice. */
export const monthOf=(iso:string)=>iso.slice(0,7)
export const foldable=(e:CareEvent)=>e.kind==='coin'||(e.kind==='buy'&&!!e.item?.startsWith('food:'))
export const bankEventId=(month:string)=>'bank-'+month
export function foldCoins(log:CareEvent[],now:Date):CareEvent[]{
 const cutoff=monthOf(new Date(now.getTime()-60*DAY).toISOString())
 const banked=new Set(log.filter(e=>e.kind==='bank').map(e=>e.id.slice(5)))
 const sums=new Map<string,number>()
 for(const e of log)if(foldable(e)&&monthOf(e.at)<cutoff&&!banked.has(monthOf(e.at)))sums.set(monthOf(e.at),(sums.get(monthOf(e.at))??0)+(e.kind==='coin'?1:-1)*(e.n??0))
 if(!sums.size&&!log.some(e=>foldable(e)&&banked.has(monthOf(e.at))))return log
 const banks=[...sums].map(([month,n]):CareEvent=>({id:bankEventId(month),kind:'bank',at:month+'-15T12:00:00.000Z',n}))
 for(const month of sums.keys())banked.add(month)
 return [...log.filter(e=>!(foldable(e)&&banked.has(monthOf(e.at)))),...banks]
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
  if(['wear','find','exam','nudge','feed','visit','taste','gift','paint'].includes(event.kind)&&typeof x.item==='string'&&x.item.length<=40)event.item=x.item
  if(event.kind==='gift'){if(typeof x.from==='string'&&x.from.length<=60)event.from=x.from;if(typeof x.note==='string'&&x.note.length<=140)event.note=x.note}
  if(['coin','buy'].includes(event.kind)&&typeof x.item==='string'&&x.item.length<=40)event.item=x.item
  if(['coin','buy','bank'].includes(event.kind)){if(typeof x.n!=='number'||!Number.isInteger(x.n)||Math.abs(x.n)>1_000_000)return [];event.n=x.n}
  return [event]
 }).slice(-LOG_MAX)
 const num=(v:unknown,lo:number,hi:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):fallback
 const house=(Array.isArray(value.house)?value.house:[]).flatMap((h:unknown):HouseItem[]=>{
  if(!h||typeof h!=='object')return []
  const x=h as Record<string,unknown>
  if(typeof x.id!=='string'||!x.id||x.id.length>150||typeof x.item!=='string'||!x.item||x.item.length>40)return []
  return [{id:x.id,item:x.item,x:num(x.x,0,1,0.5),y:num(x.y,0,1,0.7),...(x.size!==undefined?{size:num(x.size,0.5,2,1)}:{}),...(x.flip===true?{flip:true}:{})}]
 }).slice(0,80)
 const home=typeof value.home==='string'&&value.home&&value.home.length<=150?value.home:undefined
 const room=typeof value.room==='string'&&/^[a-z]{1,30}$/.test(value.room)?value.room:undefined
 return {profileId,log,...(Array.isArray(value.house)?{house}:{}),...(home?{home}:{}),...(room?{room}:{})}
}

/** What KONO says after being fed or patted, shown in place of the day's line for a moment. */
export const fedLine=(treat:Treat,favorite=false)=>favorite?'😍 A '+treat.name+'! '+treat.emoji+' KONO’s favorite this week! KONO does a happy dance.':'Yum! '+treat.emoji+' KONO loved the '+treat.name+'. Thank you!'
/** Three quick taps tickle KONO; a tap right after finishing something is a high five. */
export const TICKLE_LINES=['Hehe! That tickles! 😆','Ahaha! Stop, stop! 😂','KONO giggles and wiggles all over! 🤭']
export const highFiveLine=(title:string)=>'✋ High five! Nice work on '+title+'!'
export const HELLO_LINE='👋 Welcome back! KONO missed you.'
/** A tap counts as a high five this long after finishing something. */
export const HIGH_FIVE_MS=3*60_000
export const PET_LINES=['KONO giggles and wiggles happily.','KONO leans into the pat. ♡','KONO does a happy little spin!']
/** A visit after this many days away is a homecoming. */
export const AWAY_DAYS=3
export const isAwayVisit=(lastVisit:number,now:Date)=>Number.isFinite(lastVisit)&&lastVisit>0&&now.getTime()-lastVisit>AWAY_DAYS*DAY
export const AWAY_LINE='KONO just got back from a little trip and missed you! 🧳'

/** Bedtime and wake-up. From 7 PM KONO can be tucked in (once a night); it then sleeps until morning
 * and the island goes dark. From 6 AM until noon KONO can be woken (once a day) and says what's
 * on today. A night runs 7 PM to 6 AM and belongs to the evening's date. */
export const bondEventId=(day:string)=>'bond-'+day
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
