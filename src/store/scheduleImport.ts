import {blankWeek,dayNames,normalizeData,uid,type AppData,type CalendarEventKind,type ScheduleBlock,type StudySeason} from './model'
import {classColumns,classTableRow,type ClassColumns} from './classTable'

export type ImportRow={id:string;include:boolean;kind:'class'|'exam'|'task'|'event'|'subject';title:string;subject:string;date:string;weekdays:number[];start:string;end:string;source:string;location?:string}
export const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s
const clean=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase()
const time=(h:string,m:string|undefined,period:string|undefined)=>{let hour=Number(h);if(period){if(hour<1||hour>12)return '';hour=hour%12+(period.toLowerCase()==='pm'?12:0)}else if(hour<0||hour>23)return '';const minute=Number(m??0);return minute<60?String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0'):''}
export function dateFrom(line:string,start:string,end:string,order:'mdy'|'dmy'){
 const iso=line.match(/\b\d{4}-\d{2}-\d{2}\b/);if(iso)return validDate(iso[0])?iso[0]:''
 const numeric=line.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?\b/)
 const named=line.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i)
 if(!numeric&&!named)return ''
 const month=named?['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[1].slice(0,3).toLowerCase())+1:Number(numeric![order==='mdy'?1:2])
 const day=Number(named?named[2]:numeric![order==='mdy'?2:1]),year=named?.[3]??numeric?.[3]
 const build=(y:string)=>y+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')
 if(year)return validDate(build(year))?build(year):''
 if(!validDate(start)||!validDate(end))return ''
 const candidates=[...new Set([start.slice(0,4),end.slice(0,4)])].map(build).filter(d=>validDate(d)&&d>=start&&d<=end)
 return candidates.length===1?candidates[0]:''
}
const WEEKDAY_PATTERN='\\b(?:Sun(?:day)?|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|MWF|TTh)\\b'
const startsRecord=(line:string,start:string,end:string,order:'mdy'|'dmy')=>new RegExp(WEEKDAY_PATTERN,'i').test(line)||!!dateFrom(line,start,end,order)
/** Table-style exports (a sports schedule copied from a scheduling site, or its screenshot/PDF read
 * through OCR) put one field per line: a date line, then a time line, then an opponent/description
 * line, sometimes a home/away line. Each of those on its own carries no date or weekday marker, so the
 * per-line loop below would silently drop them. Fold every such line into the most recent line that DID
 * start a record, so the loop sees one combined line per schedule entry instead of losing the rest. */
// A trailing "Home = vs. | Away = @" style legend line carries no date/weekday either, but it is not a
// continuation of the last game — without this it silently glues onto and pollutes the final row's title.
const isLegend=(line:string)=>line.includes('=')
const mergeRecordLines=(lines:string[],start:string,end:string,order:'mdy'|'dmy'):string[]=>{
 const merged:string[]=[]
 for(const line of lines){
  if(!startsRecord(line,start,end,order)&&!isLegend(line)&&merged.length)merged[merged.length-1]+=' '+line
  else merged.push(line)
 }
 return merged
}
/** Strips the weekday/date/time tokens a record-starting line matched on, leaving the descriptive text
 * (e.g. an opponent name) as the title instead of the whole raw line. Only strips a time when it carries
 * an am/pm marker, so an unrelated bare number (a room, a score) is never mistaken for a time and cut. */
const cleanTitle=(source:string):string=>source
 .replace(new RegExp(WEEKDAY_PATTERN,'gi'),'')
 .replace(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,'')
 .replace(/\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b/g,'')
 .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b(?:\s*[-–—]\s*\d{1,2}(?::\d{2})?\s*(am|pm)?\b)?/gi,'')
 .replace(/[|,;:]+/g,' ').replace(/\s+/g,' ').trim()
