export type StartStep={id:string;title:string;note:string;done:boolean;action:string;onAction:()=>void}

/** Sanctuary › Getting started: the few things that make KONO useful, for someone new. Each step ticks
 * itself off when it's done (or skipped), and the card goes away when they all are, or on Hide. */
export default function GettingStarted({steps,onSkip,onHide}:{steps:StartStep[];onSkip:(id:string)=>void;onHide:()=>void}){
 const left=steps.filter(s=>!s.done)
 if(!left.length)return null
 return <section className="wb-panel getting-started" aria-label="Getting started">
  <div className="wb-section-head"><div><small>GETTING STARTED</small><h2>Set up KONO in a few minutes</h2></div><button type="button" onClick={onHide}>Hide</button></div>
  <p className="wb-muted">{steps.length-left.length} of {steps.length} done</p>
  <ol className="getting-started-steps">{steps.map((s,i)=><li key={s.id} className={s.done?'is-done':''}>
   <span className="getting-started-mark" aria-hidden="true">{s.done?'✓':i+1}</span>
   <div><strong>{s.title}</strong><small>{s.done?'Done':s.note}</small></div>
   {!s.done&&<div className="wb-toolbar"><button type="button" className={s.id===left[0].id?'primary':''} onClick={s.onAction}>{s.action}</button><button type="button" className="link-button" onClick={()=>onSkip(s.id)} aria-label={'Skip: '+s.title}>Skip</button></div>}
  </li>)}</ol>
 </section>
}
