import {useState} from 'react'
import type {AppData} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {addGroceries,clearBought,dinnerOn,setDinner,toggleGrocery} from '../store/meals'

const addDays=(iso:string,n:number)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
const IDEAS=['Tacos','Pasta','Stir fry','Pizza','Soup & sandwiches','Leftovers','Breakfast for dinner']

/** Home › Dinners & groceries: the next seven dinners (tap a day to write one in) and the family's
 * grocery list (type a few, comma or Enter between them; tick what's in the cart). */
export default function MealPlan({data,profileId,today,save}:{data:AppData;profileId:string;today:string;save:PlannerRepository['update']}){
 const days=Array.from({length:7},(_,i)=>addDays(today,i))
 const [editing,setEditing]=useState(''),[text,setText]=useState(''),[grocery,setGrocery]=useState('')
 const groceries=(data.groceries??[]).filter(g=>g.profileId===profileId)
 const left=groceries.filter(g=>!g.done),bought=groceries.filter(g=>g.done)
 const day=(iso:string)=>iso===today?'Today':new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})
 const commit=(iso:string,title:string)=>{setEditing('');void save(d=>setDinner(d,profileId,iso,title,today))}
 return <section className="wb-panel meal-plan" aria-label="Dinners & groceries">
  <div className="wb-section-head"><h2>🍽️ Dinners & groceries</h2></div>
  <ol className="meal-days" aria-label="Dinners this week">{days.map(iso=>{const m=dinnerOn(data,profileId,iso)
   return <li key={iso} className={(iso===today?'is-today ':'')+(m?'has-meal':'')}>
    <small>{day(iso)}</small>
    {editing===iso?<form onSubmit={e=>{e.preventDefault();commit(iso,text)}}>
     <input aria-label={'Dinner on '+day(iso)} value={text} onChange={e=>setText(e.target.value)} list="meal-ideas" maxLength={200} autoFocus onBlur={()=>commit(iso,text)}/>
    </form>:<button type="button" aria-label={(m?'Dinner '+day(iso)+': '+m.title:'Add dinner for '+day(iso))} onClick={()=>{setText(m?.title??'');setEditing(iso)}}>{m?m.title:<span className="meal-empty">＋</span>}</button>}
   </li>})}</ol>
  <datalist id="meal-ideas">{IDEAS.map(i=><option key={i} value={i}/>)}</datalist>
  <div className="grocery-list">
   <h3>🛒 Groceries{left.length?<small> · {left.length}</small>:null}</h3>
   <form className="grocery-add" onSubmit={e=>{e.preventDefault();if(!grocery.trim())return;void save(d=>addGroceries(d,profileId,grocery));setGrocery('')}}>
    <input aria-label="Add groceries" placeholder="Milk, eggs, apples…" value={grocery} onChange={e=>setGrocery(e.target.value)} maxLength={600}/>
    <button type="submit" disabled={!grocery.trim()}>Add</button>
   </form>
   {groceries.length?<ul aria-label="Grocery list">{[...left,...bought].map(g=><li key={g.id} className={g.done?'is-done':''}><label className="wb-check"><input type="checkbox" checked={g.done} onChange={()=>void save(d=>toggleGrocery(d,g.id))}/>{g.title}</label></li>)}</ul>
   :<p className="wb-muted">Nothing on the list. Anyone in the family can add to it.</p>}
   {bought.length>0&&<button type="button" className="link-button" onClick={()=>void save(d=>clearBought(d,profileId))}>Clear {bought.length} in the cart</button>}
  </div>
 </section>
}
