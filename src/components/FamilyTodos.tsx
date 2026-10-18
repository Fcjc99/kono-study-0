import {useState,type CSSProperties} from 'react'
import {uid,type AppData,type FamilyTodo} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {addDays} from '../store/studyScheduler'
import {tickTodo,todoDayLabel} from '../store/familyTodos'

/** The family's to-do list (Home in the family plan): permission slips, poster board, groceries, cleaning.
 * A to-do can be for a day ("Saturday") and come back every week; it shows on that day of the week ahead.
 * Not schoolwork, so nothing here is ever late; checked items fade away after two days. */
export default function FamilyTodos({data,profileId,today,save}:{data:AppData;profileId:string;today:string;save:PlannerRepository['update']}){
 const [title,setTitle]=useState(''),[forKid,setForKid]=useState(''),[day,setDay]=useState(''),[weekly,setWeekly]=useState(false)
 // The next seven days to pick from.
 const nextDays=Array.from({length:7},(_,i)=>addDays(today,i))
 const kids=data.kids.filter(k=>k.profileId===profileId)
 const since=addDays(today,-2)
 const todos=(data.familyTodos??[]).filter(t=>t.profileId===profileId&&(!t.done||!t.doneAt||t.doneAt.slice(0,10)>=since))
  .sort((a,b)=>Number(a.done)-Number(b.done)||(a.due??'9999').localeCompare(b.due??'9999'))
 const update=(fn:(list:FamilyTodo[])=>FamilyTodo[])=>save(d=>({...d,familyTodos:fn(d.familyTodos??[])}))
 const add=async()=>{const text=title.trim();if(!text)return;if(await update(list=>[...list,{id:uid('todo'),profileId,title:text.slice(0,300),done:false,...(forKid?{forKidId:forKid}:{}),...(day?{due:day}:{}),...(day&&weekly?{weekly:true}:{})}])){setTitle('');setForKid('');setDay('');setWeekly(false)}}
 const toggle=(id:string)=>void update(list=>list.map(t=>t.id===id?tickTodo(t,today):t))
 const remove=(id:string)=>void update(list=>list.filter(t=>t.id!==id))
 return <section className="wb-panel family-todos" aria-label="Family to-do">
  <h2>Family to-do</h2>
  {!todos.length&&<p className="family-todo-empty"><img className="kono-empty-art" src="/garden/kono/happy.webp" alt="" aria-hidden="true"/>All clear. Add anything the family needs to remember.</p>}
  {todos.length>0&&<ul>{todos.map(t=>{const kid=kids.find(k=>k.id===t.forKidId);return <li key={t.id} className={t.done?'is-done':''} style={kid?{'--kid-color':kid.color} as CSSProperties:undefined}>
   <label><input type="checkbox" checked={t.done} onChange={()=>toggle(t.id)}/><span>{t.title}</span>{t.due&&<small className="family-todo-day">{t.weekly?'🔁 ':''}{todoDayLabel(t.due,today)}</small>}{kid&&<small className="family-todo-kid">{(kid.emoji?kid.emoji+' ':'')+kid.name}</small>}</label>
   <button type="button" className="family-todo-remove" aria-label={'Remove '+t.title} onClick={()=>remove(t.id)}>×</button>
  </li>})}</ul>}
  <form className="family-todo-add" onSubmit={e=>{e.preventDefault();void add()}}>
   <input aria-label="New family to-do" maxLength={300} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Groceries, clean house, sign permission slip…"/>
   {kids.length>0&&<select aria-label="For" value={forKid} onChange={e=>setForKid(e.target.value)}><option value="">Everyone</option>{kids.map(k=><option key={k.id} value={k.id}>{(k.emoji?k.emoji+' ':'')+k.name}</option>)}</select>}
   <select aria-label="When" value={day} onChange={e=>setDay(e.target.value)}><option value="">Any day</option>{nextDays.map(d=><option key={d} value={d}>{todoDayLabel(d,today)}</option>)}</select>
   {day&&<label className="family-todo-weekly"><input type="checkbox" checked={weekly} onChange={e=>setWeekly(e.target.checked)}/>Every week</label>}
   <button type="submit" disabled={!title.trim()}>Add</button>
  </form>
 </section>
}
