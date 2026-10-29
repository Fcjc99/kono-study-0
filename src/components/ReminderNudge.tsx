import {useEffect,useState} from 'react'
import {currentPushSubscription,isIos,pushSupport,turnOnPush} from '../store/pushDevice'
import {isNativeApp} from '../native'
import type {usePlannerRepository} from '../store/repository'

const DISMISSED='kono-reminder-nudge-dismissed',WAS_ON='kono-reminders-were-on'

/** Planner: a one-tap way to get reminders on this phone (before each event, and the day's work), until
 * they're on or it's put away. iPhone needs KONO on the Home Screen first; the phone apps schedule
 * their own reminders, so they never show this. A phone can quietly lose its reminders (iPhone drops
 * them after weeks unopened, or when site data is cleared): then it says so, even if put away before. */
export default function ReminderNudge({repository,signIn}:{repository:ReturnType<typeof usePlannerRepository>['repository'];signIn:()=>void}){
 const [state,setState]=useState<'hidden'|'ask'|'lost'|'install'|'sign-in'|'done'>('hidden'),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{
  let dismissed=false,wasOn=false;try{dismissed=localStorage.getItem(DISMISSED)==='1';wasOn=localStorage.getItem(WAS_ON)==='1'}catch{/* show it */}
  const support=pushSupport()
  if(isNativeApp()||support==='unsupported'||(dismissed&&!wasOn))return
  if(support==='install-first'){if(!dismissed)void Promise.resolve().then(()=>setState('install'));return}
  void currentPushSubscription().then(s=>{
   if(s){try{localStorage.setItem(WAS_ON,'1')}catch{/* fine */}return}
   if(wasOn&&repository.canUsePush){setState('lost');return}
   if(!dismissed)setState(repository.canUsePush?'ask':'sign-in')
  }).catch(()=>{})
 },[repository])
 const hide=()=>{try{localStorage.setItem(DISMISSED,'1');if(state==='lost')localStorage.removeItem(WAS_ON)}catch{/* it comes back next time */}setState('hidden')}
 const on=async()=>{setBusy(true);setError('');try{await turnOnPush(repository);try{localStorage.setItem(WAS_ON,'1')}catch{/* fine */}setState('done')}catch(e){setError(e instanceof Error?e.message:'Couldn’t turn on reminders.')}finally{setBusy(false)}}
 if(state==='hidden')return null
 return <section className="reminder-nudge" aria-label="Reminders on this phone">
  <span className="reminder-nudge-bell" aria-hidden="true">🔔</span>
  <div>
   {state==='done'?<p><strong>Reminders are on.</strong> You’ll get a note before each event (15 minutes unless you pick another time in the event) and for the day’s work.</p>
   :state==='lost'?<p><strong>Reminders stopped on this phone.</strong> It happens when KONO hasn’t been opened for a while or the phone cleared its data. Turn them back on to keep getting them.</p>
   :state==='install'?<p><strong>Get reminders on your {isIos()?'iPhone':'phone'}.</strong> Add KONO to your Home Screen first: tap <b>Share</b> › <b>Add to Home Screen</b>, then open KONO from there and turn them on.</p>
   :state==='sign-in'?<p><strong>Get reminders on this phone.</strong> Sign in first, so the reminders can reach this phone even when KONO is closed.</p>
   :<p><strong>Get reminders on this phone.</strong> A note before each event and for what’s due, even when KONO is closed.</p>}
   {error&&<p role="alert">{error}</p>}
   <div className="wb-toolbar">
    {(state==='ask'||state==='lost')&&<button type="button" className="primary" disabled={busy} onClick={()=>void on()}>{busy?'Turning on…':'Turn on reminders'}</button>}
    {state==='sign-in'&&<button type="button" className="primary" onClick={signIn}>Sign in</button>}
    <button type="button" onClick={hide}>{state==='done'?'Close':'Not now'}</button>
   </div>
  </div>
 </section>
}
