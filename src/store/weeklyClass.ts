import {blankWeek,dayNames,uid,normalizeData,type AppData} from './model'
import {addDays,dateNumber} from './studyScheduler'
import {classOccurrences} from './classSchedule'
export type WeeklyClassInput={title:string;subjectId:string;weekdays:number[];start:string;end:string;first:string;last:string;location:string;activity?:boolean}
export function weeklyClassDates(input:WeeklyClassInput){
 if(!input.title.trim()||input.title.length>200||input.location.length>200)throw Error('Enter a name of up to 200 characters.')
 const first=dateNumber(input.first),last=dateNumber(input.last)
 if(last<first||last-first>550)throw Error('Choose a date range of up to 550 days.')
 if(!input.weekdays.length||input.weekdays.some(n=>!Number.isInteger(n)||n<0||n>6))throw Error('Choose at least one weekday.')
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.end)||input.end<=input.start)throw Error('Choose a start time and a later end time.')
 const dates=[];for(let d=input.first;d<=input.last;d=addDays(d,1))if(input.weekdays.includes(new Date(d+'T12:00:00Z').getUTCDay()))dates.push(d)
 if(!dates.length)throw Error('No chosen weekdays fall inside these dates.')
 return dates
}
export function weeklyConflicts(data:AppData,input:WeeklyClassInput){
 return weeklyClassDates(input).flatMap(date=>classOccurrences(data,date).filter(c=>!c.block.skippedDates?.includes(date)&&!c.timePending&&(c.displayStart??c.block.start)<input.end&&(c.displayEnd??c.block.end)>input.start).map(c=>date+' · '+c.block.label))
}
export function addWeeklyClass(data:AppData,profileId:string,input:WeeklyClassInput,allowOverlap=false){
 if(data.activeProfileId!==profileId)throw Error('Your profile changed. Reopen the editor.')
 weeklyClassDates(input)
 if(input.subjectId&&!data.subjects.some(s=>s.id===input.subjectId&&s.profileId===profileId))throw Error('Choose a subject from this profile.')
 if(weeklyConflicts(data,input).length&&!allowOverlap)throw Error('This overlaps another activity. Review the warning before saving.')
 const duplicate=data.studySeasons.some(s=>!s.school&&s.profileId===profileId&&s.start===input.first&&s.end===input.last&&JSON.stringify(dayNames.flatMap((d,i)=>(s.week[d]??[]).some(b=>b.label===input.title.trim()&&b.start===input.start&&b.end===input.end)?[i]:[]))===JSON.stringify([...new Set(input.weekdays)].sort()))
 if(duplicate)throw Error('This weekly entry is already in your schedule.')
 const next=structuredClone(data);let subjectId=input.subjectId
 if(!subjectId&&!input.activity){const known=next.subjects.find(s=>s.profileId===profileId&&s.name.trim().toLowerCase()===input.title.trim().toLowerCase());subjectId=known?.id??uid('subject');if(!known)next.subjects.push({id:subjectId,profileId,name:input.title.trim(),color:'#4169a8',resources:[]})}
 const week=blankWeek()
 for(const index of new Set(input.weekdays))week[dayNames[index]].push({id:uid('block'),label:input.title.trim(),subjectId:subjectId||undefined,location:input.location,start:input.start,end:input.end,kind:input.activity?'routine':'study',dateStart:input.first,dateEnd:input.last})
 next.studySeasons.push({id:uid('weekly'),profileId,name:input.title.trim()+' · weekly',start:input.first,end:input.last,active:true,week})
 return normalizeData(next)
}
