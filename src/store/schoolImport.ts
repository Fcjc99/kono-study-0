import {dateFrom} from './scheduleImport'
import {uid,type StudySeason} from './model'
import {classColumns,classTableRow,toTime,weekdaysFrom,type ClassColumns} from './classTable'
import type {SchoolException} from './schoolCalendar'
/** OCR is evidence to review, never authority to close school automatically. */
export function suggestSchoolDates(text:string,start:string,end:string):(SchoolException&{include:boolean;source:string})[]{
 return text.split(/\r?\n/).filter(line=>/no school|vacation|break|half.day|1\/2.day|early release|exam|quarter|professional development|snow day/i.test(line)).slice(0,150).map(source=>{
  const first=dateFrom(source,start,end,'mdy')
  const range=source.match(/\b([A-Za-z]+)\s+(\d{1,2})\s*[-–—]\s*(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?(\d{1,2})\b/i)
  const reverse=source.match(/^\s*(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i)
  const from=first||(reverse?dateFrom(reverse[3]+' '+reverse[1],start,end,'mdy'):'')
  const to=range?dateFrom((range[3]||range[1])+' '+range[4],start,end,'mdy'):reverse?.[2]?dateFrom(reverse[3]+' '+reverse[2],start,end,'mdy'):from
  const kind:SchoolException['kind']=/snow day/i.test(source)?'snow':/half.day|1\/2.day|early release/i.test(source)?'half':/no school|vacation|break|professional development/i.test(source)?'holiday':/exam/i.test(source)?'exam':'notice'
  return {id:uid('school-date'),include:false,start:from,end:to,kind,label:source.trim().slice(0,200),audience:/senior/i.test(source)?'seniors':'all',source}
 })
}
export type RotatingImportRow={id:string;include:boolean;day:string;label:string;slot:string;start:string;end:string;dateStart:string;dateEnd:string;kind:'study'|'break'|'routine'|'hobby';location?:string}

const ndaRows=[
 ['07:30','07:50','7:30 AM'],['07:50','08:50','7:50 - 8:50 AM'],['08:53','09:53','8:53 - 9:53 AM'],
 ['09:56','10:23','9:56 - 10:23 AM'],['10:26','10:56','10:26 - 10:56 AM'],['10:59','12:29','10:59 AM - 12:29 PM'],
 ['12:32','13:32','12:32 - 1:32 PM'],['13:35','14:35','1:35 - 2:35 PM']
] as const
const ndaClassByBlock:Record<string,string>={B:'Honors Social Justice II / Ethics',C:'AP U.S. History',D:'Marine Biology',E:'Honors Algebra II',F:'Honors Spanish IV',G:'Honors Language Literature & Composition'}
/** Parse NDA's clean six-column PDF. It includes merged C blocks on Days 1/4 and J/K sub-blocks elsewhere. */
export function parseNdaSixDaySchedule(text:string,start:string,end:string):RotatingImportRow[]{
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),rows:RotatingImportRow[]=[]
 if(!/6-Day Schedule/i.test(text)||!['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6'].every(d=>text.includes(d)))throw Error('This does not look like the NDA six-day schedule export.')
 const matrix=text.split(/\r?\n/).map(line=>line.split('\t').map(x=>x.trim()))
 if(matrix.some(cells=>cells.length>=7&&/^Time$/i.test(cells[0])&&/^Day 1$/i.test(cells[1]))){
  const markers=ndaRows.map(row=>matrix.findIndex(columns=>columns[0]===row[2])),cells=ndaRows.map(()=>Array.from({length:6},()=>''))
  if(markers.every(index=>index>=0))for(let rowIndex=0;rowIndex<ndaRows.length;rowIndex++){
   const from=rowIndex?Math.floor((markers[rowIndex-1]+markers[rowIndex])/2)+1:markers[rowIndex]-1
   const to=rowIndex+1<markers.length?Math.floor((markers[rowIndex]+markers[rowIndex+1])/2)+1:matrix.findIndex((columns,index)=>index>markers[rowIndex]&&/^Notes:/i.test(columns.join(' ')))
   for(const columns of matrix.slice(Math.max(0,from),to<0?matrix.length:to))for(let day=0;day<6;day++){
    const value=(columns[day+1]??'').trim();if(value&&!/^Day [1-6]$/i.test(value)&&!/^WIN TIME$|^7:30 AM$/i.test(value))cells[rowIndex][day]+=(cells[rowIndex][day]?' ':'')+value
   }
  }
  ndaRows.forEach(([startTime,endTime],rowIndex)=>{
   for(let day=1;day<=6;day++){
    if(rowIndex===0){rows.push({id:uid('import-block'),include:true,day:'Day '+day,label:'WIN Time',slot:'WIN',start:startTime,end:endTime,dateStart:start,dateEnd:end,kind:'routine'});continue}
    const value=cells[rowIndex][day-1].replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[-–—]\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/ig,'').replace(/\s+/g,' ').trim()
    if(!value)continue
    const block=value.match(/\bBlock\s+([A-Z])\b/i),slot=block?.[1].toUpperCase()??''
    let label=value.replace(/\bBlock\s+[A-Z]\b.*$/i,'').trim()||'Unscheduled'
    if(ndaClassByBlock[slot]&&!/unscheduled/i.test(label))label=ndaClassByBlock[slot]
    const merged=rowIndex===3&&[1,4].includes(day)&&slot==='C'
    rows.push({id:uid('import-block'),include:true,day:'Day '+day,label,slot,start:startTime,end:merged?'10:56':endTime,dateStart:start,dateEnd:end,kind:/unscheduled/i.test(label)?'break':/advisory|win time/i.test(label)?'routine':/club/i.test(label)?'hobby':'study'})
   }
  })
  if(rows.length>=40)return rows
  rows.length=0
 }
 const indices:number[]=[]
 for(const row of ndaRows){const from=(indices.at(-1)??-1)+1;indices.push(lines.findIndex((x,n)=>n>=from&&x===row[2]))}
 if(indices.some(i=>i<0))throw Error('KONO could not find every NDA bell-time row. Try the original PDF rather than a screenshot.')
 ndaRows.forEach(([startTime,endTime],rowIndex)=>{
  const noteIndex=lines.findIndex((x,n)=>n>indices[rowIndex]&&/^Notes:/i.test(x)),sectionEnd=rowIndex+1<indices.length?indices[rowIndex+1]:noteIndex<0?lines.length:noteIndex
  const section=lines.slice(indices[rowIndex]+1,sectionEnd)
  if(rowIndex===0){for(let day=1;day<=6;day++)rows.push({id:uid('import-block'),include:true,day:'Day '+day,label:'WIN Time',slot:'WIN',start:startTime,end:endTime,dateStart:start,dateEnd:end,kind:'routine'});return}
  const cells:{label:string;slot:string}[]=[],parts:string[]=[]
  for(const line of section){
   if(/^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\s*[-–—]/i.test(line))continue
   const block=line.match(/^Block\s+([A-Z])$/i)
   if(block){cells.push({label:parts.join(' ').replace(/\s+/g,' ').trim(),slot:block[1].toUpperCase()});parts.length=0}else parts.push(line)
  }
  const days=rowIndex===4?[2,3,5,6]:[1,2,3,4,5,6]
  if(cells.length!==days.length)throw Error(`KONO found ${cells.length} of ${days.length} entries at ${ndaRows[rowIndex][2]}. Check the extracted text or enter this row manually.`)
  cells.forEach((cell,index)=>{const label=ndaClassByBlock[cell.slot]&&!/unscheduled/i.test(cell.label)?ndaClassByBlock[cell.slot]:cell.label||'Unscheduled',day=days[index],merged=rowIndex===3&&[1,4].includes(day)&&cell.slot==='C';rows.push({id:uid('import-block'),include:true,day:'Day '+day,label,slot:cell.slot,start:startTime,end:merged?'10:56':endTime,dateStart:start,dateEnd:end,kind:/unscheduled/i.test(label)?'break':/advisory/i.test(label)?'routine':/club/i.test(label)?'hobby':'study'})})
 })
 return rows
}

