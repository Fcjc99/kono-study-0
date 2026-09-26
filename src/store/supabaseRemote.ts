import {createClient,type AuthChangeEvent,type Session,type SupabaseClient} from '@supabase/supabase-js'

export type CloudUser={id:string;email:string;name:string}
export type SharedCatalogRow={id:string;label:string;kind:'school'|'college';town?:string|null;data:unknown;source?:string|null;url?:string|null;created_at?:string}
export type ClassmateProfile={userId:string;username:string;displayName:string}
export type ConnectionStatus='pending'|'accepted'|'declined'
export type ConnectionRow={id:string;requesterId:string;recipientId:string;status:ConnectionStatus;createdAt:string}
export type AdminAccount={userId:string;email:string;createdAt:string;lastSignInAt:string|null;revision:number|null;updatedAt:string|null;profiles:string;username:string|null}
export type ClientError={id:number;userId:string|null;message:string;detail:string|null;page:string|null;appVersion:string|null;userAgent:string|null;createdAt:string}
export type Feedback={id:number;userId:string|null;message:string;page:string|null;appVersion:string|null;userAgent:string|null;createdAt:string}
export type NightlyBackup={revision:number;savedAt:string;data:unknown}
export type SupportActivity={id:number;accountId:string;adminId:string|null;action:'view'|'edit';revision:number|null;createdAt:string}

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
const failure=(message='Cloud storage is temporarily unavailable.')=>json({error:message},503)

