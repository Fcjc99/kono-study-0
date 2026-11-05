/** Decorative only: never owns rewards, physics, delivery, audio or camera state. */
export type RevealKind='tower'|'tide'|'ball'|'clear'
export type RevealMode='off'|'subtle'|'full'
export type RevealEvent={kind:RevealKind;phase:'award'|'release'|'capture'|'complete';magnitude?:number;at?:{x:number;y:number;z:number}}
export type EdgeReveal={id:number;kind:RevealKind;duration:number;remaining:number}
export const REVEAL_COLORS={tower:'#efc875',tide:'#6ce0c8',ball:'#c7a8f0',clear:'#7bdff2'} as const
export function edgeDuration(event:RevealEvent){
 if(event.kind==='tower'&&event.phase==='award'&&(event.magnitude??0)>30)return (event.magnitude??0)>60?1.35:.8
 if(event.kind==='tide'&&event.phase==='award')return 1.2
 if(event.kind==='clear'&&event.phase==='complete')return 1
 return 0
}
export function createBonusReveals(initial:RevealMode='full'){
 let mode=initial,reduced=false,id=0,current:EdgeReveal|null=null
 const frames=new Set<()=>void>(),events=new Set<(event:RevealEvent)=>void>()
 const queue:EdgeReveal[]=[],listeners=new Set<()=>void>(),local=new Set<(event:RevealEvent)=>void>()
 const notify=()=>listeners.forEach(fn=>fn())
 const reset=()=>{queue.length=0;current=null;notify()}
 return {
  get mode(){return mode},get reduced(){return reduced},get current(){return current},get pending(){return queue.length},
  subscribeFrame(fn:()=>void){frames.add(fn);return ()=>{frames.delete(fn)}},
  subscribe(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn)}},
  subscribeEvent(fn:(event:RevealEvent)=>void){events.add(fn);return ()=>{events.delete(fn)}},
  subscribeLocal(fn:(event:RevealEvent)=>void){local.add(fn);return ()=>{local.delete(fn)}},
  setMode(next:RevealMode){mode=next;reset()},setReduced(next:boolean){reduced=next;reset()},reset,
  emit(event:RevealEvent){
   if(mode==='off')return
   events.forEach(fn=>fn(event))
   if(event.at)local.forEach(fn=>fn(event))
   const duration=edgeDuration(event)
   if(mode!=='full'||reduced||!duration)return
   const entry={id:++id,kind:event.kind,duration,remaining:duration}
   if(!current){current=entry;notify()}else if(queue.length<3)queue.push(entry)
  },
  // Active time only. A pause must pass zero, never catch up after a hidden tab.
  update(dt:number){
   if(!current||!Number.isFinite(dt)||dt<=0)return
   current.remaining-=Math.min(dt,.05)
   if(current.remaining<=0){current=queue.shift()??null;notify()}
   frames.forEach(fn=>fn())
  }
 }
}
export type BonusReveals=ReturnType<typeof createBonusReveals>
