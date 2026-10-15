/** Events with a place and a travel time: when to leave, and a link that opens the place in maps. */
const pad=(n:number)=>String(n).padStart(2,'0')
/** "15:30" with 20 minutes of travel → "15:10" (never before midnight). */
export function leaveBy(time:string|undefined,travelMinutes:number|undefined):string|undefined{
 if(!time||!travelMinutes||!/^\d{2}:\d{2}$/.test(time))return undefined
 const m=Math.max(0,Number(time.slice(0,2))*60+Number(time.slice(3,5))-travelMinutes)
 return pad(Math.floor(m/60))+':'+pad(m%60)
}
/** A maps search for the place, which opens Apple Maps or Google Maps on a phone. */
export const mapsLink=(location:string)=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(location)
export const TRAVEL_CHOICES=[5,10,15,20,30,45,60,90] as const
/** True from the leave-by minute until 10 minutes after, so a tab opened later doesn't nag about a trip long gone. */
export function isLeaveTime(event:{date:string;time?:string;travelMinutes?:number;done?:boolean},today:string,nowMinutes:number):boolean{
 const at=leaveBy(event.time,event.travelMinutes)
 if(event.done||event.date!==today||!at)return false
 const late=nowMinutes-(Number(at.slice(0,2))*60+Number(at.slice(3,5)))
 return late>=0&&late<=10
}
