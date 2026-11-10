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
 const [height,setHeight]=useState(0),[hearts,setHearts]=useState(HEARTS),[call,setCall]=useState<{text:string;at:number}|null>(null),[over,setOver]=useState(false),[next,setNext]=useState<ShapeId>('O'),[started,setStarted]=useState(false)
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),bestRef=useRef(best)
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
  // Drag and drop: hold the falling block (it waits in your hand), move it anywhere above the tower, let go
  // and it drops. A drag that doesn't start on the block steers it sideways; a quick tap turns it.
  let grabTo:{x:number;y:number}|null=null,dropping=false
  const fxs:Bit[]=[]
  const puff=(x:number,y:number,n:number,color='#ffffff')=>{for(let k=0;k<n;k++)fxs.push({x:x+(Math.random()-.5)*T*2,y,vx:(Math.random()-.5)*1.6,vy:-Math.random()*1.2-.2,life:1,color,size:2+Math.random()*3,kind:'dust'})}
  const confetti=(y:number)=>{const cs=Object.values(COLORS);for(let k=0;k<36;k++)fxs.push({x:Math.random()*W,y:y-40-Math.random()*60,vx:(Math.random()-.5)*2,vy:Math.random()*-2,life:1.6,color:cs[k%cs.length],size:4+Math.random()*3,kind:'confetti',spin:Math.random()*6})}
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
   puff(p.body.position.x,p.body.bounds.max.y,dropping?10:6)
   placed.push(p);state.current.blocks++;grabTo=null;dropping=false;setStarted(true)
   if(frame.current){frame.current.dataset.blocks=String(state.current.blocks);frame.current.dataset.lastX=String(Math.round(p.body.position.x))}
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
  const el=frame.current!
  let ptr:{id:number;sx:number;sy:number;t:number;moved:boolean;grab:boolean;ox:number;oy:number}|null=null
  const toWorld=(e:PointerEvent)=>{const r=el.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H+cam.y}}
  const pd=(e:PointerEvent)=>{
   if(e.button>0||ended.current)return
   e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch{/* not capturable */}
   const p=toWorld(e),b=active?.body
   // Generous: a finger near the block (or on KONO's cloud above it) picks it up.
   const near=!!b&&p.x>b.bounds.min.x-28&&p.x<b.bounds.max.x+28&&p.y>b.bounds.min.y-70&&p.y<b.bounds.max.y+28
   ptr={id:e.pointerId,sx:p.x,sy:p.y,t:performance.now(),moved:false,grab:near,ox:b?b.position.x-p.x:0,oy:b?b.position.y-p.y:0}
   if(near&&b){grabTo={x:b.position.x,y:b.position.y};dropping=false;fx('tick',soundRef.current)}
  }
  const pm=(e:PointerEvent)=>{
   if(!ptr||e.pointerId!==ptr.id)return
   const p=toWorld(e)
   if(Math.hypot(p.x-ptr.sx,p.y-ptr.sy)>8)ptr.moved=true
   if(!ptr.moved)return
   if(ptr.grab&&active)grabTo={x:p.x+ptr.ox,y:p.y+ptr.oy}
   else input.current.dragX=p.x
  }
  const pu=(e:PointerEvent)=>{
   if(!ptr||e.pointerId!==ptr.id)return
   const d=ptr;ptr=null;input.current.dragX=null
   if(!d.moved&&performance.now()-d.t<300){grabTo=null;rotate()}
   else if(d.grab&&active){grabTo=null;dropping=true;targetX=active.body.position.x}
   else grabTo=null
  }
  const pc=()=>{ptr=null;grabTo=null;input.current.dragX=null}
  el.addEventListener('pointerdown',pd);el.addEventListener('pointermove',pm);el.addEventListener('pointerup',pu);el.addEventListener('pointercancel',pc)
  let raf=0,last=performance.now(),t=0,acc=0
  const loop=(now:number)=>{
   const dt=Math.min(50,now-last);last=now;t+=dt/16.67
   const i=input.current
   let ghost:{dy:number;miss:boolean}|null=null
   if(active&&!ended.current&&grabTo){
    // In your hand: it follows your finger (never into the tower), and doesn't fall.
    const b=active.body,others=[ground,...placed.map(p=>p.body)],hits=()=>Query.collides(b,others).length>0
    if(spin>0){const step=Math.min(spin,0.25*dt/16.67);Body.rotate(b,step);if(hits())Body.rotate(b,-step);else spin-=step}
    const below=b.bounds.max.y-b.position.y,above=b.position.y-b.bounds.min.y
    const tx=Math.max(24,Math.min(W-24,grabTo.x)),ty=Math.max(cam.y+above+64,Math.min(ISLAND_TOP-below-2,grabTo.y))
    const mx=tx-b.position.x,my=ty-b.position.y,n=Math.max(1,Math.ceil(Math.max(Math.abs(mx),Math.abs(my))/3))
    for(let k=0;k<n;k++){
     const was={...b.position};Body.setPosition(b,{x:was.x+mx/n,y:was.y});if(hits())Body.setPosition(b,was)
     const side={...b.position};Body.setPosition(b,{x:side.x,y:side.y+my/n});if(hits()){Body.setPosition(b,side);break}
    }
    targetX=b.position.x
   }else if(active&&!ended.current){
    // Steering: a step per tap (or per 120 ms held), or follow a finger dragging across.
    if(i.dragX!==null)targetX=i.dragX
    else if(i.nudge){targetX+=i.nudge*T/2;i.nudge=0}
    else if((i.left||i.right)&&Math.floor(now/120)!==Math.floor((now-dt)/120))targetX+=(i.right?1:-1)*T/2
    targetX=Math.max(30,Math.min(W-30,targetX))
    const b=active.body,dx=targetX-b.position.x,fall=(dropping?9:i.down?7:1.1+Math.min(1.4,state.current.best*0.03))*dt/16.67
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
   // Where it would land, straight down from here (red if that misses the island).
   if(active&&!ended.current){
    const b=active.body,others=[ground,...placed.map(p=>p.body)],was={...b.position},step=T/3
    let dy=0,miss=false
    for(;;){Body.setPosition(b,{x:was.x,y:was.y+dy+step});if(Query.collides(b,others).length)break;dy+=step;if(b.bounds.min.y>ISLAND_TOP+40){miss=true;break}}
    Body.setPosition(b,was);ghost={dy,miss}
   }
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
    if(Math.floor(h/5)>milestone){milestone=Math.floor(h/5);cheer=1;confetti(topY());fx('star',soundRef.current,Math.min(8,milestone));setCall({text:h+' high!',at:now})}}
   // Dust and confetti.
   for(let k=fxs.length-1;k>=0;k--){const f=fxs[k],m=dt/16.67;f.x+=f.vx*m;f.y+=f.vy*m;f.vy+=(f.kind==='confetti'?0.05:0.02)*m;f.vx*=0.98;f.life-=(f.kind==='confetti'?0.012:0.03)*m;if(f.spin!==undefined)f.spin+=0.15*m;if(f.life<=0)fxs.splice(k,1)}
   // The view climbs with the tower (a soft spring), keeping KONO's block in the top third.
   const want=Math.min(0,topY()-ISLAND_TOP+H*0.42)
   cam.v+=((want-cam.y)*0.02-cam.v*0.18)*dt/16.67;cam.y+=cam.v*dt/16.67
   cheer=Math.max(0,cheer-0.012*dt/16.67);shake=Math.max(0,shake-0.04*dt/16.67)
   paint(canvas.current,{placed,active,cam:cam.y,t,cheer,shake,imgs,height:state.current.best,over:ended.current,ghost,held:!!grabTo,fxs,best:bestRef.current??0})
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);el.removeEventListener('pointerdown',pd);el.removeEventListener('pointermove',pm);el.removeEventListener('pointerup',pu);el.removeEventListener('pointercancel',pc);Engine.clear(engine)}
 },[])
 useEffect(()=>{if(!call)return;const id=window.setTimeout(()=>setCall(null),1000);return()=>window.clearTimeout(id)},[call])
 const hold=(k:'left'|'right'|'down',on:boolean)=>{input.current[k]=on;if(on&&k!=='down')input.current.nudge=k==='left'?-1:1}
 const turn=()=>(frame.current as (HTMLDivElement&{__rotate?:()=>void})|null)?.__rotate?.()
 return <div className="break-game kono-teeter">
  <div className="blast-top"><span className="blast-best">{best!==null?'Best '+best:'KONO Teeter Tower'}</span><span className="teeter-hearts" aria-label={hearts+' hearts left'}>{Array.from({length:HEARTS},(_,i)=><i key={i} className={i<hearts?'is-on':undefined}>♥</i>)}</span></div>
  <div ref={frame} className={'teeter-frame'+(over?' is-over':'')} role="img" aria-label={'KONO Teeter Tower, '+height+' rows high'} data-height="0" data-blocks="0">
   <canvas ref={canvas} width={W*2} height={H*2} aria-hidden="true"/>
   <strong key={height} className="teeter-score" aria-live="polite">{height}</strong>
   <span className="teeter-next" aria-label={'Next block: '+next}><small>Next</small><NextShape shape={next}/></span>
   {call&&<span key={call.at} className="teeter-call" aria-hidden="true">{call.text}</span>}
   {!started&&!over&&<p className="teeter-hint"><b>Build it tall!</b><span>Drag a block where you want it · let go to drop · tap to turn</span></p>}
  </div>
  <div className="teeter-pad" role="group" aria-label="Controls">
   <button type="button" aria-label="Left" onPointerDown={()=>hold('left',true)} onPointerUp={()=>hold('left',false)} onPointerLeave={()=>hold('left',false)}>◀</button>
   <button type="button" aria-label="Turn" onClick={turn}>⟳</button>
   <button type="button" aria-label="Drop faster" onPointerDown={()=>hold('down',true)} onPointerUp={()=>hold('down',false)} onPointerLeave={()=>hold('down',false)}>▼</button>
   <button type="button" aria-label="Right" onPointerDown={()=>hold('right',true)} onPointerUp={()=>hold('right',false)} onPointerLeave={()=>hold('right',false)}>▶</button>
  </div>
  <p className="blast-help">Pick up the falling block and drag it anywhere above the tower, then let go to drop it (or steer with ◀ ▶ or the arrow keys). Tap (or ⟳, ↑) to turn, hold ▼ (or ↓, Space) to drop faster. The outline shows where it lands. Blocks that fall off the island cost a heart.</p>
 </div>
}

