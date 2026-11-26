import type {PointerEvent as ReactPointerEvent} from 'react'
import {haptic} from '../game/haptics'

/** Drag with a finger (the browser's own drag and drop only works with a mouse): hold something for a moment,
 * feel a tap, and it lifts off the page as a copy under your finger; slide it over a day (anything marked
 * `data-drop-day`) and that day lights up; near the top or bottom of the screen the page scrolls; let go to drop
 * it there. Moving before the hold ends is just a scroll; Escape or a second finger cancels. */
export type HoldDrag={onStart:()=>void;onOver:(day:string)=>void;onDrop:(day:string)=>void;onEnd:()=>void}
const HOLD_MS=360,SLOP=10
let active=false
export const touchDragging=()=>active

export function holdDrag(e:ReactPointerEvent<HTMLElement>,h:HoldDrag){
 if(e.pointerType!=='touch'||active||!e.isPrimary)return
 const source=e.currentTarget,id=e.pointerId,x0=e.clientX,y0=e.clientY
 let x=x0,y=y0,lifted=false,ghost:HTMLElement|null=null,over='',raf=0,dx=0,dy=0
 const timer=window.setTimeout(lift,HOLD_MS)
 // While lifted, the page mustn't scroll under the finger (the listener has to be there before the first move).
 const noScroll=(t:TouchEvent)=>{if(lifted&&t.cancelable)t.preventDefault()}
 const noMenu=(m:Event)=>{if(lifted)m.preventDefault()}
 window.addEventListener('touchmove',noScroll,{passive:false})
 window.addEventListener('contextmenu',noMenu)
 window.addEventListener('pointermove',move)
 window.addEventListener('pointerup',up)
 window.addEventListener('pointercancel',cancel)
 window.addEventListener('keydown',key)
 function lift(){
  lifted=true;active=true
  const r=source.getBoundingClientRect();dx=x0-r.left;dy=y0-r.top
  ghost=source.cloneNode(true) as HTMLElement
  ghost.classList.add('touch-drag-ghost');ghost.removeAttribute('id');ghost.setAttribute('aria-hidden','true')
  Object.assign(ghost.style,{position:'fixed',left:'0',top:'0',width:Math.min(r.width,300)+'px',margin:'0',zIndex:'2147483000',pointerEvents:'none'})
  document.body.appendChild(ghost);place()
  source.classList.add('is-lifted');document.documentElement.classList.add('is-touch-dragging')
  haptic('select');h.onStart();window.getSelection()?.removeAllRanges()
  raf=requestAnimationFrame(scroll)
 }
 function place(){if(ghost)ghost.style.transform=`translate(${x-dx}px,${y-dy-34}px) rotate(2deg) scale(1.04)`}
 function hit(){
  const el=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-drop-day]'),day=el?.dataset.dropDay??''
  if(day!==over){over=day;h.onOver(day);if(day)haptic('tap')}
 }
 function scroll(){
  if(!lifted)return
  const edge=90,speed=y<edge?-(edge-y)/5:y>innerHeight-edge-40?(y-(innerHeight-edge-40))/5:0
  if(speed){window.scrollBy(0,speed);hit()}
  raf=requestAnimationFrame(scroll)
 }
 function move(m:PointerEvent){
  if(m.pointerId!==id)return
  x=m.clientX;y=m.clientY
  if(!lifted){if(Math.hypot(x-x0,y-y0)>SLOP)stop();return}
  place();hit()
 }
 function up(m:PointerEvent){
  if(m.pointerId!==id)return
  const day=lifted?over:''
  const was=lifted;stop()
  if(was){
   // The tap that ends a drag isn't a tap on whatever is under it.
   const eat=(c:Event)=>{c.stopPropagation();c.preventDefault()};window.addEventListener('click',eat,{capture:true,once:true});window.setTimeout(()=>window.removeEventListener('click',eat,{capture:true}),400)
   if(day)h.onDrop(day)
  }
 }
 function cancel(m:PointerEvent){if(m.pointerId===id)stop()}
 function key(k:KeyboardEvent){if(k.key==='Escape')stop()}
 function stop(){
  window.clearTimeout(timer);cancelAnimationFrame(raf)
  window.removeEventListener('touchmove',noScroll);window.removeEventListener('contextmenu',noMenu)
  window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key)
  if(lifted){ghost?.remove();source.classList.remove('is-lifted');document.documentElement.classList.remove('is-touch-dragging');h.onEnd();active=false}
  lifted=false;ghost=null
 }
}