export class SupabaseRemote{
 private client:SupabaseClient
 constructor(url:string,key:string){this.client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}
 private user(session:Session|null):CloudUser|null{
  const user=session?.user
  if(!user)return null
  const metadata=user.user_metadata as Record<string,unknown>|undefined
  return {id:user.id,email:user.email??'',name:typeof metadata?.full_name==='string'?metadata.full_name:typeof metadata?.name==='string'?metadata.name:''}
 }
 async session(){const {data,error}=await this.client.auth.getSession();if(error)throw error;return this.user(data.session)}
 onAuthChange(callback:(event:AuthChangeEvent,user:CloudUser|null)=>void){
  const {data}=this.client.auth.onAuthStateChange((event,session)=>callback(event,this.user(session)))
  return()=>data.subscription.unsubscribe()
 }
 async signInWithEmail(email:string){
  const {error}=await this.client.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+'/'}})
  if(error)throw error
 }
 async signOut(){const {error}=await this.client.auth.signOut();if(error)throw error}
 /** Keeps a copy of the saved cloud plan each time KONO opens (the database skips it when nothing changed). */
 async backupOnOpen(){const {error}=await this.client.rpc('kono_backup_on_open');if(error)throw error}
 /** UI hint only: every support function re-checks kono_admins on the server. */
 /** The signed-in person's current access token, for KONO's own server functions (built-in AI). */
 async accessToken(){const {data}=await this.client.auth.getSession();return data.session?.access_token??''}
 async isAdmin(){const {data,error}=await this.client.rpc('kono_is_admin');return !error&&data===true}
 async adminAccounts():Promise<AdminAccount[]>{
  const {data,error}=await this.client.rpc('kono_admin_accounts')
  if(error)throw new Error(error.message)
  return ((data??[]) as {user_id:string;email:string|null;created_at:string;last_sign_in_at:string|null;revision:number|null;updated_at:string|null;profiles:string|null;username:string|null}[]).map(r=>({userId:r.user_id,email:r.email??'',createdAt:r.created_at,lastSignInAt:r.last_sign_in_at,revision:r.revision,updatedAt:r.updated_at,profiles:r.profiles??'',username:r.username}))
 }
 /** Support views and edits: a person sees their own account's; KONO support sees all of them. */
 async supportActivity(accountId?:string):Promise<SupportActivity[]>{
  let query=this.client.from('kono_admin_audit').select('id,account_id,admin_id,action,revision,created_at').order('id',{ascending:false}).limit(50)
  if(accountId)query=query.eq('account_id',accountId)
  const {data,error}=await query
  if(error)throw new Error(error.message)
  return ((data??[]) as {id:number;account_id:string;admin_id:string|null;action:'view'|'edit';revision:number|null;created_at:string}[]).map(r=>({id:r.id,accountId:r.account_id,adminId:r.admin_id,action:r.action,revision:r.revision,createdAt:r.created_at}))
 }
 /** The account's last nightly backup (one per account, overwritten each night), or null. */
 async nightlyBackup():Promise<NightlyBackup|null>{
  const {data,error}=await this.client.from('kono_plan_nightly').select('revision,saved_at,data').maybeSingle()
  if(error)throw new Error(error.message)
  return data?{revision:data.revision as number,savedAt:data.saved_at as string,data:data.data}:null
 }
 async adminNightly(owner:string):Promise<NightlyBackup|null>{
  const {data,error}=await this.client.rpc('kono_admin_get_nightly',{p_owner:owner})
  if(error)throw new Error(error.message)
  const row=data as {revision:number;saved_at:string;data:unknown}|null
  return row?{revision:row.revision,savedAt:row.saved_at,data:row.data}:null
 }
 /** Best effort: an error report must never cause another error. */
 async reportError(entry:{message:string;detail?:string;page?:string;appVersion?:string}){
  const {data:{session}}=await this.client.auth.getSession()
  if(!session?.user)return
  await this.client.from('kono_client_errors').insert({message:entry.message.slice(0,1000)||'Unknown error',detail:entry.detail?.slice(0,4000)??null,page:entry.page?.slice(0,200)??null,app_version:entry.appVersion?.slice(0,80)??null,user_agent:navigator.userAgent.slice(0,300)})
 }
 async adminErrors():Promise<ClientError[]>{
  const {data,error}=await this.client.from('kono_client_errors').select('id,user_id,message,detail,page,app_version,user_agent,created_at').order('id',{ascending:false}).limit(50)
  if(error)throw new Error(error.message)
  return ((data??[]) as {id:number;user_id:string|null;message:string;detail:string|null;page:string|null;app_version:string|null;user_agent:string|null;created_at:string}[]).map(r=>({id:r.id,userId:r.user_id,message:r.message,detail:r.detail,page:r.page,appVersion:r.app_version,userAgent:r.user_agent,createdAt:r.created_at}))
 }
 async sendFeedback(entry:{message:string;page?:string;appVersion?:string}){
  const {error}=await this.client.from('kono_feedback').insert({message:entry.message.trim().slice(0,2000),page:entry.page?.slice(0,200)??null,app_version:entry.appVersion?.slice(0,80)??null,user_agent:navigator.userAgent.slice(0,300)})
  if(error)throw new Error(/relation|does not exist|schema cache/i.test(error.message)?'Feedback isn’t set up on the server yet.':error.message)
 }
 async adminFeedback():Promise<Feedback[]>{
  const {data,error}=await this.client.from('kono_feedback').select('id,user_id,message,page,app_version,user_agent,created_at').order('id',{ascending:false}).limit(100)
  if(error)throw new Error(error.message)
  return ((data??[]) as {id:number;user_id:string|null;message:string;page:string|null;app_version:string|null;user_agent:string|null;created_at:string}[]).map(r=>({id:r.id,userId:r.user_id,message:r.message,page:r.page,appVersion:r.app_version,userAgent:r.user_agent,createdAt:r.created_at}))
 }
 async adminDeleteFeedback(id:number){
  const {error}=await this.client.from('kono_feedback').delete().eq('id',id)
  if(error)throw new Error(error.message)
 }
 /** While set, the plan endpoints below read and write this account through the support functions. */
 private supportTarget:string|null=null
 setSupportTarget(accountId:string|null){this.supportTarget=accountId}
 /** Public read: works even for signed-out/local-only devices, since the catalog is shared community data, not a private plan. */
 async fetchSchoolCatalog():Promise<SharedCatalogRow[]>{
  const {data,error}=await this.client.from('kono_school_catalog').select('id,label,kind,town,data,source,url,created_at').order('created_at',{ascending:false}).limit(500)
  if(error)throw new Error(error.message)
  return (data??[]) as SharedCatalogRow[]
 }
 async submitSchoolCatalogEntry(entry:Omit<SharedCatalogRow,'created_at'>):Promise<void>{
  const {data:{session},error:sessionError}=await this.client.auth.getSession()
  if(sessionError)throw new Error('Could not verify your session. Try again.')
  if(!session?.user)throw new Error('Sign in to contribute to the shared catalog.')
  const {error}=await this.client.from('kono_school_catalog').insert({...entry,submitted_by:session.user.id})
  if(error)throw new Error(error.message)
 }
 private async requireUser(message='Sign in to use this feature.'){
  const {data:{session},error}=await this.client.auth.getSession()
  if(error)throw new Error('Could not verify your session. Try again.')
  if(!session?.user)throw new Error(message)
  return session.user
 }
 async myUsername():Promise<{username:string;displayName:string}|null>{
  const {data:{session},error:sessionError}=await this.client.auth.getSession()
  if(sessionError)throw new Error('Could not verify your session. Try again.')
  if(!session?.user)return null
  const {data,error}=await this.client.from('kono_profiles').select('username,display_name').eq('user_id',session.user.id).maybeSingle()
  if(error)throw new Error(error.message)
  return data?{username:data.username,displayName:data.display_name??''}:null
 }
 async setUsername(username:string,displayName:string):Promise<void>{
  const user=await this.requireUser('Sign in to set a username.')
  const clean=username.trim().toLowerCase()
  if(!/^[a-z0-9_.]{3,32}$/.test(clean))throw new Error('Usernames are 3-32 characters: lowercase letters, numbers, "_" or "."')
  const {error}=await this.client.from('kono_profiles').upsert({user_id:user.id,username:clean,display_name:displayName.trim().slice(0,80)||null})
  if(error)throw new Error(error.message.toLowerCase().includes('duplicate')?'That username is taken.':error.message)
 }
 async findClassmates(query:string):Promise<ClassmateProfile[]>{
  const user=await this.requireUser('Sign in to search for classmates.')
  const clean=query.trim().toLowerCase().replace(/[%_]/g,'')
  if(clean.length<2)return []
  const {data,error}=await this.client.from('kono_profiles').select('user_id,username,display_name').ilike('username','%'+clean+'%').neq('user_id',user.id).limit(10)
  if(error)throw new Error(error.message)
  return (data??[]).map(r=>({userId:r.user_id,username:r.username,displayName:r.display_name??''}))
 }
 async profilesFor(userIds:string[]):Promise<Record<string,ClassmateProfile>>{
  if(!userIds.length)return {}
  const {data,error}=await this.client.from('kono_profiles').select('user_id,username,display_name').in('user_id',userIds)
  if(error)throw new Error(error.message)
  const out:Record<string,ClassmateProfile>={}
  for(const r of data??[])out[r.user_id]={userId:r.user_id,username:r.username,displayName:r.display_name??''}
  return out
 }
 async sendConnectionRequest(recipientId:string):Promise<void>{
  const user=await this.requireUser('Sign in to connect with classmates.')
  if(user.id===recipientId)throw new Error('You cannot connect with yourself.')
  const {error}=await this.client.from('kono_connections').insert({requester_id:user.id,recipient_id:recipientId})
  if(error)throw new Error(error.message.toLowerCase().includes('duplicate')||error.message.includes('kono_connections_pair_key')?'You already have a connection or pending request with this person.':error.message)
 }
 async respondToConnection(id:string,accept:boolean):Promise<void>{
  await this.requireUser()
  if(accept){
   const {error}=await this.client.from('kono_connections').update({status:'accepted',responded_at:new Date().toISOString()}).eq('id',id)
   if(error)throw new Error(error.message)
   return
  }
  /** Delete rather than mark declined, so either person can send a fresh request later. */
  const {error}=await this.client.from('kono_connections').delete().eq('id',id)
  if(error)throw new Error(error.message)
 }
 async removeConnection(id:string):Promise<void>{
  await this.requireUser()
  const {error}=await this.client.from('kono_connections').delete().eq('id',id)
  if(error)throw new Error(error.message)
 }
 async listConnections():Promise<ConnectionRow[]>{
  const user=await this.requireUser()
  const {data,error}=await this.client.from('kono_connections').select('id,requester_id,recipient_id,status,created_at').or('requester_id.eq.'+user.id+',recipient_id.eq.'+user.id)
  if(error)throw new Error(error.message)
  return (data??[]).map(r=>({id:r.id,requesterId:r.requester_id,recipientId:r.recipient_id,status:r.status as ConnectionStatus,createdAt:r.created_at}))
 }
 /** Best-effort: never the full plan, only a pruned school-related snapshot (see src/store/peerShare.ts). */
 async publishSharedSnapshot(snapshot:unknown):Promise<void>{
  const {data:{session},error:sessionError}=await this.client.auth.getSession()
  if(sessionError||!session?.user)return
  await this.client.from('kono_shared_snapshots').upsert({owner:session.user.id,data:snapshot,updated_at:new Date().toISOString()})
 }
 async fetchSharedSnapshot(ownerId:string):Promise<unknown|null>{
  await this.requireUser('Sign in to view a friend’s shared classes.')
  const {data,error}=await this.client.from('kono_shared_snapshots').select('data').eq('owner',ownerId).maybeSingle()
  if(error)throw new Error(error.message)
  return data?.data??null
 }
 async request(path:string,init:RequestInit|undefined,accountId:string):Promise<Response>{
  const {data:{session},error:sessionError}=await this.client.auth.getSession()
  if(sessionError)return failure('Could not verify your session. Try again.')
  if(!session?.user)return json({error:'Sign in to access your study data.'},401)
  if(session.user.id!==accountId)return json({error:'The signed-in account changed. Reload KONO before continuing.'},401)
  const headers=new Headers(init?.headers)
  if(headers.get('X-Kono-Data-Version')!=='6')return json({error:'A newer KONO version is required.'},426)
  try{
   if(this.supportTarget)return await this.supportRequest(path,init,this.supportTarget)
   if(path==='plan'&&(!init?.method||init.method==='GET')){
    const {data,error}=await this.client.from('kono_plans').select('revision,data').maybeSingle()
    if(error)return failure(error.message)
    return json({revision:data?.revision??0,data:data?.data??null})
   }
   if(path==='plan'&&init?.method==='PUT'){
    const body=JSON.parse(String(init.body??'')) as {expectedRevision:number;operationId:string;data:unknown}
    const encoded=new TextEncoder().encode(JSON.stringify(body.data))
    if(encoded.length>750000)return json({error:'This plan exceeds the 750 KB cloud limit. Your local copy is preserved; export a backup.'},413)
    const {data,error}=await this.client.rpc('kono_save_plan',{p_expected_revision:body.expectedRevision,p_operation_id:body.operationId,p_data:body.data})
    if(error)return failure(error.message)
    const result=data as {revision?:number;conflict?:boolean}|null
    return result?.conflict?json({error:'Another device changed this plan. Retry sync.'},409):json({revision:result?.revision})
   }
   if(path==='plan'&&init?.method==='DELETE'){
    const body=JSON.parse(String(init.body??'')) as {expectedRevision:number}
    const {data,error}=await this.client.rpc('kono_delete_plan',{p_expected_revision:body.expectedRevision,p_operation_id:crypto.randomUUID()})
    if(error)return failure(error.message)
    const result=data as {revision?:number;conflict?:boolean}|null
    return result?.conflict?json({error:'Plan changed. Refresh before deleting.'},409):json({revision:result?.revision,data:null})
   }
   if(path==='history'&&(!init?.method||init.method==='GET')){
    const {data,error}=await this.client.from('kono_plan_history').select('revision,created_at,changed_by').order('revision',{ascending:false}).limit(20)
    return error?failure(error.message):json({history:(data??[]).map(({changed_by,...row})=>({...row,bySupport:!!changed_by&&changed_by!==accountId}))})
   }
   if(path==='backups'&&(!init?.method||init.method==='GET')){
    const {data,error}=await this.client.from('kono_plan_backups').select('revision,created_at,reason').order('revision',{ascending:false}).limit(30)
    return error?failure(error.message):json({backups:data??[]})
   }
   const backup=path.match(/^backups\/(\d+)$/)
   if(backup&&(!init?.method||init.method==='GET')){
    const {data,error}=await this.client.from('kono_plan_backups').select('data').eq('revision',Number(backup[1])).maybeSingle()
    if(error)return failure(error.message)
    return data?json({version:6,data:data.data}):json({error:'Backup not found.'},404)
   }
   const match=path.match(/^history\/(\d+)$/)
   if(match&&(!init?.method||init.method==='GET')){
    const {data,error}=await this.client.from('kono_plan_history').select('data').eq('revision',Number(match[1])).maybeSingle()
    if(error)return failure(error.message)
    return data?json({version:6,data:data.data}):json({error:'Backup not found.'},404)
   }
   return json({error:'Not found.'},404)
  }catch(error){return failure(error instanceof Error?error.message:undefined)}
 }
 private async supportRequest(path:string,init:RequestInit|undefined,owner:string):Promise<Response>{
  if(path==='plan'&&(!init?.method||init.method==='GET')){
   const {data,error}=await this.client.rpc('kono_admin_get_plan',{p_owner:owner})
   if(error)return json({error:error.message},403)
   const result=data as {revision?:number;data?:unknown}|null
   return json({revision:result?.revision??0,data:result?.data??null})
  }
  if(path==='plan'&&init?.method==='PUT'){
   const body=JSON.parse(String(init.body??'')) as {expectedRevision:number;operationId:string;data:unknown}
   if(new TextEncoder().encode(JSON.stringify(body.data)).length>750000)return json({error:'This plan exceeds the 750 KB cloud limit.'},413)
   const {data,error}=await this.client.rpc('kono_admin_save_plan',{p_owner:owner,p_expected_revision:body.expectedRevision,p_operation_id:body.operationId,p_data:body.data})
   if(error)return json({error:error.message},403)
   const result=data as {revision?:number;conflict?:boolean}|null
   return result?.conflict?json({error:'They changed this plan meanwhile. Retry sync.'},409):json({revision:result?.revision})
  }
  return json({error:'Not available while helping another account.'},403)
 }
}

