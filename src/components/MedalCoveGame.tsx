import {useEffect,useState,type Ref} from 'react'
import MedalCove from './MedalCove'
import {useMedalMusic} from '../useMedalMusic'
import {musicOn,stopMusic} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'
import './medal-cove.css'
import './medal-cove-kono.css'

/** KONO Medal Cove inside KONO's arcade (BreakGames → GameScreen): the game with its own soundtrack
 * (useMedalMusic: a background mix, and jackpot, tower and bonus music for those moments). The music
 * follows KONO's Sounds setting and the game screen's 🎵 button; KONO's own arcade music stays off while
 * the cove plays. Loaded on its own (lazy), so its 3D engine and music don't weigh on the rest of KONO. */
export default function MedalCoveGame({ref,best,sound,onEnd,onFail}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(medals:number,jackpots:number,practice:boolean)=>void;onFail?:()=>void}){
 const music=useMedalMusic()
 // The game screen's 🎵 button changes KONO's music setting; follow it.
 const [arcadeMusic,setArcadeMusic]=useState(musicOn)
 useEffect(()=>{stopMusic();const t=window.setInterval(()=>setArcadeMusic(musicOn()),700);return()=>window.clearInterval(t)},[])
 useEffect(()=>{music.player?.setEnabled(sound&&arcadeMusic)},[music.player,sound,arcadeMusic])
 return <MedalCove ref={ref} best={best} sound={sound} music={music.player??undefined} onEnd={(medals,jackpots,practice)=>{music.player?.setActive(false);onEnd(medals,jackpots,practice)}} onFail={onFail}/>
}
