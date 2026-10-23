import {useEffect,useRef,useState,type ReactNode} from 'react'

/** A game, full screen: its own dialog over everything (a native <dialog>, so it stacks above the dialog it
 * was opened from and Escape works), with the game's name and Leave at the top. It slides in when it opens
 * and out when it closes. When a round ends (`result`), the game makes way for a results card (the score,
 * a best, coins) with Play again and Done, so a game never just snaps shut. */
export type GameResult={emoji:string;title:string;line:string;score?:string;best?:boolean;coins?:string|null}
export default function GameScreen({title,tone,onLeave,result,onAgain,children}:{title:string;tone?:string;onLeave:()=>void;result?:GameResult|null;onAgain?:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),[closing,setClosing]=useState(false)
 useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close()},[])
 // Leave and Done slide the screen away first.
 const leave=()=>{if(closing)return;setClosing(true);window.setTimeout(onLeave,matchMedia('(prefers-reduced-motion: reduce)').matches?0:240)}
 return <dialog ref={ref} className={'game-screen'+(tone?' is-'+tone:'')+(closing?' is-closing':'')} aria-label={title} onCancel={e=>{e.preventDefault();leave()}}>
  <header><strong>{title}</strong><button type="button" className="game-screen-leave" onClick={leave}>✕ Leave</button></header>
  <div className="game-screen-body">{result?<section className="game-result" aria-live="polite" aria-label="Results">
   <span className="game-result-emoji" aria-hidden="true">{result.emoji}</span>
   <h2>{result.title}</h2>
   {result.score&&<p className="game-result-score">{result.score}</p>}
   {result.best&&<p className="game-result-best">👑 New best!</p>}
   <p className="game-result-line">{result.line}</p>
   {result.coins&&<p className="game-result-coins">{result.coins}</p>}
   <div className="game-result-actions">{onAgain&&<button type="button" className="primary" onClick={onAgain}>Play again</button>}<button type="button" onClick={leave}>Done</button></div>
  </section>:children}</div>
 </dialog>
}
