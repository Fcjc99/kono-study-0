import { useEffect, useState, useSyncExternalStore, type SetStateAction } from 'react'
import { createFreshData, normalizeData, randomId, type AppData } from './model'
import { commitCache, decodeData, deleteCache, downloadData, exportData, readCache, readLegacy, type CacheEntry, type RecoveryFile } from './localRepository'
import { captureDeletions } from './workspace'
import { mergeData, type MergeConflict } from './merge'
import type {SupabaseRemote} from './supabaseRemote'
import { buildSharedSnapshot } from './peerShare'
type User={id:string;email:string;name:string}
type Remote={revision:number;data:AppData|null}
export type RepositoryState={data:AppData;ready:boolean;status:string;error:string;user:User|null;recovery:RecoveryFile[];needsMigration:boolean;conflicts:MergeConflict[];savedAt:string|null}
const message=(e:unknown)=>e instanceof Error?e.message:'Could not save. Export your working copy before leaving.'
const content=(data:AppData)=>JSON.stringify({...data,activeProfileId:undefined})
const remoteValue=(value:unknown):Remote=>{const r=value as Remote;if(!r||!Number.isSafeInteger(r.revision)||r.revision<0||!('data' in r))throw new Error('Invalid cloud response. Your device copy is preserved.');return {revision:r.revision,data:r.data===null?null:normalizeData(r.data)}}
/** One queue owns account transitions, transactions and acknowledgements.
 * Queued edits capture their account generation and cannot cross into another account. */
