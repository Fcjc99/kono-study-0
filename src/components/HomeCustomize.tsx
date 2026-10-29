import Modal from './Modal'
import ReorderList from './ReorderList'
import {DEFAULT_ORDER,type HomeLayout,type HomeWidget} from '../store/homeLayout'

/** ✏️ Customize Home: tick the widgets to show and drag them (⠿, or the arrow keys on it) into your own order.
 * Changes apply at once; "Back to the default" undoes them all. Loaded only when opened. */
const WIDGETS:Record<HomeWidget,{name:string;blurb:string}>={
 week:{name:'This week at a glance',blurb:'A slim strip of the next seven days'},
 sanctuary:{name:'Sanctuary',blurb:'KONO’s island and KONO today'},
 family:{name:'Family schedule',blurb:'What’s next for each person today'},
 schedule:{name:'Schedule',blurb:'Today and tomorrow, each in your order'},
 weekAhead:{name:'The next 7 days',blurb:'Day by day: events, to-dos and tests'},
 notes:{name:'Notes & reminders',blurb:'Pinned notes and the next week’s reminders, as sticky notes'},
 todos:{name:'To-dos',blurb:'The family to-do list'},
 meals:{name:'Dinners & groceries',blurb:'This week’s dinners and the grocery list'},
 comingUp:{name:'Coming up',blurb:'Birthdays and countdowns'},
 focus:{name:'Focus session',blurb:'A study timer with KONO'},
}
export default function HomeCustomize({layout,available,onChange,close}:{layout:HomeLayout;available:HomeWidget[];onChange:(l:HomeLayout)=>void;close:()=>void}){
 const shown=layout.order.filter(id=>available.includes(id))
 const toggle=(id:HomeWidget,on:boolean)=>{const hidden=new Set(layout.hidden);if(on)hidden.delete(id);else hidden.add(id);onChange({order:layout.order,hidden})}
 // The order of what this plan has; widgets it doesn't have keep their place after the one before them.
 const reorder=(ids:string[])=>{const rest=layout.order.filter(id=>!available.includes(id)),order=[...ids as HomeWidget[]];for(const id of rest){const at=layout.order.indexOf(id),before=layout.order.slice(0,at).reverse().find(b=>order.includes(b));order.splice(before?order.indexOf(before)+1:0,0,id)}onChange({order,hidden:layout.hidden})}
 return <Modal title="Customize Home" close={close}>
  <div className="home-customize-panel">
   <p className="wb-muted">Pick what’s on your Home and drag ⠿ to put it in your order. This is saved on this device.</p>
   <ReorderList label="Home, top to bottom" items={shown.map(id=>({id,title:WIDGETS[id].name,node:<label className="home-customize-row">
    <input type="checkbox" checked={!layout.hidden.has(id)} onChange={e=>toggle(id,e.target.checked)}/>
    <span><strong>{WIDGETS[id].name}</strong><small>{WIDGETS[id].blurb}</small></span>
   </label>}))} onReorder={reorder}/>
   <div className="wb-toolbar"><button type="button" onClick={()=>onChange({order:[...DEFAULT_ORDER],hidden:new Set()})}>Back to the default</button><button type="button" className="primary" onClick={close}>Done</button></div>
  </div>
 </Modal>
}
