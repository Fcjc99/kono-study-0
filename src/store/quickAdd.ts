import {dateFrom} from './dateText'
import type {TodoRepeat} from './model'

/** "＋ Add" › Type it: one line like "bio worksheet due fri" or "math test thursday at 9" becomes an
 * assignment or exam with its class, date and (for assignments) a planned time. What's left after
 * taking those out is the title. Nothing is saved until the person presses Add, after seeing this. */
export type QuickAddGuess={key:'tasks'|'exams'|'calendarEvents'|'familyTodos';title:string;subjectId:string;subjectName:string;due:string;time?:string;dateFound:boolean;event?:QuickEvent;todo?:QuickTodo}
/** A family to-do in one line: "clean house every sat", "pay rent on the 1st every month". due is '' for any day. */
export type QuickTodo={repeat?:TodoRepeat;kidId?:string;kidName?:string;monthDay?:number}
/** An event in one line: "soccer every Tue and Thu 4-5:30pm for Emma at Riverside Park". */
export type QuickEvent={kind:'sports'|'lesson'|'appointment'|'activity'|'work'|'personal';endTime?:string;repeatDays:number[];repeatLabel?:string;until:string;kidIds:string[];people:string[];location?:string}
type Person={id:string;name:string}

const DAYS=['sun','mon','tue','wed','thu','fri','sat']
const DAY=String.raw`(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)`
const EXAM=/\b(test|quiz|exam|midterm|final|finals)\b/i
/** An eye or dental exam is an appointment, not a school test. */
const isExam=(text:string)=>EXAM.test(text.replace(/\b(?:eye|vision|dental|hearing|physical|medical|vet)\s+exams?\b/gi,' '))
// Short forms students type for their classes, matched against the start of a class's own name.
const SHORT:Record<string,string[]>={bio:['biology','bio'],chem:['chemistry','chem'],phys:['physics'],sci:['science'],math:['math','algebra','geometry','calculus','precalc','pre-calculus','statistics','trig'],alg:['algebra'],geo:['geometry'],calc:['calculus','ap calculus'],stats:['statistics','ap statistics'],eng:['english'],ela:['english','ela'],lit:['literature','english'],hist:['history','us history','world history'],apush:['ap us history','us history','apush'],gov:['government','civics'],econ:['economics'],span:['spanish'],fr:['french'],french:['french'],lat:['latin'],cs:['computer science'],comp:['computer science'],art:['art','ceramics','drawing','studio art'],pe:['pe','physical education','gym'],gym:['pe','physical education','gym'],health:['health'],music:['music','band','chorus','orchestra'],psych:['psychology']}
const pad=(n:number)=>String(n).padStart(2,'0')
const iso=(d:Date)=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())
const plus=(date:string,days:number)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return iso(d)}

