import {useState,type CSSProperties,type FormEvent} from 'react'
import Modal from './components/Modal'
import {notificationsSupported} from './hooks/useDueNotifications'
import {KID_COLORS} from './store/kids'
import {localDate,type AppData,type CalendarEventKind,type Kid,type KidBorderStyle,type SettingsData} from './store/model'
import {classKid,classOccurrences,classTime} from './store/classSchedule'
import {rotationNow} from './store/rotationToday'
import type {Collection,Entry} from './store/workspace'
import {TEAM_THEMES,teamThemeIds} from './teamThemes'
import {cozyPalette,cozyPalettes,experienceOptions,fixedPaletteExperiences,type Page,type SettingsTab} from './workspaceShared'

/* The Kids page, the family settings and Look & feel (experience, palettes, team colors). These load
 * the first time one of them is shown, so they stay out of KONO's startup download. */
function ExperienceIcon({id}:{id:string}){return <span className="theme-picker-glyph" aria-hidden="true">{experienceOptions.find(o=>o.id===id)?.glyph??'✦'}</span>}
const QUICK_KIND_OPTIONS=[['sports','Sports'],['lesson','Lesson'],['appointment','Appointment'],['work','Work'],['personal','Event']] as const
// The fast path parent mode promises: kid, type, a short title and an optional time -- no subject
// picker, notes, voice input or multi-date repeat. Saves straight to calendarEvents (see
// quickAddFamilyEvent) rather than opening the full EntryEditor.
export function QuickFamilyAdd({kids,time:startAt,onCancel,onSave}:{kids:Kid[];time?:string;onCancel:()=>void;onSave:(payload:{title:string;kind:CalendarEventKind;kidId?:string;time?:string;endTime?:string})=>Promise<void>}){
 const [title,setTitle]=useState(''),[kidId,setKidId]=useState(kids[0]?.id??''),[kind,setKind]=useState<CalendarEventKind>('appointment'),[time,setTime]=useState(startAt??''),[endTime,setEndTime]=useState(startAt?String(Math.min(23,Number(startAt.slice(0,2))+1)).padStart(2,'0')+startAt.slice(2):''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy||!title.trim())return
  setBusy(true);setError('')
  try{await onSave({title:title.trim(),kind,kidId:kidId||undefined,time:time||undefined,endTime:endTime||undefined})}catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}
 }
 return <form onSubmit={submit} className="quick-family-add"><fieldset disabled={busy}>
  <label>Kid<select autoFocus value={kidId} onChange={e=>setKidId(e.target.value)}><option value="">Whole family</option>{kids.map(k=><option key={k.id} value={k.id}>{(k.emoji?k.emoji+' ':'')+k.name}</option>)}</select></label>
  <label>Type<select value={kind} onChange={e=>setKind(e.target.value as CalendarEventKind)}>{QUICK_KIND_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  <label>What is it?<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Soccer practice, Dentist, Work shift…"/></label>
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
export function FamilySettings({data,setting,patch,navigate}:{data:AppData;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>;patch:(key:Collection,entry:Entry,changes:Partial<Entry>)=>Promise<void>;navigate:(page:Page)=>void}){
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
export function FamilyReminderSettings({data,setting}:{data:AppData;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>}){
 const notifyOn=Boolean(data.settings.browserNotifications)&&notificationsSupported()&&Notification.permission==='granted'
 return <section className="card settings-list family-reminder-settings"><h3>Family</h3>
  <label><div><strong>Kids' event reminders</strong><small>Remind me 15 minutes before a kid's event starts or ends. {notifyOn?'Notifications are labeled with each kid\'s name.':'Turn on Browser notifications above to use this.'}</small></div><input type="checkbox" disabled={!notifyOn} checked={Boolean(data.settings.familyEventReminders)} onChange={e=>void setting('familyEventReminders',e.target.checked)}/></label>
 </section>
}
export function KidsPage({data,create,edit,remove,patch,openSettings}:{openSettings:(tab:SettingsTab)=>void;data:AppData;create:(key:Collection)=>void;edit:(key:Collection,entry:Entry)=>void;remove:(key:Collection,entry:Entry)=>void;patch:(key:Collection,entry:Entry,changes:Partial<Entry>)=>Promise<void>}){
 const [appearanceOpen,setAppearanceOpen]=useState(false)
 const kids=data.kids.filter(k=>k.profileId===data.activeProfileId)
 return <section className="wb-panel family-calendar">
  <div className="wb-section-head"><div><small>ONE SHARED CALENDAR</small><h2>Kids</h2></div><div className="wb-toolbar"><button type="button" onClick={()=>setAppearanceOpen(true)}>🎨 Appearance</button><button onClick={()=>create('kids')}>＋ Add a kid</button></div></div>
  <p className="wb-muted">Add each kid once, then tag any assignment, exam, class or event with them from its own editor and filter your Planner calendar by kid — the same way you already filter by subject. Pick their emoji and color under Appearance.</p>
  {kids.length>0&&<ul className="kid-roster" aria-label="Kids">
   {kids.map(k=><li key={k.id} style={{'--kid-color':k.color} as CSSProperties}><KidAvatar kid={k}/><strong>{k.name}</strong><button type="button" onClick={()=>edit('kids',k as unknown as Entry)}>Edit</button><button type="button" className="kid-roster-remove" aria-label={'Move '+k.name+' to Trash'} title="Move to Trash" onClick={()=>remove('kids',k as unknown as Entry)}>🗑</button></li>)}
  </ul>}
  {kids.length>0&&<KidsToday data={data} kids={kids} openSchedules={()=>openSettings('Schedules')}/>}
  {!kids.length&&<p className="wb-muted">No kids added yet. Add one to start tagging their assignments, exams, classes and events on your calendar.</p>}
  <p className="wb-muted">Reminders for your kids' events, and the family-wide look switches, live in Settings: <button type="button" className="link-button" onClick={()=>openSettings('Notifications')}>Notifications</button> · <button type="button" className="link-button" onClick={()=>openSettings('Family')}>Family</button></p>
  {appearanceOpen&&<KidAppearancePanel data={data} patch={patch} close={()=>setAppearanceOpen(false)}/>}
 </section>
}
// A dedicated page for how kids look on their tiles, kept separate from the plain add/edit-kid form
// (see EntryEditor) and from the general Settings/Appearance page (theme, text size) -- both of those
// are used by every profile, including a solo student's own personal plan with no kids at all, and
// this one is reached only from the Kids page, itself hidden unless parent mode is on. One kid at a
// time (tabs along the top), so the panel stays short however many kids there are.
function KidAppearancePanel({data,patch,close}:{data:AppData;patch:(key:Collection,entry:Entry,changes:Partial<Entry>)=>Promise<void>;close:()=>void}){
 const kids=data.kids.filter(k=>k.profileId===data.activeProfileId)
 const [selectedId,setSelectedId]=useState(kids[0]?.id)
 const kid=kids.find(k=>k.id===selectedId)??kids[0]
 return <Modal title="Kids' appearance" close={close}>
  <div className="kid-look">
   <p className="wb-muted">How each kid's events look in the Planner and on the Sanctuary. Changes save as you go.</p>
   {!kid&&<p className="wb-muted">Add a kid first (close this and use "＋ Add a kid"), then come back here to pick how they look.</p>}
   {kids.length>1&&<div className="kid-look-tabs" role="tablist" aria-label="Kids">{kids.map(k=><button type="button" role="tab" key={k.id} id={'kid-look-tab-'+k.id} aria-controls="kid-look-editor" aria-selected={k.id===kid?.id} className="kid-look-tab" style={{'--kid-color':k.color} as CSSProperties} onClick={()=>setSelectedId(k.id)}><KidAvatar kid={k}/>{k.name}</button>)}</div>}
   {kid&&<KidAppearanceEditor key={kid.id} kid={kid} patch={patch} tabbed={kids.length>1}/>}
  </div>
 </Modal>
}
const KidAvatar=({kid}:{kid:Kid})=><span className="kid-look-avatar" style={{'--kid-color':kid.color} as CSSProperties} aria-hidden="true">{kid.emoji||kid.name.trim().charAt(0).toUpperCase()||'?'}</span>
const BORDER_STYLE_OPTIONS:[KidBorderStyle,string][]=[['solid','Classic'],['bold','Bold'],['stripe','Stripe'],['soft','Soft'],['dashed','Dashed'],['dotted','Dotted'],['double','Double'],['glow','Glow']]
function KidAppearanceEditor({kid,patch,tabbed}:{kid:Kid;patch:(key:Collection,entry:Entry,changes:Partial<Entry>)=>Promise<void>;tabbed:boolean}){
 const [customEmoji,setCustomEmoji]=useState('')
 const borderStyle=kid.borderStyle??'solid'
 const change=(changes:Partial<Kid>)=>void patch('kids',kid as unknown as Entry,changes as Partial<Entry>)
 const customColor=!(KID_COLORS as readonly string[]).includes(kid.color)
 const applyEmoji=()=>{const e=customEmoji.trim();if(!e)return;change({emoji:e});setCustomEmoji('')}
 return <div id="kid-look-editor" className="kid-look-editor" style={{'--kid-color':kid.color} as CSSProperties} {...(tabbed?{role:'tabpanel','aria-labelledby':'kid-look-tab-'+kid.id}:{})}>
  <div className={'wb-family-event kid-border-'+borderStyle+' kid-look-preview'} aria-label={kid.name+"'s tile preview"} role="img"><div className="wb-family-event-main"><div className="wb-family-event-time"><span className="wb-family-event-start">3:30 PM</span><span className="wb-family-event-end">–5:00 PM</span></div><div className="wb-family-event-info"><small>{(kid.emoji?kid.emoji+' ':'')+kid.name}</small><h3>Soccer practice</h3></div></div></div>
  <h3 className="kid-look-label">Emoji</h3>
  <form className="kid-look-emoji" onSubmit={e=>{e.preventDefault();applyEmoji()}}>
   <KidAvatar kid={kid}/>
   <input aria-label={kid.name+"'s emoji"} maxLength={40} placeholder={kid.emoji?'Type or paste a new one':'Type or paste an emoji'} value={customEmoji} onChange={ev=>setCustomEmoji(ev.target.value)}/>
   <button type="submit" disabled={!customEmoji.trim()}>Use</button>
  </form>
  {kid.emoji&&<button type="button" className="kid-look-link" onClick={()=>change({emoji:undefined})}>Remove emoji</button>}
  <h3 className="kid-look-label">Color</h3>
  <div className="kid-look-colors" role="radiogroup" aria-label={kid.name+"'s color"}>
   {KID_COLORS.map(c=><button type="button" role="radio" key={c} className="kid-look-color" aria-checked={kid.color===c} aria-label={c} style={{'--swatch':c} as CSSProperties} onClick={()=>change({color:c})}/>)}
   <label className={'kid-look-color kid-look-color-custom'+(customColor?' is-picked':'')} style={customColor?{'--swatch':kid.color} as CSSProperties:undefined} title="Pick any color"><input type="color" aria-label={'Custom color for '+kid.name} value={kid.color} onChange={e=>change({color:e.target.value})}/></label>
  </div>
  <h3 className="kid-look-label">Border</h3>
  <div className="kid-look-borders" role="radiogroup" aria-label={kid.name+"'s border style"}>
   {BORDER_STYLE_OPTIONS.map(([value,label])=><button type="button" role="radio" key={value} className="kid-look-border" aria-checked={borderStyle===value} onClick={()=>change({borderStyle:value})}><span className={'kid-look-border-sample kid-border-'+value} aria-hidden="true"/>{label}</button>)}
  </div>
 </div>
}
/** Look & feel › Team colors: school and team palettes. They work in Cozy and Simplified, so picking one
 * from Modern or Zen Ink (which have their own fixed colors) switches to Cozy. */
export function TeamColors({settings,setting}:{settings:SettingsData;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>}){
 const fixed=fixedPaletteExperiences.includes(settings.experience??'cozy')
 const pick=async(id:string)=>{if(fixed&&!await setting('experience','cozy'))return;await setting('theme',id)}
 return <><h2>Team colors</h2><p>Show your school or team colors across KONO: the sidebar, buttons, headers and the top bar on your phone. They work with the Cozy and Simplified looks{fixed?'; picking one switches you to Cozy':''}.</p>
  <div className="team-color-grid" role="group" aria-label="Team colors">{TEAM_THEMES.map(t=><button key={t.id} type="button" aria-pressed={!fixed&&settings.theme===t.id} onClick={()=>void pick(t.id)}><span className={'team-swatch theme-'+t.id} aria-hidden="true"/><strong>{t.label}{!fixed&&settings.theme===t.id?' ✓':''}</strong><small>{t.note}</small></button>)}</div>
  <p className="wb-muted">To go back to a regular palette, pick one under Color palette above.</p></>
}
export function Appearance({settings,setting}:{settings:SettingsData;setting:<K extends keyof SettingsData>(key:K,value:SettingsData[K])=>Promise<boolean>}){
 const activePalette=settings.experience==='cozy'?cozyPalette(settings.theme):settings.theme
 const paletteLabel=(theme:string)=>({coral:'Coral · Colorful',sakura:'Sakura · Colorful',lavender:'Lavender Dream',mint:'Mint Study',honey:'Honey Desk',zen:'Zen Garden · Minimal',floral:'Floral Chic',ocean:'Ocean Breeze · Beachy',professional:'Professional · Muted',...Object.fromEntries(TEAM_THEMES.map(t=>[t.id,t.label]))}[theme]??theme[0].toUpperCase()+theme.slice(1))
 const active=settings.experience??'cozy'
 const swatch=(t:string)=>{const [name,note]=paletteLabel(t).split(' · ');return <button className={'theme-'+t} key={t} aria-pressed={activePalette===t} onClick={()=>void setting('theme',t)}><span/><strong>{name}</strong>{note&&<small>{note}</small>}</button>}
 const activeOption=experienceOptions.find(o=>o.id===active)
 return <section className="wb-panel"><h2>Choose your KONO experience</h2><div className="theme-picker-grid">{experienceOptions.map(option=><button key={option.id} type="button" className={'theme-picker-tile experience-'+option.id} aria-pressed={active===option.id} title={option.description} onClick={()=>void setting('experience',option.id)}><ExperienceIcon id={option.id}/><strong>{option.title}</strong></button>)}</div>{activeOption&&<p className="theme-picker-description">{activeOption.description}</p>}{!fixedPaletteExperiences.includes(settings.experience??'cozy')&&<><h3>Color palette</h3><div className="wb-themes">{(settings.experience==='cozy'?cozyPalettes:['coral','sakura','professional','forest','ocean','midnight','paper']).map(swatch)}</div>{teamThemeIds.includes(settings.theme)&&<p className="wb-muted">You’re using team colors. Pick a palette here to switch back, or change teams under Team colors below.</p>}</>}
  <h3>Dark mode</h3><div className="dark-mode-choice" role="group" aria-label="Dark mode">{([['light','☀️ Light'],['phone','📱 Match my phone'],['dark','🌙 Dark']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={(settings.darkMode??'phone')===id} onClick={()=>void setting('darkMode',id)}>{label}</button>)}</div>
  <p className="wb-muted">“Match my phone” turns dark when your phone or computer is set to dark mode (on iPhone: Settings › Display &amp; Brightness).</p>
  <div className="wb-form-grid"><label>Text size<select value={settings.textSize??'normal'} onChange={e=>void setting('textSize',e.target.value as SettingsData['textSize'])}><option value="normal">Normal</option><option value="large">Large</option></select></label><label>Spacing<select value={settings.density??'comfortable'} onChange={e=>void setting('density',e.target.value as SettingsData['density'])}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label>Board background<select value={settings.boardStyle??'paper'} onChange={e=>void setting('boardStyle',e.target.value as SettingsData['boardStyle'])}><option value="paper">Cream paper</option><option value="cork">Cork</option><option value="plain">Plain</option></select></label><label className="wb-check"><input type="checkbox" checked={settings.decoration!==false} onChange={e=>void setting('decoration',e.target.checked)}/>Decorative details</label></div><p>Interface themes never recolor your Sanctuary artwork.</p></section>
}

/** Kids › Today: each kid's school day — the rotation day at a rotation school, and their classes today
 * (classes tagged with them, or every class in the school schedule set up as theirs). */
function KidsToday({data,kids,openSchedules}:{data:AppData;kids:Kid[];openSchedules:()=>void}){
 const today=localDate(),rows=rotationNow(data,new Date())
 return <section className="kids-today" aria-label="Kids today"><h3>Today</h3><ul>{kids.map(k=>{
  const school=rows.find(r=>r.kidId===k.id),classes=classOccurrences(data,today).filter(c=>classKid(c)===k.id&&c.block.kind!=='break'&&!c.block.skippedDates?.includes(today))
  return <li key={k.id} style={{'--kid-color':k.color} as CSSProperties}><KidAvatar kid={k}/><div><strong>{k.name}</strong>{school&&<small>{school.season.school!.name} · {school.closed?'No school':school.cycleDay}</small>}
   {classes.length?<ol className="kids-today-classes">{classes.map(c=><li key={c.id}><time>{classTime(c.displayStart??c.block.start)}</time> {c.block.label}</li>)}</ol>
   :<p className="wb-muted">{school?.closed?'No school today.':'No classes for '+k.name+' today. '}{!school&&<button type="button" className="link-button" onClick={openSchedules}>Add {k.name}’s school schedule</button>}</p>}</div></li>})}</ul></section>
}
