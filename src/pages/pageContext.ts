import type {Dispatch,ReactElement,RefObject,SetStateAction} from 'react'
import type {usePlannerRepository} from '../store/repository'
import type {AppData,IslandMode,Kid,Note,Profile,SettingsData,StudyPlan,Subject,Task} from '../store/model'
import type {Collection,Entry} from '../store/workspace'
import type {ClassOccurrence} from '../store/classSchedule'
import type {WeekRecap} from '../store/weekRecap'
import type {AddChoice,AddChoiceId} from '../components/AddToCalendar'
import type {QuickFamilyPayload} from '../WorkspaceSettings'
import type {TodoOps} from '../components/TodoEditor'
import type {Page,SettingsTab} from '../workspaceShared'

type Store=ReturnType<typeof usePlannerRepository>
type SetState<T>=Dispatch<SetStateAction<T>>

/** What the on-demand pages (Planner, Subjects, Notes, K-Quiz, Exams, Settings, Trash) use from the
 * Workspace. The Workspace keeps owning every piece of state, so a page keeps its place between visits. */
export type PageContext={
 store:Store
 repository:Store['repository']
 data:AppData
 view:AppData
 profile:Profile
 experience:NonNullable<SettingsData['experience']>
 islandSetting:IslandMode
 simpleView:boolean
 parentMode:boolean
 reduced:boolean
 lockedPlan:string
 releaseLabel:string
 draftScope:string
 today:string
 tasks:Task[]
 viewTasks:Task[]
 ownTasks:Task[]
 notes:Note[]
 subjects:Subject[]
 profileKids:Kid[]
 plans:StudyPlan[]
 recap:WeekRecap|null
 classmatesOn:boolean
 peopleFilter:ReactElement|null
 overdueCard:ReactElement
 addChoices:AddChoice[]
 plannerMoreRef:RefObject<HTMLDetailsElement|null>
 // State the Workspace keeps across page switches.
 subject:string;setSubject:SetState<string>
 subjectTab:string;setSubjectTab:SetState<string>
 boardView:string;setBoardView:SetState<string>
 selectedDate:string;setSelectedDate:SetState<string>
 settingsTab:SettingsTab;setSettingsTab:SetState<SettingsTab>
 addOpen:boolean
 addChoice:AddChoiceId|null;setAddChoice:SetState<AddChoiceId|null>
 recapOpen:boolean;setRecapOpen:SetState<boolean>
 weekPlanOpen:boolean;setWeekPlanOpen:SetState<boolean>
 planRequest:number;setPlanRequest:SetState<number>
 setSpecialOpen:SetState<boolean>
 setPickupsOpen:SetState<boolean>
 setWallOpen:SetState<boolean>
 setDayOffFor:SetState<string|null>
 setConfirmation:SetState<{text:string;action:()=>void}|null>
 // Actions.
 save:(action:SetStateAction<AppData>,options?:{undoable?:boolean})=>Promise<boolean>
 run:(action:()=>Promise<boolean>,success:string,undo?:boolean,snackFor?:string)=>Promise<void>
 setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>
 navigate:(next:Page)=>void
 openSettings:(tab:SettingsTab)=>void
 openAdd:(choice?:AddChoiceId|null)=>void
 closeAdd:()=>void
 openWeather:()=>void
 create:(key:Collection,date?:string,subjectId?:string,seed?:Partial<Entry>)=>void
 edit:(key:Collection,entry:Entry)=>void
 remove:(key:Collection,entry:Entry)=>void
 patch:(key:Collection,entry:Entry,changes:Partial<Entry>)=>Promise<void>
 reschedule:(key:Collection,entry:Entry,date:string)=>void
 planAt:(key:Collection,entry:Entry,day:string,time:string)=>void
 stretchTo:(key:Collection,entry:Entry,end:string)=>void
 quickAddFamilyEvent:(date:string,payload:QuickFamilyPayload)=>Promise<boolean>
 todoOps?:TodoOps
 personShown:(x?:unknown)=>boolean
 card:(key:Collection,entry:Entry,compact?:boolean)=>ReactElement
 renderClass:(item:ClassOccurrence)=>ReactElement
 renderCompactClass:(item:ClassOccurrence)=>ReactElement
}
