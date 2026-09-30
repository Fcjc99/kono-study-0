import {eventCategory,type AppData,type CalendarEventKind} from './model'
import type {ClassOccurrence} from './classSchedule'

/** The Planner's source chips: where each thing on the calendar came from, so a whole source can be
 * shown or hidden at once. Each item belongs to exactly one. */
export type PlannerSource='school'|'canvas'|'calendar'|'sports'|'mine'
export const PLANNER_SOURCES:{id:PlannerSource;label:string;title:string}[]=[
 {id:'school',label:'School',title:'Your school or college classes'},
 {id:'canvas',label:'Canvas',title:'From Canvas, Schoology or Google Classroom'},
 {id:'calendar',label:'Google',title:'From Google, Apple or Outlook calendars'},
 {id:'sports',label:'Sports',title:'Practices, games and sports events'},
 {id:'mine',label:'Mine',title:'Things you added in KONO'},
]

/** An assignment, exam, note or event: its import source first, then sports events, else yours. */
export function entrySource(key:string,item:object):PlannerSource{
 const entry=item as {source?:unknown;kind?:unknown}
 if(entry.source==='canvas'||entry.source==='calendar')return entry.source
 if(key==='calendarEvents'&&eventCategory(entry.kind as CalendarEventKind)==='sports')return 'sports'
 return 'mine'
}

/** A class: school and college classes, sports practices, or a weekly activity of your own. */
export function classSource(c:Pick<ClassOccurrence,'season'>):PlannerSource{
 if(c.season.category==='sports')return 'sports'
 return c.season.school?'school':'mine'
}

/** The sources this profile has anything from, in chip order ("Mine" always). */
export function sourcesInPlan(data:AppData):PlannerSource[]{
 const pid=data.activeProfileId,found=new Set<PlannerSource>(['mine'])
 for(const s of data.studySeasons)if(s.profileId===pid)found.add(classSource({season:s}))
 for(const key of ['tasks','exams','calendarEvents'] as const)for(const e of data[key])if(e.profileId===pid)found.add(entrySource(key,e))
 return PLANNER_SOURCES.map(s=>s.id).filter(id=>found.has(id))
}
