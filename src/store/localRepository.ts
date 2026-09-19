import { APP_STORAGE_KEY, LEGACY_APP_STORAGE_KEY } from './storageKeys'
import { createFreshData, normalizeData, type AppData } from './model'
import { mergeData } from './merge'

export const DATA_VERSION=6
export type CacheEntry={version:1|2|3|4|5|6;revision:number;data:AppData;serverRevision:number;base:AppData|null;pending:boolean;backups:AppData[]}
export type RecoveryFile={name:string;raw:string;reason:string}
export function decodeData(raw:string):AppData {
 if(raw.length>8_000_000)throw new Error('The backup exceeds the 8 MB limit.')
 const parsed:unknown=JSON.parse(raw)
 if(parsed&&typeof parsed==='object'&&'version' in parsed){
  const envelope=parsed as {version:unknown;data?:unknown}
  if(envelope.version!==1&&envelope.version!==2&&envelope.version!==3&&envelope.version!==4&&envelope.version!==5&&envelope.version!==DATA_VERSION)throw new Error('This backup needs a different KONO version. Keep the original file.')
  return normalizeData(envelope.data)
 }
 return normalizeData(parsed)
}
export function readLegacy():{data:AppData;recovery:RecoveryFile[];found:boolean} {
 const recovery:RecoveryFile[]=[]
 for(const key of [APP_STORAGE_KEY,LEGACY_APP_STORAGE_KEY]){
  try{const raw=localStorage.getItem(key);if(raw){try{return {data:decodeData(raw),recovery,found:true}}catch(error){recovery.push({name:key,raw,reason:error instanceof Error?error.message:'Unreadable saved data'})}}}
  catch{recovery.push({name:key,raw:'',reason:'Browser storage is unavailable.'})}
 }
 return {data:createFreshData(),recovery,found:false}
}
let dbPromise:Promise<IDBDatabase>|undefined
function openDB():Promise<IDBDatabase>{
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open('kono-recovery-and-sync',1)
  request.onupgradeneeded=()=>request.result.createObjectStore('plans')
  request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();dbPromise=undefined};resolve(request.result)}
  request.onerror=()=>{dbPromise=undefined;reject(new Error('This browser could not open the recovery cache. Export your work before leaving.'))}
  request.onblocked=()=>{dbPromise=undefined;reject(new Error('Close other KONO tabs to finish updating the local cache.'))}
 })
 return dbPromise
}
export async function readCache(scope:string):Promise<CacheEntry|null>{
 const db=await openDB()
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('plans','readonly'),request=tx.objectStore('plans').get(scope)
  request.onsuccess=()=>{try{const item=request.result as CacheEntry|undefined;if(!item){resolve(null);return}if(item.version!==1&&item.version!==2&&item.version!==3&&item.version!==4&&item.version!==5&&item.version!==6)throw new Error('This cache needs a newer KONO version.');resolve({...item,data:normalizeData(item.data),base:item.base?normalizeData(item.base):null})}catch(error){reject(error)}}
  request.onerror=()=>reject(request.error)
 })
}
/** One readwrite transaction serializes tab commits; the last acknowledged base travels with data. */
export async function commitCache(scope:string,base:CacheEntry|null,next:CacheEntry):Promise<CacheEntry>{
 const db=await openDB()
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('plans','readwrite'),store=tx.objectStore('plans'),request=store.get(scope)
  let result=next,problem:unknown
  request.onsuccess=()=>{
   try{
    const latest=request.result as CacheEntry|undefined
    if(!latest&&base)throw new Error('This cache was cleared in another tab. Export your working copy and reopen KONO before saving.')
    if(latest&&latest.version!==1&&latest.version!==2&&latest.version!==3&&latest.version!==4&&latest.version!==5&&latest.version!==6)throw new Error('This cache needs a different KONO version. Its contents have been preserved.')
    if(latest&&latest.revision!==(base?.revision??0)){
     if(!base)throw new Error('Another tab created this plan. Reload before making changes.')
     const merged=mergeData(base.data,next.data,normalizeData(latest.data))
     if(merged.conflicts.length)throw new Error('Another tab changed the same information. Your working copy is preserved; export it or reload the saved copy.')
     result={...latest,...next,data:merged.data,base:latest.base,serverRevision:latest.serverRevision,pending:true}
    }
    result={...result,version:6,revision:(latest?.revision??0)+1,backups:latest?[latest.data,...(latest.backups??[])].slice(0,5):[]}
    store.put(result,scope)
   }catch(error){problem=error;tx.abort()}
  }
  tx.oncomplete=()=>resolve(result)
  tx.onabort=()=>reject(problem??tx.error??new Error('Saving failed. Export your working copy.'))
  tx.onerror=()=>{problem??=tx.error}
 })
}
export async function deleteCache(scope:string):Promise<void>{
 const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('plans','readwrite');tx.objectStore('plans').delete(scope);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})
}
export function downloadBlob(blob:Blob,name:string){
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export function downloadData(data:unknown,name='kono-backup.json',mimeType='application/json'){
 downloadBlob(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:mimeType}),name)
}
export const exportData=(data:AppData)=>downloadData({format:'kono-backup',version:DATA_VERSION,exportedAt:new Date().toISOString(),data})
