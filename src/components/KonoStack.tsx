import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {drop,newTower,score,slide,type Chip,type Floor,type Tower} from '../store/stack'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

const W=440,H=640 // canvas size (drawn at 2× for sharpness)
const U=2.7 // pixels per floor unit across
const FH=15 // a floor's height, in pixels at 1×
const COS=Math.cos(Math.PI/6),SIN=Math.sin(Math.PI/6)

/** KONO Stack (rules in store/stack): KONO's tower, seen at an angle. Each floor slides across the top;
 * tap, click or press Space to set it down. A floor is a little storey of a building: pastel walls with a
 * row of windows (lit up at night) and a ledge; what hangs over breaks off and tumbles away; KONO stands on
 * the roof and hops on a Perfect. The view climbs with the tower and the sky turns from morning to sunset
 * to a starry night. */
export default function KonoStack({ref,best,sound,onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(score:number,perfects:number)=>void}){
 const [start]=useState<Tower>(()=>newTower())
 const tower=useRef<Tower>(start),canvas=useRef<HTMLCanvasElement>(null),kono=useRef<HTMLImageElement|null>(null)
 const falling=useRef<{chip:Chip;t:number}[]>([]),cam=useRef(0),hop=useRef(0),frame=useRef<HTMLDivElement>(null)
 const [s,setS]=useState(0),[call,setCall]=useState<{text:string;at:number}|null>(null),[over,setOver]=useState(false),[streak,setStreak]=useState(0)
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 const finish=()=>{if(ended.current)return;ended.current=true;const t=tower.current;window.setTimeout(()=>onEndRef.current(score(t),t.perfects),1100)}
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(score(tower.current),tower.current.perfects)}}),[])
 const press=()=>{
  if(ended.current||tower.current.over)return
  const {tower:next,result}=drop(tower.current);tower.current=next;setS(score(next));setStreak(next.streak)
  const chip=next.chips[next.chips.length-1];if(result!=='perfect'&&chip&&chip.at===next.floors.length-(result==='miss'?0:1))falling.current.push({chip,t:0})
  if(result==='miss'){setOver(true);fx('thud',soundRef.current);gameSound('lose',soundRef.current);finish();return}
  if(result==='perfect'){fx('star',soundRef.current,Math.min(8,next.streak));hop.current=1;setCall({text:next.streak>=3?'Perfect ×'+next.streak+'!':'Perfect!',at:next.floors.length})}
  else fx('land',soundRef.current)
 }
 const pressRef=useRef(press)
 useEffect(()=>{pressRef.current=press})
 useEffect(()=>{
  const img=new Image();img.src='/garden/kono/happy.webp';kono.current=img
  const key=(e:KeyboardEvent)=>{if(e.code==='Space'||e.code==='Enter'||e.code==='ArrowDown'){if(e.code!=='Space'&&(e.target as HTMLElement)?.closest?.('button'))return;e.preventDefault();pressRef.current()}}
  window.addEventListener('keydown',key)
  let raf=0,last=performance.now(),t=0
  const loop=(now:number)=>{
   const n=Math.min(3,(now-last)/(1000/60));last=now;t+=n
   tower.current=slide(tower.current,n)
   // The view climbs smoothly to keep the top in the upper middle.
   const want=Math.max(0,(tower.current.floors.length-9)*FH);cam.current+=(want-cam.current)*Math.min(1,0.08*n)
   falling.current=falling.current.map(f=>({...f,t:f.t+n})).filter(f=>f.t<90)
   hop.current=Math.max(0,hop.current-0.05*n)
   // How far the sliding floor is from lining up (for tests that build a tower on purpose).
   const tw=tower.current,top=tw.floors[tw.floors.length-1],ax=tw.moving.axis;if(frame.current)frame.current.dataset.off=(tw.moving[ax]-top[ax]).toFixed(2)
   draw(canvas.current,tower.current,cam.current,falling.current,hop.current,t,kono.current)
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',key)}
 },[])
 useEffect(()=>{if(!call)return;const id=window.setTimeout(()=>setCall(null),900);return()=>window.clearTimeout(id)},[call])
 return <div className="break-game kono-stack">
  <div className="blast-top"><span className="blast-best">{best!==null?'Best '+best:'KONO Stack'}</span><span className="blast-coins">{streak>=2&&!over?'🔥 '+streak+' in a row':''}</span></div>
  <div ref={frame} className={'stack-frame'+(over?' is-over':'')} onPointerDown={e=>{e.preventDefault();press()}} role="img" aria-label={'KONO Stack, '+s+' floor'+(s===1?'':'s')}>
   <canvas ref={canvas} width={W*2} height={H*2} aria-hidden="true"/>
   <strong key={s} className="stack-score" aria-live="polite">{s}</strong>
   {call&&<span key={call.at} className="stack-call" aria-hidden="true">{call.text}</span>}
   {s===0&&!over&&<p className="stack-hint"><b>Tap to build</b><span>Line each floor up with the one below</span></p>}
  </div>
  <p className="blast-help">Tap, click or press Space to set each floor down. Line it up exactly for a Perfect; three in a row make the floors bigger again.</p>
 </div>
}

