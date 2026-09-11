import { useEffect, useState, useSyncExternalStore } from 'react'
import type { SettingsData } from '../store/model'
const subscribeMotion=(notify:()=>void)=>{const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',notify);return()=>media.removeEventListener('change',notify)}
const readMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches
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
