import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import Matter from 'matter-js'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'
import {SHAPES,COLORS,towerHeight,type ShapeId} from '../store/teeter'
import './teeter.css'

const W=420,H=640 // canvas size at 1× (drawn at 2× for sharpness)
const T=26 // one block, in pixels
const ISLAND_TOP=560,ISLAND_W=10*T // the island's grassy top, where the tower stands
const HEARTS=3

type Piece={body:Matter.Body;shape:ShapeId;color:string;face:number;rest:number}

/** KONO Teeter Tower: KONO floats on a cloud and lowers pastel blocks onto a little floating island. Slide a
 * block and turn it while it comes down; once it touches the tower, it's real physics: blocks settle, lean
 * and can tip over. Build as high as you can. A block that tumbles off the island costs a heart (three in
 * all). Every five rows is a milestone: KONO cheers and the sky turns from day to sunset to stars. */
export default function KonoTeeter({ref,best,sound,onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(height:number,blocks:number)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),frame=useRef<HTMLDivElement>(null)
 const [height,setHeight]=useState(0),[hearts,setHearts]=useState(HEARTS),[call,setCall]=useState<{text:string;at:number}|null>(null),[over,setOver]=useState(false),[next,setNext]=useState<ShapeId>('O')
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound)
 const state=useRef({best:0,blocks:0,hearts:HEARTS})
 const input=useRef({left:false,right:false,down:false,rotate:0,dragX:null as number|null,nudge:0})
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 const finish=()=>{if(ended.current)return;ended.current=true;window.setTimeout(()=>onEndRef.current(state.current.best,state.current.blocks),1300)}
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(state.current.best,state.current.blocks)}}),[])

 useEffect(()=>{
  const {Engine,Bodies,Body,Composite,Query}=Matter
  const engine=Engine.create({gravity:{x:0,y:1,scale:0.0012},positionIterations:10,velocityIterations:8})
  const ground=Bodies.rectangle(W/2,ISLAND_TOP+20,ISLAND_W,40,{isStatic:true,friction:1,label:'island'})
  Composite.add(engine.world,ground)
  const placed:Piece[]=[]
  const imgs:Record<string,HTMLImageElement>={}
  for(const [k,src] of [['kono','/garden/kono/happy.webp'],['cheer','/garden/kono/excited.webp'],['cloud','/garden/strip/cloud-a.webp'],['cloud2','/garden/strip/cloud-b.webp'],['treeL','/garden/strip/tree-round-afternoon.webp'],['treeR','/garden/strip/tree-cherry-afternoon.webp'],['grass','/garden/strip/grass-edge.webp']] as const){const i=new Image();i.src=src;imgs[k]=i}
  const bag:ShapeId[]=[]
  const draw=():ShapeId=>{if(!bag.length){const all=Object.keys(SHAPES) as ShapeId[];for(let i=all.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[all[i],all[j]]=[all[j],all[i]]}bag.push(...all)}return bag.pop()!}
  let upcoming=draw()
  let active:Piece|null=null,targetX=W/2,spin=0,settleUntil=0,cheer=0,milestone=0,shake=0,graceUntil=0
  const cam={y:0,v:0}
  const make=(shape:ShapeId,x:number,y:number):Piece=>{
   const cells=SHAPES[shape],cx=cells.reduce((a,c)=>a+c[0],0)/cells.length,cy=cells.reduce((a,c)=>a+c[1],0)/cells.length
   const parts=cells.map(([cxl,cyl])=>Bodies.rectangle(x+(cxl-cx)*T,y+(cyl-cy)*T,T,T,{chamfer:{radius:2}}))
   // Made as a real body first, then held still while it's lowered: setStatic keeps its mass for when it lands.
   const body=Body.create({parts,friction:1,frictionStatic:2,frictionAir:0.03,restitution:0,density:0.0016,slop:0.02})
   Body.setStatic(body,true)
   return {body,shape,color:COLORS[shape],face:Math.floor(Math.random()*cells.length),rest:0}
  }
  const topY=()=>placed.reduce((m,p)=>Math.min(m,p.body.bounds.min.y),ISLAND_TOP)
  const spawn=()=>{
   const shape=upcoming;upcoming=draw();setNext(upcoming)
   const y=Math.min(ISLAND_TOP-9*T,topY()-8*T)
   active=make(shape,W/2,y);targetX=W/2;Composite.add(engine.world,active.body)
  }
  const release=()=>{
   if(!active)return
   const p=active;active=null
   Body.setStatic(p.body,false);Body.setVelocity(p.body,{x:0,y:0.5})
   placed.push(p);state.current.blocks++
   fx('land',soundRef.current);try{navigator.vibrate?.(10)}catch{/* no vibration */}
   settleUntil=performance.now()+650
  }
  const rotate=()=>{if(active&&!spin){spin=Math.PI/2;fx('tick',soundRef.current)}}
  const key=(e:KeyboardEvent,down:boolean)=>{
   if((e.target as HTMLElement)?.closest?.('input,textarea'))return
   const k=e.code,i=input.current
   if(k==='ArrowLeft'||k==='KeyA'){i.left=down;if(down)i.nudge=-1;e.preventDefault()}
   else if(k==='ArrowRight'||k==='KeyD'){i.right=down;if(down)i.nudge=1;e.preventDefault()}
   else if(k==='ArrowDown'||k==='KeyS'||k==='Space'){i.down=down;e.preventDefault()}
   else if((k==='ArrowUp'||k==='KeyW'||k==='KeyX')&&down&&!e.repeat){rotate();e.preventDefault()}
  }
  const kd=(e:KeyboardEvent)=>key(e,true),ku=(e:KeyboardEvent)=>key(e,false)
  window.addEventListener('keydown',kd);window.addEventListener('keyup',ku)
  ;(frame.current as (HTMLDivElement&{__rotate?:()=>void})|null)!.__rotate=rotate
  let raf=0,last=performance.now(),t=0,acc=0
  const loop=(now:number)=>{
   const dt=Math.min(50,now-last);last=now;t+=dt/16.67
   const i=input.current
   if(active&&!ended.current){
    // Steering: a step per tap (or per 120 ms held), or follow a finger dragging across.
    if(i.dragX!==null)targetX=i.dragX
    else if(i.nudge){targetX+=i.nudge*T/2;i.nudge=0}
    else if((i.left||i.right)&&Math.floor(now/120)!==Math.floor((now-dt)/120))targetX+=(i.right?1:-1)*T/2
    targetX=Math.max(30,Math.min(W-30,targetX))
    const b=active.body,dx=targetX-b.position.x,fall=(i.down?7:1.1+Math.min(1.4,state.current.best*0.03))*dt/16.67
    const others=[ground,...placed.map(p=>p.body)],hits=()=>Query.collides(b,others).length>0
    // A turn that would push into the tower waits (no shove).
    if(spin>0){const step=Math.min(spin,0.25*dt/16.67);Body.rotate(b,step);if(hits())Body.rotate(b,-step);else spin-=step}
    // Move in small steps and stop just short of touching, so a block is set down, not slammed in: an
    // overlap makes the physics push the tower apart.
    const mx=Math.sign(dx)*Math.min(Math.abs(dx),6*dt/16.67),n=Math.max(1,Math.ceil(Math.max(Math.abs(mx),fall)/2))
    let landed=false
    for(let k=0;k<n&&!landed;k++){
     const was={...b.position}
     Body.setPosition(b,{x:was.x+mx/n,y:was.y})
     if(hits())Body.setPosition(b,was)
     const side={...b.position}
     Body.setPosition(b,{x:side.x,y:side.y+fall/n})
     if(hits()){Body.setPosition(b,side);landed=true}
    }
    // Resting on the island or the tower (or gone past it): it's in physics' hands now.
    if(landed||b.bounds.min.y>ISLAND_TOP+60)release()
   }else if(!active&&!ended.current&&now>settleUntil)spawn()
   acc+=dt;while(acc>=16.67){Engine.update(engine,16.67);acc-=16.67}
   // Fell off: a heart, and the block is gone.
   // One tumble costs one heart, however many blocks go over with it.
   for(let k=placed.length-1;k>=0;k--){const p=placed[k];if(p.body.position.y>ISLAND_TOP+260){Composite.remove(engine.world,p.body);placed.splice(k,1)
    if(now<graceUntil)continue
    graceUntil=now+2500;state.current.hearts--;setHearts(state.current.hearts);shake=1;fx('thud',soundRef.current);setCall({text:state.current.hearts>0?'Oops!':'Tumble!',at:now})
    if(state.current.hearts<=0&&!ended.current){setOver(true);gameSound('lose',soundRef.current);finish()}}}
   // The height counts once the blocks are resting.
   // A block counts once it has been still for about half a second (not while it pauses mid-topple).
   for(const p of placed)p.rest=p.body.speed<0.4&&Math.abs(p.body.angularVelocity)<0.015?p.rest+1:0
   const h=towerHeight(placed.map(p=>({top:p.body.bounds.min.y,speed:p.rest>=24?0:1})),ISLAND_TOP,T)
   if(h>state.current.best){state.current.best=h;setHeight(h);if(frame.current)frame.current.dataset.height=String(h)
    if(Math.floor(h/5)>milestone){milestone=Math.floor(h/5);cheer=1;fx('star',soundRef.current,Math.min(8,milestone));setCall({text:h+' high!',at:now})}}
   // The view climbs with the tower (a soft spring), keeping KONO's block in the top third.
   const want=Math.min(0,topY()-ISLAND_TOP+H*0.42)
   cam.v+=((want-cam.y)*0.02-cam.v*0.18)*dt/16.67;cam.y+=cam.v*dt/16.67
   cheer=Math.max(0,cheer-0.012*dt/16.67);shake=Math.max(0,shake-0.04*dt/16.67)
   paint(canvas.current,{placed,active,cam:cam.y,t,cheer,shake,imgs,height:state.current.best,over:ended.current})
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);Engine.clear(engine)}
 },[])
 useEffect(()=>{if(!call)return;const id=window.setTimeout(()=>setCall(null),1000);return()=>window.clearTimeout(id)},[call])
 // Touch: drag across to steer, tap to turn.
 const ptr=useRef<{x:number;t:number;moved:boolean}|null>(null)
 const toX=(e:React.PointerEvent)=>{const r=e.currentTarget.getBoundingClientRect();return (e.clientX-r.left)/r.width*W}
 const hold=(k:'left'|'right'|'down',on:boolean)=>{input.current[k]=on;if(on&&k!=='down')input.current.nudge=k==='left'?-1:1}
 const turn=()=>(frame.current as (HTMLDivElement&{__rotate?:()=>void})|null)?.__rotate?.()
 return <div className="break-game kono-teeter">
  <div className="blast-top"><span className="blast-best">{best!==null?'Best '+best:'KONO Teeter Tower'}</span><span className="teeter-hearts" aria-label={hearts+' hearts left'}>{Array.from({length:HEARTS},(_,i)=><i key={i} className={i<hearts?'is-on':undefined}>♥</i>)}</span></div>
  <div ref={frame} className={'teeter-frame'+(over?' is-over':'')} role="img" aria-label={'KONO Teeter Tower, '+height+' rows high'} data-height="0"
   onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);ptr.current={x:toX(e),t:performance.now(),moved:false}}}
   onPointerMove={e=>{const p=ptr.current;if(!p)return;const x=toX(e);if(Math.abs(x-p.x)>8){p.moved=true;input.current.dragX=x}}}
   onPointerUp={()=>{const p=ptr.current;ptr.current=null;input.current.dragX=null;if(p&&!p.moved&&performance.now()-p.t<300)turn()}}
   onPointerCancel={()=>{ptr.current=null;input.current.dragX=null}}>
   <canvas ref={canvas} width={W*2} height={H*2} aria-hidden="true"/>
   <strong key={height} className="teeter-score" aria-live="polite">{height}</strong>
   <span className="teeter-next" aria-label={'Next block: '+next}><small>Next</small><NextShape shape={next}/></span>
   {call&&<span key={call.at} className="teeter-call" aria-hidden="true">{call.text}</span>}
   {height===0&&!over&&<p className="teeter-hint"><b>Build it tall!</b><span>Drag to steer · tap to turn</span></p>}
  </div>
  <div className="teeter-pad" role="group" aria-label="Controls">
   <button type="button" aria-label="Left" onPointerDown={()=>hold('left',true)} onPointerUp={()=>hold('left',false)} onPointerLeave={()=>hold('left',false)}>◀</button>
   <button type="button" aria-label="Turn" onClick={turn}>⟳</button>
   <button type="button" aria-label="Drop faster" onPointerDown={()=>hold('down',true)} onPointerUp={()=>hold('down',false)} onPointerLeave={()=>hold('down',false)}>▼</button>
   <button type="button" aria-label="Right" onPointerDown={()=>hold('right',true)} onPointerUp={()=>hold('right',false)} onPointerLeave={()=>hold('right',false)}>▶</button>
  </div>
  <p className="blast-help">Drag (or ◀ ▶, arrow keys) to steer, tap (or ⟳, ↑) to turn, hold ▼ (or ↓, Space) to drop faster. Blocks that fall off the island cost a heart.</p>
 </div>
}

