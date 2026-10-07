/** Celebrations (petals when work is done, hearts for KONO), drawn with the Web Animations API so they
 * cost no library. Loaded on its own after KONO opens (Workspace); motionCore.ts has the startup part. Each does nothing when motion is reduced: the comfort
 * setting or the device's reduce-motion choice (html[data-motion], set in Workspace). */

import {hop,lastTap,motionOn} from './motionCore'
const PETALS=['✿','✦','❀','★','✧']

function particle(text:string,x:number,y:number,className:string){
 const el=document.createElement('span')
 el.className='delight-particle '+className
 el.textContent=text
 el.setAttribute('aria-hidden','true')
 el.style.left=x+'px';el.style.top=y+'px'
 document.body.appendChild(el)
 return el
}

/** A ring of petals and sparkles bursting out from a point. */
export function burst(x:number,y:number,count=16){
 if(!motionOn())return
 for(let i=0;i<count;i++){
  const angle=(i/count)*Math.PI*2+Math.random()*.4,dist=60+Math.random()*60
  const el=particle(PETALS[i%PETALS.length],x,y,'is-petal')
  el.animate([
   {transform:'translate(-50%,-50%) scale(.4)',opacity:1},
   {transform:`translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist-18}px)) scale(1) rotate(${Math.random()*180-90}deg)`,opacity:1,offset:.6},
   {transform:`translate(calc(-50% + ${Math.cos(angle)*dist*1.15}px),calc(-50% + ${Math.sin(angle)*dist+14}px)) scale(.8)`,opacity:0},
  ],{duration:760+Math.random()*240,easing:'cubic-bezier(.2,.8,.3,1)'}).finished.finally(()=>el.remove())
 }
}

/** Hearts floating up from an element (patting KONO). */
export function floatHearts(target:Element|null,count=3){
 if(!motionOn()||!target)return
 const r=target.getBoundingClientRect()
 for(let i=0;i<count;i++){
  const el=particle(i%2?'💗':'💛',r.left+r.width/2+(i-1)*14,r.top+r.height*.3,'is-heart')
  el.animate([
   {transform:'translate(-50%,0) scale(.5)',opacity:0},
   {transform:'translate(-50%,-14px) scale(1)',opacity:1,offset:.25},
   {transform:`translate(calc(-50% + ${(i-1)*12}px),-64px) scale(.9)`,opacity:0},
  ],{duration:1100,delay:i*120,easing:'ease-out',fill:'backwards'}).finished.finally(()=>el.remove())
 }
}

/** Finishing an assignment: petals burst from where it was tapped and its card glows and settles. */
export function celebrateDone(){
 if(!motionOn())return
 const point=lastTap()
 const card=point?.target?.closest('.cozy-task-row,.wb-record,.overdue-card li,.swipe-row,article')
 const r=card?.getBoundingClientRect()
 const x=point&&point.x>0?point.x:r?r.left+28:innerWidth/2,y=point&&point.y>0?point.y:r?r.top+r.height/2:innerHeight/2
 burst(x,y)
 card?.animate([
  {transform:'scale(1)',boxShadow:'0 0 0 0 #6fcf9700'},{transform:'scale(1.025)',boxShadow:'0 0 0 6px #6fcf9755',offset:.35},
  {transform:'scale(1)',boxShadow:'0 0 0 0 #6fcf9700'},
 ],{duration:620,easing:'ease-out'})
 hop(document.querySelector('.kono-mood-face > :first-child'))
}

