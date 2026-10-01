import {dateFrom} from './dateText'

/** "＋ Add" › Type it: one line like "bio worksheet due fri" or "math test thursday at 9" becomes an
 * assignment or exam with its class, date and (for assignments) a planned time. What's left after
 * taking those out is the title. Nothing is saved until the person presses Add, after seeing this. */
export type QuickAddGuess={key:'tasks'|'exams';title:string;subjectId:string;subjectName:string;due:string;time?:string;dateFound:boolean}

const DAYS=['sun','mon','tue','wed','thu','fri','sat']
const DAY=String.raw`(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)`
const EXAM=/\b(test|quiz|exam|midterm|final|finals)\b/i
// Short forms students type for their classes, matched against the start of a class's own name.
const SHORT:Record<string,string[]>={bio:['biology','bio'],chem:['chemistry','chem'],phys:['physics'],sci:['science'],math:['math','algebra','geometry','calculus','precalc','pre-calculus','statistics','trig'],alg:['algebra'],geo:['geometry'],calc:['calculus','ap calculus'],stats:['statistics','ap statistics'],eng:['english'],ela:['english','ela'],lit:['literature','english'],hist:['history','us history','world history'],apush:['ap us history','us history','apush'],gov:['government','civics'],econ:['economics'],span:['spanish'],fr:['french'],french:['french'],lat:['latin'],cs:['computer science'],comp:['computer science'],art:['art','ceramics','drawing','studio art'],pe:['pe','physical education','gym'],gym:['pe','physical education','gym'],health:['health'],music:['music','band','chorus','orchestra'],psych:['psychology']}
const pad=(n:number)=>String(n).padStart(2,'0')
const iso=(d:Date)=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())
const plus=(date:string,days:number)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return iso(d)}

export function parseQuickAdd(text:string,subjects:{id:string;name:string}[],today:string):QuickAddGuess{
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
 const key=EXAM.test(text)?'exams':'tasks'
 let title=rest.replace(/\s+/g,' ').replace(/^[\s,:;-]+|[\s,:;-]+$/g,'').trim()
 if(!title)title=(subjectName||'New')+' '+(key==='exams'?'test':'assignment')
 title=title[0].toUpperCase()+title.slice(1)
 return {key,title:title.slice(0,200),subjectId,subjectName,due:due||plus(today,1),...(time&&key==='tasks'?{time}:{}),dateFound:!!due}
}
