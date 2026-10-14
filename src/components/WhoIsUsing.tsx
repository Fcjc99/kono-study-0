import type {CSSProperties} from 'react'
import Modal from './Modal'
import type {AppData} from '../store/model'
import {familyPlanId,kidOfPlan} from '../store/familyPlans'

/** "Who's using KONO?" (turned on per device under Whose plan?): on a shared phone or iPad, KONO opens on
 * a big tap-your-name picker, once each time the app is opened. */
export default function WhoIsUsing({data,close,onPick}:{data:AppData;close:()=>void;onPick:(profileId:string)=>void}){
 const familyId=familyPlanId(data)
 const plans=[...data.profiles.filter(p=>!p.kidId),...data.profiles.filter(p=>p.kidId&&kidOfPlan(data,p))]
 return <Modal title="Who’s using KONO?" close={close}><ul className="who-is-using">{plans.map(p=>{
  const kid=kidOfPlan(data,p)
  return <li key={p.id} style={{'--kid-color':kid?.color??'var(--wb-accent,#c76b8f)'} as CSSProperties}><button type="button" aria-current={p.id===data.activeProfileId?'true':undefined} onClick={()=>{onPick(p.id);close()}}>
   <span className="who-face" aria-hidden="true">{kid?.photo||(!kid&&p.photo)?<img className="avatar-img" src={kid?.photo||p.photo} alt="" draggable={false}/>:kid?kid.emoji||kid.name.charAt(0).toUpperCase():p.id===familyId?'👪':(p.avatar||p.name.trim().charAt(0).toUpperCase()||'✿')}</span>
   <strong>{kid?kid.name:p.name||p.label}</strong><small>{kid?'Their plan':p.id===familyId?'Family plan':p.label}</small>
  </button></li>})}</ul></Modal>
}
