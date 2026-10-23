import {useEffect,useRef,type ReactNode} from 'react'

/** A game, full screen: its own dialog over everything (a native <dialog>, so it stacks above the dialog it
 * was opened from and Escape works), with the game's name and Leave at the top. */
export default function GameScreen({title,tone,onLeave,children}:{title:string;tone?:string;onLeave:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null)
 useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close()},[])
 return <dialog ref={ref} className={'game-screen'+(tone?' is-'+tone:'')} aria-label={title} onCancel={e=>{e.preventDefault();onLeave()}}>
  <header><strong>{title}</strong><button type="button" className="game-screen-leave" onClick={onLeave}>✕ Leave</button></header>
  <div className="game-screen-body">{children}</div>
 </dialog>
}
