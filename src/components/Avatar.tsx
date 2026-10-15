import {useRef,useState,type CSSProperties} from 'react'
import {avatarFromFile} from '../store/avatar'

type Who={name:string;emoji?:string;photo?:string;color?:string}

/** Someone's face: their photo, else their emoji, else the first letter of their name, on their color. */
export default function Avatar({who,className='',style}:{who:Who;className?:string;style?:CSSProperties}){
 return <span className={'kono-avatar'+(who.photo?' has-photo':'')+(className?' '+className:'')} style={{...(who.color?{'--avatar-color':who.color}:{}),...style} as CSSProperties} aria-hidden="true">{who.photo?<img src={who.photo} alt="" draggable={false}/>:who.emoji||who.name.trim().charAt(0).toUpperCase()||'?'}</span>
}

/** "Use a photo" / "Remove photo": the photo option under an avatar picker. */
export function AvatarPhotoButton({photo,onPhoto}:{photo?:string;onPhoto:(photo:string|undefined)=>void}){
 const input=useRef<HTMLInputElement>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const pick=async(file?:File)=>{if(!file)return;setBusy(true);setError('');try{onPhoto(await avatarFromFile(file))}catch(e){setError(e instanceof Error?e.message:'Could not use that picture.')}finally{setBusy(false);if(input.current)input.current.value=''}}
 return <div className="avatar-photo-pick">
  <input ref={input} type="file" accept="image/*" hidden onChange={e=>void pick(e.target.files?.[0])}/>
  <button type="button" disabled={busy} onClick={()=>input.current?.click()}>📷 {busy?'Shrinking…':photo?'Change photo':'Use a photo'}</button>
  {photo&&<button type="button" className="link-button" onClick={()=>onPhoto(undefined)}>Remove photo</button>}
  {error&&<p role="alert" className="avatar-photo-error">{error}</p>}
 </div>
}
