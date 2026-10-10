import {Fragment,Suspense,lazy,useEffect,useMemo,useRef,useState,type CSSProperties,type DragEvent,type PointerEvent,type ReactNode,type SetStateAction,type TouchEvent} from 'react'
import {deleteProfile} from './store/deleteProfile'
import {usePlannerRepository} from './store/repository'
import {uid,localDate,dayNames,eventCategory,type AppData,type SettingsData,type Task,type Subtask,type CalendarEventKind,type Kid} from './store/model'
import {nextKidColor,kidDueItems,kidTimeBlockItems,kidFamilyEventItems} from './store/kids'
import {collections,records,titleOf,equal,removeEntry,restoreEntry,completeTask,type Collection,type Entry} from './store/workspace'
import {calendarTasks,addDays} from './store/studyScheduler'
import {planExamReview} from './store/examReview'
import {classifyVoiceInput} from './store/voiceIntake'
import {useSpeechToText} from './hooks/useSpeechToText'
import {syncCurrentTaskCompletion,createSanctuaryProgress} from './game/progression/progressionEngine'
import {konoMood} from './store/konoMood'
import {addCareEvent,ALL_TREATS,ASLEEP_LINE,AWAY_LINE,bedtime,careMeters,favoriteSnack,fedLine,HELLO_LINE,HIGH_FIVE_MS,highFiveLine,isAwayVisit,nextPlayAt,pantry,PET_EVERY_MS,PET_LINES,PLAY_LINES,tasted,tasteEventId,tasteLine,TICKLE_LINES,type CareEvent} from './store/konoCare'
import {dayGlance} from './store/dayGlance'
import {OUTFITS,outfitsOffered,todaysWish,unlockedOutfits,wardrobeStats,wishEvent,wishGrantedOn,wishProgress,wishText,wornOutfit,type OutfitId} from './store/konoWardrobe'
import KonoFace from './components/KonoFace'
import {findFor,findSrc,foundCounts,foundLine,rollFrom} from './store/konoFinds'
import {nextUpList} from './store/nextUp'
import {bondLevel,bondLine,bondPoints,giftsAt,giftSrc,GIFTS,HEART_PATS_AT,PAT_HEART_LINES} from './store/konoBond'
import {presentLine,presentSrc,stampCard,CARD_SIZE} from './store/konoStamps'
import {friendSrc,friendsMet,visitEvent,visitEventId,visitLine,visitorToday} from './store/konoFriends'
import {konoNote,moodLine,MOODS,noteText,examEventId,nudgeEventId,testDay,testsFrom,type Mood,type Test} from './store/konoNotes'
import {changeDetail,changeTitle,schoolChanges} from './store/schoolHeadsUp'
import {APP_BADGE_SETTING,rememberBadgeChoice,showAppBadge} from './store/appBadge'
import {BABBLE_SETTING} from './konoBabbleSetting'
import NextUp from './components/NextUp'
import {earnedStickers,seasonOn,stickerOffered,STICKERS} from './store/stickers'
import {konoCelebration,konoStreakMilestone,STREAK_MILESTONES,type KonoPhrase} from './store/konoPhrases'
import {useReducedMotion,useMusicController,usePhoneWidth,usePrefersDark} from './hooks/useComfort'
import {useDueNotifications,useTimeBlockNotifications,useFamilyEventNotifications} from './hooks/useDueNotifications'
import {usePushReminders} from './hooks/usePushReminders'
import {useLinkedCalendars} from './hooks/useLinkedCalendars'
import {useLiveSanctuaryWeather} from './hooks/useLiveSanctuaryWeather'
import ClassOccurrenceCard from './components/ClassOccurrenceCard'
import {classOccurrences,classTime,type ClassOccurrence} from './store/classSchedule'
// Styles of the on-demand panels below stay in the startup CSS, in their original cascade position:
// several of them also style shared classes (.wb-toolbar, .wb-calendar, .school-day-label, …).
import './components/schedule-import.css'
import './components/school-calendar.css'
import './components/sports-setup.css'
import {schoolDayLabels} from './store/schoolCalendar'
import {StickyNoteView} from './LegacyApp'
import Sidebar from './components/Sidebar'
import {lazyPanel} from './lazyPanel'
import Modal from './components/Modal'
import {labels,type Edit} from './store/entryLabels'
import type {LiveWeatherState} from './game/weather/liveWeather'
type SettingsProps={data:AppData;setData:(action:SetStateAction<AppData>)=>Promise<boolean>}
const PlanSettings=lazyPanel<SettingsProps&{onDeleteProfile?:(id:string)=>void}>(()=>import('./SettingsPanels').then(m=>({default:m.PlanSettings})))
const WeatherSettings=lazyPanel<SettingsProps&{weatherState:LiveWeatherState}>(()=>import('./SettingsPanels').then(m=>({default:m.WeatherSettings})))
const SoundMotionSettings=lazyPanel<SettingsProps>(()=>import('./SettingsPanels').then(m=>({default:m.SoundMotionSettings})))
const ReminderSettings=lazyPanel<SettingsProps>(()=>import('./SettingsPanels').then(m=>({default:m.ReminderSettings})))
import {AccountBanners,Onboarding,RecoveryScreen,SaveStatus} from './components/AccountPanel'
type StoreProps={store:ReturnType<typeof usePlannerRepository>}
/** The three-step welcome on a brand-new plan; only new students download it. */
const WelcomeTour=lazy(()=>import('./components/WelcomeTour'))
const KonoCorner=lazy(()=>import('./components/KonoCorner'))
/** Holds the tour's place while its code loads, so nothing below jumps when it arrives. */
const TourPlaceholder=()=><section className="wb-panel welcome-tour is-loading" aria-hidden="true"/>
const AccountPanel=lazyPanel<StoreProps>(()=>import('./components/AccountSettings').then(m=>({default:m.AccountPanel})))
const BackupPanel=lazyPanel<StoreProps>(()=>import('./components/AccountSettings').then(m=>({default:m.BackupPanel})))
const SupportAdminPanel=lazyPanel<StoreProps>(()=>import('./components/AccountSettings').then(m=>({default:m.SupportAdminPanel})))
const FeedbackButton=lazyPanel<StoreProps>(()=>import('./components/AccountSettings').then(m=>({default:m.FeedbackButton})))
const AiHelperSettings=lazyPanel<{profileId:string}>(()=>import('./components/AiHelper').then(m=>({default:m.AiHelperSettings})))
import GardenCard from './components/GardenCard'
import './components/StudyPlanner.css'
import './components/kquiz.css'
const CommandPalette=lazyPanel(()=>import('./components/CommandPalette'))
import MusicPlayer from './components/MusicPlayer'
import SafeNoteBody from './components/SafeNoteBody'
import type {FocusRequest} from './components/FocusSession'
const FocusSession=lazyPanel(()=>import('./components/FocusSession'))
import SanctuaryDecorLayer from './components/SanctuaryDecorLayer'
import './components/peer-connections.css'
import {NavIcon,WeekWeather} from './components/Sidebar'
import {downloadData} from './store/localRepository'
import {APP_VERSION} from './version'
import './workbench.css'
import './design-restoration.css'
import './experiences.css'
import './cozy-workspaces.css'
import './planner-polish.css'
import './cozy-controls.css'
import './compact-header.css'
import './ui-polish.css'
import './team-themes.css'
import './dark-mode.css'
import './ui-sweep.css'
import './motion-polish.css'
import './home.css'
import './pages.css'
import {hop,stagger,trackPointer} from './motionCore'
/** Petals and hearts load in their own file, fetched shortly after KONO opens. */
const effects=()=>import('./delight')
const celebrateDone=()=>void effects().then(m=>m.celebrateDone()).catch(()=>undefined)
const floatHearts=(el:Element|null)=>void effects().then(m=>m.floatHearts(el)).catch(()=>undefined)
import ActionIcon from './components/ActionIcon'
import BrandLogo from './components/BrandLogo'
import {currentStreak as streakFrom,recapDay,weekRecap} from './store/weekRecap'
import {useLocalSetting} from './hooks/useLocalSetting'
import type {WeekItem} from './components/WeekGrid'
import type {QuickDayItem} from './components/QuickDayAdd'
const WeekGrid=lazyPanel(()=>import('./components/WeekGrid'))
import GettingStarted,{type StartStep} from './components/GettingStarted'
import OverdueCard from './components/OverdueCard'
import QuickAddBox from './components/QuickAddBox'
import SwipeRow from './components/SwipeRow'
const AddFromSiri=lazyPanel(()=>import('./components/AddFromSiri'))
import {uploadPendingPhotos} from './store/photoStore'
import type {QuickAddGuess} from './store/quickAdd'
import {readLinked} from './store/linkedCalendars'
import {currentPushSubscription} from './store/pushDevice'
import {weekDrop} from './store/weekDrop'
import {PLANNER_SOURCES,classSource,entrySource,sourcesInPlan,type PlannerSource} from './store/plannerSources'
import {teamJersey} from './teamThemes'
import AddToCalendar,{type AddChoice,type AddChoiceId} from './components/AddToCalendar'
// Panels that aren't needed on first paint load on demand.
const ScheduleImport=lazyPanel(()=>import('./components/ScheduleImport'))
const CalendarImport=lazyPanel(()=>import('./components/CalendarImport'))
const WeekPlanner=lazyPanel(()=>import('./components/WeekPlanner'))
const WeekRecap=lazyPanel(()=>import('./components/WeekRecap'))
const PushSettings=lazyPanel(()=>import('./components/PushSettings'))
const CalendarSubscribe=lazyPanel(()=>import('./components/CalendarSubscribe'))
const ScheduleSetup=lazyPanel(()=>import('./components/ScheduleSetup'))
const ScheduleShare=lazyPanel(()=>import('./components/ScheduleShare'))
const Flashcards=lazyPanel(()=>import('./components/Flashcards'))
const KQuiz=lazyPanel(()=>import('./components/KQuiz'))
const UpdatePlanScanner=lazyPanel(()=>import('./components/UpdatePlanScanner'))
const PeerConnections=lazyPanel(()=>import('./components/PeerConnections'))
// Only shown on the Planner page and in Decorate, so not part of the startup download.
const StudyPlanner=lazyPanel(()=>import('./components/StudyPlanner'))
const SanctuaryBuild=lazyPanel(()=>import('./components/SanctuaryBuild'))
const AskKono=lazyPanel(()=>import('./components/AskKono'))
const EntryEditor=lazyPanel(()=>import('./components/EntryEditor'))
const QuickDayAdd=lazyPanel(()=>import('./components/QuickDayAdd'))
const SharedWithMe=lazyPanel(()=>import('./components/SharedWithMe'))

type Store=ReturnType<typeof usePlannerRepository>
import {SETTINGS_TABS,cozyPalette,fixedPaletteExperiences,own,pages,type Page,type SettingsTab} from './workspaceShared'
import type * as Screens from './WorkspaceSettings'
type PropsOf<K extends keyof typeof Screens>=Parameters<(typeof Screens)[K]>[0]
/** The Kids page, the family settings and Look & feel load the first time they're shown. */
const screen=<K extends 'KidsPage'|'FamilySettings'|'FamilyReminderSettings'|'QuickFamilyAdd'|'TeamColors'|'Appearance'>(name:K)=>lazyPanel<PropsOf<K>>(()=>import('./WorkspaceSettings').then(m=>({default:m[name] as unknown as (props:PropsOf<K>)=>ReactNode})))
const KidsPage=screen('KidsPage'),FamilySettings=screen('FamilySettings'),FamilyReminderSettings=screen('FamilyReminderSettings'),QuickFamilyAdd=screen('QuickFamilyAdd'),TeamColors=screen('TeamColors'),Appearance=screen('Appearance')
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
/** "Hey Siri, add homework" (an iPhone Shortcut) and the share sheet open KONO as /?add=… or with a
 * share's title/text/url; that starts Quick add filled in, with any link kept as the assignment's link. */
const readIncoming=()=>{
 const q=new URL(location.href).searchParams,joined=[q.get('add'),q.get('title'),q.get('text')].filter(Boolean).join(' ')
 const link=(q.get('url')||joined.match(/https?:\/\/\S+/)?.[0]||'').slice(0,2000),text=joined.replace(/https?:\/\/\S+/g,' ').replace(/\s+/g,' ').trim().slice(0,300)
 return text||link?{text,link}:null
}
const pageFromURL=():Page=>pages.find(p=>p.toLowerCase()===new URL(location.href).searchParams.get('page'))??'Sanctuary'
const dateLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})
const daysUntil=(date:string,from=localDate())=>Math.round((new Date(date+'T12:00:00').getTime()-new Date(from+'T12:00:00').getTime())/86400000)
const countdown=(date:string,done=false,from=localDate())=>{if(done)return 'Completed';const days=daysUntil(date,from);return days===0?'Due today':days===1?'Due tomorrow':days>1?days+' days left':Math.abs(days)+' day'+(days===-1?'':'s')+' overdue'}
const eventKind=(entry:Entry)=>String(entry.kind??'').toLowerCase()
const entryDate=(entry:Entry)=>String(entry.due??entry.date??'')
const isAssignmentKind=(entry:Entry)=>['homework','assignment','assignments'].includes(eventKind(entry))
const isImportantEntry=(key:Collection,entry:Entry)=>key==='exams'||(key==='notes'&&['exam','project','test','quiz'].includes(eventKind(entry)))||(key==='calendarEvents'&&['exam','test','quiz','project','assignment'].includes(eventKind(entry)))

