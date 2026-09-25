// Actual application functions with isolated fixtures; no browser or user-data writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,structuredClone,crypto:{randomUUID},console,URL,Response,AbortSignal,TextEncoder})
 return module.exports
}
let passed=0
function test(name,fn){return Promise.resolve().then(fn).then(()=>{passed++;console.log('PASS '+name)})}
const {parseIcs,applyIcsImport,guessKind}=load('src/store/icsImport.ts'),model=load('src/store/model.ts'),{feedUrl,fetchFeed}=load('src/store/calendarFeed.ts')
const today='2026-09-25'
// Shaped like a Google Calendar export: CRLF, folded lines, a time zone block, escaped text.
const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Google Inc//Google Calendar 70.9054//EN','X-WR-CALNAME:Jo\\, fall','BEGIN:VTIMEZONE','TZID:America/New_York','BEGIN:STANDARD','DTSTART:19701101T020000','END:STANDARD','END:VTIMEZONE',
 'BEGIN:VEVENT','UID:ecology@google.com','SUMMARY:Intro to Ecology','LOCATION:North Hall 235\\, Room B','DTSTART;TZID=America/New_York:20260901T120000','DTEND;TZID=America/New_York:20260901T131500','RRULE:FREQ=WEEKLY;UNTIL=20261211T045959Z;BYDAY=TU,TH','EXDATE;TZID=America/New_York:20261124T120000','END:VEVENT',
 'BEGIN:VEVENT','UID:ecology@google.com','RECURRENCE-ID;TZID=America/New_York:20261006T120000','SUMMARY:Intro to Ecology (moved)','DTSTART;TZID=America/New_York:20261007T150000','DTEND;TZID=America/New_York:20261007T161500','END:VEVENT',
 'BEGIN:VEVENT','UID:dentist@google.com','SUMMARY:Dentist appointment','DTSTART;TZID=America/New_York:20261002T090000','DTEND;TZID=America/New_York:20261002T100000','END:VEVENT',
 'BEGIN:VEVENT','UID:break@google.com','SUMMARY:Thanksgiving break','DTSTART;VALUE=DATE:20261126','DTEND;VALUE=DATE:20261127','END:VEVENT',
 'BEGIN:VEVENT','UID:old@google.com','SUMMARY:Last spring final exam','DTSTART:20260505T130000Z','END:VEVENT',
 'BEGIN:VEVENT','UID:gone@google.com','SUMMARY:Cancelled thing','STATUS:CANCELLED','DTSTART:20261003T130000Z','END:VEVENT',
 'BEGIN:VEVENT','UID:monthly@google.com','SUMMARY:Club meeting','DTSTART:20261010T190000','DURATION:PT90M','RRULE:FREQ=MONTHLY;COUNT=3','END:VEVENT',
 'BEGIN:VEVENT','UID:long@google.com','SUMMARY:A very long title that Google folds onto the next line because it is longer than seventy-f',' ive characters','DTSTART:20261012T080000','DTEND:20261012T083000','END:VEVENT',
 'END:VCALENDAR'].join('\r\n')

