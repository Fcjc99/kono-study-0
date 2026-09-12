import {uid,dayNames,type StudySeason} from './model'
import type {SchoolException} from './schoolCalendar'
import {hanoverElevatorCycle} from './elevatorSchedule'
export function schoolPreset(profileId:string,preset:'blank'|'marshfield'|'nda'|'hanover'|'silverlake'|'duxbury'|'scituate'|'plymouth'):StudySeason{
 const nda=preset==='nda',hanover=preset==='hanover',silverlake=preset==='silverlake',duxbury=preset==='duxbury',scituate=preset==='scituate',plymouth=preset==='plymouth'
 const weeklyPreset=silverlake||duxbury||scituate||plymouth
 const cycle=hanover?[...hanoverElevatorCycle]:nda?Array.from({length:6},(_,i)=>'Day '+(i+1)):weeklyPreset?[...dayNames]:['A day','E day']
 const start=hanover?'2026-08-31':nda?'2026-09-09':plymouth?'2026-08-27':'2026-09-02'
 const end=hanover?'2027-06-23':nda?'2027-06-11':(silverlake||scituate)?'2027-06-25':duxbury?'2027-06-24':plymouth?'2027-06-23':preset==='marshfield'?'2027-06-18':'2027-06-17'
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
 }else if(duxbury){
  // Source: Duxbury Public Schools, 2026-2027 School Calendar (district-issued PDF).
  for(const [a,b,label] of [['2026-09-07','2026-09-07','Labor Day'],['2026-10-12','2026-10-12','Columbus Day'],['2026-11-03','2026-11-03','No school — Teacher PD'],['2026-11-11','2026-11-11','Veterans Day'],['2026-11-26','2026-11-27','Thanksgiving recess'],['2026-12-24','2026-12-31','Winter recess'],['2027-01-01','2027-01-01','New Year’s Day'],['2027-01-18','2027-01-18','Martin Luther King Jr. Day'],['2027-02-15','2027-02-19','February break'],['2027-03-26','2027-03-26','Good Friday'],['2027-04-19','2027-04-23','April break'],['2027-05-31','2027-05-31','Memorial Day'],['2027-06-18','2027-06-18','Juneteenth holiday (observed)']])add(a,b,'holiday',label)
  for(const d of ['2026-10-09','2026-11-25','2026-12-23','2027-01-15','2027-05-13','2027-06-03'])add(d,d,'half','District-wide early release — Teacher PD')
  for(const [a,b] of [['2026-09-24','2026-09-24'],['2026-10-21','2026-10-22'],['2027-03-11','2027-03-11'],['2027-03-31','2027-03-31'],['2027-04-01','2027-04-01']])add(a,b,'notice','Early release — Chandler/Alden only')
  add('2026-11-19','2026-11-19','notice','Early release — Duxbury Middle School only')
  add('2027-06-05','2027-06-05','notice','DHS Graduation')
  add('2027-06-16','2027-06-16','notice','Last day of school (early release)')
  add('2027-06-24','2027-06-24','notice','Tentative last day of school if all 5 built-in snow days are used')
 }else if(scituate){
  // Source: Scituate Public Schools, 2026-2027 Calendar (district-issued PDF, approved 11.17.25).
  for(const [a,b,label] of [['2026-09-04','2026-09-04','No school — teachers & students'],['2026-09-07','2026-09-07','Labor Day'],['2026-10-12','2026-10-12','Indigenous Peoples’ Day'],['2026-11-03','2026-11-03','Election Day'],['2026-11-11','2026-11-11','Veterans Day'],['2026-11-26','2026-11-27','Thanksgiving break'],['2026-12-24','2026-12-31','December break'],['2027-01-01','2027-01-01','New Year’s Day'],['2027-01-18','2027-01-18','Martin Luther King Jr. Day'],['2027-02-15','2027-02-15','Presidents’ Day'],['2027-02-16','2027-02-19','February break'],['2027-03-15','2027-03-15','Educator professional development — no school'],['2027-03-26','2027-03-26','Good Friday'],['2027-04-19','2027-04-19','Patriots’ Day'],['2027-04-20','2027-04-23','April break'],['2027-05-31','2027-05-31','Memorial Day']])add(a,b,'holiday',label)
  add('2026-11-25','2026-11-25','half','Half day · Grades K-12')
  add('2026-12-15','2026-12-15','half','Half day · Grades K-12 (Parent/Teacher conferences)')
  add('2026-12-23','2026-12-23','half','Half day · Grades K-12')
  add('2027-06-18','2027-06-18','half','Half day · Grades K-11 — last day of school (180 days)')
  add('2026-09-08','2026-09-08','notice','First day · Grades PK-K (Grades 1-12 start Sep 2)')
  add('2027-06-04','2027-06-04','notice','SHS Graduation')
  add('2027-06-25','2027-06-25','notice','Tentative last day (185 days) if all 5 snow days are used')
 }else if(plymouth){
  // Source: Plymouth Public Schools, Academic Year 2026-2027 Calendar (district-issued PDF).
  for(const [a,b,label] of [['2026-09-01','2026-09-01','State primary election — no school'],['2026-09-04','2026-09-04','No school'],['2026-09-07','2026-09-07','Labor Day'],['2026-10-12','2026-10-12','Indigenous Peoples’ Day'],['2026-11-03','2026-11-03','No school for students — full PD day for staff'],['2026-11-11','2026-11-11','Veterans Day'],['2026-11-25','2026-11-27','Thanksgiving holiday recess'],['2026-12-24','2026-12-31','Holiday recess'],['2027-01-01','2027-01-01','Holiday recess — New Year’s Day'],['2027-01-18','2027-01-18','Martin Luther King Jr. Day'],['2027-02-15','2027-02-19','Winter recess'],['2027-03-26','2027-03-26','No school — Good Friday'],['2027-04-19','2027-04-23','Spring recess'],['2027-05-31','2027-05-31','Memorial Day'],['2027-06-18','2027-06-18','Juneteenth observed']])add(a,b,'holiday',label)
  for(const d of ['2026-09-16','2026-10-14','2026-12-02','2026-12-09','2026-12-23','2027-01-13','2027-02-03','2027-03-03','2027-03-17','2027-04-14','2027-05-05'])add(d,d,'half','Professional development / conferences — half day')
  add('2027-06-15','2027-06-15','half','Last day of school — half day, report cards all grades')
  add('2026-08-28','2026-08-28','notice','First day · Kindergarten (Grades 1-12 start Aug 27)')
  add('2026-09-25','2026-09-25','notice','Mid-term · Grades 6-12')
  add('2026-12-11','2026-12-11','notice','Mid-term · Grades 6-12')
  add('2027-01-22','2027-01-22','notice','First semester ends')
  add('2027-03-05','2027-03-05','notice','Mid-term · Grades 6-12')
  add('2027-05-14','2027-05-14','notice','Mid-term · Grades 6-12')
  add('2027-05-28','2027-05-28','notice','Last day for seniors','seniors')
  add('2027-06-05','2027-06-05','notice','Graduation Day')
  add('2027-06-16','2027-06-17','notice','Make-up days, if necessary')
  add('2027-06-21','2027-06-23','notice','Make-up days, if necessary')
 }
 const name=preset==='blank'?'My school year':hanover?'Hanover High School 2026–27':nda?'NDA 2026–27':silverlake?'Silver Lake Regional 2026–27':duxbury?'Duxbury Public Schools 2026–27':scituate?'Scituate Public Schools 2026–27':plymouth?'Plymouth Public Schools 2026–27':'Marshfield 2026–27'
 const schoolName=preset==='blank'?'My school':hanover?'Hanover High School':nda?'Notre Dame Academy':silverlake?'Silver Lake Regional School District':duxbury?'Duxbury Public Schools':scituate?'Scituate Public Schools':plymouth?'Plymouth Public Schools':'Marshfield'
 const lastClassDate=hanover?'2027-06-15':nda?'2027-06-02':silverlake?'2027-06-21':duxbury?'2027-06-16':scituate?'2027-06-18':plymouth?'2027-06-15':'2027-06-17'
 return {id:uid('school'),profileId,name,start,end,active:true,week:Object.fromEntries(cycle.map(d=>[d,[]])),school:{pattern:hanover?'elevator':weeklyPreset?'weekly':'rotation',name:schoolName,grade:'',cycle,anchorDate:start,anchorDay:hanover?'1A':weeklyPreset?dayNames[new Date(start+'T12:00:00Z').getUTCDay()]:'',weekdays:[1,2,3,4,5],snowAdvances:hanover||weeklyPreset?false:true,lastClassDate,exceptions}}
}
