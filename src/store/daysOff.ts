import {uid,peopleOf,type AppData,type DayOff,type StudySeason} from './model'
import {classOccurrences} from './classSchedule'

/** Sick days, snow days and days off: one tap marks a kid (or every kid) out for a day. Their classes that
 * day are skipped (a snow day closes the school instead, so a rotation counts it the way the school does),
 * and their events show as off. Taking it back undoes exactly what it changed. */
export const DAY_OFF_REASONS:{id:DayOff['reason'];icon:string;label:string}[]=[
 {id:'sick',icon:'🤒',label:'Sick day'},
 {id:'snow',icon:'❄️',label:'Snow day'},
 {id:'off',icon:'🏖️',label:'Day off'},
]
export const dayOffIcon=(reason:DayOff['reason'])=>DAY_OFF_REASONS.find(r=>r.id===reason)?.icon??'🏖️'

/** The plans a family's days off reach: this plan and each of its kids' own plans. */
const reach=(data:Pick<AppData,'profiles'|'kids'>,profileId:string)=>{
 const kids=data.kids.filter(k=>k.profileId===profileId)
 const own=new Map(data.profiles.filter(p=>p.kidId&&kids.some(k=>k.id===p.kidId)).map(p=>[p.id,p.kidId!]))
 return {kids,own}
}
/** Whose a season's classes are: its tag, or the kid whose own plan it's in. */
const seasonPeople=(s:StudySeason,own:Map<string,string>)=>peopleOf(s).length?peopleOf(s):own.has(s.profileId)?[own.get(s.profileId)!]:[]

type Read=Pick<AppData,'daysOff'|'kids'|'profiles'>
/** The days off on a date for this plan. A kid's own plan sees its family's that include that kid. */
export function daysOffOn(data:Read,profileId:string,date:string):DayOff[]{
 const kidId=data.profiles.find(p=>p.id===profileId)?.kidId,family=kidId?data.kids.find(k=>k.id===kidId)?.profileId:undefined
 return (data.daysOff??[]).filter(d=>d.date===date&&(d.profileId===profileId||!!family&&d.profileId===family&&(!d.kidIds.length||d.kidIds.includes(kidId!))))
}
/** Whose plan a kid's own plan is, so its untagged things count as that kid's. */
const planKid=(data:Read,profileId:string)=>data.profiles.find(p=>p.id===profileId)?.kidId
/** Is this person (a kid's id) out that day? Everyone-days count for every kid. */
export function isOut(data:Read,profileId:string,date:string,kidId:string|undefined){
 kidId=kidId??planKid(data,profileId)
 if(!kidId)return false
 return daysOffOn(data,profileId,date).some(d=>d.reason!=='snow'&&(!d.kidIds.length||d.kidIds.includes(kidId)))
}
/** An event is off when every person on it is out sick or off (a snow day leaves events alone: the family
 * decides what still happens). */
export function eventOff(data:Read,profileId:string,e:{date:string;kidId?:string;kidIds?:string[]}){
 const people=peopleOf(e).length?peopleOf(e):[planKid(data,profileId)].filter((k):k is string=>!!k)
 return people.length>0&&people.every(k=>isOut(data,profileId,e.date,k))
}
/** "Emma is out sick" / "Snow day: no school" / "Day off for Emma and Leo". */
export function dayOffLabel(data:Pick<AppData,'kids'>,d:DayOff){
 const names=d.kidIds.map(id=>data.kids.find(k=>k.id===id)?.name).filter((n):n is string=>!!n)
 const who=names.length>1?names.slice(0,-1).join(', ')+' and '+names.at(-1):names[0]
 if(d.reason==='snow')return who?'Snow day for '+who:'Snow day: no school'
 if(d.reason==='sick')return who?who+(names.length>1?' are':' is')+' out sick':'Everyone is out sick'
 return who?'Day off for '+who:'Day off for everyone'
}

/** Mark kids (none listed: every kid) out on a date. */
export function addDayOff(data:AppData,profileId:string,date:string,kidIds:string[],reason:DayOff['reason']):AppData{
 const id=uid('dayoff'),{kids,own}=reach(data,profileId),out=kidIds.length?kidIds:kids.map(k=>k.id)
 const skipped:NonNullable<DayOff['skipped']>=[],closed:string[]=[]
 const studySeasons=data.studySeasons.map(s=>{
  if(s.profileId!==profileId&&!own.has(s.profileId))return s
  // A snow day closes the school for everyone it teaches.
  if(reason==='snow'&&s.school&&!kidIds.length){closed.push(s.id);return {...s,school:{...s.school,exceptions:[...s.school.exceptions,{id:'dayoff-'+id,start:date,end:date,kind:'snow' as const,label:'Snow day',audience:'all' as const}]}}}
  const people=seasonPeople(s,own)
  // A class shared with a kid who isn't out keeps going.
  let week=s.week
  for(const c of classOccurrences({activeProfileId:s.profileId,studySeasons:[s]},date)){
   const whose=c.block.kidId?[c.block.kidId]:people
   if(!whose.length||!whose.every(k=>out.includes(k))||c.block.skippedDates?.includes(date))continue
   week={...week,[c.day]:week[c.day].map(b=>b.id===c.block.id?{...b,skippedDates:[...(b.skippedDates??[]),date]}:b)}
   skipped.push({seasonId:s.id,day:c.day,blockId:c.block.id})
  }
  return week===s.week?s:{...s,week}
 })
 const record:DayOff={id,profileId,date,kidIds,reason,...(skipped.length?{skipped}:{}),...(closed.length?{closed}:{})}
 return {...data,studySeasons,daysOff:[...(data.daysOff??[]),record]}
}
/** Take a day off back, undoing only the skips and closures it made. */
export function removeDayOff(data:AppData,id:string):AppData{
 const d=(data.daysOff??[]).find(x=>x.id===id);if(!d)return data
 const studySeasons=data.studySeasons.map(s=>{
  let next=s
  if(d.closed?.includes(s.id)&&s.school)next={...next,school:{...s.school,exceptions:s.school.exceptions.filter(x=>x.id!=='dayoff-'+d.id)}}
  const mine=d.skipped?.filter(x=>x.seasonId===s.id)??[]
  if(mine.length)next={...next,week:Object.fromEntries(Object.entries(next.week).map(([day,blocks])=>[day,blocks.map(b=>mine.some(x=>x.day===day&&x.blockId===b.id)?{...b,skippedDates:(b.skippedDates??[]).filter(v=>v!==d.date)}:b)]))}
  return next
 })
 return {...data,studySeasons,daysOff:(data.daysOff??[]).filter(x=>x.id!==id)}
}
