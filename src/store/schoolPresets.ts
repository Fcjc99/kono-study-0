import {uid,dayNames,type StudySeason} from './model'
import type {SchoolException} from './schoolCalendar'
import {hanoverElevatorCycle} from './elevatorSchedule'
export function schoolPreset(profileId:string,preset:'blank'|'marshfield'|'nda'|'hanover'|'silverlake'):StudySeason{
 const nda=preset==='nda',hanover=preset==='hanover',silverlake=preset==='silverlake'
 const cycle=hanover?[...hanoverElevatorCycle]:nda?Array.from({length:6},(_,i)=>'Day '+(i+1)):silverlake?[...dayNames]:['A day','E day']
 const start=hanover?'2026-08-31':nda?'2026-09-09':silverlake?'2026-09-02':'2026-09-02',end=hanover?'2027-06-23':nda?'2027-06-11':silverlake?'2027-06-25':preset==='marshfield'?'2027-06-18':'2027-06-17'
 const exceptions:SchoolException[]=[]
 const add=(start:string,end:string,kind:SchoolException['kind'],label:string,audience:SchoolException['audience']='all')=>exceptions.push({id:uid('school-date'),start,end,kind,label,audience})
 if(hanover){
  for(const [a,b,label] of [['2026-09-04','2026-09-04','No school'],['2026-09-07','2026-09-07','Labor Day'],['2026-10-12','2026-10-12','Indigenous Peoples / Columbus Day'],['2026-11-03','2026-11-03','Election Day / staff development'],['2026-11-11','2026-11-11','Veterans Day'],['2026-11-26','2026-11-27','Thanksgiving break'],['2026-12-24','2027-01-01','Holiday break'],['2027-01-18','2027-01-18','Martin Luther King Jr. Day'],['2027-02-15','2027-02-19','Winter break'],['2027-03-26','2027-03-26','Good Friday'],['2027-04-19','2027-04-23','Spring break'],['2027-05-31','2027-05-31','Memorial Day'],['2027-06-18','2027-06-18','Juneteenth observed']])add(a,b,'holiday',label)
  for(const d of ['2026-10-06','2026-11-25','2026-12-23','2027-01-12','2027-02-02','2027-03-02','2027-04-06','2027-05-04','2027-06-01','2027-06-15'])add(d,d,'half','HHS early release · 7:55 AM–12:30 PM')
  for(const [d,label] of [['2026-11-02','End of term 1'],['2027-01-25','End of term 2'],['2027-04-07','End of term 3'],['2027-06-04','Graduation'],['2027-06-15','End of term 4 / last regular classes'],['2027-06-23','Tentative last day including five snow days']])add(d,d,'notice',label)
 }else if(preset==='marshfield'){
  for(const [a,b,label] of [['2026-09-04','2026-09-07','Labor Day weekend'],['2026-10-12','2026-10-12','October holiday'],['2026-11-03','2026-11-03','Professional development'],['2026-11-11','2026-11-11','Veterans Day'],['2026-11-26','2026-11-27','Thanksgiving break'],['2026-12-24','2027-01-01','December vacation'],['2027-01-18','2027-01-18','Martin Luther King Jr. Day'],['2027-02-15','2027-02-19','February vacation'],['2027-03-26','2027-03-26','Good Friday'],['2027-04-19','2027-04-23','April vacation'],['2027-05-31','2027-05-31','Memorial Day']])add(a,b,'holiday',label)
  add('2027-06-18','2027-06-18','holiday','Juneteenth observed')
  add('2026-11-25','2026-11-25','half','Thanksgiving early release');add('2026-12-23','2026-12-23','half','December early release')
 }else if(nda){
  for(const [a,b,label] of [['2026-10-12','2026-10-12','October holiday'],['2026-11-11','2026-11-11','Veterans Day'],['2026-11-23','2026-11-27','Conferences / Thanksgiving break'],['2026-12-21','2027-01-03','Christmas break'],['2027-01-18','2027-01-18','Martin Luther King Jr. Day'],['2027-02-15','2027-02-19','February break'],['2027-03-26','2027-03-26','Good Friday'],['2027-03-29','2027-03-29','Easter Monday'],['2027-04-19','2027-04-23','April break'],['2027-05-31','2027-05-31','Memorial Day'],['2027-06-03','2027-06-03','Reading day — no school'],['2027-06-10','2027-06-11','Teacher professional development']])add(a,b,'holiday',label)
  for(const d of ['2026-10-02','2026-11-13','2026-12-04','2027-01-08','2027-02-05','2027-03-05','2027-04-02','2027-05-07'])add(d,d,'half','St. Julie Day — half-day')
  add('2027-05-17','2027-05-17','holiday','Senior reading day','seniors');add('2027-05-18','2027-05-20','exam','Senior final exams','seniors')
  add('2027-06-04','2027-06-09','exam','Final exams — confirm exam timetable')
  for(const [d,label] of [['2026-11-04','End of quarter 1'],['2027-01-22','End of quarter 2'],['2027-04-02','End of quarter 3'],['2027-06-02','End of quarter 4 / last regular classes']])add(d,d,'notice',label)
 }else if(silverlake){
  // Source: Silver Lake Regional School District & Superintendency Union #31, 2026–2027 School Calendar (district-issued PDF).
  for(const [a,b,label] of [['2026-09-07','2026-09-07','Labor Day'],['2026-10-12','2026-10-12','Columbus Day'],['2026-11-03','2026-11-03','In-service Day (elections) — no school for students'],['2026-11-11','2026-11-11','Veterans Day'],['2026-11-26','2026-11-27','Thanksgiving recess'],['2026-12-24','2027-01-03','Holiday vacation (schools reopen Jan. 4)'],['2027-01-18','2027-01-18','Martin Luther King Jr. Day'],['2027-02-15','2027-02-19','Winter vacation'],['2027-02-22','2027-02-22','In-service Day — no school for students'],['2027-03-26','2027-03-26','Good Friday'],['2027-04-19','2027-04-23','Spring vacation'],['2027-05-31','2027-05-31','Memorial Day'],['2027-06-18','2027-06-18','Juneteenth observed']])add(a,b,'holiday',label)
  for(const d of ['2026-09-24','2026-10-22','2026-11-25','2026-12-23','2027-03-11','2027-03-18','2027-06-03'])add(d,d,'half','Early release · Gr. K-6 12:30 PM, Gr. 7-12 10:45 AM')
  add('2026-10-22','2026-10-22','notice','Parent conferences (K-6)');add('2027-03-18','2027-03-18','notice','Parent conferences (K-6)')
  add('2027-06-04','2027-06-04','notice','In-service Day (elections); SLRHS graduation (rain date June 5)')
  add('2027-06-22','2027-06-25','notice','Tentative last day of school — the district calendar lists both June 22 and June 25 for this; confirm with the district before relying on it')
 }
 return {id:uid('school'),profileId,name:preset==='blank'?'My school year':hanover?'Hanover High School 2026–27':nda?'NDA 2026–27':silverlake?'Silver Lake Regional 2026–27':'Marshfield 2026–27',start,end,active:true,week:Object.fromEntries(cycle.map(d=>[d,[]])),school:{pattern:hanover?'elevator':silverlake?'weekly':'rotation',name:preset==='blank'?'My school':hanover?'Hanover High School':nda?'Notre Dame Academy':silverlake?'Silver Lake Regional School District':'Marshfield',grade:'',cycle,anchorDate:start,anchorDay:hanover?'1A':silverlake?dayNames[new Date(start+'T12:00:00Z').getUTCDay()]:'',weekdays:[1,2,3,4,5],snowAdvances:hanover||silverlake?false:true,lastClassDate:hanover?'2027-06-15':nda?'2027-06-02':silverlake?'2027-06-21':'2027-06-17',exceptions}}
}
