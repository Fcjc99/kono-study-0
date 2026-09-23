import {blankWeek,uid,type AppData,type Profile} from './model'
import {createSanctuaryProgress} from '../game/progression/progressionEngine'
import {classOccurrences} from './classSchedule'

/** Reuses the same distinguishable, muted color set the rest of the app already leans on for
 * per-item accents, so a kid's color reads as consistent with the app's existing palette choices. */
export const FAMILY_COLORS=['#7ca982','#d9908c','#7f9fc9','#c69a65','#9a86bd','#5da8a1','#ba7f9d','#8b9a72'] as const

/** The next color not already claimed by an existing kid, falling back to cycling the palette once
 * every color is taken (so a 9th kid still gets a color instead of none, just reused). A profile with
 * no explicit color still counts as occupying the first palette color -- that's the exact fallback
 * familyItemsForDate/the Family page render for it, so without this the very first kid added would be
 * assigned that same already-visually-taken color and read as indistinguishable from the default profile. */
export function nextFamilyColor(profiles:readonly Pick<Profile,'color'>[]):string {
 const used=new Set(profiles.map(p=>p.color??FAMILY_COLORS[0]))
 return FAMILY_COLORS.find(c=>!used.has(c))??FAMILY_COLORS[profiles.length%FAMILY_COLORS.length]
}

/** Mirrors the profile-creation bundle from the legacy add-profile flow (a profile alone has nowhere
 * to record a schedule or sanctuary progress) -- a fresh kid profile, a blank study season ready for
 * their weekly schedule, and a sanctuary progress entry so their island can actually render. Does not
 * switch activeProfileId: adding a kid from the Family page should not yank the parent into their
 * profile, unlike switching profiles from the sidebar. */
export function addKidProfile(data:AppData,name:string):AppData {
 const trimmed=name.trim()
 if(!trimmed)throw new Error('Enter a name for this kid.')
 const id=uid('profile'),start=new Date().toISOString().slice(0,10),end=new Date(Date.now()+180*86400000).toISOString().slice(0,10)
 const profile:Profile={id,name:trimmed,label:trimmed+"'s schedule",kind:'custom',start,end,color:nextFamilyColor(data.profiles)}
 return {
  ...data,
  profiles:[...data.profiles,profile],
  studySeasons:[...data.studySeasons,{id:uid('season'),profileId:id,name:profile.label,start,end,active:true,week:blankWeek()}],
  sanctuaryProgress:{...data.sanctuaryProgress,[id]:createSanctuaryProgress(id)},
 }
}

export type FamilyItemKind='task'|'exam'|'event'|'class'
export type FamilyItem={profileId:string;profileName:string;color:string;kind:FamilyItemKind;id:string;title:string;date:string;done:boolean;time?:string}

/** Every visible kid's tasks, exams, calendar events and recurring class occurrences due/scheduled on
 * one date, tagged with which kid and their color -- the whole point of the Family page is seeing
 * everyone at once, not switching the single activeProfileId back and forth. classOccurrences() only
 * reads activeProfileId/studySeasons, so it's called once per kid with a lightweight stand-in object
 * instead of needing any change to that function itself. */
export function familyItemsForDate(data:Pick<AppData,'tasks'|'exams'|'calendarEvents'|'studySeasons'>,profiles:readonly Profile[],date:string):FamilyItem[] {
 return profiles.flatMap(profile=>{
  const color=profile.color??FAMILY_COLORS[0]
  const items:FamilyItem[]=[]
  for(const t of data.tasks)if(t.profileId===profile.id&&t.due===date)items.push({profileId:profile.id,profileName:profile.name,color,kind:'task',id:t.id,title:t.title,date,done:t.done})
  for(const e of data.exams)if(e.profileId===profile.id&&e.due===date)items.push({profileId:profile.id,profileName:profile.name,color,kind:'exam',id:e.id,title:e.title,date,done:e.done})
  for(const ev of data.calendarEvents)if(ev.profileId===profile.id&&ev.date===date)items.push({profileId:profile.id,profileName:profile.name,color,kind:'event',id:ev.id,title:ev.title,date,done:Boolean(ev.done),time:ev.time})
  for(const c of classOccurrences({activeProfileId:profile.id,studySeasons:data.studySeasons},date))items.push({profileId:profile.id,profileName:profile.name,color,kind:'class',id:c.id,title:c.block.label,date,done:false,time:c.displayStart??c.block.start})
  return items
 })
}
