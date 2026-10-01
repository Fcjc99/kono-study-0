import { useEffect, useState, useSyncExternalStore } from 'react'
import type { SettingsData } from '../store/model'
const subscribeMotion=(notify:()=>void)=>{const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',notify);return()=>media.removeEventListener('change',notify)}
const readMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches
const mediaHook=(query:string)=>{
 const subscribe=(notify:()=>void)=>{const media=matchMedia(query);media.addEventListener('change',notify);return()=>media.removeEventListener('change',notify)}
 return ()=>useSyncExternalStore(subscribe,()=>matchMedia(query).matches,()=>false)
}
/** Phone-width screens (iPhone portrait): some views show less at once, like three days instead of seven. */
export const usePhoneWidth=mediaHook('(max-width: 600px)')
/** A phone either way up: narrow, or short when turned sideways. For things that shouldn't take up the screen. */
export const useSmallScreen=mediaHook('(max-width: 600px), (max-height: 500px)')
/** The phone or computer is set to dark mode (iPhone: Settings › Display & Brightness). */
export const usePrefersDark=mediaHook('(prefers-color-scheme: dark)')
export function useReducedMotion(settings:SettingsData){
 const system=useSyncExternalStore(subscribeMotion,readMotion,()=>false)
 return settings.motionPreference==='full'?false:settings.motionPreference==='reduced'?true:settings.motionPreference==='system'?system:settings.reducedMotion||system
}
export function useMusicController(enabled:boolean){
 const [audio]=useState(()=>{const a=new Audio('/audio/main-theme.mp3');a.loop=true;a.preload='none';a.volume=.28;return a})
 const [playing,setPlaying]=useState(false),[error,setError]=useState('')
 useEffect(()=>{const onPlay=()=>setPlaying(true),onPause=()=>setPlaying(false);audio.addEventListener('play',onPlay);audio.addEventListener('pause',onPause);return()=>{audio.pause();audio.removeEventListener('play',onPlay);audio.removeEventListener('pause',onPause)}},[audio])
 useEffect(()=>{if(!enabled)audio.pause()},[enabled,audio])
 const toggle=()=>{if(!enabled)return;if(!audio.paused)audio.pause();else{setError('');void audio.play().catch(()=>setError('Music could not play. Try again.'))}}
 return {enabled,playing:enabled&&playing,error,toggle}
}
