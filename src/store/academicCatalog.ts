import {dayNames,uid,type StudySeason} from './model'
import {schoolPreset} from './schoolPresets'
import type {SchoolException} from './schoolCalendar'
export const academicCatalog=[
 {id:'marshfield-2026',label:'Marshfield · 2026–27',kind:'school',revision:'2026-09-09',source:'School calendar supplied for 2026–27',url:''},
 {id:'nda-2026',label:'NDA · 2026–27',kind:'school',revision:'2026-09-09',source:'School calendar supplied for 2026–27',url:''},
 {id:'hanover-2026',label:'Hanover High · Elevator 2026–27',kind:'school',revision:'2026-09-10',source:'Hanover calendar and elevator schedule supplied for 2026–27',url:''},
 {id:'silverlake-2026',label:'Silver Lake Regional · 2026–27',kind:'school',revision:'2026-09-12',source:'District-issued 2026-2027 School Calendar PDF (Silver Lake Regional School District & Superintendency Union #31)',url:''},
 {id:'duxbury-2026',label:'Duxbury Public Schools · 2026–27',kind:'school',revision:'2026-09-12',source:'District-issued 2026-2027 School Calendar PDF (Duxbury Public Schools)',url:''},
 {id:'scituate-2026',label:'Scituate Public Schools · 2026–27',kind:'school',revision:'2026-09-12',source:'District-issued 2026-2027 Calendar PDF (Scituate Public Schools, approved 11.17.25)',url:''},
 {id:'plymouth-2026',label:'Plymouth Public Schools · 2026–27',kind:'school',revision:'2026-09-12',source:'District-issued Academic Year 2026-2027 Calendar PDF (Plymouth Public Schools)',url:''},
 {id:'mcgill-fall-2026',label:'McGill · Fall 2026',kind:'college',revision:'2026-09-09',source:'McGill official key academic dates',url:'https://www.mcgill.ca/importantdates/key-dates'},
 {id:'mcgill-winter-2027',label:'McGill · Winter 2027',kind:'college',revision:'2026-09-09',source:'McGill official key academic dates',url:'https://www.mcgill.ca/importantdates/key-dates'},
 {id:'bc-fall-2026',label:'Boston College · Fall 2026',kind:'college',revision:'2026-09-15',source:'Boston College Office of Student Services academic calendar',url:'https://www.bc.edu/bc-web/offices/student-services/sites/academic-calendar.html'},
 {id:'bc-spring-2027',label:'Boston College · Spring 2027',kind:'college',revision:'2026-09-15',source:'Boston College Office of Student Services academic calendar',url:'https://www.bc.edu/bc-web/offices/student-services/sites/academic-calendar.html'}
] as const
export function academicTemplate(profileId:string,id:string):StudySeason{
 const record=academicCatalog.find(r=>r.id===id)
 if(!record)throw Error('Unknown academic calendar.')
 if(record.kind==='school'){
  const preset=id==='marshfield-2026'?'marshfield':id==='hanover-2026'?'hanover':id==='silverlake-2026'?'silverlake':id==='duxbury-2026'?'duxbury':id==='scituate-2026'?'scituate':id==='plymouth-2026'?'plymouth':'nda'
  const s=schoolPreset(profileId,preset)
  return {...s,school:{...s.school!,catalogId:record.id,catalogRevision:record.revision}}
 }
 const exceptions:SchoolException[]=[]
 const add=(start:string,end:string,kind:SchoolException['kind'],label:string,cycleDay?:string)=>exceptions.push({id:'catalog:'+id+':'+start+':'+kind,start,end,kind,label,audience:'all',cycleDay})
 let start:string,end:string,lastClassDate:string,schoolName:string
 if(id.startsWith('bc-')){
  const winter=id==='bc-spring-2027'
  start=winter?'2027-01-19':'2026-08-31'
  end=winter?'2027-05-18':'2026-12-21'
  lastClassDate=winter?'2027-05-06':'2026-12-10'
  schoolName='Boston College'
  if(winter){
   add('2027-01-28','2027-01-28','notice','Add/drop deadline')
   add('2027-02-20','2027-02-20','notice','Last date to drop a course with no "W" grade')
   add('2027-03-08','2027-03-13','holiday','Spring Vacation')
   add('2027-03-25','2027-03-25','holiday','Holy Thursday — no classes')
   add('2027-03-26','2027-03-26','holiday','Good Friday — no classes')
   add('2027-03-27','2027-03-28','holiday','Easter Weekend — no classes')
   add('2027-03-29','2027-03-29','half','Easter Monday — classes resume at 4:00 p.m.')
   add('2027-04-08','2027-04-08','notice','Last date to change course grading option')
   add('2027-04-19','2027-04-19','holiday',"Patriot's Day — no classes")
   add('2027-04-20','2027-04-20','makeup','Substitute Monday class schedule','Monday')
   add('2027-04-30','2027-04-30','notice','Last date for official withdrawal (with a "W" grade)')
   add('2027-05-07','2027-05-07','holiday','Study Day — no classes for undergraduate day students')
   add('2027-05-10','2027-05-10','half','Study day until 4:00 p.m. — final exams begin at 4:00 p.m. for undergraduate day students')
   add('2027-05-11','2027-05-18','exam','Term Examinations (no exams on Sunday) — add your individual exam dates')
  }else{
   add('2026-09-07','2026-09-07','holiday','Labor Day — no classes')
   add('2026-09-09','2026-09-09','notice','Last date to add/drop a course online')
   add('2026-09-10','2026-09-10','half','Mass of the Holy Spirit — classes canceled from noon to 1:15 p.m.')
   add('2026-10-08','2026-10-08','notice','Last date to drop a course with no "W" grade')
   add('2026-10-12','2026-10-12','holiday','Fall Break — no classes')
   add('2026-10-13','2026-10-13','makeup','Substitute Monday class schedule','Monday')
   add('2026-10-16','2026-10-16','half','Classes from 2:00 p.m. onward cancelled — Presidential Inauguration')
   add('2026-11-07','2026-11-07','notice','Last date to change course grading option')
   add('2026-11-25','2026-11-27','holiday','Thanksgiving Holidays')
   add('2026-12-01','2026-12-01','notice','Last date for official withdrawal (with a "W" grade)')
   add('2026-12-11','2026-12-11','holiday','Study Day — no classes for undergraduate day students')
   add('2026-12-14','2026-12-21','exam','Term Examinations (no exams on Sunday) — add your individual exam dates')
  }
 }else{
  const winter=id==='mcgill-winter-2027'
  start=winter?'2027-01-05':'2026-08-31'
  end=winter?'2027-04-30':'2026-12-22'
  lastClassDate=winter?'2027-04-14':'2026-12-04'
  schoolName='McGill University'
  if(winter){
   add('2027-03-01','2027-03-05','holiday','Reading break — check program exceptions')
   add('2027-03-26','2027-03-26','holiday','Good Friday')
   add('2027-03-29','2027-03-29','holiday','Easter Monday')
   add('2027-04-13','2027-04-13','makeup','Friday timetable replaces Tuesday','Friday')
   add('2027-04-14','2027-04-14','makeup','Monday timetable replaces Wednesday','Monday')
   add('2027-04-16','2027-04-30','exam','Exam period — add your individual exam dates')
   for(const [date,label] of [['2027-01-19','Add/drop deadline'],['2027-01-26','Withdrawal with refund deadline'],['2027-02-23','Withdrawal without refund deadline']])add(date,date,'notice',label)
  }else{
   add('2026-09-07','2026-09-07','holiday','Labour Day')
   add('2026-10-05','2026-10-05','holiday','Election-day cancellation — check program exceptions')
   add('2026-10-09','2026-10-14','holiday','Reading break / Thanksgiving — check program exceptions')
   add('2026-12-03','2026-12-03','makeup','Monday timetable replaces Thursday','Monday')
   add('2026-12-07','2026-12-22','exam','Exam period — add your individual exam dates')
   for(const [date,label] of [['2026-09-15','Add/drop deadline'],['2026-09-22','Withdrawal with refund deadline'],['2026-10-27','Withdrawal without refund deadline']])add(date,date,'notice',label)
  }
 }
 return {id:uid('college'),profileId,name:record.label,start,end,active:true,week:Object.fromEntries(dayNames.map(d=>[d,[]])),school:{pattern:'weekly',catalogId:id,catalogRevision:record.revision,name:schoolName,program:'',grade:'other',cycle:[...dayNames],anchorDate:start,anchorDay:dayNames[new Date(start+'T12:00:00Z').getUTCDay()],weekdays:[1,2,3,4,5],snowAdvances:false,lastClassDate,exceptions}}
}
/** Copy new catalog rules to a draft, retaining all student classes and non-catalog rules. */
export function refreshAcademicTemplate(season:StudySeason):StudySeason{
 if(!season.school?.catalogId)throw Error('No catalog linked.')
 const latest=academicTemplate(season.profileId,season.school.catalogId)
 if(!season.school.catalogId.startsWith('mcgill-')&&!season.school.catalogId.startsWith('bc-'))throw Error('Review a new school template separately to preserve your custom dates.')
 return {...season,school:{...season.school,catalogRevision:latest.school!.catalogRevision,exceptions:[...season.school.exceptions.filter(e=>!e.id.startsWith('catalog:')),...latest.school!.exceptions]}}
}
