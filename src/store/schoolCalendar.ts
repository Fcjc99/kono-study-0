import type {StudySeason} from './model'
const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
import {addDays} from './studyScheduler'

export type SchoolException={id:string;start:string;end:string;kind:'holiday'|'snow'|'half'|'exam'|'makeup'|'notice';label:string;audience:'all'|'seniors';cycleDay?:string;bells?:Record<string,{start:string;end:string}>}
export type SchoolCalendar={pattern?:'weekly'|'rotation'|'elevator';catalogId?:string;catalogRevision?:string;program?:string;name:string;grade:string;cycle:string[];anchorDate:string;anchorDay:string;weekdays:number[];snowAdvances:boolean;lastClassDate:string;exceptions:SchoolException[]}
const weekday=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay()
export function schoolException(s:StudySeason,date:string){
 const matches=s.school?.exceptions.filter(x=>x.start<=date&&x.end>=date&&(x.audience==='all'||s.school?.grade==='12'))??[]
 return matches.find(x=>x.kind!=='notice')??matches.at(-1)
}
function advances(s:StudySeason,date:string){
 const c=s.school!,e=schoolException(s,date)
 if(e?.kind==='makeup')return true
 if(!c.weekdays.includes(weekday(date)))return false
 if(e?.kind==='holiday')return false
 if(e?.kind==='snow')return c.snowAdvances
 if(date>c.lastClassDate&&e?.kind!=='exam')return false
 return true
}
export type SchoolDay={label:string;cycleDay?:string;closed:boolean;special:boolean;exception?:SchoolException}
const cache=new WeakMap<StudySeason,Map<string,SchoolDay>>()
export function schoolDay(s:StudySeason,date:string):SchoolDay|undefined{
 const c=s.school;if(!c||date<s.start||date>s.end)return
 let days=cache.get(s)
 if(!days){
  days=new Map();let index=c.cycle.indexOf(c.anchorDay)
  // Count backwards from the known school day, then walk forwards once. Civil dates avoid DST.
  for(let d=s.start;d<c.anchorDate;d=addDays(d,1))if(advances(s,d))index--
  for(let d=s.start;d<=s.end;d=addDays(d,1)){
   const e=schoolException(s,d),step=advances(s,d)
   if(d===c.anchorDate)index=c.cycle.indexOf(c.anchorDay)
   if(e?.cycleDay)index=c.cycle.indexOf(e.cycleDay)
   const cycleDay=c.pattern==='weekly'?(e?.cycleDay??dayNames[weekday(d)]):c.cycle[((index%c.cycle.length)+c.cycle.length)%c.cycle.length]
   const closed=e?.kind==='holiday'||e?.kind==='snow'||(!c.weekdays.includes(weekday(d))&&e?.kind!=='makeup')||(d>c.lastClassDate&&e?.kind!=='exam'&&e?.kind!=='makeup')
   const notices=c.exceptions.filter(x=>x.kind==='notice'&&x.start<=d&&x.end>=d&&(x.audience==='all'||c.grade==='12')).map(x=>x.label)
   const label=(closed?(e?.label||'No school'):(cycleDay+(e&&e.kind!=='notice'?' · '+e.label:'')+(e?.kind==='notice'?' · '+e.label:'')))+(e?.kind!=='notice'&&notices.length?' · '+notices.join(' · '):'')
   days.set(d,{label,cycleDay:closed?undefined:cycleDay,closed,special:!!e&&['half','exam'].includes(e.kind),exception:e})
   if(step)index++
  }
  cache.set(s,days)
 }
 return days.get(date)
}
export function schoolDayLabels(data:{activeProfileId:string;studySeasons:StudySeason[]},date:string){
 return data.studySeasons.filter(s=>s.active&&s.profileId===data.activeProfileId&&s.school).flatMap(s=>{const d=schoolDay(s,date);return d?[s.school!.name+': '+d.label]:[]})
}
export function validateSchool(c:SchoolCalendar,start:string,end:string){
 const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s
 const text=(s:unknown,max:number)=>typeof s==='string'&&s.length<=max
 if(!c||!text(c.name,200)||!c.name.trim()||!text(c.grade,20)||!Array.isArray(c.cycle)||c.cycle.length<2||c.cycle.length>14||c.cycle.some(x=>!text(x,30)||!x.trim()||['__proto__','prototype','constructor'].includes(x))||new Set(c.cycle).size!==c.cycle.length)throw Error('Check the school name and unique rotation day names.')
 if(c.pattern!==undefined&&!['weekly','rotation','elevator'].includes(c.pattern))throw Error('Unknown schedule pattern.')
 if(c.pattern==='weekly'&&JSON.stringify(c.cycle)!==JSON.stringify(dayNames))throw Error('Weekly calendars must use the seven weekdays.')
 for(const value of [c.catalogId,c.catalogRevision,c.program])if(value!==undefined&&!text(value,200))throw Error('Invalid calendar source or program.')
 if(!c.grade.trim())throw Error('Choose the student grade so grade-specific school dates apply correctly.')
 if(!date(start)||!date(end)||end<start||Math.round((Date.parse(end)-Date.parse(start))/86400000)>550)throw Error('A school calendar must cover at most 550 days.')
 if(c.pattern!=='weekly'&&(!date(c.anchorDate)||c.anchorDate<start||c.anchorDate>end||!c.cycle.includes(c.anchorDay)))throw Error('Choose a known rotation day inside this school year.')
 if(!date(c.lastClassDate)||c.lastClassDate<start||c.lastClassDate>end)throw Error('Last regular class must be inside the school year.')
 if(!Array.isArray(c.weekdays)||!c.weekdays.length||c.weekdays.some(x=>!Number.isInteger(x)||x<0||x>6)||new Set(c.weekdays).size!==c.weekdays.length||typeof c.snowAdvances!=='boolean')throw Error('Choose the school weekdays and snow-day rule.')
 if(!Array.isArray(c.exceptions)||c.exceptions.length>400)throw Error('Use at most 400 school calendar exceptions.')
 const ids=new Set<string>()
 for(const e of c.exceptions){
  if(!e||!text(e.id,150)||!e.id||ids.has(e.id)||!date(e.start)||!date(e.end)||e.start<start||e.end>end||e.end<e.start||!['holiday','snow','half','exam','makeup','notice'].includes(e.kind)||!text(e.label,200)||!['all','seniors'].includes(e.audience)||e.cycleDay!==undefined&&!c.cycle.includes(e.cycleDay))throw Error('Check each calendar exception: dates, label, audience and rotation day.')
  if(e.cycleDay&&e.start!==e.end)throw Error('Use a single date for a rotation correction.')
  ids.add(e.id)
  if(e.bells!==undefined){
   if(!e.bells||typeof e.bells!=='object'||Array.isArray(e.bells)||Object.keys(e.bells).length>30)throw Error('Check the special bell times.')
   for(const [slot,b] of Object.entries(e.bells))if(!slot||slot.length>30||!b||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end)||b.end<=b.start)throw Error('Special bell times need a start and later end.')
  }
 }
 // Overlapping notices are allowed, but conflicting day rules must be resolved, not silently guessed.
 for(let i=0;i<c.exceptions.length;i++)for(let j=i+1;j<c.exceptions.length;j++){
  const a=c.exceptions[i],b=c.exceptions[j]
  if(a.kind!=='notice'&&b.kind!=='notice'&&a.start<=b.end&&b.start<=a.end&&(a.audience===b.audience||a.audience==='all'||b.audience==='all'))throw Error('Two calendar rules overlap. Edit or remove the existing rule first.')
 }
 const temporary={start,end,school:c} as StudySeason
 const e=schoolException(temporary,c.anchorDate)
 if(c.pattern!=='weekly'&&(!c.weekdays.includes(weekday(c.anchorDate))&&e?.kind!=='makeup'||e?.kind==='holiday'||e?.kind==='snow'))throw Error('The known rotation date must be an open school day.')
}
