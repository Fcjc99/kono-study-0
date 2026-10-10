import type {ReactNode} from 'react'

export type AddChoiceId='school'|'college'|'link'|'photos'|'pdf'|'weekly'|'sports'|'work'
export type AddChoice={id:AddChoiceId;icon:string;title:string;note:string;render:()=>ReactNode}

/** Planner › ＋ Add to my calendar: one place to start for anything that goes on the calendar. It asks
 * "What do you have?" and opens the matching tool right here, so nobody has to know which Settings tab
 * holds which importer. */
export default function AddToCalendar({choices,choice,setChoice,close}:{choices:AddChoice[];choice:AddChoiceId|null;setChoice:(id:AddChoiceId|null)=>void;close:()=>void}){
 const open=choices.find(c=>c.id===choice)
 return <section className="wb-panel add-to-calendar" aria-label="Add to my calendar">
  <div className="wb-section-head"><div><small>PLANNER</small><h2>{open?open.icon+' '+open.title:'Add to my calendar'}</h2></div>
   <div className="wb-toolbar">{open&&<button type="button" onClick={()=>setChoice(null)}>← Other options</button>}<button type="button" onClick={close}>Done</button></div></div>
  {open?<div className="add-to-calendar-tool">{open.render()}</div>:<>
   <p>What do you have? Pick one and KONO walks you through it. Everything you add shows up in your Planner.</p>
   <div className="add-to-calendar-choices" role="group" aria-label="What do you have?">{choices.map(c=><button key={c.id} type="button" onClick={()=>setChoice(c.id)}><span aria-hidden="true">{c.icon}</span><strong>{c.title}</strong><small>{c.note}</small></button>)}</div>
  </>}
 </section>
}
