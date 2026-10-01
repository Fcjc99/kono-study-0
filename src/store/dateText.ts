/** Reading a date out of a line of text ("10/12", "Oct 12", "2026-10-12"), shared by the schedule importer,
 * quick add and voice add. Kept apart from scheduleImport so quick add doesn't load the whole importer. */
export const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s
export function dateFrom(line:string,start:string,end:string,order:'mdy'|'dmy'){
 const iso=line.match(/\b\d{4}-\d{2}-\d{2}\b/);if(iso)return validDate(iso[0])?iso[0]:''
 const numeric=line.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?\b/)
 const named=line.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i)
 if(!numeric&&!named)return ''
 const month=named?['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[1].slice(0,3).toLowerCase())+1:Number(numeric![order==='mdy'?1:2])
 const day=Number(named?named[2]:numeric![order==='mdy'?2:1]),year=named?.[3]??numeric?.[3]
 const build=(y:string)=>y+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')
 if(year)return validDate(build(year))?build(year):''
 if(!validDate(start)||!validDate(end))return ''
 const candidates=[...new Set([start.slice(0,4),end.slice(0,4)])].map(build).filter(d=>validDate(d)&&d>=start&&d<=end)
 return candidates.length===1?candidates[0]:''
}