/** In a family plan (people given), a chore or errand with no time is a family to-do; see parseQuickTodo. */
export function parseQuickAdd(text:string,subjects:{id:string;name:string}[],today:string,people:Person[]=[]):QuickAddGuess{
 const todo=people.length?parseQuickTodo(text,today,people):null
 if(todo)return todo
 const event=parseQuickEvent(text,today,people)
 if(event)return event
 let rest=' '+text.replace(/\s+/g,' ').trim()+' '
 const take=(re:RegExp)=>{const m=rest.match(re);if(m)rest=rest.replace(m[0],' ');return m}
 // When: today, tonight, tomorrow, (next) weekday, in N days, next week, 10/12, Oct 12, 2026-10-12.
 let due='',m:RegExpMatchArray|null
 if(take(/\b(?:due\s+|on\s+|by\s+)?(?:today|tonight)\b/i))due=today
 else if(take(/\b(?:due\s+|on\s+|by\s+)?(?:tomorrow|tmrw|tmr|tmw)\b/i))due=plus(today,1)
 else if((m=take(/\b(?:due\s+|on\s+|by\s+)?in\s+(\d{1,2}|a|one|two|three)\s+(day|days|week|weeks)\b/i))){const n={a:1,one:1,two:2,three:3}[m[1].toLowerCase() as 'a']??Number(m[1]);due=plus(today,/week/i.test(m[2])?n*7:n)}
 else if(take(/\b(?:due\s+)?next\s+week\b/i)){const d=new Date(today+'T12:00:00').getDay();due=plus(today,((8-d)%7)||7)}
 else if((m=take(new RegExp(String.raw`\b(?:due\s+|on\s+|by\s+)?(next\s+|this\s+)?${DAY}\b\.?`,'i')))){
  const want=DAYS.indexOf(m[2].slice(0,3).toLowerCase()),now=new Date(today+'T12:00:00').getDay()
  let ahead=(want-now+7)%7||7 // the same weekday means next week's
  if(m[1]&&/next/i.test(m[1])&&ahead<7&&now!==0&&want>now)ahead+=7 // "next Fri" on a Tuesday: the Friday after this one
  due=plus(today,ahead)
 }else{
  const dateText=rest.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/i)
  const found=dateText?dateFrom(dateText[0].replace(/sept/i,'sep'),today,plus(today,365),'mdy'):''
  if(dateText&&found){rest=rest.replace(new RegExp(String.raw`(?:\b(?:due|on|by)\s+)?`+dateText[0].replace(/[.*+?^${}()|[\]\\/]/g,'\\$&'),'i'),' ');due=found}
 }
 // At what time (assignments only become a planned time).
 let time:string|undefined
 if((m=take(/\b(?:at\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i))){
  let h=Number(m[1]??m[4]);const min=Number(m[2]??m[5]??0),ap=(m[3]??m[6])?.toLowerCase()
  if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0
  if(!ap&&h>=1&&h<=7)h+=12 // "at 4" after school means 4 PM
  if(h<24&&min<60)time=pad(h)+':'+pad(min)
 }
 rest=rest.replace(/\b(due|by)\b\s*$/i,' ').replace(/\s\b(due)\b\s/i,' ')
 // Which class: its full name, or a short form ("bio", "chem", "apush").
 const lower=rest.toLowerCase()
 let subjectId='',subjectName=''
 const byName=[...subjects].filter(s=>s.name.trim()).sort((a,b)=>b.name.length-a.name.length).find(s=>new RegExp(String.raw`\b${s.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\b`).test(lower))
 if(byName){subjectId=byName.id;subjectName=byName.name;rest=rest.replace(new RegExp(String.raw`\b${byName.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\b`,'i'),' ')}
 else{
  // Any real word of a class's name: "spanish" for "Spanish III", "history" for "US History II".
  const words=(name:string)=>name.toLowerCase().split(/[^a-z]+/).filter(w=>w.length>=4)
  const hit=subjects.find(s=>words(s.name).some(w=>new RegExp(String.raw`\b${w}\b`).test(lower)))
  if(hit){const w=words(hit.name).find(w=>new RegExp(String.raw`\b${w}\b`).test(lower))!;subjectId=hit.id;subjectName=hit.name;rest=rest.replace(new RegExp(String.raw`\b${w}\b`,'i'),' ')}
 }
 if(!subjectId)for(const [short,names] of Object.entries(SHORT)){
  if(!new RegExp(String.raw`\b${short}\b`,'i').test(rest))continue
  const hit=subjects.find(s=>names.some(n=>s.name.toLowerCase().startsWith(n)))
  if(hit){subjectId=hit.id;subjectName=hit.name;rest=rest.replace(new RegExp(String.raw`\b${short}\b`,'i'),' ');break}
 }
 const key=isExam(text)?'exams':'tasks'
 let title=rest.replace(/\s+/g,' ').replace(/^[\s,:;-]+|[\s,:;-]+$/g,'').trim()
 if(!title)title=(subjectName||'New')+' '+(key==='exams'?'test':'assignment')
 title=title[0].toUpperCase()+title.slice(1)
 return {key,title:title.slice(0,200),subjectId,subjectName,due:due||plus(today,1),...(time&&key==='tasks'?{time}:{}),dateFound:!!due}
}

const DAY_WORD=String.raw`(?:sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)(?:nesday|rsday|urday|sday|day)?s?\.?(?![a-z])`
const HOMEWORK=/\b(homework|worksheet|essay|assignment|due|read(?:ing)?\s+ch|chapter|project|study(?:\s+for)?|flashcards?|problems?|packet|lab|review|pages?)\b/i
const KINDS:[QuickEvent['kind'],RegExp][]=[
 ['sports',/\b(soccer|football|basketball|baseball|softball|hockey|lacrosse|tennis|volleyball|swim(?:ming)?|track|gymnastics|cheer|wrestling|practice|game|match|tournament|meet|karate|martial arts)\b/i],
 ['lesson',/\b(lessons?|piano|violin|guitar|cello|drums?|tutor(?:ing)?|ballet|dance class|art class|music class)\b/i],
 ['appointment',/\b(dentist|doctor|dr\.?|appointment|appt|check-?up|orthodontist|ortho|eye exam|vet|therapy|haircut)\b/i],
 ['activity',/\b(party|club|scouts?|rehearsal|recital|playdate|play date|camp|church|youth group|concert|show|sleepover|field trip|birthday)\b/i],
 ['work',/\b(work|shift)\b/i],
]
/** An evening start with a morning end runs overnight ("sleepover 7pm-9am", "shift 10pm-2am"). */
const lateNight=(time:string,endTime:string)=>time>='17:00'&&endTime<='11:00'
const dayIndex=(w:string)=>DAYS.indexOf(w.slice(0,3).toLowerCase())
const clock=(h:number,m:number,ap:string|undefined,fallbackPm:boolean)=>{if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0;if(!ap&&fallbackPm&&h>=1&&h<=7)h+=12;return h<24&&m<60?pad(h)+':'+pad(m):undefined}

