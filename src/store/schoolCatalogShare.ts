import {uid,dayNames,type StudySeason} from './model'
import type {SchoolCalendar} from './schoolCalendar'
import type {SharedCatalogRow} from './supabaseRemote'

/** Only the calendar (dates, holidays, rotation pattern) is ever shared — never a student's own classes, subjects, or assignments. */
export type SharedCalendarPayload={name:string;start:string;end:string;school:SchoolCalendar}

export function seasonToCatalogEntry(season:StudySeason,options:{label:string;town?:string;source?:string;url?:string}):Omit<SharedCatalogRow,'created_at'>{
 if(!season.school)throw new Error('Only a school or college calendar can be shared — not a plain weekly schedule.')
 const label=options.label.trim()
 if(!label)throw new Error('Give this calendar a name before sharing it.')
 const slug=label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-+|-+$)/g,'').slice(0,60)||'school'
 const payload:SharedCalendarPayload={name:season.name,start:season.start,end:season.end,school:season.school}
 return {id:slug+'-'+Date.now().toString(36),label,kind:season.school.pattern==='weekly'?'college':'school',town:options.town?.trim()||undefined,source:options.source?.trim()||undefined,url:options.url?.trim()||undefined,data:payload}
}

function isSharedCalendarPayload(value:unknown):value is SharedCalendarPayload{
 if(!value||typeof value!=='object')return false
 const v=value as Record<string,unknown>
 return typeof v.name==='string'&&typeof v.start==='string'&&typeof v.end==='string'&&!!v.school&&typeof v.school==='object'
}

/** Builds a fresh, inactive draft season from a catalog row — never overwrites anything the person already has. */
export function catalogRowToSeason(profileId:string,row:SharedCatalogRow):StudySeason{
 if(!isSharedCalendarPayload(row.data))throw new Error('This catalog entry is not readable by this version of KONO.')
 const school=row.data.school
 const cycle=school.pattern==='weekly'?[...dayNames]:school.cycle
 return {id:uid('season'),profileId,name:row.data.name,start:row.data.start,end:row.data.end,active:false,week:Object.fromEntries(cycle.map(d=>[d,[]])),school:{...school,catalogId:row.id,catalogRevision:row.created_at??''}}
}
