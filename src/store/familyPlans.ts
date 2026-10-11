import {uid,localDate,type AppData,type Kid,type Profile} from './model'
import {createSanctuaryProgress} from '../game/progression/progressionEngine'

/** Family plans: in a parent's account, each kid can have their own plan (their school, homework and
 * island), next to the parent's own. The parent switches between plans; handed to a kid, the device can
 * be locked to the kid's plan until the parent PIN is entered (store the lock per device, see
 * PlanSwitcher). Kids without a plan are still just tags in the parent's plan, as before. */
export const planForKid=(data:Pick<AppData,'profiles'>,kidId:string)=>data.profiles.find(p=>p.kidId===kidId)
export const kidOfPlan=(data:Pick<AppData,'kids'>,profile:Pick<Profile,'kidId'>|undefined)=>profile?.kidId?data.kids.find(k=>k.id===profile.kidId):undefined
/** The plans of the kids listed in this (parent's) plan. */
export const kidPlans=(data:Pick<AppData,'profiles'|'kids'>,parentProfileId:string)=>data.kids.filter(k=>k.profileId===parentProfileId).flatMap(k=>{const p=planForKid(data,k.id);return p?[{kid:k,plan:p}]:[]})

/** A kid's own plan, made the first time a parent opens it; the parent's plan stays as it is. */
export function addKidPlan(data:AppData,kid:Kid):{data:AppData;id:string}{
 const existing=planForKid(data,kid.id)
 if(existing)return {data,id:existing.id}
 const id=uid('profile'),start=localDate(),end=new Date(Date.now()+300*86400000).toISOString().slice(0,10)
 const plan:Profile={id,name:kid.name,label:kid.name+'’s plan',kind:'school',start,end,progressEpoch:uid('epoch'),kidId:kid.id}
 return {data:{...data,profiles:[...data.profiles,plan],sanctuaryProgress:{...data.sanctuaryProgress,[id]:createSanctuaryProgress(id)}},id}
}

/** The parent PIN is kept as a SHA-256 hash (it only guards switching plans on a shared device). */
export async function hashPin(pin:string):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('kono-parent-pin:'+pin))
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')
}
export const validPin=(pin:string)=>/^\d{4,8}$/.test(pin)
