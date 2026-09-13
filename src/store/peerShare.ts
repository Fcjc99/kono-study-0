import type {AppData, CalendarEventKind, SanctuaryDecorState} from './model'
import type {SanctuaryFeatureId} from '../game/progression/types'
import {createSanctuaryProgress} from '../game/progression/progressionEngine'

export type SharedSubject={id:string;name:string;color:string;teacher?:string;room?:string}
export type SharedTask={id:string;subjectId:string;title:string;due:string;done:boolean}
export type SharedExam={id:string;subjectId:string;title:string;due:string;done:boolean}
export type SharedEvent={id:string;date:string;title:string;kind:CalendarEventKind;subjectId?:string}
export type SharedSanctuaryView={unlockedStage:number;featureStages:Record<SanctuaryFeatureId,number>;decor:SanctuaryDecorState}
export type SharedSchoolSnapshot={updatedAt:string;profileLabel:string;subjects:SharedSubject[];tasks:SharedTask[];exams:SharedExam[];events:SharedEvent[];sanctuary:SharedSanctuaryView}

/** Only the active profile's school-related work: classes, assignments, exams and
 * non-personal calendar events, plus a read-only view of the Sanctuary island
 * (growth stage and decoration — never the task-level progress ledger behind it).
 * Reminders (kind 'personal'), notes and settings are never included here. */
export function buildSharedSnapshot(data:AppData):SharedSchoolSnapshot{
 const profileId=data.activeProfileId
 const profile=data.profiles.find(p=>p.id===profileId)
 const progress=data.sanctuaryProgress[profileId]??createSanctuaryProgress(profileId)
 const decor=data.sanctuaryDecor[profileId]??{profileId,placements:[]}
 return {
  updatedAt:new Date().toISOString(),
  profileLabel:profile?.label??profile?.name??'',
  subjects:data.subjects.filter(s=>s.profileId===profileId).map(s=>({id:s.id,name:s.name,color:s.color,teacher:s.teacher,room:s.room})),
  tasks:data.tasks.filter(t=>t.profileId===profileId).map(t=>({id:t.id,subjectId:t.subjectId,title:t.title,due:t.due,done:t.done})),
  exams:data.exams.filter(e=>e.profileId===profileId).map(e=>({id:e.id,subjectId:e.subjectId,title:e.title,due:e.due,done:e.done})),
  events:data.calendarEvents.filter(e=>e.profileId===profileId&&e.kind!=='personal').map(e=>({id:e.id,date:e.date,title:e.title,kind:e.kind,subjectId:e.subjectId})),
  sanctuary:{unlockedStage:progress.unlockedStage,featureStages:progress.featureStages,decor},
 }
}

export function isSharedSnapshot(value:unknown):value is SharedSchoolSnapshot{
 if(!value||typeof value!=='object')return false
 const v=value as Record<string,unknown>
 return typeof v.updatedAt==='string'&&typeof v.profileLabel==='string'&&Array.isArray(v.subjects)&&Array.isArray(v.tasks)&&Array.isArray(v.exams)&&Array.isArray(v.events)
}

/** Builds a full SanctuaryProgressState for GardenCard from the pruned shared view —
 * never the friend's real task ledger, just enough to render their island's growth stage. */
export function sharedSanctuaryProgress(view:SharedSanctuaryView,profileId:string){
 const base=createSanctuaryProgress(profileId)
 return {...base,unlockedStage:view.unlockedStage,readyStage:view.unlockedStage,featureStages:view.featureStages}
}
