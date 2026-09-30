import {useState} from 'react'

export type StartStep={id:string;title:string;note:string;done:boolean;action:string;onAction:()=>void}

/** Sanctuary › Getting started: the few things that make KONO useful, for someone new. Each step ticks
 * itself off when it's done (or skipped), and the card goes away when they all are, or on Hide.
 * `compact` (phones) shows just the next step on one row, so the island stays near the top. */
export default function GettingStarted({steps,onSkip,onHide,compact=false}:{steps:StartStep[];onSkip:(id:string)=>void;onHide:()=>void;compact?:boolean}){
 const [expanded,setExpanded]=useState(false)
 const left=steps.filter(s=>!s.done)
 if(!left.length)return null
 const progress=`${steps.length-left.length} of ${steps.length} done`
 if(compact&&!expanded)return <section className="wb-panel getting-started is-compact" aria-label="Getting started">
  <div><small>SET UP KONO · {progress}</small><strong>{left[0].title}</strong></div>
  <div className="wb-toolbar"><button type="button" className="primary" onClick={left[0].onAction}>{left[0].action}</button><button type="button" onClick={()=>setExpanded(true)} aria-label="Show all setup steps">All steps</button></div>
 </section>
 return <section className="wb-panel getting-started" aria-label="Getting started">
  <div className="wb-section-head"><div><small>GETTING STARTED</small><h2>Set up KONO in a few minutes</h2></div><button type="button" onClick={onHide}>Hide</button></div>
  <p className="wb-muted">{progress}</p>
  <ol className="getting-started-steps">{steps.map((s,i)=><li key={s.id} className={s.done?'is-done':''}>
   <span className="getting-started-mark" aria-hidden="true">{s.done?'✓':i+1}</span>
   <div><strong>{s.title}</strong><small>{s.done?'Done':s.note}</small></div>
   {!s.done&&<div className="wb-toolbar"><button type="button" className={s.id===left[0].id?'primary':''} onClick={s.onAction}>{s.action}</button><button type="button" className="link-button" onClick={()=>onSkip(s.id)} aria-label={'Skip: '+s.title}>Skip</button></div>}
  </li>)}</ol>
 </section>
}
