import type { SanctuaryWeather } from '../game/sanctuary/types'
import { z } from 'zod'
import type { WeatherMode } from '../game/weather/liveWeather'
import type { SanctuaryProgressState } from '../game/progression/types'
import { createSanctuaryProgress, migrateSanctuaryProgress } from '../game/progression/progressionEngine'
import { dateInZone, studyDates, studyUnits } from './studyScheduler'
import {validateSchool,type SchoolCalendar} from './schoolCalendar'
import type { FlashcardDeck } from './flashcards'
import { srsInitial } from './spacedRepetition'

export type ProfileKind='summer'|'school'|'college'|'custom'
export type Profile={id:string;name:string;label:string;kind:ProfileKind;start:string;end:string;progressEpoch?:string;color?:string}
export type Subject={id:string;profileId:string;name:string;color:string;teacher?:string;room?:string;resources:string[]}
/** A kid is a lightweight tag within one shared family calendar/profile -- not its own Profile. Any
 * task/exam/calendarEvent/class block can carry a kidId the same way it already carries a subjectId,
 * so "whose is this" filters and colors the same way "which subject is this" already does. */
export type Kid={id:string;profileId:string;name:string;color:string;emoji?:string}
export type Subtask={id:string;title:string;done:boolean}
export type Task={id:string;profileId:string;subjectId:string;kidId?:string;title:string;due:string;done:boolean;notes:string;completedAt?:string;studyPlanId?:string;unitNumber?:number;subtasks?:Subtask[];recurringId?:string;needsReview?:boolean;estimatedMinutes?:number;plannedTime?:string}
export type StudyPlan={id:string;profileId:string;subjectId:string;title:string;unit:'chapter'|'page'|'problem'|'step';total:number;start:string;end:string;weekdays:number[];timeZone:string}
export type Exam={id:string;profileId:string;subjectId:string;kidId?:string;title:string;due:string;notes:string;done:boolean;color?:string;font?:string;highlight?:string;textColor?:string;needsReview?:boolean}
export type Note={id:string;profileId:string;subjectId:string;title:string;body:string;created:string;source?:string;pinned?:boolean;completed?:boolean;color?:string;font?:string;highlight?:string;textColor?:string;size?:'small'|'medium'|'large';position?:number}
export type CalendarEventKind='exam'|'test'|'quiz'|'assignment'|'study'|'activity'|'personal'|'sports'|'appointment'|'work'|'other'
/** A recorded final score for a sports calendar event. Outcome (win/loss/tie) is always derived by
 * comparing ourScore/opponentScore rather than stored, so it can never disagree with the score. */
export type MatchResult={ourScore:number;opponentScore:number}
export type MatchOutcome='win'|'loss'|'tie'
export const matchOutcome=(result:MatchResult):MatchOutcome=>result.ourScore>result.opponentScore?'win':result.ourScore<result.opponentScore?'loss':'tie'
export type CalendarEvent={id:string;profileId:string;date:string;title:string;kind:CalendarEventKind;done?:boolean;subjectId?:string;kidId?:string;notes:string;time?:string;result?:MatchResult;needsReview?:boolean}
/** Which of the three schedule categories (academic, sports, appointments) a calendar event's kind
 * belongs to for the schedule-view checkboxes below — 'sports' is its own category, everything
 * exam/assignment-shaped is academic, and the rest (personal/appointment/other) are appointments. */
const ACADEMIC_EVENT_KINDS=new Set<CalendarEventKind>(['exam','test','quiz','assignment','study','activity'])
export const eventCategory=(kind:CalendarEventKind):'academic'|'sports'|'appointments'=>kind==='sports'?'sports':ACADEMIC_EVENT_KINDS.has(kind)?'academic':'appointments'
export type SettingsData={experience?:'cozy'|'simplified'|'modern'|'sumi';theme:string;themeVersion:number;sound:boolean;ambient:boolean;reminders:boolean;browserNotifications?:boolean;loginDigest?:boolean;scheduleShowAcademic?:boolean;scheduleShowSports?:boolean;scheduleShowAppointments?:boolean;parentMode?:boolean;reducedMotion:boolean;textSize?:'normal'|'large';density?:'comfortable'|'compact';decoration?:boolean;boardStyle?:'paper'|'cork'|'plain';motionPreference?:'system'|'reduced'|'full';sanctuaryWeather:SanctuaryWeather;sanctuaryWeatherMode:WeatherMode;sanctuaryZipCodes:Record<string,string>;sanctuaryWeatherLocations:Record<string,string>}
export type ScheduleBlock={fullYear?:boolean;slot?:string;dateStart?:string;dateEnd?:string;occurrenceNotes?:Record<string,string>;completedDates?:string[];skippedDates?:string[];id:string;start:string;end:string;label:string;kind:'study'|'break'|'routine'|'hobby';subjectId?:string;kidId?:string;location?:string}
export type WeekSchedule=Record<string,ScheduleBlock[]>
export type StudySeason={school?:SchoolCalendar;category?:'academic'|'sports';id:string;profileId:string;name:string;start:string;end:string;active:boolean;week:WeekSchedule}
export type TrashEntry={id:string;profileId:string;collection:string;title:string;payload:string;deletedAt:string}
/** Player-chosen island decoration — independent of SanctuaryProgressState, which is an earned/derived credit ledger.
 * Each placement drops one build asset freely on the island; x/y are 0-1 fractions of the canvas (matching the
 * SANCTUARY_LANDMARKS anchor convention), not a grid cell. assetId is a free-form string, so an unrecognized ID
 * is simply not found by the renderer, never a validation failure — this is also how a home/pond/tree style
 * becomes just another placeable decoration: nothing here distinguishes "a road tile" from "a mushroom house"
 * beyond which asset catalog entry assetId happens to match, so duplicating and mixing them is free. scale
 * resizes the asset (1 = its defaultScale); skewX tilts it to sit correctly on the island's isometric ground
 * plane; flipX mirrors it horizontally. */
