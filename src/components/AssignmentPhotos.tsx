import {useEffect,useState} from 'react'
import {addPhoto,photoBlob,type PhotoCloud} from '../store/photoStore'

/** Assignment/exam editor › Photos: the worksheet, the board, a page of the textbook. Up to 6; tap one
 * to see it full size. They stay on this device and, when signed in, in the account's private folder. */
const NONE:string[]=[]
export default function AssignmentPhotos({ids:given,onChange,cloud}:{ids?:string[];onChange:(ids:string[])=>void;cloud:PhotoCloud|null}){
 const ids=given??NONE
 const [urls,setUrls]=useState<Record<string,string>>({}),[open,setOpen]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{
  let gone=false;const made:string[]=[]
  void Promise.all(ids.map(async id=>{const blob=await photoBlob(id,cloud);if(!blob||gone)return null;const url=URL.createObjectURL(blob);made.push(url);return [id,url] as const})).then(rows=>{if(!gone)setUrls(Object.fromEntries(rows.filter((r):r is readonly [string,string]=>!!r)))})
  return()=>{gone=true;made.forEach(u=>URL.revokeObjectURL(u))}
 },[ids,cloud])
 const add=async(files:FileList|null)=>{
  if(!files?.length)return
  setBusy(true);setError('')
  try{const added:string[]=[];for(const f of [...files].slice(0,6-ids.length))added.push(await addPhoto(f,cloud));onChange([...ids,...added])}
  catch{setError('Couldn’t add that picture. Try another one.')}
  finally{setBusy(false)}
 }
 return <div className="assignment-photos">
  <div className="assignment-photos-row">
   {ids.map((id,i)=><figure key={id}>{urls[id]?<button type="button" className="assignment-photo-thumb" onClick={()=>setOpen(id)} aria-label={'Open photo '+(i+1)}><img src={urls[id]} alt={'Photo '+(i+1)}/></button>:<span className="assignment-photo-missing">Photo not on this device</span>}<button type="button" className="assignment-photo-remove" onClick={()=>onChange(ids.filter(x=>x!==id))} aria-label={'Remove photo '+(i+1)}>×</button></figure>)}
   {ids.length<6&&<label className="assignment-photo-add"><input type="file" accept="image/*" multiple onChange={e=>{void add(e.target.files);e.target.value=''}} disabled={busy}/><span aria-hidden="true">📷</span>{busy?'Adding…':ids.length?'Add another':'Add a photo'}</label>}
  </div>
  {error&&<p role="alert">{error}</p>}
  {open&&urls[open]&&<div className="assignment-photo-viewer" role="dialog" aria-label="Photo" onClick={()=>setOpen('')}><img src={urls[open]} alt="Photo, full size"/><button type="button" onClick={()=>setOpen('')}>Close</button></div>}
 </div>
}
