import type {AppData,Kid} from './model'
import {classOccurrences,isInClassNow} from './classSchedule'

/** Reuses the same distinguishable, muted color set the rest of the app already leans on for
 * per-item accents, so a kid's color reads as consistent with the app's existing palette choices. */
export const KID_COLORS=['#7ca982','#d9908c','#7f9fc9','#c69a65','#9a86bd','#5da8a1','#ba7f9d','#8b9a72'] as const

/** The next color not already claimed by an existing kid, falling back to cycling the palette once
 * every color is taken (so a 9th kid still gets a color instead of none, just reused). */
export function nextKidColor(kids:readonly Pick<Kid,'color'>[]):string {
 const used=new Set(kids.map(k=>k.color))
 return KID_COLORS.find(c=>!used.has(c))??KID_COLORS[kids.length%KID_COLORS.length]
}

export type KidItemKind='task'|'exam'|'event'|'class'
export type KidItem={kidId?:string;kidName?:string;kidEmoji?:string;color?:string;kind:KidItemKind;id:string;title:string;date:string;done:boolean;time?:string}

/** Every task, exam, calendar event and recurring class occurrence for one shared profile on one
 * date, tagged with whichever kid (if any) it's assigned to -- the whole point of one shared
 * calendar is seeing everyone at once on one grid, not switching between separate calendars per
 * kid. visibleKidIds, when given, hides items tagged to a kid not in the set (an untagged item is
 * always shown, the same way an "unassigned" subject item always shows regardless of subject filter). */
export function kidItemsForDate(data:Pick<AppData,'tasks'|'exams'|'calendarEvents'|'studySeasons'|'kids'>,profileId:string,date:string,visibleKidIds?:Set<string>|null):KidItem[] {
 const kidOf=(kidId?:string)=>kidId?data.kids.find(k=>k.id===kidId):undefined
 const visible=(kidId?:string)=>!visibleKidIds||!kidId||visibleKidIds.has(kidId)
 const tag=(kidId?:string)=>{const kid=kidOf(kidId);return {kidId,kidName:kid?.name,kidEmoji:kid?.emoji,color:kid?.color}}
 const items:KidItem[]=[]
 for(const t of data.tasks)if(t.profileId===profileId&&t.due===date&&visible(t.kidId))items.push({...tag(t.kidId),kind:'task',id:t.id,title:t.title,date,done:t.done})
 for(const e of data.exams)if(e.profileId===profileId&&e.due===date&&visible(e.kidId))items.push({...tag(e.kidId),kind:'exam',id:e.id,title:e.title,date,done:e.done})
 for(const ev of data.calendarEvents)if(ev.profileId===profileId&&ev.date===date&&visible(ev.kidId))items.push({...tag(ev.kidId),kind:'event',id:ev.id,title:ev.title,date,done:Boolean(ev.done),time:ev.time})
 for(const c of classOccurrences({activeProfileId:profileId,studySeasons:data.studySeasons},date)){if(!visible(c.block.kidId))continue;items.push({...tag(c.block.kidId),kind:'class',id:c.id,title:c.block.label,date,done:false,time:c.displayStart??c.block.start})}
 return items
}

/** A kid currently in one of their own tagged classes right now -- reused so a notification about a
 * specific kid's assignment respects that kid's own class time, not just whichever class is
 * happening anywhere on the shared schedule. An untagged (no kidId) item is never suppressed this
 * way, since it isn't known to belong to any one kid's class. */
const kidInClassNow=(data:Pick<AppData,'studySeasons'>,profileId:string,kidId:string|undefined,today:string,nowClock:string):boolean=>
 Boolean(kidId)&&isInClassNow(classOccurrences({activeProfileId:profileId,studySeasons:data.studySeasons},today).filter(c=>c.block.kidId===kidId),nowClock)

export type KidDueItem={id:string;title:string;due:string;done:boolean}

/** Every due task and exam for the due-today notification digest (see useDueNotifications), title
 * prefixed with the kid's name whenever the item is tagged to one -- an untagged item keeps its
 * plain title, exactly as it always has. Drops a kid's tagged items entirely while they're
 * currently in one of their own classes. */
export function kidDueItems(data:Pick<AppData,'tasks'|'exams'|'studySeasons'|'kids'>,profileId:string,today:string,nowClock:string):KidDueItem[] {
 const label=(kidId:string|undefined,title:string)=>{const kid=kidId?data.kids.find(k=>k.id===kidId):undefined;return kid?kid.name+': '+title:title}
 return [
  ...data.tasks.filter(t=>t.profileId===profileId&&!kidInClassNow(data,profileId,t.kidId,today,nowClock)).map(t=>({id:t.id,title:label(t.kidId,t.title),due:t.due,done:t.done})),
  ...data.exams.filter(e=>e.profileId===profileId&&!kidInClassNow(data,profileId,e.kidId,today,nowClock)).map(e=>({id:e.id,title:label(e.kidId,e.title),due:e.due,done:e.done})),
 ]
}

export type KidTimeBlockItem=KidDueItem&{plannedTime?:string;estimatedMinutes?:number}

/** Every task with a planned time-block, for the "time to start" notification (see
 * useTimeBlockNotifications) -- same name-prefixing and per-kid quiet-hours behavior as
 * kidDueItems. */
export function kidTimeBlockItems(data:Pick<AppData,'tasks'|'studySeasons'|'kids'>,profileId:string,today:string,nowClock:string):KidTimeBlockItem[] {
 const label=(kidId:string|undefined,title:string)=>{const kid=kidId?data.kids.find(k=>k.id===kidId):undefined;return kid?kid.name+': '+title:title}
 return data.tasks.filter(t=>t.profileId===profileId&&!kidInClassNow(data,profileId,t.kidId,today,nowClock)).map(t=>({id:t.id,title:label(t.kidId,t.title),due:t.due,done:t.done,plannedTime:t.plannedTime,estimatedMinutes:t.estimatedMinutes}))
}