/** `text` is only meaningful on a placement whose asset is `signable` (see BuildAsset) — a short
 * caption the player writes themselves, rendered over the asset's blank sign area. `textSize`/
 * `textColor`/`textFont` are its own optional styling, independent of the asset's overall `scale`;
 * undefined for any of them means "use the sign's default look" (see SIGN_TEXT_DEFAULTS). */
export type SignTextFont='hand'|'serif'|'sans'
export type BuildPlacement={id:string;assetId:string;x:number;y:number;rotation:0|90|180|270;scale:number;skewX:number;flipX:boolean;text?:string;textSize?:number;textColor?:string;textFont?:SignTextFont}
export type SanctuaryDecorState={profileId:string;placements:BuildPlacement[]}
/** A recorded lecture's audio never lives here — it stays device-local in IndexedDB, keyed by this
 * record's own id (see src/store/audioStore.ts) — only the transcript (plain text KONO already
 * knows how to sync/back up safely) travels with the rest of the plan. */
export type KQuizLecture={id:string;profileId:string;subjectId:string;title:string;createdAt:string;durationSeconds:number;transcript:string}
/** A single captured piece of material — a scanned photo already read into text, or notes pasted
 * directly — filed under a subject and checked off later to fold into one combined generation, the
 * same way a running binder of notes gets pulled together at midterms. Capturing one never calls the
 * AI to generate a study set by itself; only "Generate" (over one or more checked sources) does. */
export type KQuizSource={id:string;profileId:string;subjectId:string;title:string;createdAt:string;text:string}
export type KQuizQuestion={id:string;type:'mcq';prompt:string;choices:string[];correctIndex:number}|{id:string;type:'written';prompt:string;answer:string}
export type KQuizPracticeTest={questions:KQuizQuestion[]}
/** A study set groups everything K-Quiz generated from one lecture (or from pasted notes, with no
 * lecture at all). Its flashcards are deliberately not stored here — they're an ordinary
 * FlashcardDeck in flashcardDecks, referenced by id, so practicing them reuses the same deck UI and
 * spaced-repetition state the rest of KONO already has, rather than a second parallel flashcard system. */
export type KQuizSet={id:string;profileId:string;subjectId:string;lectureId?:string;title:string;createdAt:string;summary?:string;studyGuide?:string;flashcardDeckId?:string;practiceTest?:KQuizPracticeTest}
export type AppData={schemaVersion:6;trash:TrashEntry[];profiles:Profile[];activeProfileId:string;subjects:Subject[];kids:Kid[];tasks:Task[];exams:Exam[];notes:Note[];calendarEvents:CalendarEvent[];studySeasons:StudySeason[];studyPlans:StudyPlan[];flashcardDecks:FlashcardDeck[];kquizLectures:KQuizLecture[];kquizSets:KQuizSet[];kquizSources:KQuizSource[];settings:SettingsData;sanctuaryProgress:Record<string,SanctuaryProgressState>;sanctuaryDecor:Record<string,SanctuaryDecorState>;onboardingComplete?:boolean}

