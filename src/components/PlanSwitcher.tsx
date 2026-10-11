import {useState,type CSSProperties} from 'react'
import Modal from './Modal'
import type {AppData} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {addKidPlan,familyPlanId,hashPin,kidOfPlan,makeFamilyPlan,planForKid,validPin} from '../store/familyPlans'

/** "Whose plan?" (the plan chip in the top bar): the parent's own plan and each kid's plan, one tap to
 * switch. Handing the phone to a kid locks it to the kid's plan on this device in one tap, so it opens
 * there and Settings stay hidden. A parent PIN is optional: without one, Unlock is a tap; with one, a kid
 * can't wander into the parent's plan (or a sibling's). */
export default function PlanSwitcher({data,save,close,lockedTo,setLock,onSwitch,askWho,setAskWho,onSetUpFamily}:{
 data:AppData;save:PlannerRepository['update'];close:()=>void
 lockedTo:string;setLock:(id:string)=>void;onSwitch:(id:string)=>void
 askWho:boolean;setAskWho:(on:boolean)=>void;onSetUpFamily:()=>void
}){
 const [pin,setPin]=useState(''),[newPin,setNewPin]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const active=data.profiles.find(p=>p.id===data.activeProfileId)
 const lockedPlan=lockedTo?data.profiles.find(p=>p.id===lockedTo):undefined
 const name=(id:string)=>{const p=data.profiles.find(x=>x.id===id),k=kidOfPlan(data,p);return k?(k.emoji?k.emoji+' ':'')+k.name+'’s plan':p?.label??'Plan'}
 const own=data.profiles.filter(p=>!p.kidId),familyId=familyPlanId(data)
 // Kids listed in any of the parent's plans, with or without a plan of their own yet.
 const kids=data.kids.filter(k=>own.some(p=>p.id===k.profileId))
 const unlock=async()=>{setError('');if(!data.settings.parentPin){setLock('');return}if(await hashPin(pin)!==data.settings.parentPin){setError('That PIN isn’t right.');return};setLock('');setPin('')}
 const lock=()=>{setLock(data.activeProfileId);close()}
 const [pinOpen,setPinOpen]=useState(false)
 const removePin=async()=>{setBusy(true);await save(d=>{const settings={...d.settings};delete settings.parentPin;return {...d,settings}});setBusy(false)}
 const savePin=async()=>{if(!validPin(newPin)){setError('Use 4 to 8 digits.');return}setBusy(true);const hash=await hashPin(newPin);const ok=await save(d=>({...d,settings:{...d.settings,parentPin:hash}}));setBusy(false);if(ok){setNewPin('');setError('');setPinOpen(false)}}
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
  <p className="plan-switcher-locked">🔒 This device is set to <strong>{name(lockedPlan.id)}</strong>.{data.settings.parentPin?' A parent can unlock it.':''}</p>
  {!data.settings.parentPin?<button type="button" className="primary" onClick={()=>void unlock()}>🔓 Unlock</button>:<form onSubmit={e=>{e.preventDefault();void unlock()}} className="plan-switcher-pin"><label>Parent PIN<input inputMode="numeric" autoComplete="off" type="password" maxLength={8} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))}/></label><button type="submit" className="primary" disabled={!pin}>Unlock</button></form>}
  {error&&<p role="alert">{error}</p>}
 </div></Modal>
 return <Modal title="Whose plan?" close={close}><div className="plan-switcher">
  <ul className="plan-switcher-list">
   {own.map(p=><li key={p.id}><button type="button" aria-current={p.id===active?.id?'true':undefined} onClick={()=>{onSwitch(p.id);close()}}><strong>{p.label}</strong><small>{p.id===familyId?'⭐ Family plan · everyone’s schedule':p.name}</small></button></li>)}
   {kids.map(k=>{const plan=planForKid(data,k.id);return <li key={k.id} style={{'--kid-color':k.color} as CSSProperties}><button type="button" className="is-kid" disabled={busy} aria-current={plan&&plan.id===active?.id?'true':undefined} onClick={()=>void openKid(k.id)}><strong>{(k.emoji?k.emoji+' ':'')+k.name+'’s plan'}</strong><small>{plan?'School, homework and island':'Make '+k.name+'’s own plan'}</small></button></li>})}
  </ul>
  {!kids.length&&<div className="plan-switcher-family"><p className="wb-muted">Planning for your kids too? Make this your family plan: add each kid, see everyone’s schedule here (tap names to show or hide them), and give each kid a plan of their own.</p><button type="button" onClick={()=>{close();onSetUpFamily()}}>👪 Set up my family</button></div>}
  {active&&!active.kidId&&familyId&&active.id!==familyId&&<button type="button" className="plan-switcher-make-family" disabled={busy} onClick={()=>void save(d=>makeFamilyPlan(d,active.id))}>⭐ Make “{active.label}” the family plan</button>}
  {own.length+kids.length>1&&<label className="plan-switcher-ask"><input type="checkbox" checked={askWho} onChange={e=>setAskWho(e.target.checked)}/> Ask “Who’s using KONO?” when it opens on this device</label>}
  {active?.kidId&&<section className="plan-switcher-hand" aria-label="Hand to kid">
   <p>Giving the phone to {kidOfPlan(data,active)?.name}? Lock it to this plan: it opens here and Settings stay hidden.</p>
   <button type="button" className="primary" onClick={lock}>🔒 Lock to {name(active.id)}</button>
   {data.settings.parentPin
    ?<p className="wb-muted plan-switcher-pin-note">Your parent PIN unlocks it. <button type="button" className="link-button" disabled={busy} onClick={()=>void removePin()}>Remove PIN</button></p>
    :pinOpen
     ?<form onSubmit={e=>{e.preventDefault();void savePin()}} className="plan-switcher-pin"><label>New parent PIN<input inputMode="numeric" autoComplete="off" type="password" maxLength={8} value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,''))}/></label><button type="submit" disabled={busy||!newPin}>Save PIN</button></form>
     :<p className="wb-muted plan-switcher-pin-note">Unlocking is one tap. <button type="button" className="link-button" onClick={()=>setPinOpen(true)}>Add a parent PIN</button> if your kid shouldn’t be able to.</p>}
  </section>}
  {error&&<p role="alert">{error}</p>}
 </div></Modal>
}
