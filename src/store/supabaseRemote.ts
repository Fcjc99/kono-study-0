import {createClient,type AuthChangeEvent,type Session,type SupabaseClient} from '@supabase/supabase-js'

export type CloudUser={id:string;email:string;name:string}

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
 async request(path:string,init:RequestInit|undefined,accountId:string):Promise<Response>{
  const {data:{session},error:sessionError}=await this.client.auth.getSession()
  if(sessionError)return failure('Could not verify your session. Try again.')
  if(!session?.user)return json({error:'Sign in to access your study data.'},401)
  if(session.user.id!==accountId)return json({error:'The signed-in account changed. Reload KONO before continuing.'},401)
  const headers=new Headers(init?.headers)
  if(headers.get('X-Kono-Data-Version')!=='6')return json({error:'A newer KONO version is required.'},426)
  try{
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
    const {data,error}=await this.client.from('kono_plan_history').select('revision,created_at').order('revision',{ascending:false}).limit(20)
    return error?failure(error.message):json({history:data??[]})
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
}

