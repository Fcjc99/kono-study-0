/** Sound preferences for this device (localStorage), read without loading the sound engine.
 * Whether KONO makes sounds at all is still Settings › Sound (settings.sound, synced); everything here is
 * how it sounds on this phone or computer: the pack, the volume, which moments play, your own uploaded
 * sounds (their names only; the audio itself is in IndexedDB, see engine.ts) and the Focus soundscape mix. */
export type SoundPack='kono'|'soft'|'marimba'|'bells'|'arcade'
export type SoundEvent='done'|'dayDone'|'timer'|'start'|'add'|'move'|'remove'|'tap'|'nope'
export type ScapeKind='rain'|'brown'|'waves'|'fire'|'cafe'|'birds'
export type SoundPrefs={
 volume:number
 pack:SoundPack
 events:Record<SoundEvent,boolean>
 /** The uploaded sound for a moment: its file name and size, shown in Settings (the audio is in IndexedDB). */
 custom:Partial<Record<'done'|'timer'|'start',{name:string;size:number}>>
 /** The Focus soundscape: each layer's volume, 0 (off) to 1. */
 scape:Partial<Record<ScapeKind,number>>
 /** Start the soundscape with the Focus timer (and stop it with the timer). */
 scapeWithFocus:boolean
}
export const SOUND_PACKS:{id:SoundPack;name:string;note:string}[]=[
 {id:'kono',name:'KONO',note:'The classic chime and soft pops'},
 {id:'soft',name:'Soft',note:'Quiet, round and low'},
 {id:'marimba',name:'Marimba',note:'Wooden, bright and quick'},
 {id:'bells',name:'Bells',note:'Glassy chimes that ring out'},
 {id:'arcade',name:'Arcade',note:'Little 8-bit blips'},
]
export const SOUND_EVENTS:{id:SoundEvent;name:string;note:string}[]=[
 {id:'done',name:'Finish a task',note:'When you check something off'},
 {id:'dayDone',name:'Clear the day',note:'The last thing due today is done'},
 {id:'start',name:'Start a focus session',note:'When the Focus timer starts'},
 {id:'timer',name:'Focus timer ends',note:'So you hear it with your eyes closed'},
 {id:'add',name:'Add something',note:'A new assignment, event or note is saved'},
 {id:'move',name:'Move on the planner',note:'Dropping something on another day or time'},
 {id:'remove',name:'Delete',note:'Something goes to the trash'},
 {id:'tap',name:'Tabs and buttons',note:'A soft tick as you move around the app'},
 {id:'nope',name:'Can’t do that',note:'A drop or action that doesn’t go'},
]
export const SCAPES:{id:ScapeKind;name:string;icon:string}[]=[
 {id:'rain',name:'Rain',icon:'🌧️'},{id:'waves',name:'Waves',icon:'🌊'},{id:'fire',name:'Fireplace',icon:'🔥'},
 {id:'cafe',name:'Café',icon:'☕'},{id:'birds',name:'Birds',icon:'🐦'},{id:'brown',name:'Brown noise',icon:'🟫'},
]
export const SOUND_PREFS_KEY='kono-sound-prefs'
export const defaultSoundPrefs=():SoundPrefs=>({volume:.7,pack:'kono',events:{done:true,dayDone:true,timer:true,start:true,add:true,move:true,remove:true,tap:false,nope:true},custom:{},scape:{},scapeWithFocus:true})
const clamp=(n:unknown,d:number)=>typeof n==='number'&&Number.isFinite(n)?Math.min(1,Math.max(0,n)):d
/** Whatever is stored, as valid prefs (anything unknown or broken falls back to the default). */
export function cleanSoundPrefs(raw:unknown):SoundPrefs{
 const d=defaultSoundPrefs(),r=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>
 const ev=(r.events&&typeof r.events==='object'?r.events:{}) as Record<string,unknown>
 const custom=(r.custom&&typeof r.custom==='object'?r.custom:{}) as Record<string,unknown>
 const scape=(r.scape&&typeof r.scape==='object'?r.scape:{}) as Record<string,unknown>
 return {
  volume:clamp(r.volume,d.volume),
  pack:SOUND_PACKS.some(p=>p.id===r.pack)?r.pack as SoundPack:d.pack,
  events:Object.fromEntries(SOUND_EVENTS.map(e=>[e.id,typeof ev[e.id]==='boolean'?ev[e.id]:d.events[e.id]])) as Record<SoundEvent,boolean>,
  custom:Object.fromEntries((['done','timer','start'] as const).flatMap(k=>{const c=custom[k] as {name?:unknown;size?:unknown}|undefined;return c&&typeof c.name==='string'&&typeof c.size==='number'?[[k,{name:c.name.slice(0,120),size:c.size}]]:[]})),
  scape:Object.fromEntries(SCAPES.flatMap(s=>{const v=clamp(scape[s.id],0);return v>0?[[s.id,v]]:[]})),
  scapeWithFocus:typeof r.scapeWithFocus==='boolean'?r.scapeWithFocus:d.scapeWithFocus,
 }
}
export function readSoundPrefs():SoundPrefs{try{return cleanSoundPrefs(JSON.parse(localStorage.getItem(SOUND_PREFS_KEY)||'{}'))}catch{return defaultSoundPrefs()}}
const listeners=new Set<()=>void>()
export function saveSoundPrefs(p:SoundPrefs){try{localStorage.setItem(SOUND_PREFS_KEY,JSON.stringify(p))}catch{/* this device only */}listeners.forEach(f=>f())}
export function onSoundPrefs(f:()=>void){listeners.add(f);return()=>{listeners.delete(f)}}

/** Whether sound is on at all (settings.sound), set by the app as it loads and when the setting changes. */
let master=true
export const setSoundOn=(on:boolean)=>{master=on}
export const soundOn=()=>master
/** Play the sound for `event`, if sound is on and that moment is on (loads the engine the first time). */
export function sound(event:SoundEvent,level=0){
 if(!master)return
 const p=readSoundPrefs();if(!p.events[event]||p.volume<=0)return
 void import('./engine').then(m=>m.playEvent(event,p,level)).catch(()=>undefined)
}
