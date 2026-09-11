import {useState,type SetStateAction} from 'react'
/** Device-local drafts, separately scoped from authoritative account records. */
export function useDraftState<T>(key:string,initial:T|(()=>T)):[T,(action:SetStateAction<T>)=>void]{
 const [value,setValue]=useState<T>(()=>{const fallback=typeof initial==='function'?(initial as ()=>T)():initial;try{const raw=localStorage.getItem(key);if(raw){const parsed=JSON.parse(raw);if(typeof parsed===typeof fallback&&Array.isArray(parsed)===Array.isArray(fallback))return parsed}}catch{/* Keep the original draft intact if unreadable. */}return fallback})
 const update=(action:SetStateAction<T>)=>{const next=typeof action==='function'?(action as (v:T)=>T)(value):action;try{localStorage.setItem(key,JSON.stringify(next))}catch{window.alert('This browser could not save your draft. Keep this page open and save your work before leaving.')}setValue(next)}
 return [value,update]
}
