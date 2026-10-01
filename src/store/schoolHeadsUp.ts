import type {AppData} from './model'
import {schoolDay} from './schoolCalendar'
import {addDays} from './studyScheduler'

/** Days off and early releases coming up on a school calendar, so a family hears about them ahead:
 * a banner on the Sanctuary and Planner a week out, and lock-screen reminders a week before and the
 * evening before. Only days that would have been school days count (not weekends or summer), and a run
 * of them (Thanksgiving Wednesday–Friday, a break across a weekend) is one item. */
export type SchoolChange={key:string;kind:'off'|'early';start:string;end:string;days:number;label:string;school:string}

const weekday=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay()

export function schoolChanges(data:Pick<AppData,'studySeasons'>,profileId:string,from:string,to:string):SchoolChange[]{
 const out:SchoolChange[]=[]
 for(const s of data.studySeasons.filter(s=>s.profileId===profileId&&s.active&&s.school)){
  const c=s.school!
  let run:SchoolChange|null=null
  // A few days before `from` too, so a break already under way isn't announced as starting mid-way.
  for(let d=addDays(from,-7);d<=addDays(to,14)&&d<=s.end;d=addDays(d,1)){
   if(!c.weekdays.includes(weekday(d))||d<s.start||d>c.lastClassDate)continue
   const day=schoolDay(s,d),e=day?.exception
   const kind=day?.closed&&e&&(e.kind==='holiday'||e.kind==='snow')?'off':e?.kind==='half'&&!day?.closed?'early':null
   const label=(e?.label||(kind==='early'?'Early release':'No school')).trim()
   if(kind&&run&&run.kind===kind&&run.label===label){run.end=d;run.days++;continue}
   if(run)out.push(run)
   run=kind?{key:s.id+':'+kind+':'+d,kind,start:d,end:d,days:1,label,school:c.name}:null
  }
  if(run)out.push(run)
 }
 return out.filter(r=>r.start>=from&&r.start<=to).sort((a,b)=>a.start.localeCompare(b.start)||a.school.localeCompare(b.school))
}

const short=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
/** "No school Thu, Oct 9 – Fri, Oct 10" / "Early release Wed, Oct 15". */
export const changeTitle=(c:SchoolChange)=>(c.kind==='off'?'No school ':'Early release ')+short(c.start)+(c.end!==c.start?' – '+short(c.end):'')
/** The words after the date: the school's reason, unless it just repeats the title. */
export const changeDetail=(c:SchoolChange)=>[/^(no school|early release)$/i.test(c.label)?'':c.label,c.school].filter(Boolean).join(' · ')
