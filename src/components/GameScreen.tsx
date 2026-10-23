import {useEffect,useRef,useState,type ReactNode} from 'react'
import {gameSound} from '../konoSounds'

/** A game, full screen: its own dialog over everything (a native <dialog>, so it stacks above the dialog it
 * was opened from and Escape works). It slides in when it opens and out when it closes, and every game goes
 * through the same three steps, with the same sounds (konoSounds › gameSound):
 * - Start: the game's card (what it is, how to play, your best) and Start (KONO blast adds New game
 *   beside Continue when a game is saved).
 * - Play: the game, with ↻ Restart and ■ End (finish now and see how you did) beside Leave.
 * - Results: the score, a new best, coins, with Play again and Done (a chime for a round won, a soft tune
 *   for one lost, then the coins coming in). */
export type GameResult={emoji:string;title:string;line:string;score?:string;best?:boolean;coins?:string|null;won?:boolean}
export type GameIntro={emoji:string;name:string;how:string;best?:string|null;start?:string;alt?:{label:string;onClick:()=>void}}
/** What a game lets its screen do: End finishes the round now with the score so far. */
export type GameHandle={end:()=>void}
export default function GameScreen({title,tone,sound=false,intro,started=true,onStart,onRestart,onEnd,onLeave,result,onAgain,children}:{
 title:string;tone?:string;sound?:boolean
 intro?:GameIntro;started?:boolean;onStart?:()=>void
 onRestart?:()=>void;onEnd?:()=>void;onLeave:()=>void
 result?:GameResult|null;onAgain?:()=>void;children:ReactNode
}){
 const ref=useRef<HTMLDialogElement>(null),[closing,setClosing]=useState(false)
 useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close()},[])
 // The results' sounds: a chime or a soft tune, then the coins.
 useEffect(()=>{
  if(!result)return
  gameSound(result.won===false?'lose':'win',sound)
  if(!result.coins)return
  const t=window.setTimeout(()=>gameSound('coin',sound),650)
  return ()=>window.clearTimeout(t)
 },[result,sound])
 // Leave and Done slide the screen away first.
 const leave=()=>{if(closing)return;setClosing(true);window.setTimeout(onLeave,matchMedia('(prefers-reduced-motion: reduce)').matches?0:240)}
 const start=()=>{gameSound('start',sound);onStart?.()}
 const phase=!started&&intro?'start':result?'results':'play'
 return <dialog ref={ref} className={'game-screen'+(tone?' is-'+tone:'')+(closing?' is-closing':'')+' is-'+phase} aria-label={title} onCancel={e=>{e.preventDefault();leave()}}>
  <header><strong>{title}</strong><span className="game-screen-tools">
   {phase==='play'&&onRestart&&<button type="button" className="game-screen-tool" onClick={()=>{gameSound('start',sound);onRestart()}}>↻ Restart</button>}
   {phase==='play'&&onEnd&&<button type="button" className="game-screen-tool" onClick={onEnd}>■ End</button>}
   <button type="button" className="game-screen-leave" onClick={leave}>✕ Leave</button>
  </span></header>
  <div className="game-screen-body">{phase==='start'&&intro?<section className="game-result game-start" aria-label="Start">
   <span className="game-result-emoji" aria-hidden="true">{intro.emoji}</span>
   <h2>{intro.name}</h2>
   <p className="game-result-line">{intro.how}</p>
   {intro.best&&<p className="game-result-best">👑 {intro.best}</p>}
   <div className="game-result-actions"><button type="button" className="primary" onClick={start}>{intro.start??'Start'}</button>{intro.alt&&<button type="button" onClick={()=>{gameSound('start',sound);intro.alt!.onClick()}}>{intro.alt.label}</button>}</div>
  </section>:phase==='results'&&result?<section className="game-result" aria-live="polite" aria-label="Results">
   <span className="game-result-emoji" aria-hidden="true">{result.emoji}</span>
   <h2>{result.title}</h2>
   {result.score&&<p className="game-result-score">{result.score}</p>}
   {result.best&&<p className="game-result-best">👑 New best!</p>}
   <p className="game-result-line">{result.line}</p>
   {result.coins&&<p className="game-result-coins">{result.coins}</p>}
   <div className="game-result-actions">{onAgain&&<button type="button" className="primary" onClick={()=>{gameSound('start',sound);onAgain()}}>Play again</button>}<button type="button" onClick={leave}>Done</button></div>
  </section>:children}</div>
 </dialog>
}