/** One line that reads like an event (a repeat, a time range, a person, a place, or an event word like
 * practice, lesson or dentist) and not like homework or a test; anything else is left to the rest of parseQuickAdd. */
export function parseQuickEvent(text:string,today:string,people:Person[]):QuickAddGuess|null{
 if(isExam(text)||HOMEWORK.test(text))return null
 let rest=' '+text.replace(/\s+/g,' ').trim()+' '
 const take=(re:RegExp)=>{const m=rest.match(re);if(m)rest=rest.replace(m[0],' ');return m}
 // Repeats: every day / every weekday / every Tue and Thu / Mondays and Wednesdays / every week.
 let repeatDays:number[]=[],repeatLabel:string|undefined,weekly=false,m:RegExpMatchArray|null
 if(take(/\b(?:every\s*day|daily)\b/i)){repeatDays=[0,1,2,3,4,5,6];repeatLabel='Every day'}
 else if(take(/\b(?:every\s+weekday|weekdays)\b/i)){repeatDays=[1,2,3,4,5];repeatLabel='Every weekday'}
 else if((m=take(new RegExp(String.raw`\b(?:every|on)\s+(${DAY_WORD}(?:\s*(?:,|and|&|\/|\+)\s*${DAY_WORD})*)`,'i')))||(m=take(new RegExp(String.raw`\b((?:sun|mon|tues?|wednes|thurs?|fri|satur)days(?:\s*(?:,|and|&|\/|\+)\s*(?:sun|mon|tues?|wednes|thurs?|fri|satur)days)*)\b`,'i')))){
  repeatDays=[...new Set(m[1].split(/\s*(?:,|and|&|\/|\+)\s*/i).map(dayIndex).filter(i=>i>=0))].sort()
  if(/every|days\b/i.test(m[0])||repeatDays.length>1)repeatLabel=repeatDays.length===7?'Every day':'Every '+repeatDays.map(i=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]).join(' & ')
  else{rest=' '+m[0]+rest;repeatDays=[]} // "on Tuesday" alone is a date, read below
 }
 if(take(/\b(?:every\s+week|weekly)\b/i))weekly=true
 // Until a date: "until Dec 18" / "till 12/18".
 let until=''
 if((m=take(/\b(?:until|till|thru|through)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2})/i)))until=dateFrom(m[1].replace(/sept/i,'sep'),today,plus(today,400),'mdy')||''
 // A time range "4-5:30pm" / "4pm to 5pm" / "from 4 to 6", or one time "at 4" / "4:30pm".
 let time:string|undefined,endTime:string|undefined
 if((m=take(/(?<![\d/-])\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?![\d/])|\bfrom\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i))){
  const g=m[1]?m.slice(1,7):m.slice(7,13),endAp=g[5]?.toLowerCase(),startAp=g[2]?.toLowerCase()??(endAp&&Number(g[0])<=Number(g[3])?endAp:undefined)
  time=clock(Number(g[0]),Number(g[1]??0),startAp,true);endTime=clock(Number(g[3]),Number(g[4]??0),endAp,true)
 }else if((m=take(/\b(?:at\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)))time=clock(Number(m[1]??m[4]),Number(m[2]??m[5]??0),(m[3]??m[6])?.toLowerCase(),true)
 else if((m=take(/\b(?:at\s+)?(noon|midnight)\b/i)))time=/noon/i.test(m[1])?'12:00':'00:00'
 // Who: "for Emma and Leo", or a name anywhere.
 const kidIds:string[]=[],names:string[]=[]
 for(const p of people){const n=p.name.trim();if(!n)continue;const re=new RegExp(String.raw`(?:\bfor\s+)?\b${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:'s|’s)?\b`,'i');if(re.test(rest)){rest=rest.replace(re,' ');kidIds.push(p.id);names.push(n)}}
 if(kidIds.length)rest=rest.replace(/\s(?:for|and|&)(?=\s+(?:and|&)?\s*$|\s+(?:and|&)\s)/gi,' ').replace(/\s(?:and|&)\s*(?=$|\s(?:at|on|every)\b)/gi,' ')
 // When (the first date, if it doesn't repeat on set days).
 let due=''
 if(take(/\b(?:on\s+)?(?:today|tonight)\b/i))due=today
 else if(take(/\b(?:on\s+)?(?:tomorrow|tmrw|tmr)\b/i))due=plus(today,1)
 else if((m=take(new RegExp(String.raw`\b(?:on\s+)?(next\s+|this\s+)?${DAY}\b\.?`,'i')))){const want=DAYS.indexOf(m[2].slice(0,3).toLowerCase()),now=new Date(today+'T12:00:00').getDay();let ahead=(want-now+7)%7;if(m[1]&&/next/i.test(m[1])&&ahead===0)ahead=7;due=plus(today,ahead);if(weekly&&!repeatDays.length)repeatDays=[want]}
 else{const dt=rest.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/i);const found=dt?dateFrom(dt[0].replace(/sept/i,'sep'),today,plus(today,365),'mdy'):'';if(dt&&found){rest=rest.replace(new RegExp(String.raw`(?:\bon\s+)?`+dt[0].replace(/[.*+?^${}()|[\]\\/]/g,'\\$&'),'i'),' ');due=found}}
 let dateFound=!!due
 if(weekly&&!repeatDays.length)repeatDays=[new Date((due||today)+'T12:00:00').getDay()]
 if(repeatDays.length&&!repeatLabel)repeatLabel='Every '+['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][repeatDays[0]]
 if(repeatDays.length&&!due){const now=new Date(today+'T12:00:00').getDay(),ahead=Math.min(...repeatDays.map(d=>(d-now+7)%7));due=plus(today,ahead);dateFound=true}
 // Where: "at Riverside Park" / "@ the Y" (not a time).
 let location:string|undefined
 if((m=take(/\s(?:at|@)\s+(?!\d)((?:the\s+)?[^\s,].*?)\s*$/i))){const place=m[1].trim().replace(/[.,;]+$/,'');if(place)location=place[0].toUpperCase()+place.slice(1)}
 const kind=(KINDS.find(([,re])=>re.test(text))?.[0])??'personal'
 const eventish=repeatDays.length>0||!!endTime||kidIds.length>0||!!location||kind!=='personal'
 if(!eventish)return null
 let title=rest.replace(/\s+/g,' ').replace(/^[\s,:;&-]+|[\s,:;&-]+$/g,'').replace(/^(?:for|and)\s+|\s+(?:for|and|on|with)$/gi,'').trim()
 if(!title)title=kind==='sports'?'Practice':kind==='lesson'?'Lesson':kind==='appointment'?'Appointment':'Event'
 title=title[0].toUpperCase()+title.slice(1)
 if(repeatDays.length&&due&&repeatDays.includes(new Date(due+'T12:00:00').getDay())===false){const now=new Date(due+'T12:00:00').getDay(),ahead=Math.min(...repeatDays.map(d=>(d-now+7)%7));due=plus(due,ahead)}
 return {key:'calendarEvents',title:title.slice(0,200),subjectId:'',subjectName:'',due:due||plus(today,1),...(time?{time}:{}),dateFound,event:{kind,...(endTime&&time&&(endTime>time||lateNight(time,endTime))?{endTime}:{}),repeatDays,...(repeatLabel?{repeatLabel}:{}),until:until||plus(due||today,70),kidIds,people:names,...(location?{location}:{})}}
}

