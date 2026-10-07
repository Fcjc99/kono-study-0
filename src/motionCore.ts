/** The motion touches needed as soon as KONO opens: where the last tap landed, KONO's hop, and the
 * page's cards easing in. The celebrations themselves (petals, hearts) are in delight.ts, which loads
 * on its own a moment later. Everything here does nothing when motion is reduced (html[data-motion]). */

export const motionOn=()=>document.documentElement.dataset.motion==='full'&&typeof Element.prototype.animate==='function'

/** Where the last tap or click landed, so a celebration can start from the button that caused it. */
let lastPoint:{x:number;y:number;target:Element|null}|null=null
export function trackPointer(){
 const onDown=(e:PointerEvent)=>{lastPoint={x:e.clientX,y:e.clientY,target:e.target as Element|null}}
 window.addEventListener('pointerdown',onDown,{capture:true,passive:true})
 return()=>window.removeEventListener('pointerdown',onDown,{capture:true})
}

/** The last tap: where it landed and on what. */
export const lastTap=()=>lastPoint

/** A happy little jump. */
export function hop(target:Element|null){
 if(!motionOn()||!target)return
 target.animate([
  {transform:'translateY(0) scale(1)'},{transform:'translateY(-12px) scale(1.06,.96)',offset:.35},
  {transform:'translateY(0) scale(.96,1.05)',offset:.7},{transform:'translateY(0) scale(1)'},
 ],{duration:520,easing:'cubic-bezier(.3,1.4,.5,1)'})
}

/** The page's cards ease in one after another. Fixed-position bits (the undo bar) are left alone. */
export function stagger(container:Element|null){
 if(!motionOn()||!container)return
 const items=[...container.children].filter((el):el is HTMLElement=>el instanceof HTMLElement&&el.offsetHeight>0&&getComputedStyle(el).position!=='fixed').slice(0,10)
 items.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:420,delay:i*55,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}))
}

