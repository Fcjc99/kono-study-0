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
 {id:'mcgill-winter-2027',label:'McGill · Winter 2027',kind:'college',revision:'2026-09-09',source:'McGill official key academic dates',url:'https://www.mcgill.ca/importantdates/key-dates'}
] as const
export function academicTemplate(profileId:string,id:string):StudySeason{
 const record=academicCatalog.find(r=>r.id===id)
 if(!record)throw Error('Unknown academic calendar.')
 if(record.kind==='school'){
  const preset=id==='marshfield-2026'?'marshfield':id==='hanover-2026'?'hanover':id==='silverlake-2026'?'silverlake':id==='duxbury-2026'?'duxbury':id==='scituate-2026'?'scituate':id==='plymouth-2026'?'plymouth':'nda'
  const s=schoolPreset(profileId,preset)
  return {...s,school:{...s.school!,catalogId:record.id,catalogRevision:record.revision}}
 }
 const winter=id==='mcgill-winter-2027',start=winter?'2027-01-05':'2026-08-31',end=winter?'2027-04-30':'2026-12-22'
 const exceptions:SchoolException[]=[]
 const add=(start:string,end:string,kind:SchoolException['kind'],label:string,cycleDay?:string)=>exceptions.push({id:'catalog:'+id+':'+start+':'+kind,start,end,kind,label,audience:'all',cycleDay})
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
 return {id:uid('college'),profileId,name:record.label,start,end,active:true,week:Object.fromEntries(dayNames.map(d=>[d,[]])),school:{pattern:'weekly',catalogId:id,catalogRevision:record.revision,name:'McGill University',program:'',grade:'other',cycle:[...dayNames],anchorDate:start,anchorDay:dayNames[new Date(start+'T12:00:00Z').getUTCDay()],weekdays:[1,2,3,4,5],snowAdvances:false,lastClassDate:winter?'2027-04-14':'2026-12-04',exceptions}}
}
/** Copy new catalog rules to a draft, retaining all student classes and non-catalog rules. */
export function refreshAcademicTemplate(season:StudySeason):StudySeason{
 if(!season.school?.catalogId)throw Error('No catalog linked.')
 const latest=academicTemplate(season.profileId,season.school.catalogId)
 if(!season.school.catalogId.startsWith('mcgill-'))throw Error('Review a new school template separately to preserve your custom dates.')
 return {...season,school:{...season.school,catalogRevision:latest.school!.catalogRevision,exceptions:[...season.school.exceptions.filter(e=>!e.id.startsWith('catalog:')),...latest.school!.exceptions]}}
}