export function suggestRotatingClasses(text:string,cycle:string[],start:string,end:string):RotatingImportRow[]{
 const rows:RotatingImportRow[]=[];let day='',previous=''
 const clock=(h:string,m:string,ap:string|undefined)=>{let n=Number(h);if(ap){if(n<1||n>12)return '';n=n%12+(ap.toLowerCase()==='pm'?12:0)}return n<24&&Number(m)<60?String(n).padStart(2,'0')+':'+m:''}
 const ae=cycle.length===2&&cycle.includes('A day')&&cycle.includes('E day')
 for(const line of text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){
  const heading=cycle.find(x=>x.toLowerCase()===line.toLowerCase());if(heading){day=heading;previous='';continue}
  if(/block time key|class time.*cycle days/i.test(line))continue
  const t=line.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\s*[-–—]\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if(t){
   // A trailing AM/PM applies to both clocks only for an increasing same-period range.
   const ap=t[3]||((t[6]&&Number(t[1])<=Number(t[4]))?t[6]:undefined)
   const explicit=!!(ap&&t[6])||(!t[3]&&!t[6]&&(Number(t[1])>12||Number(t[4])>12))
   const prefix=line.slice(0,t.index).trim(),cells=prefix.split(/\t+/).map(x=>x.trim()).filter(Boolean)
   const slot=line.match(/(?:period|block)\s+([A-Z])\b/i)?.[1]?.toUpperCase()??cells.find(x=>/^[A-H]$/.test(x))??''
   const label=(cells.length>1?cells[0]:prefix||previous).replace(/[:\s]+$/,'').slice(0,200)
   const nums=line.match(/\bDays?\s+([1-6](?:\s*,\s*[1-6])*)/i)?.[1].split(/\s*,\s*/).map(Number)
   let days=nums?[...new Set(nums.map(n=>ae?(n%2?'A day':'E day'):'Day '+n))].filter(d=>cycle.includes(d)):day?[day]:[]
   // Do not collapse an incomplete odd/even selection into an every-other-day rule.
   if(ae&&nums&&!['1,3,5','2,4,6','1,2,3,4,5,6'].includes([...new Set(nums)].sort().join(',')))days=[]
   if(!days.length&&ae&&!nums&&/^[A-H]$/.test(slot))days=['ABCD'.includes(slot)?'A day':'E day']
   const routine=/^(homeroom|advisory)\b/i.test(label)
   if(routine&&!days.length)days=[...cycle]
   for(const target of days.length?days:['']){
    rows.push({id:uid('import-block'),include:false,day:target,label,slot,start:explicit?clock(t[1],t[2],ap):'',end:explicit?clock(t[4],t[5],t[6]):'',dateStart:start,dateEnd:end,kind:/unscheduled|free period/i.test(label)?'break':routine?'routine':'study'})
   }
   if(rows.length>=100)break
  }
  previous=line
 }
 return rows
}

