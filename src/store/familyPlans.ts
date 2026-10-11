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

/** The family plan: the parent's plan the kids are listed in (one of the parent's own plans). */
export const familyPlanId=(data:Pick<AppData,'profiles'|'kids'>)=>data.kids.map(k=>k.profileId).find(id=>data.profiles.some(p=>p.id===id&&!p.kidId))
/** Make another of the parent's own plans the family plan: the kids (and their tags) go with it. */
export function makeFamilyPlan(data:AppData,profileId:string):AppData{
 const plan=data.profiles.find(p=>p.id===profileId)
 if(!plan||plan.kidId)throw Error('Pick one of your own plans.')
 return {...data,kids:data.kids.map(k=>data.profiles.some(p=>p.id===k.profileId&&!p.kidId)?{...k,profileId}:k)}
}

/** The family plan's calendar: its own things plus everything in each kid's own plan, shown as that kid's
 * (for Home and the Planner only). Items keep their IDs, so opening, moving or finishing one changes
 * it where it lives, in the kid's plan. `home` maps each borrowed item back to its own plan. */
export function familyView(data:AppData,parentProfileId:string):{data:AppData;home:Map<string,string>}{
 const plans=kidPlans(data,parentProfileId),home=new Map<string,string>()
 if(!plans.length)return {data,home}
 const kidOf=new Map(plans.map(({kid,plan})=>[plan.id,kid.id]))
 const borrow=<T extends {id:string;profileId:string}>(list:T[])=>list.map(x=>{const kidId=kidOf.get(x.profileId);if(!kidId)return x;home.set(x.id,x.profileId);return {...x,profileId:parentProfileId,kidId}})
 return {data:{...data,tasks:borrow(data.tasks),exams:borrow(data.exams),calendarEvents:borrow(data.calendarEvents),studySeasons:borrow(data.studySeasons)},home}
}

/** Who an item is for, from the family plan: a kid with a plan of their own gets it in their plan (so it's
 * on their device); anyone else is a tag in the family plan. A subject from the other plan doesn't come along. */
export function moveToWhose<T extends {profileId:string;kidId?:string;subjectId?:string}>(data:Pick<AppData,'profiles'|'subjects'>,item:T,familyId:string,kidId:string|undefined):T{
 const plan=kidId?planForKid(data,kidId):undefined,profileId=plan?.id??familyId
 const subjectId=item.subjectId&&data.subjects.some(s=>s.id===item.subjectId&&s.profileId===profileId)?item.subjectId:''
 return {...item,profileId,kidId:plan?undefined:kidId,...(item.subjectId===undefined?{}:{subjectId})}
}
