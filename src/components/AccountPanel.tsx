import { Suspense, lazy, useState, type FormEvent } from 'react'
import { TermsCheckbox } from './Legal'
import { rememberTermsAcceptance, rememberedTermsAcceptance } from '../store/termsConsent'
import type { usePlannerRepository } from '../store/repository'
import { localDate } from '../store/model'
import {APP_VERSION} from '../version'
import { useSmallScreen } from '../hooks/useComfort'
import { lazyPanel } from '../lazyPanel'
type Store=ReturnType<typeof usePlannerRepository>
/** The signed-out welcome screen, with its animations, loads only for people who see it. */
const Landing=lazy(()=>import('./Landing'))
/** Account & data (also under the welcome form): Settings-only code, loaded when it's shown. */
const AccountPanel=lazyPanel<{store:Store}>(()=>import('./AccountSettings').then(m=>({default:m.AccountPanel})))
export function SaveStatus({store}:{store:Store}){
 // Routine "Saved…" states are quiet (hidden on small screens); anything needing attention always shows.
 const quiet=!store.error&&!store.support&&/^(Saved on this device|Saved to your account|Saved|Account ready)$/.test(store.status)
 return <div className={'save-status'+(quiet?' is-quiet':'')}><small>Build {APP_VERSION.split('production-')[1]} · </small><span role="status"><span className="save-status-account">{store.support?'Helping: '+store.support.email:store.user?'Account: '+store.user.email:'This device only'} · </span>{store.status}</span>{store.error&&<p role="alert">{store.error} <button onClick={store.repository.export}>Export working copy</button> <button onClick={store.repository.retry}>Retry</button></p>}</div>
}
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
/** Email sign-in link form, shared by onboarding, the save-to-email banner and Settings. */
/** Turns a sign-in email failure into plain words; rate limits and outages aren't the person's fault. */
function signInProblem(err:unknown){
 const raw=err instanceof Error?err.message:''
 if(/rate limit|too many|429|over_email_send_rate/i.test(raw))return {text:'KONO has sent a lot of sign-in emails in the last hour, so this one is waiting its turn. Try again in a little while.',service:true}
 if(/fetch|network|failed to|timeout|smtp|sending|unexpected|500|503/i.test(raw)||!raw)return {text:'We couldn’t send the email right now. Check your connection and try again in a moment.',service:true}
 return {text:raw,service:false}
}
export function EmailSignIn({store,button='Email me a sign-in link',onUseDevice,requireTerms}:{store:Store;button?:string;onUseDevice?:()=>void;requireTerms?:boolean}){
 const [agreed,setAgreed]=useState(()=>Boolean(rememberedTermsAcceptance())),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState<{text:string;service:boolean}|null>(null)
 const [code,setCode]=useState(''),[checking,setChecking]=useState(false),[codeError,setCodeError]=useState('')
 // Signs in inside this window (and reloads into the account once it has); the link would open a browser instead.
 const submitCode=async(e:FormEvent)=>{e.preventDefault();setChecking(true);setCodeError('');try{await store.repository.verifyEmailCode(email,code)}catch(err){setCodeError(err instanceof Error?err.message:'That code didn’t work.');setChecking(false)}}
 const submit=async(e:FormEvent)=>{e.preventDefault();if(requireTerms&&!agreed)return;setBusy(true);setError(null);try{if(requireTerms)rememberTermsAcceptance();await store.repository.signInWithEmail(email);setSent(true)}catch(err){setError(signInProblem(err))}finally{setBusy(false)}}
 return <><form className="email-sign-in" onSubmit={e=>void submit(e)}><label>Email address<input required type="email" autoComplete="email" maxLength={320} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>{requireTerms&&<TermsCheckbox checked={agreed} onChange={setAgreed}/>}<button className="primary" disabled={busy}>{busy?'Sending…':button}</button>{sent&&<p role="status">Check your email from KONO. Tap its link on this device, or type its code below. Using KONO as an app on your Home Screen or desktop? Use the code, so you’re signed in inside the app. It can take a minute; check spam if it doesn’t arrive.</p>}{error&&<p role="alert">{error.text}{error.service&&onUseDevice&&<> <button type="button" className="sign-in-fallback" onClick={onUseDevice}>Start on this device for now</button> <small>You can save it to your email later from the banner at the top.</small></>}</p>}</form>{sent&&<form className="email-sign-in email-code" onSubmit={e=>void submitCode(e)}><label>Code from the email<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,12}" maxLength={12} required value={code} onChange={e=>setCode(e.target.value)} placeholder="123456"/></label><button className="primary" disabled={checking}>{checking?'Signing in…':'Sign in with code'}</button>{codeError&&<p role="alert">{codeError}</p>}</form>}</>
}
export function Onboarding({store}:{store:Store}){
 const profile=store.data.profiles[0], [name,setName]=useState(''),[label,setLabel]=useState('My study plan'),[deviceStart,setDeviceStart]=useState(false),[agreed,setAgreed]=useState(()=>Boolean(rememberedTermsAcceptance()))
 const submit=(e:FormEvent)=>{e.preventDefault();if(!name.trim()||!label.trim()||(!store.support&&!agreed))return;const termsAcceptedAt=store.support?undefined:rememberedTermsAcceptance()??rememberTermsAcceptance();store.repository.update(d=>({...d,onboardingComplete:true,settings:{...d.settings,termsAcceptedAt:termsAcceptedAt??d.settings.termsAcceptedAt},profiles:d.profiles.map(p=>p.id===profile.id?{...p,name:name.trim(),label:label.trim()}:p)}))}
 const demo=()=>void store.repository.update(d=>({...d,onboardingComplete:true,notes:[...d.notes,{id:'demo-note-'+profile.id,profileId:profile.id,subjectId:'',title:'Welcome to your board',body:'Edit this note, change its color, or move it to Trash. Your own work starts here.',created:new Date().toISOString(),pinned:true}],tasks:[...d.tasks,{id:'demo-task-'+profile.id,profileId:profile.id,subjectId:'',title:'Try completing an assignment',due:localDate(),done:false,notes:'This optional demo task can be edited, reopened, or removed.'}]}))
 // Plans live in an account tied to your email, so they can't be lost with a browser. The demo stays on this device.
 if(store.repository.signInProvider==='email'&&!store.user&&!deviceStart)return <Suspense fallback={<main className="startup-card"><h1>KONO</h1><p role="status">Opening KONO…</p></main>}><Landing store={store} onUseDevice={()=>setDeviceStart(true)} onDemo={demo}/></Suspense>
 return <main className="onboarding page-stack"><form className="card" onSubmit={submit}><span className="eyebrow">Welcome to KONO</span><h1>A little space for steady progress.</h1>{store.support?<p className="onboarding-account">Setting up a plan for <strong>{store.support.email}</strong>. Use their name; everything you add saves to their account.</p>:store.user&&<p className="onboarding-account">Signed in as <strong>{store.user.email}</strong>. Your plan saves to this account.</p>}<p>Start with your own plan. Add subjects, small assignments and notes; your Sanctuary grows as you finish work.</p><label>Your name<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} autoComplete="given-name"/></label><label>Plan name<input required maxLength={200} value={label} onChange={e=>setLabel(e.target.value)}/></label>{!store.support&&<TermsCheckbox checked={agreed} onChange={setAgreed}/>}<button className="primary" disabled={store.needsMigration}>{store.support?'Create their study plan':'Create my study plan'}</button><button type="button" disabled={store.needsMigration} onClick={demo}>Try a small demo instead</button></form>{!store.support&&<AccountPanel store={store}/>}</main>
}
const SNOOZE_KEY='kono-save-to-email-snoozed-until'
/** Top-of-page account notices: who you're helping in support mode, or a nudge to save a device-only plan to an email account. */
export function AccountBanners({store}:{store:Store}){
 const [snoozed,setSnoozed]=useState(()=>{try{return Number(localStorage.getItem(SNOOZE_KEY)??0)>Date.now()}catch{return false}})
 // On an iPhone the full explanation and form took half the screen on every page: one line until tapped.
 const phone=useSmallScreen(),[open,setOpen]=useState(false)
 const [error,setError]=useState('')
 if(store.support)return <div className="support-banner" role="status"><p><strong>KONO support:</strong> you’re working in <strong>{store.support.email}</strong>’s plan. Changes save to their account, and they can see that support opened and changed it.</p><button type="button" onClick={()=>{setError('');store.repository.exitSupport().catch(e=>setError(e instanceof Error?e.message:'Could not exit yet.'))}}>Exit support</button>{error&&<p role="alert">{error}</p>}</div>
 if(!store.ready||store.user||snoozed||store.repository.signInProvider!=='email')return null
 const snooze=()=>{try{localStorage.setItem(SNOOZE_KEY,String(Date.now()+86_400_000))}catch{/* storage unavailable */}setSnoozed(true)}
 if(phone&&!open)return <section className="save-to-email-banner is-compact" aria-label="Save your plan to your email"><p><strong>Only saved on this device.</strong></p><button type="button" className="primary" onClick={()=>setOpen(true)}>Back it up</button><button type="button" className="save-to-email-later" onClick={snooze}>Later</button></section>
 return <section className="save-to-email-banner" aria-label="Save your plan to your email"><p><strong>Your plan is only saved in this browser.</strong> If this browser’s data is cleared, it’s gone. Save it to your email so it’s backed up and on every device you sign in on.</p><EmailSignIn store={store} button="Save to my email"/><button type="button" className="save-to-email-later" onClick={snooze}>Remind me tomorrow</button></section>
}