/** Parse simple college/work weekly tables: course, class name, weekdays, time and building/room. */
export function parseWeeklyCollegeSchedule(text:string,start:string,end:string,cycle:string[]):RotatingImportRow[]{
 const rows:RotatingImportRow[]=[]
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
 let columns:ClassColumns|null=null
 for(const line of lines){
  const header=classColumns(line.split(/\t|\s*\|\s*/))
  if(header){columns=header;continue}
  const found=columns&&classTableRow(line,columns,cycle)
  if(found){for(const day of found.days)rows.push({id:uid('import-block'),include:true,day,label:found.label,slot:found.code,start:found.start,end:found.end,dateStart:start,dateEnd:end,kind:'study',location:found.location});continue}
  if(/^weekly class schedule|^day, time|^course\s*\|/i.test(line))continue
  const cells=line.split(/\t+|\s*\|\s*/).map(x=>x.trim()).filter(Boolean)
  if(cells.length>=5){
   const timeCellIndex=cells.findIndex(cell=>/\b\d{1,2}:\d{2}\s*(?:AM|PM)\s*[-–—]\s*\d{1,2}:\d{2}\s*(?:AM|PM)\b/i.test(cell))
   if(timeCellIndex>=0){
    const time=cells[timeCellIndex].match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–—]\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i)
    const dayIndex=timeCellIndex-1,days=dayIndex>=0?weekdaysFrom(cells[dayIndex],cycle):[]
    if(time&&days.length){
     const course=cells[0]??'',name=cells[1]??'',building=cells[timeCellIndex+1]??'',room=cells[timeCellIndex+2]??''
     const label=[course,name].filter(Boolean).join(' · ').slice(0,200)
     const location=[building,room].filter(Boolean).join(' ').slice(0,160)
     for(const day of days)rows.push({id:uid('import-block'),include:true,day,label,slot:course,start:toTime(time[1],time[2],time[3]),end:toTime(time[4],time[5],time[6]),dateStart:start,dateEnd:end,kind:'study',location})
     continue
    }
   }
  }
  const free=line.match(/^([A-Z]{2,5}\s*\d{3}[A-Z0-9 -]*)\s+(.+?)\s+((?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s*(?:,|&|and|\/|\+)\s*(?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)\s*[-–—]\s*\d{1,2}:\d{2}\s*(?:AM|PM))\s+(.+)$/i)
  if(!free)continue
  const time=free[4].match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–—]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i),days=weekdaysFrom(free[3],cycle)
  if(!time||!days.length)continue
  const label=[free[1].trim(),free[2].trim()].join(' · ').slice(0,200)
  for(const day of days)rows.push({id:uid('import-block'),include:true,day,label,slot:free[1].trim(),start:toTime(time[1],time[2],time[3]),end:toTime(time[4],time[5],time[6]),dateStart:start,dateEnd:end,kind:'study',location:free[5].trim().slice(0,160)})
 }
 return rows
}
/** Apply reviewed rows to a copy; never partially mutate a draft on invalid input. */
export function addTimetableRows(season:StudySeason,rows:RotatingImportRow[]):StudySeason{
 const selected=rows.filter(r=>r.include)
 if(!selected.length)throw Error('Select at least one class to continue.')
 const next=structuredClone(season)
 for(const r of selected){
  if(!season.school?.cycle.includes(r.day)||!r.label.trim()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end)||r.end<=r.start||!r.dateStart||!r.dateEnd||r.dateStart<season.start||r.dateEnd>season.end||r.dateEnd<r.dateStart)throw Error('Check each selected class: rotation day, name, times and semester dates.')
  const blocks=next.week[r.day]
  if(blocks.some(b=>b.label.trim().toLowerCase()===r.label.trim().toLowerCase()&&b.start===r.start&&b.end===r.end&&(b.dateStart??season.start)===r.dateStart&&(b.dateEnd??season.end)===r.dateEnd))continue
  if(blocks.some(b=>b.start<r.end&&b.end>r.start&&(b.dateStart??season.start)<=r.dateEnd&&(b.dateEnd??season.end)>=r.dateStart))throw Error('An existing class overlaps '+r.label+' on '+r.day+'. Edit the conflicting entry before importing.')
  blocks.push({id:uid('block'),label:r.label.trim(),slot:r.slot,start:r.start,end:r.end,dateStart:r.dateStart,dateEnd:r.dateEnd,kind:r.kind,location:r.location?.trim()||undefined})
 }
 return next
}
