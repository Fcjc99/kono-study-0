import {peopleOf,type AppData} from './model'
import {classOccurrences,classTime} from './classSchedule'
import {endMinutes} from './overnight'
import {addDays} from './studyScheduler'

/** Clash warnings: before something is added, what it overlaps for the same person (a kid, or you for
 * your own and whole-family things), or for the same driver. A kid's school classes count too. It only
 * warns; the person decides. */
/** self: in a kid's own plan, that kid (untagged things there are theirs, not "you"). */
export type ClashCandidate={id?:string;recurringId?:string;dates:string[];time?:string;endTime?:string;kidIds:string[];driver?:string;self?:string}
type Found={date:string;text:string;key:string}
export type Clash={date:string;text:string}

const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
/** A start and end in minutes from the start of its day (past midnight for a late-night one); no end means an hour. */
const span=(time:string,endTime?:string,shift=0):[number,number]=>[minutes(time)+shift,endMinutes(time,endTime)+shift]
const overlaps=(a:[number,number],b:[number,number])=>a[0]<b[1]&&b[0]<a[1]
const range=(time:string,endTime?:string)=>classTime(time)+(endTime?'–'+classTime(endTime):'')

export function findClashes(data:Pick<AppData,'activeProfileId'|'calendarEvents'|'studySeasons'|'kids'>,profileId:string,c:ClashCandidate,dateLabel:(date:string)=>string):Clash[]{
 if(!c.time||!/^\d{2}:\d{2}$/.test(c.time))return []
 const me=c.self??'me',mine=span(c.time,c.endTime),people=c.kidIds.length?c.kidIds:[me],driver=c.driver?.trim().toLowerCase()
 const name=(id:string)=>id==='me'?'You':data.kids.find(k=>k.id===id)?.name??'Someone'
 const whoOf=(ids:string[])=>{const n=ids.map(name);return n.length>1?n.slice(0,-1).join(', ')+' and '+n.at(-1):n[0]}
 const out:Found[]=[]
 for(const date of c.dates.slice(0,200)){
  const on=(text:string)=>out.push({date,key:text,text:text+(c.dates.length>1?' on '+dateLabel(date):'')+'.'})
  // The day before's late-night things and (for a late-night candidate) the next morning's count too.
  const before=addDays(date,-1),after=addDays(date,1)
  for(const e of data.calendarEvents){
   const shift=e.date===date?0:e.date===before?-1440:e.date===after?1440:null
   if(e.profileId!==profileId||shift===null||!e.time||e.id===c.id||e.done)continue
   if(c.recurringId&&e.recurringId===c.recurringId)continue
   if(!overlaps(mine,span(e.time,e.endTime,shift)))continue
   const theirs=peopleOf(e).length?peopleOf(e):[me],both=people.filter(p=>theirs.includes(p))
   if(both.length){on(whoOf(both)+(both.length===1&&both[0]==='me'?' already have ':' already '+(both.length>1?'have ':'has '))+e.title+' at '+range(e.time,e.endTime));continue}
   if(driver&&e.driver?.trim().toLowerCase()===driver)on(e.driver!.trim()+' is already driving to '+e.title+' at '+range(e.time,e.endTime))
  }
  for(const o of classOccurrences({activeProfileId:profileId,studySeasons:data.studySeasons},date)){
   if(o.timePending||o.block.kind==='break'||o.block.skippedDates?.includes(date))continue
   const kids=o.block.kidId?[o.block.kidId]:peopleOf(o.season).length?peopleOf(o.season):c.self?[c.self]:[],both=c.kidIds.filter(k=>kids.includes(k))
   const start=o.displayStart??o.block.start,end=o.displayEnd??o.block.end
   if(both.length&&overlaps(mine,span(start,end)))on(whoOf(both)+' '+(both.length>1?'have':'has')+' '+o.block.label+' (class) at '+range(start,end))
  }
 }
 // One line per clash, and not the same one for every week of a repeat.
 const seen=new Set<string>()
 return out.filter(x=>{if(seen.has(x.key))return false;seen.add(x.key);return true}).map(({date,text})=>({date,text}))
}
