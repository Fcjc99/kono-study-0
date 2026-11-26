import {useEffect,useState} from 'react'
import {onSoundPrefs,readSoundPrefs,saveSoundPrefs,type SoundPrefs} from './prefs'

/** The sound prefs, kept current as they change (in Settings or Focus); set(f) saves f(current). */
export function useSoundPrefs():[SoundPrefs,(f:(p:SoundPrefs)=>SoundPrefs)=>void]{
 const [p,setP]=useState(readSoundPrefs)
 useEffect(()=>onSoundPrefs(()=>setP(readSoundPrefs())),[])
 return [p,f=>saveSoundPrefs(f(readSoundPrefs()))]
}
