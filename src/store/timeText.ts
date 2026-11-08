/** Times as people type and read them (components/TimeField). parseTime: "3:30 pm", "330p", "3p", "15:30",
 * "1530", "noon", "midnight" to "HH:MM" ("" for blank, null when it isn't a time); a bare 1-12 is the likely
 * one (1-6 PM, 7-11 AM; after `after`, the first one later than it). showTime: "HH:MM" to "3:30 PM". */
export function parseTime(text:string,after?:string):string|null{
 const t=text.trim().toLowerCase().replace(/\s+/g,' ').replace(/\./g,'')
 if(!t)return ''
 if(/^(noon|midday)$/.test(t))return '12:00'
 if(t==='midnight')return '00:00'
 const m=/^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/.exec(t)
 if(!m)return null
 const h=Number(m[1]);const min=m[2]?Number(m[2]):0,mer=m[3]?.[0]
 if(min>59||h>23)return null
 const fmt=(hh:number)=>String(hh).padStart(2,'0')+':'+String(min).padStart(2,'0')
 if(mer){if(h<1||h>12)return null;return fmt(mer==='a'?h%12:h%12+12)}
 // Written as a 24-hour time ("08:00", "15:30", "0" hours): as written.
 if(h===0||h>12||m[1].length===2&&m[1][0]==='0')return fmt(h)
 // 1-12 with no AM/PM: the likely one. An end time is the first one after its start.
 const am=h%12,pm=h%12+12
 if(after&&/^\d{2}:\d{2}$/.test(after)){const a=Number(after.slice(0,2))*60+Number(after.slice(3,5));return fmt(am*60+min>a?am:pm*60+min>a?pm:am)}
 if(h===12)return fmt(12)
 return fmt(h<=6?pm:am)
}
export const showTime=(v:string)=>{if(!/^\d{2}:\d{2}$/.test(v))return '';const h=Number(v.slice(0,2)),m=v.slice(3);return (h%12||12)+':'+m+' '+(h<12?'AM':'PM')}
