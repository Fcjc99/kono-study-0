import {useEffect,useId,useRef,useState,type ClipboardEvent,type DragEvent} from 'react'
import './upload-drop.css'
import {accepts} from './dropAccept'

export type Chosen={name:string;size:number;url?:string}
const size=(n:number)=>n>=1e6?(n/1e6).toFixed(1)+' MB':Math.max(1,Math.round(n/1e3))+' KB'

/** Somewhere to put files: drag them onto it, paste one (⌘V / Ctrl+V while it's focused, or anywhere on the
 * page with `pasteAnywhere`), or tap to choose. It lights up while something is dragged over it, says no to the
 * wrong kind of file, and shows what's chosen (with a picture for an image) with a ✕ to take one off. */
export default function DropZone({accept,multiple,label,hint,icon='⬆️',onFiles,busy,compact,chosen,onRemove,pasteAnywhere,disabled,capture,inputLabel}:{
 accept?:string;multiple?:boolean;label:string;hint?:string;icon?:string;onFiles:(files:File[])=>void;busy?:boolean;compact?:boolean
 chosen?:Chosen[];onRemove?:(i:number)=>void;pasteAnywhere?:boolean;disabled?:boolean;capture?:'environment'|'user';inputLabel?:string
}){
 const [over,setOver]=useState(false),[nope,setNope]=useState('')
 const depth=useRef(0),input=useRef<HTMLInputElement>(null),id=useId()
 const take=(list:FileList|File[]|null|undefined)=>{
  const files=[...(list??[])];if(!files.length||disabled||busy)return
  const ok=files.filter(f=>accepts(accept,f))
  if(!ok.length){setNope('That kind of file won’t work here.');window.setTimeout(()=>setNope(''),2600);return}
  setNope('');onFiles(multiple?ok:ok.slice(0,1))
 }
 const latest=useRef(take)
 useEffect(()=>{latest.current=take})
 useEffect(()=>{if(!pasteAnywhere)return
  const on=(e:globalThis.ClipboardEvent)=>{const t=e.target as HTMLElement|null;if(t&&(t.closest('input,textarea,[contenteditable=true]')))return;const f=[...(e.clipboardData?.files??[])];if(f.length){e.preventDefault();latest.current(f)}}
  window.addEventListener('paste',on);return()=>window.removeEventListener('paste',on)},[pasteAnywhere])
 const drag={
  onDragEnter:(e:DragEvent)=>{if(![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();depth.current++;setOver(true)},
  onDragOver:(e:DragEvent)=>{if(![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();e.dataTransfer.dropEffect='copy'},
  onDragLeave:()=>{depth.current=Math.max(0,depth.current-1);if(!depth.current)setOver(false)},
  onDrop:(e:DragEvent)=>{e.preventDefault();depth.current=0;setOver(false);take(e.dataTransfer.files)},
 }
 const paste=(e:ClipboardEvent)=>{const f=[...e.clipboardData.files];if(f.length){e.preventDefault();take(f)}}
 return <div className={'dropzone'+(compact?' is-compact':'')+(over?' is-over':'')+(busy?' is-busy':'')+(nope?' is-nope':'')+(disabled?' is-disabled':'')} {...drag} onPaste={paste}>
  <label className="dropzone-target" htmlFor={id}>
   {!compact&&<span className="dropzone-icon" aria-hidden="true">{busy?<i className="dropzone-spin"/>:over?'📥':icon}</span>}
   <span className="dropzone-text"><b>{busy?'Working…':over?'Drop it here':label}</b>{!compact&&hint!==''&&<small>{nope||hint||(multiple?'Drag files here, paste, or tap to choose':'Drag a file here, paste, or tap to choose')}</small>}</span>
   <input ref={input} id={id} type="file" aria-label={inputLabel} accept={accept} multiple={multiple} disabled={disabled||busy} {...(capture?{capture}:{})} onChange={e=>{take(e.target.files);e.target.value=''}}/>
  </label>
  {compact&&nope&&<small className="dropzone-nope" role="alert">{nope}</small>}
  {!!chosen?.length&&<ul className="dropzone-files">{chosen.map((c,i)=><li key={c.name+i}>
   {c.url?<img src={c.url} alt="" width={40} height={40}/>:<span className="dropzone-file-icon" aria-hidden="true">📄</span>}
   <span><b>{c.name}</b><small>{size(c.size)}</small></span>
   {onRemove&&<button type="button" aria-label={'Remove '+c.name} onClick={()=>onRemove(i)}>✕</button>}
  </li>)}</ul>}
  {!compact&&nope&&<p className="sr-only" role="alert">{nope}</p>}
 </div>
}