const TODO_START=/^\s*(?:to-?\s?do|remember to|reminder)\s*[:\-–]?\s+/i
const CHORE=/\b(clean(?:ing)?|tidy|groceries|grocery|shopping|laundry|trash|garbage|recycling|bins?|vacuum|dishes|dishwasher|mow|lawn|water (?:the )?plants|pay|bills?|rent|buy|order|return|sign|permission slip|pack|feed the|walk the dog|sheets|chores?|errands?|wash the car|meal prep|call)\b/i
// A time: "5pm", "10:30", "at 4", "9-11", noon, or a bare hour after a weekday ("fri 6").
const CLOCK=new RegExp(String.raw`\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b|\bat\s+\d{1,2}\b|(?<![\d/-])\b\d{1,2}\s*[-–]\s*\d{1,2}\b(?![\d/-])|\b(?:noon|midnight)\b|${DAY}\.?\s+\d{1,2}\b(?!\s*(?:st|nd|rd|th)\b|\s*\/)`,'i')
// Schoolwork words: a line with one is homework, even when it starts like an errand ("order of operations worksheet").
const SCHOOLWORK=/\b(homework|worksheet|essay|assignment|read(?:ing)?\s+ch|chapter|study(?:\s+for)?|flashcards?|problems?|packet|lab report|lab|pages?)\b/i
const ordinalDay=(n:number,today:string)=>{const [y,m,d]=today.split('-').map(Number),days=(yy:number,mm:number)=>new Date(Date.UTC(yy,mm,0)).getUTCDate();let yy=y,mm=m;if(n<d){mm++;if(mm>12){mm=1;yy++}}return yy+'-'+pad(mm)+'-'+pad(Math.min(n,days(yy,mm)))}

