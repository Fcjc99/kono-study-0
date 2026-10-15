import type { CSSProperties } from 'react'
import { EmailSignIn } from './AccountPanel'
import type { usePlannerRepository } from '../store/repository'
type Store=ReturnType<typeof usePlannerRepository>
const LANDING_POINTS=[['📅','Classes, due dates and exams in one calm place'],['🌱','Your island grows as you finish work'],['🐾','KONO cheers you on, one small step at a time']] as const
/** Each line of the copy rises in a beat after the one before (motion-polish.css, .landing-rise). */
const r=(i:number,className='')=>({className:('landing-rise '+className).trim(),style:{'--rise':i} as CSSProperties})
/** The first screen for someone without a plan: what KONO is, the island it grows, and the email sign-in.
 * Its entrance is CSS only (motion-polish.css), so a new visitor's first screen needs no animation library
 * and nothing extra to download before it shows. */
export default function Landing({store,onUseDevice,onDemo}:{store:Store;onUseDevice:()=>void;onDemo:()=>void}){
 return <main className="onboarding landing">
  <section className="landing-copy">
   <span {...r(0,'eyebrow')}>Welcome to KONO</span>
   <h1 {...r(1)}>A little space for steady progress.</h1>
   <p {...r(2,'landing-lede')}>Sign in with your email to start your plan. It’s backed up every time you open KONO and there on any device. No password: we email you a link.</p>
   <ul {...r(3,'landing-points')}>{LANDING_POINTS.map(([icon,text])=><li key={text}><span aria-hidden="true">{icon}</span>{text}</li>)}</ul>
   <div {...r(4,'landing-form')}><EmailSignIn store={store} button="Email me a link to start" onUseDevice={onUseDevice} requireTerms/></div>
   <p {...r(5,'onboarding-demo')}>Just looking around? <button type="button" className="landing-demo" onClick={onDemo}>Try a small demo instead <span aria-hidden="true">→</span></button> <small>The demo is saved on this device only.</small></p>
  </section>
  <figure className="landing-art" aria-hidden="true">
   <img className="landing-island" src="/landing/island.webp" alt="" width={960} height={720} decoding="async" fetchPriority="high"/>
   <img className="landing-kono" src="/garden/kono/happy.webp" alt=""/>
   <span className="landing-chip is-done"><b>✓</b> Math worksheet done</span>
   <span className="landing-chip is-streak"><b>🔥</b> 4-day streak</span>
  </figure>
 </main>
}
