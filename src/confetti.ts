/** A streak milestone: paper confetti drifts down the whole screen. Loaded only when one happens. */
import {motionOn} from './motionCore'
export function confetti(pieces=70){
 if(!motionOn())return
 const colors=['#f6766a','#ffc857','#6fcf97','#7cc4f5','#c59cf2','#ff9ec4']
 for(let i=0;i<pieces;i++){
  const el=document.createElement('span'),x=Math.random()*innerWidth,drift=(Math.random()-.5)*160,spin=Math.random()*720-360
  el.className='delight-confetti';el.setAttribute('aria-hidden','true')
  el.style.left=x+'px';el.style.background=colors[i%colors.length]
  if(i%3===0)el.style.borderRadius='50%'
  document.body.appendChild(el)
  el.animate([
   {transform:'translate(0,-20px) rotate(0)',opacity:1},
   {transform:`translate(${drift}px,${innerHeight*.9}px) rotate(${spin}deg)`,opacity:1,offset:.85},
   {transform:`translate(${drift*1.1}px,${innerHeight+30}px) rotate(${spin*1.2}deg)`,opacity:0},
  ],{duration:1800+Math.random()*1400,delay:Math.random()*500,easing:'cubic-bezier(.25,.6,.4,1)',fill:'backwards'}).finished.finally(()=>el.remove())
 }
}
