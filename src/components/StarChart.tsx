import {useState,type CSSProperties} from 'react'
import {uid,type AppData,type Kid,type StarReward} from '../store/model'
import {STARTER_REWARDS,chartFor,redeem,starsOf} from '../store/choreStars'
import type {PlannerRepository} from '../store/repository'
import Avatar from './Avatar'

const KidAvatar=({kid}:{kid:Kid})=><Avatar className="kid-look-avatar" who={{name:kid.name,emoji:kid.emoji,photo:kid.photo}} style={{'--kid-color':kid.color} as CSSProperties}/>

/** Kids › Star chart: each kid's stars (earned by ticking their chores) and the reward shelf. A parent
 * ticks a chore here or anywhere else; a reward is redeemed once the kid has enough stars. */
export default function StarChart({data,profileId,kids,today,weekStart,save,onTick}:{data:AppData;profileId:string;kids:Kid[];today:string;weekStart:string;save:PlannerRepository['update'];onTick:(todoId:string)=>void}){
 const [adding,setAdding]=useState(false),[title,setTitle]=useState(''),[cost,setCost]=useState(10),[emoji,setEmoji]=useState('🎁')
 const [cheer,setCheer]=useState<{kidId:string;text:string}|null>(null)
 const rewards=(data.starRewards??[]).filter(r=>r.profileId===profileId).sort((a,b)=>a.cost-b.cost)
 const addReward=(r:Omit<StarReward,'id'|'profileId'>)=>void save(d=>({...d,starRewards:[...(d.starRewards??[]),{id:uid('reward'),profileId,...r}]}))
 const removeReward=(id:string)=>void save(d=>({...d,starRewards:(d.starRewards??[]).filter(r=>r.id!==id)}))
 const spend=(kid:Kid,r:StarReward)=>{
  if(!confirm(`Give ${kid.name} “${r.title}” for ${r.cost} stars?`))return
  void save(d=>{const log=redeem(d.starLog??[],kid.id,r);return log?{...d,starLog:log}:d}).then(ok=>{if(ok)setCheer({kidId:kid.id,text:(r.emoji?r.emoji+' ':'')+r.title+'!'})})
 }
 return <section className="star-chart" aria-label="Star chart">
  <div className="star-chart-head"><h3>⭐ Star chart</h3><p className="wb-muted">Chores for a kid earn stars when they’re ticked. Stars buy rewards from the shelf.</p></div>
  <div className="star-chart-kids">{kids.map(kid=>{const c=chartFor(data,profileId,kid.id,weekStart)
   return <article key={kid.id} className="star-kid" style={{'--kid-color':kid.color} as CSSProperties} aria-label={kid.name+'’s stars'}>
    <header><KidAvatar kid={kid}/><div><strong>{kid.name}</strong><small>{c.week} this week</small></div><span className="star-kid-total" aria-label={c.stars+' stars'}>⭐ {c.stars}</span></header>
    {cheer?.kidId===kid.id&&<p className="star-kid-cheer" role="status">🎉 {cheer.text}</p>}
    {c.chores.length?<ul className="star-kid-chores" aria-label={kid.name+'’s chores'}>{c.chores.slice(0,6).map(t=><li key={t.id}><button type="button" onClick={()=>onTick(t.id)} aria-label={'Done: '+t.title}><span aria-hidden="true">○</span>{t.title}{t.due&&t.due>today?<small> · {new Date(t.due+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})}</small>:null}<b>+{starsOf(t)}⭐</b></button></li>)}</ul>
    :<p className="wb-muted star-kid-empty">No chores yet. Add a to-do for {kid.name} and it earns stars here.</p>}
    {rewards.length>0&&<div className="star-kid-rewards" role="group" aria-label={'Rewards for '+kid.name}>{rewards.map(r=><button type="button" key={r.id} disabled={c.stars<r.cost} onClick={()=>spend(kid,r)} title={c.stars<r.cost?(r.cost-c.stars)+' more stars':'Redeem'}>{r.emoji??'🎁'} {r.title} <small>{r.cost}⭐</small></button>)}</div>}
    {c.recent.length>0&&<details className="star-kid-log"><summary>Recent stars</summary><ul>{c.recent.map(e=><li key={e.id}><span>{e.note}</span><b className={e.n<0?'is-spent':''}>{e.n>0?'+':''}{e.n}⭐</b></li>)}</ul></details>}
   </article>})}</div>
  <div className="star-shelf">
   <h4>🎁 Reward shelf</h4>
   {rewards.length?<ul>{rewards.map(r=><li key={r.id}><span>{r.emoji??'🎁'} {r.title}</span><b>{r.cost}⭐</b><button type="button" className="link-button" aria-label={'Remove '+r.title} onClick={()=>removeReward(r.id)}>Remove</button></li>)}</ul>
   :<p className="wb-muted">No rewards yet. <button type="button" className="link-button" onClick={()=>void save(d=>({...d,starRewards:[...(d.starRewards??[]),...STARTER_REWARDS.map(r=>({id:uid('reward'),profileId,...r}))]}))}>Add a few to start</button></p>}
   {adding?<form className="star-shelf-add" onSubmit={e=>{e.preventDefault();if(!title.trim())return;addReward({title:title.trim().slice(0,120),cost,...(emoji.trim()?{emoji:emoji.trim().slice(0,4)}:{})});setTitle('');setAdding(false)}}>
    <input aria-label="Reward emoji" value={emoji} onChange={e=>setEmoji(e.target.value)} maxLength={4} className="star-emoji"/>
    <input aria-label="Reward" placeholder="Pizza night" value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} autoFocus/>
    <label>Stars<input type="number" min={1} max={1000} value={cost} onChange={e=>setCost(Math.max(1,Math.min(1000,Number(e.target.value)||1)))}/></label>
    <button type="submit" className="primary">Add</button><button type="button" onClick={()=>setAdding(false)}>Cancel</button>
   </form>:<button type="button" onClick={()=>setAdding(true)}>＋ Add a reward</button>}
  </div>
 </section>
}