export const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] as const
export const blankWeek=():WeekSchedule=>Object.fromEntries(dayNames.map(day=>[day,[]]))
/** LAN HTTP previews lack randomUUID; getRandomValues still supplies secure bytes. */
export function randomId():string {
 if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID()
 const bytes=new Uint8Array(16)
 globalThis.crypto.getRandomValues(bytes)
 bytes[6]=(bytes[6]&15)|64
 bytes[8]=(bytes[8]&63)|128
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
export const uid=(prefix:string)=>`${prefix}-${randomId()}`
export const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
export const defaultSettings:SettingsData={experience:'cozy',textSize:'normal',density:'comfortable',decoration:true,boardStyle:'paper',theme:'coral',themeVersion:4,sound:true,ambient:true,reminders:false,browserNotifications:false,loginDigest:true,scheduleShowAcademic:true,scheduleShowSports:true,scheduleShowAppointments:true,parentMode:false,reducedMotion:false,motionPreference:'system',sanctuaryWeather:'clear',sanctuaryWeatherMode:'clear',sanctuaryZipCodes:{},sanctuaryWeatherLocations:{}}
export function createFreshData():AppData {
 const id=uid('profile'),start=localDate(),end=localDate(new Date(Date.now()+180*86400000))
 return {schemaVersion:6,trash:[],profiles:[{id,name:'Learner',label:'My study plan',kind:'custom',start,end,progressEpoch:uid('epoch')}],activeProfileId:id,subjects:[],kids:[],tasks:[],exams:[],notes:[],calendarEvents:[],studyPlans:[],flashcardDecks:[],kquizLectures:[],kquizSets:[],kquizSources:[],studySeasons:[{id:uid('season'),profileId:id,name:'My schedule',start,end,active:true,week:blankWeek()}],settings:{...defaultSettings},sanctuaryProgress:{[id]:createSanctuaryProgress(id)},sanctuaryDecor:{[id]:{profileId:id,placements:[]}},onboardingComplete:false}
}

type Obj=Record<string,unknown>
const object=(value:unknown):value is Obj=>!!value&&typeof value==='object'&&!Array.isArray(value)
const fail=(path:string):never=>{throw new Error(`Invalid saved data: ${path}. Your original save has not been replaced.`)}
const str=(v:unknown,path:string,max=1000):string=>typeof v==='string'&&v.length<=max?v:fail(path)
const id=(v:unknown,path:string):string=>{const s=str(v,path,150);return s&&!['__proto__','constructor','prototype'].includes(s)?s:fail(path)}
const optional=(v:unknown,path:string,max=1000)=>v===undefined?undefined:str(v,path,max)
const integer=(v:unknown,path:string,max:number)=>typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=max?v:fail(path)
const nonNegativeInt=(v:unknown,path:string)=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=36500?v:fail(path)
const easeValue=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=5?v:fail('card ease')
const bool=(v:unknown,fallback=false)=>v===undefined?fallback:typeof v==='boolean'?v:fail('boolean')
const list=(v:unknown,path:string,limit=20000):Obj[]=>{
 if(!Array.isArray(v)||v.length>limit||!v.every(object))return fail(path)
 const seen=new Set<string>();for(const item of v){const key=id(item.id,`${path}.id`);if(seen.has(key))fail(`${path}: duplicate ID`);seen.add(key)}
 return v
}
const choice=<const T extends string>(v:unknown,values:readonly T[],fallback:T):T=>v===undefined?fallback:values.includes(v as T)?v as T:fail('choice')
const date=(v:unknown,path:string):string=>{const s=str(v,path,10),d=new Date(`${s}T12:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:fail(path)}
const clockTime=(v:unknown)=>{const s=str(v,'schedule time',5);return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)?s:fail('schedule time')}
const color=(v:unknown,fallback:string)=>v===undefined?fallback:typeof v==='string'&&(/^(#[0-9a-f]{3,8}|transparent)$/i.test(v))?v:fail('color')
const occurrenceNotes=(value:unknown):Record<string,string>=>{if(value===undefined)return {};if(!object(value)||Object.keys(value).length>2000)return fail('class notes');return Object.fromEntries(Object.entries(value).map(([key,text])=>[date(key,'class note date'),str(text,'class note',10000)]))}
const stringMap=(v:unknown):Record<string,string>=>{if(v===undefined)return {};if(!object(v))return fail('settings locations');return Object.fromEntries(Object.entries(v).map(([k,x])=>[id(k,'location profile'),str(x,'location',300)]))}
/** A match score is cosmetic, recorded well after the fact — malformed input (e.g. from a future
 * schema change) is just dropped rather than failing the whole save. */
const matchResult=(v:unknown):MatchResult|undefined=>{
 if(v===undefined||v===null)return undefined
 if(!object(v))return undefined
 const clampScore=(n:unknown):number|null=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(999,Math.round(n))):null
 const ourScore=clampScore(v.ourScore),opponentScore=clampScore(v.opponentScore)
 return ourScore===null||opponentScore===null?undefined:{ourScore,opponentScore}
}
/** A placement's x/y are 0-1 fractions of the build canvas — clamped rather than failed, since a stray
 * out-of-range value is a harmless cosmetic drift (the item renders near an edge), never data corruption.
 * A missing/non-numeric value (e.g. a placement saved by the earlier grid-based {col,row} editor, which
 * had no x/y at all) defaults to the center rather than failing the entire save. */
const fraction=(v:unknown):number=>{const n=typeof v==='number'&&Number.isFinite(v)?v:0.5;return Math.min(1,Math.max(0,n))}
/** Placement scale/skew are cosmetic and always clamped rather than failed — a missing value (e.g. from a save
 * made before these fields existed) defaults to no resize/no skew instead of rejecting the whole save. */
const placementScale=(v:unknown):number=>{const n=typeof v==='number'&&Number.isFinite(v)?v:1;return Math.min(3,Math.max(0.3,n))}
const placementSkew=(v:unknown):number=>{const n=typeof v==='number'&&Number.isFinite(v)?v:0;return Math.min(60,Math.max(-60,n))}
/** Unlike scale/skew, a missing textSize means "use the sign's own default size" (see
 * SIGN_TEXT_DEFAULTS in buildAssets.ts), not a fixed fallback number — so this stays undefined
 * rather than clamping to some baseline, only clamping the range when a value is actually present. */
const textSize=(v:unknown):number|undefined=>v===undefined?undefined:typeof v==='number'&&Number.isFinite(v)?Math.min(2.2,Math.max(0.6,v)):fail('sign text size')
/** null means "use the style's default position" (unmoved) — distinct from 0.5, so a style nobody has
 * dragged yet still renders at its normal spot rather than snapping to center. */
const nullableFraction=(v:unknown):number|null=>v==null?null:fraction(v)
/** A decoration's x/y is the anchor point on its OWN art (see buildItemStyle) — clamping it to a
 * margin inside the canvas, not the full edge-to-edge 0-1 range `fraction` allows, guarantees the
 * item's rendered box always overlaps the visible canvas somewhere near that point, however it's
 * later scaled, so a placement can never end up entirely off-screen and unreachable to fix. Runs on
 * every load, so it also recovers any placement saved off-screen before this existed. */
const placementCoord=(v:unknown):number=>Math.min(0.94,Math.max(0.06,fraction(v)))

/** Validate unknown input before migration. Never turn malformed records into a demo. */
export function normalizeData(raw:unknown):AppData {
 if(!z.object({profiles:z.array(z.record(z.string(),z.unknown())).min(1).max(100)}).safeParse(raw).success)return fail('profiles')
 if(!object(raw))return fail('document')
 if(raw.schemaVersion!==undefined&&raw.schemaVersion!==2&&raw.schemaVersion!==3&&raw.schemaVersion!==4&&raw.schemaVersion!==5&&raw.schemaVersion!==6)return fail('unsupported data version; update KONO before opening this save')
 const profiles:Profile[]=list(raw.profiles,'profiles',100).map(p=>({id:id(p.id,'profile ID'),name:str(p.name,'name',200),label:str(p.label,'plan name',200),kind:choice(p.kind,['summer','school','college','custom'],'custom'),start:date(p.start,'profile start'),end:date(p.end,'profile end'),progressEpoch:optional(p.progressEpoch,'epoch',150),color:p.color===undefined?undefined:color(p.color,'#7ca982')}))
 if(!profiles.length)return fail('profiles must contain at least one plan')
 const pids=new Set(profiles.map(p=>p.id))
 const owner=(v:unknown)=>{const key=id(v,'record profile');return pids.has(key)?key:fail('record references an unknown profile')}
 const taskInput=list(raw.tasks??[],'tasks'),examInput=list(raw.exams??[],'exams'),noteInput=list(raw.notes??raw.journal??[],'notes'),eventInput=list(raw.calendarEvents??[],'events')
 const scheduleRefs=list(raw.studySeasons??[],'schedules',500).flatMap(season=>object(season.week)?Object.values(season.week).flatMap(blocks=>Array.isArray(blocks)?blocks.filter(object).map(block=>({subjectId:block.subjectId,profileId:season.profileId})):[]):[])
 const usedSubjectIds=new Set(list(raw.subjects??[],'subjects',2000).map(s=>id(s.id,'subject ID')))
 const remap=new Map<string,string>(),subjects:Subject[]=[]
 for(const s of list(raw.subjects??[],'subjects',2000)){
  const sid=id(s.id,'subject ID')
  const used=[...new Set([...taskInput,...examInput,...noteInput,...eventInput,...scheduleRefs].filter(r=>r.subjectId===sid).map(r=>owner(r.profileId)))]
  const owners=s.profileId?[owner(s.profileId)]:(used.length?used:[profiles[0].id])
  owners.forEach((profileId,index)=>{let mapped=sid;if(index){let suffix=1;do{mapped=`${sid.slice(0,100)}:migrated-${suffix++}`}while(usedSubjectIds.has(mapped));usedSubjectIds.add(mapped)}remap.set(`${sid}:${profileId}`,mapped);subjects.push({id:mapped,profileId,name:str(s.name,'subject name',200),color:color(s.color,'#4169a8'),teacher:optional(s.teacher,'teacher',200),room:optional(s.room,'room',100),resources:Array.isArray(s.resources)?s.resources.map(x=>str(x,'resource',2000)):[]})})
 }
 const subject=(v:unknown,profileId:string)=>{if(v===undefined||v==='')return '';const key=id(v,'subject reference'),mapped=remap.get(`${key}:${profileId}`)??key;const known=subjects.find(s=>s.id===mapped);if(known&&known.profileId!==profileId)return fail('subject belongs to another profile');return mapped}
 // 40 chars comfortably covers a multi-codepoint emoji (skin-tone modifiers, ZWJ family/couple
 // sequences can run well past a handful of UTF-16 units) without accepting arbitrary text.
 const kids:Kid[]=list(raw.kids??[],'kids',500).map(k=>({id:id(k.id,'kid ID'),profileId:owner(k.profileId),name:str(k.name,'kid name',200),color:color(k.color,'#7ca982'),emoji:optional(k.emoji,'kid emoji',40)}))
 // A kid tag is cosmetic, unlike a subject reference -- a stale or cross-profile kidId (e.g. from a
 // kid deleted elsewhere) just clears back to unassigned rather than failing the whole save.
 const kidRef=(v:unknown,profileId:string):string|undefined=>{if(v===undefined||v==='')return undefined;const key=str(v,'kid reference',150);const known=kids.find(k=>k.id===key);return known&&known.profileId===profileId?key:undefined}
 const studyPlans:StudyPlan[]=list(raw.studyPlans??[],'study plans',200).map(p=>{
  const profileId=owner(p.profileId),start=date(p.start,'study start'),end=date(p.end,'study deadline'),timeZone=str(p.timeZone,'study time zone',100)
  if(!Array.isArray(p.weekdays))return fail('study weekdays')
  const weekdays=p.weekdays as number[]
  try{studyDates(start,end,weekdays);dateInZone(timeZone)}catch{return fail('study dates or time zone')}
  const title=str(p.title,'study title',200);if(!title.trim())return fail('study title')
  return {id:id(p.id,'study ID'),profileId,subjectId:subject(p.subjectId,profileId),title,unit:choice(p.unit,studyUnits,'chapter'),total:integer(p.total,'study workload',1000),start,end,weekdays,timeZone}
 })
 const studyById=new Map(studyPlans.map(p=>[p.id,p])),seenUnits=new Map<string,Set<number>>()
 const subtasks=(v:unknown):Subtask[]|undefined=>{if(v===undefined)return undefined;return list(v,'subtasks',50).map(s=>({id:id(s.id,'subtask ID'),title:str(s.title,'subtask title',300),done:bool(s.done)}))}
 const tasks:Task[]=taskInput.map(t=>{const profileId=owner(t.profileId);const result:Task={id:id(t.id,'task ID'),profileId,subjectId:subject(t.subjectId,profileId),kidId:kidRef(t.kidId,profileId),title:str(t.title,'task title',1000),due:date(t.due,'task date'),done:bool(t.done),notes:str(t.notes??'','task notes',100000),completedAt:optional(t.completedAt,'completion timestamp',40),subtasks:subtasks(t.subtasks),recurringId:optional(t.recurringId,'recurring series ID',150),needsReview:bool(t.needsReview),estimatedMinutes:t.estimatedMinutes===undefined?undefined:integer(t.estimatedMinutes,'estimated minutes',600),plannedTime:t.plannedTime===undefined?undefined:clockTime(t.plannedTime)}
  if(t.studyPlanId!==undefined){
   const plan=studyById.get(id(t.studyPlanId,'study reference'));if(!plan||plan.profileId!==profileId)return fail('study task ownership')
   const unitNumber=integer(t.unitNumber,'study unit',plan.total),seen=seenUnits.get(plan.id)??new Set<number>();if(seen.has(unitNumber))return fail('duplicate study unit');seen.add(unitNumber);seenUnits.set(plan.id,seen)
   result.studyPlanId=plan.id;result.unitNumber=unitNumber
   if(result.done&&!result.completedAt)return fail('study completion date')
   if(result.completedAt){if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(result.completedAt)||!Number.isFinite(Date.parse(result.completedAt)))return fail('study completion date');result.completedAt=new Date(result.completedAt).toISOString()}
  }else if(t.unitNumber!==undefined)return fail('study unit without a plan')
  return result
 })
 for(const plan of studyPlans)if(seenUnits.get(plan.id)?.size!==plan.total)return fail('study plan is missing tasks')
 const style=(s:Obj)=>({color:color(s.color,'#ffd2dd'),textColor:color(s.textColor,'#2f2942'),highlight:color(s.highlight,'transparent'),font:choice(s.font,['rounded','handwritten','serif','mono'],'rounded')})
 const exams:Exam[]=examInput.map(e=>{const profileId=owner(e.profileId);return {id:id(e.id,'exam ID'),profileId,subjectId:subject(e.subjectId,profileId),kidId:kidRef(e.kidId,profileId),title:str(e.title,'exam title',1000),due:date(e.due,'exam date'),notes:str(e.notes??'','exam notes',100000),done:bool(e.done),needsReview:bool(e.needsReview),...style(e)}})
 const notes:Note[]=noteInput.map(n=>{const profileId=owner(n.profileId);return {id:id(n.id,'note ID'),profileId,subjectId:subject(n.subjectId,profileId),title:str(n.title,'note title',1000),body:str(n.body??'','note body',100000),created:str(n.created,'note date',40),size:choice(n.size,['small','medium','large'],'medium'),position:typeof n.position==='number'&&Number.isFinite(n.position)?n.position:0,source:optional(n.source,'source',1000),pinned:bool(n.pinned),completed:bool(n.completed),...style(n)}})
 const calendarEvents:CalendarEvent[]=eventInput.map(e=>{const profileId=owner(e.profileId);return {id:id(e.id,'event ID'),profileId,done:bool(e.done),subjectId:subject(e.subjectId,profileId),kidId:kidRef(e.kidId,profileId),title:str(e.title,'event title',1000),date:date(e.date,'event date'),notes:str(e.notes??'','event notes',100000),kind:choice(e.kind,['exam','test','quiz','assignment','study','activity','personal','sports','appointment','work','other'],'other'),time:e.time===undefined?undefined:clockTime(e.time),result:matchResult(e.result),needsReview:bool(e.needsReview)}})
 const studySeasons:StudySeason[]=list(raw.studySeasons??[],'schedules',500).map(s=>{
  const profileId=owner(s.profileId);if(!object(s.week))return fail('schedule week')
  const school=s.school===undefined?undefined:structuredClone(s.school) as SchoolCalendar
  if(school)validateSchool(school,date(s.start,'school start'),date(s.end,'school end'))
  const week=Object.fromEntries((school?school.cycle:dayNames).map(day=>[day,list((s.week as Obj)[day]??[],`schedule ${day}`,100).map(b=>({fullYear:bool(b.fullYear),slot:optional(b.slot,'block letter',30),dateStart:b.dateStart===undefined?undefined:date(b.dateStart,'class starts'),dateEnd:b.dateEnd===undefined?undefined:date(b.dateEnd,'class ends'),occurrenceNotes:occurrenceNotes(b.occurrenceNotes),completedDates:Array.isArray(b.completedDates)?b.completedDates.map(x=>date(x,'completed occurrence')):[],skippedDates:Array.isArray(b.skippedDates)?b.skippedDates.map(x=>date(x,'skipped occurrence')):[],id:id(b.id,'block ID'),start:clockTime(b.start),end:clockTime(b.end),label:str(b.label,'block label',1000),kind:choice(b.kind,['study','break','routine','hobby'],'study'),subjectId:subject(b.subjectId,profileId),kidId:kidRef(b.kidId,profileId),location:optional(b.location,'location',200)}))]))
  for(const blocks of Object.values(week))for(const block of blocks){if(block.dateStart&&block.dateEnd&&block.dateEnd<block.dateStart)fail('class date range');}
  return {school,category:s.category===undefined?undefined:choice(s.category,['academic','sports'],'academic'),id:id(s.id,'season ID'),profileId,name:str(s.name,'season name',200),start:date(s.start,'season start'),end:date(s.end,'season end'),active:bool(s.active),week}
 })
 const flashcardDecks:FlashcardDeck[]=list(raw.flashcardDecks??[],'flashcard decks',100).map(d=>{
  const title=str(d.title,'deck title',200);if(!title.trim())return fail('deck title')
  const cards=list(d.cards,'flashcards',200).map(c=>{const question=str(c.question,'flashcard question',2000),answer=str(c.answer,'flashcard answer',5000);if(!question.trim()||!answer.trim())return fail('empty flashcard')
   // Cards saved before spaced repetition shipped have none of interval/ease/dueDate -- treat them
   // as due right now (srsInitial), the same "always reviewable" state needsReview:true used to mean.
   const fresh=srsInitial(localDate())
   return {id:id(c.id,'card ID'),question,answer,interval:c.interval===undefined?fresh.interval:nonNegativeInt(c.interval,'card interval'),ease:c.ease===undefined?fresh.ease:easeValue(c.ease),dueDate:c.dueDate===undefined?fresh.dueDate:date(c.dueDate,'card due date'),reviewId:optional(c.reviewId,'review ID',150)}})
  if(!cards.length)return fail('empty deck')
  return {id:id(d.id,'deck ID'),profileId:owner(d.profileId),title,cards}
 })
 const kquizLectures:KQuizLecture[]=list(raw.kquizLectures??[],'lectures',500).map(l=>{
  const profileId=owner(l.profileId),title=str(l.title,'lecture title',300);if(!title.trim())return fail('lecture title')
  const durationSeconds=typeof l.durationSeconds==='number'&&Number.isFinite(l.durationSeconds)?Math.min(Math.max(0,Math.round(l.durationSeconds)),36000):0
  return {id:id(l.id,'lecture ID'),profileId,subjectId:subject(l.subjectId,profileId),title,createdAt:str(l.createdAt,'lecture date',40),durationSeconds,transcript:str(l.transcript??'','transcript',200000)}
 })
 const lectureIds=new Set(kquizLectures.map(l=>l.id)),deckIds=new Set(flashcardDecks.map(d=>d.id))
 const ref=(v:unknown,ids:Set<string>,path:string):string|undefined=>{if(v===undefined)return undefined;const key=str(v,path,150);return ids.has(key)?key:fail(`${path}: unknown reference`)}
 const question=(q:Obj):KQuizQuestion=>{
  const qid=id(q.id,'question ID'),prompt=str(q.prompt,'question prompt',2000)
  if(q.type==='written')return {id:qid,type:'written',prompt,answer:str(q.answer,'written answer',5000)}
  if(q.type!==undefined&&q.type!=='mcq')return fail('question type')
  const choicesInput=q.choices;if(!Array.isArray(choicesInput)||choicesInput.length<2||choicesInput.length>8)return fail('mcq choices')
  const choices=choicesInput.map(c=>str(c,'mcq choice',500))
  const correctIndex=typeof q.correctIndex==='number'&&Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<choices.length?q.correctIndex:fail('mcq correct choice')
  return {id:qid,type:'mcq',prompt,choices,correctIndex}
 }
 const practiceTest=(v:unknown):KQuizPracticeTest|undefined=>{
  if(v===undefined)return undefined
  if(!object(v))return fail('practice test')
  const questions=list(v.questions,'practice questions',100).map(question)
  if(!questions.length)return fail('practice test must have questions')
  return {questions}
 }
 const kquizSets:KQuizSet[]=list(raw.kquizSets??[],'study sets',300).map(s=>{
  const profileId=owner(s.profileId),title=str(s.title,'study set title',300);if(!title.trim())return fail('study set title')
  return {id:id(s.id,'study set ID'),profileId,subjectId:subject(s.subjectId,profileId),lectureId:ref(s.lectureId,lectureIds,'lecture reference'),title,createdAt:str(s.createdAt,'study set date',40),summary:optional(s.summary,'summary',20000),studyGuide:optional(s.studyGuide,'study guide',50000),flashcardDeckId:ref(s.flashcardDeckId,deckIds,'deck reference'),practiceTest:practiceTest(s.practiceTest)}
 })
 const kquizSources:KQuizSource[]=list(raw.kquizSources??[],'notes',1000).map(n=>{
  const profileId=owner(n.profileId),title=str(n.title,'note title',300);if(!title.trim())return fail('note title')
  return {id:id(n.id,'note ID'),profileId,subjectId:subject(n.subjectId,profileId),title,createdAt:str(n.createdAt,'note date',40),text:str(n.text??'','note text',200000)}
 })
 const s=object(raw.settings)?raw.settings:{}
 // A legacy single-choice scheduleView ('all'|'academic'|'sports') migrates into the three
 // independent checkboxes below — appointments always defaults visible, since there was no way
 // to hide personal reminders under the old setting.
 const legacyView=s.scheduleShowAcademic===undefined&&s.scheduleShowSports===undefined?s.scheduleView:undefined
 // Focus (duplicated Simplified) and Office/Journal/Dashboard/Zine/Arcade (retired in favor of one
 // clean Modern experience) no longer exist — carry anyone who had one of them saved over to its
 // closest surviving equivalent rather than silently dropping them back to Cozy.
 const experienceRaw=s.experience==='focus'?'simplified':['office','journal','dashboard','zine','arcade'].includes(String(s.experience))?'modern':s.experience
 const settings:SettingsData={...defaultSettings,experience:choice(experienceRaw,['cozy','simplified','modern','sumi'],s.theme==='professional'?'modern':'cozy'),textSize:choice(s.textSize,['normal','large'],'normal'),density:choice(s.density,['comfortable','compact'],'comfortable'),decoration:bool(s.decoration,true),boardStyle:choice(s.boardStyle,['paper','cork','plain'],'paper'),theme:choice(s.theme,['coral','sakura','lavender','mint','honey','zen','floral','professional','forest','ocean','midnight','paper'],'coral'),sound:bool(s.sound,true),ambient:bool(s.ambient,true),reminders:bool(s.reminders),browserNotifications:bool(s.browserNotifications),loginDigest:bool(s.loginDigest,true),scheduleShowAcademic:bool(s.scheduleShowAcademic,legacyView!=='sports'),scheduleShowSports:bool(s.scheduleShowSports,legacyView!=='academic'),scheduleShowAppointments:bool(s.scheduleShowAppointments,true),parentMode:bool(s.parentMode,kids.length>0),reducedMotion:bool(s.reducedMotion),motionPreference:choice(s.motionPreference,['system','reduced','full'],s.reducedMotion===true?'reduced':'system'),sanctuaryWeather:choice(s.sanctuaryWeather,['clear','cloudy','rain','wind','snow'],'clear'),sanctuaryWeatherMode:choice(s.sanctuaryWeatherMode,['live','manual','clear'],'clear'),sanctuaryZipCodes:stringMap(s.sanctuaryZipCodes),sanctuaryWeatherLocations:stringMap(s.sanctuaryWeatherLocations??s.sanctuaryZipCodes)}
 const progress=object(raw.sanctuaryProgress)?raw.sanctuaryProgress:{}
 for(const value of Object.values(progress))if(object(value)){
  for(const k of ['creditsBySubjectId','creditsBySubjectKey','completionDates'])if(value[k]!==undefined&&(!object(value[k])||Object.values(value[k]).some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0)))fail(`progress ${k}`)
 }
 const sanctuaryProgress=Object.fromEntries(profiles.map(p=>{const saved=progress[p.id];const timestamp=object(saved)&&typeof saved.updatedAt==='string'&&Number.isFinite(Date.parse(saved.updatedAt))?saved.updatedAt:'1970-01-01T00:00:00.000Z';return [p.id,migrateSanctuaryProgress(saved,p.id,tasks.map(t=>({...t,subjectKey:subjects.find(x=>x.id===t.subjectId)?.name??t.subjectId})),timestamp)]}))
 const decor=object(raw.sanctuaryDecor)?raw.sanctuaryDecor:{}
 const placement=(v:Obj):BuildPlacement=>({id:id(v.id,'placement ID'),assetId:str(v.assetId,'placement asset',100),x:placementCoord(v.x),y:placementCoord(v.y),rotation:([0,90,180,270] as const).includes(v.rotation as 0)?v.rotation as 0|90|180|270:0,scale:placementScale(v.scale),skewX:placementSkew(v.skewX),flipX:bool(v.flipX),text:optional(v.text,'sign text',120),textSize:textSize(v.textSize),textColor:v.textColor===undefined?undefined:color(v.textColor,'#4b342a'),textFont:v.textFont===undefined?undefined:choice(v.textFont,['hand','serif','sans'],'hand')})
 // Home/pond/tree used to be one singular style slot each, with its own dedicated picker — now
 // every home/pond/tree is just another duplicable placement in the shared palette. A save from
 // before that change migrates its one chosen style (if any) into an ordinary placement the first
 // time it's opened, landing at the same ground spot its old picker used to default a style to
 // when nobody had dragged it yet.
 const LEGACY_STYLE_GROUND:Record<'home'|'pond'|'tree',{x:number;y:number}>={home:{x:0.2417,y:0.6906},pond:{x:0.5076,y:0.7366},tree:{x:0.4862,y:0.2505}}
 const migrateLegacyStyle=(d:Obj,feature:'home'|'pond'|'tree'):BuildPlacement[]=>{
  const styleId=d[`${feature}Style`]
  if(styleId==null||typeof styleId!=='string'||!styleId.trim())return []
  const ground=LEGACY_STYLE_GROUND[feature]
  const legacyX=nullableFraction(d[`${feature}StyleX`]),legacyY=nullableFraction(d[`${feature}StyleY`])
  return [{id:uid('placement'),assetId:`${feature}-${str(styleId,`${feature} style`,100)}`,x:legacyX==null?ground.x:placementCoord(legacyX),y:legacyY==null?ground.y:placementCoord(legacyY),rotation:0,scale:placementScale(d[`${feature}StyleScale`]),skewX:0,flipX:bool(d[`${feature}StyleFlipX`])}]
 }
 const sanctuaryDecor:Record<string,SanctuaryDecorState>=Object.fromEntries(profiles.map(p=>{
  const d=object(decor[p.id])?decor[p.id] as Obj:{}
  const placements=[...list(d.placements??[],'placements',300).map(placement),...migrateLegacyStyle(d,'home'),...migrateLegacyStyle(d,'pond'),...migrateLegacyStyle(d,'tree')]
  return [p.id,{profileId:p.id,placements}]
 }))
 const activeProfileId=typeof raw.activeProfileId==='string'&&pids.has(raw.activeProfileId)?raw.activeProfileId:profiles[0].id
 const trash:TrashEntry[]=list(raw.trash??[],'trash',2000).map(t=>({id:id(t.id,'trash ID'),profileId:owner(t.profileId),collection:choice(t.collection,['tasks','notes','exams','calendarEvents','subjects','kids','studyPlans','flashcardDecks','kquizSets','kquizSources','studySeasons','scheduleBlocks'],'notes'),title:str(t.title,'trash title',1000),payload:str(t.payload,'trash payload',1000000),deletedAt:str(t.deletedAt,'deleted at',40)}))
 return {schemaVersion:6,trash,profiles,activeProfileId,subjects,kids,tasks,exams,notes,calendarEvents,studySeasons,studyPlans,flashcardDecks,kquizLectures,kquizSets,kquizSources,settings,sanctuaryProgress,sanctuaryDecor,onboardingComplete:bool(raw.onboardingComplete,true)}
}

export function assertProfileWrite(before:AppData,after:AppData,profileId:string):AppData {
 if(before.activeProfileId!==profileId)return before
 if(JSON.stringify(before.profiles)!==JSON.stringify(after.profiles)||JSON.stringify(before.settings)!==JSON.stringify(after.settings)||after.activeProfileId!==before.activeProfileId)throw new Error('This editor cannot change account settings or another plan.')
 for(const profile of before.profiles)if(profile.id!==profileId&&JSON.stringify(before.sanctuaryProgress[profile.id])!==JSON.stringify(after.sanctuaryProgress[profile.id]))throw new Error('This edit belongs to another plan.')
 for(const profile of before.profiles)if(profile.id!==profileId&&JSON.stringify(before.sanctuaryDecor[profile.id])!==JSON.stringify(after.sanctuaryDecor[profile.id]))throw new Error('This edit belongs to another plan.')
 for(const key of ['subjects','kids','tasks','notes','exams','calendarEvents','studySeasons','studyPlans','flashcardDecks','kquizLectures','kquizSets','kquizSources','trash'] as const){
  const oldOther=before[key].filter(r=>r.profileId!==profileId)
  const newOther=after[key].filter(r=>r.profileId!==profileId)
  if(JSON.stringify(oldOther)!==JSON.stringify(newOther))throw new Error('This edit belongs to a different profile. Reopen the editor and try again.')
 }
 return after
}
