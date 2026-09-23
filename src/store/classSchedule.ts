import {dayNames,type AppData,type ScheduleBlock,type StudySeason} from './model'
import {schoolDay} from './schoolCalendar'
import {addDays} from './studyScheduler'

export type ClassOccurrence={displayStart?:string;displayEnd?:string;timePending?:boolean;id:string;date:string;day:string;season:StudySeason;block:ScheduleBlock}
export function classOccurrences(data:Pick<AppData,'activeProfileId'|'studySeasons'>,date:string):ClassOccurrence[]{
 const weekday=dayNames[new Date(date+'T12:00:00').getDay()]
 if(!weekday)return []
 return data.studySeasons.filter(s=>s.profileId===data.activeProfileId&&s.active&&s.start<=date&&s.end>=date).flatMap(season=>{const school=schoolDay(season,date),day=season.school?school?.cycleDay:weekday;if(!day)return [];return (season.week[day]??[]).filter(b=>(school?.exception?.kind!=='exam'||!!school.exception.bells?.[b.slot??''])&&(!!season.school&&b.fullYear||(!b.dateStart||b.dateStart<=date)&&(!b.dateEnd||b.dateEnd>=date))).map(block=>{const bell=school?.exception?.bells?.[block.slot??''];return {id:season.id+':'+block.id+':'+date,date,day,season,block,displayStart:bell?.start,displayEnd:bell?.end,timePending:school?.special&&!bell}})}).sort((a,b)=>(a.displayStart??a.block.start).localeCompare(b.displayStart??b.block.start)||a.block.label.localeCompare(b.block.label))
}
export function nextClassDate(item:ClassOccurrence):string|undefined{
 const end=item.season.school&&item.block.fullYear?item.season.end:[item.season.end,item.block.dateEnd??item.season.end].sort()[0]
 {
  for(let next=addDays(item.date,1);next<=end;next=addDays(next,1)){if(classOccurrences({studySeasons:[item.season],activeProfileId:item.season.profileId},next).some(({block:b})=>(b.id===item.block.id||(item.block.subjectId?b.subjectId===item.block.subjectId:b.label===item.block.label))&&!b.skippedDates?.includes(next)))return next}
  return
 }
}
export function updateClass(data:AppData,item:ClassOccurrence,update:(block:ScheduleBlock)=>ScheduleBlock):AppData{
 if(data.activeProfileId!==item.season.profileId)throw Error('Your profile changed. Reopen this class.')
 const season=data.studySeasons.find(s=>s.id===item.season.id&&s.profileId===item.season.profileId)
 if(!season?.week[item.day]?.some(b=>b.id===item.block.id))throw Error('This recurring class was removed. Your note is still in the editor.')
 return {...data,studySeasons:data.studySeasons.map(s=>s.id===season.id?{...s,week:{...s.week,[item.day]:s.week[item.day].map(b=>b.id===item.block.id?update(b):b)}}:s)}
}
export function saveClassNote(data:AppData,item:ClassOccurrence,text:string):AppData{
 return updateClass(data,item,b=>{if((b.occurrenceNotes?.[item.date]??'')!==(item.block.occurrenceNotes?.[item.date]??''))throw Error('This class note changed elsewhere. Your draft is preserved.');return {...b,occurrenceNotes:{...b.occurrenceNotes,[item.date]:text}}})
}
export const classTime=(time:string)=>{const [h,m]=time.split(':').map(Number);return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' AM':' PM')}
/** A single start time, or a "start–end" range once an end time is also known. */
export const timeRange=(start:string,end?:string)=>classTime(start)+(end?'–'+classTime(end):'')

/** True while any class/routine/hobby block from today's occurrences is actually in session right now
 * -- a 'break' block is free time within the day, not a commitment, so it's never treated as "in
 * class". Used to hold notifications quiet during school hours instead of buzzing a phone mid-class. */
export function isInClassNow(occurrences:ClassOccurrence[],nowClock:string):boolean{
 return occurrences.some(({block,displayStart,displayEnd})=>{
  if(block.kind==='break')return false
  const start=displayStart??block.start,end=displayEnd??block.end
  return start<=nowClock&&nowClock<end
 })
}
