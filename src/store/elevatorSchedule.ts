import {uid,type ScheduleBlock,type WeekSchedule} from './model'

export const hanoverElevatorCycle=['1A','2B','3A','4B','5A','6B','7A','1B','2A','3B','4A','5B','6A','7B'] as const
export const hanoverBellTimes=[['07:55','08:47'],['08:52','09:39'],['09:44','10:31'],['10:36','11:23'],['11:23','12:47'],['12:52','13:39'],['13:44','14:30']] as const
export const hanoverLunchTimes={1:['11:23','11:52'],2:['11:55','12:19'],3:['12:22','12:47']} as const
export type ElevatorCourse={label:string;location:string;lunchWave:1|2|3;subjectId?:string}
const cleanCourse=(course:Partial<ElevatorCourse>|undefined,index:number):ElevatorCourse=>{
 if(!course||typeof course!=='object')throw Error(`Course ${index+1} is missing. Enter all seven Hanover courses before building.`)
 const label=String(course.label??'').trim()
 if(!label)throw Error(`Course ${index+1} needs a class name before building.`)
 const lunchWave=course.lunchWave===2||course.lunchWave===3?course.lunchWave:1
 return {label,location:String(course.location??'').trim(),lunchWave,subjectId:course.subjectId||undefined}
}

/** Read the seven-row Course Key used by Hanover's elevator schedule export. */
export function parseHanoverElevatorCourses(text:string):ElevatorCourse[]{
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
 const start=lines.findIndex(x=>/^course key$/i.test(x)),stop=lines.findIndex((x,i)=>i>start&&/^block$/i.test(x))
 const section=lines.slice(start<0?0:start+1,stop<0?lines.length:stop),courses:ElevatorCourse[]=[]
 for(let i=0;i<section.length;i++){
  if(!/^[1-7]$/.test(section[i]))continue
  const label=section[i+1]??'',teacher=section[i+2]??'',room=section[i+3]??'',code=section[i+4]??'',lunch=section[i+5]?.match(/^Lunch\s+([123])$/i)
  if(!label||!teacher||!/^HS\w+/i.test(room)||!/^\d{3,4}-\d{2}$/.test(code)||!lunch)continue
  courses.push({label,location:[room,teacher,code].join(' · '),lunchWave:Number(lunch[1]) as 1|2|3})
  i+=5
 }
 if(courses.length===7)return courses
 // Full two-page grid: reconstruct the seven base courses from 1A, then learn
 // each course's lunch wave from whichever elevator day places it fifth.
 type Seen={day:string;slot:number;label:string;location:string;lunchWave?:1|2|3}
 const seen:Seen[]=[];let day=''
 for(let i=0;i<lines.length;i++){
  if(/^[1-7][AB]$/.test(lines[i])){day=lines[i];continue}
  const block=lines[i].match(/^([1-7])\s*\|\s*\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}$/)
  if(!day||!block)continue
  const label=lines[i+1]??'',teacher=lines[i+2]??'',place=(lines[i+3]??'').match(/^(HS\w+)\s*\|\s*(\d{3,4}-\d{2})$/i)
  if(!label||!teacher||!place)continue
  const lunch=Number(block[1])===5?(lines[i+4]??'').match(/^Lunch\s+([123])\s*:/i):null
  seen.push({day,slot:Number(block[1]),label,location:[place[1],teacher,place[2]].join(' · '),lunchWave:lunch?Number(lunch[1]) as 1|2|3:undefined})
 }
 const first=seen.filter(x=>x.day==='1A').sort((a,b)=>a.slot-b.slot),order=[0,1,2,6,4,5,3],result:Array<ElevatorCourse|undefined>=Array(7)
 for(let slot=0;slot<first.length;slot++){const row=first[slot],lunchWave=seen.find(x=>x.label===row.label&&x.slot===5)?.lunchWave;result[order[slot]]={label:row.label,location:row.location,lunchWave:lunchWave??1}}
 if(result.some(x=>!x))throw Error(`KONO found ${first.length} of 7 classes in the Hanover grid. Try the original PDF rather than a screenshot, or enter the missing courses below.`)
 return result as ElevatorCourse[]
}

const firstOrder=[0,1,2,6,4,5,3]
export function buildElevatorWeek(courses:ElevatorCourse[]):WeekSchedule{
 if(courses.length!==7)throw Error(`Enter all seven Hanover classes before building. KONO currently has ${courses.length}.`)
 const clean=courses.map(cleanCourse)
 return Object.fromEntries(hanoverElevatorCycle.map(label=>{
  const number=Number(label[0]),order=firstOrder.map((_,i)=>firstOrder[(i+number-1)%7])
  const blocks:ScheduleBlock[]=order.map((courseIndex,slot)=>({id:uid('elevator'),label:clean[courseIndex].label,location:clean[courseIndex].location||undefined,subjectId:clean[courseIndex].subjectId,slot:String(slot+1),start:hanoverBellTimes[slot][0],end:hanoverBellTimes[slot][1],kind:'study',fullYear:true,occurrenceNotes:{},completedDates:[],skippedDates:[]}))
  const fifth=clean[order[4]],lunch=hanoverLunchTimes[fifth.lunchWave]
  blocks.push({id:uid('lunch'),label:`Lunch ${fifth.lunchWave}`,slot:'Lunch',start:lunch[0],end:lunch[1],kind:'break',fullYear:true,occurrenceNotes:{},completedDates:[],skippedDates:[]})
  return [label,blocks.sort((a,b)=>a.start.localeCompare(b.start))]
 }))
}