function NextShape({shape}:{shape:ShapeId}){
 const cells=SHAPES[shape],w=Math.max(...cells.map(c=>c[0]))+1,h=Math.max(...cells.map(c=>c[1]))+1
 return <svg viewBox={`0 0 ${w*10} ${h*10}`} width={w*10} height={h*10} aria-hidden="true">{cells.map(([x,y],i)=><rect key={i} x={x*10+.5} y={y*10+.5} width="9" height="9" rx="2.5" fill={COLORS[shape]}/>)}</svg>
}

type Bit={x:number;y:number;vx:number;vy:number;life:number;color:string;size:number;kind:'dust'|'confetti';spin?:number}
type Scene={placed:Piece[];active:Piece|null;cam:number;t:number;cheer:number;shake:number;imgs:Record<string,HTMLImageElement>;height:number;over:boolean;ghost:{dy:number;miss:boolean}|null;held:boolean;fxs:Bit[];best:number}
const ok=(i?:HTMLImageElement)=>!!i&&i.complete&&i.naturalWidth>0
const mix=(a:number[],b:number[],f:number)=>a.map((v,i)=>Math.round(v+(b[i]-v)*f))
const rgb=(c:number[],a=1)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`
// Each pastel's lighter top, deeper bottom and outline, worked out once.
const toneCache=new Map<string,{hi:string;lo:string;edge:string;base:string}>()
function tone(hex:string){
 let v=toneCache.get(hex);if(v)return v
 const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))
 v={base:hex,hi:rgb(mix(c,[255,255,255],.45)),lo:rgb(mix(c,[60,30,70],.18)),edge:rgb(mix(c,[60,30,70],.5))}
 toneCache.set(hex,v);return v
}
// The sky's colors from the ground up: day, sunset, dusk, then night.
const SKY:[number[],number[]][]=[[[132,202,255],[226,246,255]],[[255,160,150],[255,220,170]],[[120,96,180],[255,170,150]],[[22,28,70],[70,62,130]]]
function skyAt(k:number){const f=Math.min(2.999,k*3),i=Math.floor(f),r=f-i;return [mix(SKY[i][0],SKY[i+1][0],r),mix(SKY[i][1],SKY[i+1][1],r)]}

function paint(c:HTMLCanvasElement|null,s:Scene){
 const g=c?.getContext('2d');if(!c||!g)return
 g.setTransform(2,0,0,2,0,0)
 const k=Math.min(1,s.height/30),[top,bot]=skyAt(k),sky=g.createLinearGradient(0,0,0,H)
 sky.addColorStop(0,rgb(top));sky.addColorStop(1,rgb(bot));g.fillStyle=sky;g.fillRect(0,0,W,H)
 // Stars come out as the tower climbs (and twinkle).
 if(k>.5){for(let i=0;i<46;i++){const x=(i*97)%W,y=(((i*53)%(H*0.75))-s.cam*0.08+H)%(H*0.8);g.fillStyle=`rgba(255,255,255,${Math.min(1,(k-.5)*2)*(.5+.5*Math.sin(s.t*0.05+i))})`;g.fillRect(x,y,i%5?1.5:2.5,i%5?1.5:2.5)}}
 // The sun sinks and the moon rises.
 const sunY=90+k*260,moonY=360-k*290
 if(k<.75){const sg=g.createRadialGradient(330,sunY,6,330,sunY,70);sg.addColorStop(0,'rgba(255,250,220,.95)');sg.addColorStop(.3,'rgba(255,236,170,.6)');sg.addColorStop(1,'rgba(255,236,170,0)');g.fillStyle=sg;g.fillRect(250,sunY-80,160,160);g.fillStyle='#fff6d8';g.beginPath();g.arc(330,sunY,20,0,7);g.fill()}
 if(k>.45){g.globalAlpha=Math.min(1,(k-.45)*3);g.fillStyle='#fdf6e0';g.beginPath();g.arc(80,moonY,16,0,7);g.fill();g.fillStyle=rgb(top);g.beginPath();g.arc(88,moonY-5,14,0,7);g.fill();g.globalAlpha=1}
 // Far-off floating islands drift past slowly (depth), tinted by the air.
 for(const [x,y0,w] of [[60,180,70],[340,420,54],[200,40,44]] as const){
  const y=((y0-s.cam*0.25)%(H+200)+H+200)%(H+200)-100
  g.globalAlpha=.7
  g.fillStyle=rgb(mix([170,120,90],top,.55));g.beginPath();g.moveTo(x-w/2,y+2);g.quadraticCurveTo(x-w/3,y+w*.35,x-2,y+w*.5);g.quadraticCurveTo(x+w/3,y+w*.3,x+w/2,y+2);g.fill()
  g.fillStyle=rgb(mix([110,190,110],top,.45));g.beginPath();g.roundRect(x-w/2,y-3,w,7,4);g.fill()
  // a little tree and a tuft of cloud at its foot
  g.fillStyle=rgb(mix([90,160,100],top,.45));g.beginPath();g.arc(x-w/5,y-9,7,0,7);g.arc(x-w/5+6,y-12,6,0,7);g.fill()
  g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.ellipse(x+w/2-4,y+6,10,4,0,0,7);g.fill()
  g.globalAlpha=1
 }
 // Clouds drift by, slower than the tower moves.
 for(const [img,y0,sp,w] of [['cloud',90,0.15,120],['cloud2',230,0.1,96],['cloud',380,0.2,140]] as const){const i=s.imgs[img];if(!ok(i))continue;const x=((s.t*sp+y0*3)%(W+w*2))-w,y=((y0-s.cam*0.4)%(H+120)+H+120)%(H+120)-60;g.globalAlpha=k>.6?.35:.9;g.drawImage(i,x,y,w,w*i.naturalHeight/i.naturalWidth);g.globalAlpha=1}
 const shake=s.shake?Math.sin(s.t*2.4)*3*s.shake:0
 g.save();g.translate(shake,-s.cam)
 // A ruler up the left side: a tick each row, a number each five.
 const night=k>.6,ink=night?'rgba(255,255,255,':'rgba(40,60,110,'
 for(let n=1;n<=Math.max(10,s.height+12);n++){const y=ISLAND_TOP-n*T;if(y<s.cam-20||y>s.cam+H+20)continue
  g.fillStyle=ink+(n%5?'.18)':'.4)');g.fillRect(0,y-1,n%5?6:12,2)
  if(n%5===0){g.font='800 11px system-ui,sans-serif';g.fillStyle=ink+'.55)';g.fillText(String(n),15,y+4)}}
 // Your best so far: a gold line to beat.
 if(s.best>0){const y=ISLAND_TOP-s.best*T;g.strokeStyle='rgba(255,200,60,.85)';g.lineWidth=2;g.setLineDash([8,6]);g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();g.setLineDash([])
  const label='★ Best '+s.best;g.font='800 11px system-ui,sans-serif';const lw=g.measureText(label).width+14
  g.fillStyle='#ffc83c';g.beginPath();g.roundRect(W-lw-8,y-10,lw,20,10);g.fill();g.fillStyle='#5a3a10';g.fillText(label,W-lw+-1,y+4)}
 // The island: a grassy ledge, layered earth with roots and vines, a tree at each end.
 const ix=W/2-ISLAND_W/2-14,iw=ISLAND_W+28
 const earth=g.createLinearGradient(0,ISLAND_TOP,0,ISLAND_TOP+110);earth.addColorStop(0,'#c49460');earth.addColorStop(.5,'#94673e');earth.addColorStop(1,'#5e3e24')
 g.fillStyle=earth;g.beginPath();g.moveTo(ix,ISLAND_TOP+6);g.lineTo(ix+iw,ISLAND_TOP+6);g.quadraticCurveTo(ix+iw-6,ISLAND_TOP+40,ix+iw-34,ISLAND_TOP+64);g.quadraticCurveTo(W/2+20,ISLAND_TOP+132,W/2-4,ISLAND_TOP+128);g.quadraticCurveTo(ix+50,ISLAND_TOP+110,ix+30,ISLAND_TOP+62);g.quadraticCurveTo(ix+6,ISLAND_TOP+40,ix,ISLAND_TOP+6);g.fill()
 g.strokeStyle='rgba(255,230,190,.25)';g.lineWidth=3;for(const d of [26,48]){g.beginPath();g.moveTo(ix+14+d/3,ISLAND_TOP+d);g.quadraticCurveTo(W/2,ISLAND_TOP+d+10,ix+iw-14-d/3,ISLAND_TOP+d);g.stroke()}
 g.fillStyle='rgba(80,50,30,.5)';for(const [x,y,r] of [[ix+60,ISLAND_TOP+30,4],[ix+150,ISLAND_TOP+44,5],[ix+220,ISLAND_TOP+26,3],[W/2+10,ISLAND_TOP+84,4]]){g.beginPath();g.ellipse(x,y,r*1.4,r,0,0,7);g.fill()}
 g.strokeStyle='#5a3a22';g.lineWidth=2;for(let r=0;r<5;r++){const x=ix+50+r*38;g.beginPath();g.moveTo(x,ISLAND_TOP+70+(r===2?40:0));g.quadraticCurveTo(x+6+Math.sin(s.t*0.03+r)*2,ISLAND_TOP+92+r%2*8+(r===2?40:0),x-2,ISLAND_TOP+108+r*3+(r===2?30:0));g.stroke()}
 g.strokeStyle='#4f9a3c';g.lineWidth=2.5;for(const [x,len] of [[ix+8,40],[ix+iw-10,52],[ix+96,26]] as const){g.beginPath();g.moveTo(x,ISLAND_TOP+8);g.quadraticCurveTo(x+Math.sin(s.t*0.04+x)*4,ISLAND_TOP+8+len/2,x+2,ISLAND_TOP+8+len);g.stroke();g.fillStyle='#7fcf5e';g.beginPath();g.ellipse(x+2,ISLAND_TOP+8+len,3,4,0,0,7);g.fill()}
 if(ok(s.imgs.treeL))g.drawImage(s.imgs.treeL,ix-38,ISLAND_TOP-74,70,80)
 if(ok(s.imgs.treeR))g.drawImage(s.imgs.treeR,ix+iw-34,ISLAND_TOP-82,76,88)
 const grass=g.createLinearGradient(0,ISLAND_TOP-2,0,ISLAND_TOP+12);grass.addColorStop(0,'#86d65e');grass.addColorStop(1,'#4f9a3c')
 g.fillStyle=grass;g.beginPath();g.roundRect(ix,ISLAND_TOP-2,iw,14,7);g.fill()
 if(ok(s.imgs.grass))for(let x=ix;x<ix+iw-10;x+=40)g.drawImage(s.imgs.grass,x,ISLAND_TOP-14,40,16)
 // Little flowers along the edge.
 for(let f=0;f<7;f++){const x=ix+16+f*((iw-32)/6),c=['#ffb3c7','#fff3a0','#c9b6ff','#ffffff'][f%4];g.fillStyle=c;for(let p=0;p<5;p++){const a=p/5*6.28;g.beginPath();g.arc(x+Math.cos(a)*2.2,ISLAND_TOP+4+Math.sin(a)*2.2,1.6,0,7);g.fill()}g.fillStyle='#ffcf4a';g.beginPath();g.arc(x,ISLAND_TOP+4,1.3,0,7);g.fill()}
 // A soft shadow under the tower where it meets the grass.
 const foot=s.placed.filter(p=>p.body.bounds.max.y>ISLAND_TOP-6)
 if(foot.length){const a=Math.min(...foot.map(p=>p.body.bounds.min.x)),b=Math.max(...foot.map(p=>p.body.bounds.max.x));g.fillStyle='rgba(30,60,30,.22)';g.beginPath();g.ellipse((a+b)/2,ISLAND_TOP+2,(b-a)/2+6,4,0,0,7);g.fill()}
 // The blocks.
 for(const p of s.placed)block(g,p,s.t,p.body.speed>1.6||Math.abs(p.body.angularVelocity)>0.04?'worried':'happy')
 if(s.active){
  const b=s.active.body
  // Where it'll land: an outline below (red if it would miss the island), and a guide line down to it.
  if(s.ghost&&s.ghost.dy>T*0.6){
   g.strokeStyle=s.ghost.miss?'rgba(255,90,90,.6)':'rgba(255,255,255,.55)';g.setLineDash([4,6]);g.lineWidth=2;g.beginPath();g.moveTo(b.position.x,b.bounds.max.y+4);g.lineTo(b.position.x,b.bounds.max.y+s.ghost.dy-4);g.stroke();g.setLineDash([])
   if(!s.ghost.miss)ghostOf(g,s.active,s.ghost.dy)
   else{const y=Math.min(ISLAND_TOP+30,b.bounds.max.y+s.ghost.dy);g.strokeStyle='rgba(255,90,90,.85)';g.lineWidth=3;g.beginPath();g.moveTo(b.position.x-7,y-7);g.lineTo(b.position.x+7,y+7);g.moveTo(b.position.x+7,y-7);g.lineTo(b.position.x-7,y+7);g.stroke()}
  }
  // Held: a soft glow round it.
  if(s.held){g.save();g.shadowColor='rgba(255,255,255,.95)';g.shadowBlur=18;block(g,s.active,s.t,'look');g.restore()}
  block(g,s.active,s.t,'look')
  // KONO above on its cloud, lowering the block.
  const ky=b.bounds.min.y-58,kx=b.position.x
  g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(kx,b.bounds.min.y-6,10,3,0,0,7);g.fill()
  if(ok(s.imgs.cloud))g.drawImage(s.imgs.cloud,kx-46,ky+24+Math.sin(s.t*0.08)*1.5,92,30)
  const kimg=(s.cheer>0||s.held)&&ok(s.imgs.cheer)?s.imgs.cheer:s.imgs.kono
  if(ok(kimg))g.drawImage(kimg,kx-24,ky-Math.abs(Math.sin(s.t*0.12))*3-(s.cheer?Math.abs(Math.sin(s.t*0.4))*8:0),48,48)
 }
 // Dust puffs and confetti.
 for(const f of s.fxs){g.globalAlpha=Math.max(0,Math.min(1,f.life));g.fillStyle=f.color
  if(f.kind==='dust'){g.beginPath();g.arc(f.x,f.y,f.size*(1.6-f.life*.6),0,7);g.fill()}
  else{g.save();g.translate(f.x,f.y);g.rotate(f.spin??0);g.fillRect(-f.size/2,-f.size/4,f.size,f.size/2);g.restore()}}
 g.globalAlpha=1
 g.restore()
 // A soft vignette pulls the eye to the middle.
 const v=g.createRadialGradient(W/2,H*.55,H*.35,W/2,H*.55,H*.8);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,night?'rgba(5,5,30,.35)':'rgba(30,50,90,.18)');g.fillStyle=v;g.fillRect(0,0,W,H)
}
const tiles=(p:Piece)=>p.body.parts.length>1?p.body.parts.slice(1):p.body.parts
function ghostOf(g:CanvasRenderingContext2D,p:Piece,dy:number){
 const h=T/2-0.5
 g.fillStyle='rgba(255,255,255,.22)';g.strokeStyle='rgba(255,255,255,.75)';g.lineWidth=1.5;g.setLineDash([3,3])
 for(const part of tiles(p)){g.save();g.translate(part.position.x,part.position.y+dy);g.rotate(p.body.angle);g.beginPath();g.roundRect(-h,-h,h*2,h*2,6);g.fill();g.stroke();g.restore()}
 g.setLineDash([])
}
function block(g:CanvasRenderingContext2D,p:Piece,t:number,mood:'happy'|'worried'|'look'){
 const b=p.body,parts=tiles(p),c=tone(p.color),h=T/2-0.5
 // A drop shadow under the whole piece first, so tiles never shade each other.
 g.fillStyle='rgba(40,30,70,.18)'
 for(const part of parts){g.save();g.translate(part.position.x+1.5,part.position.y+2.5);g.rotate(b.angle);g.beginPath();g.roundRect(-h,-h,h*2,h*2,6);g.fill();g.restore()}
 parts.forEach((part,i)=>{
  g.save();g.translate(part.position.x,part.position.y);g.rotate(b.angle)
  // Candy-like: lighter at the top, deeper at the bottom, an outline in the piece's own darker shade.
  const fill=g.createLinearGradient(0,-h,0,h);fill.addColorStop(0,c.hi);fill.addColorStop(.45,c.base);fill.addColorStop(1,c.lo)
  g.fillStyle=fill;g.beginPath();g.roundRect(-h,-h,h*2,h*2,6);g.fill()
  g.strokeStyle=c.edge;g.lineWidth=1.4;g.stroke()
  // A gloss along the top and a sparkle in the corner.
  g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.roundRect(-h+3,-h+2.5,h*2-6,4,2);g.fill()
  g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(-h+5,-h+5,1.4,0,7);g.fill()
  if(i===p.face)face(g,mood,t)
  g.restore()
 })
}
function face(g:CanvasRenderingContext2D,mood:'happy'|'worried'|'look',t:number){
 const ink='#3a2630',blink=mood!=='worried'&&Math.floor(t/90)%7===0
 g.fillStyle='rgba(255,120,140,.45)';g.beginPath();g.arc(-7,3,2.2,0,7);g.arc(7,3,2.2,0,7);g.fill()
 if(blink){g.strokeStyle=ink;g.lineWidth=1.3;g.beginPath();g.moveTo(-6,-1);g.lineTo(-3,-1);g.moveTo(3,-1);g.lineTo(6,-1);g.stroke()}
 else{
  const ey=mood==='look'?0:-1
  g.fillStyle=ink;g.beginPath();g.arc(-4.5,ey,1.8,0,7);g.arc(4.5,ey,1.8,0,7);g.fill()
  g.fillStyle='#fff';g.beginPath();g.arc(-4,ey-.7,.6,0,7);g.arc(5,ey-.7,.6,0,7);g.fill()
 }
 g.strokeStyle=ink;g.lineWidth=1.3
 if(mood==='worried'){
  // Uh-oh: raised brows and a little "o".
  g.beginPath();g.moveTo(-7,-5);g.lineTo(-3,-6);g.moveTo(7,-5);g.lineTo(3,-6);g.stroke()
  g.fillStyle=ink;g.beginPath();g.ellipse(0,4,1.8,2.3,0,0,7);g.fill()
 }else{g.beginPath();g.arc(0,mood==='look'?3:2,2.6,0.2,Math.PI-0.2);g.stroke()}
}
