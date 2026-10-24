import type { RealTimeClient } from '@decartai/sdk'
import type { Polo } from './polos'
import { TRYON_MODEL } from './tryonToken'

/** What the fitting room shows while the AI session starts, runs and ends. */
export type AiStatus={kind:'connecting'|'queued'|'busy'|'live'|'reconnecting';text:string}
export type AiSession={setPolo(polo:Polo):Promise<void>;stop():void}
type Handlers={onStream(stream:MediaStream):void;onStatus(status:AiStatus):void;onEnded(message:string):void}
/** A refusal from our own token endpoint, whose message is written for shoppers (the SDK's are not). */
class FittingRoomError extends Error{}

/** Whether the AI fitting room is switched on (DECART_API_KEY set on the server). */
export async function aiTryOnEnabled():Promise<boolean>{
 try{const r=await fetch('/api/tryon-token',{cache:'no-store'});return r.ok&&!!(await r.json() as {enabled?:boolean}).enabled}catch{return false}
}

/** The camera size and frame rate the try-on model wants (it reads 1280×720). */
export async function aiCameraConstraints():Promise<MediaTrackConstraints>{
 const {models}=await import('@decartai/sdk')
 const model=models.realtime(TRYON_MODEL)
 return {facingMode:'user',width:{ideal:model.width},height:{ideal:model.height},frameRate:model.fps}
}

const refs=new Map<string,Promise<Blob>>()
const refFor=(polo:Polo)=>{let r=refs.get(polo.ref);if(!r){r=fetch(polo.ref).then(x=>x.blob());refs.set(polo.ref,r)}return r}

const ENDED:Record<string,string>={
 session_limit:'The fitting room is full right now. Try again in a minute.',
 insufficient_credits:'The AI fitting room is resting for now. Quick fit still works.',
 moderation_violation:'The session was stopped. Try again with just you in the picture.',
 policy_violation:'The session was stopped. Try again with just you in the picture.',
}

/** Streams the camera to Decart's realtime try-on model with the polo's mockup and description, and hands
 * back the generated video of the shopper wearing it. A fresh short-lived key is fetched from our server
 * for every dial (api/tryon-token.ts), so the real API key never reaches the browser. */
export async function startAiTryOn(stream:MediaStream,polo:Polo,h:Handlers):Promise<AiSession>{
 const {createDecartClient,models}=await import('@decartai/sdk')
 const client=createDecartClient({apiKeyProvider:async()=>{
  const r=await fetch('/api/tryon-token',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
  const body=await r.json().catch(()=>({})) as {apiKey?:string;error?:string}
  if(!r.ok||!body.apiKey)throw new FittingRoomError(body.error??'The AI fitting room couldn’t be reached.')
  return body.apiKey
 }})
 h.onStatus({kind:'connecting',text:'Opening the AI fitting room…'})
 let live:RealTimeClient|null=null
 try{live=await client.realtime.connect(stream,{
  model:models.realtime(TRYON_MODEL),
  // A shopper is waiting on the quick fit if this fails, so dial a couple of times, not the SDK's five.
  retries:2,
  capacityRetryBudgetMs:30000,
  onRemoteStream:h.onStream,
  initialState:{prompt:{text:polo.prompt,enhance:false},image:await refFor(polo)},
  onQueuePosition:q=>h.onStatus({kind:'queued',text:`You’re number ${q.position} in line for the fitting room…`}),
  onCapacityWait:w=>h.onStatus({kind:'busy',text:`The fitting room is busy. Trying again in ${Math.max(1,Math.round(w.retryAfterMs/1000))}s…`}),
  onConnectionChange:state=>{
   if(state==='generating'||state==='connected')h.onStatus({kind:'live',text:''})
   else if(state==='reconnecting')h.onStatus({kind:'reconnecting',text:'Reconnecting…'})
  },
 })}catch(error){
  throw error instanceof FittingRoomError?error:new Error('The AI fitting room couldn’t connect.')
 }
 live.on('sessionEnded',({reason})=>h.onEnded(ENDED[reason]??'Your try-on session ended. Start it again any time.'))
 return {
  async setPolo(next){await live?.set({prompt:next.prompt,enhance:false,image:await refFor(next)})},
  stop(){live?.disconnect();live=null},
 }
}
