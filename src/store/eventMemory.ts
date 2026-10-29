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

/** "Same as last Thursday?": what was on this weekday in the last few weeks (most recent first, one per
 * name, none already on the day), so adding to a day can repeat one in a tap. */
export type Repeatable=Remembered&{title:string}
export function sameWeekdayBefore(data:Pick<AppData,'calendarEvents'>,profileId:string,date:string,weeks=4):Repeatable[]{
 const at=(n:number)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-7*n);return d.toISOString().slice(0,10)}
 const mine=data.calendarEvents.filter(e=>e.profileId===profileId&&!e.planFor)
 const seen=new Set(mine.filter(e=>e.date===date).map(e=>key(e.title))),out:Repeatable[]=[]
 for(let w=1;w<=weeks&&out.length<4;w++)for(const e of mine.filter(x=>x.date===at(w)).sort((a,b)=>(a.time??'').localeCompare(b.time??''))){
  const k=key(e.title);if(!k||seen.has(k)||out.length>=4)continue;seen.add(k)
  out.push({title:e.title,date:e.date,kind:e.kind,kidIds:peopleOf(e),...(e.time?{time:e.time}:{}),...(e.endTime?{endTime:e.endTime}:{}),...(e.location?{location:e.location}:{}),...(e.travelMinutes?{travelMinutes:e.travelMinutes}:{}),...(e.driver?{driver:e.driver}:{})})
 }
 return out
}
