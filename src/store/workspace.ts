import { normalizeData, uid, type AppData, type TrashEntry, type Task } from './model'
import { applyTaskCompletionChange, createSanctuaryProgress, syncCurrentTaskCompletion } from '../game/progression/progressionEngine'

export const collections = ['tasks','notes','exams','calendarEvents','subjects','studyPlans','flashcardDecks','studySeasons'] as const
export type Collection = typeof collections[number]
export type Entry = {id:string;profileId:string;[key:string]:unknown}
export const records = (data:AppData,key:Collection) => data[key] as unknown as Entry[]
export const titleOf = (entry:Entry) => String(entry.title??entry.name??'Untitled')
export const equal = (a:unknown,b:unknown) => JSON.stringify(a)===JSON.stringify(b)

/** Keep deleted records in the account document, not in a device-only toast. */
export function captureDeletions(before:AppData,after:AppData):AppData {
 const trash=[...after.trash]
 for(const key of collections) for(const item of records(before,key)){
  if(records(after,key).some(r=>r.id===item.id)||!after.profiles.some(p=>p.id===item.profileId))continue
  const payload=key==='studyPlans'?{record:item,tasks:before.tasks.filter(t=>t.studyPlanId===item.id)}:{record:item}
  // A canceled plan owns its removed units; avoid a second copy per unit.
  if(key==='tasks'&&item.studyPlanId&&!after.studyPlans.some(p=>p.id===item.studyPlanId))continue
  trash.push({id:uid('trash'),profileId:item.profileId,collection:key,title:titleOf(item),payload:JSON.stringify(payload),deletedAt:new Date().toISOString()})
 }
 for(const season of before.studySeasons){const current=after.studySeasons.find(s=>s.id===season.id);if(!current)continue;for(const [day,blocks] of Object.entries(season.week))for(const block of blocks){if(!current.week[day]?.some(b=>b.id===block.id))trash.push({id:uid('trash'),profileId:season.profileId,collection:'scheduleBlocks',title:block.label,payload:JSON.stringify({record:block,seasonId:season.id,day}),deletedAt:new Date().toISOString()})}}
 return {...after,trash:trash.filter(t=>t.collection==='scheduleBlocks'||!records(after,t.collection as Collection).some(r=>r.id===safeRecordId(t)))}
}
function safeRecordId(t:TrashEntry){try{return JSON.parse(t.payload)?.record?.id}catch{return undefined}}
export function restoreEntry(data:AppData,id:string):AppData {
 const entry=data.trash.find(t=>t.id===id&&t.profileId===data.activeProfileId)
 if(entry?.collection==='scheduleBlocks'){const payload=JSON.parse(entry.payload);const season=data.studySeasons.find(s=>s.id===payload.seasonId&&s.profileId===entry.profileId);if(!season||!Array.isArray(season.week[payload.day]))throw new Error('Restore the original season first.');if(season.week[payload.day].some(b=>b.id===payload.record.id))throw new Error('This block already exists.');return normalizeData({...data,trash:data.trash.filter(t=>t.id!==id),studySeasons:data.studySeasons.map(s=>s.id===season.id?{...s,week:{...s.week,[payload.day]:[...s.week[payload.day],payload.record]}}:s)})}
 if(!entry||!collections.includes(entry.collection as Collection))throw new Error('This item is no longer available.')
 const key=entry.collection as Collection
 const payload=JSON.parse(entry.payload) as {record:Entry;tasks?:Task[]}
 if(!payload.record||payload.record.profileId!==entry.profileId)throw new Error('This item belongs to another plan.')
 if(records(data,key).some(r=>r.id===payload.record.id))throw new Error('An item with this ID already exists. Nothing was overwritten.')
 let next={...data,[key]:[...records(data,key),payload.record],trash:data.trash.filter(t=>t.id!==id)}
 if(key==='tasks'&&payload.record.studyPlanId){
  // Individual removed units return as independent assignments, without changing the current plan.
  next={...next,tasks:next.tasks.map(t=>t.id===payload.record.id?{...t,studyPlanId:undefined,unitNumber:undefined}:t)}
 }
 if(key==='studyPlans'){
  const tasks=payload.tasks??[]
  if(tasks.some(t=>t.profileId!==entry.profileId))throw new Error('Invalid plan ownership.')
  const conflict=tasks.some(t=>data.tasks.some(current=>current.id===t.id&&!equal({...current,studyPlanId:t.studyPlanId,unitNumber:t.unitNumber},t)))
  if(conflict)throw new Error('Some completed work changed after cancellation. Use Undo immediately after cancellation, or restore a backup to review the old plan safely.')
  next={...next,tasks:[...data.tasks.filter(t=>!tasks.some(old=>old.id===t.id)),...tasks]}
 }
 return normalizeData(next)
}
export function removeEntry(data:AppData,key:Collection,id:string):AppData {
 const item=records(data,key).find(r=>r.id===id&&r.profileId===data.activeProfileId)
 if(!item)return data
 let next={...data,[key]:records(data,key).filter(r=>r.id!==id)} as AppData
 if(key==='tasks'&&item.studyPlanId){
  const remaining=next.tasks.filter(t=>t.studyPlanId===item.studyPlanId).sort((a,b)=>a.unitNumber!-b.unitNumber!)
  next={...next,studyPlans:next.studyPlans.flatMap(p=>p.id===item.studyPlanId?(remaining.length?[{...p,total:remaining.length}]:[]):[p]),tasks:next.tasks.map(t=>t.studyPlanId===item.studyPlanId?{...t,unitNumber:remaining.findIndex(r=>r.id===t.id)+1}:t)}
 }
 return next
}
export function completeTask(data:AppData,id:string,done?:boolean):AppData {
 const task=data.tasks.find(t=>t.id===id&&t.profileId===data.activeProfileId)
 if(!task)return data
 const completed=done??!task.done,now=new Date().toISOString()
 const progress=applyTaskCompletionChange(data.sanctuaryProgress[task.profileId]??createSanctuaryProgress(task.profileId),{task:{...task,subjectKey:data.subjects.find(s=>s.id===task.subjectId)?.name??task.subjectId},completed,completedAt:now})
 const tasks=data.tasks.map(t=>t.id===id?{...t,done:completed,completedAt:completed?now:undefined}:t)
 return {...data,tasks,sanctuaryProgress:{...data.sanctuaryProgress,[task.profileId]:syncCurrentTaskCompletion(progress,tasks,now)}}
}