function NextShape({shape}:{shape:ShapeId}){
 const cells=SHAPES[shape],w=Math.max(...cells.map(c=>c[0]))+1,h=Math.max(...cells.map(c=>c[1]))+1
 return <svg viewBox={`0 0 ${w*10} ${h*10}`} width={w*10} height={h*10} aria-hidden="true">{cells.map(([x,y],i)=><rect key={i} x={x*10+.5} y={y*10+.5} width="9" height="9" rx="2.5" fill={COLORS[shape]}/>)}</svg>
}

type Scene={placed:Piece[];active:Piece|null;cam:number;t:number;cheer:number;shake:number;imgs:Record<string,HTMLImageElement>;height:number;over:boolean}
const ok=(i?:HTMLImageElement)=>!!i&&i.complete&&i.naturalWidth>0
function paint(c:HTMLCanvasElement|null,s:Scene){
 const g=c?.getContext('2d');if(!c||!g)return
 g.setTransform(2,0,0,2,0,0)
 // The sky: day, then sunset, then stars as the tower climbs.
 const k=Math.min(1,s.height/30),sky=g.createLinearGradient(0,0,0,H)
 const mix=(a:number[],b:number[],f:number)=>`rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*f)).join(',')})`
 const top=k<.5?mix([143,208,255],[255,166,140],k*2):mix([255,166,140],[34,40,92],(k-.5)*2),bot=k<.5?mix([226,246,255],[255,214,170],k*2):mix([255,214,170],[86,72,140],(k-.5)*2)
 sky.addColorStop(0,top);sky.addColorStop(1,bot);g.fillStyle=sky;g.fillRect(0,0,W,H)
 if(k>.55){g.fillStyle=`rgba(255,255,255,${(k-.55)*1.8})`;for(let i=0;i<40;i++){const x=(i*97)%W,y=((i*53)%(H*0.7)+s.cam*0.15)%(H*0.7);g.fillRect(x,y,1.5,1.5)}}
 // Clouds drift by, slower than the tower moves (a little depth).
 for(const [img,y0,sp,w] of [['cloud',90,0.15,120],['cloud2',230,0.1,96],['cloud',380,0.2,140]] as const){const i=s.imgs[img];if(!ok(i))continue;const x=((s.t*sp+y0*3)%(W+w*2))-w,y=((y0-s.cam*0.4)%(H+120)+H+120)%(H+120)-60;g.globalAlpha=k>.6?.35:.9;g.drawImage(i,x,y,w,w*i.naturalHeight/i.naturalWidth);g.globalAlpha=1}
 const shake=s.shake?Math.sin(s.t*2.4)*3*s.shake:0
 g.save();g.translate(shake,-s.cam)
 // The island: a grassy ledge with earth below and roots hanging, a tree at each end.
 const ix=W/2-ISLAND_W/2-14,iw=ISLAND_W+28
 const earth=g.createLinearGradient(0,ISLAND_TOP,0,ISLAND_TOP+90);earth.addColorStop(0,'#b98654');earth.addColorStop(1,'#6e4a2c')
 g.fillStyle=earth;g.beginPath();g.moveTo(ix,ISLAND_TOP+6);g.lineTo(ix+iw,ISLAND_TOP+6);g.lineTo(ix+iw-30,ISLAND_TOP+60);g.quadraticCurveTo(W/2,ISLAND_TOP+120,ix+30,ISLAND_TOP+60);g.closePath();g.fill()
 g.strokeStyle='#5a3a22';g.lineWidth=2;for(let r=0;r<5;r++){const x=ix+40+r*36;g.beginPath();g.moveTo(x,ISLAND_TOP+60);g.quadraticCurveTo(x+6,ISLAND_TOP+80+r%2*8,x-2,ISLAND_TOP+96+r*3);g.stroke()}
 if(ok(s.imgs.treeL))g.drawImage(s.imgs.treeL,ix-38,ISLAND_TOP-74,70,80)
 if(ok(s.imgs.treeR))g.drawImage(s.imgs.treeR,ix+iw-34,ISLAND_TOP-82,76,88)
 g.fillStyle='#6cbf4f';g.beginPath();g.roundRect(ix,ISLAND_TOP-2,iw,12,6);g.fill();g.fillStyle='#4f9a3c';g.fillRect(ix+4,ISLAND_TOP+8,iw-8,3)
 if(ok(s.imgs.grass))for(let x=ix;x<ix+iw-10;x+=40)g.drawImage(s.imgs.grass,x,ISLAND_TOP-14,40,16)
 // The blocks.
 for(const p of s.placed)block(g,p,s.t)
 if(s.active){
  // A guide straight down from the block to where it would land, and KONO above on a cloud.
  const b=s.active.body;g.strokeStyle='rgba(255,255,255,.55)';g.setLineDash([4,6]);g.lineWidth=2;g.beginPath();g.moveTo(b.position.x,b.bounds.max.y+4);g.lineTo(b.position.x,ISLAND_TOP);g.stroke();g.setLineDash([])
  block(g,s.active,s.t)
  const ky=b.bounds.min.y-58,kx=b.position.x
  if(ok(s.imgs.cloud))g.drawImage(s.imgs.cloud,kx-46,ky+24,92,30)
  const kimg=s.cheer>0&&ok(s.imgs.cheer)?s.imgs.cheer:s.imgs.kono
  if(ok(kimg))g.drawImage(kimg,kx-24,ky-Math.abs(Math.sin(s.t*0.12))*3-(s.cheer?Math.abs(Math.sin(s.t*0.4))*8:0),48,48)
 }
 g.restore()
}
function block(g:CanvasRenderingContext2D,p:Piece,t:number){
 const b=p.body,parts=b.parts.length>1?b.parts.slice(1):b.parts
 parts.forEach((part,i)=>{
  g.save();g.translate(part.position.x,part.position.y);g.rotate(b.angle)
  const h=T/2-0.5
  g.fillStyle=p.color;g.beginPath();g.roundRect(-h,-h,h*2,h*2,5);g.fill()
  // Soft shading: a light top edge, a deeper bottom edge, a little shine.
  g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.roundRect(-h+2,-h+2,h*2-4,5,3);g.fill()
  g.fillStyle='rgba(60,30,40,.16)';g.beginPath();g.roundRect(-h+2,h-6,h*2-4,4,2);g.fill()
  g.strokeStyle='rgba(60,30,40,.28)';g.lineWidth=1.2;g.beginPath();g.roundRect(-h,-h,h*2,h*2,5);g.stroke()
  if(i===p.face){ // a little KONO face on one block of each piece
   g.fillStyle='#3a2630';g.beginPath();g.arc(-4.5,-1,1.6,0,7);g.arc(4.5,-1,1.6,0,7);g.fill()
   g.strokeStyle='#3a2630';g.lineWidth=1.3;g.beginPath();g.arc(0,1.5,2.6,0.2,Math.PI-0.2);g.stroke()
   g.fillStyle='rgba(255,120,140,.45)';g.beginPath();g.arc(-7.5,2.5,2,0,7);g.arc(7.5,2.5,2,0,7);g.fill()
   if(Math.floor(t/90)%7===0){g.fillStyle=p.color;g.fillRect(-7,-3,5,3);g.fillRect(2,-3,5,3)} // a blink
  }
  g.restore()
 })
}
