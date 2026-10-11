import type {AppData} from './model'
import {classKid,classOccurrences,classTime} from './classSchedule'
import {schoolDay} from './schoolCalendar'
import {addDays} from './studyScheduler'

/** "Ask KONO": spoken questions about the plan, answered on screen and out loud. Everything comes from
 * the plan already on the device; nothing is sent anywhere. */
export type KonoAnswer={title:string;lines:string[];speech:string}
export type KonoQuestion={kind:'today'|'tomorrow'|'week'}|{kind:'due';query:string}|{kind:'unknown'}

const weekdayName=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'})
const longDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})
const daysBetween=(a:string,b:string)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5)
/** "and" between the last two: "Biology, Algebra and Art". */
const join=(items:string[])=>items.length<2?items.join(''):items.slice(0,-1).join(', ')+' and '+items.at(-1)

/** What someone asked, from what they said or typed. Words naming a time ("today", "this week") pick
 * the answer; anything else left over ("bio essay") is something to look up. */
export function readQuestion(text:string):KonoQuestion{
 const t=text.toLowerCase().replace(/[’']/g,'').trim()
 const query=queryWords(t).filter(w=>!TIME.has(w)).join(' ')
 if(query)return {kind:'due',query}
 if(/\btomorrow\b/.test(t))return {kind:'tomorrow'}
 if(/\bweek\b/.test(t))return {kind:'week'}
 if(/\b(today|tonight|schedule|day)\b/.test(t))return {kind:'today'}
 return {kind:'unknown'}
}

const STOP=new Set(['when','whens','is','are','my','the','a','an','due','what','whats','which','do','does','i','have','for','it','its','next','our','class','kono','hey','tell','me','about','please','assignment','homework','by','on','of','to','again','in','at','there','any','anything','thing','things','stuff','coming','up','got','going','show','read','say','was','were','be','will','and','or'])
const TIME=new Set(['today','tonight','tomorrow','this','week','schedule','day','days','now'])
const queryWords=(text:string)=>text.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w&&!STOP.has(w))

/** A day's plan: no school, classes in order, events, and what's due. */
export function dayAnswer(data:AppData,date:string,today:string):KonoAnswer{
 const pid=data.activeProfileId,label=date===today?'Today':date===addDays(today,1)?'Tomorrow':weekdayName(date)
 const kid=(id?:string)=>data.settings.parentMode===true&&id?data.kids.find(k=>k.id===id&&k.profileId===pid)?.name:undefined
 const who=(id?:string)=>{const name=kid(id);return name?name+': ':''}
 const closed=data.studySeasons.filter(s=>s.profileId===pid&&s.active&&s.school).map(s=>schoolDay(s,date)).find(d=>d?.closed&&d.exception)
 const classes=classOccurrences(data,date).filter(c=>c.block.kind!=='break'&&!c.block.skippedDates?.includes(date)&&!c.timePending)
  .map(c=>({start:c.displayStart??c.block.start,label:c.block.label,where:c.block.location,kidId:classKid(c)})).sort((a,b)=>a.start.localeCompare(b.start))
 const events=data.calendarEvents.filter(e=>e.profileId===pid&&e.date===date&&!e.done).sort((a,b)=>(a.time??'99').localeCompare(b.time??'99'))
 const due=data.tasks.filter(t=>t.profileId===pid&&t.due===date&&!t.done),tests=data.exams.filter(e=>e.profileId===pid&&e.due===date&&!e.done)
 const lines:string[]=[],speech:string[]=[]
 const title=label+' · '+longDate(date)
 if(closed?.exception){lines.push('🏖️ No school: '+closed.exception.label);speech.push('There’s no school '+label.toLowerCase()+': '+closed.exception.label+'.')}
 for(const c of classes)lines.push(classTime(c.start)+' · '+who(c.kidId)+c.label+(c.where?' ('+c.where+')':''))
 if(classes.length)speech.push((classes.length===1?'You have one class: ':'You have '+classes.length+' classes. ')+join(classes.slice(0,8).map(c=>who(c.kidId)+c.label+' at '+classTime(c.start)))+'.')
 for(const e of events)lines.push((e.time?classTime(e.time):'All day')+' · '+who(e.kidId)+e.title)
 if(events.length)speech.push((classes.length?'Also, ':'')+join(events.slice(0,6).map(e=>who(e.kidId)+e.title+(e.time?' at '+classTime(e.time):'')))+'.')
 if(tests.length){lines.push('★ Test: '+tests.map(e=>who(e.kidId)+e.title).join(', '));speech.push((tests.length===1?'There’s a test: ':'There are '+tests.length+' tests: ')+join(tests.map(e=>who(e.kidId)+e.title))+'.')}
 if(due.length){lines.push('✎ Due: '+due.map(t=>who(t.kidId)+t.title).join(', '));speech.push((due.length===1?'Due '+label.toLowerCase()+': ':due.length+' things are due: ')+join(due.map(t=>who(t.kidId)+t.title))+'.')}
 // Today: anything already late, so it isn't forgotten.
 const late=date===today?data.tasks.filter(t=>t.profileId===pid&&!t.done&&t.due<today):[]
 if(late.length){lines.push('⚠ Late: '+late.map(t=>who(t.kidId)+t.title).join(', '));speech.push((late.length===1?'And one late assignment: ':'And '+late.length+' late assignments: ')+join(late.slice(0,4).map(t=>who(t.kidId)+t.title))+'.')}
 if(!lines.length){lines.push('Nothing on the plan.');speech.push('Nothing is on your plan '+label.toLowerCase()+'. Enjoy it!')}
 return {title,lines,speech:(label==='Today'||label==='Tomorrow'?label+', '+longDate(date)+'. ':longDate(date)+'. ')+speech.join(' ')}
}

/** Everything due in the next seven days, by day. */
export function weekAnswer(data:AppData,today:string):KonoAnswer{
 const pid=data.activeProfileId,end=addDays(today,7)
 const items=[...data.tasks.filter(t=>t.profileId===pid&&!t.done&&t.due>=today&&t.due<=end).map(t=>({title:t.title,due:t.due,test:false})),...data.exams.filter(e=>e.profileId===pid&&!e.done&&e.due>=today&&e.due<=end).map(e=>({title:e.title,due:e.due,test:true}))].sort((a,b)=>a.due.localeCompare(b.due)||a.title.localeCompare(b.title))
 if(!items.length)return {title:'This week',lines:['Nothing is due in the next seven days.'],speech:'Nothing is due in the next seven days. Nice!'}
 const days=[...new Set(items.map(i=>i.due))]
 const dayLabel=(d:string)=>d===today?'Today':d===addDays(today,1)?'Tomorrow':weekdayName(d)
 return {title:'This week',lines:days.map(d=>dayLabel(d)+': '+items.filter(i=>i.due===d).map(i=>(i.test?'★ ':'')+i.title).join(', ')),
  speech:(items.length===1?'One thing is due this week. ':items.length+' things are due this week. ')+days.map(d=>dayLabel(d)+': '+join(items.filter(i=>i.due===d).map(i=>i.title+(i.test?' (a test)':'')))+'.').join(' ')}
}

/** "When is my bio essay due?": the best match among open assignments, tests and events. */
export function dueAnswer(data:AppData,query:string,today:string):KonoAnswer{
 const pid=data.activeProfileId,words=queryWords(query)
 const subject=(id?:string)=>data.subjects.find(s=>s.id===id)?.name??''
 const pool=[
  ...data.tasks.filter(t=>t.profileId===pid&&!t.done).map(t=>({title:t.title,date:t.due,kind:'assignment' as const,extra:subject(t.subjectId)})),
  ...data.exams.filter(e=>e.profileId===pid&&!e.done).map(e=>({title:e.title,date:e.due,kind:'test' as const,extra:subject(e.subjectId)})),
  ...data.calendarEvents.filter(e=>e.profileId===pid&&!e.done&&e.date>=today).map(e=>({title:e.title,date:e.date,kind:'event' as const,extra:subject(e.subjectId),time:e.time})),
 ].filter(i=>i.date>=addDays(today,-30)&&i.date<=addDays(today,120))
 const hay=(i:{title:string;extra:string})=>queryWords(i.title+' '+i.extra)
 const score=(i:{title:string;extra:string;kind:string})=>words.reduce((n,w)=>n+(hay(i).some(h=>h.startsWith(w)||(w.length>3&&w.startsWith(h)))?1:0)+(/^(test|quiz|exam)s?$/.test(w)&&i.kind==='test'?0.5:0),0)
 const ranked=pool.map(i=>({...i,score:score(i)})).filter(i=>i.score>0).sort((a,b)=>b.score-a.score||a.date.localeCompare(b.date))
 if(!words.length||!ranked.length)return {title:'Hmm…',lines:['I couldn’t find “'+query+'”. Try a word from its name, like “essay” or “bio”.'],speech:'I couldn’t find that one. Try saying a word from its name, like essay or bio.'}
 const best=ranked.filter(i=>i.score===ranked[0].score).slice(0,3)
 const say=(i:typeof best[number])=>{
  const n=daysBetween(today,i.date),when=n===0?'today':n===1?'tomorrow':n===-1?'yesterday':longDate(i.date)
  const verb=i.kind==='test'?'is on':i.kind==='event'?'is on':'is due'
  if(n<0)return i.title+' was due '+(n===-1?'yesterday':longDate(i.date))+', so it’s late.'
  return i.title+' '+(n<=1?(i.kind==='assignment'?'is due ':'is ')+when:verb+' '+when+(n<=14?', in '+n+' days':''))+('time' in i&&i.time?' at '+classTime(i.time):'')+'.'
 }
 const sentences=best.map(say)
 return {title:best.length===1?best[0].title:'I found '+best.length,lines:sentences,speech:sentences.join(' ')}
}

export function answer(data:AppData,question:KonoQuestion,today:string):KonoAnswer|null{
 if(question.kind==='today')return dayAnswer(data,today,today)
 if(question.kind==='tomorrow')return dayAnswer(data,addDays(today,1),today)
 if(question.kind==='week')return weekAnswer(data,today)
 if(question.kind==='due')return dueAnswer(data,question.query,today)
 return null
}

