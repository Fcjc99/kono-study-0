import {useEffect,useRef,useState,type FormEvent} from 'react'
import {uid,localDate,dayNames,matchOutcome,peopleOf,type AppData,type CalendarEvent,type Task,type Subtask,type MatchResult} from '../store/model'
import {records,equal,type Collection,type Entry} from '../store/workspace'
import {addDays} from '../store/studyScheduler'
import {leaveBy,mapsLink,TRAVEL_CHOICES} from '../store/leaveBy'
import {REPEATS,repeatDates,weekdayDates,defaultUntil,repeatCopy,applyToSeries,applyToTaskSeries,type Repeat,type SeriesScope} from '../store/eventRepeat'
import {findOpenSlots} from '../store/timeBlocking'
import {classTime} from '../store/classSchedule'
import {shareKindFor} from '../store/itemShare'
import type {PhotoCloud} from '../store/photoStore'
import type {usePlannerRepository} from '../store/repository'
import {labels,type Edit} from '../store/entryLabels'
import {kidOfPlan,kidPlans,moveToWhose} from '../store/familyPlans'
import {lazyPanel} from '../lazyPanel'
import Modal from './Modal'
import BreakIntoSteps from './BreakIntoSteps'
import VoiceInputButton from './VoiceInputButton'
const AssignmentPhotos=lazyPanel(()=>import('./AssignmentPhotos'))
const ShareWithClassmate=lazyPanel(()=>import('./ShareWithClassmate'))

type Store=ReturnType<typeof usePlannerRepository>
const dateLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})

/** The editor for an assignment, exam, note, event, subject or kid (a dialog). Loaded when first opened,
 * so it isn't part of the startup download. Drafts are kept on this device until saved or discarded. */
