import {peopleOf,type AppData,type CalendarEvent} from './model'

/** What KONO remembers about an event typed again ("soccer practice"): the most recent one with the same
 * name in this plan, and its time, place, travel time, driver, kind and who it's for. */
export type Remembered=Pick<CalendarEvent,'time'|'endTime'|'location'|'travelMinutes'|'driver'|'kind'>&{kidIds:string[];date:string}
const key=(title:string)=>title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
export function rememberEvent(data:Pick<AppData,'calendarEvents'>,profileId:string,title:string):Remembered|undefined{
 const want=key(title)
 if(want.length<3)return undefined
 const last=data.calendarEvents.filter(e=>e.profileId===profileId&&!e.planFor&&key(e.title)===want).sort((a,b)=>b.date.localeCompare(a.date))[0]
 if(!last||!(last.time||last.location||last.driver||peopleOf(last).length))return undefined
 return {date:last.date,kind:last.kind,kidIds:peopleOf(last),...(last.time?{time:last.time}:{}),...(last.endTime?{endTime:last.endTime}:{}),...(last.location?{location:last.location}:{}),...(last.travelMinutes?{travelMinutes:last.travelMinutes}:{}),...(last.driver?{driver:last.driver}:{})}
}
