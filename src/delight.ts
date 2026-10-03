/** Small celebratory touches (sparkles, hearts, hops, a stagger as a page opens), drawn with the Web
 * Animations API so they cost no library. Each does nothing when motion is reduced: the comfort
 * setting or the device's reduce-motion choice (html[data-motion], set in Workspace). */

const motionOn=()=>document.documentElement.dataset.motion==='full'&&typeof Element.prototype.animate==='function'
const PETALS=['✿','✦','❀','★','✧']

/** Where the last tap or click landed, so a celebration can start from the button that caused it. */
let lastPoint:{x:number;y:number;target:Element|null}|null=null
export function trackPointer(){
 const onDown=(e:PointerEvent)=>{lastPoint={x:e.clientX,y:e.clientY,target:e.target as Element|null}}
 window.addEventListener('pointerdown',onDown,{capture:true,passive:true})
 return()=>window.removeEventListener('pointerdown',onDown,{capture:true})
}

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
export function burst(x:number,y:number,count=12){
 if(!motionOn())return
 for(let i=0;i<count;i++){
  const angle=(i/count)*Math.PI*2+Math.random()*.4,dist=46+Math.random()*44
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

/** A happy little jump. */
export function hop(target:Element|null){
 if(!motionOn()||!target)return
 target.animate([
  {transform:'translateY(0) scale(1)'},{transform:'translateY(-12px) scale(1.06,.96)',offset:.35},
  {transform:'translateY(0) scale(.96,1.05)',offset:.7},{transform:'translateY(0) scale(1)'},
 ],{duration:520,easing:'cubic-bezier(.3,1.4,.5,1)'})
}

/** Finishing an assignment: petals burst from where it was tapped and its card glows and settles. */
export function celebrateDone(){
 if(!motionOn())return
 const point=lastPoint
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

/** The page's cards ease in one after another. Fixed-position bits (the undo bar) are left alone. */
export function stagger(container:Element|null){
 if(!motionOn()||!container)return
 const items=[...container.children].filter((el):el is HTMLElement=>el instanceof HTMLElement&&el.offsetHeight>0&&getComputedStyle(el).position!=='fixed').slice(0,10)
 items.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:420,delay:i*55,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}))
}