export default function WorkspaceApp(){
 const store=usePlannerRepository()
 useEffect(()=>{const {experience='cozy',theme}=store.data.settings,root=document.documentElement;root.dataset.experience=experience;root.dataset.theme=experience==='cozy'?cozyPalette(theme):fixedPaletteExperiences.includes(experience)?experience:theme
  // Team colors (team-themes.css) key off data-team: "dark" or "light" jersey.
  const jersey=teamJersey(root.dataset.theme);if(jersey)root.dataset.team=jersey;else delete root.dataset.team},[store.data.settings])
 // Dark mode (dark-mode.css): always, never, or following the phone's own setting.
 const phoneDark=usePrefersDark(),darkMode=store.data.settings.darkMode??'phone',dark=darkMode==='dark'||(darkMode==='phone'&&phoneDark)
 useEffect(()=>{const root=document.documentElement;if(dark)root.dataset.dark='true';else delete root.dataset.dark},[dark])
 if(!store.ready)return <main className="startup-card"><h1>KONO</h1><p role="status">Opening your study plan…</p><section className="kono-skel" aria-hidden="true"><i/><i/><i/><i/></section></main>
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
 const [page,setPage]=useState<Page>(pageFromURL),[more,setMore]=useState(false),[search,setSearch]=useState(false),[adding,setAdding]=useState(()=>!!readIncoming()),[incoming]=useState(readIncoming),[scanningPlan,setScanningPlan]=useState(false),[editor,setEditor]=useState<Edit|null>(null),[message,setMessage]=useState('')
 const [planRequest,setPlanRequest]=useState(0)
 const [addKind,setAddKind]=useState<'tasks'|'exams'|'notes'|'lesson'>('tasks')
 const [confirmation,setConfirmation]=useState<{text:string;action:()=>void}|null>(null)
 const [phase,setPhase]=useState<'auto'|'morning'|'afternoon'|'evening'|'night'>('auto'),[expanded,setExpanded]=useState(false)
 const [quickDayOpen,setQuickDayOpen]=useState<'today'|'tomorrow'|null>(null)
 // Home's one Today card shows today or tomorrow; KONO's corner and the setup steps open on request.
 const [dayTab,setDayTab]=useState<'today'|'tomorrow'>('today'),[cornerOpen,setCornerOpen]=useState(false),[setupOpen,setSetupOpen]=useState(false)
 const [islandMode,setIslandMode]=useState<'view'|'decorate'>('view'),[decorateStart,setDecorateStart]=useState<string|undefined>(),[nextUpOpen,setNextUpOpen]=useState(false),[askOpen,setAskOpen]=useState(false)
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
 const currentStreak=streakFrom(sanctuaryProgress.completionDates,today)
 const [startSkipRaw,setStartSkipRaw]=useLocalSetting('kono-getting-started:'+profile.id,''),[pushOn,setPushOn]=useState(false)
 // Reminders count as on once this device has a push subscription (checked when the page changes).
 useEffect(()=>{let live=true;currentPushSubscription().then(sub=>{if(live)setPushOn(!!sub)}).catch(()=>undefined);return()=>{live=false}},[page])
 const [recapHiddenFor,setRecapHiddenFor]=useLocalSetting('kono-recap-hidden:'+profile.id,''),[weekPlanOpen,setWeekPlanOpen]=useState(false),[addOpen,setAddOpen]=useState(false),[addChoice,setAddChoice]=useState<AddChoiceId|null>(null)
 const recap=page==='Sanctuary'||page==='Planner'?weekRecap(data,today,sanctuaryProgress):null
 const openWeekPlan=()=>{setWeekPlanOpen(true);navigate('Planner')}
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
 // KONO's mood about today (Sanctuary › "KONO today" and the mic button's face).
 const ownExams=data.exams.filter(e=>e.profileId===profile.id)
 const mood=konoMood({tasks,exams:ownExams,today,hour:Number(nowClock.slice(0,2))})
 // `react` is a little extra on KONO's face for a moment: a tickle wiggle, a high five, a wave.
 type CareMomentValue={line:string;pose:string;at:number;ms?:number;icon?:string;react?:'tickle'|'highfive'|'wave'|'heart'}
 // Taking care of KONO (store/konoCare): the meters, snacks from finished work, and pats. A feeding or
 // pat shows in place in the card for a moment (KONO's face and line); nothing else opens.
 const careLog=data.konoCare?.[profile.id]?.log??[],careNow=new Date()
 // First visit on this device in three or more days: KONO is back from a little trip for this visit.
 const visitKey='kono-last-visit:'+profile.id
 const [awayVisit]=useState(()=>{try{return isAwayVisit(Number(localStorage.getItem(visitKey)),new Date())}catch{return false}})
 // Back after a couple of hours (but not a trip): KONO waves hello.
 const [helloVisit]=useState(()=>{try{const last=Number(localStorage.getItem(visitKey));return last>0&&Date.now()-last>2*3_600_000&&!isAwayVisit(last,new Date())}catch{return false}})
 useEffect(()=>{try{localStorage.setItem(visitKey,String(Date.now()))}catch{/* Storage unavailable: no homecoming line. */}},[visitKey,today])
 const meters=careMeters(careLog,ownTasks,careNow,awayVisit&&!careLog.some(e=>Date.parse(e.at)>careNow.getTime()-3_600_000)),snacks=pantry(ownTasks,careLog,careNow)
 const [careMoment,setCareMoment]=useState<CareMomentValue|null>(null)
 // A fresh value makes the island's KONO play a one-off celebration (GardenCard's celebrateSignal),
 // bumped together with KONO's speech bubble so the reaction and the phrase fire at once.
 const [celebrateSignal,setCelebrateSignal]=useState<number|null>(null)
 // A meter going up shows its "+N" for a moment (and the bar gives a little pulse).
 const prevMeters=useRef(meters),[meterGain,setMeterGain]=useState<{key:string;n:number;at:number}[]>([])
 useEffect(()=>{const prev=prevMeters.current;prevMeters.current=meters;const gains=(['full','rested','happy'] as const).filter(k=>meters[k]-prev[k]>=3).map(k=>({key:k,n:Math.round(meters[k]-prev[k]),at:Date.now()}));if(gains.length)setMeterGain(gains)},[meters.full,meters.rested,meters.happy])// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!meterGain.length)return;const timer=window.setTimeout(()=>setMeterGain([]),1600);return ()=>window.clearTimeout(timer)},[meterGain])
 useEffect(()=>{if(!careMoment)return;const timer=window.setTimeout(()=>setCareMoment(null),careMoment.ms??2800);return ()=>window.clearTimeout(timer)},[careMoment])
 // KONO's own news (a wish come true, a new outfit) waits its turn: it shows once KONO's line is free,
 // so it never cuts off something the student just did.
 const [newsQueue,setNewsQueue]=useState<CareMomentValue[]>([])
 const announce=(m:CareMomentValue)=>setNewsQueue(q=>[...q,m])
 useEffect(()=>{if(careMoment||!newsQueue.length)return;const timer=window.setTimeout(()=>{setCareMoment({...newsQueue[0],at:Date.now()});setNewsQueue(q=>q.slice(1))},300);return ()=>window.clearTimeout(timer)},[careMoment,newsQueue])
 const bed=bedtime(careLog,careNow)
 const hello=()=>announce({line:HELLO_LINE,pose:'/garden/kono/excited.webp',at:Date.now(),ms:4000,react:'wave'})
 useEffect(()=>{if(!helloVisit)return;const timer=window.setTimeout(()=>setNewsQueue(q=>[{line:HELLO_LINE,pose:'/garden/kono/excited.webp',at:Date.now(),ms:4000,react:'wave'},...q]),400);return ()=>window.clearTimeout(timer)},[helloVisit])
 const hiddenAt=useRef(0)
 useEffect(()=>{
  const seen=()=>{if(document.hidden){hiddenAt.current=Date.now();return}if(hiddenAt.current&&Date.now()-hiddenAt.current>30*60_000)hello();hiddenAt.current=0}
  document.addEventListener('visibilitychange',seen)
  return ()=>document.removeEventListener('visibilitychange',seen)
 })
 // Tucked in: the island goes to night until KONO wakes (only when the island follows the live time).
 const islandPhase=bed.tucked&&phase==='auto'?'night':phase
 const logEvent=(event:CareEvent,now:Date)=>{void save(d=>({...d,konoCare:{...d.konoCare,[profile.id]:addCareEvent(d.konoCare[profile.id],profile.id,event,now)}}),{undoable:!['wish','find','visit'].includes(event.kind)})}
 const logCare=(kind:CareEvent['kind'],now:Date,taskId?:string)=>logEvent({id:uid('care'),kind,at:now.toISOString(),...(taskId?{taskId}:{})},now)
 // KONO's wardrobe and daily wish (store/konoWardrobe; Decorate › Wardrobe).
 const wardrobe=wardrobeStats(sanctuaryProgress.totalCredits,ownTasks,careLog),unlockedOutfitIds=unlockedOutfits(wardrobe)
 const worn=wornOutfit(careLog,unlockedOutfitIds)
 // KONO's notes (store/konoNotes): good luck the evening before a test, the study headband on test day,
 // "How did it go?" after it, and otherwise one gentle nudge a day. One at a time, in the KONO bar.
 const tests=testsFrom(ownExams,data.calendarEvents.filter(e=>e.profileId===profile.id&&!e.done))
 const nudges=nextUpList(tasks,today,ownExams).filter(i=>i.exam||(tasks.find(t=>t.id===i.id)?.due??'9')<=addDays(today,2))
 const note=konoNote(tests,nudges,careLog,today,careNow.getHours())
 const shownOutfit=testDay(tests,today)?'headband':worn
 const answerTest=(test:Test,mood:Mood)=>{const now=new Date();logEvent({id:examEventId(test),kind:'exam',at:now.toISOString(),item:mood},now);announce({line:moodLine(mood,test.title),pose:mood==='good'?'/garden/kono/excited.webp':'/garden/kono/happy.webp',at:now.getTime(),ms:7000});if(mood==='good')setCelebrateSignal(now.getTime())}
 const answerNudge=(start:boolean)=>{const now=new Date();logEvent({id:nudgeEventId(today),kind:'nudge',at:now.toISOString(),item:start?'start':'later'},now)}
 // Each change of outfit is saved as later than the one before (even within the same millisecond),
 // so the latest pick always wins.
 const wearOutfit=(id:OutfitId|null)=>{const now=new Date(),last=Math.max(-Infinity,...careLog.filter(e=>e.kind==='wear').map(e=>Date.parse(e.at)).filter(Number.isFinite));const at=new Date(Math.max(now.getTime(),last+1));logEvent({id:uid('care'),kind:'wear',at:at.toISOString(),item:id??''},now)}
 // A focus session ran all the way down: KONO, who read beside you, shares something it found
 // (store/konoFinds). Placed like a sticker from Decorate › Finds.
 const found=foundCounts(careLog)
 const focusDone=(minutes:number)=>{
  const now=new Date(),find=findFor(minutes,rollFrom(now.getTime()),found,today)
  if(!find){announce({line:'Nice focus! KONO kept you company the whole time. 📖',pose:'/garden/kono/happy.webp',at:now.getTime(),ms:5000});return}
  logEvent({id:uid('care'),kind:'find',at:now.toISOString(),item:find.id},now)
  announce({line:foundLine(find,minutes),pose:'/garden/kono/excited.webp',at:now.getTime(),ms:9000,icon:findSrc(find.id)});setCelebrateSignal(now.getTime())
 }
 const wish=todaysWish(ownTasks,ownExams,today),wishDone=wishProgress(wish,ownTasks,careLog,today),wishGranted=wishGrantedOn(careLog,today)
 const tuckIn=()=>{
  const now=new Date(),early=now.getHours()<6,line='Goodnight! 🌙 '+(early?'Later today: ':'Tomorrow: ')+dayGlance(data,early?today:tomorrow)
  logCare('sleep',now);setCareMoment({line,pose:'/garden/kono/sleep.webp',at:now.getTime(),ms:9000})
 }
 const wakeUp=()=>{
  const now=new Date(),line='Good morning! ☀️ Today: '+dayGlance(data,today)
  logCare('wake',now);setCareMoment({line,pose:'/garden/kono/excited.webp',at:now.getTime(),ms:12000});setCelebrateSignal(now.getTime())
 }
 // KONO's favorite snack this week (store/konoCare): eaten first when it's in the pantry, extra happy.
 const favorite=favoriteSnack(today),nextSnack=snacks.find(s=>s.treat.id===favorite.id)??snacks[0]
 // Feeds the next snack, or one picked from the snack tray in KONO's corner. A kind of snack KONO has
 // never had goes in its snack book (store/konoCare › tasted), and KONO says so after the meal.
 const tried=tasted(careLog)
 const feedKono=(taskId?:string)=>{
  const next=(taskId?snacks.find(s=>s.taskId===taskId):undefined)??nextSnack;if(!next)return
  const now=new Date(),fav=next.treat.id===favorite.id,isNew=!tried.has(next.treat.id)
  void save(d=>{
   let care=addCareEvent(d.konoCare[profile.id],profile.id,{id:uid('care'),kind:'feed',at:now.toISOString(),taskId:next.taskId,item:next.treat.id},now)
   if(isNew)care=addCareEvent(care,profile.id,{id:tasteEventId(next.treat.id),kind:'taste',at:now.toISOString(),item:next.treat.id},now)
   return {...d,konoCare:{...d.konoCare,[profile.id]:care}}
  })
  setCareMoment({line:fedLine(next.treat,fav),pose:'/garden/kono/excited.webp',at:now.getTime(),ms:fav?5000:2800,react:fav?'tickle':undefined});setFeedSignal({at:now.getTime(),icon:next.treat.emoji})
  if(isNew)announce({line:tasteLine(next.treat,tried.size+1),pose:'/garden/kono/happy.webp',at:now.getTime(),ms:5000})
 }
 // Play time from KONO's corner (once an hour counts): happier, and a little hungrier.
 const playKono=()=>{
  const now=new Date()
  logEvent({id:uid('care'),kind:'play',at:now.toISOString()},now)
  setCareMoment({line:PLAY_LINES[now.getSeconds()%PLAY_LINES.length],pose:'/garden/kono/excited.webp',at:now.getTime(),ms:4000});setCelebrateSignal(now.getTime())
 }
 // The island's KONO eats it too (GardenCard's feedSignal): the snack drops in and gets eaten.
 const [feedSignal,setFeedSignal]=useState<{at:number;icon:string}|null>(null)
 const tapTimes=useRef<number[]>([]),highFived=useRef(new Set<string>())
 const petKono=(tapAt=0,onIsland=false)=>{
  const now=new Date()
  if(!bed.tucked&&tapAt>0&&!onIsland){const face=document.querySelector('.kono-corner-face > :first-child')??document.querySelector('.kono-mood-face > :first-child');hop(face);floatHearts(face)}
  if(bed.tucked){setCareMoment({line:'Shh… KONO is sleeping. 💤',pose:'/garden/kono/sleep.webp',at:now.getTime()});return}
  // Every tap gets a reaction; a pat is saved at most every ten minutes (see addCareEvent).
  const pat={id:uid('care'),kind:'pet' as const,at:now.toISOString()}
  if(addCareEvent(data.konoCare?.[profile.id],profile.id,pat,now).log.some(e=>e.id===pat.id))void save(d=>({...d,konoCare:{...d.konoCare,[profile.id]:addCareEvent(d.konoCare[profile.id],profile.id,pat,now)}}))
  // Three quick taps tickle; a tap just after finishing something is a high five (once per thing).
  // (tapAt is the tap's own time, on the bar's face or on the island.)
  if(tapAt>0)tapTimes.current=[...tapTimes.current.filter(t=>tapAt-t<1500),tapAt]
  if(tapAt>0&&tapTimes.current.length>=3){tapTimes.current=[];setCareMoment({line:TICKLE_LINES[now.getSeconds()%TICKLE_LINES.length],pose:'/garden/kono/excited.webp',at:now.getTime(),react:'tickle'});return}
  const justDone=ownTasks.filter(t=>t.done&&t.completedAt&&now.getTime()-Date.parse(t.completedAt)<HIGH_FIVE_MS&&!highFived.current.has(t.id)).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))[0]
  if(justDone){highFived.current.add(justDone.id);setCareMoment({line:highFiveLine(justDone.title),pose:'/garden/kono/excited.webp',at:now.getTime(),ms:3500,react:'highfive'});setCelebrateSignal(now.getTime());return}
  // Close friends (2+ bond hearts, store/konoBond): a pat sends up a little heart.
  if(bond.level>=HEART_PATS_AT){setCareMoment({line:PAT_HEART_LINES[now.getSeconds()%PAT_HEART_LINES.length],pose:'/garden/kono/happy.webp',at:now.getTime(),react:'heart'});return}
  setCareMoment({line:PET_LINES[now.getSeconds()%PET_LINES.length],pose:'/garden/kono/happy.webp',at:now.getTime()})
 }
 // What KONO would like, in a thought bubble on the island: its next snack when it's hungry (a tap on
 // KONO there feeds it), or a heart when it'd like a pat (not again for ten minutes after one).
 const lastPat=Math.max(0,...careLog.filter(e=>e.kind==='pet').map(e=>Date.parse(e.at)).filter(Number.isFinite))
 const konoNeed=bed.tucked||meters.away?null:meters.full<40&&nextSnack?nextSnack.treat.emoji:meters.happy<45&&careNow.getTime()-lastPat>PET_EVERY_MS?'💗':null
 const islandPat=(tapAt:number)=>{if(!bed.tucked&&meters.full<40&&nextSnack){feedKono();return}petKono(tapAt,true)}
 const konoPose=careMoment?.pose??(bed.tucked?'/garden/kono/sleep.webp':meters.away?'/garden/kono/happy.webp':mood.pose),konoLine=careMoment?.line??(bed.tucked?ASLEEP_LINE:meters.away?AWAY_LINE:mood.line)
 // The one care action that fits right now (in the bar and in KONO's corner).
 const careAction=bed.tucked?null:bed.canWake?<button type="button" className="kono-feed kono-wake" onClick={wakeUp}><span aria-hidden="true">☀️</span> Wake up</button>
       :bed.canTuck&&(!snacks.length||meters.full>=70)?<button type="button" className="kono-feed kono-tuck" onClick={tuckIn}><span aria-hidden="true">🌙</span> Tuck in</button>
       :nextSnack?<button type="button" className={'kono-feed'+(nextSnack.treat.id===favorite.id?' is-favorite':'')} title={nextSnack.treat.id===favorite.id?'A '+favorite.name+': KONO’s favorite this week!':'KONO’s favorite this week: '+favorite.emoji+' '+favorite.name} onClick={()=>feedKono()}><span aria-hidden="true">{nextSnack.treat.emoji}</span> Feed KONO{nextSnack.treat.id===favorite.id&&<span className="kono-fav" aria-label="(its favorite)"> ♥</span>}{snacks.length>1&&<small> · {snacks.length}</small>}</button>
       :null
 // Stickers earned from the plan's history (Decorate › Stickers).
 const earned=earnedStickers({tasks:ownTasks,exams:ownExams,studySessions:data.calendarEvents.filter(e=>e.profileId===profile.id&&e.kind==='study'&&e.subjectId).map(e=>({subjectId:e.subjectId??'',date:e.date})),completionDates:sanctuaryProgress.completionDates,today})
 const earnedKey=STICKERS.filter(t=>earned.has(t.id)).map(t=>t.id).join(',')
 // Decorate › Stickers and Finds: both are placed once earned (finds as "find-" asset IDs).
 const metFriends=friendsMet(careLog),visitor=visitorToday(ownTasks,careLog,today),stamps=stampCard(sanctuaryProgress.completionDates,today),bond=bondLevel(bondPoints(sanctuaryProgress.totalCredits,careLog))
 const decorEarned=new Set([...earned,...[...found.keys()].map(id=>'find-'+id),...[...metFriends.keys()].map(id=>'friend-'+id),...stamps.presents.map(p=>'present-'+p.id),...giftsAt(bond.level).map(g=>'gift-'+g.id)])
 // School days off and early releases in the next week (store/schoolHeadsUp); "Got it" hides each one on this device.
 const [schoolSeen,setSchoolSeen]=useLocalSetting('kono-school-heads-up:'+profile.id,'')
 const schoolAhead=schoolChanges(data,profile.id,addDays(today,1),addDays(today,7)).filter(c=>!schoolSeen.split('|').includes(c.key))
 const offeredStickers=STICKERS.filter(t=>stickerOffered(t.id,earned,today)).length,islandEvent=seasonOn(today)
 // The app icon's number: due today plus late (Settings › Notifications can turn it off on this device).
 const [appBadge]=useLocalSetting(APP_BADGE_SETTING,'on')
 const badgeCount=appBadge==='on'?tasks.filter(t=>!t.done&&t.due<=today).length+ownExams.filter(e=>!e.done&&e.due===today).length:0
 useEffect(()=>{showAppBadge(badgeCount)},[badgeCount])
 useEffect(()=>{rememberBadgeChoice(appBadge==='on')},[appBadge])
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
 usePushReminders(data,repository.replacePushQueue,!!store.user&&!store.support)
 // Classmate sharing (Friends in Settings) needs an account; never while KONO support is helping someone.
 const classmatesOn=!!store.user&&!store.support
 useEffect(()=>{if(!incoming)return;const u=new URL(location.href);for(const k of ['add','title','text','url'])u.searchParams.delete(k);history.replaceState(null,'',u.toString())},[incoming])
 // Photos on assignments go to the account's private folder when signed in; ones taken offline catch up.
 const photoCloud=useMemo(()=>repository.photoCloud(),[repository]) // Workspace remounts when the account changes
 useEffect(()=>{if(!photoCloud)return;const sync=()=>void uploadPendingPhotos(photoCloud);sync();window.addEventListener('online',sync);return()=>window.removeEventListener('online',sync)},[photoCloud])
 useLinkedCalendars(profile.id,data,save,!store.support)
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
 const navigate=(next:Page)=>{const url=new URL(location.href);url.searchParams.set('page',next.toLowerCase());history.pushState(null,'',url);setPage(next);setMore(false);if(next!=='Planner')setAddOpen(false);window.scrollTo({top:0})}
 const startFocusSession=(taskId:string,estimatedMinutes?:number,label?:string)=>{
  navigate('Sanctuary')
  setFocusRequest({taskId,estimatedMinutes,requestId:Date.now(),label})
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
 // Each page's cards ease in one after another when it opens (no remount, so nothing loses its state).
 const pageScope=useRef<HTMLDivElement>(null)
 useEffect(()=>{stagger(pageScope.current)},[page])
 useEffect(trackPointer,[])
 useEffect(()=>{const t=window.setTimeout(()=>void effects().catch(()=>undefined),1500);return()=>window.clearTimeout(t)},[])
 // The app's light follows the island's time of day (a soft tint behind the pages; motion-polish.css).
 useEffect(()=>{const hour=new Date().getHours(),part=islandPhase!=='auto'?islandPhase:hour<11?'morning':hour<17?'afternoon':hour<20?'evening':'night';document.documentElement.dataset.daypart=part},[islandPhase,today])
 // KONO hops when something new lands in the plan.
 const taskCount=useRef(ownTasks.length)
 useEffect(()=>{if(ownTasks.length>taskCount.current)hop(document.querySelector('.kono-mood-face > :first-child'));taskCount.current=ownTasks.length},[ownTasks.length])
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearch(v=>!v)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[])
 // undo: a one-tap action (done, swipe, quick add, overdue) confirms in a bar at the bottom with Undo.
 const run=async(action:()=>Promise<boolean>,success:string,undo=false)=>{try{const ok=await action();if(ok&&undo){setMessage('');setUndoToast(t=>({text:success,at:(t?.at??0)+1}))}else setMessage(ok?success:'Not saved yet. Check the save status; your working copy is preserved.')}catch(e){setMessage(e instanceof Error?e.message:'Could not finish. Your work is preserved.')}}
 const [undoToast,setUndoToast]=useState<{text:string;at:number}|null>(null)
 useEffect(()=>{if(!undoToast)return;const t=window.setTimeout(()=>setUndoToast(null),7000);return()=>window.clearTimeout(t)},[undoToast])
 // Past their due date and not done (study-plan units move forward on their own, so never show here).
 const onPhone=usePhoneWidth()
 // Weekend mode: on Saturday and Sunday the Sanctuary leads with Monday's work and the week's tests.
 const dow=new Date(localDate()+'T12:00:00').getDay(),weekend=dow===0||dow===6,monday=addDays(localDate(),dow===6?2:1)
 const mondayWork=weekend?tasks.filter(t=>!t.done&&t.due===monday):[]
 const weekTests=weekend?data.exams.filter(e=>e.profileId===profile.id&&!e.done&&e.due>=monday&&e.due<=addDays(monday,4)).sort((a,b)=>a.due.localeCompare(b.due)):[]
 const [overdueHiddenOn,setOverdueHiddenOn]=useLocalSetting('kono-overdue-hidden:'+profile.id,'')
 const overdue=overdueHiddenOn===localDate()?[]:tasks.filter(t=>!t.done&&t.due<localDate()).sort((a,b)=>a.due.localeCompare(b.due))
 const moveToToday=(ids:string[])=>void run(()=>save(d=>({...d,tasks:d.tasks.map(t=>ids.includes(t.id)&&t.profileId===profile.id?{...t,due:localDate(),plannedTime:undefined}:t)})),ids.length===1?'Moved to today.':ids.length+' assignments moved to today.',true)
 // "＋ Add" › Type it: saves the assignment or exam exactly as the preview showed it.
 const quickAdd=(g:QuickAddGuess&{link?:string})=>{setAdding(false);const id=uid(g.key);void run(()=>save(d=>g.key==='tasks'?{...d,tasks:[...d.tasks,{id,profileId:profile.id,subjectId:g.subjectId,title:g.title,due:g.due,done:false,notes:'',...(g.time?{plannedTime:g.time}:{}),...(g.link?{link:g.link}:{})}]}:{...d,exams:[...d.exams,{id,profileId:profile.id,subjectId:g.subjectId,title:g.title,due:g.due,done:false,notes:'',...(g.link?{link:g.link}:{})}]}),'Added “'+g.title+'” for '+dateLabel(g.due)+'.',true)}
 const overdueCard=<OverdueCard tasks={overdue} subjectName={id=>data.subjects.find(s=>s.id===id)?.name??''} onDone={id=>void run(async()=>{const saved=await save(d=>completeTask(d,id));if(saved)celebrateDone();return saved},'Assignment completed.',true)} onMove={moveToToday} onLater={()=>setOverdueHiddenOn(localDate())}/>
 const openEditor=(edit:Edit)=>{if(hasDraft&&!editor){try{const old=JSON.parse(localStorage.getItem(draftScope)??'null') as Edit;if(old?.entry?.id===edit.entry.id){if(old.original&&edit.original&&!equal(old.original,edit.original)&&equal(old.entry,old.original)){localStorage.removeItem(draftScope);setHasDraft(false);setEditor(edit);return}setEditor(old);return}}catch{/* Offer a clear replacement choice. */}setConfirmation({text:'You have an unfinished edit. Discard it and open this item? Cancel keeps your draft; use Resume draft to finish it.',action:()=>{localStorage.removeItem(draftScope);localStorage.removeItem(draftScope+':assignment-dates');setHasDraft(false);setEditor(edit)}});return}setEditor(edit)}
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
 // Sanctuary › Today's / Tomorrow's schedule › "＋ Add": saved straight away for that day.
 const quickDay=(date:string,item:QuickDayItem)=>{
  const id=uid(item.key==='calendarEvents'?'event':item.key),base={id,profileId:profile.id,subjectId:item.subjectId,title:item.title,notes:'',done:false}
  const end=item.time?String(Math.min(23,Number(item.time.slice(0,2))+1)).padStart(2,'0')+item.time.slice(2):undefined
  void run(()=>save(d=>item.key==='tasks'?{...d,tasks:[...d.tasks,{...base,due:date,...(item.time?{plannedTime:item.time}:{})}]}
   :item.key==='exams'?{...d,exams:[...d.exams,{...base,due:date}]}
   :{...d,calendarEvents:[...d.calendarEvents,{...base,date,kind:item.eventKind??'personal',...(item.time?{time:item.time,endTime:end}:{})}]}),'Added “'+item.title+'” for '+dateLabel(date)+'.',true)
 }
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
 // KONO's speech bubble: a new sticker or a celebration (the day's greeting is KONO's line in its bar).
 const [konoPhrase,setKonoPhrase]=useState<KonoPhrase|null>(null)
 useEffect(()=>{if(!konoPhrase)return;const timer=setTimeout(()=>setKonoPhrase(null),8000);return()=>clearTimeout(timer)},[konoPhrase])
 // A sticker earned since this device last looked gets KONO's speech bubble. The first look on a device
 // only notes what's already earned, so an older account isn't greeted with a pile of them at once.
 useEffect(()=>{
  const key='kono-stickers-seen:'+profile.id
  let seen:string|null=null
  try{seen=localStorage.getItem(key)}catch{/* Private mode: no announcements. */}
  const now=earnedKey?earnedKey.split(','):[],before=seen===null?null:seen.split(',')
  try{localStorage.setItem(key,[...new Set([...(before??[]),...now])].join(','))}catch{/* Best effort. */}
  const fresh=before?STICKERS.filter(t=>now.includes(t.id)&&!before.includes(t.id)):[]
  if(!fresh.length)return
  const timer=setTimeout(()=>setKonoPhrase({kind:'sticker',text:'New sticker'+(fresh.length>1?'s':'')+': '+fresh.map(t=>t.emoji+' '+t.label).join(', ')+'! Put '+(fresh.length>1?'them':'it')+' on your island in Decorate › Stickers.'}),600)
  return()=>clearTimeout(timer)
 },[earnedKey,profile.id])
 // KONO's chatter (Settings › Look & feel): soft blips whenever KONO answers something you did.
 const [babbleOn]=useLocalSetting(BABBLE_SETTING,'off')
 // The welcome tour: once per plan on this device, and only while the plan is brand new (nothing ever
 // finished, at most the demo's one assignment, no tests or classes yet), so people already using KONO
 // never see it.
 const [tourDone,setTourDone]=useLocalSetting('kono-tour-done:'+profile.id,'')
 const showTour=!tourDone&&!Object.keys(sanctuaryProgress.completionDates).length&&ownTasks.length<=1&&!ownExams.length&&!subjects.length
 // Every page but Home gets a one-line summary under its name in the header.
 const plural=(n:number,one:string,many=one+'s')=>n+' '+(n===1?one:many)
 const weekEnd=addDays(today,6),dueThisWeek=tasks.filter(t=>!t.done&&t.due>=today&&t.due<=weekEnd).length,lateCount=tasks.filter(t=>!t.done&&t.due<today).length
 const openExams=ownExams.filter(e=>!e.done&&e.due>=today).sort((a,b)=>a.due.localeCompare(b.due)),daysTo=(d:string)=>Math.round((Date.parse(d+'T12:00:00')-Date.parse(today+'T12:00:00'))/86400000)
 const pageSummary:Partial<Record<Page,string>>={
  Planner:[dueThisWeek?plural(dueThisWeek,'thing')+' due this week':'Nothing due this week',lateCount?lateCount+' late':''].filter(Boolean).join(' · '),
  Subjects:subjects.length?plural(subjects.length,'class','classes'):'Add your classes to keep each one’s work together',
  Notes:notes.length?plural(notes.length,'note')+(notes.some(n=>n.pinned)?' · '+notes.filter(n=>n.pinned).length+' pinned':''):'Ideas, study notes and reminders',
  Exams:openExams.length?(openExams[0].title+' '+(daysTo(openExams[0].due)===0?'is today':daysTo(openExams[0].due)===1?'is tomorrow':'in '+daysTo(openExams[0].due)+' days')+(openExams.length>1?' · '+(openExams.length-1)+' more coming up':'')):'No tests coming up',
  'K-Quiz':'Turn lectures and notes into practice questions',
  Settings:'How KONO looks, sounds and reminds you',
 }
 const chatterLine=careMoment?.line??konoPhrase?.text
 useEffect(()=>{if(babbleOn==='on'&&chatterLine)void import('./konoBabble').then(m=>m.babble(chatterLine)).catch(()=>undefined)},[careMoment?.at,konoPhrase]) // eslint-disable-line react-hooks/exhaustive-deps -- once per new line
 useEffect(()=>{
  if(wishGranted||wishDone<wish.goal)return
  // Saved and announced together (saving changes the plan, which would cancel a separate timer).
  const timer=setTimeout(()=>{const now=new Date();logEvent(wishEvent(today),now);announce({line:'✨ KONO’s wish came true! Thank you!',pose:'/garden/kono/excited.webp',at:now.getTime(),ms:5000});setCelebrateSignal(now.getTime())},400)
  return ()=>clearTimeout(timer)
 // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when today's wish is first met
 },[wishGranted,wishDone>=wish.goal,today])
 // After a good week a friend comes to visit: saved once for the day (so it's met, and every device
 // shows the same friend) and announced when it arrives.
 const visitSaved=careLog.some(e=>e.id===visitEventId(today))
 useEffect(()=>{
  if(!visitor||visitSaved)return
  const timer=setTimeout(()=>{const now=new Date();logEvent(visitEvent(today,visitor),now);announce({line:visitLine(visitor,!metFriends.has(visitor.id)),pose:'/garden/kono/excited.webp',at:now.getTime(),ms:8000,icon:friendSrc(visitor.id)})},600)
  return ()=>clearTimeout(timer)
 // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when today's visitor first arrives
 },[visitor?.id,visitSaved,today])
 // A new bond heart is announced once on this device (the first look only notes the hearts already there).
 const heartsSeenKey='kono-hearts-seen:'+profile.id
 useEffect(()=>{
  let seen:number|null=null;try{const v=localStorage.getItem(heartsSeenKey);seen=v===null?null:Number(v)}catch{/* storage unavailable */}
  const remember=()=>{try{localStorage.setItem(heartsSeenKey,String(bond.level))}catch{/* storage unavailable */}}
  if(seen===null||!Number.isFinite(seen)||bond.level<=seen){remember();return}
  const timer=setTimeout(()=>{remember();const gift=GIFTS.find(g=>g.level===bond.level);announce({line:bondLine(bond),pose:'/garden/kono/excited.webp',at:Date.now(),ms:8000,...(gift?{icon:giftSrc(gift.id)}:{})})},800)
  return ()=>clearTimeout(timer)
 // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when another heart fills
 },[heartsSeenKey,bond.level])
 // A full stamp card is announced once on this device (the first look only notes the cards already filled).
 const cardsSeenKey='kono-cards-seen:'+profile.id,cardsFilled=Math.floor(stamps.days.length/CARD_SIZE)
 useEffect(()=>{
  let seen:number|null=null;try{const v=localStorage.getItem(cardsSeenKey);seen=v===null?null:Number(v)}catch{/* storage unavailable */}
  const remember=()=>{try{localStorage.setItem(cardsSeenKey,String(cardsFilled))}catch{/* storage unavailable */}}
  if(seen===null||!Number.isFinite(seen)||cardsFilled<=seen){remember();return}
  const timer=setTimeout(()=>{remember();const present=stamps.presents[cardsFilled-1];announce({line:presentLine(present),pose:'/garden/kono/excited.webp',at:Date.now(),ms:8000,...(present?{icon:presentSrc(present.id)}:{})})},700)
  return ()=>clearTimeout(timer)
 // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when another card fills
 },[cardsSeenKey,cardsFilled])
 // New outfits are announced once on this device (the first look only notes what's already earned).
 const outfitsSeenKey='kono-outfits-seen:'+profile.id,unlockedKey=OUTFITS.filter(o=>unlockedOutfitIds.has(o.id)).map(o=>o.id).join(',')
 useEffect(()=>{
  let seen:string|null=null;try{seen=localStorage.getItem(outfitsSeenKey)}catch{/* storage unavailable */}
  const remember=()=>{try{localStorage.setItem(outfitsSeenKey,unlockedKey)}catch{/* storage unavailable */}}
  const fresh=seen===null?undefined:OUTFITS.find(o=>unlockedKey.split(',').includes(o.id)&&!seen.split(',').includes(o.id))
  if(!fresh){remember();return}
  const timer=setTimeout(()=>{remember();setNewsQueue(q=>[...q,{line:'🎁 New outfit for KONO: '+fresh.name+'! Try it on in Decorate › Wardrobe.',pose:'/garden/kono/excited.webp',at:Date.now(),ms:7000}])},600)
  return ()=>clearTimeout(timer)
 },[outfitsSeenKey,unlockedKey])
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
 // Planner › Week: an item dropped on an hour (see store/weekDrop for what that means for each kind).
 const planAt=(key:Collection,entry:Entry,day:string,time:string)=>{
  const plan=weekDrop(key,entry,day,time,profile.id)
  if(plan.kind==='none'){setMessage(plan.why);return}
  if(plan.kind==='move-due'&&!window.confirm(plan.question))return
  if(plan.kind==='session'){const event=plan.event;void run(()=>save(d=>({...d,calendarEvents:[...d.calendarEvents,event]})),'Added '+event.title+' at '+classTime(time)+'.');return}
  void patch(key,entry,plan.changes as Partial<Entry>)
 }
 // Planner › Week: an item's bottom edge dragged to a new end. An event gets that end time; an
 // assignment's planned time gets that length (how long the work should take).
 const stretchTo=(key:Collection,entry:Entry,end:string)=>{
  const mins=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
  if(key==='calendarEvents')void patch(key,entry,{endTime:end})
  else if(key==='tasks'&&typeof entry.plannedTime==='string')void patch(key,entry,{estimatedMinutes:Math.max(15,mins(end)-mins(entry.plannedTime))})
 }
 const toggle=(key:Collection,entry:Entry)=>{if(key==='tasks'){void run(async()=>{const saved=await save(d=>completeTask(d,entry.id));if(saved&&!entry.done){celebrateDone();if(data.settings.sound){navigator.vibrate?.(18);const audio=new Audio('/audio/completion.wav');audio.volume=.4;void audio.play().catch(()=>undefined)}if(entry.due===today&&!ownTasks.some(t=>t.id!==entry.id&&!t.done&&t.due===today)){
   // completeTask credits completionDates[today] on a profile's very first completion of the day
   // (any task, not just ones due today) -- so "today had no credit yet" is exactly "this
   // completion is about to extend the streak," computed here instead of watched reactively so it
   // can't race the "today's list is cleared" celebration below for the same click.
   const extendsStreak=(sanctuaryProgress.completionDates[today]??0)===0
   const resultingStreak=extendsStreak?currentStreak+1:currentStreak
   if(extendsStreak&&STREAK_MILESTONES.includes(resultingStreak))void import('./confetti').then(m=>m.confetti()).catch(()=>undefined)
   setKonoPhrase(extendsStreak&&STREAK_MILESTONES.includes(resultingStreak)?konoStreakMilestone(resultingStreak):konoCelebration())
   setCelebrateSignal(Date.now())
  }}return saved},entry.done?'Assignment reopened.':'Done: '+titleOf(entry),!entry.done);return}const field=key==='notes'?'completed':'done';void patch(key,entry,{[field]:!entry[field]})}
 const remove=(key:Collection,entry:Entry)=>setConfirmation({text:'Move “'+titleOf(entry)+'” to Trash?'+(key==='subjects'?' Its assignments and notes remain available.':entry.studyPlanId?' Restoring this unit returns an independent assignment.':''),action:()=>void run(()=>save(d=>removeEntry(d,key,entry.id)),'Moved to Trash. You can restore it later.')})
 const inSeriesOf=(key:Collection,entry:Entry)=>entry.recurringId&&(key==='tasks'||key==='calendarEvents')?(records(data,key) as Entry[]).filter(r=>r.profileId===entry.profileId&&r.recurringId===entry.recurringId):[]
 const removeSeries=(key:Collection,entry:Entry)=>{const recurringId=String(entry.recurringId??''),count=inSeriesOf(key,entry).length;if(!recurringId)return;setConfirmation({text:'Move all '+count+' dates in this series to Trash? Each is trashed independently, so you can restore just one later if you change your mind.',action:()=>void run(()=>save(d=>({...d,[key]:(records(d,key) as Entry[]).filter(r=>!(r.profileId===entry.profileId&&r.recurringId===recurringId))})),'Series moved to Trash.')})}
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
 const seriesCount=(key:Collection,entry:Entry)=>inSeriesOf(key,entry).length
 // Parent mode gates both independently-toggleable tile features entirely -- a solo student who has
 // never turned parent mode on gets the plain, pre-family tile design no matter what these settings
 // happen to hold, so nothing "kid"-shaped ever surfaces on a personal calendar.
 const showKidBorder=parentMode&&data.settings.familyTileBorders!==false
 const showKidHeader=parentMode&&data.settings.familyTileAvatars!==false
 // Phones: an open assignment can be swiped right to finish it, or left to move it to tomorrow (not
 // study-plan units, which reschedule themselves).
 const card=(key:Collection,entry:Entry,compact=false)=>{
  const record=<RecordCard cozy={experience==='cozy'} compact={compact} collection={key} entry={entry} subjectColor={subjects.find(s=>s.id===entry.subjectId)?.color} subject={subjects.find(s=>s.id===entry.subjectId)?.name} kid={data.kids.find(k=>k.id===entry.kidId)} showKidBorder={showKidBorder} showKidHeader={showKidHeader} seriesCount={seriesCount(key,entry)} edit={()=>edit(key,entry)} remove={()=>remove(key,entry)} removeSeries={()=>removeSeries(key,entry)} duplicate={()=>duplicate(key,entry)} toggle={()=>toggle(key,entry)} pin={()=>void patch(key,entry,{pinned:!entry.pinned})} remind={()=>openEditor({key:'calendarEvents',entry:{id:uid('event'),profileId:profile.id,subjectId:String(entry.subjectId??''),title:'Reminder: '+titleOf(entry),date:today,kind:'personal',notes:'From note: '+titleOf(entry),done:false}})} scheduleReview={key==='exams'?()=>scheduleExamReview(entry):undefined} confirmReview={['tasks','exams','calendarEvents'].includes(key)?()=>void patch(key,entry,{needsReview:false}):undefined} startFocus={key==='tasks'&&!entry.done&&entry.plannedTime?()=>startFocusSession(entry.id,entry.estimatedMinutes as number|undefined):undefined}/>
  if(!onPhone||key!=='tasks'||entry.done||compact)return <Fragment key={entry.id}>{record}</Fragment>
  return <SwipeRow key={entry.id} onRight={()=>toggle(key,entry)} onLeft={entry.studyPlanId?undefined:()=>void run(()=>save(d=>({...d,tasks:d.tasks.map(t=>t.id===entry.id?{...t,due:addDays(localDate(),1),plannedTime:undefined}:t)})),'Moved “'+titleOf(entry)+'” to tomorrow.',true)}>{record}</SwipeRow>
 }
 const reorder=(from:string,to:string)=>{const sorted=[...notes].sort((a,b)=>(a.position??0)-(b.position??0)),moving=sorted.find(n=>n.id===from);if(!moving||from===to)return;const order=sorted.filter(n=>n.id!==from);order.splice(order.findIndex(n=>n.id===to),0,moving);void run(()=>save(d=>({...d,notes:d.notes.map(n=>n.profileId===profile.id?{...n,position:order.findIndex(x=>x.id===n.id)}:n)})),'Board order saved.')}
 const move=(id:string,by:number)=>{const sorted=[...notes].sort((a,b)=>(a.position??0)-(b.position??0)),index=sorted.findIndex(n=>n.id===id),target=index+by;if(!sorted[target])return;[sorted[index],sorted[target]]=[sorted[target],sorted[index]];void run(()=>save(d=>({...d,notes:d.notes.map(n=>n.profileId===profile.id?{...n,position:sorted.findIndex(x=>x.id===n.id)}:n)})),'Board order saved.')}
 const noteBoard=(pinnedOnly=false)=><section className={'wb-panel wb-board board-'+(data.settings.boardStyle??'paper')}>
  <div className="wb-section-head wb-board-heading"><h2>{pinnedOnly?'Your bulletin board':'Your notes'}</h2><button onClick={()=>create('notes')}>＋ New note</button></div>
  <div className="wb-toolbar"><label>Subject<select value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>View<select value={boardView} onChange={e=>setBoardView(e.target.value)}><option value="board">Board</option><option value="list">List</option></select></label></div>
  <div className={'wb-note-grid wb-board-canvas '+(boardView==='list'?'is-list':'')}>{notes.filter(n=>(!pinnedOnly||n.pinned)&&(!subject||n.subjectId===subject)).sort((a,b)=>(a.position??0)-(b.position??0)).map(n=><div className={'wb-note-wrap size-'+(n.size??'medium')} key={n.id} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',n.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();reorder(e.dataTransfer.getData('text/plain'),n.id)}}>{card('notes',n as unknown as Entry)}<div className="wb-move"><button aria-label={'Move '+n.title+' earlier'} onClick={()=>move(n.id,-1)}>Move earlier</button><button aria-label={'Move '+n.title+' later'} onClick={()=>move(n.id,1)}>Move later</button></div></div>)}</div>
  {!notes.some(n=>(!pinnedOnly||n.pinned)&&(!subject||n.subjectId===subject))&&<p className="wb-board-empty"><img className="kono-empty-art" src="/garden/kono/read.webp" alt="" aria-hidden="true"/>Your board is ready for your notes.<br/>Pin reminders, ideas and study notes here.</p>}
 <div className="wb-board-tray" aria-hidden="true"><span>✿</span><span>✦</span><span>✿</span></div>
 </section>

 const selectedSubject=subjects.find(s=>s.id===subject)??(subject==='__unassigned__'?undefined:subjects[0])
 const selectedSubjectId=selectedSubject?.id??''
 const subjectTasks=tasks.filter(t=>selectedSubject? t.subjectId===selectedSubject.id : !subjects.some(s=>s.id===t.subjectId))
 const subjectClasses=Array.from({length:28},(_,i)=>addDays(today,i)).flatMap(date=>classOccurrences(data,date)).filter(c=>selectedSubject&&c.block.subjectId===selectedSubject.id)
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
 // Planner › ＋ Add to my calendar: the one place to add schedules and calendars (see AddToCalendar).
 const openAdd=(choice:AddChoiceId|null=null)=>{setAddChoice(choice);setAddOpen(true);navigate('Planner')}
 // Sanctuary › Getting started: each step is done when the plan shows it, or skipped (remembered per device).
 const startSkipped=new Set(startSkipRaw.split(',').filter(Boolean)),skipStart=(id:string)=>setStartSkipRaw([...startSkipped,id].join(','))
 const startSteps:StartStep[]=[
  {id:'school',title:'Add your school or classes',note:'Pick your school and upload your schedule, so every class is on your calendar.',done:startSkipped.has('school')||data.studySeasons.some(s=>s.profileId===profile.id),action:'Add my school',onAction:()=>openAdd('school')},
  {id:'link',title:'Link Canvas or your Google calendar',note:'Assignments and events come in by themselves and stay up to date.',done:startSkipped.has('link')||readLinked(profile.id).length>0||[...data.tasks,...data.exams,...data.calendarEvents].some(e=>e.profileId===profile.id&&!!e.source),action:'Link a calendar',onAction:()=>openAdd('link')},
  {id:'remind',title:'Turn on reminders',note:'What’s due each morning, and a heads-up before each class.',done:startSkipped.has('remind')||pushOn||data.settings.browserNotifications===true,action:'Turn on reminders',onAction:()=>openSettings('Notifications')},
 ]
 const closeAdd=()=>{setAddOpen(false);setAddChoice(null)}
 const setupProps={data,save,fetchCatalog:repository.fetchSchoolCatalog,submitCatalogEntry:repository.submitSchoolCatalogEntry}
 const addChoices:AddChoice[]=[
  {id:'school',icon:'🏫',title:'My school schedule',note:'Middle or high school: pick your school, then upload your class schedule.',render:()=><ScheduleSetup {...setupProps} draftKey={draftScope} only="school" onSaved={closeAdd}/>},
  {id:'college',icon:'🎓',title:'My college classes',note:'Pick your college term, then upload or type your weekly classes.',render:()=><ScheduleSetup {...setupProps} draftKey={draftScope} only="college"/>},
  {id:'link',icon:'🔗',title:'A calendar link',note:'Google, Apple or Outlook calendars, Canvas, Classroom, Schoology, or a team app like TeamSnap or GameChanger.',render:()=><CalendarImport data={data} save={save}/>},
  {id:'photos',icon:'📸',title:'Photos or screenshots',note:'A planner page, whiteboard, syllabus or a screenshot of dates.',render:()=><UpdatePlanScanner profileId={profile.id} subjects={subjects} kids={profileKids} save={save} onOpenAiSettings={()=>openSettings('Import & export')}/>},
  {id:'pdf',icon:'📄',title:'A PDF of dates',note:'A syllabus, assignment list or class calendar as a PDF.',render:()=><ScheduleImport data={data} save={save}/>},
  {id:'weekly',icon:'🔁',title:'A weekly activity',note:'Work, lessons, clubs or anything on the same days each week.',render:()=><ScheduleSetup {...setupProps} draftKey={draftScope} only="manual"/>},
  {id:'sports',icon:'⚽',title:'A sports season',note:'Practices each week, plus a games schedule you upload.',render:()=><ScheduleSetup {...setupProps} draftKey={draftScope} only="sports"/>},
 ]
 const [weatherOpen,setWeatherOpen]=useState(false)
 const openWeather=()=>setWeatherOpen(true)
 const weatherIcon={rain:'🌧️',snow:'🌨️',wind:'🌬️',cloudy:'☁️',clear:'☀️'}[weather.weather]??'⛅'
 const weatherChip=<button type="button" className="kono-weather-chip" onClick={openWeather} title="Sanctuary weather" aria-label={'Sanctuary weather'+(weather.reading?': '+weather.reading.condition+', '+weather.reading.temperatureF+'°F':'')}><span aria-hidden="true">{weatherIcon}</span>{weather.reading&&data.settings.sanctuaryWeatherMode==='live'&&<small>{Math.round(weather.reading.temperatureF)}°</small>}</button>
 const commands=[...visiblePages.map(p=>({label:'Open '+p,hint:'Page',run:()=>navigate(p)})),{label:'Add to my calendar',hint:'Planner',run:()=>openAdd()},...SETTINGS_TABS.map(tab=>({label:'Settings › '+tab,hint:'Settings',run:()=>openSettings(tab)})),...(store.isAdmin&&!store.support?[{label:'KONO support: all accounts',hint:'Settings',run:()=>openSettings('KONO support')}]:[]),{label:'Sanctuary weather',hint:'Sanctuary',run:openWeather},{label:'AI helper (API key)',hint:'Settings › Import & export',run:()=>openSettings('Import & export')},...(parentMode?[{label:"Kids' appearance",hint:'Settings › Family',run:()=>openSettings('Family')}]:[]),...(['tasks','notes','exams','calendarEvents','subjects',...(parentMode?['kids'] as const:[])] as Collection[]).flatMap(key=>own(data,key).map(entry=>({label:titleOf(entry),hint:labels[key]+' · '+String(entry.due??entry.date??entry.body??entry.notes??'').slice(0,160),run:()=>edit(key,entry)})))]
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
 // Your day (Home): late work and past-due reminders lead Today; the tabs count what's on each day.
 const pastReminders=data.calendarEvents.filter(e=>e.profileId===profile.id&&!e.done&&e.date<today).sort((a,b)=>a.date.localeCompare(b.date))
 const todayCount=overdue.length+pastReminders.length+todayClasses.length+todayLoose.length,tomorrowCount=tomorrowClasses.length+tomorrowLoose.length
 const setupLeft=startSkipped.has('all')?0:startSteps.filter(st=>!st.done).length
 return <div className={'workbench density-'+(data.settings.density??'comfortable')+' text-'+(data.settings.textSize??'normal')} data-page={page.toLowerCase()} data-experience={experience} data-decoration={data.settings.decoration!==false}>
  <a className="skip-link" href="#workspace-main">Skip to content</a>
  {experience==='cozy'?<div className="cozy-navigation"><Sidebar view={page==='Trash'?'Notes':page} onView={navigate} profile={profile.name} schoolYear={profile.label} profiles={data.profiles} activeProfileId={profile.id} onProfileChange={id=>void save(d=>({...d,activeProfileId:id}))} weekWeather={weather.reading?.daily??[]} weatherLocation={data.settings.sanctuaryWeatherLocations[profile.id]} music={music} parentMode={parentMode} weatherChip={weatherChip}/></div>:<aside className="wb-sidebar"><div className="wb-brand-row"><a className="wb-brand" href="?page=sanctuary" onClick={e=>{e.preventDefault();navigate('Sanctuary')}}><span className="brand-mark" aria-hidden="true"><BrandLogo/><i>✿</i></span><strong>KONO<small>Study Sanctuary</small></strong></a>{weatherChip}</div><div className="wb-tabs-label">Notebook tabs</div><nav aria-label="Main navigation">{visiblePages.map(p=><button key={p} aria-current={page===p?'page':undefined} onClick={()=>navigate(p)}><span className="wb-nav-icon">{p==='Trash'?<span aria-hidden="true">↶</span>:<NavIcon name={p} experience={experience}/>}</span><span>{p}</span></button>)}</nav><div className="sidebar-music-slot"><MusicPlayer controller={music} compact/></div><label className="wb-profile"><span className="wb-profile-title">{profile.label}</span>Study profile<select value={profile.id} onChange={e=>void save(d=>({...d,activeProfileId:e.target.value}))}>{data.profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label></aside>}
  <main id="workspace-main"><AccountBanners store={store}/><header className="wb-header"><div><small>{profile.label}</small><div className="wb-title-row"><h1>{page}{experience==='cozy'&&<span className="cozy-heading-flower" aria-hidden="true">❀</span>}</h1>{page==='Sanctuary'&&weather.reading&&weather.reading.daily.length>0&&<div className="wb-header-weather"><WeekWeather days={weather.reading.daily} location={data.settings.sanctuaryWeatherLocations[profile.id]}/></div>}</div>{page!=='Sanctuary'&&pageSummary[page]&&<p className="wb-page-summary">{pageSummary[page]}</p>}<SaveStatus store={store}/></div><div className="wb-toolbar">{page==='Sanctuary'&&setupLeft>0&&<button type="button" className={'setup-chip'+(setupOpen?' is-open':'')} aria-expanded={setupOpen} onClick={()=>setSetupOpen(v=>!v)}><span aria-hidden="true">✨</span> Set up KONO · {startSteps.length-setupLeft}/{startSteps.length}</button>}{needsReviewEntries.length>0&&<button type="button" className="needs-review-nav-badge" onClick={()=>setReviewOpen(true)}>🚩 {needsReviewEntries.length} to review</button>}<button className="wb-history-btn" title="Undo" disabled={!repository.canUndo} onClick={()=>void run(repository.undo,'Undone. Earned progress is kept.')}><ActionIcon name="undo"/><span className="wb-btn-label">Undo</span></button><button className="wb-history-btn" title="Redo" disabled={!repository.canRedo} onClick={()=>void run(repository.redo,'Redone.')}><ActionIcon name="redo"/><span className="wb-btn-label">Redo</span></button><button className="wb-icon-able" title="Search" onClick={()=>setSearch(true)}><ActionIcon name="search"/><span className="wb-btn-label">Search</span></button>{experience==='cozy'&&<button className="wb-icon-able" title="Trash" onClick={()=>navigate('Trash')}><ActionIcon name="trash"/><span className="wb-btn-label">Trash</span></button>}<button className={'primary'+(ownTasks.some(t=>!t.done)?'':' is-inviting')} onClick={()=>setAdding(true)}>＋ Add</button>{voiceSupported&&<button className={'voice-add-button'+(voiceListening?' is-listening':'')} onClick={toggleVoiceAdd} aria-pressed={voiceListening} aria-label={voiceListening?'Stop voice input':'Add by voice'} title="Speak an assignment, exam, note or appointment — it opens in the right editor to review"><span className="kono-mic-face" aria-hidden="true"><img src={voiceListening?'/garden/kono/excited.webp':mood.pose} alt=""/></span>{voiceListening?'Listening…':''}</button>}</div>{konoPhrase&&<div className="kono-speech-bubble" role="status"><img src={konoPhrase.kind==='sticker'||konoPhrase.kind==='milestone'||konoPhrase.kind==='celebration'?'/garden/kono/excited.webp':mood.pose} alt="" aria-hidden="true"/><p>{konoPhrase.text}</p><button type="button" aria-label="Dismiss" onClick={()=>setKonoPhrase(null)}>×</button></div>}{voiceError&&<p role="alert" className="voice-add-error">{voiceError}</p>}</header>
   <div ref={pageScope} className="wb-page">
   {message&&<p role="status" className="wb-notice">{message}<button onClick={()=>setMessage('')} aria-label="Dismiss message">×</button></p>}
   {undoToast&&<div className="undo-toast" role="status" key={undoToast.at}><span>{undoToast.text}</span>{repository.canUndo&&<button type="button" onClick={()=>{setUndoToast(null);void run(repository.undo,'Undone.')}}>Undo</button>}<button type="button" className="undo-toast-close" aria-label="Dismiss" onClick={()=>setUndoToast(null)}>×</button></div>}
   {showDigest&&(page==='Sanctuary'||page==='Planner')&&<div className="wb-notice login-digest is-slim" role="status"><details><summary><strong>{dueSoon.length} due by {new Date(addDays(today,3)+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})}</strong>{dueSoon.length===1&&<span className="digest-inline"> · {dueSoon[0].title}</span>}</summary><ul>{dueSoon.slice(0,5).map(t=><li key={t.id}>{t.title} · {dateLabel(t.due)}</li>)}</ul>{dueSoon.length>5&&<small>+{dueSoon.length-5} more</small>}</details><button onClick={dismissDigest}>Got it</button></div>}
   {(page==='Sanctuary'||page==='Planner')&&schoolAhead.length>0&&<div className="wb-notice school-heads-up" role="status"><div><strong>📅 Coming up at school</strong><ul>{schoolAhead.map(c=><li key={c.key}><b>{changeTitle(c)}</b>{changeDetail(c)?' · '+changeDetail(c):''}</li>)}</ul></div><button onClick={()=>setSchoolSeen([...schoolSeen.split('|').filter(Boolean).slice(-30),...schoolAhead.map(c=>c.key)].join('|'))}>Got it</button></div>}
   {showCrunch&&<div className="wb-notice crunch-digest" role="status"><div><strong>{crunchDays.length===1?'A busy day is':'Busy days are'} coming up</strong><ul>{crunchDays.slice(0,3).map(([day,list])=><li key={day}>{dateLabel(day)}: {list.length} thing{list.length===1?'':'s'} due{list.filter(i=>i.kind==='exam').length>1?' (multiple exams)':''}</li>)}</ul>{crunchDays.length>3&&<small>+{crunchDays.length-3} more busy day{crunchDays.length-3===1?'':'s'}</small>}</div><button onClick={dismissCrunch}>Got it</button></div>}
   {showReviewDigest&&<div className="wb-notice review-digest" role="status"><div><strong>{needsReviewEntries.length} item{needsReviewEntries.length===1?'':'s'} from a scanned photo need{needsReviewEntries.length===1?'s':''} a check</strong><small>Added automatically — make sure each one is correct.</small></div><button className="primary" onClick={()=>setReviewOpen(true)}>Review now</button><button onClick={dismissReviewDigest}>Later</button></div>}
   {hasDraft&&!editor&&<div className="wb-notice">You have an unfinished draft.<button onClick={()=>{try{const draft=JSON.parse(localStorage.getItem(draftScope)??'null') as Edit;if(!draft||!collections.includes(draft.key)||draft.entry.profileId!==profile.id)throw Error('Invalid draft');setEditor(draft)}catch{setMessage('This draft could not be opened.')}}}>Resume draft</button><button onClick={()=>{setConfirmation({text:'Discard this unfinished draft?',action:()=>{localStorage.removeItem(draftScope);localStorage.removeItem(draftScope+':assignment-dates');setHasDraft(false)}})}}>Discard draft</button></div>}
   {page==='Sanctuary'&&<>
    {classmatesOn&&<SharedWithMe repository={repository} data={data} save={save}/>}
    {showTour&&<Suspense fallback={<TourPlaceholder/>}><WelcomeTour onAdd={()=>setAdding(true)} onDone={()=>setTourDone('1')}/></Suspense>}
    <section className={'wb-island '+(expanded?'is-expanded':'')} data-kono-need={konoNeed??undefined}><div className="wb-scene-toolbar"><div className="wb-scene-left"><nav className="island-mode-tabs" aria-label="Sanctuary view"><button aria-current={islandMode==='view'?'page':undefined} onClick={()=>setIslandMode('view')}>Your island</button><button aria-current={islandMode==='decorate'?'page':undefined} onClick={()=>{setDecorateStart(undefined);setIslandMode('decorate')}}>Decorate</button></nav></div><div className="wb-scene-controls"><label className="wb-scene-time" title="Sanctuary time"><span aria-hidden="true">🕐</span><select aria-label="Sanctuary time" value={phase} onChange={e=>setPhase(e.target.value as typeof phase)}>{['auto','morning','afternoon','evening','night'].map(p=><option key={p} value={p}>{p==='auto'?'Live time':p[0].toUpperCase()+p.slice(1)}</option>)}</select></label>{islandMode==='view'&&<div className="wb-island-zoom" role="group" aria-label="Zoom island"><button type="button" onClick={()=>setIslandZoom(z=>Math.max(MIN_ISLAND_ZOOM,+(z-0.25).toFixed(2)))} disabled={islandZoom<=MIN_ISLAND_ZOOM} aria-label="Zoom out">−</button><span aria-live="polite">{Math.round(islandZoom*100)}%</span><button type="button" onClick={()=>setIslandZoom(z=>Math.min(MAX_ISLAND_ZOOM,+(z+0.25).toFixed(2)))} disabled={islandZoom>=MAX_ISLAND_ZOOM} aria-label="Zoom in">＋</button>{islandZoom!==1&&<button type="button" onClick={resetIslandView}>Reset</button>}</div>}<button type="button" className="wb-scene-expand" title={expanded?'Close full screen':'Expand'} onClick={()=>setExpanded(v=>!v)}><span aria-hidden="true">{expanded?'✕':'⤢'}</span><span className="wb-btn-label">{expanded?'Close full screen':'Expand'}</span></button></div></div><div className="wb-sanctuary-stage"><div ref={islandStageRef} className="wb-sanctuary-zoom-wrap" onTouchStart={onIslandTouchStart} onTouchMove={onIslandTouchMove} onTouchEnd={onIslandTouchEnd} onPointerDown={onIslandPointerDown} onPointerMove={onIslandPointerMove} onPointerUp={onIslandPointerUp} onPointerCancel={onIslandPointerUp}><div className={'wb-sanctuary-zoom'+(islandMode==='view'&&islandZoom!==1?' is-zoomed':'')} style={islandMode==='view'?{transform:`translate(${islandPan.x}px, ${islandPan.y}px) scale(${islandZoom})`}:undefined}><div className={'wb-sanctuary-backdrop'+(islandMode==='decorate'?' is-decorating':'')}><GardenCard phase={islandPhase} weather={weather.weather} reducedMotion={reduced} progress={sanctuaryProgress} decorations={data.sanctuaryDecor[profile.id]?.placements} paused={islandMode==='decorate'} celebrateSignal={celebrateSignal} focusCompanionActive={focusCompanionActive} onKonoPet={islandPat} konoNeed={konoNeed} feedSignal={feedSignal} konoMood={meters.away?null:{full:meters.full,rested:meters.rested,happy:meters.happy,asleep:meters.asleep}} outfit={shownOutfit} visitor={visitor?.id??null}/></div>{islandMode==='view'&&<SanctuaryDecorLayer data={data} phase={islandPhase}/>}</div></div>{islandMode==='decorate'&&<SanctuaryBuild data={data} save={save} phase={phase} earned={decorEarned} today={today} startCategory={decorateStart} wardrobe={{offered:outfitsOffered(unlockedOutfitIds,today),unlocked:unlockedOutfitIds,worn,stats:wardrobe,onWear:wearOutfit}} stamps={stamps} bond={bond}/>}</div></section>
    {/* KONO today: the bottom strip of the island card, inside its border. KONO, its line, how it's
        doing, one care action, stickers, and "do next" / "ask". The day's wish (and an island season)
        sit in a small line under it; Ask KONO and What should I do now? open below when asked. */}
    <section className={'wb-panel kono-mood kono-bar is-'+mood.id} aria-label="KONO today"><div className="kono-mood-row"><button type="button" className={'kono-mood-face'+(!cornerOpen&&careMoment&&!careMoment.pose.includes('sleep')?' is-reacting':'')+(!cornerOpen&&careMoment?.react?' is-'+careMoment.react:'')} data-costume={shownOutfit?undefined:islandEvent?.emoji} aria-label="Open KONO’s corner" aria-haspopup="dialog" onClick={()=>setCornerOpen(true)}><KonoFace imgKey={careMoment?.at} pose={konoPose} outfit={shownOutfit} size={40}/>{!cornerOpen&&careMoment?.react&&careMoment.react!=='tickle'&&<span key={careMoment.at} className={'kono-react is-'+careMoment.react} aria-hidden="true">{careMoment.react==='wave'?'👋':careMoment.react==='heart'?'💗':'✋'}</span>}</button><p aria-live="polite">{konoLine}{careMoment?.icon&&<img className="kono-find-icon" src={careMoment.icon} alt=""/>}</p>
     <div className="kono-care" role="group" aria-label="How KONO is doing">
      {([['full','🍙','Full'],['rested','💤',meters.asleep?'Sleeping':'Rested'],['happy','💛','Happy']] as const).map(([key,icon,label])=><span key={key} className={'kono-care-meter is-'+key+(meters[key]<35&&!(key==='rested'&&meters.asleep)?' is-low':'')+(meterGain.some(g=>g.key===key)?' is-up':'')} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={meters[key]} title={label+': '+meters[key]+'%'+(key==='full'?' · Finished work earns KONO snacks.':'')}><span aria-hidden="true">{icon}</span><span className="kono-care-bar"><i style={{width:meters[key]+'%'}}/></span>{meterGain.filter(g=>g.key===key).map(g=><b key={g.at} className="kono-care-gain" aria-hidden="true">+{g.n}</b>)}</span>)}
      {/* One action at a time: Wake up in the morning; in the evening dinner first (while KONO is hungry
          and there's a snack), then Tuck in; otherwise Feed when there's a snack. */}
      {careAction}
     </div>
     <div className="kono-bar-tools"><button type="button" className="next-up-open" aria-label="What should I do now?" aria-expanded={nextUpOpen} onClick={()=>{setAskOpen(false);setNextUpOpen(v=>!v)}}><span aria-hidden="true">▶</span> Next</button><button type="button" className="ask-kono-open" aria-label="Ask KONO" aria-expanded={askOpen} onClick={()=>{setNextUpOpen(false);setKonoPhrase(null);setAskOpen(v=>!v)}}><span aria-hidden="true">🗣️</span> Ask</button></div></div>
     <p className="kono-bar-notes">{note&&<span className={'kono-note is-'+note.kind} role="status">{noteText(note)}{note.kind==='ask'&&<span className="kono-note-choices" role="group" aria-label={'How did '+note.test.title+' go?'}>{MOODS.map(m=><button type="button" key={m.mood} aria-label={m.label} title={m.label} onClick={()=>answerTest(note.test,m.mood)}>{m.emoji}</button>)}</span>}{note.kind==='nudge'&&<span className="kono-note-choices"><button type="button" onClick={()=>{answerNudge(true);startFocusSession(note.item.exam?'':note.item.id,note.item.minutes,note.item.exam?note.item.title:undefined)}}>Start</button><button type="button" onClick={()=>answerNudge(false)}>Not now</button></span>}</span>}<span className={'kono-wish'+(wishGranted?' is-granted':'')}>{wishGranted?'✨ Today’s wish came true.':'✨ KONO wishes you’d '+wishText(wish)+(wish.goal>1?' · '+wishDone+'/'+wish.goal:'')}</span>{!note&&!snacks.length&&meters.full<45&&!bed.tucked&&<span className="kono-care-hint">🍙 Finish something to earn KONO a snack</span>}</p>
     {cornerOpen&&<Suspense fallback={null}><KonoCorner close={()=>setCornerOpen(false)} pose={konoPose} outfit={shownOutfit} costume={shownOutfit?undefined:islandEvent?.emoji} line={konoLine}
      faceClass={(careMoment&&!careMoment.pose.includes('sleep')?' is-reacting':'')+(careMoment?.react?' is-'+careMoment.react:'')}
      reaction={careMoment?.react&&careMoment.react!=='tickle'?<span key={careMoment.at} className={'kono-react is-'+careMoment.react} aria-hidden="true">{careMoment.react==='wave'?'👋':careMoment.react==='heart'?'💗':'✋'}</span>:null}
      onPet={tapAt=>petKono(tapAt)}
      meters={([['full','🍙','Full'],['rested','💤',meters.asleep?'Sleeping':'Rested'],['happy','💛','Happy']] as const).map(([key,icon,label])=>{const g=meterGain.find(x=>x.key===key);return {key,icon,label,value:meters[key],low:meters[key]<35&&!(key==='rested'&&meters.asleep),...(g?{gain:{n:g.n,at:g.at}}:{})}})}
      action={bed.tucked?null:bed.canWake||bed.canTuck&&(!snacks.length||meters.full>=70)?careAction:null}
      snacks={snacks} favorite={favorite} tried={tried} allTreats={ALL_TREATS} onFeed={taskId=>feedKono(taskId)}
      asleep={meters.asleep} playAt={nextPlayAt(careLog)} onPlay={playKono} now={careNow.getTime()}
      streak={currentStreak} week={{done:weekDone,total:weekTotal}}
      tiles={[
       {id:'stickers',icon:'🏅',label:'Stickers',detail:earned.size+' of '+offeredStickers+' earned',ariaLabel:'Your stickers: '+earned.size+' of '+offeredStickers+' earned',onOpen:()=>{setDecorateStart('stickers');setIslandMode('decorate')}},
       {id:'stamps',icon:'🐾',label:'Stamp card',detail:stamps.stamped.length+' of '+CARD_SIZE+' stamps',ariaLabel:'Stamp card: '+stamps.stamped.length+' of '+CARD_SIZE+' stamps',onOpen:()=>{setDecorateStart('presents');setIslandMode('decorate')}},
       {id:'wardrobe',icon:'🎀',label:'Wardrobe',detail:unlockedOutfitIds.size+' of '+outfitsOffered(unlockedOutfitIds,today).length+' outfits',onOpen:()=>{setDecorateStart('wardrobe');setIslandMode('decorate')}},
       {id:'bond',icon:'💗',label:'Bond',detail:bond.level+' heart'+(bond.level===1?'':'s')+' · '+bond.title,onOpen:()=>{setDecorateStart('presents');setIslandMode('decorate')}},
      ]}
      notes={<>{islandEvent&&<span className="kono-season">{islandEvent.emoji} <strong>{islandEvent.label}:</strong> {islandEvent.stickers.filter(t=>earned.has(t.id)).length}/{islandEvent.stickers.length} special stickers until {islandEvent.until}</span>}</>}/></Suspense>}
     {askOpen&&<AskKono data={data} today={today} name={profile.name} pose={konoPose} onClose={()=>setAskOpen(false)}/>}{nextUpOpen&&<NextUp items={nextUpList(tasks,today,ownExams)} onClose={()=>setNextUpOpen(false)} onStart={item=>{setNextUpOpen(false);startFocusSession(item.exam?'':item.id,item.minutes,item.exam?item.title:undefined)}} onDone={item=>void run(()=>save(d=>completeTask(d,item.id)),'Done: '+item.title,true)}/>}
    </section>
    <details ref={sanctuaryFocusRef} className="wb-panel sanctuary-focus"><summary>Focus session</summary><FocusSession draftKey={draftScope+':focus'} tasks={tasks} notes={notes} focusRequest={focusRequest} onComplete={id=>void run(()=>save(d=>completeTask(d,id)),'Assignment completed.')} onSaveNote={body=>save(d=>({...d,notes:[...d.notes,{id:uid('note'),profileId:profile.id,subjectId:'',title:'Study session',body,created:new Date().toISOString(),pinned:true}]}))} onFocusActiveChange={setFocusCompanionActive} onSessionComplete={focusDone}/></details>
    {setupOpen&&setupLeft>0&&<GettingStarted steps={startSteps} onSkip={skipStart} onHide={()=>{skipStart('all');setSetupOpen(false)}}/>}
    {recap&&recapDay(today)&&recapHiddenFor!==recap.from&&<div className="wb-panel week-recap-sunday"><WeekRecap recap={recap} onPlanWeek={openWeekPlan} onDismiss={()=>setRecapHiddenFor(recap.from)}/></div>}
    {weekend&&<section className="wb-panel weekend-card" aria-label="Get ready for Monday"><div className="wb-section-head"><div><small>WEEKEND · {dateLabel(monday)}</small><h2>Get ready for Monday</h2></div><div className="wb-toolbar"><button onClick={()=>{setSelectedDate(monday);navigate('Planner')}}>Open Monday</button><button onClick={openWeekPlan}>✨ Plan my week</button></div></div>
     {mondayWork.length>0?<div className="weekend-due"><strong>Due Monday</strong>{mondayWork.map(t=>card('tasks',t as unknown as Entry))}</div>:<p>Nothing is due Monday.</p>}
     {weekTests.length>0?<p className="weekend-tests"><strong>Tests this week:</strong> {weekTests.map(e=>e.title+' ('+new Date(e.due+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})+')').join(', ')}</p>:<p className="wb-muted">No tests next week.</p>}
    </section>}
    {/* Your day: one card for today and tomorrow. Late work and past-due reminders lead Today; ＋ Add
        and the ⋯ menu (what to show, classes, the Planner) sit in its header. */}
    <section className="wb-panel today-card" aria-label="Your day">
     <div className="wb-section-head today-card-head">
      <div className="today-card-tabs" role="tablist" aria-label="Day">
       {(['today','tomorrow'] as const).map(d=><button type="button" key={d} role="tab" id={'day-tab-'+d} aria-controls={'day-panel-'+d} aria-selected={dayTab===d} tabIndex={dayTab===d?0:-1} onClick={()=>{setDayTab(d);setQuickDayOpen(null)}}>{d==='today'?'Today':'Tomorrow'}{(d==='today'?todayCount:tomorrowCount)>0&&<span className="today-card-count">{d==='today'?todayCount:tomorrowCount}</span>}</button>)}
      </div>
      <div className="wb-toolbar">
       <button type="button" className="quick-day-open" aria-label={'Add for '+dayTab} aria-expanded={quickDayOpen===dayTab} onClick={()=>setQuickDayOpen(o=>o===dayTab?null:dayTab)}>＋ Add</button>
       <details className="today-card-more"><summary aria-label="More for your day">⋯</summary><div className="today-card-menu"><span className="today-card-menu-title">Show</span>{scheduleViewPicker}<button type="button" onClick={()=>{setSettingsTab('Schedules');navigate('Settings')}}>Edit classes</button><button type="button" onClick={()=>{setSelectedDate(dayTab==='today'?today:tomorrow);navigate('Planner')}}>Open in Planner</button></div></details>
      </div>
     </div>
     {dayTab==='today'?<div role="tabpanel" id="day-panel-today" aria-labelledby="day-tab-today" className="today-card-body">
      {overdueCard}
      {pastReminders.length>0&&<div className="tomorrow-extra-list today-card-reminders"><strong>Reminders</strong>{pastReminders.map(e=>card('calendarEvents',e as unknown as Entry))}</div>}
      {quickDayOpen==='today'&&<QuickDayAdd date={today} dayName="today" subjects={subjects} onAdd={item=>quickDay(today,item)} onClose={()=>setQuickDayOpen(null)}/>}
      <AssignmentProgress tasks={tasks} date={today} label="Today's"/>{schoolDayLabels(data,today).map(label=><p className="school-day-label" key={label}>{label}</p>)}
      <div className="today-schedule-list">{todayClasses.map(renderCompactClass)}</div>
      {todayLoose.length>0&&<div className="tomorrow-extra-list"><strong>Also today</strong>{todayLoose.map(e=>card(e.key,e.entry))}</div>}
      {!todayClasses.length&&!todayLoose.length&&<p className="today-card-empty">{season&&season.end<today?'Your schedule has ended. Update its dates in Settings.':'Nothing else on today.'}</p>}
     </div>:<div role="tabpanel" id="day-panel-tomorrow" aria-labelledby="day-tab-tomorrow" className="today-card-body">
      <p className="today-card-date">{dateLabel(tomorrow)}</p>
      {quickDayOpen==='tomorrow'&&<QuickDayAdd date={tomorrow} dayName="tomorrow" subjects={subjects} onAdd={item=>quickDay(tomorrow,item)} onClose={()=>setQuickDayOpen(null)}/>}
      <AssignmentProgress tasks={tasks} date={tomorrow} label="Tomorrow's"/>{schoolDayLabels(data,tomorrow).map(label=><p className="school-day-label" key={label}>{label}</p>)}
      <div className="today-schedule-list">{tomorrowClasses.map(renderCompactClass)}</div>
      {tomorrowLoose.length>0&&<div className="tomorrow-extra-list"><strong>Also tomorrow</strong>{tomorrowLoose.map(e=>card(e.key,e.entry))}</div>}
      {!tomorrowClasses.length&&!tomorrowLoose.length&&<p className="today-card-empty">Nothing on tomorrow yet.</p>}
     </div>}
    </section>
   </>}
   {page==='Planner'&&<><div className="wb-toolbar planner-settings-link"><span>Your classes, assignments and daily plans</span><div className="wb-toolbar"><button className="primary" onClick={()=>openAdd()}>＋ Add to my calendar</button><button onClick={()=>openSettings('Schedules')}>My schedules</button></div></div>{addOpen&&<AddToCalendar choices={addChoices} choice={addChoice} setChoice={setAddChoice} close={closeAdd}/>}{!addOpen&&<>{classmatesOn&&<SharedWithMe repository={repository} data={data} save={save}/>}{overdueCard}{recap&&<details className="wb-panel week-recap-panel"><summary>📊 Your week so far</summary><WeekRecap recap={recap} onPlanWeek={()=>setWeekPlanOpen(true)}/></details>}<details className="wb-panel week-plan-panel" open={weekPlanOpen} onToggle={e=>setWeekPlanOpen(e.currentTarget.open)}><summary>✨ Plan my week</summary><WeekPlanner data={data} save={save}/></details><Calendar data={data} tasks={tasks} date={selectedDate} selectDate={setSelectedDate} create={create} render={card} renderClass={renderCompactClass} reschedule={reschedule} planAt={planAt} stretchTo={stretchTo} edit={edit} setting={setting} navigate={navigate} parentMode={parentMode} quickAddEvent={quickAddFamilyEvent}/><StudyPlanner key={planRequest} initialOpen={planRequest>0} draftKey={draftScope+':plan'} profileId={profile.id} plans={plans} tasks={ownTasks} subjects={subjects} setData={save} onSelectDate={setSelectedDate}/></>}</>}
   {page==='Kids'&&<KidsPage data={data} create={create} edit={edit} remove={remove} patch={patch} openSettings={openSettings}/>}
   {page==='Subjects'&&experience!=='simplified'&&subjectWorkspace}
   {page==='Subjects'&&experience==='simplified'&&<><section className="wb-panel"><div className="wb-section-head"><h2>Your subjects</h2><button onClick={()=>create('subjects')}>＋ Subject</button></div><div className="wb-record-grid">{subjects.map(s=>card('subjects',s as unknown as Entry))}</div>{!subjects.length&&<p>Create your first subject to organize your work.</p>}</section><section className="wb-panel"><div className="wb-section-head"><h2>Assignments</h2><button onClick={()=>create('tasks')}>＋ Assignment</button></div><label>Filter subject<select value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All subjects, including unassigned</option>{subjects.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><div className="wb-toolbar"><button onClick={()=>void run(()=>save(d=>tasks.filter(t=>!subject||t.subjectId===subject).reduce((next,t)=>completeTask(next,t.id,true),d)),'Assignments completed.')}>Complete all shown</button><button onClick={()=>void run(()=>save(d=>tasks.filter(t=>!subject||t.subjectId===subject).reduce((next,t)=>completeTask(next,t.id,false),d)),'Assignments reopened; earned progress is kept.')}>Reopen all shown</button></div>{tasks.filter(t=>!subject||t.subjectId===subject).map(t=>card('tasks',t as unknown as Entry))}</section></>}
   {page==='Notes'&&<>{noteBoard()}<details className="wb-panel"><summary>Quiz me · Flashcards</summary><Flashcards draftKey={draftScope+':cards'} profileId={profile.id} decks={data.flashcardDecks.filter(d=>d.profileId===profile.id)} setData={save}/></details></>}
   {page==='K-Quiz'&&<KQuiz onOpenAiSettings={()=>openSettings('Import & export')} profileId={profile.id} lectures={data.kquizLectures.filter(l=>l.profileId===profile.id)} sets={data.kquizSets.filter(s=>s.profileId===profile.id)} sources={data.kquizSources.filter(s=>s.profileId===profile.id)} decks={data.flashcardDecks.filter(d=>d.profileId===profile.id)} subjects={subjects} setData={save}/>}
   {page==='Exams'&&<section className="wb-panel wb-board board-paper"><div className="wb-section-head wb-board-heading"><h2>Your exams</h2><button onClick={()=>create('exams')}>＋ Exam</button></div><div className="wb-note-grid wb-board-canvas">{data.exams.filter(e=>e.profileId===profile.id).sort((a,b)=>a.due.localeCompare(b.due)).map(e=>card('exams',e as unknown as Entry))}{!data.exams.some(e=>e.profileId===profile.id)&&<p className="wb-board-empty"><img className="kono-empty-art" src="/garden/kono/tea.webp" alt="" aria-hidden="true"/>No exams yet. Add a date and what you need to review.</p>}</div><div className="wb-board-tray" aria-hidden="true"><span>✿</span><span>✦</span><span>✿</span></div></section>}
   {page==='Settings'&&<div className="settings-groups"><div className="wb-section-head settings-page-tools"><small>Version {APP_VERSION} · Build {releaseLabel}</small><FeedbackButton store={store}/></div><nav className="subject-section-tabs" aria-label="Settings sections">{[...SETTINGS_TABS,...(store.isAdmin&&!store.support?['KONO support' as const]:[])].map(tab=><button key={tab} aria-current={tab===settingsTab?'page':undefined} onClick={()=>setSettingsTab(tab)}>{tab}</button>)}</nav>
   {settingsTab==='Look & feel'&&<><section className="wb-panel"><Appearance settings={data.settings} setting={setting}/></section><section className="wb-panel team-colors-panel"><TeamColors settings={data.settings} setting={setting}/></section><section className="wb-panel"><h2>Sound &amp; motion</h2><SoundMotionSettings data={data} setData={save}/></section><section className="wb-panel"><h2>Sanctuary weather</h2><p>Live, manual or clear weather and your weather location are set right on the Sanctuary, from the weather button next to KONO.</p><button type="button" onClick={openWeather}>Open Sanctuary weather</button></section></>}
   {settingsTab==='Notifications'&&<section className="wb-panel"><h2>Notifications</h2><PushSettings store={store}/><section className="card settings-list kono-note-settings"><h3>KONO</h3><label><div><strong>KONO’s notes</strong><small>A lock-screen note at 4:30 PM when KONO is getting hungry or misses you, at most once a day. Comes with lock-screen reminders above.</small></div><input type="checkbox" checked={data.settings.konoNotes!==false} onChange={e=>void setting('konoNotes',e.target.checked)}/></label></section><ReminderSettings data={data} setData={save}/>{parentMode&&<FamilyReminderSettings data={data} setting={setting}/>}</section>}
   {settingsTab==='Family'&&<FamilySettings data={data} setting={setting} patch={patch} navigate={navigate}/>}
   {settingsTab==='Schedules'&&<section className="wb-panel"><ScheduleSetup data={data} save={save} draftKey={draftScope} fetchCatalog={repository.fetchSchoolCatalog} submitCatalogEntry={repository.submitSchoolCatalogEntry}/></section>}
   {settingsTab==='KONO support'&&store.isAdmin&&!store.support&&<section className="wb-panel"><SupportAdminPanel store={store}/></section>}
   {settingsTab==='Import & export'&&<AddFromSiri/>}
   {settingsTab==='Import & export'&&<section className="wb-panel"><h2>Import &amp; export</h2><div id="ai-helper"><AiHelperSettings profileId={profile.id}/></div><div className="wb-notice add-moved"><p><strong>Adding schedules and calendars</strong> (photos, PDFs, calendar links, Canvas and Classroom) now all start from the Planner.</p><button type="button" className="primary" onClick={()=>openAdd()}>＋ Add to my calendar</button></div><details><summary>Share a schedule with someone else</summary><ScheduleShare data={data} save={save}/></details><details><summary>Show KONO in Google Calendar or Apple Calendar (stays up to date)</summary><CalendarSubscribe store={store} profileId={profile.id} planLabel={profile.label}/></details><details><summary>Export to your calendar app</summary><p>Download every assignment, exam and event in {profile.label} as a calendar file, then import or add it in Google Calendar, Apple Calendar, or Outlook. This is a one-time snapshot -- re-download it after making big changes to keep your calendar app in sync.</p><button type="button" onClick={()=>void import('./store/icsExport').then(({buildIcs})=>downloadData(buildIcs(data,profile.id),(profile.label||'kono-plan').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.ics','text/calendar'))}>Download calendar (.ics)</button></details><BackupPanel store={store}/></section>}
   {settingsTab==='Plans & account'&&<><section className="wb-panel"><AccountPanel store={store}/></section><section className="wb-panel"><h2>Plans</h2><PlanSettings data={data} setData={save} onDeleteProfile={id=>{const p=data.profiles.find(x=>x.id===id);if(!p)return;setConfirmation({text:'Delete plan “'+p.label+'” and all its subjects, assignments, notes, schedules and Sanctuary progress? This does not delete your account or other plans. Export a backup first. Plan deletion is not kept in Trash.',action:()=>void run(()=>save(d=>deleteProfile(d,id)),'Plan deleted. Other plans were kept.')})}}/></section><section className="wb-panel"><h2>Friends</h2>{store.user?<PeerConnections repository={repository} myUserId={store.user.id} reducedMotion={reduced}/>:<p>Sign in with a KONO account to connect with classmates and share your classes.</p>}</section></>}
   </div>}
   {page==='Trash'&&<section className="wb-panel"><h2>Recently removed</h2><p>Restore items here, even after a reload. Undo/Redo covers the last 30 changes in this session. Signed-in Trash syncs with your account.</p>{data.trash.filter(t=>t.profileId===profile.id).map(t=><article className="wb-record" key={t.id}><h3>{t.title}</h3><p>{labels[t.collection as Collection]??'Schedule block'} · Removed {new Date(t.deletedAt).toLocaleString()}</p><div className="wb-toolbar"><button onClick={()=>void run(()=>save(d=>restoreEntry(d,t.id)),'Restored.')}>Restore</button><button onClick={()=>{setConfirmation({text:'Permanently delete “'+t.title+'” from Trash? Older backups may still contain it.',action:()=>void run(()=>save(d=>({...d,trash:d.trash.filter(x=>x.id!==t.id)})),'Removed from Trash.')})}}>Delete permanently</button></div></article>)}{!data.trash.some(t=>t.profileId===profile.id)&&<p>Trash is empty.</p>}</section>}
   </div>
  </main>
  <nav className="wb-bottom-nav" aria-label="Mobile navigation">{(['Sanctuary','Planner','Notes'] as Page[]).map(p=><button aria-current={page===p?'page':undefined} key={p} onClick={()=>navigate(p)}>{p}</button>)}<button aria-expanded={more} onClick={()=>setMore(v=>!v)}>More</button></nav>
  <div className="wb-music-bar"><MusicPlayer controller={music} compact/></div>
  {confirmation&&<Modal title="Confirm change" close={()=>setConfirmation(null)}><p>{confirmation.text}</p><button onClick={()=>{confirmation.action();setConfirmation(null)}}>Confirm</button><button onClick={()=>setConfirmation(null)}>Cancel</button></Modal>}
  {more&&<Modal title="More" close={()=>setMore(false)}>{(['Kids','Subjects','K-Quiz','Exams','Settings','Trash'] as Page[]).filter(p=>p!=='Kids'||parentMode).map(p=><button key={p} onClick={()=>navigate(p)}>{p}</button>)}<label>Study profile<select value={profile.id} onChange={e=>void save(d=>({...d,activeProfileId:e.target.value}))}>{data.profiles.map(p=><option value={p.id} key={p.id}>{p.label}</option>)}</select></label></Modal>}
  {adding&&<Modal title="Add to your plan" close={()=>setAdding(false)}><QuickAddBox subjects={data.subjects.filter(s=>s.profileId===profile.id)} today={localDate()} initialText={incoming?.text} link={incoming?.link} onAdd={quickAdd} onEdit={g=>create(g.key,g.due,g.subjectId,{title:g.title,...(g.time?{plannedTime:g.time}:{}),...(g.link?{link:g.link}:{})})}/><div className="quick-add-choice"><p className="quick-add-or">Or pick a type:</p><label>What are you adding?<select aria-label="Add type" value={addKind} onChange={e=>setAddKind(e.target.value as typeof addKind)}><option value="tasks">Homework</option><option value="exams">Exam or test</option><option value="lesson">Lesson</option><option value="notes">Study note</option></select></label><p className="wb-muted">Exams appear on the countdown board. Study notes are pinned to your bulletin board.</p><button className="primary" onClick={()=>addKind==='lesson'?create('calendarEvents',today,subject,{kind:'lesson'}):create(addKind)}>Continue</button></div><button type="button" className="update-entire-plan-button" onClick={()=>{setAdding(false);setScanningPlan(true)}}>📷 Update entire plan — scan notes or a syllabus</button><details className="add-more-choices"><summary>More ways to add</summary><div>{(['studyPlans','calendarEvents','subjects',...(parentMode?['kids'] as const:[])] as Collection[]).map(key=><button key={key} onClick={()=>create(key)}>{labels[key]}</button>)}</div></details></Modal>}
  {weatherOpen&&<Modal title="Sanctuary weather" close={()=>setWeatherOpen(false)}><WeatherSettings data={data} setData={save} weatherState={weather}/></Modal>}
  {scanningPlan&&<Modal title="Update entire plan" close={()=>setScanningPlan(false)}><UpdatePlanScanner profileId={profile.id} subjects={subjects} kids={profileKids} save={save} close={()=>setScanningPlan(false)} onOpenAiSettings={()=>{setScanningPlan(false);openSettings('Import & export')}}/></Modal>}
  {reviewOpen&&<Modal title="Needs review" close={()=>setReviewOpen(false)}><p className="wb-muted">Added automatically from a scanned photo. Check each one — confirming it (or just opening and saving it) clears the flag.</p>{needsReviewEntries.length===0?<p>All caught up.</p>:<>{needsReviewEntries.length>1&&<button type="button" className="primary" onClick={()=>void confirmAllReviews()}>Confirm all {needsReviewEntries.length} items</button>}{needsReviewEntries.map(({key,entry})=>card(key,entry))}</>}</Modal>}
  {search&&<CommandPalette commands={commands} onClose={()=>setSearch(false)}/>}
  {editor&&<EntryEditor key={editor.entry.id} edit={editor} data={data} save={save} share={classmatesOn?repository:null} photoCloud={photoCloud} draftScope={draftScope} close={(saved,discarded,quiet)=>{setEditor(null);setHasDraft(!saved);if(saved&&!quiet)setMessage(discarded?'Draft discarded.':'Saved.')}}/>}
 </div>
}
function RecordCard({cozy,collection,entry,subject,subjectColor,kid,showKidBorder=false,showKidHeader=false,seriesCount=0,compact=false,edit,remove,removeSeries,duplicate,toggle,pin,remind,scheduleReview,confirmReview,startFocus}:{cozy:boolean;collection:Collection;entry:Entry;subject?:string;subjectColor?:string;kid?:Kid;showKidBorder?:boolean;showKidHeader?:boolean;seriesCount?:number;compact?:boolean;edit:()=>void;remove:()=>void;removeSeries?:()=>void;duplicate:()=>void;toggle:()=>void;pin:()=>void;remind:()=>void;scheduleReview?:()=>void;confirmReview?:()=>void;startFocus?:()=>void}){
 const note=collection==='notes',paper=note||collection==='exams',done=Boolean(note?entry.completed:entry.done),canComplete=['tasks','notes','exams','calendarEvents'].includes(collection)
 const due=String(entry.due??entry.date??''),dueLabel=due?countdown(due,done):''
 const subtasks=collection==='tasks'?entry.subtasks as Subtask[]|undefined:undefined
 const nextStep=subtasks?.find(s=>!s.done)
 // Project steps (store/projectSteps) have days: the card says when the next one is.
 const stepDay=(day:string)=>{const now=localDate(),name=new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'});return day===now?'today':day<now?'was '+name:name}
 const subtaskProgress=subtasks?.length?subtasks.filter(s=>s.done).length+'/'+subtasks.length+' steps'+(nextStep?.due?' · next '+stepDay(nextStep.due):''):''
 const inSeries=seriesCount>1
 const priority=collection==='exams'||isImportantEntry(collection,entry)
 // Scanned in from a photo and not yet looked at -- a visible flag until someone opens it (which
 // clears it automatically, see EntryEditor) or taps "Looks good" to confirm it without editing.
 const needsReview=Boolean(confirmReview&&entry.needsReview)
 const reviewBadge=needsReview&&<span className="needs-review-badge">⚠ Check this</span>
 const reviewButton=needsReview&&<button onClick={confirmReview}>Looks good</button>
 const plannedTime=collection==='tasks'&&entry.plannedTime?String(entry.plannedTime):''
 const plannedChip=plannedTime&&<span className="subtask-chip">🕐 {classTime(plannedTime)}</span>
 // A link (Google Doc, Classroom, textbook) opens in one tap; photos open in the editor.
 const link=typeof entry.link==='string'?entry.link:'',photoCount=Array.isArray(entry.photos)?entry.photos.length:0
 const attachChips=(link||photoCount>0)&&<span className="attach-chips">{link&&<a className="subtask-chip attach-link" href={link} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>🔗 Open link</a>}{photoCount>0&&<button type="button" className="subtask-chip attach-photos" onClick={edit} aria-label={photoCount===1?'1 photo, open it':photoCount+' photos, open them'}>📷 {photoCount}</button>}</span>
 const startFocusButton=startFocus&&<button type="button" className="start-focus-button" onClick={startFocus}>▶ Start focus session</button>
 if(cozy&&collection==='tasks')return <article className={'cozy-task-row '+(done?'is-complete':'')+(needsReview?' needs-review-record':'')} style={{'--subject-accent':subjectColor??'#b47e75'} as CSSProperties}><button className="cozy-complete" aria-label={(done?'Reopen ':'Complete ')+titleOf(entry)} aria-pressed={done} onClick={toggle}>{done?'✓':'○'}</button><div className="cozy-task-copy">{reviewBadge}<h3>{titleOf(entry)}</h3><p>{subject??'Unassigned'} · {dateLabel(String(entry.due))} <span className={'countdown-chip '+(daysUntil(String(entry.due))<0?'is-overdue':'')}>{dueLabel}</span>{plannedChip}{attachChips}{subtaskProgress&&<span className="subtask-chip">{subtaskProgress}</span>}{inSeries&&<span className="subtask-chip">1 of {seriesCount} dates</span>}</p>{Boolean(entry.notes)&&<SafeNoteBody text={String(entry.notes)}/>}</div><div className="cozy-task-actions">{reviewButton}{startFocusButton}<button onClick={edit}><ActionIcon name="edit"/>Edit</button><details className="card-more"><summary aria-label={'More actions for '+titleOf(entry)} title="More actions">⋯</summary><div onClick={e=>{(e.currentTarget.parentElement as HTMLDetailsElement).open=false}}><button onClick={duplicate}><ActionIcon name="copy"/>Duplicate</button><button onClick={remove}><ActionIcon name="trash"/>Move to Trash</button>{inSeries&&<button onClick={removeSeries}><ActionIcon name="trash"/>Delete whole series ({seriesCount})</button>}</div></details></div></article>
 if(cozy&&paper&&compact)return <button type="button" className={'cozy-pin-mini'+(priority?' priority-record':'')+(done?' is-complete':'')+(needsReview?' needs-review-record':'')} style={{'--note-paper':String(entry.color??'#ffd2dd'),'--note-ink':String(entry.textColor??'#2f2942')} as CSSProperties} onClick={edit}><span className="push-pin pin-mini" aria-hidden="true"/>{priority&&<b aria-hidden="true">★</b>}<strong>{titleOf(entry)}</strong>{dueLabel&&<span className={'countdown-chip '+(daysUntil(due)<0?'is-overdue':'')}>{dueLabel}</span>}</button>
 if(cozy&&paper)return <div className={'cozy-note-record '+(priority?'priority-record':'')+(needsReview?' needs-review-record':'')} >{priority&&<span className="priority-flag">★ IMPORTANT · {dueLabel}</span>}{reviewBadge}{attachChips}<StickyNoteView kind={note?'note':'exam'} color={String(entry.color??'#ffd2dd')} textColor={String(entry.textColor??'#2f2942')} font={String(entry.font??'rounded')} pinned={Boolean(entry.pinned)} completed={done} subject={subject??'General'} title={titleOf(entry)} body={String(entry.body??entry.notes??'')} highlight={String(entry.highlight??'transparent')} dateLabel={due?dateLabel(due)+(dueLabel?' · '+dueLabel:''):undefined} onEdit={edit} onDelete={remove} onTogglePin={note?pin:undefined} onToggleComplete={toggle}/><div className="wb-toolbar">{reviewButton}<button className="cozy-duplicate" onClick={duplicate}>Duplicate</button>{note&&<button onClick={remind}>Add reminder</button>}{scheduleReview&&<button onClick={scheduleReview}>Schedule review</button>}</div></div>
 // A calendar event's own compact tile: the time is the first thing a parent's eye hits, in a
 // fixed-width column so a whole day's times line up for a straight vertical scan. showKidBorder and
 // showKidHeader are each their own opt-in (see the Kids page's appearance settings) and both require
 // parentMode -- a solo student who never turns parent mode on always gets the plain subject-based
 // header and a neutral border here, exactly as before the family calendar existed, never "Family" or
 // a color that means nothing to them.
 // A kid's own border style (see the Kids page's Appearance panel) only applies when a specific kid is
 // both tagged and showing -- an untagged "Family" item or a solo student's plain tile always gets the
 // ordinary border, never someone else's chosen style.
 const borderStyle=showKidBorder&&kid?kid.borderStyle??'solid':'solid'
 if(collection==='calendarEvents')return <article className={'wb-family-event kid-border-'+borderStyle+(done?' is-complete':'')+(needsReview?' needs-review-record':'')} style={{'--kid-color':showKidBorder?kid?.color??'#b47e75':undefined} as CSSProperties}>
  <div className="wb-family-event-main">
   <div className="wb-family-event-time">{entry.time?<><span className="wb-family-event-start">{classTime(String(entry.time))}</span>{entry.endTime&&<span className="wb-family-event-end">–{classTime(String(entry.endTime))}</span>}</>:'—'}</div>
   <div className="wb-family-event-info">
    <small>{showKidHeader?(kid?(kid.emoji?kid.emoji+' ':'')+kid.name:'Family')+(subject?' · '+subject:''):subject??(entry.subjectId?'Removed subject':'General')}</small>
    <h3>{titleOf(entry)}{inSeries&&<span className="wb-repeat-mark" title={'Repeats · '+seriesCount+' dates'} aria-label="Repeats"> ↻</span>}</h3>
   </div>
   {reviewBadge}{due&&<span className={'countdown-chip '+(daysUntil(due)<0?'is-overdue':'')}>{dueLabel}</span>}
  </div>
  <div className="wb-toolbar">{reviewButton}<button onClick={toggle}>{done?'Reopen':'Complete'}</button><button onClick={edit}>Edit</button><details className="wb-actions"><summary>More actions</summary><div><button onClick={duplicate}>Duplicate</button><button onClick={remove}>Move to Trash</button>{inSeries&&<button onClick={removeSeries}>Delete whole series ({seriesCount})</button>}</div></details></div>
 </article>
 return <article className={'wb-record wb-record-'+collection+' '+(paper?'wb-sticky note-font-'+String(entry.font??'rounded'):'')+(done?' is-complete':'')+(needsReview?' needs-review-record':'')} style={paper?{'--note-paper':String(entry.color??'#fff2b4'),'--note-ink':String(entry.textColor??'#2f2942')} as CSSProperties:{'--subject-accent':subjectColor??String(entry.color??'#b47e75')} as CSSProperties}>
  <>{paper&&<span className="push-pin pin-0" aria-hidden="true"/>}</>{reviewBadge}<small>{subject??(entry.subjectId?'Removed subject':'General')} · {labels[collection]}{note&&entry.pinned?' · Pinned':''}</small><h3>{titleOf(entry)}</h3>{Boolean(entry.due||entry.date)&&<p>{dateLabel(String(entry.due??entry.date))}{done?' · Completed':''} {due&&<span className={'countdown-chip '+(daysUntil(due)<0?'is-overdue':'')}>{dueLabel}</span>}{plannedChip}{attachChips}{subtaskProgress&&<span className="subtask-chip">{subtaskProgress}</span>}{inSeries&&<span className="subtask-chip">1 of {seriesCount} dates</span>}</p>}
  {Boolean(entry.body||entry.notes)&&<div className="wb-record-body" style={{background:String(entry.highlight??'transparent')}}><SafeNoteBody text={String(entry.body??entry.notes)}/></div>}
  {collection==='subjects'&&<p>{String(entry.teacher??'')}{entry.room?' · '+String(entry.room):''}</p>}
  <div className="wb-toolbar">{canComplete&&<button onClick={toggle}>{done?'Reopen':'Complete'}</button>}{reviewButton}{startFocusButton}<button onClick={edit}>Edit</button><details className="wb-actions"><summary>More actions</summary><div><button onClick={duplicate}>Duplicate</button>{note&&<button onClick={remind}>Add reminder</button>}{note&&<button onClick={pin}>{entry.pinned?'Remove from board':'Pin to board'}</button>}{scheduleReview&&<button onClick={scheduleReview}>Schedule review</button>}<button onClick={remove}>Move to Trash</button>{inSeries&&<button onClick={removeSeries}>Delete whole series ({seriesCount})</button>}</div></details></div>
 </article>
}
function Calendar({data,tasks,date,selectDate,create,render,renderClass,reschedule,planAt,stretchTo,edit,navigate,parentMode,quickAddEvent}:{data:AppData;tasks:Task[];date:string;selectDate:(date:string)=>void;create:(key:Collection,date?:string,subjectId?:string,seed?:Partial<Entry>)=>void;render:(key:Collection,entry:Entry,compact?:boolean)=>ReactNode;renderClass:(item:ClassOccurrence)=>ReactNode;reschedule:(key:Collection,entry:Entry,date:string)=>void;planAt:(key:Collection,entry:Entry,day:string,time:string)=>void;stretchTo:(key:Collection,entry:Entry,end:string)=>void;edit:(key:Collection,entry:Entry)=>void;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>;navigate:(page:Page)=>void;parentMode:boolean;quickAddEvent:(date:string,payload:{title:string;kind:CalendarEventKind;kidId?:string;time?:string;endTime?:string})=>Promise<boolean>}){
 // Week by default (three days at a time on an iPhone); Month and Agenda are in the picker.
 const [mode,setMode]=useState('week'),[month,setMonth]=useState(()=>localDate().slice(0,7))
 const [dropTarget,setDropTarget]=useState('')
 // The class tapped on the week (by date and ID, so its card shows the latest after a change).
 const [classOpen,setClassOpen]=useState<{day:string;id:string}|null>(null)
 // Parent mode's whole point is speed: click a date, pick who/what/when, done -- without opening the
 // full assignment/exam/note/event editor. Only ever offered when parentMode is on (see the toolbar
 // and Agenda-day buttons below); the state itself just tracks which date's popup is open, if any.
 const [quickAdd,setQuickAdd]=useState<{date:string;time?:string}|null>(null),phone=usePhoneWidth()
 // Source chips (School · Canvas · Google · Sports · Mine): which sources are hidden, per device.
 const [hiddenRaw,setHiddenRaw]=useLocalSetting('kono-planner-hidden-sources:'+data.activeProfileId,'')
 const hiddenSources=new Set(hiddenRaw.split(',').filter(Boolean)),shown=(s:PlannerSource)=>!hiddenSources.has(s)
 const toggleSource=(s:PlannerSource)=>{const next=new Set(hiddenSources);if(next.has(s))next.delete(s);else next.add(s);setHiddenRaw([...next].join(','))}
 const available=sourcesInPlan(data)
 const kids=data.kids.filter(k=>k.profileId===data.activeProfileId)
 // Which kid a day's items belong to is a filter on top of the academic/sports/appointments one, not
 // a replacement for it -- both narrow the same one shared calendar together. Kept as local state
 // (not a persisted setting, unlike the checkboxes above) so a newly added kid shows by default: it's
 // simply absent from "hidden" until someone unchecks them, same pattern as the old Family page.
 const [hiddenKids,setHiddenKids]=useState<Set<string>>(()=>new Set())
 const kidVisible=(kidId?:string)=>!kidId||!hiddenKids.has(kidId)
 const toggleKid=(id:string)=>setHiddenKids(v=>{const next=new Set(v);if(next.has(id))next.delete(id);else next.add(id);return next})
 const kidOf=(kidId?:string)=>kidId?kids.find(k=>k.id===kidId):undefined
 const scheduleClasses=(day:string)=>classOccurrences(data,day).filter(c=>shown(classSource(c))&&kidVisible(c.block.kidId))
 const entries=[
  ...tasks.filter(t=>kidVisible(t.kidId)).map(t=>({key:'tasks' as Collection,entry:t as unknown as Entry,date:t.due})),
  ...own(data,'exams').filter(e=>kidVisible(e.kidId as string|undefined)).map(e=>({key:'exams' as Collection,entry:e,date:String(e.due)})),
  ...own(data,'notes').filter(n=>entryDate(n)).map(n=>({key:'notes' as Collection,entry:n,date:entryDate(n)})),
  ...own(data,'calendarEvents').filter(e=>kidVisible(e.kidId as string|undefined)).map(e=>({key:'calendarEvents' as Collection,entry:e,date:String(e.date)})),
 ].filter(e=>shown(entrySource(e.key,e.entry)))
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
 // The daily page: what isn't already listed under one of the day's classes.
 const dayLoose=selectedEntries.filter(e=>e.key==='exams'||!attachedToClass(e,selectedClasses)),todayDate=localDate()
 const dayEntries=Array.from({length:7},(_,i)=>({day:addDays(date,i),entries:entries.filter(e=>e.date===addDays(date,i)),classes:scheduleClasses(addDays(date,i))}))
 // A dot/list-item's color: whichever kid it's tagged to, so a parent scanning the grid sees "whose"
 // before "what subject" -- falling back to the subject color (and the priority red) exactly as
 // before for anything not tagged to a kid.
 const dotColor=(entry:{key:Collection;entry:Entry})=>kidOf(entry.entry.kidId as string|undefined)?.color??(dayHasPriority(entry)?'#d24864':data.subjects.find(s=>s.id===entry.entry.subjectId)?.color??'#d9828a')
 const classDotColor=(c:ClassOccurrence)=>kidOf(c.block.kidId)?.color??data.subjects.find(s=>s.id===c.block.subjectId)?.color??'#b77c98'
 // Week view: Sunday to Saturday around the selected date, classes and timed items at their hour.
 // On an iPhone seven columns are too narrow to read, so it shows three days from the selected one.
 const weekStart=phone?date:addDays(date,-new Date(date+'T12:00:00').getDay()),weekDays=Array.from({length:phone?3:7},(_,i)=>addDays(weekStart,i)),weekStep=phone?3:7
 const later=(t:string,by:number)=>{const m=Math.min(24*60-1,Number(t.slice(0,2))*60+Number(t.slice(3,5))+by);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
 const weekItems:WeekItem[]=mode!=='week'?[]:weekDays.flatMap(day=>[
  ...scheduleClasses(day).map(c=>({id:c.id,day,title:c.block.label,start:c.timePending?undefined:c.displayStart??c.block.start,end:c.displayEnd??c.block.end,color:classDotColor(c)})),
  ...entries.filter(e=>e.date===day).map(e=>{const start=entryTime(e);return {id:e.key+':'+e.entry.id,drag:e.key==='notes'?undefined:e.key+':'+e.entry.id,stretch:!!start&&(e.key==='calendarEvents'||e.key==='tasks'),day,title:titleOf(e.entry)||'Untitled',start,end:e.key==='calendarEvents'?e.entry.endTime as string|undefined:start?later(start,Number(e.entry.estimatedMinutes)||60):undefined,color:dotColor(e),important:dayHasPriority(e)}}),
 ])
 const dropOnWeek=(drag:string,day:string,time?:string)=>{
  const item=entries.find(e=>e.key+':'+e.entry.id===drag)
  if(!item)return
  if(time)planAt(item.key,item.entry,day,time);else if(item.date!==day)reschedule(item.key,item.entry,day)
 }
 const stretchOnWeek=(drag:string,end:string)=>{const item=entries.find(e=>e.key+':'+e.entry.id===drag);if(item)stretchTo(item.key,item.entry,end)}
 // Tapping something on the week opens it right there: an assignment, exam or event in its editor, a
 // class as its card (notes, skip, add for this class), so there's no scrolling down to the daily page.
 const openOnWeek=(item:WeekItem)=>{
  const entry=entries.find(e=>e.key+':'+e.entry.id===item.id)
  if(entry){edit(entry.key,entry.entry);return}
  const occurrence=scheduleClasses(item.day).find(c=>c.id===item.id)
  if(occurrence)setClassOpen({day:item.day,id:occurrence.id});else selectDate(item.day)
 }
 const openClass=classOpen?scheduleClasses(classOpen.day).find(c=>c.id===classOpen.id):undefined
 const addAt=(day:string,time:string)=>{selectDate(day);if(parentMode)setQuickAdd({date:day,time});else create('calendarEvents',day,undefined,{time,endTime:later(time,60)})}
 return <section className="wb-panel cozy-calendar-shell"><div className="wb-section-head"><h2>Your calendar</h2><div className="wb-toolbar">{date!==todayDate&&<button type="button" title="Go back to today on the calendar and daily page" onClick={()=>{selectDate(todayDate);setMonth(todayDate.slice(0,7))}}>↩ Back to today</button>}<label>Calendar view<select value={mode} onChange={e=>setMode(e.target.value)}><option value="week">Week</option><option value="month">Month</option><option value="agenda">Agenda</option></select></label></div></div>
  {available.length>1&&<div className="planner-source-chips" role="group" aria-label="Show on calendar">{PLANNER_SOURCES.filter(s=>available.includes(s.id)).map(s=><button type="button" key={s.id} title={s.title} aria-pressed={shown(s.id)} className={'source-chip source-'+s.id} onClick={()=>toggleSource(s.id)}>{s.label}</button>)}</div>}

  {kids.length>0&&<div className="family-kid-list" role="group" aria-label="Filter calendar by kid">{kids.map(k=><label key={k.id} className="family-kid-chip" style={{'--kid-color':k.color} as CSSProperties}><input type="checkbox" checked={!hiddenKids.has(k.id)} onChange={()=>toggleKid(k.id)}/><i className="family-kid-swatch" aria-hidden="true"/>{(k.emoji?k.emoji+' ':'')+k.name}</label>)}</div>}
  {mode==='week'&&<><div className="wb-section-head week-grid-nav"><button aria-label={phone?'Previous days':'Previous week'} onClick={()=>selectDate(addDays(date,-weekStep))}>‹</button><h3>{new Date(weekDays[0]+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})} – {new Date(weekDays[weekDays.length-1]+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</h3><button aria-label={phone?'Next days':'Next week'} onClick={()=>selectDate(addDays(date,weekStep))}>›</button></div><p className="wb-muted week-grid-hint">{phone?'Tap to open or add. Hold to move; drag the bottom edge to make it longer.':'Tap anything to open it, or an empty time to add something then. Drag something to move it; drag its bottom edge to make it longer.'}</p><WeekGrid days={weekDays} items={weekItems} selected={date} onSelect={selectDate} onAddAt={addAt} onOpen={openOnWeek} onDrop={dropOnWeek} onStretch={stretchOnWeek} dayLabel={dateLabel}/></>}
  {openClass&&<Modal title={dateLabel(openClass.date)} close={()=>setClassOpen(null)}><div className="week-class-sheet">{renderClass(openClass)}</div></Modal>}
  {mode==='month'&&<><div className="wb-section-head"><button aria-label="Previous month" onClick={()=>shift(-1)}>‹</button><h3>{start.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><button aria-label="Next month" onClick={()=>shift(1)}>›</button></div><div className="wb-calendar">{dayNames.map(d=><span key={d}>{d.slice(0,3)}</span>)}{Array.from({length:42},(_,i)=>addDays(gridStart,i)).map(day=>{const dayEntriesForDate=entries.filter(e=>e.date===day),classes=scheduleClasses(day),important=dayEntriesForDate.filter(dayHasPriority);return <button key={day} aria-label={dateLabel(day)+' · '+(dayEntriesForDate.length+classes.length)+' entries · '+important.length+' important · '+schoolDayLabels(data,day).join(' · ')} aria-pressed={date===day} className={(day.slice(0,7)!==month?'muted-day ':'')+(important.length?'has-priority':'')+(dropTarget===day?' drop-target':'')} onClick={()=>{selectDate(day);if(parentMode)setQuickAdd({date:day})}} {...dropOn(day)}><span className="calendar-date-row"><strong>{Number(day.slice(-2))}</strong>{important.length>0&&<b title="Exam or project">★ {important.length}</b>}</span><small>{dayEntriesForDate.length+classes.length||''}{dayEntriesForDate.length+classes.length?' entries':''}</small><span className="school-day-mini">{schoolDayLabels(data,day).map(label=>label.slice(label.indexOf(':')+1).trim()).join(' · ')}</span><span className="calendar-class-preview">{classes.slice(0,2).map(c=><span key={c.id}>{c.block.label}</span>)}</span><span className="calendar-entry-preview">{dayEntriesForDate.slice(0,2).map(e=><span className={dayHasPriority(e)?'is-priority':''} key={e.entry.id}>{dayHasPriority(e)?'★ ':''}{titleOf(e.entry)}</span>)}</span><span className="wb-cal-dots" aria-hidden="true">{classes.slice(0,5).map(c=><i key={c.id} style={{background:classDotColor(c)}}/>)}{dayEntriesForDate.slice(0,4).map(e=><i key={e.entry.id} style={{background:dotColor(e)}}/>)}</span></button>})}</div></>}
  {mode==='agenda'&&<div className="wb-agenda-upcoming"><h4>This week</h4>{dayEntries.map(({day,entries:dayEntriesForDate,classes:dayClasses},i)=>{if(i>=2&&!parentMode&&!dayClasses.length&&!dayEntriesForDate.length)return null;const important=dayEntriesForDate.filter(dayHasPriority).length;return <details key={day} open={i===0} className={'wb-agenda-day'+(dropTarget===day?' drop-target':'')} {...dropOn(day)}><summary><h3>{i===0?'Today':i===1?'Tomorrow':dateLabel(day)}{i<2&&<small className="wb-agenda-day-date"> · {dateLabel(day)}</small>}</h3><span className="wb-agenda-day-meta"><small>{dayClasses.length+dayEntriesForDate.length} item{dayClasses.length+dayEntriesForDate.length===1?'':'s'}{important?' · '+important+' important':''}</small>{parentMode&&<button type="button" className="quick-add-kid-event" onClick={e=>{e.preventDefault();e.stopPropagation();setQuickAdd({date:day})}}>＋ Add</button>}</span></summary>{schoolDayLabels(data,day).map(label=><p className="school-day-label" key={label}>{label}</p>)}{importantFirst(dayEntriesForDate.filter(e=>e.key==='exams'||!attachedToClass(e,dayClasses))).map(draggableEntry)}{dayClasses.map(renderClass)}{!dayClasses.length&&!dayEntriesForDate.length&&<p className="wb-muted">Nothing scheduled.</p>}</details>})}{!parentMode&&dayEntries.slice(2).every(d=>!d.classes.length&&!d.entries.length)&&<p className="wb-muted wb-agenda-empty-note">Nothing else scheduled this week.</p>}</div>}
  {/* Only shown in Month view: in Agenda mode the selected date is always day 0 of "This week"
      above (dayEntries starts counting from `date`), so this would just repeat that day's own
      list. Month view has no other per-day detail panel, so a clicked date still needs one here. */}
  {mode!=='agenda'&&<div className="planner-day-paper"><header><small>YOUR DAILY PAGE</small><div className="planner-day-nav"><button type="button" aria-label="Previous day" onClick={()=>{const d=addDays(date,-1);selectDate(d);setMonth(d.slice(0,7))}}>‹</button><h3>{date===todayDate?'Today · ':''}{dateLabel(date)}</h3><button type="button" aria-label="Next day" onClick={()=>{const d=addDays(date,1);selectDate(d);setMonth(d.slice(0,7))}}>›</button></div></header>
  {/* The same layout as the Sanctuary's "Today's schedule": progress, the school-day note, the day's
      classes as compact cards (with what's due for each), then everything else under "Also". */}
  <AssignmentProgress tasks={tasks} date={date} label={dateLabel(date)}/>{schoolDayLabels(data,date).map(label=><p className="school-day-label" key={label}>{label}</p>)}
  <section className={'planner-day-board'+(dropTarget===date?' drop-target':'')} aria-label={'Plan for '+dateLabel(date)} {...dropOn(date)}>{selectedClasses.length>0&&<div className="today-schedule-list">{selectedClasses.map(renderClass)}</div>}{dayLoose.length>0&&<div className="tomorrow-extra-list"><strong>{selectedClasses.length?(date===todayDate?'Also today':'Also on this day'):(date===todayDate?'Today':'On this day')}</strong>{importantFirst(dayLoose).map(draggableEntry)}</div>}{!selectedClasses.length&&!dayLoose.length&&<p className="wb-muted">Nothing planned for this day.</p>}</section>
  <div className="planner-date-tools"><details className="planner-add-menu"><summary>＋ Add to this date</summary><div><button onClick={()=>create('tasks',date)}>Assignment</button><button onClick={()=>create('notes',date)}>Study note</button><button className="is-priority" onClick={()=>create('exams',date)}>★ Exam / project</button><button onClick={()=>create('calendarEvents',date,undefined,{kind:'lesson'})}>Lesson</button><button onClick={()=>create('calendarEvents',date,undefined,{kind:'work'})}>Work</button><button onClick={()=>create('calendarEvents',date)}>Reminder / event</button></div></details></div>
  </div>}
  {quickAdd&&<Modal title={'Add for '+dateLabel(quickAdd.date)} close={()=>setQuickAdd(null)}>{kids.length?<QuickFamilyAdd kids={kids} time={quickAdd.time} onCancel={()=>setQuickAdd(null)} onSave={async payload=>{if(await quickAddEvent(quickAdd.date,payload))setQuickAdd(null)}}/>:<><p className="wb-muted">No kids added yet.</p><button type="button" onClick={()=>{setQuickAdd(null);navigate('Kids')}}>Manage kids</button></>}</Modal>}
  </section>
}
