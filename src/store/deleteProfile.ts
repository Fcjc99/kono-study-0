import {normalizeData,type AppData} from './model'
/** A confirmed account-owned plan deletion, scoped to exactly one profile. */
export function deleteProfile(data:AppData,id:string):AppData{
 if(!data.profiles.some(p=>p.id===id))throw Error('This plan no longer exists.')
 if(data.profiles.length<2)throw Error('Create another plan before deleting your last plan.')
 const profiles=data.profiles.filter(p=>p.id!==id)
 const progress={...data.sanctuaryProgress};delete progress[id]
 const locations={...data.settings.sanctuaryWeatherLocations};delete locations[id]
 const zips={...data.settings.sanctuaryZipCodes};delete zips[id]
 return normalizeData({...data,profiles,activeProfileId:data.activeProfileId===id?profiles[0].id:data.activeProfileId,
 tasks:data.tasks.filter(x=>x.profileId!==id),notes:data.notes.filter(x=>x.profileId!==id),
 exams:data.exams.filter(x=>x.profileId!==id),subjects:data.subjects.filter(x=>x.profileId!==id),
 calendarEvents:data.calendarEvents.filter(x=>x.profileId!==id),studyPlans:data.studyPlans.filter(x=>x.profileId!==id),
 studySeasons:data.studySeasons.filter(x=>x.profileId!==id),flashcardDecks:data.flashcardDecks.filter(x=>x.profileId!==id),
 trash:data.trash.filter(x=>x.profileId!==id),sanctuaryProgress:progress,
 settings:{...data.settings,sanctuaryWeatherLocations:locations,sanctuaryZipCodes:zips}})
}
