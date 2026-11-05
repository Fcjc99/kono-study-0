/** User-supplied soundtrack. One background and at most one event cue, never one player per coin. */
export type CoveTrack='mix'|'coin'|'sanctuary'
export type CoveCue='bonus'|'tower'|'jackpot'
export const COVE_TRACKS:Record<CoveTrack,{title:string;src:string}>={
 mix:{title:'Both tracks · alternating',src:'/audio/medal-cove/sanctuary-mix.mp3'},
 coin:{title:'コインの音 · Coin Sound',src:'/audio/medal-cove/coin-sound.mp3'},
 sanctuary:{title:'Calm Sanctuary Variation',src:'/audio/medal-cove/calm-sanctuary.mp3'},
}
const CUES:Record<CoveCue,{src:string;priority:number}>={
 bonus:{src:'/audio/medal-cove/bonus-adventure.mp3',priority:1},
 tower:{src:'/audio/medal-cove/tower-building.mp3',priority:2},
 jackpot:{src:'/audio/medal-cove/jackpot-celebration.mp3',priority:3},
}
export type MusicStatus='off'|'ready'|'playing'|'paused'|'unavailable'
export function createMedalMusic(createAudio:(src:string)=>HTMLAudioElement=src=>new Audio(src)){
 let background:HTMLAudioElement|null=null,event:HTMLAudioElement|null=null
 let selected:CoveTrack='mix',enabled=false,active=false,unlocked=false,hidden=false,disposed=false
 let priority=0,volume=.32,status:MusicStatus='off',failed=false
 let watchdog:ReturnType<typeof setInterval>|null=null
 const listeners=new Set<(status:MusicStatus)=>void>()
 const publish=(next:MusicStatus)=>{if(status===next)return;status=next;for(const listener of listeners)listener(next)}
 const canPlay=()=>enabled&&active&&unlocked&&!hidden&&!disposed
 const playing=new WeakSet<HTMLAudioElement>(),generation=new WeakMap<HTMLAudioElement,number>()
 const pause=(a:HTMLAudioElement)=>{generation.set(a,(generation.get(a)??0)+1);playing.delete(a);a.pause()}
 const stopEvent=()=>{if(watchdog!==null){clearInterval(watchdog);watchdog=null}if(event){pause(event);event=null}priority=0;if(background)background.volume=volume}
 const make=(src:string,loop=false)=>{const a=createAudio(src);a.loop=loop;a.preload='none';a.volume=volume;return a}
 const play=(a:HTMLAudioElement)=>{
  if(playing.has(a)||!a.paused)return
  playing.add(a)
  const token=(generation.get(a)??0)+1;generation.set(a,token)
  void a.play().then(()=>{
   if(generation.get(a)!==token)return
   playing.delete(a)
   if((a!==background&&a!==event)||!canPlay()){a.pause();return}
   failed=false;publish('playing')
  }).catch(()=>{
   if(generation.get(a)!==token)return
   playing.delete(a)
   if((a!==background&&a!==event)||!canPlay())return
   if(a===event){stopEvent();sync();return}
   failed=true;publish('unavailable')
  })
 }
 const sync=()=>{
  if(!canPlay()){
   if(background)pause(background);if(event)pause(event)
   publish(!enabled?'off':unlocked?'paused':'ready');return
  }
  if(!background){
   const a=make(COVE_TRACKS[selected].src,true);background=a
   a.addEventListener('error',()=>{if(background===a){failed=true;publish('unavailable')}})
  }
  background.volume=volume*(event ? .22 : 1)
  if(!failed)play(background)
  if(event)play(event)
 }
 return {
  subscribe(listener:(status:MusicStatus)=>void){listeners.add(listener);listener(status);return()=>{listeners.delete(listener)}},
  getStatus(){return status},
  setEnabled(value:boolean){enabled=value;if(!value)stopEvent();else failed=false;sync()},
  setActive(value:boolean){if(active===value)return;active=value;sync()},
  setHidden(value:boolean){hidden=value;sync()},
  /** Call directly from a pointer/key handler. No sound or network before this gesture. */
  unlock(){unlocked=true;failed=false;sync()},
  setTrack(value:CoveTrack){if(selected===value)return;selected=value;if(background)pause(background);background=null;failed=false;sync()},
  setVolume(value:number){volume=Math.min(.6,Math.max(0,value));if(event)event.volume=volume;sync()},
  cue(kind:CoveCue){
   if(!canPlay()||failed)return false
   const cue=CUES[kind]
   if(event&&cue.priority<=priority)return false
   stopEvent();const a=make(cue.src);event=a;priority=cue.priority
   const finish=()=>{if(event!==a)return;stopEvent();sync()}
   let activeSeconds=0
   watchdog=setInterval(()=>{if(canPlay()){activeSeconds+=.25;if(activeSeconds>=25)finish()}},250)
   a.addEventListener('ended',finish,{once:true});a.addEventListener('error',finish,{once:true})
   // A corrupt duration or missing ended event cannot leave the bed ducked indefinitely.
   a.addEventListener('timeupdate',()=>{if(a.currentTime>=22)finish()})
   if(background)background.volume=volume*.22
   play(a);return true
  },
  reset(){stopEvent();if(background)background.currentTime=0;sync()},
  dispose(){disposed=true;if(background)pause(background);stopEvent();background=null;listeners.clear()},
 }
}
export type MedalMusic=ReturnType<typeof createMedalMusic>
