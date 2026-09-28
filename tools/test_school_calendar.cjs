// Actual application functions with isolated fixtures; no browser or user-data writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console})
 return module.exports
}


const model=load('src/store/model.ts'),{schoolDay,validateSchool}=load('src/store/schoolCalendar.ts'),{schoolPreset}=load('src/store/schoolPresets.ts'),{classOccurrences,nextClassDate,saveClassNote}=load('src/store/classSchedule.ts'),{suggestSchoolDates,suggestRotatingClasses,parseWeeklyCollegeSchedule,addTimetableRows}=load('src/store/schoolImport.ts'),{mergeData}=load('src/store/merge.ts')
const {buildElevatorWeek,hanoverElevatorCycle,parseHanoverElevatorCourses}=load('src/store/elevatorSchedule.ts')
let passed=0
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function fixture(type='blank'){
 const data=model.createFreshData(),s=schoolPreset(data.activeProfileId,type);s.school.anchorDay=s.school.cycle[0];s.school.grade='11';data.studySeasons=[s];return {data,s}
}
const rule=(start,kind='holiday',end=start)=>({id:randomUUID(),start,end,kind,label:kind,audience:'all'})
test('A/E alternates over school days, not weekdays',()=>{const {s}=fixture();assert.equal(schoolDay(s,'2026-09-02').cycleDay,'A day');assert.equal(schoolDay(s,'2026-09-03').cycleDay,'E day');assert.equal(schoolDay(s,'2026-09-05').closed,true);assert.equal(schoolDay(s,'2026-09-07').cycleDay,'E day')})
test('Holiday pauses; snow consumes the canceled turn',()=>{const {s}=fixture();s.school.exceptions=[rule('2026-09-03')];assert.equal(schoolDay(s,'2026-09-04').cycleDay,'E day');const snow=structuredClone(s);snow.school.exceptions=[rule('2026-09-03','snow')];assert.equal(schoolDay(snow,'2026-09-03').closed,true);assert.equal(schoolDay(snow,'2026-09-04').cycleDay,'A day');const paused=structuredClone(snow);paused.school.snowAdvances=false;assert.equal(schoolDay(paused,'2026-09-04').cycleDay,'E day')})
test('Holiday weekend does not double count closed days',()=>{const {s}=fixture('marshfield');assert.equal(schoolDay(s,'2026-09-08').cycleDay,'A day')})
test('Known anchor can start in the middle of the year',()=>{const {s}=fixture();s.school.anchorDate='2026-09-04';s.school.anchorDay='A day';assert.equal(schoolDay(s,'2026-09-02').cycleDay,'A day');assert.equal(schoolDay(s,'2026-09-03').cycleDay,'E day');assert.equal(schoolDay(s,'2026-09-04').cycleDay,'A day')})
test('School correction resets following days and weekend makeup advances',()=>{const {s}=fixture();s.school.exceptions=[{...rule('2026-09-05','makeup'),cycleDay:'A day'}];assert.equal(schoolDay(s,'2026-09-05').cycleDay,'A day');assert.equal(schoolDay(s,'2026-09-07').cycleDay,'E day')})
test('Both supplied school templates validate without student personal information',()=>{for(const type of ['marshfield','nda']){const {s,data}=fixture(type);validateSchool(s.school,s.start,s.end);assert.equal(model.normalizeData(data).studySeasons[0].school.name,s.school.name);assert.ok(!JSON.stringify(s).includes('@'));assert.ok(!JSON.stringify(s).includes('locker'))}})
test('NDA Day 2 and Day 5 remain distinct',()=>{const {s,data}=fixture('nda');s.week['Day 2']=[{id:'advisory',label:'Advisory',start:'09:56',end:'10:23',kind:'routine'}];s.week['Day 5']=[{id:'club',label:'Clubs',start:'09:56',end:'10:23',kind:'hobby'}];assert.equal(classOccurrences(data,'2026-09-10')[0].block.label,'Advisory');assert.equal(classOccurrences(data,'2026-09-15')[0].block.label,'Clubs')})
test('Senior-only closure does not close grade 11',()=>{const {s}=fixture('nda');assert.equal(schoolDay(s,'2027-05-17').closed,false);const senior=structuredClone(s);senior.school.grade='12';assert.equal(schoolDay(senior,'2027-05-17').closed,true)})
test('Last regular classes differs from final exams and teacher days',()=>{const {s}=fixture('nda');assert.equal(schoolDay(s,'2027-06-03').closed,true);assert.equal(schoolDay(s,'2027-06-04').closed,false);assert.equal(schoolDay(s,'2027-06-10').closed,true)})
test('Half-day times are flagged until confirmed; notes use original block',()=>{const {data,s}=fixture();s.school.exceptions=[rule('2026-09-02','half')];s.week['A day']=[{id:'b',slot:'A',label:'Biology',start:'08:00',end:'09:24',kind:'study'}];assert.equal(classOccurrences(data,'2026-09-02')[0].timePending,true);const confirmed=structuredClone(data);confirmed.studySeasons[0].school.exceptions[0].bells={A:{start:'08:00',end:'08:40'}};const item=classOccurrences(confirmed,'2026-09-02')[0];assert.equal(item.displayEnd,'08:40');assert.equal(item.block.end,'09:24');assert.equal(item.timePending,false);const saved=saveClassNote(confirmed,item,'Bring book');assert.equal(saved.studySeasons[0].week['A day'][0].occurrenceNotes['2026-09-02'],'Bring book')})
test('Exam days never invent normal classes without an exam bell assignment',()=>{const {data,s}=fixture();s.school.exceptions=[rule('2026-09-02','exam')];s.week['A day']=[{id:'b',slot:'A',label:'Biology',start:'08:00',end:'09:24',kind:'study'}];assert.equal(classOccurrences(data,'2026-09-02').length,0)})
test('Semester replacements and next-class reminders follow actual rotation',()=>{const {data,s}=fixture();s.week['A day']=[{id:'health',label:'Health',start:'08:00',end:'09:24',kind:'study',dateStart:'2026-09-02',dateEnd:'2026-09-03'},{id:'art',label:'Art',start:'08:00',end:'09:24',kind:'study',dateStart:'2026-09-04',dateEnd:'2027-06-17'}];assert.equal(classOccurrences(data,'2026-09-02')[0].block.label,'Health');assert.equal(classOccurrences(data,'2026-09-04')[0].block.label,'Art');assert.equal(nextClassDate(classOccurrences(data,'2026-09-04')[0]),'2026-09-08');assert.equal(nextClassDate(classOccurrences(data,'2026-09-02')[0]),undefined)})
test('No classes outside year, inactive school or foreign profile',()=>{const {data,s}=fixture();s.week['A day']=[{id:'b',label:'Biology',start:'08:00',end:'09:00',kind:'study'}];assert.equal(classOccurrences(data,'2026-08-31').length,0);s.active=false;assert.equal(classOccurrences(data,'2026-09-02').length,0);s.active=true;data.activeProfileId='foreign';assert.equal(classOccurrences(data,'2026-09-02').length,0)})
test('Reject invalid anchor, conflicting rules, malformed times and long years',()=>{const {s}=fixture();for(const mutate of [c=>c.anchorDay='',c=>c.anchorDate='2026-09-05',c=>c.exceptions=[rule('2026-09-03'),rule('2026-09-03','snow')],c=>c.exceptions=[{...rule('2026-09-03','half'),bells:{A:{start:'09:00',end:'08:00'}}}]]){const c=structuredClone(s.school);mutate(c);assert.throws(()=>validateSchool(c,s.start,s.end))}assert.throws(()=>validateSchool(s.school,s.start,'2030-06-01'))})
test('Quarter notice does not override half-day rule',()=>{const {s}=fixture('nda');const d=schoolDay(s,'2027-04-02');assert.equal(d.special,true);assert.match(d.label,/quarter 3/)})
test('School data survives backup normalization and independent edits merge',()=>{const {data}=fixture();const b=model.normalizeData(data),l=structuredClone(b),r=structuredClone(b);l.studySeasons[0].school.exceptions.push(rule('2026-10-01'));r.studySeasons[0].school.exceptions.push(rule('2026-10-02'));const m=mergeData(b,l,r);assert.equal(m.conflicts.length,0);assert.equal(m.data.studySeasons[0].school.exceptions.length,2)})
test('Calendar OCR yields unchecked cross-year and reverse-date suggestions',()=>{const rows=suggestSchoolDates('Dec 21 – Jan 3 Christmas Break (No School)\n15 - 19 FEBRUARY VACATION\nMay 17 Senior Reading Day (No School)','2026-09-01','2027-06-30');assert.equal(rows.length,3);assert.ok(rows.every(r=>!r.include));assert.equal(rows[0].start,'2026-12-21');assert.equal(rows[0].end,'2027-01-03');assert.equal(rows[1].start,'2027-02-15');assert.equal(rows[1].end,'2027-02-19');assert.equal(rows[2].audience,'seniors')})
test('Timetable OCR refuses guessed AM/PM or grid columns',()=>{const rows=suggestRotatingClasses('Biology\n7:50 - 8:50 (Period A)\nDay 2\nEnglish 1:00pm - 2:00pm (Period G)',['Day 1','Day 2'],'2026-09-01','2027-06-01');assert.equal(rows.length,2);assert.equal(rows[0].day,'');assert.equal(rows[0].start,'');assert.equal(rows[1].day,'Day 2');assert.equal(rows[1].start,'13:00');assert.ok(rows.every(r=>!r.include))})
test('Weekly college PDF table becomes weekday semester classes with locations',()=>{const text='Weekly Class Schedule\nCourse | Class Name | Day | Time | Building | Room\nPSYC 305-001 | Statistics for Experimental Design | Monday & Wednesday | 10:05 AM - 11:25 AM | Adams Building | AUD\nPSYC 213-001 | Cognition | Tuesday & Thursday | 1:05 PM - 2:25 PM | Macdonald-Harrington Building | G-10\nPSYC 444-001 | Sleep Mechanisms and Behaviour | Monday & Wednesday | 2:35 PM - 3:55 PM | McIntyre Medical Building | 522\nPHIL 306-001 | Philosophy of Mind | Tuesday & Thursday | 4:05 PM - 5:25 PM | Burnside Hall | 1B45\nPSYC 337-001 | Introduction to Psychopathology | Monday & Wednesday | 4:35 PM - 5:55 PM | Adams Building | AUD',cycle=['Monday','Tuesday','Wednesday','Thursday','Friday'],rows=parseWeeklyCollegeSchedule(text,'2026-09-01','2026-12-15',cycle);assert.equal(rows.length,10);assert.ok(rows.every(r=>r.include&&r.kind==='study'));assert.equal(rows[0].day,'Monday');assert.equal(rows[1].day,'Wednesday');assert.equal(rows[2].start,'13:05');assert.equal(rows[2].end,'14:25');assert.equal(rows[0].label,'PSYC 305-001 · Statistics for Experimental Design');assert.equal(rows[0].location,'Adams Building AUD');const {s}=fixture('weekly');s.start='2026-09-01';s.end='2026-12-15';s.school.lastClassDate='2026-12-15';s.school.cycle=cycle;s.week=Object.fromEntries(cycle.map(day=>[day,[]]));const ready=addTimetableRows(s,rows);assert.equal(ready.week.Monday.length,3);assert.equal(ready.week.Tuesday.length,2);assert.equal(ready.week.Monday[0].location,'Adams Building AUD');assert.equal(ready.week.Thursday[1].label,'PHIL 306-001 · Philosophy of Mind')})
test('A PDF class table with wrapped cells (day, time and building on two lines) still becomes one class per meeting day',()=>{
 const {pdfClassTableText}=load('src/store/pdfTimetableText.ts')
 const at=(str,x,y)=>({str,transform:[10,0,0,10,x,y],width:str.length*5})
 const items=[at('Class Schedule',41,552),at('Class Name',50,498),at('Teacher',210,498),at('Day',338,498),at('Time',435,498),at('Building',534,498),at('Room',624,498),
  at('Intro to Ecology',50,457),at('Rivera, Ana',210,457),at('Tuesday &',338,463),at('Thursday',338,451),at('12:00 PM - 1:15 PM',435,457),at('North Hall',534,457),at('235',624,457),
  at('Corporate Finance',50,405),at('Okafor, Ben',210,405),at('Tuesday &',338,411),at('Thursday',338,399),at('3:00 PM - 4:15 PM',435,405),at('245 Beacon',534,411),at('Street',534,399),at('102',624,405),
  at('Ethics Seminar',50,308),at('(Lecture)',50,296),at('Chen, Li;',210,308),at('Park, Jo',210,296),at('Tuesday &',338,308),at('Thursday',338,296),at('10:30 AM - 11:45',435,308),at('AM',435,296),at('South Hall',534,302),at('204',624,302),
  at('Ethics Seminar',50,256),at('(Discussion)',50,244),at('Park, Jo',210,250),at('Monday',338,250),at('12:00 - 12:50',435,256),at('PM',435,244),at('West Hall',534,250),at('141N',624,250),
  at('The Monday discussion is listed separately.',41,208)]
 const text=pdfClassTableText(items)
 assert.ok(text.includes('Tuesday & Thursday\t10:30 AM - 11:45 AM\tSouth Hall\t204'))
 const cycle=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],rows=parseWeeklyCollegeSchedule(text,'2026-08-31','2026-12-21',cycle)
 assert.equal(rows.length,7)
 const finance=rows.filter(r=>r.label==='Corporate Finance')
 assert.equal(finance.map(r=>r.day).join(','),'Tuesday,Thursday');assert.equal(finance[0].start,'15:00');assert.equal(finance[0].end,'16:15');assert.equal(finance[0].location,'245 Beacon Street 102 · Okafor, Ben')
 const lecture=rows.find(r=>r.label==='Ethics Seminar (Lecture)');assert.equal(lecture.start,'10:30');assert.equal(lecture.end,'11:45')
 const discussion=rows.filter(r=>r.label==='Ethics Seminar (Discussion)');assert.equal(discussion.length,1);assert.equal(discussion[0].day,'Monday');assert.equal(discussion[0].start,'12:00');assert.equal(discussion[0].end,'12:50')
 assert.ok(rows.every(r=>!r.label.includes('Rivera')&&r.kind==='study'))
 assert.equal(pdfClassTableText([at('Physics',50,500),at('8:00 - 9:24 AM',200,500)]),null)
})
test('Registrar-style single/double-letter day codes (T Th, M) parse like spelled-out weekdays',()=>{const text='Section\tCourse Title\tFormat\tDays\tTime Slot\tBuilding\tRoom\tInstructors\tCredits\tGrading\nAPSY3244 02\tAdult Development and Aging\tLecture\tT Th\t12:00 PM - 01:15 PM\tCampion Hall\t235\tLerner, Jacqueline V\t3.0\tLetter\nPHIL1088 21\tPerson and Social Responsibility I\tDiscussion\tM\t12:00 PM - 12:50 PM\tStokes Hall\t141N\tKruger, Matthew C\t\t',cycle=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],rows=parseWeeklyCollegeSchedule(text,'2026-08-31','2026-12-21',cycle);assert.equal(rows.length,3);assert.ok(rows.some(r=>r.day==='Tuesday'&&r.label.includes('Adult Development')&&r.start==='12:00'&&r.end==='13:15'));assert.ok(rows.some(r=>r.day==='Thursday'&&r.label.includes('Adult Development')));assert.ok(rows.some(r=>r.day==='Monday'&&r.label.includes('Person and Social')&&r.start==='12:00'&&r.end==='12:50'))})
test('Full-year classes follow announced makeup dates, semester classes do not',()=>{const {data,s}=fixture();s.end='2027-06-21';s.school.exceptions=[rule('2027-06-21','makeup')];s.week['A day']=[{id:'fy',label:'Full year',fullYear:true,start:'08:00',end:'09:00',kind:'study',dateEnd:'2027-06-17'},{id:'s1',label:'Semester only',start:'09:00',end:'10:00',kind:'study',dateEnd:'2027-06-17'}];s.school.exceptions[0].cycleDay='A day';assert.equal(classOccurrences(data,'2027-06-21').length,1);assert.equal(classOccurrences(data,'2027-06-21')[0].block.id,'fy')})
test('Hanover template validates and follows all 14 elevator days',()=>{const {s}=fixture('hanover');validateSchool(s.school,s.start,s.end);assert.equal(s.school.pattern,'elevator');assert.deepEqual(Array.from(s.school.cycle),Array.from(hanoverElevatorCycle));assert.equal(schoolDay(s,'2026-08-31').cycleDay,'1A');assert.equal(schoolDay(s,'2026-09-01').cycleDay,'2B');assert.equal(schoolDay(s,'2026-09-08').cycleDay,'5A')})
test('Elevator builder rotates seven courses and assigns fifth-block lunch',()=>{const courses=Array.from({length:7},(_,i)=>({label:'Course '+(i+1),location:'Room '+(i+1),lunchWave:(i%3)+1})),week=buildElevatorWeek(courses);assert.equal(Object.keys(week).length,14);assert.equal(JSON.stringify(week['1A'].filter(b=>b.kind==='study').map(b=>b.label)),JSON.stringify(['Course 1','Course 2','Course 3','Course 7','Course 5','Course 6','Course 4']));assert.equal(week['2B'].filter(b=>b.kind==='study')[0].label,'Course 2');assert.equal(week['1A'].find(b=>b.kind==='break').label,'Lunch 2');assert.equal(week['7B'].filter(b=>b.kind==='study').length,7)})
test('Elevator builder reports missing scanned rows without crashing',()=>{const courses=Array.from({length:7},(_,i)=>({label:'Course '+(i+1),location:'Room '+(i+1),lunchWave:1}));courses[3]=undefined;assert.throws(()=>buildElevatorWeek(courses),/Course 4 is missing/)})
test('Elevator builder reports blank scanned course rows without raw label errors',()=>{const courses=Array.from({length:7},(_,i)=>({label:'Course '+(i+1),location:'Room '+(i+1),lunchWave:1}));courses[2]={label:'',location:'',lunchWave:1};assert.throws(()=>buildElevatorWeek(courses),/Course 3 needs a class name/);assert.doesNotThrow(()=>buildElevatorWeek(courses.map((course,i)=>i===2?{...course,label:'Course 3'}:course)))})
test('Hanover PDF course key fills seven editable courses without student header',()=>{const text='Student Name - Schedule Reference\nCourse Key\nNo.\nClass\nTeacher\nRoom\nCourse Code\nLunch if in 5th Block\n'+Array.from({length:7},(_,i)=>`${i+1}\nCourse ${i+1}\nTeacher Name\nHS${300+i}\n${400+i}-01\nLunch ${(i%3)+1}`).join('\n')+'\nBlock\nTime';const rows=parseHanoverElevatorCourses(text);assert.equal(rows.length,7);assert.equal(rows[0].label,'Course 1');assert.equal(rows[1].lunchWave,2);assert.match(rows[6].location,/HS306/);assert.ok(!JSON.stringify(rows).includes('Student Name'))})
test('Hanover two-page grid reconstructs the seven base courses and lunch waves',()=>{const order=[1,2,3,7,5,6,4],block=(slot,n,lunch)=>`${slot} | ${slot}:00-${slot}:45\nCourse ${n}\nTeacher ${n}\nHS30${n} | 40${n}-01${lunch?`\nLunch ${lunch}: 11:23-11:52`:''}`,grid='14-Day Elevator Schedule - Page 1\n1A\n'+order.map((n,i)=>block(i+1,n,i===4?2:0)).join('\n')+'\n'+[["2B",6,1],["3A",4,3],["4B",1,2],["5A",2,3],["6B",3,1],["7A",7,2]].map(([d,n,l])=>`${d}\n${block(5,n,l)}`).join('\n');const rows=parseHanoverElevatorCourses(grid);assert.equal(rows.length,7);assert.equal(rows[0].label,'Course 1');assert.equal(rows[3].label,'Course 4');assert.equal(rows[4].lunchWave,2);assert.equal(rows[3].lunchWave,3)})
test('The AI helper fallback: its answer is checked field by field, and only real classes on real days survive',()=>{
 const {parseAiClassSchedule,classSchedulePrompt}=load('src/store/aiClassSchedule.ts')
 const cycle=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
 const raw=JSON.stringify({classes:[
  {name:'Intro to Ecology',code:'BIOL 1100',days:['Tuesday','thursday'],start:'12:00',end:'13:15',building:'North Hall',room:'235',teacher:'Rivera, Ana'},
  {name:'Ethics Seminar (Discussion)',code:null,days:['Mon'],start:'9:00',end:'09:50',building:null,room:null,teacher:null},
  {name:'No time given',days:['Friday'],start:'',end:'10:00'},{name:'Backwards',days:['Friday'],start:'11:00',end:'10:00'},
  {name:'Made-up day',days:['Funday'],start:'10:00',end:'11:00'},{name:'',days:['Monday'],start:'10:00',end:'11:00'},'junk']})
 const rows=parseAiClassSchedule(raw,cycle,'2026-08-31','2026-12-21')
 assert.equal(rows.length,3)
 assert.equal(rows.filter(r=>r.label==='BIOL 1100 · Intro to Ecology').map(r=>r.day).join(','),'Tuesday,Thursday')
 assert.equal(rows[0].location,'North Hall 235 · Rivera, Ana');assert.equal(rows[0].dateEnd,'2026-12-21')
 const discussion=rows.find(r=>r.label==='Ethics Seminar (Discussion)');assert.equal(discussion.day,'Monday');assert.equal(discussion.start,'09:00')
 assert.throws(()=>parseAiClassSchedule('not json',cycle,'2026-08-31','2026-12-21'),/not valid JSON/)
 assert.equal(parseAiClassSchedule(JSON.stringify({classes:[{name:'Physics',days:['A day'],start:'08:00',end:'09:24'}]}),['A day','E day'],'2026-09-02','2027-06-17')[0].day,'A day')
 assert.ok(classSchedulePrompt(['A day','E day'],'Physics 8:00').includes('"A day", "E day"'))
})
test('Classes from the PDF importer join a college semester: breaks apply, duplicates are skipped, subjects are shared',()=>{
 const {addImportedClassesToSeason}=load('src/store/schoolImport.ts')
 const {data,s}=fixture('weekly');const cycle=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
 s.start='2026-08-31';s.end='2026-12-21';s.school.lastClassDate='2026-12-11';s.school.pattern='weekly';s.school.cycle=cycle;s.week=Object.fromEntries(cycle.map(d=>[d,[]]));s.week.Tuesday.push({id:'kept',label:'Corporate Finance',start:'15:00',end:'16:15',kind:'study',dateStart:'2026-08-31',dateEnd:'2026-12-11'})
 const row=(title,subject,weekdays,start,end,location)=>({id:randomUUID(),include:true,kind:'class',title,subject,date:'',weekdays,start,end,source:title,location})
 const rows=[row('Corporate Finance','Corporate Finance',[2,4],'15:00','16:15','245 Beacon Street 102'),row('Ethics Seminar (Lecture)','Ethics Seminar',[2,4],'10:30','11:45','South Hall 204'),row('Ethics Seminar (Discussion)','Ethics Seminar',[1],'12:00','12:50','West Hall 141N')]
 const {data:next,added,skipped}=addImportedClassesToSeason(data,data.activeProfileId,s.id,rows)
 const season=next.studySeasons.find(x=>x.id===s.id)
 assert.equal(next.studySeasons.length,data.studySeasons.length,'no separate schedule was created')
 assert.equal(skipped,1);assert.equal(season.week.Tuesday.length,2);assert.equal(season.week.Thursday.length,2);assert.equal(season.week.Monday.length,1)
 assert.equal(season.week.Monday[0].dateEnd,'2026-12-11');assert.equal(season.week.Monday[0].location,'West Hall 141N')
 const ethics=next.subjects.filter(x=>x.name==='Ethics Seminar');assert.equal(ethics.length,1)
 assert.equal(season.week.Monday[0].subjectId,ethics[0].id);assert.equal(season.week.Tuesday.find(b=>b.label==='Ethics Seminar (Lecture)').subjectId,ethics[0].id)
 assert.ok(added>=5)
 assert.throws(()=>addImportedClassesToSeason(data,data.activeProfileId,'missing',rows),/removed/)
 const weekdaysOnly=structuredClone(data);weekdaysOnly.studySeasons[0].school.cycle=['Monday','Tuesday','Wednesday','Thursday','Friday']
 assert.throws(()=>addImportedClassesToSeason(weekdaysOnly,data.activeProfileId,s.id,[row('Saturday Lab','Lab',[6],'09:00','10:00','')]),/isn’t a class day/)
 assert.equal(JSON.stringify(data.studySeasons[0].week.Monday),'[]','the original plan is untouched')
})
test('Duxbury High School: a 7-day rotation on the district calendar; a periods-only schedule (no clock times) is kept by period, and one set of times per period fills every class',()=>{
 const {academicTemplate}=load('src/store/academicCatalog.ts'),{parseAiClassSchedule,classSchedulePrompt,periodLabel}=load('src/store/aiClassSchedule.ts'),{addTimetableRows}=load('src/store/schoolImport.ts')
 const data=model.createFreshData(),dhs=academicTemplate(data.activeProfileId,'duxburyhs-2026')
 assert.equal(dhs.school.pattern,'rotation');assert.equal(dhs.school.cycle.join(','),'Day 1,Day 2,Day 3,Day 4,Day 5,Day 6,Day 7');assert.equal(dhs.name,'Duxbury High School 2026–27')
 assert.ok(dhs.school.exceptions.some(e=>e.label==='Thanksgiving recess'),'the district calendar dates come along')
 assert.equal(academicTemplate(data.activeProfileId,'duxbury-2026').school.pattern,'weekly','the district’s other schools keep the Monday–Friday week')
 // Step 1 errors say where to go.
 assert.throws(()=>validateSchool(dhs.school,dhs.start,dhs.end),/Answer “What grade are you in\?” at the top of setup/)
 const graded={...dhs.school,grade:'10'};assert.throws(()=>validateSchool(graded,dhs.start,dhs.end),/Answer “Which rotation day is it\?” at the top of setup/)
 validateSchool({...graded,anchorDate:'2026-09-28',anchorDay:'Day 4'},dhs.start,dhs.end)
 // What the AI returns for the real schedule (columns "D1 - Day 1", "D2 -"…, rows "P1-Period 1"…, no times).
 const cycle=dhs.school.cycle,prompt=classSchedulePrompt(cycle)
 assert.match(prompt,/"D1", "D2 -" or "Day 1" are those rotation days/);assert.match(prompt,/set start and end to null; never guess times/)
 const raw=JSON.stringify({classes:[
  {name:'Chemistry I',code:'328-03',days:['D1 - Day 1'],start:null,end:null,period:'P1-Period 1',building:null,room:'A321',teacher:'McLeod, Timothy E'},
  {name:'Chemistry I',code:'328-03',days:['D2 -'],start:null,end:null,period:'P3-Period 3',room:'A321',teacher:'McLeod, Timothy E'},
  {name:'Spanish III',code:'442-01',days:['Day 2'],start:null,end:null,period:'P1',room:'A346',teacher:'Steen, Katherine M'},
  {name:'Music Technology I',code:'513-01',days:['D1'],start:null,end:null,period:'Period 2',room:'Tech Rm'},
  {name:'English 10',code:'022-02',days:['D6'],start:'10:05',end:'11:00',period:'P5'},
  {name:'Lunch',code:null,days:['D1'],start:null,end:null,period:null}]})
 const rows=parseAiClassSchedule(raw,cycle,dhs.start,dhs.school.lastClassDate)
 assert.equal(rows.length,5,'chemistry twice, Spanish, music tech and English; nothing without a time or period')
 const chem=rows.filter(r=>r.label==='328-03 · Chemistry I');assert.equal(chem.map(r=>r.day+' '+r.slot).join(','),'Day 1 Period 1,Day 2 Period 3')
 assert.equal(chem[0].slot,'Period 1');assert.equal(chem[0].start,'');assert.equal(chem[0].location,'A321 · McLeod, Timothy E')
 const english=rows.find(r=>r.label==='022-02 · English 10');assert.equal(english.start,'10:05');assert.equal(english.slot,'022-02','times shown: kept as given')
 assert.equal(periodLabel('P3-Period 3'),'Period 3');assert.equal(periodLabel('Block A'),'Block A');assert.equal(periodLabel(null),'')
 const draft={...dhs,school:{...graded,anchorDate:'2026-09-28',anchorDay:'Day 4'}}
 assert.throws(()=>addTimetableRows(draft,rows),/Check/,'classes without times can’t be added yet')
 const times={'Period 1':['07:30','08:30'],'Period 2':['08:35','09:35'],'Period 3':['09:40','10:40']}
 const timed=rows.map(r=>times[r.slot]?{...r,start:times[r.slot][0],end:times[r.slot][1]}:r)
 const saved=addTimetableRows(draft,timed)
 assert.equal(saved.week['Day 1'].map(b=>b.start+' '+b.label).sort().join(' | '),'07:30 328-03 · Chemistry I | 08:35 513-01 · Music Technology I')
 assert.equal(saved.week['Day 2'].map(b=>b.start+' '+b.label).sort().join(' | '),'07:30 442-01 · Spanish III | 09:40 328-03 · Chemistry I');assert.equal(saved.week['Day 6'][0].start,'10:05')
})
test('One known day sets the rotation: "September 28 is Day 4" counts forward over weekends and holidays, and the next school day is found without it',()=>{
 const {academicTemplate}=load('src/store/academicCatalog.ts'),{nextSchoolDate,rotationPreview}=load('src/store/schoolCalendar.ts')
 const dhs=academicTemplate(model.createFreshData().activeProfileId,'duxburyhs-2026')
 assert.equal(nextSchoolDate(dhs,'2026-09-26'),'2026-09-28','a Saturday → the Monday, before the rotation is known')
 assert.equal(nextSchoolDate(dhs,'2026-09-07'),'2026-09-08','Labor Day is skipped');assert.equal(nextSchoolDate(dhs,'2026-08-01'),'2026-09-02','before the year → the first day')
 assert.equal(rotationPreview(dhs,'2026-09-28').length,0,'no preview until a day is known')
 const known={...dhs,school:{...dhs.school,anchorDate:'2026-09-28',anchorDay:'Day 4'}}
 assert.equal(rotationPreview(known,'2026-09-28',6).map(p=>p.date.slice(5)+' '+p.cycleDay).join(', '),'09-28 Day 4, 09-29 Day 5, 09-30 Day 6, 10-01 Day 7, 10-02 Day 1, 10-05 Day 2')
 assert.equal(rotationPreview(known,'2026-10-08',3).map(p=>p.date.slice(5)+' '+p.cycleDay).join(', '),'10-08 Day 5, 10-09 Day 6, 10-13 Day 7','Columbus Day is skipped without using up a day')
 assert.equal(schoolDay(known,'2026-09-25').cycleDay,'Day 3','and it counts backwards too')
})
test('Monday–Friday schools (Duxbury Public Schools, Silver Lake…) are schools, not colleges: they need a grade, not a faculty, and can be saved',()=>{
 const {academicTemplate}=load('src/store/academicCatalog.ts'),{isCollegeCalendar}=load('src/store/schoolCalendar.ts')
 const base=model.createFreshData(),id=base.activeProfileId
 for(const cat of ['duxbury-2026','silverlake-2026','scituate-2026','plymouth-2026']){
  const s=academicTemplate(id,cat);assert.equal(s.school.pattern,'weekly');assert.equal(isCollegeCalendar(s.school),false,cat+' is a school')
  assert.throws(()=>validateSchool(s.school,s.start,s.end),/What grade are you in/)
  validateSchool({...s.school,grade:'10'},s.start,s.end)
  const saved=model.normalizeData({...base,studySeasons:[{...s,school:{...s.school,grade:'10'}}]}).studySeasons[0]
  assert.equal(isCollegeCalendar(saved.school),false,cat+' stays a school after saving')
 }
 assert.equal(isCollegeCalendar(academicTemplate(id,'bc-fall-2026').school),true,'a college term is a college');assert.equal(isCollegeCalendar(academicTemplate(id,'duxburyhs-2026').school),false)
})
test('Duxbury High bell schedule: five blocks fill a periods-only schedule, the Block 4 class sets the lunch wave by department, and a semester class can be switched later',()=>{
 const {academicTemplate}=load('src/store/academicCatalog.ts'),{parseAiClassSchedule,classSchedulePrompt}=load('src/store/aiClassSchedule.ts'),{addTimetableRows}=load('src/store/schoolImport.ts')
 const b=load('src/store/bellSchedules.ts')
 const data=model.createFreshData(),dhs=academicTemplate(data.activeProfileId,'duxburyhs-2026')
 const school={...dhs.school,grade:'10',anchorDate:'2026-09-28',anchorDay:'Day 4'},season={...dhs,school}
 const bells=b.bellScheduleFor(school)
 assert.ok(bells,'Duxbury High has a bell schedule');assert.equal(b.bellScheduleFor(academicTemplate(data.activeProfileId,'duxbury-2026').school),undefined,'the district’s other schools don’t')
 assert.equal(bells.periods.map(p=>p.join('–')).join(', '),'08:20–09:19, 09:23–10:22, 10:26–11:25, 11:29–12:58, 13:02–14:05')
 assert.equal(bells.after.label+' '+bells.after.start+'–'+bells.after.end,'ASP 14:05–14:45','ASP always follows Block 5')
 for(const w of [1,2,3]){const [a,z]=bells.lunch.waves[w];assert.ok(a>=bells.periods[3][0]&&z<=bells.periods[3][1]&&a<z,'lunch '+w+' is inside Block 4')}
 assert.match(classSchedulePrompt(school.cycle,undefined,5),/5 periods \(also called blocks\) every day/);assert.doesNotMatch(classSchedulePrompt(school.cycle),/also called blocks/)
 // Lunch waves by department.
 const wave=name=>b.duxburyLunchWave(name).wave
 for(const n of ['Chemistry I','Honors Biology','Algebra II','AP Calculus AB','Computer Science Principles','Engineering Design','Statistics','Culinary Arts'])assert.equal(wave(n),1,n)
 for(const n of ['US History II','AP Psychology','Civics','Spanish III','French IV','Latin II'])assert.equal(wave(n),2,n)
 for(const n of ['English 10','Music Technology I','Ceramics','Physical Education','Health','Study Hall','Art History'])assert.equal(wave(n),3,n)
 assert.equal(b.duxburyLunchWave('Advisory').sure,false,'an unknown department is a guess');assert.equal(b.duxburyLunchWave('Physical Education').sure,true)
 // AI rows (periods, no times) get the bell times, and the Block 4 class a lunch wave.
 const raw=JSON.stringify({classes:[
  {name:'Chemistry I',days:['D1'],start:null,end:null,period:'P1-Period 1'},
  {name:'US History II',days:['D1'],start:null,end:null,period:'P4-Period 4'},
  {name:'English 10',days:['D2'],start:null,end:null,period:'P4'},
  {name:'Spanish III',days:['D1'],start:null,end:null,period:'P1'},
  {name:'Band',days:['D2'],start:null,end:null,period:'Period 5'},
  {name:'Jazz Lab',days:['D5'],start:'07:00',end:'07:50',period:null}]})
 const rows=b.applyBells(parseAiClassSchedule(raw,school.cycle,season.start,school.lastClassDate),bells)
 const at=(day,label)=>rows.find(r=>r.day===day&&r.label===label)
 assert.equal(at('Day 1','Chemistry I').start+'–'+at('Day 1','Chemistry I').end,'08:20–09:19')
 assert.equal(at('Day 1','US History II').start+'–'+at('Day 1','US History II').end,'11:29–12:58');assert.equal(at('Day 1','US History II').lunchWave,2)
 assert.equal(at('Day 2','English 10').lunchWave,3);assert.equal(at('Day 1','Chemistry I').lunchWave,undefined,'only Block 4 has lunch')
 assert.equal(at('Day 5','Jazz Lab').start,'07:00','times on the schedule are kept');assert.equal(at('Day 2','Band').start+'–'+at('Day 2','Band').end,'13:02–14:05')
 const problems=b.periodProblems(rows,school.cycle,bells)
 assert.ok(problems.includes('Day 1 has two classes in Period 1. Untick the one that’s wrong.'),problems.join(' / '))
 assert.ok(problems.some(p=>p.startsWith('Day 1 has nothing in Period 2, Period 3, Period 5.')),problems.join(' / '))
 assert.ok(!problems.some(p=>p.startsWith('Day 3')),'a day with no classes read isn’t flagged')
 const chosen=rows.filter(r=>r.label!=='Spanish III')
 assert.ok(!b.periodProblems(chosen,school.cycle,bells).some(p=>/two classes/.test(p)))
 const saved=b.addBellBlocks(addTimetableRows(season,chosen),chosen)
 assert.equal(saved.week['Day 1'].map(x=>x.start+' '+x.label).join(' | '),'08:20 Chemistry I | 11:29 US History II | 11:54 Lunch 2')
 assert.equal(saved.week['Day 2'].map(x=>x.start+' '+x.label).join(' | '),'11:29 English 10 | 12:34 Lunch 3 | 13:02 Band | 14:05 ASP · Band','ASP follows the Block 5 class')
 const asp=saved.week['Day 2'].find(x=>x.slot==='ASP');assert.equal(asp.kind,'routine','ASP doesn’t become a subject');assert.equal(asp.end,'14:45')
 assert.equal(b.addBellBlocks(saved,chosen).week['Day 1'].length,3,'lunch isn’t added twice')
 // Second semester: History becomes Economics (a history class, still 2nd lunch) and English becomes
 // Anatomy (science → 1st lunch) from Monday, January 25.
 const data2={...data,studySeasons:[{...saved,active:true}]}
 const day=date=>schoolDay(data2.studySeasons[0],date).cycleDay
 const d1=['2026-10-02','2026-10-13','2027-01-04','2027-02-01','2027-03-01','2027-04-01','2027-05-03','2027-05-04','2027-05-05','2027-05-06','2027-05-07','2027-05-10','2027-05-11','2027-05-12','2027-05-14'].filter(d=>day(d)==='Day 1')
 assert.ok(d1.some(d=>d<'2027-01-25')&&d1.some(d=>d>'2027-01-25'),'found Day 1s before and after the change')
 let next=b.switchClass(saved,'US History II',{label:'Economics',from:'2027-01-25',lunchWave:2,location:'A210'})
 next=b.switchClass(next,'English 10',{label:'Anatomy & Physiology',from:'2027-01-25',lunchWave:1})
 const shown=date=>classOccurrences({...data,studySeasons:[{...next,active:true}]},date).map(o=>o.block.start+' '+o.block.label).join(' | ')
 const before=d1.find(d=>d<'2027-01-25'),after=d1.find(d=>d>'2027-01-25')
 assert.equal(shown(before),'08:20 Chemistry I | 11:29 US History II | 11:54 Lunch 2')
 assert.equal(shown(after),'08:20 Chemistry I | 11:29 Economics | 11:54 Lunch 2')
 const d2=['2027-01-05','2027-01-06','2027-01-07','2027-01-08','2027-01-11','2027-01-12','2027-01-13','2027-02-01','2027-02-02','2027-02-03','2027-02-04','2027-02-05','2027-02-08','2027-02-09'].filter(d=>day(d)==='Day 2')
 assert.equal(shown(d2[0]),'11:29 English 10 | 12:34 Lunch 3 | 13:02 Band | 14:05 ASP · Band')
 assert.equal(shown(d2.find(d=>d>'2027-01-25')),'11:29 Anatomy & Physiology | 11:29 Lunch 1 | 13:02 Band | 14:05 ASP · Band','the lunch moved with the new class')
 // A Block 5 class that changes takes ASP with it.
 const orch=b.switchClass(next,'Band',{label:'Orchestra',from:'2027-01-25'})
 assert.equal(classOccurrences({...data,studySeasons:[{...orch,active:true}]},d2.find(d=>d>'2027-01-25')).map(o=>o.block.start+' '+o.block.label).join(' | '),'11:29 Anatomy & Physiology | 11:29 Lunch 1 | 13:02 Orchestra | 14:05 ASP · Orchestra')
 assert.equal(classOccurrences({...data,studySeasons:[{...orch,active:true}]},d2[0]).map(o=>o.block.start+' '+o.block.label).join(' | '),'11:29 English 10 | 12:34 Lunch 3 | 13:02 Band | 14:05 ASP · Band')
 const econ=next.week['Day 1'].find(x=>x.label==='Economics'),hist=next.week['Day 1'].find(x=>x.label==='US History II')
 assert.equal(hist.dateEnd,'2027-01-24');assert.equal(econ.dateStart,'2027-01-25');assert.equal(econ.location,'A210');assert.equal(econ.subjectId,undefined,'the new class gets its own subject on save')
 validateSchool(next.school,next.start,next.end)
 assert.equal(model.normalizeData({...data,studySeasons:[next]}).studySeasons[0].week['Day 1'].length,5,'the switched schedule saves')
 assert.throws(()=>b.switchClass(saved,'Chemistry I',{label:'Physics',from:'2026-08-01'}),/during the school year/)
 assert.throws(()=>b.switchClass(saved,'Chemistry I',{label:' ',from:'2027-01-25'}),/new class’s name/)
 assert.throws(()=>b.switchClass(saved,'Nope',{label:'Physics',from:'2027-01-25'}),/nothing to change/)
 // A name fixed everywhere.
 assert.equal(b.renameClass(saved,'Band','Concert Band').week['Day 2'].map(x=>x.label).join(', '),'English 10, Lunch 3, Concert Band, ASP · Concert Band','ASP is renamed too')
 const renamed=b.renameClass(saved,'chemistry i','Chemistry I (Honors)')
 assert.equal(Object.values(renamed.week).flat().filter(x=>x.label==='Chemistry I (Honors)').length,1);assert.equal(saved.week['Day 1'][0].label,'Chemistry I','the original is untouched')
})
console.log(passed+' school-calendar regression groups passed. No user data changed.')
