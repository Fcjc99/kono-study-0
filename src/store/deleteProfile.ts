import {createFreshData,normalizeData,type AppData} from './model'
/** A confirmed account-owned plan deletion, scoped to exactly one profile. Every list of things that
 * belong to a plan loses that plan's entries. Kids listed in it move to another of the parent's own
 * plans (their tags and their own plans stay linked); with no own plan left, the kids go and their
 * plans become ordinary plans. */
function without<T>(record:Record<string,T>,id:string){const next={...record};delete next[id];return next}
export function deleteProfile(data:AppData,id:string):AppData{
 const plan=data.profiles.find(p=>p.id===id)
 if(!plan)throw Error('This plan no longer exists.')
 if(data.profiles.length<2)throw Error('Create another plan before deleting your last plan. To clear everything, use Start over.')
 const profiles=data.profiles.filter(p=>p.id!==id)
 const nextOwn=profiles.find(p=>!p.kidId)
 const kids=nextOwn?data.kids.map(k=>k.profileId===id?{...k,profileId:nextOwn.id}:k):data.kids.filter(k=>k.profileId!==id)
 const gone=new Set(data.kids.filter(k=>!kids.some(x=>x.id===k.id)).map(k=>k.id))
 const next:Record<string,unknown>={...data}
 // Any list whose entries carry a profileId (tasks, notes, quizzes, trash, …) drops this plan's.
 for(const [key,value] of Object.entries(data))if(Array.isArray(value)&&key!=='profiles'&&key!=='kids')next[key]=value.filter(x=>!(x&&typeof x==='object'&&(x as {profileId?:unknown}).profileId===id))
 return normalizeData({...next,profiles:profiles.map(p=>p.kidId&&gone.has(p.kidId)?{...p,kidId:undefined}:p),kids,
  activeProfileId:data.activeProfileId===id?(nextOwn??profiles[0]).id:data.activeProfileId,
  sanctuaryProgress:without(data.sanctuaryProgress,id),sanctuaryDecor:without(data.sanctuaryDecor??{},id),konoCare:without(data.konoCare??{},id),
  settings:{...data.settings,sanctuaryWeatherLocations:without(data.settings.sanctuaryWeatherLocations,id),sanctuaryZipCodes:without(data.settings.sanctuaryZipCodes,id)}} as AppData)
}

/** Start over: every plan, kid and setting is cleared and KONO opens like the first time. Sign-in and
 * the automatic cloud backups are kept, so last night's copy can still be downloaded. */
export const startOver=():AppData=>createFreshData()
