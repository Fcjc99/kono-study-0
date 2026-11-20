import type {ReactNode,SetStateAction} from 'react'
import './settings-page.css'
import type {AppData} from '../store/model'
import type {usePlannerRepository} from '../store/repository'
import {deleteProfile} from '../store/deleteProfile'
import {downloadData} from '../store/localRepository'
import {APP_VERSION} from '../version'
import type {SettingsTab} from '../workspaceShared'
import Icon from '../components/Icon'
import {lazyPanel} from '../lazyPanel'
import {ScheduleSetup} from './sharedPanels'
import type * as Screens from '../WorkspaceSettings'
import type {PageContext} from './pageContext'
type SettingsProps={data:AppData;setData:(action:SetStateAction<AppData>)=>Promise<boolean>}
type StoreProps={store:ReturnType<typeof usePlannerRepository>}
type PropsOf<K extends keyof typeof Screens>=Parameters<(typeof Screens)[K]>[0]
/** The family settings and Look & feel load the first time they're shown. */
const screen=<K extends 'FamilySettings'|'FamilyReminderSettings'|'TeamColors'|'Appearance'>(name:K)=>lazyPanel<PropsOf<K>>(()=>import('../WorkspaceSettings').then(m=>({default:m[name] as unknown as (props:PropsOf<K>)=>ReactNode})))
const FamilySettings=screen('FamilySettings'),FamilyReminderSettings=screen('FamilyReminderSettings'),TeamColors=screen('TeamColors'),Appearance=screen('Appearance')
const PlanSettings=lazyPanel<SettingsProps&{onDeleteProfile?:(id:string)=>void}>(()=>import('../SettingsPanels').then(m=>({default:m.PlanSettings})))
const SoundMotionSettings=lazyPanel<SettingsProps>(()=>import('../SettingsPanels').then(m=>({default:m.SoundMotionSettings})))
const ReminderSettings=lazyPanel<SettingsProps>(()=>import('../SettingsPanels').then(m=>({default:m.ReminderSettings})))
const AccountPanel=lazyPanel<StoreProps>(()=>import('../components/AccountSettings').then(m=>({default:m.AccountPanel})))
const BackupPanel=lazyPanel<StoreProps>(()=>import('../components/AccountSettings').then(m=>({default:m.BackupPanel})))
const SupportAdminPanel=lazyPanel<StoreProps>(()=>import('../components/AccountSettings').then(m=>({default:m.SupportAdminPanel})))
const FeedbackButton=lazyPanel<StoreProps>(()=>import('../components/AccountSettings').then(m=>({default:m.FeedbackButton})))
const AiHelperSettings=lazyPanel<{profileId:string}>(()=>import('../components/AiHelper').then(m=>({default:m.AiHelperSettings})))
const ProfileCard=lazyPanel(()=>import('../components/ProfileCard'))
const FamilyShareLink=lazyPanel(()=>import('../components/FamilyShareLink'),null)
const SettingsSearch=lazyPanel(()=>import('../components/SettingsSearch'),null)
const AddFromSiri=lazyPanel(()=>import('../components/AddFromSiri'))
const PushSettings=lazyPanel(()=>import('../components/PushSettings'))
const CalendarSubscribe=lazyPanel(()=>import('../components/CalendarSubscribe'))
const ScheduleShare=lazyPanel(()=>import('../components/ScheduleShare'))
const PeerConnections=lazyPanel(()=>import('../components/PeerConnections'))