/** Conservative suggestions only. Unmatched source text remains visible for manual review. */
/** A headed class table ("Class Name | Teacher | Day | Time | Building | Room"): one weekly class per row. */
function classTableRows(text:string):ImportRow[]{
 const rows:ImportRow[]=[]
 let columns:ClassColumns|null=null
 for(const line of text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){
  const header=classColumns(line.split(/\t|\s*\|\s*/))
  if(header){columns=header;continue}
  const found=columns&&classTableRow(line,columns,[...dayNames])
  if(!found)continue
  const weekdays=found.days.map(d=>dayNames.indexOf(d as typeof dayNames[number]))
  rows.push({id:uid('import-row'),include:false,kind:'class',title:found.label,subject:found.label.replace(/\s*\((?:lecture|discussion|lab|laboratory|recitation|seminar|tutorial)\)$/i,''),date:'',weekdays,start:found.start,end:found.end,source:[found.label,found.location].filter(Boolean).join(' · ').slice(0,1000),location:found.location})
 }
 return rows
}
export function suggestSchedule(text:string,start:string,end:string,order:'mdy'|'dmy'):ImportRow[]{
 const table=classTableRows(text)
 // With a class table, weekly classes come from its rows; other lines can still add dated items.
 if(table.length)return [...table,...suggestLines(text,start,end,order).filter(r=>r.kind!=='class')].slice(0,100)
 return suggestLines(text,start,end,order)
}
function suggestLines(text:string,start:string,end:string,order:'mdy'|'dmy'):ImportRow[]{
 const rows:ImportRow[]=[]
 const lines=mergeRecordLines(text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,2000),start,end,order)
 for(const source of lines){
  const weekdays=dayNames.flatMap((d,i)=>new RegExp('\\b'+d.slice(0,3)+'(?:'+d.slice(3)+')?\\b','i').test(source)?[i]:[])
  if(/\bMWF\b/.test(source))weekdays.push(1,3,5)
  if(/\bTTh\b/i.test(source))weekdays.push(2,4)
  const clock=source.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
  const dated=dateFrom(source,start,end,order)
  const isExam=/\b(exam|midterm|final|quiz|test)\b/i.test(source),isTask=/\b(due|assignment|homework|submit|read|chapter|project)\b/i.test(source)
  if(!weekdays.length&&!dated&&!isExam&&!isTask)continue
  // A specific date (not just a bare weekday name) always means a one-time occurrence, even when the
  // date itself is written with a leading weekday label ("Tue, 9/8") — that weekday is part of the date,
  // not a recurrence rule, so it must not be classified as a weekly class.
  const kind=!dated&&weekdays.length?'class':isExam?'exam':isTask?'task':'event'
  const label=cleanTitle(source)
  const explicit=clock&&((clock[3]&&clock[6])||(!clock[3]&&!clock[6]&&(Number(clock[1])>12||Number(clock[4])>12)))
  rows.push({id:uid('import-row'),include:false,kind,title:(label||source).slice(0,200),subject:kind==='class'?label.slice(0,200):'',date:dated,weekdays:[...new Set(weekdays)],start:explicit?time(clock[1],clock[2],clock[3]):'',end:explicit?time(clock[4],clock[5],clock[6]):'',source:source.slice(0,1000)})
  if(rows.length===100)break
 }
 return rows
}
export type ScheduleImportOptions={eventKind?:CalendarEventKind;seasonName?:string;category?:StudySeason['category'];blockKind?:ScheduleBlock['kind']}
export function applyScheduleImport(data:AppData,profileId:string,rows:ImportRow[],start:string,end:string,options:ScheduleImportOptions={}){
 if(data.activeProfileId!==profileId)throw Error('Your profile changed. Reopen the importer.')
 const selected=rows.filter(r=>r.include);if(!selected.length||selected.length>100)throw Error('Select between 1 and 100 reviewed items.')
 const next=structuredClone(data);let added=0,skipped=0
 const season={id:uid('season'),profileId,name:options.seasonName??'Imported schedule',start,end,active:true,week:blankWeek(),category:options.category}
 const subjectFor=(name:string)=>{if(!name.trim())return '';const known=next.subjects.find(s=>s.profileId===profileId&&clean(s.name)===clean(name));if(known)return known.id;const id=uid('subject');next.subjects.push({id,profileId,name:name.trim(),color:'#4169a8',resources:[]});added++;return id}
 for(const row of selected){
  if(!row.title.trim()||row.title.length>200||row.subject.length>200)throw Error('Every selected item needs a title of at most 200 characters.')
  if(row.kind==='class'){
   if(!validDate(start)||!validDate(end)||end<start||Number(end.slice(0,4))-Number(start.slice(0,4))>2)throw Error('Choose a valid class date range, up to two years.')
   if(!row.weekdays.length||row.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Choose weekdays for '+row.title)
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end)||row.end<=row.start)throw Error('Check start and end times for '+row.title)
  }else if(row.kind!=='subject'&&!validDate(row.date))throw Error('Choose a valid date for '+row.title)
  const subjectId=subjectFor(row.kind==='subject'?row.title:row.subject)
  if(row.kind==='subject'){if(data.subjects.some(s=>s.id===subjectId))skipped++;continue}
  if(row.kind==='class'){
   for(const d of new Set(row.weekdays)){
    const day=dayNames[d],duplicate=[...next.studySeasons,season].some(s=>s.profileId===profileId&&(s.week[day]??[]).some(b=>clean(b.label)===clean(row.title)&&b.subjectId===subjectId&&b.start===row.start&&b.end===row.end&&(b.dateStart??s.start)===start&&(b.dateEnd??s.end)===end))
    if(duplicate){skipped++;continue}season.week[day].push({id:uid('block'),label:row.title.trim(),subjectId,start:row.start,end:row.end,dateStart:start,dateEnd:end,kind:options.blockKind??'study',occurrenceNotes:{},...(row.location?.trim()?{location:row.location.trim().slice(0,160)}:{})});added++
   }
  }else{
   const key=row.kind==='exam'?'exams':row.kind==='task'?'tasks':'calendarEvents'
   if(next[key].some(item=>item.profileId===profileId&&clean(item.title)===clean(row.title)&&item.subjectId===subjectId&&('due' in item?item.due:item.date)===row.date)){skipped++;continue}
   const item={id:uid(row.kind),profileId,subjectId,title:row.title.trim(),done:false,notes:''}
   if(key==='calendarEvents')next.calendarEvents.push({...item,date:row.date,kind:options.eventKind??'other'})
   else next[key].push({...item,due:row.date})
   added++
  }
 }
 if(Object.values(season.week).some(v=>v.length))next.studySeasons.push(season)
 return {data:normalizeData(next),added,skipped}
}
