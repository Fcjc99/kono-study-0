/** Photos on assignments and exams (a worksheet, the board). The plan only keeps their ids
 * (Task.photos / Exam.photos); the pictures live on this device in IndexedDB, and, when signed in, in
 * the account's private storage folder (supabase/migrations/0011) so other devices can fetch them.
 * Each one is shrunk first (longest side 1400 px, JPEG) so it's quick to save and send. */
type Stored={id:string;blob:Blob;pending:boolean}
export type PhotoCloud={upload:(id:string,blob:Blob)=>Promise<void>;download:(id:string)=>Promise<Blob|null>}

const DB='kono-photos',STORE='photos'
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
const tx=async<T>(mode:IDBTransactionMode,run:(s:IDBObjectStore)=>IDBRequest<T>)=>{const db=await open();try{return await new Promise<T>((resolve,reject)=>{const req=run(db.transaction(STORE,mode).objectStore(STORE));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}finally{db.close()}}

export const newPhotoId=()=>'photo-'+crypto.randomUUID()

/** A picture from the camera or library, shrunk to a JPEG. */
export async function shrinkImage(file:Blob,maxSide=1400):Promise<Blob>{
 const bitmap=await createImageBitmap(file)
 try{
  const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height))
  const canvas=document.createElement('canvas')
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale)
  canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height)
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.8))
  canvas.width=0;canvas.height=0
  if(!blob)throw Error('Couldn’t read that picture.')
  return blob
 }finally{bitmap.close()}
}

/** Keeps a new photo on this device (and uploads it when signed in); returns its id for the plan. */
export async function addPhoto(file:Blob,cloud:PhotoCloud|null):Promise<string>{
 const id=newPhotoId(),blob=await shrinkImage(file)
 await tx('readwrite',s=>s.put({id,blob,pending:!!cloud} satisfies Stored))
 if(cloud)await cloud.upload(id,blob).then(()=>tx('readwrite',s=>s.put({id,blob,pending:false} satisfies Stored))).catch(()=>undefined)
 return id
}

/** The photo's picture, from this device or (signed in) the account; null if it can't be found. */
export async function photoBlob(id:string,cloud:PhotoCloud|null):Promise<Blob|null>{
 const local=await tx<Stored|undefined>('readonly',s=>s.get(id)).catch(()=>undefined)
 if(local)return local.blob
 if(!cloud)return null
 const blob=await cloud.download(id).catch(()=>null)
 if(blob)await tx('readwrite',s=>s.put({id,blob,pending:false} satisfies Stored)).catch(()=>undefined)
 return blob
}

/** Uploads photos taken while offline or signed out of the cloud. */
export async function uploadPendingPhotos(cloud:PhotoCloud){
 const all=await tx<Stored[]>('readonly',s=>s.getAll()).catch(()=>[] as Stored[])
 for(const p of all.filter(p=>p.pending))await cloud.upload(p.id,p.blob).then(()=>tx('readwrite',s=>s.put({...p,pending:false}))).catch(()=>undefined)
}
