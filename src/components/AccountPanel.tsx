import { useState, type FormEvent } from 'react'
import { TermsCheckbox } from './Legal'
import { rememberTermsAcceptance, rememberedTermsAcceptance } from '../store/termsConsent'
import type { usePlannerRepository } from '../store/repository'
import {APP_VERSION} from '../version'
import { useSmallScreen } from '../hooks/useComfort'
type Store=ReturnType<typeof usePlannerRepository>
export function SaveStatus({store}:{store:Store}){
 // Routine "Saved…" states are quiet (hidden on small screens); anything needing attention always shows.
 const quiet=!store.error&&!store.support&&/^(Saved on this device|Saved to your account|Saved|Account ready)$/.test(store.status)
 return <div className={'save-status'+(quiet?' is-quiet':'')}><small>Build {APP_VERSION.split('production-')[1]} · </small><span role="status"><span className="save-status-account">{store.support?'Helping: '+store.support.email:store.user?'Account: '+store.user.email:'This device only'} · </span>{store.status}</span>{store.error&&<p role="alert">{store.error} <button onClick={store.repository.export}>Export working copy</button> <button onClick={store.repository.retry}>Retry</button></p>}</div>
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
const SNOOZE_KEY='kono-save-to-email-snoozed-until'
/** Top-of-page account notices: who you're helping in support mode, or a nudge to save a device-only plan to an email account. */
export function AccountBanners({store}:{store:Store}){
 const [snoozed,setSnoozed]=useState(()=>{try{return Number(localStorage.getItem(SNOOZE_KEY)??0)>Date.now()}catch{return false}})
 // On an iPhone the full explanation and form took half the screen on every page: one line until tapped.
 const phone=useSmallScreen(),[open,setOpen]=useState(false)
 const [error,setError]=useState('')
 // Syncing is paused until someone picks: say so on every page, with both choices right here.
 if(store.conflicts.length)return <ConflictBanner store={store}/>
 if(store.support)return <div className="support-banner" role="status"><p><strong>KONO support:</strong> you’re working in <strong>{store.support.email}</strong>’s plan. Changes save to their account, and they can see that support opened and changed it.</p><button type="button" onClick={()=>{setError('');store.repository.exitSupport().catch(e=>setError(e instanceof Error?e.message:'Could not exit yet.'))}}>Exit support</button>{error&&<p role="alert">{error}</p>}</div>
 if(!store.ready||store.user||snoozed||store.repository.signInProvider!=='email')return null
 const snooze=()=>{try{localStorage.setItem(SNOOZE_KEY,String(Date.now()+86_400_000))}catch{/* storage unavailable */}setSnoozed(true)}
 if(phone&&!open)return <section className="save-to-email-banner is-compact" aria-label="Save your plan to your email"><p><strong>Only saved on this device.</strong></p><button type="button" className="primary" onClick={()=>setOpen(true)}>Back it up</button><button type="button" className="save-to-email-later" onClick={snooze}>Later</button></section>
 return <section className="save-to-email-banner" aria-label="Save your plan to your email"><p><strong>Your plan is only saved in this browser.</strong> If this browser’s data is cleared, it’s gone. Save it to your email so it’s backed up and on every device you sign in on.</p><EmailSignIn store={store} button="Save to my email"/><button type="button" className="save-to-email-later" onClick={snooze}>Remind me tomorrow</button></section>
}

function ConflictBanner({store}:{store:Store}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const pick=async(keep:'here'|'other')=>{
  if(keep==='other'&&!window.confirm('Use the version from your other device? What you changed here since the last sync will be replaced (your copy is downloaded first).'))return
  setBusy(true);setError('')
  try{if(keep==='other'){store.repository.export();await store.repository.useCloud()}else await store.repository.keepLocal()}catch(e){setError(e instanceof Error?e.message:'Could not do that. Try again.')}finally{setBusy(false)}
 }
 return <section className="sync-conflict-banner" role="alert" aria-label="Syncing is paused">
  <p><strong>Your devices changed the same thing, so syncing is paused.</strong> Nothing has been lost. Pick which version to keep:</p>
  <div className="wb-toolbar"><button type="button" className="primary" disabled={busy} onClick={()=>void pick('here')}>Keep this device’s version</button><button type="button" disabled={busy} onClick={()=>void pick('other')}>Use the other version</button><button type="button" className="link-button" disabled={busy} onClick={store.repository.export}>Download a copy first</button></div>
  {error&&<p className="sync-conflict-error">{error}</p>}
 </section>
}
