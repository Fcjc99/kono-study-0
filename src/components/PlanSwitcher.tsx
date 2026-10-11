import {useState,type CSSProperties} from 'react'
import Modal from './Modal'
import type {AppData} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {addKidPlan,hashPin,kidOfPlan,planForKid,validPin} from '../store/familyPlans'

/** "Whose plan?" (the plan chip in the top bar): the parent's own plan and each kid's plan, one tap to
 * switch. Handing the phone to a kid locks it to the kid's plan on this device; only the parent PIN
 * unlocks it, so a kid can't wander into the parent's plan (or a sibling's). */
export default function PlanSwitcher({data,save,close,lockedTo,setLock,onSwitch}:{
 data:AppData;save:PlannerRepository['update'];close:()=>void
 lockedTo:string;setLock:(id:string)=>void;onSwitch:(id:string)=>void
}){
 const [pin,setPin]=useState(''),[newPin,setNewPin]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const active=data.profiles.find(p=>p.id===data.activeProfileId)
 const lockedPlan=lockedTo?data.profiles.find(p=>p.id===lockedTo):undefined
 const name=(id:string)=>{const p=data.profiles.find(x=>x.id===id),k=kidOfPlan(data,p);return k?(k.emoji?k.emoji+' ':'')+k.name+'’s plan':p?.label??'Plan'}
 const own=data.profiles.filter(p=>!p.kidId)
 // Kids listed in any of the parent's plans, with or without a plan of their own yet.
 const kids=data.kids.filter(k=>own.some(p=>p.id===k.profileId))
 const unlock=async()=>{setError('');if(!data.settings.parentPin)return;if(await hashPin(pin)!==data.settings.parentPin){setError('That PIN isn’t right.');return};setLock('');setPin('')}
 const lock=()=>{setLock(data.activeProfileId);close()}
 const savePin=async()=>{if(!validPin(newPin)){setError('Use 4 to 8 digits.');return}setBusy(true);const hash=await hashPin(newPin);const ok=await save(d=>({...d,settings:{...d.settings,parentPin:hash}}));setBusy(false);if(ok){setNewPin('');setError('')}}
 const openKid=async(kidId:string)=>{
  const kid=data.kids.find(k=>k.id===kidId);if(!kid)return
  const have=planForKid(data,kidId)
  if(have){onSwitch(have.id);close();return}
  setBusy(true);let id=''
  const url=new URL(location.href);url.searchParams.set('page','sanctuary');history.replaceState(null,'',url)
  const ok=await save(d=>{const r=addKidPlan(d,kid);id=r.id;return {...r.data,activeProfileId:r.id}})
  setBusy(false);if(ok&&id)close()
 }
 if(lockedPlan)return <Modal title="Whose plan?" close={close}><div className="plan-switcher">
  <p className="plan-switcher-locked">🔒 This device is set to <strong>{name(lockedPlan.id)}</strong>. A parent can unlock it.</p>
  <form onSubmit={e=>{e.preventDefault();void unlock()}} className="plan-switcher-pin"><label>Parent PIN<input inputMode="numeric" autoComplete="off" type="password" maxLength={8} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))}/></label><button type="submit" className="primary" disabled={!pin}>Unlock</button></form>
  {error&&<p role="alert">{error}</p>}
 </div></Modal>
 return <Modal title="Whose plan?" close={close}><div className="plan-switcher">
  <ul className="plan-switcher-list">
   {own.map(p=><li key={p.id}><button type="button" aria-current={p.id===active?.id?'true':undefined} onClick={()=>{onSwitch(p.id);close()}}><strong>{p.label}</strong><small>{p.name}</small></button></li>)}
   {kids.map(k=>{const plan=planForKid(data,k.id);return <li key={k.id} style={{'--kid-color':k.color} as CSSProperties}><button type="button" className="is-kid" disabled={busy} aria-current={plan&&plan.id===active?.id?'true':undefined} onClick={()=>void openKid(k.id)}><strong>{(k.emoji?k.emoji+' ':'')+k.name+'’s plan'}</strong><small>{plan?'School, homework and island':'Make '+k.name+'’s own plan'}</small></button></li>})}
  </ul>
  {!kids.length&&<p className="wb-muted">Planning for a kid too? Turn on parent mode in Settings › Family and add them under Kids; each kid can have a plan of their own.</p>}
  {active?.kidId&&<section className="plan-switcher-hand" aria-label="Hand to kid">
   {data.settings.parentPin
    ?<><p>Giving the phone to {kidOfPlan(data,active)?.name}? Lock it to this plan; your PIN unlocks it.</p><button type="button" className="primary" onClick={lock}>🔒 Lock to {name(active.id)}</button></>
    :<form onSubmit={e=>{e.preventDefault();void savePin()}}><p>Set a parent PIN to lock this device to a kid’s plan.</p><label>New parent PIN<input inputMode="numeric" autoComplete="off" type="password" maxLength={8} value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,''))}/></label><button type="submit" disabled={busy||!newPin}>Save PIN</button></form>}
  </section>}
  {error&&<p role="alert">{error}</p>}
 </div></Modal>
}