// ---- Drawing ----
const iso=(x:number,z:number,y:number,cam:number):[number,number]=>[W+(x-z)*COS*U*2,H*1.5+(x+z)*SIN*U*2-(y-cam)*2]
function draw(c:HTMLCanvasElement|null,t:Tower,cam:number,falling:{chip:Chip;t:number}[],hop:number,clock:number,kono:HTMLImageElement|null){
 const g=c?.getContext('2d');if(!c||!g)return
 const height=score(t),sky=Math.min(1,height/60),night=Math.max(0,sky*3-2)
 // Sky: morning blue, then a warm sunset, then night with stars.
 const grad=g.createLinearGradient(0,0,0,c.height)
 // Day, sunset, dusk, night: each a top and a bottom color, blended by how tall the tower is.
 const KEYS=[[[110,190,255],[220,242,255]],[[255,150,170],[255,214,160]],[[110,86,190],[246,166,182]],[[22,20,70],[70,52,140]]]
 const at=sky*(KEYS.length-1),i0=Math.min(KEYS.length-2,Math.floor(at)),k=at-i0
 const mix=(a:number[],b:number[])=>'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*k)).join(',')+')'
 grad.addColorStop(0,mix(KEYS[i0][0],KEYS[i0+1][0]));grad.addColorStop(1,mix(KEYS[i0][1],KEYS[i0+1][1]))
 g.fillStyle=grad;g.fillRect(0,0,c.width,c.height)
 if(night>0){g.fillStyle='rgba(255,255,255,'+night+')';for(let i=0;i<40;i++){const sy=(i*89)%(c.height*0.6);g.fillRect((i*211)%c.width,sy,2+(i%2)*2,2+(i%2)*2)}}
 else{g.fillStyle='rgba(255,255,255,.75)';for(let i=0;i<3;i++){const cx=((clock*0.15+i*330)%(c.width+300))-150,cy=120+i*170;cloud(g,cx,cy)}}
 // The ground: a grassy plot under the first floor.
 const base=t.floors[0],pad=8
 face(g,[[base.x-base.w/2-pad,base.z-base.d/2-pad],[base.x+base.w/2+pad,base.z-base.d/2-pad],[base.x+base.w/2+pad,base.z+base.d/2+pad],[base.x-base.w/2-pad,base.z+base.d/2+pad]].map(([x,z])=>iso(x,z,0,cam)),'#8fd36a','#5fa64a')
 sides(g,{x:base.x,z:base.z,w:base.w+pad*2,d:base.d+pad*2,tint:0},-6,6,cam,'#b98a5e','#9a6f48',false,0)
 // The floors, bottom to top, and the one sliding.
 t.floors.forEach((f,i)=>block(g,f,i*FH,cam,night,i===0))
 if(!t.over)block(g,t.moving,t.floors.length*FH,cam,night,false)
 // Pieces that broke off, tumbling down.
 for(const {chip,t:ft} of falling){const drop=ft*ft*0.05,dx=chip.axis==='x'?chip.side*ft*0.12:0,dz=chip.axis==='z'?chip.side*ft*0.12:0
  g.save();g.globalAlpha=Math.max(0,1-ft/90);block(g,{...chip,x:chip.x+dx,z:chip.z+dz},chip.at*FH-drop,cam,night,false);g.restore()}
 // KONO on the roof.
 const top=t.floors[t.floors.length-1],[kx,ky]=iso(top.x,top.z,t.floors.length*FH,cam)
 if(kono?.complete&&kono.naturalWidth){const w=72,h=w*kono.naturalHeight/kono.naturalWidth,lift=Math.sin(hop*Math.PI)*36
  g.save();if(t.over){g.translate(kx,ky-h/2);g.rotate(-0.35);g.translate(-kx,-(ky-h/2))}g.drawImage(kono,kx-w/2,ky-h-lift+6,w,h);g.restore()}
}
function cloud(g:CanvasRenderingContext2D,x:number,y:number){g.beginPath();g.arc(x,y,34,0,Math.PI*2);g.arc(x+40,y-14,42,0,Math.PI*2);g.arc(x+86,y,32,0,Math.PI*2);g.fill()}
function face(g:CanvasRenderingContext2D,pts:[number,number][],fill:string,stroke:string){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=1.5;g.stroke()}
/** The two walls you can see (facing +x and +z) of a box from y0 up to y1, with windows if `windows`. */
function sides(g:CanvasRenderingContext2D,f:Floor,y0:number,y1:number,cam:number,right:string,left:string,windows:boolean,night:number){
 const x0=f.x-f.w/2,x1=f.x+f.w/2,z0=f.z-f.d/2,z1=f.z+f.d/2
 face(g,[iso(x1,z0,y1,cam),iso(x1,z1,y1,cam),iso(x1,z1,y0,cam),iso(x1,z0,y0,cam)],right,'rgba(40,30,50,.25)')
 face(g,[iso(x0,z1,y1,cam),iso(x1,z1,y1,cam),iso(x1,z1,y0,cam),iso(x0,z1,y0,cam)],left,'rgba(40,30,50,.25)')
 if(!windows)return
 const lit=night>0.3?"rgba(255,214,120,.95)":"rgba(170,215,255,.9)",wy0=y0+3.5,wy1=y1-4
 for(let z=z0+2.5;z+3<=z1-1;z+=6)face(g,[iso(x1,z,wy1,cam),iso(x1,z+3,wy1,cam),iso(x1,z+3,wy0,cam),iso(x1,z,wy0,cam)],lit,'rgba(40,30,50,.2)')
 for(let x=x0+2.5;x+3<=x1-1;x+=6)face(g,[iso(x,z1,wy1,cam),iso(x+3,z1,wy1,cam),iso(x+3,z1,wy0,cam),iso(x,z1,wy0,cam)],lit,'rgba(40,30,50,.2)')
}
/** One storey: pastel walls with windows, a lighter ledge on top. */
function block(g:CanvasRenderingContext2D,f:Floor,y:number,cam:number,night:number,ground:boolean){
 const h=f.tint,wall=(l:number)=>'hsl('+h+' 55% '+(l-night*18)+'%)'
 sides(g,f,y,y+FH,cam,wall(70),wall(60),!ground,night)
 const x0=f.x-f.w/2,x1=f.x+f.w/2,z0=f.z-f.d/2,z1=f.z+f.d/2
 face(g,[iso(x0,z0,y+FH,cam),iso(x1,z0,y+FH,cam),iso(x1,z1,y+FH,cam),iso(x0,z1,y+FH,cam)],'hsl('+h+' 60% '+(86-night*20)+'%)','rgba(40,30,50,.3)')
}
