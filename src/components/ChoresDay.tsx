import type {CSSProperties} from 'react'
import type {AppData,Kid} from '../store/model'
import {choresOn,pictureFor} from '../store/kidPlanner'
import {starsOf} from '../store/choreStars'
import {repeatLabel} from '../store/familyTodos'

/** Chores in Home's schedule (Today and Tomorrow): the day's chores for everyone, set apart from the day's
 * events as a checklist, each with a tick circle in the kid's color, a picture, whose it is and the stars
 * it earns. Ticking one here is the same as anywhere (a repeat moves to its next turn, with Undo); the ones
 * done today stay, crossed off. */
export default function ChoresDay({data,profileId,date,today,kids,onTick,shown=()=>true}:{data:AppData;profileId:string;date:string;today:string;kids:Kid[];onTick:(id:string,on:string)=>void;shown?:(kidId?:string)=>boolean}){
 const people=['',...kids.map(k=>k.id)].filter(id=>shown(id||undefined))
 const rows=people.flatMap(id=>{const c=choresOn(data,profileId,id,date,today);return [...c.open.map(t=>({t,done:false})),...c.done.map(t=>({t,done:true}))]})
 if(!rows.length)return null
 const left=rows.filter(r=>!r.done).length
 return <section className="chores-day" aria-label={(date===today?'Today':'Tomorrow')+'’s chores'}>
  <h4><span aria-hidden="true">🧹</span> Chores<small>{left?left+' to do':'All done 🎉'}</small></h4>
  <ul>{rows.map(({t,done})=>{const kid=kids.find(k=>k.id===t.forKidId)
   return <li key={t.id} style={{'--kid-color':kid?.color??'#9a8fb0'} as CSSProperties} className={done?'is-done':undefined}>
    <button type="button" className="chores-day-tick" disabled={done} aria-label={(done?'Done: ':'Tick off: ')+t.title+(kid?' ('+kid.name+')':'')} onClick={()=>onTick(t.id,date)}><span aria-hidden="true">{done?'✓':''}</span></button>
    <span className="chores-day-pic" aria-hidden="true">{pictureFor(t.title).replace('📌','✔️')}</span>
    <span className="chores-day-text"><b>{t.title}</b><small>{[kid?(kid.emoji?kid.emoji+' ':'')+kid.name:'Family',t.repeat?'🔁 '+repeatLabel(t.repeat).toLowerCase():''].filter(Boolean).join(' · ')}</small></span>
    {kid&&starsOf(t)>0&&<span className="chores-day-stars">+{starsOf(t)}⭐</span>}
   </li>})}</ul>
 </section>
}
