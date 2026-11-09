/** Older or slower devices (an older iPad, a budget tablet): KONO keeps the island and effects lighter there,
 * 30 frames a second instead of 60 and no frosted-glass blur. A device counts as one when it says it has few
 * cores or little memory, asks to save data, or the island has measured itself slow here before (that is
 * remembered on this device). */
const KEY='kono-lite'
export function isLiteDevice():boolean{
 try{if(localStorage.getItem(KEY)==='1')return true}catch{/* fine */}
 const n=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean}}
 return (typeof n.hardwareConcurrency==='number'&&n.hardwareConcurrency>0&&n.hardwareConcurrency<=2)||(typeof n.deviceMemory==='number'&&n.deviceMemory<=2)||!!n.connection?.saveData
}
/** The island ran slowly here: remember it, and lighten the page from now on. */
export function markLiteDevice(){try{localStorage.setItem(KEY,'1')}catch{/* fine */}applyLite()}
export function applyLite(){if(isLiteDevice())document.documentElement.dataset.lite='true'}
