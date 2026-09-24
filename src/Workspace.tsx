import {useEffect,useRef,useState,type CSSProperties,type DragEvent,type FormEvent,type PointerEvent,type ReactNode,type TouchEvent} from 'react'
import {deleteProfile} from './store/deleteProfile'
import {usePlannerRepository} from './store/repository'
import {uid,localDate,dayNames,eventCategory,matchOutcome,type AppData,type SettingsData,type Task,type Subtask,type CalendarEventKind,type MatchResult,type Kid,type KidBorderStyle,type KidBorderGlow,KID_BORDER_SPEED} from './store/model'
import {nextKidColor,kidDueItems,kidTimeBlockItems,kidFamilyEventItems,KID_COLORS} from './store/kids'
import {collections,records,titleOf,equal,removeEntry,restoreEntry,completeTask,type Collection,type Entry} from './store/workspace'
import {calendarTasks,addDays} from './store/studyScheduler'
import {planExamReview} from './store/examReview'
import {classifyVoiceInput} from './store/voiceIntake'
import {useSpeechToText} from './hooks/useSpeechToText'
import {syncCurrentTaskCompletion,createSanctuaryProgress} from './game/progression/progressionEngine'
import {pickKonoPhrase,konoCelebration,konoStreakMilestone,seededRand,STREAK_MILESTONES,type KonoPhrase} from './store/konoPhrases'
import {useReducedMotion,useMusicController} from './hooks/useComfort'
import {useDueNotifications,useTimeBlockNotifications,useFamilyEventNotifications,notificationsSupported} from './hooks/useDueNotifications'
import {useLiveSanctuaryWeather} from './hooks/useLiveSanctuaryWeather'
import ClassOccurrenceCard from './components/ClassOccurrenceCard'
import {classOccurrences,classTime,type ClassOccurrence} from './store/classSchedule'
import SchedulePanel from './components/SchedulePanel'
import ScheduleImport from './components/ScheduleImport'
import ScheduleSetup from './components/ScheduleSetup'
import ScheduleShare from './components/ScheduleShare'
import {schoolDayLabels} from './store/schoolCalendar'
import {PlanSettings,WeatherSettings,SoundMotionSettings,ReminderSettings,StickyNoteView} from './LegacyApp'
import Sidebar from './components/Sidebar'
import {AccountPanel,BackupPanel,Onboarding,RecoveryScreen,SaveStatus} from './components/AccountPanel'
import {AiHelperSettings} from './components/AiHelper'
import GardenCard from './components/GardenCard'
import StudyPlanner from './components/StudyPlanner'
import Flashcards from './components/Flashcards'
import KQuiz from './components/KQuiz'
import CommandPalette from './components/CommandPalette'
import UpdatePlanScanner from './components/UpdatePlanScanner'
import MusicPlayer from './components/MusicPlayer'
import SafeNoteBody from './components/SafeNoteBody'
import VoiceInputButton from './components/VoiceInputButton'
import FocusSession, {type FocusRequest} from './components/FocusSession'
import SanctuaryBuild from './components/SanctuaryBuild'
import SanctuaryDecorLayer from './components/SanctuaryDecorLayer'
import PeerConnections from './components/PeerConnections'
import {NavIcon,WeekWeather} from './components/Sidebar'
import {downloadData} from './store/localRepository'
import {buildIcs} from './store/icsExport'
import {findOpenSlots} from './store/timeBlocking'
import {APP_VERSION} from './version'
import './workbench.css'
import './design-restoration.css'
import './experiences.css'
import './cozy-workspaces.css'
import './planner-polish.css'
import './cozy-controls.css'
import ActionIcon from './components/ActionIcon'

// Settings tabs, grouped by what a person is trying to do rather than by where each feature was built.
const SETTINGS_TABS=['Look & feel','Notifications','Family','Schedules','Import & export','Plans & account'] as const
type SettingsTab=typeof SETTINGS_TABS[number]
const pages=['Sanctuary','Planner','Kids','Subjects','Notes','K-Quiz','Exams','Settings','Trash'] as const
type Page=typeof pages[number]
type Store=ReturnType<typeof usePlannerRepository>
type Edit={key:Collection;entry:Entry;original?:Entry}
const labels:Record<Collection,string>={tasks:'Assignment',notes:'Note',exams:'Exam / project',calendarEvents:'Event',subjects:'Subject',kids:'Kid',studyPlans:'Study plan',flashcardDecks:'Flashcards',kquizSets:'K-Quiz set',kquizSources:'K-Quiz note',studySeasons:'Schedule'}
const cozyPalettes=['coral','sakura','lavender','mint','honey','zen','floral','ocean'] as const
const cozyPalette=(theme:string)=>cozyPalettes.includes(theme as typeof cozyPalettes[number])?theme:'coral'
// Modern and Zen Ink are each one opinionated, fully art-directed look rather than a color you
// pick — they carry their own fixed palette instead of showing the swatch picker.
const fixedPaletteExperiences:string[]=['modern','sumi']
const experienceOptions=[
 {id:'cozy',title:'Cozy',glyph:'🌸',description:'Notebook tabs, colorful pinned papers and gentle movement.'},
 {id:'simplified',title:'Simplified',glyph:'▢',description:'A compact workspace with straightforward cards and bottom navigation.'},
 {id:'modern',title:'Modern',glyph:'⚪',description:'Clean, minimal and spacious — off-white surfaces, quiet type and a single accent, in the spirit of apple.com.'},
 {id:'sumi',title:'Zen Ink',glyph:'⛩️',description:'Sumi ink and washi paper — muted indigo and charcoal, hairline rules and quiet type, in the spirit of Japanese ink-wash art.'},
] as const
function ExperienceIcon({id}:{id:string}){return <span className="theme-picker-glyph" aria-hidden="true">{experienceOptions.find(o=>o.id===id)?.glyph??'✦'}</span>}
// A quick "how much of tonight's/today's work is done" readout — assignments only (exams already get
// their own countdown/reminders, and appointments aren't something you "complete"). Always renders
// (with a "nothing due" caption at zero) so the feature reads as present, not silently missing.
function AssignmentProgress({tasks,date,label}:{tasks:Task[];date:string;label:string}){
 const due=tasks.filter(t=>t.due===date)
 const completed=due.filter(t=>t.done).length
 return <div className="assignment-progress" role="group" aria-label={label+' assignment progress'}>
  {due.length>0&&<div className="assignment-progress-bar">{due.map(t=><span key={t.id} className={t.done?'is-filled':''}/>)}</div>}
  <small>{due.length>0?completed+'/'+due.length+' assignment'+(due.length===1?'':'s')+' completed':'No assignments due'}</small>
 </div>
}
const pageFromURL=():Page=>pages.find(p=>p.toLowerCase()===new URL(location.href).searchParams.get('page'))??'Sanctuary'
const dateLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})
const daysUntil=(date:string,from=localDate())=>Math.round((new Date(date+'T12:00:00').getTime()-new Date(from+'T12:00:00').getTime())/86400000)
const countdown=(date:string,done=false,from=localDate())=>{if(done)return 'Completed';const days=daysUntil(date,from);return days===0?'Due today':days===1?'Due tomorrow':days>1?days+' days left':Math.abs(days)+' day'+(days===-1?'':'s')+' overdue'}
const own=(data:AppData,key:Collection)=>records(data,key).filter(r=>r.profileId===data.activeProfileId)
const eventKind=(entry:Entry)=>String(entry.kind??'').toLowerCase()
const entryDate=(entry:Entry)=>String(entry.due??entry.date??'')
const isAssignmentKind=(entry:Entry)=>['homework','assignment','assignments'].includes(eventKind(entry))
const isImportantEntry=(key:Collection,entry:Entry)=>key==='exams'||(key==='notes'&&['exam','project','test','quiz'].includes(eventKind(entry)))||(key==='calendarEvents'&&['exam','test','quiz','project','assignment'].includes(eventKind(entry)))