export default function EntryEditor({edit,data,save,share,photoCloud=null,draftScope,close}:{edit:Edit;data:AppData;save:Store['repository']['update'];share?:Store['repository']|null;photoCloud?:PhotoCloud|null;draftScope:string;close:(saved:boolean,discarded?:boolean,quiet?:boolean)=>void}){
 const [entry,setEntry]=useState(edit.entry),[busy,setBusy]=useState(false),[error,setError]=useState(''),[draftError,setDraftError]=useState('')
 const shareKind=share&&edit.original?shareKindFor(edit.key):null,[sharing,setSharing]=useState(false)
 const bodyRef=useRef<HTMLTextAreaElement>(null)
 const titleKey=edit.key==='subjects'||edit.key==='kids'?'name':'title',note=edit.key==='notes'
 const isNewAssignment=edit.key==='tasks'&&!edit.original
 const extraDatesKey=draftScope+':assignment-dates'
 const [extraDates,setExtraDates]=useState<string[]>(()=>{if(!isNewAssignment)return [];try{const saved=JSON.parse(localStorage.getItem(extraDatesKey)??'[]');return Array.isArray(saved)?saved.filter(d=>typeof d==='string'):[]}catch{return []}})
 // Events: repeat a new or one-off event, or (for one in a series) choose which of the series a change goes to.
 const isEvent=edit.key==='calendarEvents',isTask=edit.key==='tasks',seriesId=(isEvent||isTask)&&edit.original?String(edit.original.recurringId??''):''
 const seriesSize=seriesId?(isEvent?data.calendarEvents:data.tasks).filter(e=>e.recurringId===seriesId&&e.profileId===entry.profileId).length:0
 const [repeat,setRepeat]=useState<Repeat>('none'),[repeatEnd,setRepeatEnd]=useState(''),[scope,setScope]=useState<SeriesScope>('one')
 const eventDate=String(entry.date??''),repeatOn=isEvent&&seriesSize<2&&repeat!=='none'
 const repeatList=repeatOn?repeatDates(eventDate,repeat,repeatEnd||defaultUntil(eventDate)):[]
 // A new assignment can repeat too ("spelling every Monday", "reading log every weekday"), on chosen
 // weekdays, or on dates picked one by one; one assignment is made per date, linked as a series.
 const [taskRepeat,setTaskRepeat]=useState<Repeat|'days'|'pick'>(()=>extraDates.length?'pick':'none'),[taskDays,setTaskDays]=useState<number[]>([])
 const due=String(entry.due??''),taskUntil=repeatEnd||(isNewAssignment&&due?defaultUntil(due):'')
 const taskSeries=!isNewAssignment||!due?[]:taskRepeat==='pick'?extraDates.filter(d=>d&&d!==due):taskRepeat==='days'?weekdayDates(due,taskDays,taskUntil):taskRepeat==='none'?[]:repeatDates(due,taskRepeat,taskUntil)
 const [newSubtask,setNewSubtask]=useState('')
 const saveExtraDates=(next:string[])=>{setExtraDates(next);try{localStorage.setItem(extraDatesKey,JSON.stringify(next))}catch{/* Best effort; the editor is still the source of truth while open. */}}
 const toggleDate=(date:string)=>saveExtraDates((extraDates.includes(date)?extraDates.filter(d=>d!==date):[...extraDates,date]).sort())
 const addSubtask=()=>{const title=newSubtask.trim();if(!title)return;field('subtasks',[...(entry.subtasks as Subtask[]??[]),{id:uid('subtask'),title,done:false}]);setNewSubtask('')}
 const persist=(next:Entry)=>{try{localStorage.setItem(draftScope,JSON.stringify({...edit,entry:next}));setDraftError('');return true}catch{setDraftError('Draft storage is unavailable. Keep this editor open until saved.');return false}}
 // From the family plan, an item can be for a kid: one with a plan of their own gets it in their plan.
 const inFamily=(d:AppData,profileId:string)=>d.activeProfileId===profileId||kidPlans(d,d.activeProfileId).some(x=>x.plan.id===profileId)||d.kids.some(k=>k.profileId===profileId&&d.profiles.some(p=>p.id===d.activeProfileId&&p.kidId===k.id))
 const familyKids=data.kids.filter(k=>k.profileId===data.activeProfileId)
 const planKid=kidOfPlan(data,data.profiles.find(p=>p.id===entry.profileId))?.id
 const whose:string[]=planKid?[planKid]:peopleOf(entry as {kidId?:string;kidIds?:string[]})
 const setWhose=(ids:string[])=>{const next=moveToWhose(data,entry as Entry&{profileId:string},data.activeProfileId,ids) as Entry;persist(next);setEntry(next)}
 const togglePerson=(id:string)=>setWhose(whose.includes(id)?whose.filter(x=>x!==id):[...whose,id])
 const field=(key:string,value:unknown)=>{const next={...entry,[key]:value};persist(next);setEntry(next)}
 const append=(key:string,text:string)=>{const current=String(entry[key]??'');field(key,current.trim()?current+' '+text:text)}
 const format=(before:string,after:string)=>{const textarea=bodyRef.current;if(!textarea)return;const key=note?'body':'notes',body=String(entry[key]??''),start=textarea.selectionStart,end=textarea.selectionEnd;field(key,body.slice(0,start)+before+(body.slice(start,end)||'text')+after+body.slice(end));requestAnimationFrame(()=>textarea.focus())}
 // Closing with nothing changed keeps no draft, so opening the item again (say after dragging it on
 // the week) starts from how it is now.
 const keep=()=>{if(busy)return;if(equal(entry,edit.original??edit.entry)){clearDrafts();close(!!edit.original,true,true);return}if(persist(entry))close(false)}
 const clearDrafts=()=>{try{localStorage.removeItem(draftScope);if(isNewAssignment)localStorage.removeItem(extraDatesKey)}catch{/* Saved record is authoritative. */}}
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(draftError){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[draftError])
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;setBusy(true);setError('')
  const seriesDates=taskSeries
  const recurringId=seriesDates.length?uid('recurring'):undefined
  // Saving an entry -- even unchanged -- is the moment a person actually looked at it, so this is
  // also where a photo-scanned item's needsReview flag clears (see RecordCard/applyAssignmentPhoto).
  const payload={...entry,[titleKey]:String(entry[titleKey]??'').trim(),needsReview:false,...(edit.key==='notes'&&!edit.original?{pinned:true}:{}),...(recurringId?{recurringId}:{})}
  const copies:Entry[]=seriesDates.map(due=>({...payload,id:uid(edit.key),due}))
  if(repeatList.length){const id=uid('recurring');payload.recurringId=id;copies.push(...repeatList.map(date=>repeatCopy(payload as unknown as CalendarEvent,date,id) as unknown as Entry))}
  // A change to one of a series can go to the rest of it too (not the date: each keeps its own).
  const spread=(list:Entry[])=>seriesSize>1&&scope!=='one'?isEvent?applyToSeries(list as unknown as CalendarEvent[],payload as unknown as CalendarEvent,String(edit.original?.date??eventDate),scope) as unknown as Entry[]:applyToTaskSeries(list as unknown as Task[],payload as unknown as Task,String(edit.original?.due??due),scope) as unknown as Entry[]:list
  try{const saved=await save(d=>{if(!inFamily(d,String(entry.profileId))||(edit.original&&!inFamily(d,String(edit.original.profileId))))throw Error('Your profile changed. Reopen the editor.');const current=records(d,edit.key).find(r=>r.id===entry.id);if(edit.original&&!equal(current,edit.original))throw Error('This item changed elsewhere. Your draft is preserved; reopen the current item before saving.');if(!edit.original&&current)throw Error('This item already exists.');return {...d,[edit.key]:spread(edit.original?[...records(d,edit.key).map(r=>r.id===entry.id?payload:r),...copies]:[...records(d,edit.key),payload,...copies])}});if(saved){clearDrafts();close(true)}else setError('Not saved yet. Your draft is still here.')}catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}
 }
 return <Modal title={(edit.original?'Edit ':'New ')+labels[edit.key]} close={keep}><form onSubmit={submit}><fieldset disabled={busy}><label>{edit.key==='subjects'?'Subject name':edit.key==='kids'?'Kid name':'Title'}<input autoFocus required maxLength={edit.key==='subjects'||edit.key==='kids'?200:1000} value={String(entry[titleKey]??'')} onChange={e=>field(titleKey,e.target.value)}/></label>
  {note&&<VoiceInputButton label="title" onText={text=>append(titleKey,text)}/>}
  {/* What kind of event, first and in one tap. Exams, tests, quizzes and assignments have their own
      forms (＋ Add › Test or exam / Homework), so they're only listed for an event that already is one. */}
  {edit.key==='calendarEvents'&&<div className="event-kind-chips" role="group" aria-label="Event type">{([['personal','🗓️','Event'],['appointment','🩺','Appointment'],['sports','⚽','Sports'],['activity','🎨','Activity'],['lesson','📖','Lesson'],['study','📚','Study'],['work','💼','Work'],['other','✨','Other'],...(['exam','test','quiz','assignment'].includes(String(entry.kind))?[[String(entry.kind),'📝',String(entry.kind)[0].toUpperCase()+String(entry.kind).slice(1)]] as const:[])] as const).map(([k,icon,label])=><button type="button" key={k} aria-pressed={String(entry.kind)===k} onClick={()=>field('kind',k)}><span aria-hidden="true">{icon}</span>{label}</button>)}</div>}
  {!['subjects','kids'].includes(edit.key)&&(!isEvent||['lesson','study'].includes(String(entry.kind))||Boolean(entry.subjectId))&&<label>Subject<select value={String(entry.subjectId??'')} onChange={e=>field('subjectId',e.target.value)}><option value="">General / unassigned</option>{data.subjects.filter(s=>s.profileId===entry.profileId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  {(['tasks','exams','calendarEvents'] as Collection[]).includes(edit.key)&&familyKids.length>0&&<fieldset className="whose-pick"><legend>Who’s it for?</legend>
   <label><input type="checkbox" checked={!whose.length} onChange={()=>setWhose([])}/> Me / whole family</label>
   {familyKids.map(k=><label key={k.id}><input type="checkbox" checked={whose.includes(k.id)} onChange={()=>togglePerson(k.id)}/> {(k.emoji?k.emoji+' ':'')+k.name}</label>)}
   {whose.length===1&&kidPlans(data,data.activeProfileId).some(x=>x.kid.id===whose[0])&&<small>Saved in their plan, so it’s on their device too.</small>}
  </fieldset>}
  {('due' in entry||'date' in entry)&&<label>Date<input required type="date" value={String(entry.due??entry.date??'')} onInput={e=>{const next={...entry,['due' in entry?'due':'date']:e.currentTarget.value,...(edit.key==='tasks'?{plannedTime:undefined}:{})};persist(next);setEntry(next)}}/></label>}
  {edit.key==='calendarEvents'&&<div className="wb-time-row"><label>Start time (optional)<input type="time" value={String(entry.time??'')} onChange={e=>field('time',e.target.value||undefined)}/></label><label>End time (optional)<input type="time" value={String(entry.endTime??'')} onChange={e=>field('endTime',e.target.value||undefined)}/></label></div>}
  {isEvent&&<div className="wb-place-row"><label>Where (optional)<input maxLength={300} value={String(entry.location??'')} onChange={e=>field('location',e.target.value||undefined)} placeholder="Riverside Park, field 3" autoComplete="street-address"/></label><label>Travel time<select value={String(entry.travelMinutes??'')} onChange={e=>field('travelMinutes',e.target.value?Number(e.target.value):undefined)}><option value="">None</option>{TRAVEL_CHOICES.map(m=><option key={m} value={m}>{m<60?m+' min':m===60?'1 hour':m/60+' hours'}</option>)}</select></label></div>}
  {isEvent&&(Boolean(entry.location)||Boolean(entry.travelMinutes))&&<p className="wb-muted wb-place-hint">{leaveBy(entry.time as string|undefined,entry.travelMinutes as number|undefined)?<>🚗 Leave by <strong>{classTime(leaveBy(entry.time as string,entry.travelMinutes as number)!)}</strong>{data.settings.browserNotifications?' — KONO will remind you then.':'. Turn on notifications in Settings to get a reminder.'} </>:entry.travelMinutes?'Add a start time to see when to leave. ':''}{Boolean(entry.location)&&<a href={mapsLink(String(entry.location))} target="_blank" rel="noreferrer">Open in Maps</a>}</p>}
  {isEvent&&seriesSize<2&&<div className="wb-event-repeat"><label>Repeat<select value={repeat} onChange={e=>setRepeat(e.target.value as Repeat)}>{REPEATS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{repeat!=='none'&&<label>Until<input type="date" min={eventDate} value={repeatEnd||defaultUntil(eventDate)} onChange={e=>setRepeatEnd(e.target.value)}/></label>}{repeatOn&&<p className="wb-muted">{repeatList.length?'Adds '+repeatList.length+' more: '+repeatList.slice(0,3).map(d=>dateLabel(d)).join(', ')+(repeatList.length>3?'…':''):'No more dates before then.'}</p>}</div>}
  {seriesSize>1&&<fieldset className="wb-event-series"><legend>This repeats ({seriesSize} dates). Save changes to:</legend>{([['one','Only this one'],['following','This and the ones after it'],['all','All of them']] as [SeriesScope,string][]).map(([value,label])=><label key={value} className="wb-check"><input type="radio" name="series-scope" checked={scope===value} onChange={()=>setScope(value)}/>{label}</label>)}</fieldset>}
  {isEvent&&familyKids.length>0&&<label>Who’s driving? (optional)<input maxLength={60} value={String(entry.driver??'')} onChange={e=>field('driver',e.target.value||undefined)} placeholder="Mom, Dad, carpool…"/></label>}
  {isNewAssignment&&<div className="wb-event-repeat wb-task-repeat"><label>Repeat<select value={taskRepeat} onChange={e=>setTaskRepeat(e.target.value as Repeat|'days'|'pick')}>{REPEATS.map(([value,label])=><option key={value} value={value}>{label}</option>)}<option value="days">On certain days of the week…</option><option value="pick">Pick the dates…</option></select></label>
   {taskRepeat==='days'&&<div className="wb-repeat-days" role="group" aria-label="Repeat on">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=><button type="button" key={d} aria-pressed={taskDays.includes(i)} onClick={()=>setTaskDays(taskDays.includes(i)?taskDays.filter(x=>x!==i):[...taskDays,i].sort())}>{d}</button>)}</div>}
   {taskRepeat==='pick'&&<MultiDatePicker primary={due} selected={extraDates} onToggle={toggleDate}/>}
   {taskRepeat!=='none'&&taskRepeat!=='pick'&&<label>Until<input type="date" min={due} value={taskUntil} onChange={e=>setRepeatEnd(e.target.value)}/></label>}
   {taskRepeat!=='none'&&<p className="wb-muted">{!due?'Pick a date first.':taskSeries.length?'Adds '+taskSeries.length+' more, one per date: '+taskSeries.slice(0,3).map(d=>dateLabel(d)).join(', ')+(taskSeries.length>3?'…':''):taskRepeat==='days'&&!taskDays.length?'Pick the days.':taskRepeat==='pick'?'Tap more dates on the calendar.':'No more dates before then.'}</p>}
  </div>}
  {edit.key==='tasks'&&<div className="wb-subtasks"><p className="wb-muted">Break this assignment into steps, each with its own day.</p><BreakIntoSteps hasSteps={!!(entry.subtasks as Subtask[]??[]).length} profileId={String(entry.profileId??'')} title={String(entry.title??'')} notes={String(entry.notes??'')} due={String(entry.due??'')} today={localDate()} onSteps={steps=>field('subtasks',steps.map(st=>({id:uid('subtask'),title:st.title,done:false,due:st.due})))}/>{!!(entry.subtasks as Subtask[]??[]).length&&<ul>{(entry.subtasks as Subtask[]).map(st=><li key={st.id}><label className="wb-check"><input type="checkbox" checked={st.done} onChange={e=>field('subtasks',(entry.subtasks as Subtask[]).map(x=>x.id===st.id?{...x,done:e.target.checked}:x))}/><span className={st.done?'is-done':''}>{st.title}</span></label><input type="date" className="wb-step-date" value={st.due??''} max={String(entry.due??'')||undefined} aria-label={'Day for '+st.title} onChange={e=>field('subtasks',(entry.subtasks as Subtask[]).map(x=>x.id===st.id?(e.target.value?{...x,due:e.target.value}:{id:x.id,title:x.title,done:x.done}):x))}/><button type="button" aria-label={'Remove step '+st.title} onClick={()=>field('subtasks',(entry.subtasks as Subtask[]).filter(x=>x.id!==st.id))}>Remove</button></li>)}</ul>}<div className="wb-subtask-add"><input value={newSubtask} onChange={e=>setNewSubtask(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addSubtask()}}} maxLength={300} placeholder="Add a step" aria-label="Add a step"/><button type="button" onClick={addSubtask}>Add step</button></div></div>}
  {edit.key==='tasks'&&<div className="wb-time-estimate"><label>About how long will this take?<select value={String(entry.estimatedMinutes??'')} onChange={e=>field('estimatedMinutes',e.target.value?Number(e.target.value):undefined)}><option value="">Not sure</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></label>
   {Boolean(entry.estimatedMinutes)&&<TimeBlockSuggestions data={data} date={String(entry.due??'')} minutes={Number(entry.estimatedMinutes)} plannedTime={entry.plannedTime as string|undefined} onPick={time=>field('plannedTime',time)} onClear={()=>field('plannedTime',undefined)}/>}</div>}
  {edit.key==='notes'&&<label>Type<select value={String(entry.kind??'note')} onChange={e=>field('kind',e.target.value)}><option value="note">Note / reminder</option><option value="homework">Homework / assignment</option><option value="exam">Exam / project</option></select></label>}
  {edit.key==='calendarEvents'&&entry.kind==='sports'&&(()=>{const result=entry.result as MatchResult|undefined;const outcome=result?matchOutcome(result):null;return <div className="wb-match-result"><p className="wb-muted">Final score (once the match is over)</p><div className="wb-form-grid"><label>Us<input type="number" min={0} max={999} value={result?.ourScore??''} onChange={e=>field('result',{ourScore:Number(e.target.value),opponentScore:result?.opponentScore??0})}/></label><label>Opponent<input type="number" min={0} max={999} value={result?.opponentScore??''} onChange={e=>field('result',{ourScore:result?.ourScore??0,opponentScore:Number(e.target.value)})}/></label>{result&&<button type="button" onClick={()=>field('result',undefined)}>Clear score</button>}</div>{outcome&&<p className={'wb-match-outcome is-'+outcome}>{outcome==='win'?'Win':outcome==='loss'?'Loss':'Tie'} · {result!.ourScore}–{result!.opponentScore}</p>}</div>})()}
  {edit.key==='subjects'?<><label>Teacher<input maxLength={200} value={String(entry.teacher??'')} onChange={e=>field('teacher',e.target.value)}/></label><label>Room<input maxLength={100} value={String(entry.room??'')} onChange={e=>field('room',e.target.value)}/></label><label>Resources (one per line)<textarea value={(entry.resources as string[]??[]).join('\n')} onChange={e=>field('resources',e.target.value.split('\n').filter(Boolean))}/></label><label>Subject color<input type="color" value={String(entry.color??'#4169a8')} onChange={e=>field('color',e.target.value)}/></label></>:edit.key==='kids'?<p className="wb-muted">Set their emoji and color from the Kids page's "🎨 Appearance" button — this keeps it in one place.</p>:<label>{note?'Note':'Details'}<textarea ref={bodyRef} rows={6} maxLength={100000} value={String(note?entry.body??'':entry.notes??'')} onChange={e=>field(note?'body':'notes',e.target.value)}/></label>}
  {!['subjects','kids'].includes(edit.key)&&<VoiceInputButton label={note?'note':'details'} onText={text=>append(note?'body':'notes',text)}/>}
  {(note||edit.key==='exams')&&<><div className="wb-note-formatting" aria-label="Text formatting"><button type="button" onClick={()=>format('<b>','</b>')}>Bold</button><button type="button" onClick={()=>format('<i>','</i>')}>Italic</button><button type="button" onClick={()=>format('<mark>','</mark>')}>Highlight selection</button></div><div className="wb-paper-swatches" aria-label="Paper colors">{['#ffd2dd','#d9efff','#fff2b4','#dff1c2','#e7d5ff','#ffdcb8'].map((color,i)=><button type="button" key={color} aria-label={'Paper '+['Pink','Blue','Cream','Green','Lavender','Peach'][i]} aria-pressed={entry.color===color} style={{background:color}} onClick={()=>field('color',color)}/>)}</div></>}
  {(note||edit.key==='exams')&&<details><summary>Customize paper & text</summary><div className="wb-form-grid"><label>Paper<input type="color" value={String(entry.color??'#fff2b4')} onChange={e=>field('color',e.target.value)}/></label><label>Text color<input type="color" value={String(entry.textColor??'#2f2942')} onChange={e=>field('textColor',e.target.value)}/></label><label>Text style<select value={String(entry.font??'rounded')} onChange={e=>field('font',e.target.value)}>{['rounded','handwritten','serif','mono'].map(f=><option key={f}>{f}</option>)}</select></label><label>Highlight<select value={String(entry.highlight??'transparent')} onChange={e=>field('highlight',e.target.value)}><option value="transparent">None</option><option value="#fff39d">Yellow</option><option value="#ffc4dd">Pink</option><option value="#c9f3d4">Mint</option></select></label>{note&&<label>Note size<select value={String(entry.size??'medium')} onChange={e=>field('size',e.target.value)}>{['small','medium','large'].map(s=><option key={s}>{s}</option>)}</select></label>}</div></details>}
  {note&&<label className="wb-check"><input type="checkbox" checked={Boolean(entry.pinned)} onChange={e=>field('pinned',e.target.checked)}/>Pin to bulletin board</label>}
  {Boolean(entry.studyPlanId)&&<p>This unit still follows its study plan’s carryover rules.</p>}
  {(edit.key==='tasks'||edit.key==='exams')&&<><label>Link (optional)<input type="url" inputMode="url" placeholder="https://… (Google Doc, Classroom, textbook)" value={String(entry.link??'')} onChange={e=>field('link',e.target.value.trim()||undefined)}/></label>
   <div className="wb-field"><span className="wb-field-label">Photos</span><AssignmentPhotos ids={entry.photos as string[]|undefined} onChange={ids=>field('photos',ids.length?ids:undefined)} cloud={photoCloud}/></div></>}
  {share&&shareKind&&<div className="share-classmate-toggle"><button type="button" aria-expanded={sharing} onClick={()=>setSharing(v=>!v)}>{sharing?'Hide sharing':'Share with a classmate'}</button>{sharing&&<ShareWithClassmate repository={share} data={data} kind={shareKind} entry={{title:String(entry.title??''),due:String(entry.due??''),subjectId:String(entry.subjectId??''),notes:String(entry.notes??''),estimatedMinutes:typeof entry.estimatedMinutes==='number'?entry.estimatedMinutes:undefined}}/>}</div>}
  {error&&<p role="alert">{error}</p>}{draftError&&<p role="alert">{draftError}</p>}<div className="wb-toolbar"><button className="primary" type="submit">{busy?'Saving…':'Save'}</button><button type="button" onClick={keep} title="Anything you typed is kept as a draft">Cancel</button>{!equal(entry,edit.original??edit.entry)&&<button type="button" className="link-button" onClick={()=>{if(window.confirm('Discard this unfinished edit? Your saved item stays unchanged.')){try{clearDrafts();close(true,true)}catch{setError('Could not discard the draft. Try again.')}}}}>Discard changes</button>}</div>
 </fieldset></form></Modal>
}
// Reads the day's own class/activity schedule (see findOpenSlots) so a suggestion is never during a
// class -- each option is a real gap of exactly the estimated length, not a vague "sometime today".
function TimeBlockSuggestions({data,date,minutes,plannedTime,onPick,onClear}:{data:AppData;date:string;minutes:number;plannedTime?:string;onPick:(time:string)=>void;onClear:()=>void}){
 if(!date)return <p className="wb-muted">Pick a date above to see open time for this.</p>
 const slots=findOpenSlots(data,date,minutes)
 if(!slots.length)return <p className="wb-muted">No open {minutes}-minute block found on {dateLabel(date)} — that day already looks full.</p>
 return <div className="wb-time-suggestions">
  <p className="wb-muted">Open time on {dateLabel(date)}:</p>
  <div className="wb-time-suggestion-list">{slots.slice(0,4).map(slot=><button type="button" key={slot.start} aria-pressed={plannedTime===slot.start} onClick={()=>onPick(slot.start)}>{classTime(slot.start)}–{classTime(slot.end)}</button>)}</div>
  {plannedTime&&<p className="wb-time-planned">Planned for {classTime(plannedTime)}. <button type="button" onClick={onClear}>Clear</button></p>}
 </div>
}
function MultiDatePicker({primary,selected,onToggle}:{primary:string;selected:string[];onToggle:(date:string)=>void}){
 const [month,setMonth]=useState(()=>(primary||localDate()).slice(0,7))
 const start=new Date(month+'-01T12:00:00'),gridStart=addDays(month+'-01',-start.getDay())
 const shift=(by:number)=>{const next=new Date(start);next.setMonth(next.getMonth()+by);setMonth(localDate(next).slice(0,7))}
 return <div className="wb-multidate-calendar">
  <div className="wb-section-head"><button type="button" aria-label="Previous month" onClick={()=>shift(-1)}>‹</button><strong>{start.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Next month" onClick={()=>shift(1)}>›</button></div>
  <div className="wb-calendar wb-calendar-mini">{dayNames.map(d=><span key={d}>{d.slice(0,1)}</span>)}{Array.from({length:42},(_,i)=>addDays(gridStart,i)).map(day=>{
   const isPrimary=day===primary,isSelected=selected.includes(day)
   return <button type="button" key={day} disabled={isPrimary} aria-pressed={isSelected} aria-label={dateLabel(day)+(isPrimary?' · original date':isSelected?' · selected':'')} className={(day.slice(0,7)!==month?'muted-day ':'')+(isPrimary?'is-primary':'')} onClick={()=>onToggle(day)}>{Number(day.slice(-2))}</button>
  })}</div>
 </div>
}
