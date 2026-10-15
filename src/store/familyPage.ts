import type {AppData,Kid} from './model'
import {classTime} from './classSchedule'
import {holidayOn} from './schoolCalendar'
import {specialOn,upcomingSpecial,daysAwayLabel} from './specialDays'

/** The view-only family page (Settings › Family › Share with grandparents): the next two weeks of
 * events, tests, birthdays, countdowns and school holidays, as plain HTML with no script, for anyone
 * holding the link. Homework, notes, classes and who's driving stay private. */
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const color=(c:string|undefined)=>c&&/^#[0-9a-f]{3,8}$/i.test(c)?c:'#c76b8f'
const plus=(date:string,n:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const dayName=(date:string,today:string)=>date===today?'Today':date===plus(today,1)?'Tomorrow':new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'})

type Row={time?:string;endTime?:string;title:string;kids:Kid[];location?:string;icon:string}

export function familyPageHtml(data:AppData,profileId:string,today:string,days=14):string{
 const profile=data.profiles.find(p=>p.id===profileId)
 const kids=data.kids.filter(k=>k.profileId===profileId)
 // Each kid's own plan counts as theirs.
 const planKid=new Map(data.profiles.filter(p=>p.kidId&&kids.some(k=>k.id===p.kidId)).map(p=>[p.id,p.kidId!]))
 const mine=(x:{profileId:string})=>x.profileId===profileId||planKid.has(x.profileId)
 const who=(x:{profileId:string;kidId?:string;kidIds?:string[]})=>{const ids=x.kidIds?.length?x.kidIds:x.kidId?[x.kidId]:planKid.has(x.profileId)?[planKid.get(x.profileId)!]:[];return ids.map(id=>kids.find(k=>k.id===id)).filter((k):k is Kid=>!!k)}
 const rowsOn=(date:string):Row[]=>[
  ...data.calendarEvents.filter(e=>mine(e)&&e.date===date).map((e):Row=>({time:e.time,endTime:e.endTime,title:e.title,kids:who(e),location:e.location,icon:''})),
  ...data.exams.filter(e=>mine(e)&&e.due===date&&!e.done).map((e):Row=>({title:e.title,kids:who(e),icon:'📝 '})),
 ].sort((a,b)=>(a.time??'99').localeCompare(b.time??'99')||a.title.localeCompare(b.title))
 const scope={activeProfileId:profileId,studySeasons:data.studySeasons}
 const coming=upcomingSpecial(data,profileId,today,120).slice(0,6)
 const kidName=(id?:string)=>id?kids.find(k=>k.id===id):undefined
 const person=(k:Kid)=>`<span class="who" style="--c:${color(k.color)}">${esc(k.emoji?k.emoji+' ':'')}${esc(k.name)}</span>`
 const title=profile?.label?.trim()||'Our family'
 const body=Array.from({length:days},(_,i)=>plus(today,i)).map(date=>{
  const rows=rowsOn(date),special=specialOn(data,profileId,date),holiday=holidayOn(scope,date)
  if(!rows.length&&!special.length&&!holiday)return ''
  return `<section><h2>${esc(dayName(date,today))}</h2>${holiday?`<p class="banner">🏖️ No school: ${esc(holiday)}</p>`:''}${special.map(x=>`<p class="banner" style="--c:${color(kidName(x.day.kidId)?.color)}">${esc(x.icon)} ${esc(x.label)}</p>`).join('')}<ul>${rows.map(r=>`<li style="--c:${color(r.kids[0]?.color)}"><span class="time">${r.time?esc(classTime(r.time))+(r.endTime?'<small>–'+esc(classTime(r.endTime))+'</small>':''):'All day'}</span><span class="what"><strong>${esc(r.icon+r.title)}</strong>${r.kids.length?' '+r.kids.map(person).join(' '):''}${r.location?`<small>📍 ${esc(r.location)}</small>`:''}</span></li>`).join('')}</ul></section>`
 }).join('')
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="900"><title>${esc(title)} · KONO</title><style>
:root{--bg:#fbf6f1;--card:#fff;--ink:#3a2b33;--muted:#6f5d66;--line:#ecdde3}
@media(prefers-color-scheme:dark){:root{--bg:#1d171b;--card:#2a2227;--ink:#f3e9ee;--muted:#c9b8c1;--line:#3d3238}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif}
main{max-width:720px;margin:0 auto;padding:20px 16px 40px}header h1{margin:0;font-size:1.7rem}header p{margin:4px 0 16px;color:var(--muted)}
.coming{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px;padding:0;list-style:none}.coming li{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-weight:600}.coming b{margin-left:6px;color:var(--muted)}
section{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px 16px;margin:0 0 12px}h2{margin:0 0 8px;font-size:1.15rem}
section ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}section li{display:grid;grid-template-columns:5.6em 1fr;gap:10px;padding:8px 10px;border-radius:12px;border-left:5px solid var(--c);background:color-mix(in srgb,var(--c) 10%,var(--card))}
.time{font-weight:700;font-variant-numeric:tabular-nums}.time small{display:block;font-weight:500;color:var(--muted)}.what small{display:block;color:var(--muted)}
.who{display:inline-block;margin-left:4px;padding:0 8px;border-radius:999px;font-size:.85em;font-weight:600;background:color-mix(in srgb,var(--c) 22%,var(--card))}
.banner{margin:0 0 8px;padding:8px 12px;border-radius:12px;font-weight:700;background:color-mix(in srgb,var(--c,#8fb3d9) 20%,var(--card))}
.empty{color:var(--muted)}footer{color:var(--muted);font-size:.85rem;text-align:center;margin-top:18px}
</style></head><body><main><header><h1>${esc(title)}</h1><p>The next two weeks, from KONO. This page updates on its own.</p></header>${coming.length?`<ul class="coming" aria-label="Coming up">${coming.map(x=>`<li>${esc(x.icon)} ${esc(x.label)}<b>${esc(daysAwayLabel(x.daysAway))}</b></li>`).join('')}</ul>`:''}${body||'<p class="empty">Nothing on the calendar for the next two weeks.</p>'}<footer>Shared with you from KONO · view only</footer></main></body></html>`
}

/** Today's date where the family lives (the link carries their time zone), or UTC if it's unknown. */
export function todayIn(timeZone:string|undefined,now=new Date()):string{
 try{return new Intl.DateTimeFormat('en-CA',{timeZone:timeZone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}catch{return now.toISOString().slice(0,10)}
}
