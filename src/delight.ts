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

/** Coins bursting up and out from an element (coins won, something bought in KONO Town). */
export function coinBurst(target:Element|null,count=7){
 if(!motionOn()||!target)return
 const r=target.getBoundingClientRect()
 for(let i=0;i<count;i++){
  const angle=-Math.PI/2+(i-(count-1)/2)*.32,dist=46+Math.random()*30
  const el=particle(i%3===2?'✨':'🪙',r.left+r.width/2,r.top+r.height/2,'is-coin')
  el.animate([
   {transform:'translate(-50%,-50%) scale(.4)',opacity:0},
   {transform:`translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist}px)) scale(1)`,opacity:1,offset:.45},
   {transform:`translate(calc(-50% + ${Math.cos(angle)*dist*1.2}px),calc(-50% + ${Math.sin(angle)*dist+26}px)) scale(.7)`,opacity:0},
  ],{duration:820,delay:i*40,easing:'cubic-bezier(.2,.8,.3,1)',fill:'backwards'}).finished.finally(()=>el.remove())
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

/** A "Done!" stamp thumping down where the finished thing was tapped. */
function stamp(x:number,y:number){
 const el=particle('Done!',Math.min(innerWidth-90,Math.max(90,x+40)),Math.min(innerHeight-120,Math.max(80,y)),'is-stamp')
 el.animate([
  {transform:'translate(-50%,-50%) rotate(-16deg) scale(2.6)',opacity:0},
  {transform:'translate(-50%,-50%) rotate(-12deg) scale(.92)',opacity:1,offset:.22},
  {transform:'translate(-50%,-50%) rotate(-12deg) scale(1)',opacity:1,offset:.3},
  {transform:'translate(-50%,-50%) rotate(-12deg) scale(1)',opacity:1,offset:.78},
  {transform:'translate(-50%,-60%) rotate(-12deg) scale(1.05)',opacity:0},
 ],{duration:1500,easing:'cubic-bezier(.3,1.3,.5,1)'}).finished.finally(()=>el.remove())
}
/** Confetti fluttering down from the top of the screen. */
function confettiRain(count=34){
 const colors=['#ff6b8a','#ffc93d','#5fd18a','#5aa9ff','#b98bff','#ff9a5a']
 for(let i=0;i<count;i++){
  const el=particle('',Math.random()*innerWidth,-12,'is-confetti')
  el.style.background=colors[i%colors.length]
  const drift=(Math.random()-.5)*160,fall=innerHeight*(.55+Math.random()*.4),spin=Math.random()*720-360
  el.animate([
   {transform:'translate(-50%,0) rotate(0deg)',opacity:1},
   {transform:`translate(calc(-50% + ${drift}px),${fall}px) rotate(${spin}deg)`,opacity:0},
  ],{duration:1400+Math.random()*900,delay:Math.random()*260,easing:'cubic-bezier(.25,.6,.4,1)',fill:'backwards'}).finished.finally(()=>el.remove())
 }
}
/** KONO pops up from the bottom of the screen to cheer, then ducks back down. */
function konoPeek(){
 const el=document.createElement('span')
 el.className='delight-kono-peek';el.setAttribute('aria-hidden','true')
 el.innerHTML='<img src="/garden/kono/excited.webp" alt=""><b>Yay! You did it!</b>'
 document.body.appendChild(el)
 el.animate([
  {transform:'translateY(110%) rotate(-6deg)'},{transform:'translateY(8%) rotate(4deg)',offset:.18},{transform:'translateY(14%) rotate(-3deg)',offset:.28},
  {transform:'translateY(10%) rotate(2deg)',offset:.7},{transform:'translateY(115%) rotate(-4deg)'},
 ],{duration:2300,easing:'cubic-bezier(.3,1.2,.5,1)'}).finished.finally(()=>el.remove())
}
/** Which celebration comes next: they take turns, so finishing things stays a little surprising. */
let turn=0
/** Finishing an assignment: petals burst from where it was tapped and its card glows and settles, and one of
 * the bigger celebrations joins in by turns (a Done! stamp, confetti, KONO popping up to cheer). */
export function celebrateDone(){
 if(!motionOn())return
 const point=lastTap()
 const card=point?.target?.closest('.cozy-task-row,.wb-record,.overdue-card li,.swipe-row,article')
 const r=card?.getBoundingClientRect()
 const x=point&&point.x>0?point.x:r?r.left+28:innerWidth/2,y=point&&point.y>0?point.y:r?r.top+r.height/2:innerHeight/2
 const kind=turn++%4
 burst(x,y,kind===0?16:9)
 if(kind===1)stamp(x,y)
 else if(kind===2)confettiRain()
 else if(kind===3)konoPeek()
 card?.animate([
  {transform:'scale(1)',boxShadow:'0 0 0 0 #6fcf9700'},{transform:'scale(1.025)',boxShadow:'0 0 0 6px #6fcf9755',offset:.35},
  {transform:'scale(1)',boxShadow:'0 0 0 0 #6fcf9700'},
 ],{duration:620,easing:'ease-out'})
 hop(document.querySelector('.kono-mood-face > :first-child'))
}

/** KONO keeps an eye on you: the KONO bar's face leans a little toward wherever your finger or pointer is
 * (started once by Workspace; cheap: one passive listener, one frame per move). */
export function konoLook(){
 if(!motionOn())return ()=>{}
 let raf=0,px=0,py=0
 const apply=()=>{raf=0
  const face=document.querySelector<HTMLElement>('.kono-mood-face');if(!face)return
  const r=face.getBoundingClientRect(),dx=px-(r.left+r.width/2),dy=py-(r.top+r.height/2),d=Math.hypot(dx,dy)
  const k=d>700?0:1-d/700,lean=Math.max(-8,Math.min(8,dx/30))*k
  face.style.setProperty('--look-x',(Math.max(-3,Math.min(3,dx/50))*k).toFixed(1)+'px')
  face.style.setProperty('--look-y',(Math.max(-2,Math.min(2,dy/70))*k).toFixed(1)+'px')
  face.style.setProperty('--look-r',lean.toFixed(1)+'deg')
 }
 const move=(e:PointerEvent)=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(apply)}
 window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerdown',move,{passive:true})
 return ()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerdown',move);cancelAnimationFrame(raf)}
}