;(async()=>{
await test('A Google-style calendar: weekly repeats, a moved instance, cancelled dates, one-time, all-day and monthly events',()=>{
 const r=parseIcs(ics,today)
 assert.equal(r.calendarName,'Jo, fall')
 assert.equal(r.weekly.length,1)
 const w=r.weekly[0]
 assert.equal(w.title,'Intro to Ecology');assert.equal(w.days.join(','),'2,4');assert.equal(w.start,'12:00');assert.equal(w.end,'13:15')
 assert.equal(w.from,today,'past weeks are not imported');assert.equal(w.until,'2026-12-11');assert.equal(w.location,'North Hall 235, Room B')
 assert.equal(w.skipped.join(','),'2026-10-06,2026-11-24','the cancelled date and the moved date are skipped')
 const titles=r.events.map(e=>e.title)
 assert.ok(titles.includes('Intro to Ecology (moved)'));assert.ok(titles.includes('Dentist appointment'));assert.ok(titles.includes('Thanksgiving break'))
 assert.ok(!titles.includes('Last spring final exam'),'past events are left out');assert.ok(!titles.includes('Cancelled thing'))
 assert.equal(r.events.filter(e=>e.title==='Club meeting').map(e=>e.date).join(','),'2026-10-10,2026-11-10,2026-12-10')
 const club=r.events.find(e=>e.title==='Club meeting');assert.equal(club.time,'19:00');assert.equal(club.endTime,'20:30')
 const allDay=r.events.find(e=>e.title==='Thanksgiving break');assert.equal(allDay.time,undefined);assert.equal(allDay.date,'2026-11-26')
 assert.ok(titles.some(t=>t.endsWith('seventy-five characters')),'folded lines are joined')
})
await test('Adding: events land in the Calendar, weekly repeats in one weekly schedule; importing again adds nothing new',()=>{
 const data=model.createFreshData(),r=parseIcs(ics,today)
 const first=applyIcsImport(data,data.activeProfileId,r,r.calendarName)
 const season=first.data.studySeasons.find(s=>s.name==='Jo, fall · weekly')
 assert.ok(season);assert.equal(season.week.Tuesday.length,1);assert.equal(season.week.Thursday.length,1)
 assert.equal(season.week.Tuesday[0].skippedDates.join(','),'2026-10-06,2026-11-24');assert.equal(season.week.Thursday[0].skippedDates.length,0)
 assert.equal(season.week.Tuesday[0].location,'North Hall 235, Room B');assert.equal(season.week.Tuesday[0].dateEnd,'2026-12-11')
 const dentist=first.data.calendarEvents.find(e=>e.title==='Dentist appointment');assert.equal(dentist.kind,'appointment');assert.equal(dentist.time,'09:00');assert.equal(dentist.endTime,'10:00')
 assert.equal(first.added,r.events.length+1)
 const again=applyIcsImport(first.data,data.activeProfileId,parseIcs(ics,today),r.calendarName)
 assert.equal(again.added,0);assert.equal(again.skipped,r.events.length+1)
 assert.equal(again.data.studySeasons.filter(s=>s.name==='Jo, fall · weekly').length,1)
 const none={...r,events:r.events.map(e=>({...e,include:false})),weekly:r.weekly.map(w=>({...w,include:false}))}
 assert.throws(()=>applyIcsImport(data,data.activeProfileId,none,'x'),/at least one/)
 assert.throws(()=>parseIcs('hello',today),/isn’t a calendar file/)
 assert.equal(guessKind('Bio midterm'),'exam');assert.equal(guessKind('Soccer practice'),'sports');assert.equal(guessKind('Coffee with Sam'),'other')
})
await test('Calendar links: only calendar services, webcal becomes https, redirects are checked too',async()=>{
 assert.equal(feedUrl('webcal://p52-caldav.icloud.com/published/2/abc').href,'https://p52-caldav.icloud.com/published/2/abc')
 assert.equal(feedUrl('https://calendar.google.com/calendar/ical/x%40gmail.com/private-abc/basic.ics').hostname,'calendar.google.com')
 for(const bad of ['http://calendar.google.com/x','https://evil.example.com/cal.ics','https://calendar.google.com.evil.com/x','https://user:pw@calendar.google.com/x','https://169.254.169.254/latest','file:///etc/passwd','not a link'])assert.throws(()=>feedUrl(bad),/./,bad)
 const calls=[]
 const fake=routes=>async url=>{calls.push(url);const r=routes[url];return new Response(r.body??'',{status:r.status??200,headers:r.headers??{}})}
 const ok=await fetchFeed('https://calendar.google.com/a.ics',fake({'https://calendar.google.com/a.ics':{status:302,headers:{location:'https://calendar.google.com/b.ics'}},'https://calendar.google.com/b.ics':{body:'BEGIN:VCALENDAR\r\nEND:VCALENDAR'}}))
 assert.match(ok,/BEGIN:VCALENDAR/)
 await assert.rejects(fetchFeed('https://calendar.google.com/a.ics',fake({'https://calendar.google.com/a.ics':{status:302,headers:{location:'http://10.0.0.1/secret'}}})),/https/)
 await assert.rejects(fetchFeed('https://calendar.google.com/c.ics',fake({'https://calendar.google.com/c.ics':{body:'<html>sign in</html>'}})),/didn’t return a calendar/)
 await assert.rejects(fetchFeed('https://calendar.google.com/d.ics',fake({'https://calendar.google.com/d.ics':{status:404}})),/didn’t share/)
})
console.log(passed+'/3 calendar-import regression groups passed.')
})().catch(e=>{console.error(e);process.exit(1)})
