import {useEffect,useImperativeHandle,useRef,type Ref} from 'react'

/** A particle layer for the arcade: a canvas over a game board that throws sparks, shards, stars,
 * embers, confetti and shockwave rings. Positions are fractions of the layer (0–1), so a game just says
 * where on its board. Sparks and stars glow (they're drawn adding light); it only animates while
 * something is flying, and does nothing for people who'd rather have less motion. The canvas reaches a
 * little past its board on every side (`PAD`, as in .sparks), so sparks can fly off the edges. */
const PAD=0.1,at=(f:number)=>(f+PAD)/(1+2*PAD)
export type SparkKind='spark'|'shard'|'star'|'ember'|'confetti'|'heart'|'paw'
export type SparksHandle={burst:(x:number,y:number,o?:{color?:string|string[];n?:number;kind?:SparkKind;speed?:number;size?:number})=>void;ring:(x:number,y:number,color?:string,size?:number)=>void;line:(x0:number,y0:number,x1:number,y1:number,color?:string)=>void}
type P={x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;color:string;kind:SparkKind|'ring';rot:number;vr:number;grav:number}
const CONFETTI=['#ff4d6d','#ffd84d','#4dd2ff','#7dff6a','#c58bff','#ff9b3d']
export default function Sparks({ref}:{ref:Ref<SparksHandle>}){
 const canvas=useRef<HTMLCanvasElement>(null),parts=useRef<P[]>([]),raf=useRef(0),still=useRef(false)
 useEffect(()=>{still.current=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;return ()=>cancelAnimationFrame(raf.current)},[])
 const loop=()=>{
  const c=canvas.current,g=c?.getContext('2d')
  if(!c||!g){raf.current=0;return}
  const r=c.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr)
  if(c.width!==w||c.height!==h){c.width=w;c.height=h}
  g.clearRect(0,0,w,h)
  const list=parts.current
  for(let i=list.length-1;i>=0;i--){
   const p=list[i];p.life++
   if(p.life>=p.max){list.splice(i,1);continue}
   p.vy+=p.grav;p.vx*=0.985;p.vy*=0.985;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr
   const k=1-p.life/p.max,x=p.x*w,y=p.y*h,s=p.size*dpr*(p.kind==='ring'?1:0.6+k*0.4)
   g.save();g.translate(x,y);g.rotate(p.rot)
   g.globalCompositeOperation=p.kind==='spark'||p.kind==='star'||p.kind==='ember'||p.kind==='ring'?'lighter':'source-over'
   g.globalAlpha=p.kind==='ring'?k*0.9:Math.min(1,k*1.6)
   g.fillStyle=p.color;g.strokeStyle=p.color
   if(p.kind==='spark'||p.kind==='ember'){const gr=g.createRadialGradient(0,0,0,0,0,s);gr.addColorStop(0,'#fff');gr.addColorStop(0.3,p.color);gr.addColorStop(1,'transparent');g.fillStyle=gr;g.beginPath();g.arc(0,0,s,0,7);g.fill()}
   else if(p.kind==='star'){g.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4,rr=j%2?s*0.28:s;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}g.closePath();g.fill()}
   else if(p.kind==='shard'){g.beginPath();g.moveTo(0,-s);g.lineTo(s*0.6,s*0.5);g.lineTo(-s*0.5,s*0.7);g.closePath();g.fill();g.globalAlpha*=0.6;g.fillStyle='#fff';g.beginPath();g.moveTo(0,-s);g.lineTo(s*0.2,0);g.lineTo(-s*0.2,0);g.fill()}
   else if(p.kind==='confetti'){g.fillRect(-s*0.5,-s*0.25,s,s*0.5)}
   else if(p.kind==='heart'){g.font=Math.round(s*2)+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText('💗',0,0)}
   else if(p.kind==='paw'){g.font=Math.round(s*2)+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText('🐾',0,0)}
   else if(p.kind==='ring'){const rr=(p.size*(1-k)+4)*dpr;g.lineWidth=Math.max(1,6*k*dpr);g.beginPath();g.arc(0,0,rr,0,7);g.stroke()}
   g.restore()
  }
  raf.current=list.length?requestAnimationFrame(loop):0
 }
 const go=()=>{if(!raf.current)raf.current=requestAnimationFrame(loop)}
 const add=(p:P)=>{if(still.current)return;if(parts.current.length<900)parts.current.push(p)}
 useImperativeHandle(ref,()=>({
  burst:(bx,by,{color='#fff',n=12,kind='spark',speed=1,size=6}={})=>{
   const x=at(bx),y=at(by),colors=Array.isArray(color)?color:kind==='confetti'?CONFETTI:[color]
   for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,v=(0.004+Math.random()*0.012)*speed
    add({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(kind==='ember'?0.004:kind==='confetti'?0.01:0),life:0,max:kind==='confetti'?90+Math.random()*40:kind==='ember'?50+Math.random()*30:28+Math.random()*24,
     size:size*(0.6+Math.random()*0.8),color:colors[i%colors.length],kind,rot:Math.random()*7,vr:(Math.random()-0.5)*0.3,grav:kind==='ember'?-0.00012:kind==='spark'||kind==='star'?0.00008:0.0004})
   }
   go()
  },
  ring:(x,y,color='#fff',size=80)=>{add({x:at(x),y:at(y),vx:0,vy:0,life:0,max:26,size,color,kind:'ring',rot:0,vr:0,grav:0});go()},
  line:(x0,y0,x1,y1,color='#bfe9ff')=>{
   for(let i=0;i<=24;i++){const t=i/24;add({x:at(x0+(x1-x0)*t),y:at(y0+(y1-y0)*t),vx:(Math.random()-0.5)*0.006,vy:(Math.random()-0.5)*0.006,life:0,max:20+Math.random()*16,size:5+Math.random()*4,color,kind:'spark',rot:0,vr:0,grav:0})}
   go()
  },
 }),[]) // eslint-disable-line react-hooks/exhaustive-deps
 return <canvas ref={canvas} className="sparks" aria-hidden="true"/>
}
