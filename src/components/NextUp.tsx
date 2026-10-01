import {useState} from 'react'
import type {NextUp as Item} from '../store/nextUp'

/** Sanctuary › KONO today › "What should I do now?": one thing to work on, why, and a focus timer
 * sized to it. "Something else" steps through the rest in order. */
export default function NextUp({items,onStart,onDone,onClose}:{items:Item[];onStart:(id:string,minutes:number)=>void;onDone:(item:Item)=>void;onClose:()=>void}){
 const [index,setIndex]=useState(0)
 const item=items.length?items[index%items.length]:null
 return <div className="next-up" role="region" aria-label="What to do now">
  {item?<>
   <small>DO THIS NOW{items.length>1?' · '+(index%items.length+1)+' of '+items.length:''}</small>
   <h3>{item.title}</h3>
   {item.step&&<p className="next-up-step">Next step: <strong>{item.step}</strong></p>}
   <p className="wb-muted">{item.why} About {item.minutes} minutes.</p>
   <div className="wb-toolbar"><button type="button" className="primary" onClick={()=>onStart(item.id,item.minutes)}>Start a {item.minutes}-minute focus</button><button type="button" onClick={()=>onDone(item)}>Already done</button>{items.length>1&&<button type="button" onClick={()=>setIndex(i=>i+1)}>Something else</button>}<button type="button" onClick={onClose}>Close</button></div>
  </>:<><h3>Nothing to do right now</h3><p className="wb-muted">Nothing is due in the next week. Enjoy your free time!</p><div className="wb-toolbar"><button type="button" onClick={onClose}>Close</button></div></>}
 </div>
}
