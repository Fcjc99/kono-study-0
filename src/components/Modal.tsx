import {useEffect,useRef,type PointerEvent,type ReactNode} from 'react'

/** A dialog over the page (the native <dialog>, so Escape and focus are handled), with a title and ×.
 * On a phone it is a sheet from the bottom of the screen: drag its top edge down to close it. */
export default function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),drag=useRef<{y:number;id:number}|null>(null)
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>opener?.focus()},[])
 const sheet=()=>matchMedia('(max-width: 600px)').matches
 const down=(e:PointerEvent<HTMLElement>)=>{if(!sheet()||(e.target as Element).closest('button'))return;drag.current={y:e.clientY,id:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId)}
 const move=(e:PointerEvent<HTMLElement>)=>{if(drag.current?.id!==e.pointerId||!ref.current)return;ref.current.style.transform=`translateY(${Math.max(0,e.clientY-drag.current.y)}px)`}
 const up=(e:PointerEvent<HTMLElement>)=>{
  if(drag.current?.id!==e.pointerId||!ref.current)return
  const moved=e.clientY-drag.current.y,dialog=ref.current;drag.current=null
  if(moved>110){close();return}
  dialog.animate?.([{transform:dialog.style.transform||'none'},{transform:'none'}],{duration:220,easing:'cubic-bezier(.2,1,.4,1)'})
  dialog.style.transform=''
 }
 return <dialog ref={ref} className="wb-dialog" aria-label={title} onCancel={e=>{e.preventDefault();close()}}><header onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><span className="sheet-handle" aria-hidden="true"/><h2>{title}</h2><button aria-label="Close dialog" onClick={close}>×</button></header>{children}</dialog>
}