export class PlannerRepository {
 private state:RepositoryState={data:createFreshData(),ready:false,status:'Loading',error:'',user:null,recovery:[],needsMigration:false,conflicts:[],savedAt:null}
 private undoStack:{before:AppData;after:AppData}[]=[]
 private redoStack:{before:AppData;after:AppData}[]=[]
 private historyMove=false
 get canUndo(){return this.undoStack.length>0}
 get canRedo(){return this.redoStack.length>0}
 undo=()=>this.travel('undo')
 redo=()=>this.travel('redo')
 private async travel(direction:'undo'|'redo'){
  const source=direction==='undo'?this.undoStack:this.redoStack,target=direction==='undo'?this.redoStack:this.undoStack,item=source.at(-1)
  if(!item||this.historyMove)return false
  this.historyMove=true
  try{const saved=await this.update(current=>{const result=mergeData(direction==='undo'?item.after:item.before,direction==='undo'?item.before:item.after,current);if(result.conflicts.length)throw new Error('This item changed elsewhere. Undo was stopped to protect newer work.');return {...result.data,sanctuaryProgress:current.sanctuaryProgress}});if(saved){source.pop();target.push(item);this.notify({})}return saved}finally{this.historyMove=false}
 }
 private listeners=new Set<()=>void>()
 private cache:CacheEntry|null=null
 private scope='device'
 private queue=Promise.resolve()
 private generation=0
 private disposed=false
 private blocked=false
 private unsaved=false
 private syncQueued=false
 private timer:number|undefined
 private channel:BroadcastChannel|null=null
 private migration:AppData|null=null
 private cloud:SupabaseRemote|null=null
 private authUnsubscribe:(()=>void)|null=null
 get signInProvider(){return this.cloud?'email':'chatgpt'}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
 getSnapshot=()=>this.state
 private notify(patch:Partial<RepositoryState>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn())}
 private valid=(generation:number)=>!this.disposed&&generation===this.generation
 private enqueue(job:(generation:number)=>Promise<void>){
  const generation=this.generation
  const result=this.queue.then(async()=>{if(this.valid(generation))await job(generation)})
  this.queue=result.catch(error=>{if(this.valid(generation))this.notify({status:this.unsaved?'Unsaved':'Needs attention',error:message(error)})})
  return result
 }
 private api=async(path:string,init?:RequestInit)=>{
  if(this.cloud)return this.cloud.request(path,init,this.state.user?.id??'')
  const response=await fetch('/api/'+path,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Kono-Request':'1','X-Kono-Data-Version':'6','X-Kono-Account-ID':this.state.user?.id??'',...init?.headers},signal:AbortSignal.timeout(10000)})
  if(response.status===401){this.blocked=true;throw new Error('Your session ended. Export pending work, then sign in again. Your device copy is preserved.')}
  if(response.status===426){this.blocked=true;throw new Error('A newer KONO version is required. Export unsaved work, then reload before syncing.')}
  return response
 }
 async start(){
  this.disposed=false;this.blocked=false
  const generation=++this.generation,legacy=readLegacy()
  let local:CacheEntry|null=null,error=''
  try{local=await readCache('device')}catch(e){error=message(e)}
  if(!this.valid(generation))return
  this.scope='device';this.cache=local;this.blocked=!!error
  this.migration=local?.data??(legacy.found?legacy.data:null)
  this.notify({data:local?.data??legacy.data,recovery:legacy.recovery,error,status:error?'Recovery needed':'Saved on this device'})
  try{
   const supabaseUrl=typeof __KONO_SUPABASE_URL__==='string'?__KONO_SUPABASE_URL__:''
   const supabaseKey=typeof __KONO_SUPABASE_ANON_KEY__==='string'?__KONO_SUPABASE_ANON_KEY__:''
   let user:User|null=null
   if(supabaseUrl&&supabaseKey){
    const {SupabaseRemote}=await import('./supabaseRemote')
    this.cloud=new SupabaseRemote(supabaseUrl,supabaseKey)
    user=await this.cloud.session()
    this.authUnsubscribe=this.cloud.onAuthChange((event,next)=>{
     if(event==='SIGNED_IN'&&next?.id!==this.state.user?.id)window.location.reload()
    })
   }else{
    const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(5000)})
    if(response.ok&&response.headers.get('content-type')?.includes('application/json'))user=(await response.json() as {user:User|null}).user
   }
   if(!this.valid(generation))return
   if(user){
    if(typeof user.id!=='string'||!user.id||user.id.length>200||typeof user.email!=='string')throw new Error('Invalid account response.')
    await this.openAccount(user,generation)
   }
  }catch(e){if(this.valid(generation)&&this.state.user)this.notify({status:'Offline or sync unavailable',error:message(e)})}
  if(!this.valid(generation))return
  this.notify({ready:true})
  if(typeof BroadcastChannel!=='undefined'){this.channel=new BroadcastChannel('kono-plan-changes');this.channel.onmessage=()=>{void this.enqueue(g=>this.reloadOtherTab(g)).catch(()=>undefined)}}
  window.addEventListener('online',this.handleOnline);window.addEventListener('focus',this.handleOnline);window.addEventListener('beforeunload',this.warnUnsaved)
  this.timer=window.setInterval(()=>{if(document.visibilityState==='visible')this.retry()},15000)
 }
 private async openAccount(user:User,generation:number){
  this.undoStack=[];this.redoStack=[];this.scope='account:'+user.id;this.cache=null;this.blocked=false
  this.notify({user,data:createFreshData(),status:'Connecting',error:''})
  try{this.cache=await readCache(this.scope)}catch(e){this.blocked=true;throw e}
  if(!this.valid(generation))return
  if(this.cache)this.notify({data:this.cache.data})
  const response=await this.api('plan');if(!response.ok)throw new Error('Cloud plan unavailable. Retry when connected.')
  const remote=remoteValue(await response.json());if(!this.valid(generation))return
  if(!this.cache){
   if(remote.data)await this.saveCache(remote.data,remote.data,remote.revision,false,generation)
   else{await this.saveCache(this.state.data,null,remote.revision,false,generation);this.notify({needsMigration:remote.revision===0&&!!this.migration,status:'Account ready'})}
  }else await this.acceptRemote(remote,generation)
 }
 private warnUnsaved=(event:BeforeUnloadEvent)=>{if(this.cache?.pending||this.state.status==='Unsaved'||this.state.status==='Saving'){event.preventDefault();event.returnValue=''}}
 private handleOnline=()=>this.retry()
 dispose(){this.disposed=true;this.generation++;this.syncQueued=false;if(this.timer)clearInterval(this.timer);this.channel?.close();this.authUnsubscribe?.();this.authUnsubscribe=null;window.removeEventListener('online',this.handleOnline);window.removeEventListener('focus',this.handleOnline);window.removeEventListener('beforeunload',this.warnUnsaved)}
 private async saveCache(data:AppData,base:AppData|null,serverRevision:number,pending:boolean,generation:number){
  const saved=await commitCache(this.scope,this.cache,{version:6,revision:this.cache?.revision??0,data,base,serverRevision,pending,backups:[]})
  if(!this.valid(generation))return
  this.cache=saved
  this.unsaved=false
  this.notify({data:saved.data,status:saved.pending?'Saved locally — sync pending':this.state.user?'Saved to your account':'Saved on this device',savedAt:new Date().toISOString(),error:''})
  this.channel?.postMessage({scope:this.scope})
 }
 update=(action:SetStateAction<AppData>)=>{
  if(!this.state.ready||this.blocked||this.state.needsMigration)return Promise.resolve(false)
  let saved=false
  return this.enqueue(async generation=>{
   if(this.blocked||this.state.needsMigration)return
   const before=this.state.data,draft=typeof action==='function'?action(before):action
   if(draft===before){saved=!this.unsaved;return}
   const data=normalizeData(this.historyMove?draft:captureDeletions(before,draft))
   this.unsaved=true;this.notify({data,status:'Saving',error:''})
   try{await this.saveCache(data,this.cache?.base??null,this.cache?.serverRevision??0,!!this.state.user&&(this.cache?.pending||content(before)!==content(data)),generation)}
   catch(e){if(this.valid(generation))this.notify({status:'Unsaved',error:message(e)});return}
   this.scheduleSync()
   saved=this.valid(generation)
   if(saved&&before.activeProfileId!==data.activeProfileId){this.undoStack=[];this.redoStack=[]}
   else if(saved&&!this.historyMove){this.undoStack.push({before,after:this.state.data});if(this.undoStack.length>30)this.undoStack.shift();this.redoStack=[];this.notify({})}
  }).then(()=>saved).catch(()=>false)
 }
 private async reloadOtherTab(generation:number){
  if(this.unsaved||this.state.conflicts.length)return
  const latest=await readCache(this.scope);if(!this.valid(generation))return
  if(latest&&latest.revision>(this.cache?.revision??0)){this.cache=latest;this.notify({data:normalizeData({...latest.data,activeProfileId:this.state.data.activeProfileId}),status:latest.pending?'Sync pending':this.state.user?'Saved':'Saved on this device'})}
 }
 private async acceptRemote(remote:Remote,generation:number){
  if(remote.revision===(this.cache?.serverRevision??0)){
   if(!this.unsaved&&!this.state.conflicts.length)this.notify({status:this.cache?.pending?'Saved locally — sync pending':'Saved',error:''})
   return
  }
  let data=remote.data
  if(this.cache?.pending){
   if(!remote.data||!this.cache.base){this.notify({status:'Needs attention',conflicts:[{path:'/account',base:this.cache.base,local:this.state.data,remote:remote.data}],error:remote.data?'This account has another plan. Choose a copy explicitly.':'Cloud data was deleted on another device. Your local copy has NOT been uploaded again.'});return}
   const result=mergeData(this.cache.base,this.state.data,remote.data)
   if(result.conflicts.length){this.notify({status:'Needs attention',conflicts:result.conflicts,error:'Two devices changed the same information. Export your working copy before choosing a version.'});return}
   data=result.data
  }
  const next=normalizeData({...data??createFreshData(),activeProfileId:this.state.data.activeProfileId})
  await this.saveCache(next,remote.data,remote.revision,!!this.cache?.pending,generation)
 }
 private scheduleSync(){
  if(this.syncQueued||!this.state.user||this.blocked||this.state.needsMigration||this.state.conflicts.length)return
  this.syncQueued=true
  void this.enqueue(g=>this.syncNow(g)).catch(()=>undefined).finally(()=>{this.syncQueued=false})
 }
 private async syncNow(generation:number){
  if(!this.state.user||this.blocked||this.state.needsMigration||this.state.conflicts.length||this.unsaved)return
  if(!navigator.onLine){this.notify({status:'Offline — changes kept on this device'});return}
  if(this.cloud)this.cloud.publishSharedSnapshot(buildSharedSnapshot(this.state.data)).catch(()=>undefined)
  await this.reloadOtherTab(generation)
  const response=await this.api('plan');if(!response.ok)throw new Error('Cloud sync unavailable. Your device copy is preserved.')
  const remote=remoteValue(await response.json());if(!this.valid(generation))return
  await this.acceptRemote(remote,generation)
  if(!this.valid(generation)||this.state.conflicts.length||!this.cache?.pending)return
  const data=this.state.data
  const saved=await this.api('plan',{method:'PUT',body:JSON.stringify({expectedRevision:this.cache.serverRevision,operationId:randomId(),data})})
  if(!this.valid(generation))return
  if(saved.status===409){this.notify({status:'Sync retry pending'});return}
  if(!saved.ok){const problem=await saved.json().catch(()=>({error:'Cloud saving failed.'})) as {error?:string};throw new Error(problem.error??'Cloud saving failed.')}
  const ack=await saved.json() as {revision:number}
  if(!Number.isSafeInteger(ack.revision)||!this.valid(generation))return
  await this.saveCache(data,data,ack.revision,false,generation)
 }
 export=()=>exportData(this.state.data)
 localBackups=()=>this.cache?.backups??[]
 downloadBackup=(data:AppData)=>exportData(normalizeData(data))
 cloudHistory=async()=>{const generation=this.generation,response=await this.api('history');if(!response.ok||!this.valid(generation))throw new Error('History unavailable.');const result=await response.json() as {history:{revision:number;created_at:string}[]};if(!this.valid(generation))throw new Error('Account changed.');return result.history}
 downloadCloudBackup=async(revision:number)=>{const generation=this.generation,response=await this.api('history/'+revision);if(!response.ok)throw new Error('Backup unavailable.');const data=decodeData(await response.text());if(this.valid(generation))exportData(data)}
 downloadRecovery=(file:RecoveryFile)=>downloadData(file.raw,file.name.replace(/[^a-z0-9-]/gi,'-')+'-recovery.json')
 fetchSchoolCatalog=()=>{if(!this.cloud)throw new Error('The shared catalog needs a KONO deployment with cloud storage configured.');return this.cloud.fetchSchoolCatalog()}
 submitSchoolCatalogEntry=(entry:Parameters<SupabaseRemote['submitSchoolCatalogEntry']>[0])=>{if(!this.cloud)throw new Error('The shared catalog needs a KONO deployment with cloud storage configured.');return this.cloud.submitSchoolCatalogEntry(entry)}
 private requireCloud(){if(!this.cloud)throw new Error('Friends need a KONO deployment with cloud storage configured.');return this.cloud}
 myUsername=()=>this.cloud?this.cloud.myUsername():Promise.resolve(null)
 setUsername=(username:string,displayName:string)=>this.requireCloud().setUsername(username,displayName)
 findClassmates=(query:string)=>this.requireCloud().findClassmates(query)
 sendConnectionRequest=(recipientId:string)=>this.requireCloud().sendConnectionRequest(recipientId)
 respondToConnection=(id:string,accept:boolean)=>this.requireCloud().respondToConnection(id,accept)
 removeConnection=(id:string)=>this.requireCloud().removeConnection(id)
 listConnections=async()=>{
  if(!this.cloud)return {rows:[],profiles:{}}
  const rows=await this.cloud.listConnections()
  const myId=this.state.user?.id??''
  const ids=[...new Set(rows.flatMap(r=>[r.requesterId,r.recipientId]))].filter(id=>id!==myId)
  const profiles=await this.cloud.profilesFor(ids)
  return {rows,profiles}
 }
 fetchFriendSnapshot=(ownerId:string)=>this.requireCloud().fetchSharedSnapshot(ownerId)
 importPreview=(raw:string)=>decodeData(raw)
 replace=(data:AppData)=>{if(this.blocked){this.notify({error:'The cache could not be read. Export your recovery data and reopen KONO before replacing it.'});return}this.notify({needsMigration:false,conflicts:[]});this.update(data)}
 importLegacy=()=>{if(this.migration)this.replace(this.migration)}
 skipMigration=()=>this.notify({needsMigration:false})
 retry=()=>{if(this.blocked)return;if(this.state.status==='Unsaved'){void this.enqueue(async g=>{await this.saveCache(this.state.data,this.cache?.base??null,this.cache?.serverRevision??0,!!this.state.user,g);this.scheduleSync()}).catch(()=>undefined)}else this.scheduleSync()}
 useCloud=()=>this.enqueue(async generation=>{
  const response=await this.api('plan');if(!response.ok)throw new Error('Cloud plan unavailable.')
  const remote=remoteValue(await response.json());if(!this.valid(generation))return
  await this.saveCache(remote.data??createFreshData(),remote.data,remote.revision,false,generation)
  this.notify({conflicts:[],needsMigration:false})
 })
 signOut=()=>this.enqueue(async generation=>{
  if(this.cache?.pending||this.state.status==='Unsaved')throw new Error('Save your pending changes before signing out.')
  const destination=this.cloud?'/':'/signout-with-chatgpt?return_to=/'
  if(this.cloud)await this.cloud.signOut()
  await deleteCache(this.scope);if(!this.valid(generation))return
  this.generation++;this.syncQueued=false;this.blocked=true;this.notify({data:createFreshData(),user:null,status:'Signed out'});window.location.assign(destination)
 })
 signInWithEmail=async(email:string)=>{
  if(!this.cloud)throw new Error('Email sign-in is available on the public KONO site.')
  const address=email.trim().toLowerCase()
  if(!/^\S+@\S+\.\S+$/.test(address)||address.length>320)throw new Error('Enter a valid email address.')
  await this.cloud.signInWithEmail(address)
 }
 deleteAccountData=()=>this.enqueue(async generation=>{
  const response=await this.api('plan',{method:'DELETE',body:JSON.stringify({expectedRevision:this.cache?.serverRevision??0})})
  if(!response.ok)throw new Error('The cloud plan changed or deletion failed. Sync, review it and retry.')
  const remote=remoteValue(await response.json());if(!this.valid(generation))return
  await deleteCache(this.scope);this.cache=null
  await this.saveCache(createFreshData(),null,remote.revision,false,generation)
  this.generation++;this.syncQueued=false
  this.notify({status:'Cloud study data deleted',conflicts:[],needsMigration:false})
 })
 startupError=(error:unknown)=>{this.blocked=true;this.notify({ready:true,status:'Recovery needed',error:message(error)})}
}
export function usePlannerRepository(){
 const [repository]=useState(()=>new PlannerRepository())
 const state=useSyncExternalStore(repository.subscribe,repository.getSnapshot)
 useEffect(()=>{void repository.start().catch(repository.startupError);return()=>repository.dispose()},[repository])
 return {repository,...state}
}