export default function SettingsPage({w}:{w:PageContext}){
 const {store,lockedPlan,releaseLabel,setSettingsTab,settingsTab,data,setting,profile,islandSetting,run,save,simpleView,openWeather,parentMode,patch,navigate,draftScope,repository,openAdd,setConfirmation,reduced}=w
 return <>{lockedPlan&&<section className="wb-panel"><h2>Settings are locked</h2><p>This device is set to one plan. A parent can unlock it from the plan button at the top.</p></section>}
   {!lockedPlan&&<div className="settings-groups">{settingsTab==='Overview'&&<SettingsSearch onOpen={(tab,find)=>{setSettingsTab(tab);window.setTimeout(()=>{const el=[...document.querySelectorAll('#workspace-main :is(h2,h3,legend,summary,label,strong)')].find(e=>e.textContent?.toLowerCase().includes(find));const fold=el?.closest('details');if(fold)fold.open=true;el?.scrollIntoView({block:'center',behavior:'smooth'});(el as HTMLElement|undefined)?.classList.add('settings-found');window.setTimeout(()=>(el as HTMLElement|undefined)?.classList.remove('settings-found'),1800)},350)}}/>}{settingsTab==='Overview'?<SettingsList w={w}/>:<div className="settings-section-top"><button type="button" className="settings-back" onClick={()=>setSettingsTab('Overview')}><Icon name="chevron" size={18}/> All settings</button><h2 className="settings-section-title">{settingsTab}</h2></div>}
   {settingsTab==='Look & feel'&&<><section className="wb-panel"><Appearance settings={data.settings} setting={setting}/></section><section className="wb-panel island-setting"><h2>Island &amp; KONO</h2><p className="wb-muted">For {profile.label}. Each plan can choose its own. Nothing is deleted: turning the island back on brings everything back.</p><div className="island-choice" role="group" aria-label="Island and KONO">{([['full','🏝️','Island and KONO','The whole island, KONO, snacks, stickers and Decorate.'],['kono','🐾','Just KONO','No island picture. KONO stays in a card on Home.'],['off','📋','Off','A plain planner: no island and no KONO.']] as const).map(([mode,icon,label,note])=><button type="button" key={mode} aria-pressed={islandSetting===mode} onClick={()=>void run(()=>save(d=>({...d,profiles:d.profiles.map(p=>p.id===profile.id?{...p,island:mode==='full'?undefined:mode}:p)})),mode==='full'?'The island is back.':mode==='kono'?'Just KONO on Home now.':'Island and KONO turned off for this plan.')}><span aria-hidden="true">{icon}</span><strong>{label}</strong><small>{note}</small></button>)}</div><label className="wb-check simple-view-toggle"><input type="checkbox" checked={simpleView} onChange={e=>{const on=e.target.checked;void run(()=>save(d=>({...d,profiles:d.profiles.map(p=>p.id===profile.id?{...p,simpleView:on||undefined}:p)})),on?'Simple view on: bigger text, fewer buttons.':'Simple view off.')}}/><span><strong>Simple view</strong> · bigger text and fewer buttons (just Home, Planner and Notes). Made for kids.</span></label>{islandSetting==='full'&&<p className="island-weather-link wb-muted"><strong>Sanctuary weather</strong> (live, manual or clear) is set on the island, from the weather button next to KONO. <button type="button" className="link-button" onClick={openWeather}>Open Sanctuary weather</button></p>}</section><section className="wb-panel"><h2>Sound &amp; motion</h2><SoundMotionSettings data={data} setData={save}/></section><TeamColors settings={data.settings} setting={setting}/></>}
   {settingsTab==='Notifications'&&<section className="wb-panel"><h2>Notifications</h2><PushSettings store={store}/>{parentMode&&<FamilyReminderSettings data={data} setting={setting}/>}{islandSetting!=='off'&&<section className="card settings-list kono-note-settings"><h3>KONO</h3><label><div><strong>KONO’s notes</strong><small>A lock-screen note at 4:30 PM when KONO is getting hungry or misses you, at most once a day. Comes with lock-screen reminders above.</small></div><input type="checkbox" checked={data.settings.konoNotes!==false} onChange={e=>void setting('konoNotes',e.target.checked)}/></label></section>}<ReminderSettings data={data} setData={save}/></section>}
   {settingsTab==='Family'&&<FamilySettings data={data} setting={setting} patch={patch} navigate={navigate}/>}
   {settingsTab==='Family'&&<FamilyShareLink store={store} profileId={profile.id}/>}
   {settingsTab==='Schedules'&&<section className="wb-panel"><ScheduleSetup data={data} save={save} draftKey={draftScope} fetchCatalog={repository.fetchSchoolCatalog} submitCatalogEntry={repository.submitSchoolCatalogEntry}/></section>}
   {settingsTab==='KONO support'&&store.isAdmin&&!store.support&&<section className="wb-panel"><SupportAdminPanel store={store}/></section>}
      {settingsTab==='Import & export'&&<section className="wb-panel"><h2>Import &amp; export</h2><BackupPanel store={store}/><div className="wb-notice add-moved"><p><strong>Adding schedules and calendars</strong> (photos, PDFs, calendar links, Canvas and Classroom) now all start from the Planner.</p><button type="button" className="primary" onClick={()=>openAdd()}>＋ Add a schedule</button></div><details><summary>Share a schedule with someone else</summary><ScheduleShare data={data} save={save}/></details><details><summary>Show KONO in Google Calendar or Apple Calendar (stays up to date)</summary><CalendarSubscribe store={store} profileId={profile.id} planLabel={profile.label}/></details><details><summary>Export to your calendar app</summary><p>Download every assignment, exam and event in {profile.label} as a calendar file, then import or add it in Google Calendar, Apple Calendar, or Outlook. This is a one-time snapshot -- re-download it after making big changes to keep your calendar app in sync.</p><button type="button" onClick={()=>void import('../store/icsExport').then(({buildIcs})=>downloadData(buildIcs(data,profile.id),(profile.label||'kono-plan').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.ics','text/calendar'))}>Download calendar (.ics)</button></details></section>}
   {settingsTab==='Import & export'&&<section className="wb-panel"><h2>Helpers</h2><details className="settings-group"><summary>Add homework with Siri <small>or from the share sheet on Android</small></summary><AddFromSiri/></details><details id="ai-helper" className="settings-group"><summary>AI helper <small>for K-Quiz, the photo scanner and schedule reading</small></summary><AiHelperSettings profileId={profile.id}/></details></section>}
   {settingsTab==='Plans & account'&&<><ProfileCard key={profile.id} profile={profile} onSave={patch=>void run(()=>save(d=>({...d,profiles:d.profiles.map(p=>p.id===profile.id?{...p,...patch}:p)})),'Profile saved.')}/><section className="wb-panel"><AccountPanel store={store}/></section><section className="wb-panel"><h2>Plans</h2><PlanSettings data={data} setData={save} onDeleteProfile={id=>{const p=data.profiles.find(x=>x.id===id);if(!p)return;setConfirmation({text:'Delete plan “'+p.label+'” and all its subjects, assignments, notes, schedules and Sanctuary progress? This does not delete your account or other plans. Export a backup first. Plan deletion is not kept in Trash.',action:()=>void run(()=>save(d=>deleteProfile(d,id)),'Plan deleted. Other plans were kept.')})}}/></section><section className="wb-panel"><h2>Friends</h2>{store.user?<PeerConnections repository={repository} myUserId={store.user.id} reducedMotion={reduced}/>:<p>Sign in with a KONO account to connect with classmates and share your classes.</p>}</section></>}
   {/* The version and Send feedback close the page (they used to sit above everything else). */}
   {settingsTab==='Overview'&&<div className="wb-section-head settings-page-tools"><small>Version {APP_VERSION} · Build {releaseLabel}</small><FeedbackButton store={store}/></div>}
   </div>}</>
}

/** Settings' first screen: who you are, then each section as a row that says what's set; a row opens that
 * section alone (with ‹ All settings to come back). */
function SettingsList({w}:{w:PageContext}){
 const {data,store,profile,setSettingsTab,parentMode,islandSetting}=w
 const st=data.settings
 const kids=data.kids.filter(k=>k.profileId===data.activeProfileId).length
 const summary:Record<string,string>={
  'Look & feel':[st.experience?st.experience[0].toUpperCase()+st.experience.slice(1):'Cozy',st.darkMode==='dark'?'Dark':st.darkMode==='light'?'Light':'Auto dark',islandSetting==='full'?'Island on':islandSetting==='kono'?'Just KONO':'No island'].join(' · '),
  'Notifications':st.browserNotifications?'On':'Off',
  'Family':parentMode?kids+' kid'+(kids===1?'':'s'):'Off',
  'Schedules':data.studySeasons.filter(x=>x.profileId===profile.id).length+' schedule'+(data.studySeasons.filter(x=>x.profileId===profile.id).length===1?'':'s'),
  'Import & export':'Backups, sharing, helpers',
  'Plans & account':data.profiles.length+' plan'+(data.profiles.length===1?'':'s'),
  'KONO support':'Admin',
 }
 const icon:Record<string,string>={'Look & feel':'palette','Notifications':'bell','Family':'family','Schedules':'school','Import & export':'transfer','Plans & account':'user','KONO support':'info'}
 const groups:SettingsTab[][]=[['Look & feel','Notifications'],['Family','Schedules','Import & export'],['Plans & account',...(store.isAdmin&&!store.support?['KONO support' as const]:[])]]
 return <>
  <button type="button" className="wb-panel settings-me" onClick={()=>setSettingsTab('Plans & account')}><span className="settings-me-face" aria-hidden="true">{(profile.name||'?').trim().charAt(0).toUpperCase()}</span><span><b>{profile.name||'You'}</b><small>{store.user?.email?store.user.email+' · synced':'Saved on this device'}</small></span><Icon name="chevron" size={18}/></button>
  <nav className="settings-list-nav" aria-label="Settings sections">{groups.map((g,i)=><div className="wb-panel settings-rows" key={i}>{g.map(tab=><button type="button" key={tab} aria-label={tab} onClick={()=>setSettingsTab(tab)}><span className="settings-row-icon"><Icon name={icon[tab]} size={20}/></span><b>{tab}</b><small>{summary[tab]}</small><Icon name="chevron" size={16}/></button>)}</div>)}</nav>
 </>
}
