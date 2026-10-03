import {useEffect,useState} from 'react'

/** Sanctuary › a three-step welcome for a brand-new plan: the island, KONO, then adding the first
 * assignment. It sits in the page (no overlay, nothing blocked) and lights up what each step is about. */
const STEPS=[
 {target:'.wb-island',pose:'/garden/kono/happy.webp',title:'This is your island',text:'It grows as you finish work: flowers, a pond, a little house and more. Every assignment you check off helps it along.'},
 {target:'.kono-bar',pose:'/garden/kono/excited.webp',title:'Meet KONO',text:'KONO keeps you company, tells you what’s due and cheers you on. Tap KONO any time for a pat.'},
 {target:'.wb-header .wb-toolbar > .primary',pose:'/garden/kono/read.webp',title:'Add your first assignment',text:'Type it the way you’d say it, like “bio worksheet due fri”, and KONO sorts out the rest.'},
] as const

export default function WelcomeTour({onAdd,onDone}:{onAdd:()=>void;onDone:()=>void}){
 const [step,setStep]=useState(0)
 const current=STEPS[step],last=step===STEPS.length-1
 useEffect(()=>{
  const el=document.querySelector(current.target)
  el?.setAttribute('data-tour-focus','')
  if(step>0)el?.scrollIntoView({block:'center',behavior:document.documentElement.dataset.motion==='full'?'smooth':'auto'})
  return()=>el?.removeAttribute('data-tour-focus')
 },[step,current.target])
 return <section className="wb-panel welcome-tour" aria-label="Welcome to KONO">
  <img key={current.pose} className="welcome-tour-kono" src={current.pose} alt="" aria-hidden="true"/>
  <div className="welcome-tour-copy">
   <small>WELCOME · {step+1} OF {STEPS.length}</small>
   <strong>{current.title}</strong>
   <p>{current.text}</p>
   <div className="wb-toolbar">
    {last?<button type="button" className="primary" onClick={()=>{onDone();onAdd()}}>＋ Add my first assignment</button>
     :<button type="button" className="primary" onClick={()=>setStep(step+1)}>Okay</button>}
    <button type="button" className="link-button" onClick={onDone}>{last?'Maybe later':'Skip tour'}</button>
   </div>
  </div>
  <span className="welcome-tour-dots" aria-hidden="true">{STEPS.map((s,i)=><i key={s.title} className={i===step?'is-on':''}/>)}</span>
 </section>
}
