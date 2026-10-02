import {useEffect,useRef,type ReactNode} from 'react'

/** A dialog over the page (the native <dialog>, so Escape and focus are handled), with a title and ×. */
export default function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null)
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>opener?.focus()},[])
 return <dialog ref={ref} className="wb-dialog" aria-label={title} onCancel={e=>{e.preventDefault();close()}}><header><h2>{title}</h2><button aria-label="Close dialog" onClick={close}>×</button></header>{children}</dialog>
}