/** A family to-do in one line: a chore or errand with no time ("clean house every sat", "trash out every
 * other tue", "pay rent on the 1st every month", "buy poster board for Emma"), or anything starting with
 * "to-do:" or "remember to". Its day is optional; without one it's for any day. */
export function parseQuickTodo(text:string,today:string,people:Person[]):QuickAddGuess|null{
 const marked=TODO_START.test(text)
 if(!marked&&(!CHORE.test(text)||CLOCK.test(text)||isExam(text)||SCHOOLWORK.test(text)))return null
 let rest=' '+text.replace(TODO_START,'').replace(/\s+/g,' ').trim()+' '
 const take=(re:RegExp)=>{const m=rest.match(re);if(m)rest=rest.replace(m[0],' ');return m}
 let repeat:TodoRepeat|undefined,due='',monthDay:number|undefined,m:RegExpMatchArray|null
 if(take(/\b(?:every\s+(?:other|2(?:nd)?|two)\s+weeks?|biweekly|fortnightly)\b/i))repeat='2weeks'
 else if(take(/\b(?:every|each)\s+month\b|\bmonthly\b/i))repeat='month'
 else if(take(/\b(?:every|each)\s+week\b|\bweekly\b/i))repeat='week'
 // "every other Tue", "every Sat", "Saturdays", "on Sat", "sat".
 if((m=take(new RegExp(String.raw`\b(?:(every|each)\s+(other\s+)?|on\s+)?${DAY}(s)?\b\.?`,'i')))){
  if(m[2])repeat='2weeks';else if((m[1]||m[4])&&!repeat)repeat='week'
  const want=DAYS.indexOf(m[3].slice(0,3).toLowerCase()),now=new Date(today+'T12:00:00').getDay()
  due=plus(today,(want-now+7)%7)
 }else if(take(/\b(?:on\s+)?(?:today|tonight)\b/i))due=today
 else if(take(/\b(?:on\s+)?(?:tomorrow|tmrw|tmr)\b/i))due=plus(today,1)
 else if((m=take(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i))&&Number(m[1])>=1&&Number(m[1])<=31){monthDay=Number(m[1]);due=ordinalDay(monthDay,today)}
 else{const dt=rest.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/i);const found=dt?dateFrom(dt[0].replace(/sept/i,'sep'),today,plus(today,365),'mdy'):'';if(dt&&found){rest=rest.replace(new RegExp(String.raw`(?:\b(?:on|by)\s+)?`+dt[0].replace(/[.*+?^${}()|[\]\\/]/g,'\\$&'),'i'),' ');due=found}}
 if(repeat&&!due)due=today
 // For whom: one kid ("for Emma", or her name).
 let kid:Person|undefined
 for(const p of people){const n=p.name.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(!n)continue
  // "Emma's party" keeps her name in the words; "for Emma" or "Emma" alone just says who it's for.
  if(new RegExp(String.raw`\b${n}(?:'s|’s)\s+\w`,'i').test(rest)){kid=p;break}
  const re=new RegExp(String.raw`(?:\bfor\s+)?\b${n}(?:'s|’s)?\b`,'i');if(re.test(rest)){rest=rest.replace(re,' ');kid=p;break}}
 let title=rest.replace(/\bdue\b/gi,' ').replace(/\s+/g,' ').replace(/^[\s,:;&-]+|[\s,:;&-]+$/g,'').replace(/\s+(?:for|on|every|each|by)$/i,'').trim()
 if(!title)return null
 title=title[0].toUpperCase()+title.slice(1)
 return {key:'familyTodos',title:title.slice(0,300),subjectId:'',subjectName:'',due,dateFound:!!due,todo:{...(repeat?{repeat}:{}),...(kid?{kidId:kid.id,kidName:kid.name}:{}),...(repeat==='month'&&monthDay?{monthDay}:{})}}
}
