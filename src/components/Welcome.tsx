import { useState, type FormEvent } from 'react'
import { TermsCheckbox } from './Legal'
import { rememberTermsAcceptance, rememberedTermsAcceptance } from '../store/termsConsent'
import type { usePlannerRepository } from '../store/repository'
import { localDate } from '../store/model'
import { lazyPanel } from '../lazyPanel'
/** The signed-out welcome screen. It's small (CSS-only animations), so it comes with this file rather
 * than as one more download after it: a new visitor's first screen is one round trip sooner. */
import Landing from './Landing'
type Store=ReturnType<typeof usePlannerRepository>
// The first-run welcome and the recovery screen: only people setting up (or whose saved plan couldn't be
// read) see them, so they load on demand instead of with every start.
/** Account & data (also under the welcome form): Settings-only code, loaded when it's shown. */
const AccountPanel=lazyPanel<{store:Store}>(()=>import('./AccountSettings').then(m=>({default:m.AccountPanel})))
/** Shown instead of the welcome screen when saved data exists but this build couldn't read it. */
export function RecoveryScreen({store}:{store:Store}){
 const [status,setStatus]=useState('')
 const download=async()=>{setStatus('');try{setStatus(await store.repository.downloadUnreadable()?'Downloaded. Keep that file somewhere safe.':'')}catch{setStatus('Could not prepare the download. Your data is still in this browser.')}}
 return <main className="onboarding page-stack"><section className="card recovery-screen" role="alert"><span className="eyebrow">KONO</span><h1>We couldn't open your saved plan</h1>
  <p><strong>Your data is safe.</strong> Nothing has been changed or deleted, and KONO won't save over it while this screen is showing.</p>
  <p>This can happen right after an update. Trying again often fixes it. If it doesn't, download a copy so nothing can be lost, then check back after the next update.</p>
  <div className="account-actions"><button className="primary" onClick={()=>window.location.reload()}>Try again</button><button onClick={()=>void download()}>Download a copy of my data</button>{store.recovery.filter(file=>file.raw).map(file=><button key={file.name} onClick={()=>store.repository.downloadRecovery(file)}>Download older copy ({file.name})</button>)}</div>
  {status&&<p role="status">{status}</p>}
  {store.error&&<details><summary>Technical details</summary><p>{store.error}</p></details>}
 </section></main>
}
export function Onboarding({store}:{store:Store}){
 const profile=store.data.profiles[0], [name,setName]=useState(''),[label,setLabel]=useState('My study plan'),[deviceStart,setDeviceStart]=useState(false),[agreed,setAgreed]=useState(()=>Boolean(rememberedTermsAcceptance())),[island,setIsland]=useState<'full'|'kono'|'off'>('full'),[forFamily,setForFamily]=useState(false)
 const submit=(e:FormEvent)=>{e.preventDefault();if(!name.trim()||!label.trim()||(!store.support&&!agreed))return;const termsAcceptedAt=store.support?undefined:rememberedTermsAcceptance()??rememberTermsAcceptance();if(forFamily){try{localStorage.setItem('kono-family-setup','1')}catch{/* the Home card still offers setup */}}store.repository.update(d=>({...d,onboardingComplete:true,settings:{...d.settings,termsAcceptedAt:termsAcceptedAt??d.settings.termsAcceptedAt,...(forFamily?{parentMode:true}:{})},profiles:d.profiles.map(p=>p.id===profile.id?{...p,name:name.trim(),label:label.trim(),...(island==='full'?{}:{island})}:p)}))}
 const demo=()=>void store.repository.update(d=>({...d,onboardingComplete:true,notes:[...d.notes,{id:'demo-note-'+profile.id,profileId:profile.id,subjectId:'',title:'Welcome to your board',body:'Edit this note, change its color, or move it to Trash. Your own work starts here.',created:new Date().toISOString(),pinned:true}],tasks:[...d.tasks,{id:'demo-task-'+profile.id,profileId:profile.id,subjectId:'',title:'Try completing an assignment',due:localDate(),done:false,notes:'This optional demo task can be edited, reopened, or removed.'}]}))
 // Plans live in an account tied to your email, so they can't be lost with a browser. The demo stays on this device.
 if(store.repository.signInProvider==='email'&&!store.user&&!deviceStart)return <Landing store={store} onUseDevice={()=>setDeviceStart(true)} onDemo={demo}/>
 return <main className="onboarding page-stack"><form className="card" onSubmit={submit}><span className="eyebrow">Welcome to KONO</span><h1>A little space for steady progress.</h1>{store.support?<p className="onboarding-account">Setting up a plan for <strong>{store.support.email}</strong>. Use their name; everything you add saves to their account.</p>:store.user&&<p className="onboarding-account">Signed in as <strong>{store.user.email}</strong>. Your plan saves to this account.</p>}<p>{forFamily?'One shared calendar for the whole family: each kid’s activities, school days, birthdays and who’s driving. Next, you’ll add the kids and their week.':'Start with your own plan. Add subjects, small assignments and notes; your Sanctuary grows as you finish work.'}</p><fieldset className="onboarding-who"><legend>Who’s KONO for?</legend>{([[false,'📚 Me, a student'],[true,'👪 My family (I’m a parent)']] as const).map(([v,t])=><label key={t} className="wb-check"><input type="radio" name="onboarding-who" checked={forFamily===v} onChange={()=>{setForFamily(v);if(v&&label==='My study plan')setLabel('Our family');if(!v&&label==='Our family')setLabel('My study plan')}}/>{t}</label>)}</fieldset><label>Your name<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} autoComplete="given-name"/></label><label>Plan name<input required maxLength={200} value={label} onChange={e=>setLabel(e.target.value)}/></label><fieldset className="onboarding-island"><legend>Do you want the island and KONO?</legend><p className="wb-muted">You can change this any time in Settings › Look &amp; feel.</p>{([["full","🏝️ Yes, the island and KONO"],["kono","🐾 Just KONO"],["off","📋 No, just the planner"]] as const).map(([v,t])=><label key={v} className="wb-check"><input type="radio" name="onboarding-island" checked={island===v} onChange={()=>setIsland(v)}/>{t}</label>)}</fieldset>{!store.support&&<TermsCheckbox checked={agreed} onChange={setAgreed}/>}<button className="primary" disabled={store.needsMigration}>{store.support?'Create their study plan':forFamily?'Create our family plan':'Create my study plan'}</button>{!store.user&&<button type="button" className="link-button onboarding-demo" disabled={store.needsMigration} onClick={demo}>Try a small demo instead</button>}</form>{!store.support&&!store.user&&<AccountPanel store={store}/>}</main>
}
