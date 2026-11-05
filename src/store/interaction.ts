/** Input bookkeeping only. No clock, DOM, physics or reward side effects. */
export const FEED_INTERVAL = 200
/** Only accepted, not-yet-launched player medals consume these two slots. */
export const FEED_CAPACITY = 2
export const feederHasRoom = (physicalQueue:number, stagedInputs:number) => physicalQueue + stagedInputs < FEED_CAPACITY
export function clampAim(value:number){return Number.isFinite(value)?Math.max(4,Math.min(96,value)):50}
export function aimFromRail(clientX:number,left:number,width:number){return clampAim(4+(clientX-left)/Math.max(1,width)*92)}

/** A single owner prevents a second finger/key from stealing a held feed. */
export function createFeedControl(){
 let owner:string|null=null,last=-Infinity
 const shot=(now:number)=>{if(now-last<FEED_INTERVAL)return false;last=now;return true}
 return {
  get active(){return owner!==null},
  get owner(){return owner},
  tap:shot,
  begin(source:string,now:number){if(owner!==null)return false;owner=source;return shot(now)},
  tick(now:number,allowed:boolean,capacity=true){if(!allowed){owner=null;return false}return owner!==null&&capacity&&shot(now)},
  stop(source?:string){if(source===undefined||source===owner)owner=null},
  reset(){owner=null;last=-Infinity},
 }
}

/** Bind all out-of-element cancellation paths. Local pointer capture is not
 * enough when a tab hides, a keyboard hold loses focus, or a dialog opens. */
export function bindFeedSafety(win:Window,doc:Document,stop:(owner?:string)=>void){
 const pointer=(e:PointerEvent)=>stop('pointer:'+e.pointerId)
 const key=(e:KeyboardEvent)=>{if(e.code==='Space')stop('keyboard')}
 const blur=()=>stop()
 const hidden=()=>{if(doc.hidden)stop()}
 win.addEventListener('pointerup',pointer);win.addEventListener('pointercancel',pointer)
 win.addEventListener('keyup',key);win.addEventListener('blur',blur);doc.addEventListener('visibilitychange',hidden)
 return ()=>{stop();win.removeEventListener('pointerup',pointer);win.removeEventListener('pointercancel',pointer);win.removeEventListener('keyup',key);win.removeEventListener('blur',blur);doc.removeEventListener('visibilitychange',hidden)}
}
