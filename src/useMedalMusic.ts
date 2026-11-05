import {useEffect,useState} from 'react'
import {createMedalMusic,type CoveTrack,type MedalMusic,type MusicStatus} from './medalMusic'

const read=(key:string,fallback:string)=>{try{return localStorage.getItem(key)??fallback}catch{return fallback}}
const save=(key:string,value:string)=>{try{localStorage.setItem(key,value)}catch{/* this visit only */}}
export function useMedalMusic(){
 const [enabled,setEnabled]=useState(()=>read('kono.medal.music','on')!=='off')
 const [track,setTrack]=useState<CoveTrack>(()=>{const value=read('kono.medal.track','mix');return value==='coin'||value==='sanctuary'?value:'mix'})
 const [volume,setVolume]=useState(()=>{const value=Number(read('kono.medal.music.volume','32'));return Number.isFinite(value)?Math.min(60,Math.max(0,value)):32})
 const [player,setPlayer]=useState<MedalMusic|null>(null),[status,setStatus]=useState<MusicStatus>('ready')
 useEffect(()=>{
  const next=createMedalMusic(),unsubscribe=next.subscribe(setStatus);setPlayer(next)
  const visibility=()=>next.setHidden(document.hidden)
  const unlock=()=>next.unlock()
  visibility();document.addEventListener('visibilitychange',visibility);window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock)
  return()=>{unsubscribe();next.dispose();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock)}
 },[])
 useEffect(()=>{player?.setTrack(track);save('kono.medal.track',track)},[player,track])
 useEffect(()=>{player?.setVolume(volume/100);save('kono.medal.music.volume',String(volume))},[player,volume])
 useEffect(()=>{player?.setEnabled(enabled);save('kono.medal.music',enabled?'on':'off')},[player,enabled])
 const toggle=()=>{player?.unlock();player?.setEnabled(!enabled);setEnabled(!enabled)}
 return {player,enabled,toggle,track,setTrack,volume,setVolume,status}
}
