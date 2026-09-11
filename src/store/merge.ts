import { applyTaskCompletionChange, syncCurrentTaskCompletion } from '../game/progression/progressionEngine'
import { normalizeData, type AppData } from './model'

type Json=undefined|null|string|number|boolean|Json[]|{[key:string]:Json}
export type MergeConflict={path:string;base:unknown;local:unknown;remote:unknown}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const record=(v:Json):v is {[key:string]:Json}=>!!v&&typeof v==='object'&&!Array.isArray(v)
const identified=(v:Json[]):boolean=>v.every(x=>record(x)&&typeof x.id==='string')

/** A full-snapshot three-way merge. Absence is deletion only relative to this exact base. */
export function mergeData(base:AppData,local:AppData,remote:AppData):{data:AppData;conflicts:MergeConflict[]} {
 const conflicts:MergeConflict[]=[]
 function merge(b:Json,l:Json,r:Json,path:string):Json {
  if(equal(l,r))return l
  if(equal(l,b))return r
  if(equal(r,b))return l
  // Concurrent creation and edit/delete are conflicts, never silent resurrection.
  if(b===undefined||l===undefined||r===undefined){conflicts.push({path,base:b,local:l,remote:r});return l}
  if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)&&identified(b)&&identified(l)&&identified(r)){
   const index=(items:Json[])=>new Map(items.map(x=>[(x as {[key:string]:Json}).id as string,x]))
   const bm=index(b),lm=index(l),rm=index(r),out:Json[]=[]
   for(const key of new Set([...lm.keys(),...rm.keys(),...bm.keys()])){
    const value=merge(bm.get(key),lm.get(key),rm.get(key),`${path}/${key}`);if(value!==undefined)out.push(value)
   }
   return out
  }
  if(record(b)&&record(l)&&record(r)){
   const out:{[key:string]:Json}={}
   for(const key of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
    const value=merge(b[key],l[key],r[key],`${path}/${key}`);if(value!==undefined)out[key]=value
   }
   return out
  }
  conflicts.push({path,base:b,local:l,remote:r});return l
 }
 const clone=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Json
 const b=clone(base) as {[key:string]:Json},l=clone(local) as {[key:string]:Json},r=clone(remote) as {[key:string]:Json}
 // Navigation never travels between devices. Progress needs ledger-aware merging.
 delete b.activeProfileId;delete l.activeProfileId;delete r.activeProfileId
 delete b.sanctuaryProgress;delete l.sanctuaryProgress;delete r.sanctuaryProgress
 const raw=merge(b,l,r,'') as unknown as AppData
 raw.activeProfileId=local.activeProfileId
 raw.sanctuaryProgress={}
 const profileSlice=(doc:AppData,pid:string)=>({profile:doc.profiles.find(p=>p.id===pid),tasks:doc.tasks.filter(t=>t.profileId===pid),progress:doc.sanctuaryProgress[pid]})
 for(const profile of raw.profiles){
  const pid=profile.id,bp=base.profiles.find(p=>p.id===pid),lp=local.profiles.find(p=>p.id===pid),rp=remote.profiles.find(p=>p.id===pid)
  const original=base.sanctuaryProgress[pid],left=local.sanctuaryProgress[pid],right=remote.sanctuaryProgress[pid]
  const localReset=bp&&lp?.progressEpoch!==bp.progressEpoch,remoteReset=bp&&rp?.progressEpoch!==bp.progressEpoch
  if(!equal(profileSlice(local,pid),profileSlice(remote,pid))&&((localReset&&!equal(profileSlice(base,pid),profileSlice(remote,pid)))||(remoteReset&&!equal(profileSlice(base,pid),profileSlice(local,pid))))){
   conflicts.push({path:`/profiles/${pid}/reset`,base:profileSlice(base,pid),local:profileSlice(local,pid),remote:profileSlice(remote,pid)})
   raw.sanctuaryProgress[pid]=left??right;continue
  }
  if(equal(left,right)||equal(right,original)||!right){raw.sanctuaryProgress[pid]=left;continue}
  if(equal(left,original)||!left||!original){raw.sanctuaryProgress[pid]=right;continue}
  let merged=original
  const newIds=[...new Set([...left.creditedTaskIds,...right.creditedTaskIds])].filter(x=>!original.creditedTaskIds.includes(x))
  for(const taskId of newIds){
   const task=raw.tasks.find(t=>t.id===taskId&&t.profileId===pid)??local.tasks.find(t=>t.id===taskId&&t.profileId===pid)??remote.tasks.find(t=>t.id===taskId&&t.profileId===pid)
   if(!task){conflicts.push({path:`/sanctuaryProgress/${pid}/${taskId}`,base:original,local:left,remote:right});continue}
   const completedAt=task.completedAt??(left.creditedTaskIds.includes(taskId)?left.lastTaskCompletedAt:right.lastTaskCompletedAt)??undefined
   const subject=raw.subjects.find(s=>s.id===task.subjectId&&s.profileId===pid)
   merged=applyTaskCompletionChange(merged,{task:{...task,subjectKey:subject?.name??task.subjectId},completed:true,completedAt})
  }
  raw.sanctuaryProgress[pid]=syncCurrentTaskCompletion(merged,raw.tasks,[left.updatedAt,right.updatedAt].sort().at(-1))
 }
 // Do not partially publish a conflict, even if other fields could merge.
 if(conflicts.length)return {data:local,conflicts}
 try{return {data:normalizeData(raw),conflicts:[]}}catch(error){return {data:local,conflicts:[{path:'/references',base:null,local:error instanceof Error?error.message:'Invalid merged references',remote:null}]}}
}
