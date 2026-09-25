/** Reading headed class tables ("Class Name | Teacher | Day | Time | Building | Room"), shared by the
 * college setup and the PDF schedule importer. */
const weekdayAliases:Record<string,string>={
 monday:'Monday',mon:'Monday',m:'Monday',
 tuesday:'Tuesday',tue:'Tuesday',tues:'Tuesday',tu:'Tuesday',t:'Tuesday',
 wednesday:'Wednesday',wed:'Wednesday',w:'Wednesday',
 thursday:'Thursday',thu:'Thursday',thur:'Thursday',thurs:'Thursday',th:'Thursday',
 friday:'Friday',fri:'Friday',f:'Friday',
 saturday:'Saturday',sat:'Saturday',
 sunday:'Sunday',sun:'Sunday'
}
export const toTime=(hour:string,minute:string,ampm:string)=>{let h=Number(hour);if(h<1||h>12||Number(minute)>59)return '';h=h%12+(ampm.toLowerCase()==='pm'?12:0);return String(h).padStart(2,'0')+':'+minute}
// Splits on whitespace as well as comma/semicolon so single/double-letter college registrar codes
// like "T Th" (Tuesday, Thursday) or "M W F" tokenize the same as their comma-separated equivalents —
// a space-only list otherwise stayed one unmatched token and silently dropped the whole class.
export const weekdaysFrom=(value:string,cycle:string[])=>{
 const wanted=new Set(cycle),found:string[]=[]
 for(const raw of value.replace(/\b(and|&|\+|\/)\b/gi,',').replace(/[&/+]/g,',').split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean)){
  const key=raw.toLowerCase().replace(/\.$/,'')
  const day=weekdayAliases[key]??weekdayAliases[key.slice(0,3)]
  if(day&&wanted.has(day)&&!found.includes(day))found.push(day)
 }
 return found
}
export type ClassColumns={code?:number;name?:number;teacher?:number;day:number;time:number;building?:number;room?:number;location?:number}
/** Read a header row such as "Class Name | Teacher | Day | Time | Building | Room" into column roles. */
export function classColumns(cells:string[]):ClassColumns|null{
 const find=(test:RegExp)=>{const i=cells.findIndex(c=>test.test(c.trim()));return i<0?undefined:i}
 const day=find(/^(meeting )?days?$/i),time=find(/^(time|times|time slot|meeting time)$/i)
 if(day===undefined||time===undefined)return null
 const title=find(/^(class name|course title|course name|title|class|name)$/i),course=find(/^(course|course code|section|subject|class nbr|code)$/i)
 return {name:title??course,code:title!==undefined?course:undefined,teacher:find(/^(teacher|instructors?|professor|faculty)$/i),day,time,building:find(/^building$/i),room:find(/^room$/i),location:find(/^location$/i)}
}
/** "10:30 AM - 11:45 AM", "12:00 - 12:50 PM" (the start borrows the end's AM/PM), "1:05PM–2:25PM". */
export function timeRange(value:string){
 const m=value.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[-–—]\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i)
 if(!m)return null
 const end=toTime(m[4],m[5],m[6])
 let start=toTime(m[1],m[2],m[3]??m[6])
 if(!m[3]&&start>end)start=toTime(m[1],m[2],m[6].toUpperCase()==='PM'?'AM':'PM')
 return {start,end}
}
/** One row of a table whose header classColumns read: its weekdays, times, label and place. */
export function classTableRow(line:string,columns:ClassColumns,cycle:string[]){
 // Keep empty cells so every value stays under its own header.
 const cells=line.split(line.includes('\t')?'\t':/\s*\|\s*/).map(x=>x.trim()),cell=(i?:number)=>i===undefined?'':cells[i]??''
 const time=timeRange(cell(columns.time)),days=weekdaysFrom(cell(columns.day),cycle)
 if(!time||!time.start||!time.end||!days.length||time.end<=time.start)return null
 const code=cell(columns.code),name=cell(columns.name),label=[code,name].filter(Boolean).join(' · ').slice(0,200)
 if(!label)return null
 const place=columns.location!==undefined?cell(columns.location):[cell(columns.building),cell(columns.room)].filter(Boolean).join(' ')
 return {days,code,label,start:time.start,end:time.end,location:[place,cell(columns.teacher)].filter(Boolean).join(' · ').slice(0,160)}
}