export default function WorkspaceApp(){
 const store=usePlannerRepository()
 useEffect(()=>{const {experience='cozy',theme}=store.data.settings;document.documentElement.dataset.experience=experience;document.documentElement.dataset.theme=experience==='cozy'?cozyPalette(theme):fixedPaletteExperiences.includes(experience)?experience:theme},[store.data.settings])
 if(!store.ready)return <main className="startup-card"><h1>KONO</h1><p role="status">Opening your study plan…</p></main>
 // AccountPanel (rendered inside Onboarding) shows its own SaveStatus in context -- a second
 // one floating above the welcome card duplicated the exact same "Build X · This device only"
 // line as a stray line of text before the reader has even reached the card it belongs to.
 if(!store.data.onboardingComplete)return store.unreadable?<RecoveryScreen store={store}/>:<Onboarding store={store}/>
 return <Workspace key={(store.user?.id??'device')+':'+store.data.activeProfileId} store={store}/>
}
function Workspace({store}:{store:Store}){
 const {data,repository}=store,save=repository.update
 const experience=data.settings.experience??'cozy'
 const profile=data.profiles.find(p=>p.id===data.activeProfileId)??data.profiles[0]
 const [page,setPage]=useState<Page>(pageFromURL),[more,setMore]=useState(false),[search,setSearch]=useState(false),[adding,setAdding]=useState(false),[scanningPlan,setScanningPlan]=useState(false),[editor,setEditor]=useState<Edit|null>(null),[message,setMessage]=useState('')
 const [planRequest,setPlanRequest]=useState(0)
 const [addKind,setAddKind]=useState<'tasks'|'exams'|'notes'>('tasks')
 const [confirmation,setConfirmation]=useState<{text:string;action:()=>void}|null>(null)
 const [phase,setPhase]=useState<'auto'|'morning'|'afternoon'|'evening'|'night'>('auto'),[expanded,setExpanded]=useState(false)
 const [islandMode,setIslandMode]=useState<'view'|'decorate'>('view')
 // View-only: Decorate mode has its own per-item Size control, and zooming the whole stage there
 // would resize the same Phaser canvas GardenCard already goes out of its way to keep paused and
 // un-resized while decorating (see its `paused` prop) -- scoping this to view mode sidesteps that
 // entirely rather than risk reintroducing it. The zoom control itself only renders in view mode,
 // so this has no effect while decorating regardless of its last value.
 const [islandZoom,setIslandZoomRaw]=useState(1)
 const [islandPan,setIslandPan]=useState({x:0,y:0})
 const MIN_ISLAND_ZOOM=1,MAX_ISLAND_ZOOM=2.5
 const islandStageRef=useRef<HTMLDivElement>(null)
 // Once zoomed past 1x, the scaled content overhangs the box on every side by half its extra size;
 // clamping pan to that overhang keeps the content always fully covering the box (no gaps at the
 // edges) while still letting every part of it be panned into view. Recomputed on every zoom change
 // too, since shrinking the zoom shrinks how far a previously valid pan is allowed to reach.
 const clampIslandPan=(x:number,y:number,zoom:number)=>{
  const el=islandStageRef.current
  if(!el||zoom<=1)return {x:0,y:0}
  const maxX=el.clientWidth*(zoom-1)/2,maxY=el.clientHeight*(zoom-1)/2
  return {x:Math.max(-maxX,Math.min(maxX,x)),y:Math.max(-maxY,Math.min(maxY,y))}
 }
 const setIslandZoom=(next:number|((z:number)=>number))=>setIslandZoomRaw(z=>{const nextZoom=typeof next==='function'?next(z):next;setIslandPan(p=>clampIslandPan(p.x,p.y,nextZoom));return nextZoom})
 const resetIslandView=()=>{setIslandZoomRaw(1);setIslandPan({x:0,y:0})}
 // Two-finger pinch zooms (alongside the +/- buttons, kept for mouse/keyboard/screen-reader users);
 // a single finger pans once zoomed in, the same way a map app separates the two gestures. Mouse/
 // trackpad dragging is handled separately below via Pointer Events, which touch does not fire here.
 const touchGesture=useRef<{mode:'pinch';distance:number;zoom:number}|{mode:'pan';x:number;y:number;pan:{x:number;y:number}}|null>(null)
 const touchDistance=(a:{clientX:number;clientY:number},b:{clientX:number;clientY:number})=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)
 const onIslandTouchStart=(e:TouchEvent<HTMLDivElement>)=>{
  if(islandMode!=='view')return
  if(e.touches.length===2)touchGesture.current={mode:'pinch',distance:touchDistance(e.touches[0],e.touches[1]),zoom:islandZoom}
  else if(e.touches.length===1&&islandZoom>1)touchGesture.current={mode:'pan',x:e.touches[0].clientX,y:e.touches[0].clientY,pan:islandPan}
 }
 const onIslandTouchMove=(e:TouchEvent<HTMLDivElement>)=>{
  const gesture=touchGesture.current
  if(!gesture)return
  e.preventDefault()
  if(gesture.mode==='pinch'&&e.touches.length===2){
   const ratio=touchDistance(e.touches[0],e.touches[1])/gesture.distance
   setIslandZoom(Math.min(MAX_ISLAND_ZOOM,Math.max(MIN_ISLAND_ZOOM,+(gesture.zoom*ratio).toFixed(2))))
  }else if(gesture.mode==='pan'&&e.touches.length===1){
   setIslandPan(clampIslandPan(gesture.pan.x+e.touches[0].clientX-gesture.x,gesture.pan.y+e.touches[0].clientY-gesture.y,islandZoom))
  }
 }
 const onIslandTouchEnd=(e:TouchEvent<HTMLDivElement>)=>{if(e.touches.length===0)touchGesture.current=null}
 const mouseDrag=useRef<{x:number;y:number;pan:{x:number;y:number}}|null>(null)
 const onIslandPointerDown=(e:PointerEvent<HTMLDivElement>)=>{
  if(islandMode!=='view'||islandZoom<=1||e.pointerType==='touch')return
  mouseDrag.current={x:e.clientX,y:e.clientY,pan:islandPan}
  e.currentTarget.setPointerCapture(e.pointerId)
 }
 const onIslandPointerMove=(e:PointerEvent<HTMLDivElement>)=>{
  const drag=mouseDrag.current
  if(!drag)return
  setIslandPan(clampIslandPan(drag.pan.x+e.clientX-drag.x,drag.pan.y+e.clientY-drag.y,islandZoom))
 }
 const onIslandPointerUp=()=>{mouseDrag.current=null}
 const [todayCollapsed,setTodayCollapsed]=useState(false),[tomorrowCollapsed,setTomorrowCollapsed]=useState(false)
 const [today,setToday]=useState(localDate),[selectedDate,setSelectedDate]=useState(localDate),[subject,setSubject]=useState(''),[boardView,setBoardView]=useState('board'),[subjectTab,setSubjectTab]=useState('Assignments')
 const [settingsTab,setSettingsTab]=useState<SettingsTab>('Look & feel')
 const tomorrow=addDays(today,1)
 const draftScope='kono-draft-v3:'+(store.user?.id??'device')+':'+profile.id
 const [hasDraft,setHasDraft]=useState(()=>{try{return !!localStorage.getItem(draftScope)}catch{return false}})
 const reduced=useReducedMotion(data.settings),music=useMusicController(data.settings.ambient)
 const weather=useLiveSanctuaryWeather({mode:data.settings.sanctuaryWeatherMode,location:data.settings.sanctuaryWeatherLocations[profile.id]??'',manualWeather:data.settings.sanctuaryWeather})
 const releaseLabel=APP_VERSION.includes('production-')?APP_VERSION.split('production-')[1]:APP_VERSION
 const ownTasks=data.tasks.filter(t=>t.profileId===profile.id),plans=data.studyPlans.filter(p=>p.profileId===profile.id),tasks=calendarTasks(ownTasks,plans)
 const sanctuaryProgress=syncCurrentTaskCompletion(data.sanctuaryProgress[profile.id]??createSanctuaryProgress(profile.id),ownTasks)
 // A day only ever counts once it's actually logged a completion -- if today has none yet, look at
 // yesterday first so an in-progress day doesn't read as a broken streak before it's even over.
 const currentStreak=(()=>{
  let streak=0,cursor=(sanctuaryProgress.completionDates[today]??0)>0?today:addDays(today,-1)
  while((sanctuaryProgress.completionDates[cursor]??0)>0){streak++;cursor=addDays(cursor,-1)}
  return streak
 })()
 const weekStart=addDays(today,-6)
 const weekTasks=ownTasks.filter(t=>t.due>=weekStart&&t.due<=today)
 const weekDone=weekTasks.filter(t=>t.done).length,weekTotal=weekTasks.length
 const subjects=data.subjects.filter(s=>s.profileId===profile.id),notes=data.notes.filter(n=>n.profileId===profile.id),profileKids=data.kids.filter(k=>k.profileId===profile.id)
 // Quiet hours: don't buzz a phone in someone's pocket mid-class. Re-evaluated on every render, which
 // is frequent enough given the 30-second "today" ticker already running below.
 const nowClock=(()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')})()
 // Every kid's due items, tagged or not -- a parent's device should hear about all of them (see
 // kidDueItems), labeled by name whenever an item is tagged to a kid. Quiet hours is per-kid rather
 // than a single flag, so it's folded into kidDueItems itself instead of gating the whole hook the
 // way a single-profile notificationsQuiet boolean would.
 const dueNotifyItems=kidDueItems(data,profile.id,today,nowClock)
 useDueNotifications(Boolean(data.settings.browserNotifications),dueNotifyItems,today)
 const [focusRequest,setFocusRequest]=useState<FocusRequest|null>(null)
 const sanctuaryFocusRef=useRef<HTMLDetailsElement>(null)
 const digestKey='kono-digest:'+(store.user?.id??'device')+':'+profile.id
 const [digestDismissed,setDigestDismissed]=useState(()=>{try{return sessionStorage.getItem(digestKey)===today}catch{return false}})
 const dueSoon=[...ownTasks.filter(t=>!t.done).map(t=>({id:t.id,title:t.title,due:t.due})),...data.exams.filter(e=>e.profileId===profile.id&&!e.done).map(e=>({id:e.id,title:e.title,due:e.due}))].filter(t=>t.due>=today&&t.due<=addDays(today,3)).sort((a,b)=>a.due.localeCompare(b.due))
 const showDigest=data.settings.loginDigest!==false&&!digestDismissed&&dueSoon.length>0
 const dismissDigest=()=>{setDigestDismissed(true);try{sessionStorage.setItem(digestKey,today)}catch{/* Best effort; worst case it reappears next reload today. */}}
 // Flags a day as a workload crunch point without any grade-weighting: either three or more
 // undone things land on the same day, or two or more exams do -- exams are heavier than routine
 // homework, so a pair of them alone is worth surfacing even below the generic 3-item threshold.
 const crunchKey='kono-crunch:'+(store.user?.id??'device')+':'+profile.id
 const [crunchDismissed,setCrunchDismissed]=useState(()=>{try{return sessionStorage.getItem(crunchKey)===today}catch{return false}})
 const crunchDays=(()=>{
  const items=[
   ...ownTasks.filter(t=>!t.done).map(t=>({id:t.id,title:t.title,due:t.due,kind:'task' as const})),
   ...data.exams.filter(e=>e.profileId===profile.id&&!e.done).map(e=>({id:e.id,title:e.title,due:e.due,kind:'exam' as const})),
   ...data.calendarEvents.filter(e=>e.profileId===profile.id&&!e.done).map(e=>({id:e.id,title:e.title,due:e.date,kind:'event' as const})),
  ].filter(item=>item.due>=today&&item.due<=addDays(today,13))
  const byDay=new Map<string,typeof items>()
  for(const item of items)byDay.set(item.due,[...(byDay.get(item.due)??[]),item])
  return [...byDay.entries()].filter(([,list])=>list.length>=3||list.filter(i=>i.kind==='exam').length>=2).sort(([a],[b])=>a.localeCompare(b))
 })()
 const showCrunch=data.settings.loginDigest!==false&&!crunchDismissed&&crunchDays.length>0
 const dismissCrunch=()=>{setCrunchDismissed(true);try{sessionStorage.setItem(crunchKey,today)}catch{/* Best effort; worst case it reappears next reload today. */}}
 // Items auto-added by a photo scan (K-Quiz's Update-entire-plan and the schedule photo importer
 // both flag entries this way) -- gathered across every collection that can carry the flag so a
 // scan landing items under several different subjects still shows up as one place to check them.
 const needsReviewEntries=[...ownTasks.filter(t=>t.needsReview).map(t=>({key:'tasks' as Collection,entry:t as unknown as Entry})),...data.exams.filter(e=>e.profileId===profile.id&&e.needsReview).map(e=>({key:'exams' as Collection,entry:e as unknown as Entry})),...data.calendarEvents.filter(e=>e.profileId===profile.id&&e.needsReview).map(e=>({key:'calendarEvents' as Collection,entry:e as unknown as Entry}))]
 const reviewDigestKey='kono-review-digest:'+(store.user?.id??'device')+':'+profile.id
 const [reviewDigestDismissed,setReviewDigestDismissed]=useState(()=>{try{return sessionStorage.getItem(reviewDigestKey)===today}catch{return false}})
 const [reviewOpen,setReviewOpen]=useState(false)
 const showReviewDigest=!reviewDigestDismissed&&needsReviewEntries.length>0
 const dismissReviewDigest=()=>{setReviewDigestDismissed(true);try{sessionStorage.setItem(reviewDigestKey,today)}catch{/* Best effort; worst case it reappears next reload today. */}}
 const season=data.studySeasons.find(s=>s.profileId===profile.id&&s.active)
 const setting=<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>save(d=>({...d,settings:{...d.settings,[key]:value}}))
 // Off by default so a student sharing the app never sees a nav tab meant for a parent managing
 // multiple kids -- turned on from Settings > Family, the same way the schedule-setup flow picker
 // (Work/College/School/Sports) opts into a different kind of setup rather than showing everything.
 const parentMode=data.settings.parentMode===true
 const visiblePages=pages.filter(p=>p!=='Kids'||parentMode)
 const showAcademic=data.settings.scheduleShowAcademic??true
 const showSports=data.settings.scheduleShowSports??true
 const showAppointments=data.settings.scheduleShowAppointments??true
 const categoryVisible=(category:'academic'|'sports'|'appointments')=>category==='academic'?showAcademic:category==='sports'?showSports:showAppointments
 const scheduleClasses=(date:string)=>classOccurrences(data,date).filter(c=>categoryVisible(c.season.category??'academic'))
 const scheduleViewPicker=<div className="schedule-view-picker" role="group" aria-label="Schedule view"><label><input type="checkbox" checked={showAcademic} onChange={e=>void setting('scheduleShowAcademic',e.target.checked)}/> Academics</label><label><input type="checkbox" checked={showSports} onChange={e=>void setting('scheduleShowSports',e.target.checked)}/> Sports</label><label><input type="checkbox" checked={showAppointments} onChange={e=>void setting('scheduleShowAppointments',e.target.checked)}/> Appointments</label></div>
 const navigate=(next:Page)=>{const url=new URL(location.href);url.searchParams.set('page',next.toLowerCase());history.pushState(null,'',url);setPage(next);setMore(false);window.scrollTo({top:0})}
 const startFocusSession=(taskId:string,estimatedMinutes?:number)=>{
  navigate('Sanctuary')
  setFocusRequest({taskId,estimatedMinutes,requestId:Date.now()})
  requestAnimationFrame(()=>{
   // FocusSession opens its own inner <details> once it sees the request, but this outer wrapper is
   // a separate <details> one level up -- without also opening it, the inner one stays hidden inside
   // a collapsed parent.
   if(sanctuaryFocusRef.current)sanctuaryFocusRef.current.open=true
   sanctuaryFocusRef.current?.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'})
  })
 }
 const timeBlockNotifyItems=kidTimeBlockItems(data,profile.id,today,nowClock)
 useTimeBlockNotifications(Boolean(data.settings.browserNotifications),timeBlockNotifyItems,today,item=>startFocusSession(item.id,item.estimatedMinutes))
 // Opt-in on top of opt-in: parentMode gates the feature entirely, browserNotifications gates
 // notifications generally, and familyEventReminders is the specific "remind me 15 minutes before
 // starts/ends" choice a parent makes under the Kids page's notification row (see KidsPage).
 const familyEventNotifyItems=kidFamilyEventItems(data,profile.id,today)
 useFamilyEventNotifications(parentMode&&Boolean(data.settings.browserNotifications)&&Boolean(data.settings.familyEventReminders),familyEventNotifyItems,today)
 useEffect(()=>{const pop=()=>setPage(pageFromURL());window.addEventListener('popstate',pop);const timer=window.setInterval(()=>setToday(localDate()),30000);return()=>{window.removeEventListener('popstate',pop);clearInterval(timer)}},[])
 useEffect(()=>{document.documentElement.dataset.motion=reduced?'reduced':'full'},[reduced])
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearch(v=>!v)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[])
 const run=async(action:()=>Promise<boolean>,success:string)=>{try{setMessage(await action()?success:'Not saved yet. Check the save status; your working copy is preserved.')}catch(e){setMessage(e instanceof Error?e.message:'Could not finish. Your work is preserved.')}}
 const openEditor=(edit:Edit)=>{if(hasDraft&&!editor){try{const old=JSON.parse(localStorage.getItem(draftScope)??'null') as Edit;if(old?.entry?.id===edit.entry.id){setEditor(old);return}}catch{/* Offer a clear replacement choice. */}setConfirmation({text:'You have an unfinished edit. Discard it and open this item? Cancel keeps your draft; use Resume draft to finish it.',action:()=>{localStorage.removeItem(draftScope);localStorage.removeItem(draftScope+':assignment-dates');setHasDraft(false);setEditor(edit)}});return}setEditor(edit)}
 const create=(key:Collection,date=today,subjectId=subject,seed:Partial<Entry>={} )=>{
  setAdding(false)
  if(key==='studyPlans'){setPlanRequest(n=>n+1);navigate('Planner');return}
  const entry:Entry={id:uid(key),profileId:profile.id,title:'',subjectId:subjectId||'',notes:'',done:false,...seed}
  if(key==='tasks'||key==='exams')entry.due=date
  if(key==='notes')Object.assign(entry,{body:'',date,kind:'note',created:new Date().toISOString(),pinned:true,completed:false,color:'#fff2b4',textColor:'#2f2942',font:'rounded',size:'medium',position:Math.max(0,...notes.map(n=>n.position??0))+1})
  if(key==='calendarEvents')Object.assign(entry,{date,kind:entry.kind??'personal'})
  if(key==='subjects')Object.assign(entry,{name:'',resources:[],color:'#4169a8'})
 if(key==='kids')Object.assign(entry,{name:'',color:nextKidColor(data.kids.filter(k=>k.profileId===profile.id)),emoji:'✿'})
  openEditor({key,entry})
 }
 // Parent mode's fast path (see Calendar's QuickFamilyAdd): saves a calendarEvent directly, bypassing
 // the full EntryEditor and its draft/undo-redo plumbing, since there's nothing here worth drafting.
 const quickAddFamilyEvent=async(date:string,payload:{title:string;kind:CalendarEventKind;kidId?:string;time?:string;endTime?:string}):Promise<boolean>=>{
  try{
   const saved=await save(d=>({...d,calendarEvents:[...d.calendarEvents,{id:uid('event'),profileId:profile.id,date,title:payload.title,kind:payload.kind,kidId:payload.kidId,time:payload.time,endTime:payload.endTime,notes:'',done:false}]}))
   setMessage(saved?'Added to the family calendar.':'Not saved yet. Check the save status; your working copy is preserved.')
   return saved
  }catch(e){setMessage(e instanceof Error?e.message:'Could not save.');return false}
 }
 const {listening:voiceListening,error:voiceError,toggle:toggleVoiceAdd,supported:voiceSupported}=useSpeechToText(text=>{
  const guess=classifyVoiceInput(text,subjects,today,addDays)
  create(guess.key,guess.date,guess.subjectId,guess.kind?{title:guess.title,kind:guess.kind}:{title:guess.title})
 })
 // One phrase per profile session, not per render -- the lazy initializer runs once when Workspace
 // mounts (it remounts on profile switch, see the `key` on WorkspaceApp's <Workspace>), so it never
 // fights with edits to ownTasks/data.exams the way a reactive useEffect would.
 const konoGreetKey='kono-greet:'+(store.user?.id??'device')+':'+profile.id+':'+today
 const [konoPhrase,setKonoPhrase]=useState<KonoPhrase|null>(()=>{
  try{if(sessionStorage.getItem(konoGreetKey))return null}catch{/* Best effort; worst case it greets again this reload. */}
  const dueToday=[...ownTasks.filter(t=>!t.done&&t.due===today).map(t=>({title:t.title})),...data.exams.filter(e=>e.profileId===profile.id&&!e.done&&e.due===today).map(e=>({title:e.title}))]
  const phrase=pickKonoPhrase({name:profile.name,hour:new Date().getHours(),dueToday},seededRand(today+':'+profile.id))
  try{sessionStorage.setItem(konoGreetKey,'1')}catch{/* Best effort. */}
  return phrase
 })
 useEffect(()=>{if(!konoPhrase)return;const timer=setTimeout(()=>setKonoPhrase(null),8000);return()=>clearTimeout(timer)},[konoPhrase])
 // A fresh value makes the island's KONO play a one-off celebration reaction (see GardenCard's
 // celebrateSignal prop) -- bumped at the exact same moment the speech-bubble phrase above is set,
 // so the physical reaction and the phrase always fire together rather than drifting out of sync.
 const [celebrateSignal,setCelebrateSignal]=useState<number|null>(null)
 // Mirrors FocusSession's own "is the timer actually running" state (see its focusActive) so the
 // island's KONO can sit with the student at the cherry tree for the same stretch, via GardenCard's
 // focusCompanionActive prop.
 const [focusCompanionActive,setFocusCompanionActive]=useState(false)
 const edit=(key:Collection,entry:Entry)=>{const original=records(data,key).find(r=>r.id===entry.id)??entry;openEditor({key,entry:original,original})}
 const patch=(key:Collection,entry:Entry,changes:Partial<Entry>)=>run(()=>save(d=>({...d,[key]:records(d,key).map(r=>r.id===entry.id?{...r,...changes}:r)})),'Changes saved.')
 // Clears needsReview on exactly the entries the "Needs review" modal is currently showing (scoped
 // to this profile, same set as needsReviewEntries below) in one save -- for a scan that flagged a
 // whole page of items, confirming them one at a time is a lot of clicking once you've actually
 // checked the photo against what landed.
 const confirmAllReviews=()=>{
  const ids={tasks:new Set(needsReviewEntries.filter(e=>e.key==='tasks').map(e=>e.entry.id)),exams:new Set(needsReviewEntries.filter(e=>e.key==='exams').map(e=>e.entry.id)),calendarEvents:new Set(needsReviewEntries.filter(e=>e.key==='calendarEvents').map(e=>e.entry.id))}
  return run(()=>save(d=>({...d,
   tasks:d.tasks.map(t=>ids.tasks.has(t.id)?{...t,needsReview:false}:t),
   exams:d.exams.map(e=>ids.exams.has(e.id)?{...e,needsReview:false}:e),
   calendarEvents:d.calendarEvents.map(e=>ids.calendarEvents.has(e.id)?{...e,needsReview:false}:e),
  })),'All items confirmed.')
 }
 const reschedule=(key:Collection,entry:Entry,date:string)=>void patch(key,entry,{['due' in entry?'due':'date']:date})
 const toggle=(key:Collection,entry:Entry)=>{if(key==='tasks'){void run(async()=>{const saved=await save(d=>completeTask(d,entry.id));if(saved&&!entry.done){if(data.settings.sound){const audio=new Audio('/audio/completion.wav');audio.volume=.4;void audio.play().catch(()=>undefined)}if(entry.due===today&&!ownTasks.some(t=>t.id!==entry.id&&!t.done&&t.due===today)){
   // completeTask credits completionDates[today] on a profile's very first completion of the day
   // (any task, not just ones due today) -- so "today had no credit yet" is exactly "this
   // completion is about to extend the streak," computed here instead of watched reactively so it
   // can't race the "today's list is cleared" celebration below for the same click.
   const extendsStreak=(sanctuaryProgress.completionDates[today]??0)===0
   const resultingStreak=extendsStreak?currentStreak+1:currentStreak
   setKonoPhrase(extendsStreak&&STREAK_MILESTONES.includes(resultingStreak)?konoStreakMilestone(resultingStreak):konoCelebration())
   setCelebrateSignal(Date.now())
  }}return saved},'Assignment updated.');return}const field=key==='notes'?'completed':'done';void patch(key,entry,{[field]:!entry[field]})}
 const remove=(key:Collection,entry:Entry)=>setConfirmation({text:'Move “'+titleOf(entry)+'” to Trash?'+(key==='subjects'?' Its assignments and notes remain available.':entry.studyPlanId?' Restoring this unit returns an independent assignment.':''),action:()=>void run(()=>save(d=>removeEntry(d,key,entry.id)),'Moved to Trash. You can restore it later.')})
 const removeSeries=(entry:Entry)=>{const recurringId=String(entry.recurringId??''),count=ownTasks.filter(t=>t.recurringId===recurringId).length;setConfirmation({text:'Move all '+count+' dates in this series to Trash? Each is trashed independently, so you can restore just one later if you change your mind.',action:()=>void run(()=>save(d=>({...d,tasks:d.tasks.filter(t=>!(t.profileId===entry.profileId&&t.recurringId===recurringId))})),'Series moved to Trash.')})}
 const duplicate=(key:Collection,entry:Entry)=>openEditor({key,entry:{...entry,id:uid(key),title:titleOf(entry)+' (copy)',name:key==='subjects'?titleOf(entry)+' (copy)':entry.name,done:false,completed:false,completedAt:undefined,studyPlanId:undefined,unitNumber:undefined}})
 const scheduleExamReview=(entry:Entry)=>{
  const result=planExamReview({profileId:profile.id,subjectId:String(entry.subjectId??''),examTitle:titleOf(entry),due:String(entry.due??''),today,kquizSets:data.kquizSets,flashcardDecks:data.flashcardDecks,calendarEvents:data.calendarEvents})
  if(!result.ok){setMessage(result.message);return}
  void run(()=>save(d=>({...d,calendarEvents:[...d.calendarEvents,...result.events]})),result.message)
 }
 const classColor=(item:ClassOccurrence)=>subjects.find(s=>s.id===item.block.subjectId)?.color??'#c987a2'
 const classDueItems=(item:ClassOccurrence)=>[
  ...(showAcademic?tasks.filter(t=>t.subjectId===item.block.subjectId&&t.due===item.date).map(t=>({id:t.id,title:t.title,kind:'assignment' as const,countdown:countdown(t.due,t.done,today),collection:'tasks' as Collection,entry:t as unknown as Entry})):[]),
  ...(showAcademic?data.exams.filter(e=>e.profileId===profile.id&&e.subjectId===item.block.subjectId&&e.due===item.date).map(e=>({id:e.id,title:e.title,kind:'exam' as const,countdown:countdown(e.due,e.done,today),collection:'exams' as Collection,entry:e as unknown as Entry})):[]),
  ...(showAcademic?notes.filter(n=>n.subjectId===item.block.subjectId&&entryDate(n as unknown as Entry)===item.date).map(n=>({id:n.id,title:n.title,kind:isImportantEntry('notes',n as unknown as Entry)?'exam' as const:isAssignmentKind(n as unknown as Entry)?'assignment' as const:'note' as const,countdown:countdown(entryDate(n as unknown as Entry),Boolean(n.completed),today),collection:'notes' as Collection,entry:n as unknown as Entry})):[]),
  ...data.calendarEvents.filter(e=>e.profileId===profile.id&&e.subjectId===item.block.subjectId&&e.date===item.date&&categoryVisible(eventCategory(e.kind))).map(e=>({id:e.id,title:e.title,kind:isImportantEntry('calendarEvents',e as unknown as Entry)?'exam' as const:'reminder' as const,countdown:countdown(e.date,e.done,today),collection:'calendarEvents' as Collection,entry:e as unknown as Entry})),
 ].sort((a,b)=>a.title.localeCompare(b.title))
 const addForClass=(item:ClassOccurrence,kind:'assignment'|'note'|'exam'|'reminder')=>{
  if(kind==='assignment') return create('tasks',item.date,item.block.subjectId??'')
  if(kind==='note') return create('notes',item.date,item.block.subjectId??'')
  if(kind==='exam') return create('exams',item.date,item.block.subjectId??'')
  return create('calendarEvents',item.date,item.block.subjectId??'',{title:item.block.label+' reminder',kind:'personal'})
 }
 const removeDue=(due:{collection:string;entry:unknown})=>remove(due.collection as Collection,due.entry as Entry)
 const renderClass=(item:ClassOccurrence)=><ClassOccurrenceCard key={item.id} item={item} dueItems={classDueItems(item)} subjectColor={classColor(item)} save={save} draftKey={draftScope} onAdd={kind=>addForClass(item,kind)} onRemoveDue={removeDue}/>
 const renderCompactClass=(item:ClassOccurrence)=><ClassOccurrenceCard compact key={item.id} item={item} dueItems={classDueItems(item)} subjectColor={classColor(item)} save={save} draftKey={draftScope} onAdd={kind=>addForClass(item,kind)} onRemoveDue={removeDue}/>
 const seriesCount=(entry:Entry)=>entry.recurringId?ownTasks.filter(t=>t.recurringId===entry.recurringId).length:0
 // Parent mode gates both independently-toggleable tile features entirely -- a solo student who has
 // never turned parent mode on gets the plain, pre-family tile design no matter what these settings
 // happen to hold, so nothing "kid"-shaped ever surfaces on a personal calendar.
 const showKidBorder=parentMode&&data.settings.familyTileBorders!==false
 const showKidHeader=parentMode&&data.settings.familyTileAvatars!==false
 const card=(key:Collection,entry:Entry,compact=false)=><RecordCard cozy={experience==='cozy'} compact={compact} key={entry.id} collection={key} entry={entry} subjectColor={subjects.find(s=>s.id===entry.subjectId)?.color} subject={subjects.find(s=>s.id===entry.subjectId)?.name} kid={data.kids.find(k=>k.id===entry.kidId)} showKidBorder={showKidBorder} showKidHeader={showKidHeader} seriesCount={key==='tasks'?seriesCount(entry):0} edit={()=>edit(key,entry)} remove={()=>remove(key,entry)} removeSeries={()=>removeSeries(entry)} duplicate={()=>duplicate(key,entry)} toggle={()=>toggle(key,entry)} pin={()=>void patch(key,entry,{pinned:!entry.pinned})} remind={()=>openEditor({key:'calendarEvents',entry:{id:uid('event'),profileId:profile.id,subjectId:String(entry.subjectId??''),title:'Reminder: '+titleOf(entry),date:today,kind:'personal',notes:'From note: '+titleOf(entry),done:false}})} scheduleReview={key==='exams'?()=>scheduleExamReview(entry):undefined} confirmReview={['tasks','exams','calendarEvents'].includes(key)?()=>void patch(key,entry,{needsReview:false}):undefined} startFocus={key==='tasks'&&!entry.done&&entry.plannedTime?()=>startFocusSession(entry.id,entry.estimatedMinutes as number|undefined):undefined}/>
 const reorder=(from:string,to:string)=>{const sorted=[...notes].sort((a,b)=>(a.position??0)-(b.position??0)),moving=sorted.find(n=>n.id===from);if(!moving||from===to)return;const order=sorted.filter(n=>n.id!==from);order.splice(order.findIndex(n=>n.id===to),0,moving);void run(()=>save(d=>({...d,notes:d.notes.map(n=>n.profileId===profile.id?{...n,position:order.findIndex(x=>x.id===n.id)}:n)})),'Board order saved.')}
 const move=(id:string,by:number)=>{const sorted=[...notes].sort((a,b)=>(a.position??0)-(b.position??0)),index=sorted.findIndex(n=>n.id===id),target=index+by;if(!sorted[target])return;[sorted[index],sorted[target]]=[sorted[target],sorted[index]];void run(()=>save(d=>({...d,notes:d.notes.map(n=>n.profileId===profile.id?{...n,position:sorted.findIndex(x=>x.id===n.id)}:n)})),'Board order saved.')}
 const noteBoard=(pinnedOnly=false)=><section className={'wb-panel wb-board board-'+(data.settings.boardStyle??'paper')}>
  <div className="wb-section-head wb-board-heading"><h2>{pinnedOnly?'Your bulletin board':'Your notes'}</h2><button onClick={()=>create('notes')}>＋ New note</button></div>
  <div className="wb-toolbar"><label>Subject<select value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>View<select value={boardView} onChange={e=>setBoardView(e.target.value)}><option value="board">Board</option><option value="list">List</option></select></label></div>
  <div className={'wb-note-grid wb-board-canvas '+(boardView==='list'?'is-list':'')}>{notes.filter(n=>(!pinnedOnly||n.pinned)&&(!subject||n.subjectId===subject)).sort((a,b)=>(a.position??0)-(b.position??0)).map(n=><div className={'wb-note-wrap size-'+(n.size??'medium')} key={n.id} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',n.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();reorder(e.dataTransfer.getData('text/plain'),n.id)}}>{card('notes',n as unknown as Entry)}<div className="wb-move"><button aria-label={'Move '+n.title+' earlier'} onClick={()=>move(n.id,-1)}>Move earlier</button><button aria-label={'Move '+n.title+' later'} onClick={()=>move(n.id,1)}>Move later</button></div></div>)}</div>
  {!notes.some(n=>(!pinnedOnly||n.pinned)&&(!subject||n.subjectId===subject))&&<p className="wb-board-empty">Your board is ready for your notes.<br/>Pin reminders, ideas and study notes here.</p>}
 <div className="wb-board-tray" aria-hidden="true"><span>✿</span><span>✦</span><span>✿</span></div>
 </section>

 const selectedSubject=subjects.find(s=>s.id===subject)??(subject==='__unassigned__'?undefined:subjects[0])
 const selectedSubjectId=selectedSubject?.id??''
 const subjectTasks=tasks.filter(t=>selectedSubject? t.subjectId===selectedSubject.id : !subjects.some(s=>s.id===t.subjectId))
 const subjectClasses=Array.from({length:28},(_,i)=>addDays(today,i)).flatMap(date=>classOccurrences(data,date)).filter(c=>selectedSubject&&c.block.subjectId===selectedSubject.id)
 const upcomingExams=data.exams.filter(e=>e.profileId===profile.id&&!e.done).sort((a,b)=>a.due.localeCompare(b.due))
 const board=(kind:'notes'|'exams')=>{
  const items=kind==='notes'?notes.filter(n=>n.pinned).sort((a,b)=>(a.position??0)-(b.position??0)):upcomingExams
  return <section className={'sakura-memory-board '+kind+'-memory-board'} aria-label={kind==='notes'?'Pinned study notes':'Exam countdown'}><div className="memory-board-frame"><header className="memory-board-header"><div className="board-ribbon"><span aria-hidden="true">{kind==='notes'?'✿':'★'}</span><div><small>{kind==='notes'?'PINNED COLLECTION':'COMING UP'}</small><strong>{kind==='notes'?'Study Notes':'Exam Countdown'}</strong></div></div><button className="board-link" onClick={()=>navigate(kind==='notes'?'Notes':'Exams')}>{kind==='notes'?'Open notebook':'All exams'} →</button></header><div className="memory-board-canvas">{items.length?items.slice(0,4).map(item=><div key={item.id}>{card(kind,item as unknown as Entry)}</div>):<div className="memory-board-empty"><span aria-hidden="true">{kind==='notes'?'✿':'★'}</span><strong>{kind==='notes'?'Your board is waiting':'No exams on the horizon'}</strong><p>{kind==='notes'?'Pin a note and it will appear here.':'Add an exam when you have a date.'}</p><button onClick={()=>create(kind)}>＋ {kind==='notes'?'New note':'Exam'}</button></div>}</div><div className="board-tray"><span>{items.length} {kind==='notes'?'pinned':'active'}</span><i/><span>{items.length>4?'Open to see all':'A little at a time'}</span></div></div></section>
 }
 const subjectWorkspace=<>
  <div className="wb-section-head subject-page-tools"><h2>Your classes</h2><button onClick={()=>create('subjects')}>＋ Create a subject</button></div>
  <div className="subjects-layout restored-subjects"><nav className="subject-tabs" aria-label="Choose a subject">{subjects.map(s=><button key={s.id} aria-current={selectedSubject?.id===s.id?'true':undefined} className={selectedSubject?.id===s.id?'active':''} onClick={()=>setSubject(s.id)}><i style={{background:s.color}}/><div><strong>{s.name}</strong><small>{tasks.filter(t=>t.subjectId===s.id&&!t.done).length} remaining</small></div></button>)}<button onClick={()=>setSubject('__unassigned__')} aria-current={!selectedSubject?'true':undefined}><div><strong>Unassigned</strong><small>Work without a subject</small></div></button></nav>
  <section className="card subject-workspace"><header className="subject-workspace-title"><div><span className="subject-label" style={{background:selectedSubject?.color??'#6e6572'}}>{selectedSubject?.name??'Unassigned'}</span><h2>{selectedSubject?.name??'Unassigned work'}</h2><p>{selectedSubject?.teacher||profile.label}{selectedSubject?.room?' · '+selectedSubject.room:''}</p></div>{selectedSubject&&<div className="wb-toolbar"><button onClick={()=>edit('subjects',selectedSubject as unknown as Entry)}>Customize</button><button onClick={()=>remove('subjects',selectedSubject as unknown as Entry)}>Move to Trash</button></div>}</header>
  <nav className="subject-section-tabs" aria-label="Subject sections">{['Assignments','Notes','Exams','Schedule'].map(tab=><button key={tab} aria-current={tab===subjectTab?'page':undefined} onClick={()=>setSubjectTab(tab)}>{tab}</button>)}</nav>
  {subjectTab==='Assignments'&&<><div className="subject-quick-add"><p>{subjectTasks.filter(t=>t.done).length} of {subjectTasks.length} complete</p><button className="primary" onClick={()=>create('tasks',today,selectedSubjectId)}>＋ Add assignment</button></div>{subjectTasks.filter(t=>!t.done).map(t=>card('tasks',t as unknown as Entry))}{!subjectTasks.some(t=>!t.done)&&<p>No unfinished assignments here.</p>}<details><summary>Completed · {subjectTasks.filter(t=>t.done).length}</summary>{subjectTasks.filter(t=>t.done).map(t=>card('tasks',t as unknown as Entry))}</details></>}
  {subjectTab==='Notes'&&<><button onClick={()=>create('notes',today,selectedSubjectId)}>＋ New subject note</button><div className="wb-note-grid">{notes.filter(n=>selectedSubject?n.subjectId===selectedSubjectId:!subjects.some(s=>s.id===n.subjectId)).map(n=>card('notes',n as unknown as Entry))}</div>{!notes.some(n=>n.subjectId===selectedSubjectId)&&<p>No notes here yet.</p>}</>}
  {subjectTab==='Exams'&&<><button onClick={()=>create('exams',today,selectedSubjectId)}>＋ Add exam</button>{data.exams.filter(e=>e.profileId===profile.id&&(selectedSubject?e.subjectId===selectedSubjectId:!subjects.some(s=>s.id===e.subjectId))).map(e=>card('exams',e as unknown as Entry))}</>}
  {subjectTab==='Schedule'&&<><p>Classes over the next four weeks.</p><button onClick={()=>navigate('Settings')}>Edit weekly schedule</button>{subjectClasses.map(renderClass)}{!subjectClasses.length&&<p>No upcoming classes linked to this subject. Choose its subject when editing a recurring class.</p>}</>}
  </section></div></>
 const openSettings=(tab:SettingsTab)=>{setSettingsTab(tab);navigate('Settings')}
 const [weatherOpen,setWeatherOpen]=useState(false)
 const openWeather=()=>setWeatherOpen(true)
 const weatherIcon={rain:'🌧️',snow:'🌨️',wind:'🌬️',cloudy:'☁️',clear:'☀️'}[weather.weather]??'⛅'
 const weatherChip=<button type="button" className="kono-weather-chip" onClick={openWeather} title="Sanctuary weather" aria-label={'Sanctuary weather'+(weather.reading?': '+weather.reading.condition+', '+weather.reading.temperatureF+'°F':'')}><span aria-hidden="true">{weatherIcon}</span>{weather.reading&&data.settings.sanctuaryWeatherMode==='live'&&<small>{Math.round(weather.reading.temperatureF)}°</small>}</button>
 const commands=[...visiblePages.map(p=>({label:'Open '+p,hint:'Page',run:()=>navigate(p)})),...SETTINGS_TABS.map(tab=>({label:'Settings › '+tab,hint:'Settings',run:()=>openSettings(tab)})),{label:'Sanctuary weather',hint:'Sanctuary',run:openWeather},{label:'AI helper (API key)',hint:'Settings › Import & export',run:()=>openSettings('Import & export')},...(parentMode?[{label:"Kids' appearance",hint:'Settings › Family',run:()=>openSettings('Family')}]:[]),...(['tasks','notes','exams','calendarEvents','subjects',...(parentMode?['kids'] as const:[])] as Collection[]).flatMap(key=>own(data,key).map(entry=>({label:titleOf(entry),hint:labels[key]+' · '+String(entry.due??entry.date??entry.body??entry.notes??'').slice(0,160),run:()=>edit(key,entry)})))]
 const todayClasses=scheduleClasses(today)
 // Mirrors tomorrowLoose below -- Today's schedule only ever showed recurring classes, so a kid's
 // sports practice, appointment or anything else added straight to today's calendar (not tied to a
 // class subject) was invisible here even though the exact same kind of item already surfaced under
 // Tomorrow's "Also tomorrow". Today gets the same treatment for the same reason.
 const todayLoose=[
  ...tasks.filter(t=>!t.done&&t.due===today).map(t=>({key:'tasks' as Collection,entry:t as unknown as Entry,date:t.due})),
  ...data.exams.filter(e=>e.profileId===profile.id&&!e.done&&e.due===today).map(e=>({key:'exams' as Collection,entry:e as unknown as Entry,date:e.due})),
  ...notes.filter(n=>!n.completed&&entryDate(n as unknown as Entry)===today).map(n=>({key:'notes' as Collection,entry:n as unknown as Entry,date:entryDate(n as unknown as Entry)})),
  ...data.calendarEvents.filter(e=>e.profileId===profile.id&&!e.done&&e.date===today).map(e=>({key:'calendarEvents' as Collection,entry:e as unknown as Entry,date:e.date})),
 ].filter(e=>!e.entry.subjectId||!todayClasses.some(c=>c.block.subjectId===e.entry.subjectId))
 const tomorrowClasses=scheduleClasses(tomorrow)
 const tomorrowLoose=[
  ...tasks.filter(t=>!t.done&&t.due===tomorrow).map(t=>({key:'tasks' as Collection,entry:t as unknown as Entry,date:t.due})),
  ...data.exams.filter(e=>e.profileId===profile.id&&!e.done&&e.due===tomorrow).map(e=>({key:'exams' as Collection,entry:e as unknown as Entry,date:e.due})),
  ...notes.filter(n=>!n.completed&&entryDate(n as unknown as Entry)===tomorrow).map(n=>({key:'notes' as Collection,entry:n as unknown as Entry,date:entryDate(n as unknown as Entry)})),
  ...data.calendarEvents.filter(e=>e.profileId===profile.id&&!e.done&&e.date===tomorrow).map(e=>({key:'calendarEvents' as Collection,entry:e as unknown as Entry,date:e.date})),
 ].filter(e=>!e.entry.subjectId||!tomorrowClasses.some(c=>c.block.subjectId===e.entry.subjectId))
 return <div className={'workbench density-'+(data.settings.density??'comfortable')+' text-'+(data.settings.textSize??'normal')} data-page={page.toLowerCase()} data-experience={experience} data-decoration={data.settings.decoration!==false}>
  <a className="skip-link" href="#workspace-main">Skip to content</a>
  {experience==='cozy'?<div className="cozy-navigation"><Sidebar view={page==='Trash'?'Notes':page} onView={navigate} profile={profile.name} schoolYear={profile.label} profiles={data.profiles} activeProfileId={profile.id} onProfileChange={id=>void save(d=>({...d,activeProfileId:id}))} weekWeather={weather.reading?.daily??[]} weatherLocation={data.settings.sanctuaryWeatherLocations[profile.id]} music={music} parentMode={parentMode} weatherChip={weatherChip}/></div>:<aside className="wb-sidebar"><div className="wb-brand-row"><a className="wb-brand" href="?page=sanctuary" onClick={e=>{e.preventDefault();navigate('Sanctuary')}}><span className="brand-mark" aria-hidden="true"><span>K</span><i>✿</i></span><strong>KONO<small>Study Sanctuary</small></strong></a>{weatherChip}</div><div className="wb-tabs-label">Notebook tabs</div><nav aria-label="Main navigation">{visiblePages.map(p=><button key={p} aria-current={page===p?'page':undefined} onClick={()=>navigate(p)}><span className="wb-nav-icon">{p==='Trash'?<span aria-hidden="true">↶</span>:<NavIcon name={p} experience={experience}/>}</span><span>{p}</span></button>)}</nav><div className="sidebar-music-slot"><MusicPlayer controller={music} compact/></div><label className="wb-profile"><span className="wb-profile-title">{profile.label}</span>Study profile<select value={profile.id} onChange={e=>void save(d=>({...d,activeProfileId:e.target.value}))}>{data.profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label></aside>}
  <main id="workspace-main"><header className="wb-header"><div><small>{profile.label}</small><div className="wb-title-row"><h1>{page}{experience==='cozy'&&<span className="cozy-heading-flower" aria-hidden="true">❀</span>}</h1>{page==='Sanctuary'&&weather.reading&&weather.reading.daily.length>0&&<div className="wb-header-weather"><WeekWeather days={weather.reading.daily} location={data.settings.sanctuaryWeatherLocations[profile.id]}/></div>}</div><SaveStatus store={store}/></div><div className="wb-toolbar">{needsReviewEntries.length>0&&<button type="button" className="needs-review-nav-badge" onClick={()=>setReviewOpen(true)}>🚩 {needsReviewEntries.length} to review</button>}<button onClick={()=>setSearch(true)}>{experience==='cozy'&&<ActionIcon name="search"/>}Search</button>{experience==='cozy'&&<button onClick={()=>navigate('Trash')}><ActionIcon name="trash"/>Trash</button>}<button className="primary" onClick={()=>setAdding(true)}>＋ Add</button>{voiceSupported&&<button className={'voice-add-button'+(voiceListening?' is-listening':'')} onClick={toggleVoiceAdd} aria-pressed={voiceListening} aria-label={voiceListening?'Stop voice input':'Add by voice'} title="Speak an assignment, exam, note or appointment — it opens in the right editor to review"><span className="kono-mic-face" aria-hidden="true"><img src={voiceListening?'/garden/kono/excited.png':'/garden/kono/idle.png'} alt=""/></span>{voiceListening?'Listening…':''}</button>}</div>{konoPhrase&&<div className="kono-speech-bubble" role="status"><img src="/garden/kono/idle.png" alt="" aria-hidden="true"/><p>{konoPhrase.text}</p><button type="button" aria-label="Dismiss" onClick={()=>setKonoPhrase(null)}>×</button></div>}{voiceError&&<p role="alert" className="voice-add-error">{voiceError}</p>}</header>
   <div className="wb-status"><div className="wb-toolbar"><button disabled={!repository.canUndo} onClick={()=>void run(repository.undo,'Undone. Earned progress is kept.')}>Undo</button><button disabled={!repository.canRedo} onClick={()=>void run(repository.redo,'Redone.')}>Redo</button></div></div>
   {message&&<p role="status" className="wb-notice">{message}<button onClick={()=>setMessage('')} aria-label="Dismiss message">×</button></p>}
   {showDigest&&<div className="wb-notice login-digest" role="status"><div><strong>{dueSoon.length} thing{dueSoon.length===1?'':'s'} due in the next 3 days</strong><ul>{dueSoon.slice(0,5).map(t=><li key={t.id}>{t.title} · {dateLabel(t.due)}</li>)}</ul>{dueSoon.length>5&&<small>+{dueSoon.length-5} more</small>}</div><button onClick={dismissDigest}>Got it</button></div>}
   {showCrunch&&<div className="wb-notice crunch-digest" role="status"><div><strong>{crunchDays.length===1?'A busy day is':'Busy days are'} coming up</strong><ul>{crunchDays.slice(0,3).map(([day,list])=><li key={day}>{dateLabel(day)}: {list.length} thing{list.length===1?'':'s'} due{list.filter(i=>i.kind==='exam').length>1?' (multiple exams)':''}</li>)}</ul>{crunchDays.length>3&&<small>+{crunchDays.length-3} more busy day{crunchDays.length-3===1?'':'s'}</small>}</div><button onClick={dismissCrunch}>Got it</button></div>}
   {showReviewDigest&&<div className="wb-notice review-digest" role="status"><div><strong>{needsReviewEntries.length} item{needsReviewEntries.length===1?'':'s'} from a scanned photo need{needsReviewEntries.length===1?'s':''} a check</strong><small>Added automatically — make sure each one is correct.</small></div><button className="primary" onClick={()=>setReviewOpen(true)}>Review now</button><button onClick={dismissReviewDigest}>Later</button></div>}
   {hasDraft&&!editor&&<div className="wb-notice">You have an unfinished draft.<button onClick={()=>{try{const draft=JSON.parse(localStorage.getItem(draftScope)??'null') as Edit;if(!draft||!collections.includes(draft.key)||draft.entry.profileId!==profile.id)throw Error('Invalid draft');setEditor(draft)}catch{setMessage('This draft could not be opened.')}}}>Resume draft</button><button onClick={()=>{setConfirmation({text:'Discard this unfinished draft?',action:()=>{localStorage.removeItem(draftScope);localStorage.removeItem(draftScope+':assignment-dates');setHasDraft(false)}})}}>Discard draft</button></div>}
   {page==='Sanctuary'&&<>
    <section className={'wb-island '+(expanded?'is-expanded':'')}><div className="wb-scene-toolbar"><div className="wb-scene-left"><nav className="island-mode-tabs" aria-label="Sanctuary view"><button aria-current={islandMode==='view'?'page':undefined} onClick={()=>setIslandMode('view')}>Your island</button><button aria-current={islandMode==='decorate'?'page':undefined} onClick={()=>setIslandMode('decorate')}>Decorate</button></nav>{islandMode==='view'&&<div className="wb-stats-strip" role="group" aria-label="Study streak and weekly progress"><div className="wb-stat"><strong>{currentStreak}</strong><small>day streak</small></div><div className="wb-stat"><strong>{weekTotal>0?weekDone+'/'+weekTotal:'—'}</strong><small>{weekTotal>0?'done this week':'nothing due this week'}</small></div></div>}</div><div className="wb-scene-controls"><label className="wb-scene-time" title="Sanctuary time"><span aria-hidden="true">🕐</span><select aria-label="Sanctuary time" value={phase} onChange={e=>setPhase(e.target.value as typeof phase)}>{['auto','morning','afternoon','evening','night'].map(p=><option key={p} value={p}>{p==='auto'?'Live time':p[0].toUpperCase()+p.slice(1)}</option>)}</select></label>{islandMode==='view'&&<div className="wb-island-zoom" role="group" aria-label="Zoom island"><button type="button" onClick={()=>setIslandZoom(z=>Math.max(MIN_ISLAND_ZOOM,+(z-0.25).toFixed(2)))} disabled={islandZoom<=MIN_ISLAND_ZOOM} aria-label="Zoom out">−</button><span aria-live="polite">{Math.round(islandZoom*100)}%</span><button type="button" onClick={()=>setIslandZoom(z=>Math.min(MAX_ISLAND_ZOOM,+(z+0.25).toFixed(2)))} disabled={islandZoom>=MAX_ISLAND_ZOOM} aria-label="Zoom in">＋</button>{islandZoom!==1&&<button type="button" onClick={resetIslandView}>Reset</button>}</div>}<button type="button" className="wb-scene-expand" onClick={()=>setExpanded(v=>!v)}>{expanded?'Close full screen':'⤢ Expand'}</button></div></div><div className="wb-sanctuary-stage"><div ref={islandStageRef} className="wb-sanctuary-zoom-wrap" onTouchStart={onIslandTouchStart} onTouchMove={onIslandTouchMove} onTouchEnd={onIslandTouchEnd} onPointerDown={onIslandPointerDown} onPointerMove={onIslandPointerMove} onPointerUp={onIslandPointerUp} onPointerCancel={onIslandPointerUp}><div className={'wb-sanctuary-zoom'+(islandMode==='view'&&islandZoom!==1?' is-zoomed':'')} style={islandMode==='view'?{transform:`translate(${islandPan.x}px, ${islandPan.y}px) scale(${islandZoom})`}:undefined}><div className={'wb-sanctuary-backdrop'+(islandMode==='decorate'?' is-decorating':'')}><GardenCard phase={phase} weather={weather.weather} reducedMotion={reduced} progress={sanctuaryProgress} decorations={data.sanctuaryDecor[profile.id]?.placements} paused={islandMode==='decorate'} celebrateSignal={celebrateSignal} focusCompanionActive={focusCompanionActive}/></div>{islandMode==='view'&&<SanctuaryDecorLayer data={data} phase={phase}/>}</div></div>{islandMode==='decorate'&&<SanctuaryBuild data={data} save={save} phase={phase}/>}</div></section>
    <section className="wb-panel due-tomorrow-panel"><div className="wb-section-head"><div><small>PLAN AHEAD</small><h2>Assignments due tomorrow</h2></div><button onClick={()=>create('tasks',tomorrow)}>＋ Assignment</button></div>{tasks.filter(t=>!t.done&&t.due===tomorrow).map(t=>card('tasks',t as unknown as Entry))}{!tasks.some(t=>!t.done&&t.due===tomorrow)&&<p>Nothing is due tomorrow.</p>}<details><summary>Due today & overdue · {tasks.filter(t=>!t.done&&t.due<=today).length}</summary>{tasks.filter(t=>!t.done&&t.due<=today).sort((a,b)=>a.due.localeCompare(b.due)).map(t=>card('tasks',t as unknown as Entry))}</details></section>
    <details ref={sanctuaryFocusRef} className="wb-panel sanctuary-focus"><summary>Focus session</summary><FocusSession draftKey={draftScope+':focus'} tasks={tasks} notes={notes} focusRequest={focusRequest} onComplete={id=>void run(()=>save(d=>completeTask(d,id)),'Assignment completed.')} onSaveNote={body=>save(d=>({...d,notes:[...d.notes,{id:uid('note'),profileId:profile.id,subjectId:'',title:'Study session',body,created:new Date().toISOString(),pinned:true}]}))} onFocusActiveChange={setFocusCompanionActive}/></details>
    <div className="today-tomorrow-pair">
    <section className="wb-panel today-schedule-compact"><div className="wb-section-head"><h2>Today’s schedule</h2><div className="wb-toolbar">{scheduleViewPicker}<button onClick={()=>{setSettingsTab('Schedules');navigate('Settings')}}>Edit schedule</button><button type="button" className="wb-collapse-toggle" aria-expanded={!todayCollapsed} aria-label={(todayCollapsed?'Expand':'Collapse')+" today's schedule"} onClick={()=>setTodayCollapsed(v=>!v)}>{todayCollapsed?'▸':'▾'}</button></div></div>{!todayCollapsed&&<><AssignmentProgress tasks={tasks} date={today} label="Today's"/>{schoolDayLabels(data,today).map(label=><p className="school-day-label" key={label}>{label}</p>)}<div className="today-schedule-list">{todayClasses.map(renderCompactClass)}</div>{todayLoose.length>0&&<div className="tomorrow-extra-list"><strong>Also today</strong>{todayLoose.map(e=>card(e.key,e.entry))}</div>}{!todayClasses.length&&!todayLoose.length&&<p>{season&&season.end<today?'Your schedule has ended. Update its dates in Settings.':'No recurring classes or activities today.'}</p>}</>}</section>
    <section className="wb-panel today-schedule-compact tomorrow-schedule"><div className="wb-section-head"><div><small>TOMORROW · {dateLabel(tomorrow)}</small><h2>Tomorrow’s schedule</h2></div><div className="wb-toolbar">{scheduleViewPicker}<button onClick={()=>{setSelectedDate(tomorrow);navigate('Planner')}}>Open day</button><button type="button" className="wb-collapse-toggle" aria-expanded={!tomorrowCollapsed} aria-label={(tomorrowCollapsed?'Expand':'Collapse')+" tomorrow's schedule"} onClick={()=>setTomorrowCollapsed(v=>!v)}>{tomorrowCollapsed?'▸':'▾'}</button></div></div>{!tomorrowCollapsed&&<><AssignmentProgress tasks={tasks} date={tomorrow} label="Tomorrow's"/>{schoolDayLabels(data,tomorrow).map(label=><p className="school-day-label" key={label}>{label}</p>)}<div className="today-schedule-list">{tomorrowClasses.map(renderCompactClass)}</div>{tomorrowLoose.length>0&&<div className="tomorrow-extra-list"><strong>Also tomorrow</strong>{tomorrowLoose.map(e=>card(e.key,e.entry))}</div>}{!tomorrowClasses.length&&!tomorrowLoose.length&&<p>No recurring classes, assignments, notes or reminders tomorrow.</p>}</>}</section>
    </div>
    <details className="wb-panel sanctuary-reminders"><summary>Reminders & events</summary>{data.calendarEvents.filter(e=>e.profileId===profile.id&&!e.done&&e.date<=today).sort((a,b)=>a.date.localeCompare(b.date)).map(e=>card('calendarEvents',e as unknown as Entry))}{!data.calendarEvents.some(e=>e.profileId===profile.id&&!e.done&&e.date<=today)&&<p>No reminders due. Add one from any class date in your calendar.</p>}</details>
    {experience==='cozy'?<div className="restored-board-pair">{board('notes')}{board('exams')}</div>:<>{noteBoard(true)}<section className="wb-panel"><h2>Upcoming exams</h2>{data.exams.filter(e=>e.profileId===profile.id&&!e.done).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3).map(e=>card('exams',e as unknown as Entry))}{!data.exams.some(e=>e.profileId===profile.id&&!e.done)&&<p>No upcoming exams.</p>}</section></>}
   </>}
   {page==='Planner'&&<><div className="wb-toolbar planner-settings-link"><span>Your classes, assignments and daily plans</span><button onClick={()=>{setSettingsTab('Schedules');navigate('Settings')}}>Schedule settings</button></div><Calendar data={data} tasks={tasks} date={selectedDate} selectDate={setSelectedDate} create={create} render={card} renderClass={renderClass} reschedule={reschedule} setting={setting} navigate={navigate} parentMode={parentMode} quickAddEvent={quickAddFamilyEvent}/><StudyPlanner key={planRequest} initialOpen={planRequest>0} draftKey={draftScope+':plan'} profileId={profile.id} plans={plans} tasks={ownTasks} subjects={subjects} setData={save} onSelectDate={setSelectedDate}/></>}
   {page==='Kids'&&<KidsPage data={data} create={create} edit={edit} remove={remove} patch={patch} openSettings={openSettings}/>}
   {page==='Subjects'&&experience!=='simplified'&&subjectWorkspace}
   {page==='Subjects'&&experience==='simplified'&&<><section className="wb-panel"><div className="wb-section-head"><h2>Your subjects</h2><button onClick={()=>create('subjects')}>＋ Subject</button></div><div className="wb-record-grid">{subjects.map(s=>card('subjects',s as unknown as Entry))}</div>{!subjects.length&&<p>Create your first subject to organize your work.</p>}</section><section className="wb-panel"><div className="wb-section-head"><h2>Assignments</h2><button onClick={()=>create('tasks')}>＋ Assignment</button></div><label>Filter subject<select value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All subjects, including unassigned</option>{subjects.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><div className="wb-toolbar"><button onClick={()=>void run(()=>save(d=>tasks.filter(t=>!subject||t.subjectId===subject).reduce((next,t)=>completeTask(next,t.id,true),d)),'Assignments completed.')}>Complete all shown</button><button onClick={()=>void run(()=>save(d=>tasks.filter(t=>!subject||t.subjectId===subject).reduce((next,t)=>completeTask(next,t.id,false),d)),'Assignments reopened; earned progress is kept.')}>Reopen all shown</button></div>{tasks.filter(t=>!subject||t.subjectId===subject).map(t=>card('tasks',t as unknown as Entry))}</section></>}
   {page==='Notes'&&<>{noteBoard()}<details className="wb-panel"><summary>Quiz me · Flashcards</summary><Flashcards draftKey={draftScope+':cards'} profileId={profile.id} decks={data.flashcardDecks.filter(d=>d.profileId===profile.id)} setData={save}/></details></>}
   {page==='K-Quiz'&&<KQuiz onOpenAiSettings={()=>openSettings('Import & export')} profileId={profile.id} lectures={data.kquizLectures.filter(l=>l.profileId===profile.id)} sets={data.kquizSets.filter(s=>s.profileId===profile.id)} sources={data.kquizSources.filter(s=>s.profileId===profile.id)} decks={data.flashcardDecks.filter(d=>d.profileId===profile.id)} subjects={subjects} setData={save}/>}
   {page==='Exams'&&<section className="wb-panel wb-board board-paper"><div className="wb-section-head wb-board-heading"><h2>Your exams</h2><button onClick={()=>create('exams')}>＋ Exam</button></div><div className="wb-note-grid wb-board-canvas">{data.exams.filter(e=>e.profileId===profile.id).sort((a,b)=>a.due.localeCompare(b.due)).map(e=>card('exams',e as unknown as Entry))}{!data.exams.some(e=>e.profileId===profile.id)&&<p className="wb-board-empty">No exams yet. Add a date and what you need to review.</p>}</div><div className="wb-board-tray" aria-hidden="true"><span>✿</span><span>✦</span><span>✿</span></div></section>}
   {page==='Settings'&&<div className="settings-groups"><div className="wb-section-head settings-page-tools"><h2>Settings</h2><small>Version {APP_VERSION} · Build {releaseLabel}</small></div><nav className="subject-section-tabs" aria-label="Settings sections">{SETTINGS_TABS.map(tab=><button key={tab} aria-current={tab===settingsTab?'page':undefined} onClick={()=>setSettingsTab(tab)}>{tab}</button>)}</nav>
   {settingsTab==='Look & feel'&&<><section className="wb-panel"><Appearance settings={data.settings} setting={setting}/></section><section className="wb-panel"><h2>Sound &amp; motion</h2><SoundMotionSettings data={data} setData={save}/></section><section className="wb-panel"><h2>Sanctuary weather</h2><p>Live, manual or clear weather and your weather location are set right on the Sanctuary, from the weather button next to KONO.</p><button type="button" onClick={openWeather}>Open Sanctuary weather</button></section></>}
   {settingsTab==='Notifications'&&<section className="wb-panel"><h2>Notifications</h2><ReminderSettings data={data} setData={save}/>{parentMode&&<FamilyReminderSettings data={data} setting={setting}/>}</section>}
   {settingsTab==='Family'&&<FamilySettings data={data} setting={setting} patch={patch} navigate={navigate}/>}
   {settingsTab==='Schedules'&&<section className="wb-panel"><ScheduleSetup data={data} save={save} draftKey={draftScope} fetchCatalog={repository.fetchSchoolCatalog} submitCatalogEntry={repository.submitSchoolCatalogEntry}/><details><summary>Weekly schedules & seasons · edit or pause</summary><SchedulePanel data={data} save={save} draftKey={draftScope+':schedule'}/></details></section>}
   {settingsTab==='Import & export'&&<section className="wb-panel"><h2>Import &amp; export</h2><div id="ai-helper"><AiHelperSettings profileId={profile.id}/></div><details><summary>Upload photos or screenshots of a calendar, planner, or syllabus</summary><UpdatePlanScanner profileId={profile.id} subjects={subjects} kids={profileKids} save={save} onOpenAiSettings={()=>document.getElementById('ai-helper')?.scrollIntoView({behavior:'smooth',block:'start'})}/></details><details><summary>Import assignments or dated events from a PDF</summary><ScheduleImport data={data} save={save}/></details><details><summary>Share a schedule with someone else</summary><ScheduleShare data={data} save={save}/></details><details><summary>Export to your calendar app</summary><p>Download every assignment, exam and event in {profile.label} as a calendar file, then import or add it in Google Calendar, Apple Calendar, or Outlook. This is a one-time snapshot -- re-download it after making big changes to keep your calendar app in sync.</p><button type="button" onClick={()=>downloadData(buildIcs(data,profile.id),(profile.label||'kono-plan').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.ics','text/calendar')}>Download calendar (.ics)</button></details><BackupPanel store={store}/></section>}
   {settingsTab==='Plans & account'&&<><section className="wb-panel"><AccountPanel store={store}/></section><section className="wb-panel"><h2>Plans</h2><PlanSettings data={data} setData={save} onDeleteProfile={id=>{const p=data.profiles.find(x=>x.id===id);if(!p)return;setConfirmation({text:'Delete plan “'+p.label+'” and all its subjects, assignments, notes, schedules and Sanctuary progress? This does not delete your account or other plans. Export a backup first. Plan deletion is not kept in Trash.',action:()=>void run(()=>save(d=>deleteProfile(d,id)),'Plan deleted. Other plans were kept.')})}}/></section><section className="wb-panel"><h2>Friends</h2>{store.user?<PeerConnections repository={repository} myUserId={store.user.id} reducedMotion={reduced}/>:<p>Sign in with a KONO account to connect with classmates and share your classes.</p>}</section></>}
   </div>}
   {page==='Trash'&&<section className="wb-panel"><h2>Recently removed</h2><p>Restore items here, even after a reload. Undo/Redo covers the last 30 changes in this session. Signed-in Trash syncs with your account.</p>{data.trash.filter(t=>t.profileId===profile.id).map(t=><article className="wb-record" key={t.id}><h3>{t.title}</h3><p>{labels[t.collection as Collection]??'Schedule block'} · Removed {new Date(t.deletedAt).toLocaleString()}</p><div className="wb-toolbar"><button onClick={()=>void run(()=>save(d=>restoreEntry(d,t.id)),'Restored.')}>Restore</button><button onClick={()=>{setConfirmation({text:'Permanently delete “'+t.title+'” from Trash? Older backups may still contain it.',action:()=>void run(()=>save(d=>({...d,trash:d.trash.filter(x=>x.id!==t.id)})),'Removed from Trash.')})}}>Delete permanently</button></div></article>)}{!data.trash.some(t=>t.profileId===profile.id)&&<p>Trash is empty.</p>}</section>}
  </main>
  <nav className="wb-bottom-nav" aria-label="Mobile navigation">{(['Sanctuary','Planner','Notes'] as Page[]).map(p=><button aria-current={page===p?'page':undefined} key={p} onClick={()=>navigate(p)}>{p}</button>)}<button aria-expanded={more} onClick={()=>setMore(v=>!v)}>More</button></nav>
  <div className="wb-music-bar"><MusicPlayer controller={music} compact/></div>
  {confirmation&&<Modal title="Confirm change" close={()=>setConfirmation(null)}><p>{confirmation.text}</p><button onClick={()=>{confirmation.action();setConfirmation(null)}}>Confirm</button><button onClick={()=>setConfirmation(null)}>Cancel</button></Modal>}
  {more&&<Modal title="More" close={()=>setMore(false)}>{(['Kids','Subjects','K-Quiz','Exams','Settings','Trash'] as Page[]).filter(p=>p!=='Kids'||parentMode).map(p=><button key={p} onClick={()=>navigate(p)}>{p}</button>)}<label>Study profile<select value={profile.id} onChange={e=>void save(d=>({...d,activeProfileId:e.target.value}))}>{data.profiles.map(p=><option value={p.id} key={p.id}>{p.label}</option>)}</select></label></Modal>}
  {adding&&<Modal title="Add to your plan" close={()=>setAdding(false)}><div className="quick-add-choice"><label>What are you adding?<select aria-label="Add type" value={addKind} onChange={e=>setAddKind(e.target.value as typeof addKind)}><option value="tasks">Homework</option><option value="exams">Exam or test</option><option value="notes">Study note</option></select></label><p className="wb-muted">Exams appear on the countdown board. Study notes are pinned to your bulletin board.</p><button className="primary" onClick={()=>create(addKind)}>Continue</button></div><button type="button" className="update-entire-plan-button" onClick={()=>{setAdding(false);setScanningPlan(true)}}>📷 Update entire plan — scan notes or a syllabus</button><details className="add-more-choices"><summary>More ways to add</summary><div>{(['studyPlans','calendarEvents','subjects',...(parentMode?['kids'] as const:[])] as Collection[]).map(key=><button key={key} onClick={()=>create(key)}>{labels[key]}</button>)}</div></details></Modal>}
  {weatherOpen&&<Modal title="Sanctuary weather" close={()=>setWeatherOpen(false)}><WeatherSettings data={data} setData={save} weatherState={weather}/></Modal>}
  {scanningPlan&&<Modal title="Update entire plan" close={()=>setScanningPlan(false)}><UpdatePlanScanner profileId={profile.id} subjects={subjects} kids={profileKids} save={save} close={()=>setScanningPlan(false)} onOpenAiSettings={()=>{setScanningPlan(false);openSettings('Import & export')}}/></Modal>}
  {reviewOpen&&<Modal title="Needs review" close={()=>setReviewOpen(false)}><p className="wb-muted">Added automatically from a scanned photo. Check each one — confirming it (or just opening and saving it) clears the flag.</p>{needsReviewEntries.length===0?<p>All caught up.</p>:<>{needsReviewEntries.length>1&&<button type="button" className="primary" onClick={()=>void confirmAllReviews()}>Confirm all {needsReviewEntries.length} items</button>}{needsReviewEntries.map(({key,entry})=>card(key,entry))}</>}</Modal>}
  {search&&<CommandPalette commands={commands} onClose={()=>setSearch(false)}/>}
  {editor&&<EntryEditor key={editor.entry.id} edit={editor} data={data} save={save} draftScope={draftScope} close={(saved,discarded)=>{setEditor(null);setHasDraft(!saved);if(saved)setMessage(discarded?'Draft discarded.':'Saved.')}}/>}
 </div>
}
function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null)
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>opener?.focus()},[])
 return <dialog ref={ref} className="wb-dialog" aria-label={title} onCancel={e=>{e.preventDefault();close()}}><header><h2>{title}</h2><button aria-label="Close dialog" onClick={close}>×</button></header>{children}</dialog>
}
function RecordCard({cozy,collection,entry,subject,subjectColor,kid,showKidBorder=false,showKidHeader=false,seriesCount=0,compact=false,edit,remove,removeSeries,duplicate,toggle,pin,remind,scheduleReview,confirmReview,startFocus}:{cozy:boolean;collection:Collection;entry:Entry;subject?:string;subjectColor?:string;kid?:Kid;showKidBorder?:boolean;showKidHeader?:boolean;seriesCount?:number;compact?:boolean;edit:()=>void;remove:()=>void;removeSeries?:()=>void;duplicate:()=>void;toggle:()=>void;pin:()=>void;remind:()=>void;scheduleReview?:()=>void;confirmReview?:()=>void;startFocus?:()=>void}){
 const note=collection==='notes',paper=note||collection==='exams',done=Boolean(note?entry.completed:entry.done),canComplete=['tasks','notes','exams','calendarEvents'].includes(collection)
 const due=String(entry.due??entry.date??''),dueLabel=due?countdown(due,done):''
 const subtasks=collection==='tasks'?entry.subtasks as Subtask[]|undefined:undefined
 const subtaskProgress=subtasks?.length?subtasks.filter(s=>s.done).length+'/'+subtasks.length+' steps':''
 const inSeries=seriesCount>1
 const priority=collection==='exams'||isImportantEntry(collection,entry)
 // Scanned in from a photo and not yet looked at -- a visible flag until someone opens it (which
 // clears it automatically, see EntryEditor) or taps "Looks good" to confirm it without editing.
 const needsReview=Boolean(confirmReview&&entry.needsReview)
 const reviewBadge=needsReview&&<span className="needs-review-badge">⚠ Check this</span>
 const reviewButton=needsReview&&<button onClick={confirmReview}>Looks good</button>
 const plannedTime=collection==='tasks'&&entry.plannedTime?String(entry.plannedTime):''
 const plannedChip=plannedTime&&<span className="subtask-chip">🕐 {classTime(plannedTime)}</span>
 const startFocusButton=startFocus&&<button type="button" className="start-focus-button" onClick={startFocus}>▶ Start focus session</button>
 if(cozy&&collection==='tasks')return <article className={'cozy-task-row '+(done?'is-complete':'')+(needsReview?' needs-review-record':'')} style={{'--subject-accent':subjectColor??'#b47e75'} as CSSProperties}><button className="cozy-complete" aria-label={(done?'Reopen ':'Complete ')+titleOf(entry)} aria-pressed={done} onClick={toggle}>{done?'✓':'○'}</button><div className="cozy-task-copy">{reviewBadge}<h3>{titleOf(entry)}</h3><p>{subject??'Unassigned'} · {dateLabel(String(entry.due))} <span className={'countdown-chip '+(daysUntil(String(entry.due))<0?'is-overdue':'')}>{dueLabel}</span>{plannedChip}{subtaskProgress&&<span className="subtask-chip">{subtaskProgress}</span>}{inSeries&&<span className="subtask-chip">1 of {seriesCount} dates</span>}</p>{Boolean(entry.notes)&&<SafeNoteBody text={String(entry.notes)}/>}</div><div className="cozy-task-actions">{reviewButton}{startFocusButton}<button onClick={edit}><ActionIcon name="edit"/>Edit</button><button onClick={duplicate}><ActionIcon name="copy"/>Duplicate</button><button onClick={remove}><ActionIcon name="trash"/>Move to Trash</button>{inSeries&&<button onClick={removeSeries}><ActionIcon name="trash"/>Delete whole series ({seriesCount})</button>}</div></article>
 if(cozy&&paper&&compact)return <button type="button" className={'cozy-pin-mini'+(priority?' priority-record':'')+(done?' is-complete':'')+(needsReview?' needs-review-record':'')} style={{'--note-paper':String(entry.color??'#ffd2dd'),'--note-ink':String(entry.textColor??'#2f2942')} as CSSProperties} onClick={edit}><span className="push-pin pin-mini" aria-hidden="true"/>{priority&&<b aria-hidden="true">★</b>}<strong>{titleOf(entry)}</strong>{dueLabel&&<span className={'countdown-chip '+(daysUntil(due)<0?'is-overdue':'')}>{dueLabel}</span>}</button>
 if(cozy&&paper)return <div className={'cozy-note-record '+(priority?'priority-record':'')+(needsReview?' needs-review-record':'')} >{priority&&<span className="priority-flag">★ IMPORTANT · {dueLabel}</span>}{reviewBadge}<StickyNoteView kind={note?'note':'exam'} color={String(entry.color??'#ffd2dd')} textColor={String(entry.textColor??'#2f2942')} font={String(entry.font??'rounded')} pinned={Boolean(entry.pinned)} completed={done} subject={subject??'General'} title={titleOf(entry)} body={String(entry.body??entry.notes??'')} highlight={String(entry.highlight??'transparent')} dateLabel={due?dateLabel(due)+(dueLabel?' · '+dueLabel:''):undefined} onEdit={edit} onDelete={remove} onTogglePin={note?pin:undefined} onToggleComplete={toggle}/><div className="wb-toolbar">{reviewButton}<button className="cozy-duplicate" onClick={duplicate}>Duplicate</button>{note&&<button onClick={remind}>Add reminder</button>}{scheduleReview&&<button onClick={scheduleReview}>Schedule review</button>}</div></div>
 // A calendar event's own compact tile: the time is the first thing a parent's eye hits, in a
 // fixed-width column so a whole day's times line up for a straight vertical scan. showKidBorder and
 // showKidHeader are each their own opt-in (see the Kids page's appearance settings) and both require
 // parentMode -- a solo student who never turns parent mode on always gets the plain subject-based
 // header and a neutral border here, exactly as before the family calendar existed, never "Family" or
 // a color that means nothing to them.
 // A kid's own border flair (see the Kids page's Appearance panel) only ever paints when a specific
 // kid is both tagged and showing -- an untagged "Family" item or a solo student's plain tile always
 // gets the ordinary static border, never someone else's chosen animation.
 const borderStyle=showKidBorder&&kid?kid.borderStyle??'modern':'solid',look=showKidBorder&&kid?kidBorderLook(kid):null
 if(collection==='calendarEvents')return <article className={'wb-family-event kid-border-'+borderStyle+(look?.className??'')+(done?' is-complete':'')+(needsReview?' needs-review-record':'')} style={look?.style??{'--kid-color':showKidBorder?'#b47e75':undefined} as CSSProperties}>
  <div className="wb-family-event-main">
   <div className="wb-family-event-time">{entry.time?<><span className="wb-family-event-start">{classTime(String(entry.time))}</span>{entry.endTime&&<span className="wb-family-event-end">–{classTime(String(entry.endTime))}</span>}</>:'—'}</div>
   <div className="wb-family-event-info">
    <small>{showKidHeader?(kid?(kid.emoji?kid.emoji+' ':'')+kid.name:'Family')+(subject?' · '+subject:''):subject??(entry.subjectId?'Removed subject':'General')}</small>
    <h3>{titleOf(entry)}</h3>
   </div>
   {reviewBadge}{due&&<span className={'countdown-chip '+(daysUntil(due)<0?'is-overdue':'')}>{dueLabel}</span>}
  </div>
  <div className="wb-toolbar">{reviewButton}<button onClick={toggle}>{done?'Reopen':'Complete'}</button><button onClick={edit}>Edit</button><details className="wb-actions"><summary>More actions</summary><div><button onClick={duplicate}>Duplicate</button><button onClick={remove}>Move to Trash</button></div></details></div>
  {borderStyle!=='solid'&&<KidBorderFx/>}
 </article>
 return <article className={'wb-record wb-record-'+collection+' '+(paper?'wb-sticky note-font-'+String(entry.font??'rounded'):'')+(done?' is-complete':'')+(needsReview?' needs-review-record':'')} style={paper?{'--note-paper':String(entry.color??'#fff2b4'),'--note-ink':String(entry.textColor??'#2f2942')} as CSSProperties:{'--subject-accent':subjectColor??String(entry.color??'#b47e75')} as CSSProperties}>
  <>{paper&&<span className="push-pin pin-0" aria-hidden="true"/>}</>{reviewBadge}<small>{subject??(entry.subjectId?'Removed subject':'General')} · {labels[collection]}{note&&entry.pinned?' · Pinned':''}</small><h3>{titleOf(entry)}</h3>{Boolean(entry.due||entry.date)&&<p>{dateLabel(String(entry.due??entry.date))}{done?' · Completed':''} {due&&<span className={'countdown-chip '+(daysUntil(due)<0?'is-overdue':'')}>{dueLabel}</span>}{plannedChip}{subtaskProgress&&<span className="subtask-chip">{subtaskProgress}</span>}{inSeries&&<span className="subtask-chip">1 of {seriesCount} dates</span>}</p>}
  {Boolean(entry.body||entry.notes)&&<div className="wb-record-body" style={{background:String(entry.highlight??'transparent')}}><SafeNoteBody text={String(entry.body??entry.notes)}/></div>}
  {collection==='subjects'&&<p>{String(entry.teacher??'')}{entry.room?' · '+String(entry.room):''}</p>}
  <div className="wb-toolbar">{canComplete&&<button onClick={toggle}>{done?'Reopen':'Complete'}</button>}{reviewButton}{startFocusButton}<button onClick={edit}>Edit</button><details className="wb-actions"><summary>More actions</summary><div><button onClick={duplicate}>Duplicate</button>{note&&<button onClick={remind}>Add reminder</button>}{note&&<button onClick={pin}>{entry.pinned?'Remove from board':'Pin to board'}</button>}{scheduleReview&&<button onClick={scheduleReview}>Schedule review</button>}<button onClick={remove}>Move to Trash</button>{inSeries&&<button onClick={removeSeries}>Delete whole series ({seriesCount})</button>}</div></details></div>
 </article>
}
function EntryEditor({edit,data,save,draftScope,close}:{edit:Edit;data:AppData;save:Store['repository']['update'];draftScope:string;close:(saved:boolean,discarded?:boolean)=>void}){
 const [entry,setEntry]=useState(edit.entry),[busy,setBusy]=useState(false),[error,setError]=useState(''),[draftError,setDraftError]=useState('')
 const bodyRef=useRef<HTMLTextAreaElement>(null)
 const titleKey=edit.key==='subjects'||edit.key==='kids'?'name':'title',note=edit.key==='notes'
 const isNewAssignment=edit.key==='tasks'&&!edit.original
 const extraDatesKey=draftScope+':assignment-dates'
 const [extraDates,setExtraDates]=useState<string[]>(()=>{if(!isNewAssignment)return [];try{const saved=JSON.parse(localStorage.getItem(extraDatesKey)??'[]');return Array.isArray(saved)?saved.filter(d=>typeof d==='string'):[]}catch{return []}})
 const [repeatUntil,setRepeatUntil]=useState('')
 const [newSubtask,setNewSubtask]=useState('')
 const saveExtraDates=(next:string[])=>{setExtraDates(next);try{localStorage.setItem(extraDatesKey,JSON.stringify(next))}catch{/* Best effort; the editor is still the source of truth while open. */}}
 const toggleDate=(date:string)=>saveExtraDates((extraDates.includes(date)?extraDates.filter(d=>d!==date):[...extraDates,date]).sort())
 const addWeeklyRepeats=()=>{
  const due=String(entry.due??'');if(!due||!repeatUntil)return
  const weekly:string[]=[];let next=addDays(due,7),guard=0
  while(next<=repeatUntil&&guard<104){weekly.push(next);next=addDays(next,7);guard++}
  saveExtraDates(Array.from(new Set([...extraDates,...weekly])).sort())
 }
 const addSubtask=()=>{const title=newSubtask.trim();if(!title)return;field('subtasks',[...(entry.subtasks as Subtask[]??[]),{id:uid('subtask'),title,done:false}]);setNewSubtask('')}
 const persist=(next:Entry)=>{try{localStorage.setItem(draftScope,JSON.stringify({...edit,entry:next}));setDraftError('');return true}catch{setDraftError('Draft storage is unavailable. Keep this editor open until saved.');return false}}
 const field=(key:string,value:unknown)=>{const next={...entry,[key]:value};persist(next);setEntry(next)}
 const append=(key:string,text:string)=>{const current=String(entry[key]??'');field(key,current.trim()?current+' '+text:text)}
 const format=(before:string,after:string)=>{const textarea=bodyRef.current;if(!textarea)return;const key=note?'body':'notes',body=String(entry[key]??''),start=textarea.selectionStart,end=textarea.selectionEnd;field(key,body.slice(0,start)+before+(body.slice(start,end)||'text')+after+body.slice(end));requestAnimationFrame(()=>textarea.focus())}
 const keep=()=>{if(!busy&&persist(entry))close(false)}
 const clearDrafts=()=>{try{localStorage.removeItem(draftScope);if(isNewAssignment)localStorage.removeItem(extraDatesKey)}catch{/* Saved record is authoritative. */}}
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(draftError){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[draftError])
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;setBusy(true);setError('')
  const seriesDates=isNewAssignment?extraDates.filter(d=>d&&d!==(entry as Entry).due):[]
  const recurringId=seriesDates.length?uid('recurring'):undefined
  // Saving an entry -- even unchanged -- is the moment a person actually looked at it, so this is
  // also where a photo-scanned item's needsReview flag clears (see RecordCard/applyAssignmentPhoto).
  const payload={...entry,[titleKey]:String(entry[titleKey]??'').trim(),needsReview:false,...(edit.key==='notes'&&!edit.original?{pinned:true}:{}),...(recurringId?{recurringId}:{})}
  const copies=seriesDates.map(due=>({...payload,id:uid(edit.key),due}))
  try{const saved=await save(d=>{if(d.activeProfileId!==entry.profileId)throw Error('Your profile changed. Reopen the editor.');const current=records(d,edit.key).find(r=>r.id===entry.id);if(edit.original&&!equal(current,edit.original))throw Error('This item changed elsewhere. Your draft is preserved; reopen the current item before saving.');if(!edit.original&&current)throw Error('This item already exists.');return {...d,[edit.key]:edit.original?records(d,edit.key).map(r=>r.id===entry.id?payload:r):[...records(d,edit.key),payload,...copies]}});if(saved){clearDrafts();close(true)}else setError('Not saved yet. Your draft is still here.')}catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}
 }
 return <Modal title={(edit.original?'Edit ':'New ')+labels[edit.key]} close={keep}><form onSubmit={submit}><fieldset disabled={busy}><label>{edit.key==='subjects'?'Subject name':edit.key==='kids'?'Kid name':'Title'}<input autoFocus required maxLength={edit.key==='subjects'||edit.key==='kids'?200:1000} value={String(entry[titleKey]??'')} onChange={e=>field(titleKey,e.target.value)}/></label>
  {note&&<VoiceInputButton label="title" onText={text=>append(titleKey,text)}/>}
  {!['subjects','kids'].includes(edit.key)&&<label>Subject<select value={String(entry.subjectId??'')} onChange={e=>field('subjectId',e.target.value)}><option value="">General / unassigned</option>{data.subjects.filter(s=>s.profileId===entry.profileId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  {(['tasks','exams','calendarEvents'] as Collection[]).includes(edit.key)&&<label>Kid (optional)<select value={String(entry.kidId??'')} onChange={e=>field('kidId',e.target.value||undefined)}><option value="">Whole family / unassigned</option>{data.kids.filter(k=>k.profileId===entry.profileId).map(k=><option key={k.id} value={k.id}>{(k.emoji?k.emoji+' ':'')+k.name}</option>)}</select></label>}
  {('due' in entry||'date' in entry)&&<label>Date<input required type="date" value={String(entry.due??entry.date??'')} onInput={e=>{const next={...entry,['due' in entry?'due':'date']:e.currentTarget.value,...(edit.key==='tasks'?{plannedTime:undefined}:{})};persist(next);setEntry(next)}}/></label>}
  {edit.key==='calendarEvents'&&<label>Start time (optional)<input type="time" value={String(entry.time??'')} onChange={e=>field('time',e.target.value||undefined)}/></label>}
  {edit.key==='calendarEvents'&&<label>End time (optional)<input type="time" value={String(entry.endTime??'')} onChange={e=>field('endTime',e.target.value||undefined)}/></label>}
  {isNewAssignment&&<div className="wb-multidate"><p className="wb-muted">Repeats on more days? Click each extra date below — one assignment is created per date.</p><MultiDatePicker primary={String(entry.due??'')} selected={extraDates} onToggle={toggleDate}/><div className="wb-repeat-weekly"><label>Repeat weekly until<input type="date" min={String(entry.due??'')} value={repeatUntil} onChange={e=>setRepeatUntil(e.target.value)}/></label><button type="button" className="secondary" disabled={!repeatUntil||!entry.due} onClick={addWeeklyRepeats}>+ Add weekly occurrences</button></div>{extraDates.length>0&&<p className="wb-multidate-summary">{extraDates.length} extra date{extraDates.length===1?'':'s'} selected: {extraDates.map(d=>dateLabel(d)).join(', ')}</p>}</div>}
  {edit.key==='tasks'&&<div className="wb-subtasks"><p className="wb-muted">Break this assignment into steps.</p>{!!(entry.subtasks as Subtask[]??[]).length&&<ul>{(entry.subtasks as Subtask[]).map(st=><li key={st.id}><label className="wb-check"><input type="checkbox" checked={st.done} onChange={e=>field('subtasks',(entry.subtasks as Subtask[]).map(x=>x.id===st.id?{...x,done:e.target.checked}:x))}/><span className={st.done?'is-done':''}>{st.title}</span></label><button type="button" aria-label={'Remove step '+st.title} onClick={()=>field('subtasks',(entry.subtasks as Subtask[]).filter(x=>x.id!==st.id))}>Remove</button></li>)}</ul>}<div className="wb-subtask-add"><input value={newSubtask} onChange={e=>setNewSubtask(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addSubtask()}}} maxLength={300} placeholder="Add a step" aria-label="Add a step"/><button type="button" onClick={addSubtask}>Add step</button></div></div>}
  {edit.key==='tasks'&&<div className="wb-time-estimate"><label>About how long will this take?<select value={String(entry.estimatedMinutes??'')} onChange={e=>field('estimatedMinutes',e.target.value?Number(e.target.value):undefined)}><option value="">Not sure</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></label>
   {Boolean(entry.estimatedMinutes)&&<TimeBlockSuggestions data={data} date={String(entry.due??'')} minutes={Number(entry.estimatedMinutes)} plannedTime={entry.plannedTime as string|undefined} onPick={time=>field('plannedTime',time)} onClear={()=>field('plannedTime',undefined)}/>}</div>}
  {edit.key==='notes'&&<label>Type<select value={String(entry.kind??'note')} onChange={e=>field('kind',e.target.value)}><option value="note">Note / reminder</option><option value="homework">Homework / assignment</option><option value="exam">Exam / project</option></select></label>}
  {edit.key==='calendarEvents'&&<label>Event type<select value={String(entry.kind)} onChange={e=>field('kind',e.target.value)}>{['exam','test','quiz','assignment','study','activity','personal','sports','appointment','work','other'].map(k=><option key={k}>{k}</option>)}</select></label>}
  {edit.key==='calendarEvents'&&entry.kind==='sports'&&(()=>{const result=entry.result as MatchResult|undefined;const outcome=result?matchOutcome(result):null;return <div className="wb-match-result"><p className="wb-muted">Final score (once the match is over)</p><div className="wb-form-grid"><label>Us<input type="number" min={0} max={999} value={result?.ourScore??''} onChange={e=>field('result',{ourScore:Number(e.target.value),opponentScore:result?.opponentScore??0})}/></label><label>Opponent<input type="number" min={0} max={999} value={result?.opponentScore??''} onChange={e=>field('result',{ourScore:result?.ourScore??0,opponentScore:Number(e.target.value)})}/></label>{result&&<button type="button" onClick={()=>field('result',undefined)}>Clear score</button>}</div>{outcome&&<p className={'wb-match-outcome is-'+outcome}>{outcome==='win'?'Win':outcome==='loss'?'Loss':'Tie'} · {result!.ourScore}–{result!.opponentScore}</p>}</div>})()}
  {edit.key==='subjects'?<><label>Teacher<input maxLength={200} value={String(entry.teacher??'')} onChange={e=>field('teacher',e.target.value)}/></label><label>Room<input maxLength={100} value={String(entry.room??'')} onChange={e=>field('room',e.target.value)}/></label><label>Resources (one per line)<textarea value={(entry.resources as string[]??[]).join('\n')} onChange={e=>field('resources',e.target.value.split('\n').filter(Boolean))}/></label><label>Subject color<input type="color" value={String(entry.color??'#4169a8')} onChange={e=>field('color',e.target.value)}/></label></>:edit.key==='kids'?<p className="wb-muted">Set their emoji and color from the Kids page's "🎨 Appearance" button — this keeps it in one place.</p>:<label>{note?'Note':'Details'}<textarea ref={bodyRef} rows={6} maxLength={100000} value={String(note?entry.body??'':entry.notes??'')} onChange={e=>field(note?'body':'notes',e.target.value)}/></label>}
  {!['subjects','kids'].includes(edit.key)&&<VoiceInputButton label={note?'note':'details'} onText={text=>append(note?'body':'notes',text)}/>}
  {(note||edit.key==='exams')&&<><div className="wb-note-formatting" aria-label="Text formatting"><button type="button" onClick={()=>format('<b>','</b>')}>Bold</button><button type="button" onClick={()=>format('<i>','</i>')}>Italic</button><button type="button" onClick={()=>format('<mark>','</mark>')}>Highlight selection</button></div><div className="wb-paper-swatches" aria-label="Paper colors">{['#ffd2dd','#d9efff','#fff2b4','#dff1c2','#e7d5ff','#ffdcb8'].map((color,i)=><button type="button" key={color} aria-label={'Paper '+['Pink','Blue','Cream','Green','Lavender','Peach'][i]} aria-pressed={entry.color===color} style={{background:color}} onClick={()=>field('color',color)}/>)}</div></>}
  {(note||edit.key==='exams')&&<details><summary>Customize paper & text</summary><div className="wb-form-grid"><label>Paper<input type="color" value={String(entry.color??'#fff2b4')} onChange={e=>field('color',e.target.value)}/></label><label>Text color<input type="color" value={String(entry.textColor??'#2f2942')} onChange={e=>field('textColor',e.target.value)}/></label><label>Text style<select value={String(entry.font??'rounded')} onChange={e=>field('font',e.target.value)}>{['rounded','handwritten','serif','mono'].map(f=><option key={f}>{f}</option>)}</select></label><label>Highlight<select value={String(entry.highlight??'transparent')} onChange={e=>field('highlight',e.target.value)}><option value="transparent">None</option><option value="#fff39d">Yellow</option><option value="#ffc4dd">Pink</option><option value="#c9f3d4">Mint</option></select></label>{note&&<label>Note size<select value={String(entry.size??'medium')} onChange={e=>field('size',e.target.value)}>{['small','medium','large'].map(s=><option key={s}>{s}</option>)}</select></label>}</div></details>}
  {note&&<label className="wb-check"><input type="checkbox" checked={Boolean(entry.pinned)} onChange={e=>field('pinned',e.target.checked)}/>Pin to bulletin board</label>}
  {Boolean(entry.studyPlanId)&&<p>This unit still follows its study plan’s carryover rules.</p>}
  {error&&<p role="alert">{error}</p>}{draftError&&<p role="alert">{draftError}</p>}<p className="wb-muted">Unfinished edits are kept on this device when you close this editor.</p><div className="wb-toolbar"><button className="primary" type="submit">{busy?'Saving…':'Save'}</button><button type="button" onClick={keep}>Close, keep draft</button><button type="button" onClick={()=>{if(window.confirm('Discard this unfinished edit? Your saved item stays unchanged.')){try{clearDrafts();close(true,true)}catch{setError('Could not discard the draft. Try again.')}}}}>Discard draft</button></div>
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
function Calendar({data,tasks,date,selectDate,create,render,renderClass,reschedule,setting,navigate,parentMode,quickAddEvent}:{data:AppData;tasks:Task[];date:string;selectDate:(date:string)=>void;create:(key:Collection,date?:string)=>void;render:(key:Collection,entry:Entry,compact?:boolean)=>ReactNode;renderClass:(item:ClassOccurrence)=>ReactNode;reschedule:(key:Collection,entry:Entry,date:string)=>void;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>;navigate:(page:Page)=>void;parentMode:boolean;quickAddEvent:(date:string,payload:{title:string;kind:CalendarEventKind;kidId?:string;time?:string;endTime?:string})=>Promise<boolean>}){
 const [mode,setMode]=useState(()=>window.matchMedia('(max-width: 700px)').matches?'agenda':'month'),[month,setMonth]=useState(()=>localDate().slice(0,7))
 const [dropTarget,setDropTarget]=useState('')
 // Parent mode's whole point is speed: click a date, pick who/what/when, done -- without opening the
 // full assignment/exam/note/event editor. Only ever offered when parentMode is on (see the toolbar
 // and Agenda-day buttons below); the state itself just tracks which date's popup is open, if any.
 const [quickAdd,setQuickAdd]=useState<string|null>(null)
 const showAcademic=data.settings.scheduleShowAcademic??true
 const showSports=data.settings.scheduleShowSports??true
 const showAppointments=data.settings.scheduleShowAppointments??true
 const categoryVisible=(category:'academic'|'sports'|'appointments')=>category==='academic'?showAcademic:category==='sports'?showSports:showAppointments
 const kids=data.kids.filter(k=>k.profileId===data.activeProfileId)
 // Which kid a day's items belong to is a filter on top of the academic/sports/appointments one, not
 // a replacement for it -- both narrow the same one shared calendar together. Kept as local state
 // (not a persisted setting, unlike the checkboxes above) so a newly added kid shows by default: it's
 // simply absent from "hidden" until someone unchecks them, same pattern as the old Family page.
 const [hiddenKids,setHiddenKids]=useState<Set<string>>(()=>new Set())
 const kidVisible=(kidId?:string)=>!kidId||!hiddenKids.has(kidId)
 const toggleKid=(id:string)=>setHiddenKids(v=>{const next=new Set(v);if(next.has(id))next.delete(id);else next.add(id);return next})
 const kidOf=(kidId?:string)=>kidId?kids.find(k=>k.id===kidId):undefined
 const scheduleClasses=(day:string)=>classOccurrences(data,day).filter(c=>categoryVisible(c.season.category??'academic')&&kidVisible(c.block.kidId))
 const entries=[
  ...(showAcademic?tasks.filter(t=>kidVisible(t.kidId)).map(t=>({key:'tasks' as Collection,entry:t as unknown as Entry,date:t.due})):[]),
  ...(showAcademic?own(data,'exams').filter(e=>kidVisible(e.kidId as string|undefined)).map(e=>({key:'exams' as Collection,entry:e,date:String(e.due)})):[]),
  ...(showAcademic?own(data,'notes').filter(n=>entryDate(n)).map(n=>({key:'notes' as Collection,entry:n,date:entryDate(n)})):[]),
  ...own(data,'calendarEvents').filter(e=>categoryVisible(eventCategory(e.kind as CalendarEventKind))&&kidVisible(e.kidId as string|undefined)).map(e=>({key:'calendarEvents' as Collection,entry:e,date:String(e.date)})),
 ]
 const selectedEntries=entries.filter(entry=>entry.date===date)
 const selectedClasses=scheduleClasses(date)
 const start=new Date(month+'-01T12:00:00'),gridStart=addDays(month+'-01',-start.getDay())
 const shift=(by:number)=>{const next=new Date(start);next.setMonth(next.getMonth()+by);setMonth(localDate(next).slice(0,7))}
 const dragEntry=(e:DragEvent<HTMLElement>,item:{key:Collection;entry:Entry})=>{e.dataTransfer.setData('application/json',JSON.stringify({key:item.key,id:item.entry.id}));e.dataTransfer.effectAllowed='move'}
 const dropOn=(day:string)=>({onDragOver:(e:DragEvent<HTMLElement>)=>{e.preventDefault();e.dataTransfer.dropEffect='move'},onDragEnter:()=>setDropTarget(day),onDragLeave:()=>setDropTarget(t=>t===day?'':t),onDrop:(e:DragEvent<HTMLElement>)=>{e.preventDefault();setDropTarget('');const raw=e.dataTransfer.getData('application/json');if(!raw)return;try{const dropped=JSON.parse(raw) as {key:Collection;id:string},item=entries.find(x=>x.entry.id===dropped.id&&x.key===dropped.key);if(item&&item.date!==day)reschedule(item.key,item.entry,day)}catch{/* Ignore a drag payload from outside this calendar. */}}})
 const dayHasPriority=(entry:{key:Collection;entry:Entry})=>isImportantEntry(entry.key,entry.entry)
 const draggableEntry=(e:{key:Collection;entry:Entry})=><div key={e.entry.id} className="wb-draggable" draggable onDragStart={ev=>dragEntry(ev,e)}>{render(e.key,e.entry,dayHasPriority(e))}</div>
 // An exam/important item still floats to the top regardless of its time, but everything else sorts
 // chronologically -- so a day's events read top-to-bottom in time order, the same order their times
 // line up visually in the new family-event tile (see RecordCard's calendarEvents branch).
 const entryTime=(entry:{key:Collection;entry:Entry})=>entry.key==='calendarEvents'?entry.entry.time as string|undefined:entry.key==='tasks'?entry.entry.plannedTime as string|undefined:undefined
 const importantFirst=<T extends {key:Collection;entry:Entry}>(list:T[]):T[]=>[...list].sort((a,b)=>Number(dayHasPriority(b))-Number(dayHasPriority(a))||(entryTime(a)??'99:99').localeCompare(entryTime(b)??'99:99'))
 const attachedToClass=(entry:{key:Collection;entry:Entry;date:string},classes:ClassOccurrence[])=>Boolean(entry.entry.subjectId&&classes.some(c=>c.block.subjectId===entry.entry.subjectId&&c.date===entry.date))
 const dayEntries=Array.from({length:7},(_,i)=>({day:addDays(date,i),entries:entries.filter(e=>e.date===addDays(date,i)),classes:scheduleClasses(addDays(date,i))}))
 // A dot/list-item's color: whichever kid it's tagged to, so a parent scanning the grid sees "whose"
 // before "what subject" -- falling back to the subject color (and the priority red) exactly as
 // before for anything not tagged to a kid.
 const dotColor=(entry:{key:Collection;entry:Entry})=>kidOf(entry.entry.kidId as string|undefined)?.color??(dayHasPriority(entry)?'#d24864':data.subjects.find(s=>s.id===entry.entry.subjectId)?.color??'#d9828a')
 const classDotColor=(c:ClassOccurrence)=>kidOf(c.block.kidId)?.color??data.subjects.find(s=>s.id===c.block.subjectId)?.color??'#b77c98'
 return <section className="wb-panel cozy-calendar-shell"><div className="wb-section-head"><h2>Your calendar</h2><div className="wb-toolbar"><button onClick={()=>{selectDate(localDate());setMonth(localDate().slice(0,7))}}>Today</button><div className="schedule-view-picker" role="group" aria-label="Schedule view"><label><input type="checkbox" checked={showAcademic} onChange={e=>void setting('scheduleShowAcademic',e.target.checked)}/> Academics</label><label><input type="checkbox" checked={showSports} onChange={e=>void setting('scheduleShowSports',e.target.checked)}/> Sports</label><label><input type="checkbox" checked={showAppointments} onChange={e=>void setting('scheduleShowAppointments',e.target.checked)}/> Appointments</label></div><label>Calendar view<select value={mode} onChange={e=>setMode(e.target.value)}><option value="agenda">Agenda</option><option value="month">Month</option></select></label></div></div>
  {kids.length>0&&<div className="family-kid-list" role="group" aria-label="Filter calendar by kid">{kids.map(k=><label key={k.id} className="family-kid-chip" style={{'--kid-color':k.color} as CSSProperties}><input type="checkbox" checked={!hiddenKids.has(k.id)} onChange={()=>toggleKid(k.id)}/><i className="family-kid-swatch" aria-hidden="true"/>{(k.emoji?k.emoji+' ':'')+k.name}</label>)}</div>}
  {mode==='month'&&<><div className="wb-section-head"><button aria-label="Previous month" onClick={()=>shift(-1)}>‹</button><h3>{start.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><button aria-label="Next month" onClick={()=>shift(1)}>›</button></div><div className="wb-calendar">{dayNames.map(d=><span key={d}>{d.slice(0,3)}</span>)}{Array.from({length:42},(_,i)=>addDays(gridStart,i)).map(day=>{const dayEntriesForDate=entries.filter(e=>e.date===day),classes=scheduleClasses(day),important=dayEntriesForDate.filter(dayHasPriority);return <button key={day} aria-label={dateLabel(day)+' · '+(dayEntriesForDate.length+classes.length)+' entries · '+important.length+' important · '+schoolDayLabels(data,day).join(' · ')} aria-pressed={date===day} className={(day.slice(0,7)!==month?'muted-day ':'')+(important.length?'has-priority':'')+(dropTarget===day?' drop-target':'')} onClick={()=>{selectDate(day);if(parentMode)setQuickAdd(day)}} {...dropOn(day)}><span className="calendar-date-row"><strong>{Number(day.slice(-2))}</strong>{important.length>0&&<b title="Exam or project">★ {important.length}</b>}</span><small>{dayEntriesForDate.length+classes.length||''}{dayEntriesForDate.length+classes.length?' entries':''}</small><span className="school-day-mini">{schoolDayLabels(data,day).map(label=>label.slice(label.indexOf(':')+1).trim()).join(' · ')}</span><span className="calendar-class-preview">{classes.slice(0,2).map(c=><span key={c.id}>{c.block.label}</span>)}</span><span className="calendar-entry-preview">{dayEntriesForDate.slice(0,2).map(e=><span className={dayHasPriority(e)?'is-priority':''} key={e.entry.id}>{dayHasPriority(e)?'★ ':''}{titleOf(e.entry)}</span>)}</span><span className="wb-cal-dots" aria-hidden="true">{classes.slice(0,5).map(c=><i key={c.id} style={{background:classDotColor(c)}}/>)}{dayEntriesForDate.slice(0,4).map(e=><i key={e.entry.id} style={{background:dotColor(e)}}/>)}</span></button>})}</div></>}
  {mode==='agenda'&&<div className="wb-agenda-upcoming"><h4>This week</h4>{dayEntries.map(({day,entries:dayEntriesForDate,classes:dayClasses},i)=>{const important=dayEntriesForDate.filter(dayHasPriority).length;return <details key={day} open={i===0} className={'wb-agenda-day'+(dropTarget===day?' drop-target':'')} {...dropOn(day)}><summary><h3>{i===0?'Today':i===1?'Tomorrow':dateLabel(day)}{i<2&&<small className="wb-agenda-day-date"> · {dateLabel(day)}</small>}</h3><span className="wb-agenda-day-meta"><small>{dayClasses.length+dayEntriesForDate.length} item{dayClasses.length+dayEntriesForDate.length===1?'':'s'}{important?' · '+important+' important':''}</small>{parentMode&&<button type="button" className="quick-add-kid-event" onClick={e=>{e.preventDefault();e.stopPropagation();setQuickAdd(day)}}>＋ Add</button>}</span></summary>{schoolDayLabels(data,day).map(label=><p className="school-day-label" key={label}>{label}</p>)}{importantFirst(dayEntriesForDate.filter(e=>e.key==='exams'||!attachedToClass(e,dayClasses))).map(draggableEntry)}{dayClasses.map(renderClass)}{!dayClasses.length&&!dayEntriesForDate.length&&<p className="wb-muted">Nothing scheduled.</p>}</details>})}</div>}
  {/* Only shown in Month view: in Agenda mode the selected date is always day 0 of "This week"
      above (dayEntries starts counting from `date`), so this would just repeat that day's own
      list. Month view has no other per-day detail panel, so a clicked date still needs one here. */}
  {mode==='month'&&<div className="planner-day-paper"><header><small>YOUR DAILY PAGE</small><h3>{dateLabel(date)}{schoolDayLabels(data,date).map(label=><span className="planner-day-school" key={label}> · {label}</span>)}</h3></header><AssignmentProgress tasks={tasks} date={date} label={dateLabel(date)}/><div className="planner-date-tools"><label>Selected date<input type="date" value={date} onInput={e=>{if(e.currentTarget.value){selectDate(e.currentTarget.value);setMonth(e.currentTarget.value.slice(0,7))}}}/></label><details className="planner-add-menu"><summary>＋ Add to this date</summary><div><button onClick={()=>create('tasks',date)}>Assignment</button><button onClick={()=>create('notes',date)}>Study note</button><button className="is-priority" onClick={()=>create('exams',date)}>★ Exam / project</button><button onClick={()=>create('calendarEvents',date)}>Reminder / event</button></div></details></div>
  <section className={'planner-day-board'+(dropTarget===date?' drop-target':'')} {...dropOn(date)}><p className="wb-muted">Drag an item here — or onto any date below — to reschedule it.</p>{selectedEntries.length||selectedClasses.length?<><div className="planner-day-list">{importantFirst(selectedEntries.filter(e=>e.key==='exams'||!attachedToClass(e,selectedClasses))).map(draggableEntry)}{selectedClasses.map(renderClass)}</div><div className="planner-day-meta"><small>{dateLabel(date)} contains {selectedClasses.length} class block{selectedClasses.length===1?'':'s'} and {selectedEntries.length} added item{selectedEntries.length===1?'':'s'}</small></div></> : <p className="wb-muted">No items for this date yet. Add an assignment, note, exam/project or reminder above.</p>}</section>
  </div>}
  {quickAdd&&<Modal title={'Add for '+dateLabel(quickAdd)} close={()=>setQuickAdd(null)}>{kids.length?<QuickFamilyAdd kids={kids} onCancel={()=>setQuickAdd(null)} onSave={async payload=>{if(await quickAddEvent(quickAdd,payload))setQuickAdd(null)}}/>:<><p className="wb-muted">No kids added yet.</p><button type="button" onClick={()=>{setQuickAdd(null);navigate('Kids')}}>Manage kids</button></>}</Modal>}
  </section>
}
const QUICK_KIND_OPTIONS=[['sports','Sports'],['appointment','Appointment'],['personal','Event']] as const
// The fast path parent mode promises: kid, type, a short title and an optional time -- no subject
// picker, notes, voice input or multi-date repeat. Saves straight to calendarEvents (see
// quickAddFamilyEvent) rather than opening the full EntryEditor.
function QuickFamilyAdd({kids,onCancel,onSave}:{kids:Kid[];onCancel:()=>void;onSave:(payload:{title:string;kind:CalendarEventKind;kidId?:string;time?:string;endTime?:string})=>Promise<void>}){
 const [title,setTitle]=useState(''),[kidId,setKidId]=useState(kids[0]?.id??''),[kind,setKind]=useState<CalendarEventKind>('appointment'),[time,setTime]=useState(''),[endTime,setEndTime]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy||!title.trim())return
  setBusy(true);setError('')
  try{await onSave({title:title.trim(),kind,kidId:kidId||undefined,time:time||undefined,endTime:endTime||undefined})}catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}
 }
 return <form onSubmit={submit} className="quick-family-add"><fieldset disabled={busy}>
  <label>Kid<select autoFocus value={kidId} onChange={e=>setKidId(e.target.value)}><option value="">Whole family</option>{kids.map(k=><option key={k.id} value={k.id}>{(k.emoji?k.emoji+' ':'')+k.name}</option>)}</select></label>
  <label>Type<select value={kind} onChange={e=>setKind(e.target.value as CalendarEventKind)}>{QUICK_KIND_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  <label>What is it?<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Soccer practice, Dentist…"/></label>
  <label>Start time (optional)<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
  <label>End time (optional)<input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}/></label>
  {error&&<p role="alert">{error}</p>}
  <div className="wb-toolbar"><button className="primary" type="submit">{busy?'Adding…':'Add'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
 </fieldset></form>
}
// A per-kid tag list for the one shared family calendar -- add each kid once here with a color and
// emoji, then tag any assignment, exam, class or event with them from its own editor (see
// EntryEditor's Kid picker and the recurring-class editors) and filter the Planner calendar by kid
// there, the same way subjects already work. Kids are ordinary generic collection entries (see
// store/workspace.ts), so create/edit/remove below reuse the app's existing undo/redo and Trash.
// Settings › Family. A solo student only ever sees the Parent mode switch here; everything else
// appears once it's on.
function FamilySettings({data,setting,patch,navigate}:{data:AppData;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>;patch:(key:Collection,entry:Entry,changes:Partial<Entry>)=>Promise<void>;navigate:(page:Page)=>void}){
 const [lookOpen,setLookOpen]=useState(false)
 const parentMode=data.settings.parentMode===true
 return <section className="wb-panel family-settings"><h2>Family</h2>
  <label className="wb-check"><input type="checkbox" checked={parentMode} onChange={e=>void setting('parentMode',e.target.checked)}/>Parent mode: show the Kids tab</label>
  <p className="theme-picker-description">Turn this on if you're a parent managing more than one kid on a shared device. It adds a Kids tab for tagging assignments, exams, classes and events with a kid — and a kid filter on your calendar — the same way subjects already work. Off by default, so it stays out of the way if you're not a parent.</p>
  {parentMode&&<>
  <div className="kid-appearance-toggles">
   <label className="wb-check"><input type="checkbox" checked={data.settings.familyTileBorders!==false} onChange={e=>void setting('familyTileBorders',e.target.checked)}/>Color-code event tiles by kid</label>
   <label className="wb-check"><input type="checkbox" checked={data.settings.familyTileAvatars!==false} onChange={e=>void setting('familyTileAvatars',e.target.checked)}/>Show each kid's emoji and name on their tiles</label>
  </div>
   <div className="wb-toolbar"><button type="button" onClick={()=>navigate('Kids')}>Manage kids</button><button type="button" onClick={()=>setLookOpen(true)}>🎨 Kids' appearance</button></div>
   {lookOpen&&<KidAppearancePanel data={data} patch={patch} close={()=>setLookOpen(false)}/>}
  </>}
 </section>
}
// Settings › Notifications, parent mode only. Family reminders ride on browser notifications.
function FamilyReminderSettings({data,setting}:{data:AppData;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>}){
 const notifyOn=Boolean(data.settings.browserNotifications)&&notificationsSupported()&&Notification.permission==='granted'
 return <section className="card settings-list family-reminder-settings"><h3>Family</h3>
  <label className="wb-check"><input type="checkbox" disabled={!notifyOn} checked={Boolean(data.settings.familyEventReminders)} onChange={e=>void setting('familyEventReminders',e.target.checked)}/>Remind me 15 minutes before a kid's event starts or ends</label>
  <p className="wb-muted">{notifyOn?'Notifications are labeled with each kid\'s name.':'Turn on Browser notifications above to use this.'}</p>
 </section>
}
function KidsPage({data,create,edit,remove,patch,openSettings}:{openSettings:(tab:SettingsTab)=>void;data:AppData;create:(key:Collection)=>void;edit:(key:Collection,entry:Entry)=>void;remove:(key:Collection,entry:Entry)=>void;patch:(key:Collection,entry:Entry,changes:Partial<Entry>)=>Promise<void>}){
 const [appearanceOpen,setAppearanceOpen]=useState(false)
 const kids=data.kids.filter(k=>k.profileId===data.activeProfileId)
 return <section className="wb-panel family-calendar">
  <div className="wb-section-head"><div><small>ONE SHARED CALENDAR</small><h2>Kids</h2></div><div className="wb-toolbar"><button type="button" onClick={()=>setAppearanceOpen(true)}>🎨 Appearance</button><button onClick={()=>create('kids')}>＋ Add a kid</button></div></div>
  <p className="wb-muted">Add each kid once, then tag any assignment, exam, class or event with them from its own editor and filter your Planner calendar by kid — the same way you already filter by subject. Pick their emoji and color under Appearance.</p>
  <div className="family-kid-list" role="group" aria-label="Kids">
   {kids.map(k=><div key={k.id} className="family-kid-chip" style={{'--kid-color':k.color} as CSSProperties}><i className="family-kid-swatch" aria-hidden="true"/><strong>{(k.emoji?k.emoji+' ':'')+k.name}</strong><button type="button" onClick={()=>edit('kids',k as unknown as Entry)}>Edit</button><button type="button" onClick={()=>remove('kids',k as unknown as Entry)}>Move to Trash</button></div>)}
  </div>
  {!kids.length&&<p className="wb-muted">No kids added yet. Add one to start tagging their assignments, exams, classes and events on your calendar.</p>}
  <p className="wb-muted">Reminders for your kids' events, and the family-wide look switches, live in Settings: <button type="button" className="link-button" onClick={()=>openSettings('Notifications')}>Notifications</button> · <button type="button" className="link-button" onClick={()=>openSettings('Family')}>Family</button></p>
  {appearanceOpen&&<KidAppearancePanel data={data} patch={patch} close={()=>setAppearanceOpen(false)}/>}
 </section>
}
// The whole point of a curated grid over a bare text field: a parent (or a kid picking their own,
// with a parent watching) can browse and tap rather than hunt through an OS emoji picker. The custom
// field underneath still covers anything not in this set.
// A dedicated page for how kids look on their tiles, kept separate from the plain add/edit-kid form
// (see EntryEditor) and from the general Settings/Appearance page (theme, text size) -- both of those
// are used by every profile, including a solo student's own personal plan with no kids at all, and
// this one is reached only from the Kids page, itself hidden unless parent mode is on.
function KidAppearancePanel({data,patch,close}:{data:AppData;patch:(key:Collection,entry:Entry,changes:Partial<Entry>)=>Promise<void>;close:()=>void}){
 const kids=data.kids.filter(k=>k.profileId===data.activeProfileId)
 return <Modal title="Kids' appearance" close={close}>
  <p className="wb-muted">Pick each kid's own emoji, color and border below. Changes show up right away on their tiles across the Planner and Sanctuary. Family-wide on/off switches are in Settings › Family.</p>
  {!kids.length&&<p className="wb-muted">Add a kid first (close this and use "＋ Add a kid"), then come back here to customize how they look.</p>}
  {kids.map(k=><KidAppearanceEditor key={k.id} kid={k} patch={patch}/>)}
 </Modal>
}
// The glow, ring and travelling particles for a kid's border style; all the look lives in workbench.css.
const KidBorderFx=()=><span className="kid-border-fx" aria-hidden="true"><b/><s/><i/><i/><i/><i/><i/><i/><i/><i/></span>
// A kid's border tuning as the inline vars/classes workbench.css reads (see "Per-kid tuning" there).
const kidBorderLook=(kid:Kid)=>({className:' kid-glow-'+(kid.borderGlow??'soft')+(kid.borderExtras===false?' kid-extras-off':''),style:{'--kid-color':kid.color,'--kid-speed':String(kid.borderSpeed??1),'--kid-ring-a':kid.borderColors?.[0],'--kid-ring-b':kid.borderColors?.[1]} as CSSProperties})
// Each style's own two colors, used to seed the pickers when "Use my own colors" is first turned on.
const BORDER_THEME_COLORS:Record<KidBorderStyle,(kid:Kid)=>[string,string]>={cute:()=>['#ff8ec7','#9ecbff'],sports:k=>[k.color,'#ffffff'],modern:k=>[k.color,'#ffffff'],unique:k=>[k.color,'#ff7ad9'],space:()=>['#6f8cff','#1f2456'],garden:()=>['#3f8f3a','#74c466'],ocean:()=>['#0d6eaf','#44b8ea'],neon:()=>['#ff3fd0','#2fe6ff']}
const GLOW_OPTIONS=[['off','Off'],['soft','Soft'],['strong','Strong']] as const
// Local state that saves after a short pause, so dragging a slider or color picker doesn't write every step.
function useDebouncedSave<T>(saved:T,save:(value:T)=>void){
 const [draft,setDraft]=useState(saved),saveRef=useRef(save)
 useEffect(()=>{saveRef.current=save})
 // Keyed on the values only (save is a fresh closure each render), so a value the store normalizes
 // away can't re-trigger itself forever.
 useEffect(()=>{if(Object.is(draft,saved))return;const t=setTimeout(()=>saveRef.current(draft),250);return()=>clearTimeout(t)},[draft,saved])
 return [draft,setDraft] as const
}
const BORDER_STYLE_OPTIONS=[['cute','Cute 💗'],['sports','Sports 🏁'],['modern','Modern'],['unique','Unique'],['space','Space 🚀'],['garden','Garden 🌿'],['ocean','Ocean 🌊'],['neon','Neon']] as const
function KidAppearanceEditor({kid,patch}:{kid:Kid;patch:(key:Collection,entry:Entry,changes:Partial<Entry>)=>Promise<void>}){
 const [customEmoji,setCustomEmoji]=useState('')
 const borderStyle=kid.borderStyle??'modern'
 const setEmoji=(emoji:string)=>void patch('kids',kid as unknown as Entry,{emoji})
 const setColor=(color:string)=>void patch('kids',kid as unknown as Entry,{color})
 const setBorderStyle=(style:KidBorderStyle)=>void patch('kids',kid as unknown as Entry,{borderStyle:style})
 const [speed,setSpeed]=useDebouncedSave(kid.borderSpeed??1,v=>void patch('kids',kid as unknown as Entry,{borderSpeed:v}))
 const [colors,setColors]=useDebouncedSave(kid.borderColors?.join(',')??'',v=>void patch('kids',kid as unknown as Entry,{borderColors:v?v.split(','):undefined}))
 const [colorA,colorB]=colors?colors.split(','):BORDER_THEME_COLORS[borderStyle](kid)
 const tuned=kid.borderSpeed!==1||kid.borderGlow!=='soft'||kid.borderExtras===false||Boolean(kid.borderColors)
 const look=kidBorderLook({...kid,borderSpeed:speed,borderColors:colors?[colorA,colorB]:undefined})
 return <div className={'kid-appearance-editor'+look.className} style={look.style}>
  <div className="kid-appearance-head"><i className="family-kid-swatch" aria-hidden="true"/><strong>{(kid.emoji?kid.emoji+' ':'')+kid.name}</strong></div>
  <div className={'wb-family-event kid-border-'+borderStyle+' kid-appearance-preview'} aria-hidden="true"><div className="wb-family-event-main"><div className="wb-family-event-time"><span className="wb-family-event-start">3:30 PM</span></div><div className="wb-family-event-info"><small>{(kid.emoji?kid.emoji+' ':'')+kid.name}</small><h3>Practice</h3></div></div><KidBorderFx/></div>
  <div className="kid-emoji-custom"><label>Emoji<input maxLength={40} placeholder={kid.emoji?'Current: '+kid.emoji+' · type or paste a new one':'Type or paste one from your keyboard'} value={customEmoji} onChange={ev=>setCustomEmoji(ev.target.value)}/></label><button type="button" disabled={!customEmoji.trim()} onClick={()=>{setEmoji(customEmoji.trim());setCustomEmoji('')}}>Use this</button>{kid.emoji&&<button type="button" onClick={()=>void patch('kids',kid as unknown as Entry,{emoji:undefined})}>Remove emoji</button>}</div>
  <p className="wb-muted">Color</p>
  <div className="kid-color-grid" role="group" aria-label={kid.name+"'s color"}>
   {KID_COLORS.map(c=><button type="button" key={c} aria-pressed={kid.color===c} aria-label={c} style={{background:c}} onClick={()=>setColor(c)}/>)}
   <label className="kid-color-custom">Custom<input type="color" value={kid.color} onChange={e=>setColor(e.target.value)}/></label>
  </div>
  <p className="wb-muted">Border</p>
  <div className="kid-border-grid" role="group" aria-label={kid.name+"'s border style"}>
   {BORDER_STYLE_OPTIONS.map(([value,label])=><button type="button" key={value} className={'kid-border-swatch kid-border-'+value} aria-pressed={borderStyle===value} onClick={()=>setBorderStyle(value)}><span/>{label}</button>)}
  </div>
  <div className="kid-border-tuning">
   <label className="kid-border-speed">Animation speed<input type="range" min={KID_BORDER_SPEED.min} max={KID_BORDER_SPEED.max} step={0.25} value={speed} onChange={e=>setSpeed(Number(e.target.value))}/><output>{speed}×</output></label>
   <div className="kid-border-glow" role="group" aria-label={kid.name+"'s border glow"}><span>Glow</span>{GLOW_OPTIONS.map(([value,label])=><button type="button" key={value} aria-pressed={(kid.borderGlow??'soft')===value} onClick={()=>void patch('kids',kid as unknown as Entry,{borderGlow:value as KidBorderGlow})}>{label}</button>)}</div>
   <label className="wb-check"><input type="checkbox" checked={kid.borderExtras!==false} onChange={e=>void patch('kids',kid as unknown as Entry,{borderExtras:e.target.checked})}/>Moving extras (hearts, balls, planets, flowers, waves…)</label>
   <label className="wb-check"><input type="checkbox" checked={Boolean(colors)} onChange={e=>setColors(e.target.checked?BORDER_THEME_COLORS[borderStyle](kid).join(','):'')}/>Use my own border colors</label>
   {colors&&<div className="kid-border-colors"><label>Color 1<input type="color" value={colorA} onChange={e=>setColors(e.target.value+','+colorB)}/></label><label>Color 2<input type="color" value={colorB} onChange={e=>setColors(colorA+','+e.target.value)}/></label></div>}
   {tuned&&<button type="button" className="kid-border-reset" onClick={()=>{setSpeed(1);setColors('');void patch('kids',kid as unknown as Entry,{borderSpeed:1,borderGlow:'soft',borderExtras:true,borderColors:undefined})}}>Reset border to the style's defaults</button>}
  </div>
 </div>
}
function Appearance({settings,setting}:{settings:SettingsData;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>}){
 const activePalette=settings.experience==='cozy'?cozyPalette(settings.theme):settings.theme
 const paletteLabel=(theme:string)=>({coral:'Coral · Colorful',sakura:'Sakura · Colorful',lavender:'Lavender Dream',mint:'Mint Study',honey:'Honey Desk',zen:'Zen Garden · Minimal',floral:'Floral Chic',ocean:'Ocean Breeze · Beachy',professional:'Professional · Muted'}[theme]??theme[0].toUpperCase()+theme.slice(1))
 const active=settings.experience??'cozy'
 const activeOption=experienceOptions.find(o=>o.id===active)
 return <section className="wb-panel"><h2>Choose your KONO experience</h2><div className="theme-picker-grid">{experienceOptions.map(option=><button key={option.id} type="button" className={'theme-picker-tile experience-'+option.id} aria-pressed={active===option.id} title={option.description} onClick={()=>void setting('experience',option.id)}><ExperienceIcon id={option.id}/><strong>{option.title}</strong></button>)}</div>{activeOption&&<p className="theme-picker-description">{activeOption.description}</p>}{!fixedPaletteExperiences.includes(settings.experience??'cozy')&&<><h3>Color palette</h3><div className="wb-themes">{(settings.experience==='cozy'?[...cozyPalettes]:['coral','sakura','professional','forest','ocean','midnight','paper']).map(t=><button className={'theme-'+t} key={t} aria-pressed={activePalette===t} onClick={()=>void setting('theme',t)}><span/>{paletteLabel(t)}{activePalette===t?' ✓':''}</button>)}</div></>}
  <div className="wb-form-grid"><label>Text size<select value={settings.textSize??'normal'} onChange={e=>void setting('textSize',e.target.value as SettingsData['textSize'])}><option value="normal">Normal</option><option value="large">Large</option></select></label><label>Spacing<select value={settings.density??'comfortable'} onChange={e=>void setting('density',e.target.value as SettingsData['density'])}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label>Board background<select value={settings.boardStyle??'paper'} onChange={e=>void setting('boardStyle',e.target.value as SettingsData['boardStyle'])}><option value="paper">Cream paper</option><option value="cork">Cork</option><option value="plain">Plain</option></select></label><label className="wb-check"><input type="checkbox" checked={settings.decoration!==false} onChange={e=>void setting('decoration',e.target.checked)}/>Decorative details</label></div><p>Interface themes never recolor your Sanctuary artwork.</p></section>
}


