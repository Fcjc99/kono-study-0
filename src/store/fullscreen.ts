/** Full screen (no browser bars), from a tap. iPad Safari before 16.4 only knows the webkit-prefixed call. */
type El=HTMLElement&{webkitRequestFullscreen?:()=>void}
type Doc=Document&{webkitFullscreenElement?:Element|null;webkitExitFullscreen?:()=>void}
export const isFullscreen=()=>!!(document.fullscreenElement??(document as Doc).webkitFullscreenElement)
export const canFullscreen=()=>{const el=document.documentElement as El;return !!(el.requestFullscreen??el.webkitRequestFullscreen)}
export function enterFullscreen(){if(isFullscreen())return;const el=document.documentElement as El;try{if(el.requestFullscreen)void el.requestFullscreen().catch(()=>undefined);else el.webkitRequestFullscreen?.()}catch{/* not allowed here */}}
export function exitFullscreen(){const d=document as Doc;try{if(document.exitFullscreen)void document.exitFullscreen().catch(()=>undefined);else d.webkitExitFullscreen?.()}catch{/* fine */}}
