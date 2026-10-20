import {useState,type CSSProperties} from 'react'
import {uid,type AppData,type FamilyTodo,type TodoRepeat} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {addDays} from '../store/studyScheduler'
import {TODO_REPEATS,repeatFields,repeatLabel,todoDayLabel} from '../store/familyTodos'
import Modal from './Modal'
import TodoEditor,{type TodoOps} from './TodoEditor'

/** The family's to-do list (Home in the family plan): permission slips, poster board, groceries, cleaning.
 * A to-do can be for a day ("Saturday") and come back every week, every 2 weeks or every month; it shows on
 * that day of the week ahead and in the Planner.
 * Not schoolwork, so nothing here is ever late; checked items fade away after two days. Tapping a to-do's
 * words changes it; ticking and removing say so with Undo. */
export default function FamilyTodos({data,profileId,today,save,ops}:{data:AppData;profileId:string;today:string;save:PlannerRepository['update'];ops:TodoOps}){
 const [title,setTitle]=useState(''),[forKid,setForKid]=useState(''),[day,setDay]=useState(''),[repeat,setRepeat]=useState<TodoRepeat|''>(''),[otherDay,setOtherDay]=useState(false),[editing,setEditing]=useState('')
 // The next seven days to pick from.
 const nextDays=Array.from({length:7},(_,i)=>addDays(today,i))
 const kids=data.kids.filter(k=>k.profileId===profileId)
 const since=addDays(today,-2)
 const todos=(data.familyTodos??[]).filter(t=>t.profileId===profileId&&(!t.done||!t.doneAt||t.doneAt.slice(0,10)>=since))
  .sort((a,b)=>Number(a.done)-Number(b.done)||(a.due??'9999').localeCompare(b.due??'9999'))
 const update=(fn:(list:FamilyTodo[])=>FamilyTodo[])=>save(d=>({...d,familyTodos:fn(d.familyTodos??[])}))
 const add=async()=>{const text=title.trim();if(!text)return;if(await update(list=>[...list,{id:uid('todo'),profileId,title:text.slice(0,300),done:false,...(forKid?{forKidId:forKid}:{}),...(day?{due:day}:{}),...repeatFields(repeat||undefined,day||undefined)}])){setTitle('');setForKid('');setDay('');setRepeat('');setOtherDay(false)}}
 return <section className="wb-panel family-todos" aria-label="Family to-do">
  <h2>Family to-do</h2>
  {!todos.length&&<p className="family-todo-empty"><img className="kono-empty-art" src="/garden/kono/happy.webp" alt="" aria-hidden="true"/>All clear. Add anything the family needs to remember.</p>}
  {todos.length>0&&<ul>{todos.map(t=>{const kid=kids.find(k=>k.id===t.forKidId);return <li key={t.id} className={t.done?'is-done':''} style={kid?{'--kid-color':kid.color} as CSSProperties:undefined}>
   <span className="family-todo-row"><input type="checkbox" aria-label={t.title} checked={t.done} onChange={()=>ops.tick(t.id)}/><button type="button" className="family-todo-title" aria-label={'Change '+t.title} onClick={()=>setEditing(t.id)}>{t.title}</button>{t.due&&<small className="family-todo-day">{t.repeat?'🔁 ':''}{todoDayLabel(t.due,today)}{t.repeat&&t.repeat!=='week'?' · '+repeatLabel(t.repeat).toLowerCase():''}</small>}{kid&&<small className="family-todo-kid">{(kid.emoji?kid.emoji+' ':'')+kid.name}</small>}</span>
   <button type="button" className="family-todo-remove" aria-label={'Remove '+t.title} onClick={()=>ops.remove(t.id)}>×</button>
  </li>})}</ul>}
  <form className="family-todo-add" onSubmit={e=>{e.preventDefault();void add()}}>
   <input aria-label="New family to-do" maxLength={300} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Groceries, clean house, sign permission slip…"/>
   {kids.length>0&&<select aria-label="For" value={forKid} onChange={e=>setForKid(e.target.value)}><option value="">Everyone</option>{kids.map(k=><option key={k.id} value={k.id}>{(k.emoji?k.emoji+' ':'')+k.name}</option>)}</select>}
   {otherDay?<input type="date" aria-label="When" min={today} value={day} onChange={e=>setDay(e.target.value)}/>:<select aria-label="When" value={day} onChange={e=>{if(e.target.value==='other'){setOtherDay(true);setDay(addDays(today,7))}else setDay(e.target.value)}}><option value="">Any day</option>{nextDays.map(d=><option key={d} value={d}>{todoDayLabel(d,today)}</option>)}<option value="other">Another day…</option></select>}
   {day&&<select aria-label="Repeat" className="family-todo-repeat" value={repeat} onChange={e=>setRepeat(e.target.value as TodoRepeat|'')}><option value="">Just once</option>{TODO_REPEATS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select>}
   <button type="submit" disabled={!title.trim()}>Add</button>
  </form>
  {(()=>{const t=todos.find(x=>x.id===editing);return t?<Modal title="Change to-do" close={()=>setEditing('')}><TodoEditor todo={t} kids={kids} onCancel={()=>setEditing('')} onDelete={()=>{ops.remove(t.id);setEditing('')}} onSave={changes=>{ops.update(t.id,changes);setEditing('')}}/></Modal>:null})()}
 </section>
}
