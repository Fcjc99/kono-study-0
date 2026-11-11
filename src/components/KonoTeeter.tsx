import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import Matter from 'matter-js'
import {gameSound} from '../konoSounds'
import {fx,startMusic,stopMusic} from '../arcadeAudio'
import {isLiteDevice} from '../store/deviceTier'
import type {GameHandle} from './GameScreen'
import {SHAPES,COLORS,SPECIALS,towerHeight,specialFor,seeded,puzzleLevel,isPerfect,lockLine,LOCK_EVERY,skinColor,skinTile,EVENTS,EVENT_BLOCKS,eventFor,type TowerEvent,type SkinId,type ShapeId,type Special,type TeeterMode} from '../store/teeter'
import './teeter.css'

const W=420,H=640 // canvas size at 1× (drawn at 2× for sharpness)
const T=26 // one block, in pixels
const ISLAND_TOP=560,ISLAND_W=10*T // the island's grassy top, where the tower stands
const HEARTS=3
const WIND_FROM=15,BIRD_FROM=20 // rows: the weather starts up here

type Piece={body:Matter.Body;shape:ShapeId;color:string;face:number;rest:number;kind:Special|null;locked:boolean;judged:boolean;drop:{x:number;angle:number};at:number;stuck:boolean;popped:boolean;skin:SkinId;n:number;landed:boolean;squash:number;size:number;slick:boolean}
export type TeeterResult={height:number;blocks:number;perfects:number;won:boolean;snapshot:string|null}

/** KONO Teeter Tower: KONO floats on a cloud and lowers pastel blocks onto a little floating island. Pick a
 * block up and drop it where you like, or steer and turn it on the way down; once it lands it's real physics:
 * blocks settle, lean and can tip over. A tumble off the island costs a heart (three in all).
 * - Every ten rows the lower part turns to mossy stone and can't topple any more.
 * - A block that settles exactly as it was let go is a Perfect (in a row, a streak).
 * - Now and then a special block: honey (sticks), stone (heavy), balloon (lands softly), ice (slippery).
 * - Higher up the weather starts: gusts of wind, then a bird that perches on the top block.
 * - KONO gasps when the tower sways, covers its eyes in a tumble and dances at milestones.
 * Modes: the classic climb, today's tower (the same blocks for everyone today) and puzzle levels (reach the
 * flag with the blocks you're given). Lite devices draw a simpler scene; reduced motion drops shake and confetti. */
export default function KonoTeeter({ref,best,sound,mode={kind:'classic'},skin='pastel',onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;mode?:TeeterMode;skin?:SkinId;onEnd:(r:TeeterResult)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),frame=useRef<HTMLDivElement>(null)
 const puzzle=mode.kind==='puzzle'?puzzleLevel(mode.level):null
 const [height,setHeight]=useState(0),[hearts,setHearts]=useState(HEARTS),[call,setCall]=useState<{text:string;at:number}|null>(null),[over,setOver]=useState(false)
 const [next,setNext]=useState<{shape:ShapeId;kind:Special|null}>({shape:'O',kind:null}),[started,setStarted]=useState(false),[left,setLeft]=useState(puzzle?.blocks??0),[say,setSay]=useState(''),[event,setEvent]=useState<{kind:TowerEvent;left:number}|null>(null)
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),bestRef=useRef(best),modeRef=useRef(mode),skinRef=useRef(skin)
 const state=useRef({best:0,blocks:0,hearts:HEARTS,perfects:0,won:false,snapshot:null as string|null})
 const input=useRef({left:false,right:false,nudge:0,queued:false})
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 // Its song: "Calm Sanctuary Variation" from Medal Cove's playlist (the music button turns it off).
 useEffect(()=>{startMusic('teeter',sound);return ()=>stopMusic()},[sound])
 const snap=()=>{try{state.current.snapshot=canvas.current?.toDataURL('image/jpeg',0.82)??null}catch{state.current.snapshot=null}}
 const result=():TeeterResult=>({height:state.current.best,blocks:state.current.blocks,perfects:state.current.perfects,won:state.current.won,snapshot:state.current.snapshot})
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;snap();onEndRef.current(result())}}),[])

 useEffect(()=>{
  const {Engine,Bodies,Body,Composite,Constraint,Events,Sleeping}=Matter
  const look=skinRef.current
  const md=modeRef.current,goal=md.kind==='puzzle'?puzzleLevel(md.level):null
  // The end: a moment to see it, then the tower's picture and the results.
  const finish=(wait=1300)=>{if(ended.current)return;ended.current=true;window.setTimeout(()=>{try{state.current.snapshot=canvas.current?.toDataURL('image/jpeg',0.82)??null}catch{state.current.snapshot=null}onEndRef.current({height:state.current.best,blocks:state.current.blocks,perfects:state.current.perfects,won:state.current.won,snapshot:state.current.snapshot})},wait)}
  const rand=md.kind==='daily'?seeded('teeter '+md.seed):Math.random
  const lite=isLiteDevice()||document.documentElement.dataset.lite==='true'
  const calm=typeof matchMedia==='function'&&(matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced')
  // Blocks that have stood still for a good while fall asleep (so a tall tower doesn't creep), and wake when
  // anything touches them.
  const engine=Engine.create({gravity:{x:0,y:1,scale:0.0012},positionIterations:12,velocityIterations:10,enableSleeping:true})
  const wake=(b:Matter.Body)=>{if(b.isSleeping)Sleeping.set(b,false)}
  const push=(b:Matter.Body,at:Matter.Vector,f:Matter.Vector)=>{wake(b);Body.applyForce(b,at,f)}
  const ground=Bodies.rectangle(W/2,ISLAND_TOP+20,ISLAND_W,40,{isStatic:true,friction:1,label:'island'})
  Composite.add(engine.world,ground)
  const placed:Piece[]=[]
  const imgs:Record<string,HTMLImageElement>={}
  for(const [k,src] of [['kono','/garden/kono/happy.webp'],['cheer','/garden/kono/excited.webp'],['gasp','/garden/kono/question.webp'],['eyes','/garden/kono/sleep.webp'],['cloud','/garden/strip/cloud-a.webp'],['cloud2','/garden/strip/cloud-b.webp'],['treeL','/garden/strip/tree-round-afternoon.webp'],['treeR','/garden/strip/tree-cherry-afternoon.webp'],['grass','/garden/strip/grass-edge.webp']] as const){const i=new Image();i.src=src;imgs[k]=i}
  const bag:ShapeId[]=[]
  const draw=():ShapeId=>{if(!bag.length){const all=Object.keys(SHAPES) as ShapeId[];for(let i=all.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[all[i],all[j]]=[all[j],all[i]]}bag.push(...all)}return bag.pop()!}
  let dealt=0
  const deal=()=>({shape:draw(),kind:specialFor(rand,dealt++)})
  let upcoming=deal()
  let active:Piece|null=null,spin=0,settleUntil=0,cheer=0,milestone=0,lockedTo=0,shake=0,graceUntil=0,streak=0,sway=0,shaky=false,lastHeartAt=-1e9,lastPaint=0,shakyFor=0
  let budget=goal?.blocks??Infinity,outAt=0
  const cam={y:0,v:0}
  const announce=(text:string,spoken=text)=>{setCall({text,at:performance.now()});setSay(spoken)}
  const fxs:Bit[]=[]
  const puff=(x:number,y:number,n:number,color='#ffffff')=>{if(calm)n=Math.min(n,3);for(let k=0;k<n;k++)fxs.push({x:x+(Math.random()-.5)*T*2,y,vx:(Math.random()-.5)*1.6,vy:-Math.random()*1.2-.2,life:1,color,size:2+Math.random()*3,kind:'dust'})}
  const sparkle=(x:number,y:number)=>{for(let k=0;k<(calm?3:10);k++){const a=Math.random()*6.28,v=1+Math.random()*1.5;fxs.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-0.5,life:1,color:k%2?'#fff6b0':'#ffffff',size:2+Math.random()*2,kind:'spark'})}}
  const confetti=(y:number)=>{if(calm)return;const cs=Object.values(COLORS);for(let k=0;k<36;k++)fxs.push({x:Math.random()*W,y:y-40-Math.random()*60,vx:(Math.random()-.5)*2,vy:Math.random()*-2,life:1.6,color:cs[k%cs.length],size:4+Math.random()*3,kind:'confetti',spin:Math.random()*6})}
  const make=(shape:ShapeId,kind:Special|null,x:number,y:number,size=1,slick=false):Piece=>{
   const S=T*size
   const cells=SHAPES[shape],cx=cells.reduce((a,c)=>a+c[0],0)/cells.length,cy=cells.reduce((a,c)=>a+c[1],0)/cells.length
   const parts=cells.map(([cxl,cyl])=>Bodies.rectangle(x+(cxl-cx)*S,y+(cyl-cy)*S,S,S,{chamfer:{radius:4*size}}))
   const stuff=kind==='stone'?{density:0.0048,restitution:0.02}:kind==='ice'?{friction:0.02,frictionStatic:0.04}:kind==='balloon'?{density:0.0009,frictionAir:0.06}:kind==='jelly'?{restitution:0.55,friction:0.35,frictionStatic:0.5,density:0.0011}:slick?{friction:0.05,frictionStatic:0.08}:{}
   // Soft, rounded and a touch bouncy: blocks land with a bump, slide on a slope and lean, like real toys.
   // Made as a real body first, then held still while KONO carries it: setStatic keeps its mass for the drop.
   const body=Body.create({parts,friction:0.6,frictionStatic:0.85,frictionAir:0.012,restitution:0.12,density:0.0016,slop:0.03,...stuff})
   Body.setStatic(body,true);body.sleepThreshold=600
   return {body,shape,kind,color:kind?SPECIALS[kind].color:skinColor(look,shape),face:Math.floor(Math.random()*cells.length),rest:0,locked:false,judged:false,drop:{x,angle:0},at:0,stuck:false,popped:false,skin:look,n:dealt,landed:false,squash:0,size,slick}
  }
  const loose=()=>placed.filter(p=>!p.locked)
  const topY=()=>placed.reduce((m,p)=>Math.min(m,p.body.bounds.min.y),ISLAND_TOP)
  // The tower's top for the view and for KONO's height: only blocks that have landed (one still in the air
  // would make the view jump up and back).
  const towerTop=()=>placed.reduce((m,p)=>p.landed&&p.body.position.y<ISLAND_TOP+40?Math.min(m,p.body.bounds.min.y):m,ISLAND_TOP)
  // KONO carries the next block above the tower: move it anywhere, turn it, then let go and it drops for
  // real. If you wait too long (eight seconds), KONO lets go by itself.
  let holdMs=8000,holdX=W/2,heldAt=0,swing=0,lastX=W/2
  // Tower events: now and then the next three blocks are big, slippery, or KONO's in a hurry.
  let ev:{kind:TowerEvent;left:number}|null=null,lastEventAt=-99
  const hangY=(b:Matter.Body)=>Math.min(ISLAND_TOP-6*T,towerTop()-3.5*T)-(b.bounds.max.y-b.position.y)
  const spawn=()=>{
   if(budget<=0)return
   const {shape,kind}=upcoming;upcoming=deal();setNext(upcoming)
   if(!ev){const e=eventFor(rand,state.current.blocks,lastEventAt);if(e){ev={kind:e,left:EVENT_BLOCKS};lastEventAt=state.current.blocks;announce(EVENTS[e].emoji+' '+EVENTS[e].name+'!',EVENTS[e].line);fx('charge',soundRef.current)}}
   const now=ev
   setEvent(now?{kind:now.kind,left:now.left}:null)
   holdMs=now?.kind==='hurry'?3000:8000
   active=make(shape,kind,holdX,ISLAND_TOP-8*T,now?.kind==='big'?1.5:1,now?.kind==='slippery')
   if(now){now.left--;if(now.left<=0)ev=null}
   Body.setPosition(active.body,{x:holdX,y:hangY(active.body)-T})
   Composite.add(engine.world,active.body);heldAt=performance.now()
   if(kind&&!(now&&now.left===EVENT_BLOCKS-1))announce(SPECIALS[kind].emoji+' '+SPECIALS[kind].name+'!')
  }
  const release=()=>{
   if(!active)return
   const p=active;active=null
   // Let go: it falls with gravity (and keeps a little of the sideways swing).
   Body.setStatic(p.body,false);Body.setVelocity(p.body,{x:Math.max(-1.5,Math.min(1.5,swing*0.25)),y:p.kind==='balloon'?0.2:0})
   p.drop={x:p.body.position.x,angle:p.body.angle};p.at=performance.now()
   placed.push(p);state.current.blocks++;setStarted(true)
   if(goal){budget--;setLeft(budget)}
   fx('swap',soundRef.current)
   settleUntil=performance.now()+900
   if(frame.current){frame.current.dataset.blocks=String(state.current.blocks);frame.current.dataset.lastX=String(Math.round(p.body.position.x))}
  }
  // Honey: sticks fast to the first block (or the island) it touches.
  Events.on(engine,'collisionStart',e=>{
   for(const pair of e.pairs){
    const a=pair.bodyA.parent,b=pair.bodyB.parent
    // A dropped block's first bump: a thump, a puff of dust and a squash; each one a note higher.
    for(const body of [a,b]){const p=placed.find(q=>q.body===body);if(p&&!p.landed){p.landed=true;p.squash=p.kind==='jelly'?1:Math.min(1,0.4+p.body.speed/6);puff(p.body.position.x,p.body.bounds.max.y,6)
     fx('land',soundRef.current);fx('note',soundRef.current,state.current.blocks);try{navigator.vibrate?.(10)}catch{/* no vibration */}}}
    for(const [mine,other] of [[a,b],[b,a]] as const){
     const p=placed.find(q=>q.body===mine)
     if(!p||p.kind!=='honey'||p.stuck||other===active?.body)continue
     p.stuck=true
     const c=mine.position,o=other.position,side={x:c.x+Math.cos(mine.angle)*T,y:c.y+Math.sin(mine.angle)*T}
     Composite.add(engine.world,[
      Constraint.create({bodyA:mine,bodyB:other,pointA:{x:0,y:0},pointB:{x:c.x-o.x,y:c.y-o.y},length:0,stiffness:0.7}),
      Constraint.create({bodyA:mine,bodyB:other,pointA:{x:side.x-c.x,y:side.y-c.y},pointB:{x:side.x-o.x,y:side.y-o.y},length:0,stiffness:0.5}),
     ])
     fx('squish',soundRef.current);puff(c.x,c.y+T/2,5,'#ffd56b')
    }
   }
  })
  // Turn a quarter (the picture swings round to catch up).
  const rotate=()=>{if(!active)return;Body.rotate(active.body,Math.PI/2);spin-=Math.PI/2;fx('tick',soundRef.current)}
  const drop=()=>{if(active)release()}
  const key=(e:KeyboardEvent,down:boolean)=>{
   if((e.target as HTMLElement)?.closest?.('input,textarea'))return
   const k=e.code,i=input.current
   if(k==='ArrowLeft'||k==='KeyA'){if(down&&!e.repeat)i.nudge=-1;i.left=down;e.preventDefault()}
   else if(k==='ArrowRight'||k==='KeyD'){if(down&&!e.repeat)i.nudge=1;i.right=down;e.preventDefault()}
   // ▼ before a block is in KONO's paws waits for it (while the key is still down).
   else if(k==='ArrowDown'||k==='KeyS'||k==='Space'){if(down&&!e.repeat){if(active)drop();else i.queued=true}if(!down)i.queued=false;e.preventDefault()}
   else if((k==='ArrowUp'||k==='KeyW'||k==='KeyX')&&down&&!e.repeat){rotate();e.preventDefault()}
  }
  const kd=(e:KeyboardEvent)=>key(e,true),ku=(e:KeyboardEvent)=>key(e,false)
  window.addEventListener('keydown',kd);window.addEventListener('keyup',ku)
  const back=()=>{if(!document.hidden)clearSprites()}
  document.addEventListener('visibilitychange',back)
  const pad=frame.current as (HTMLDivElement&{__rotate?:()=>void;__drop?:()=>void})|null
  if(pad){pad.__rotate=rotate;pad.__drop=drop}
  // A finger: drag anywhere to carry the block (it follows your finger, wherever you touched), lift to drop
  // it; a quick tap turns it.
  const el=frame.current!
  let ptr:{id:number;sx:number;hx:number;t:number;moved:boolean}|null=null
  const toX=(e:PointerEvent)=>{const r=el.getBoundingClientRect();return (e.clientX-r.left)/r.width*W}
  const pd=(e:PointerEvent)=>{
   if(e.button>0||ended.current)return
   e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch{/* not capturable */}
   ptr={id:e.pointerId,sx:toX(e),hx:holdX,t:performance.now(),moved:false}
  }
  const pm=(e:PointerEvent)=>{
   if(!ptr||e.pointerId!==ptr.id)return
   const x=toX(e);if(Math.abs(x-ptr.sx)>8)ptr.moved=true
   if(ptr.moved)holdX=Math.max(24,Math.min(W-24,ptr.hx+(x-ptr.sx)))
  }
  const pu=(e:PointerEvent)=>{
   if(!ptr||e.pointerId!==ptr.id)return
   const d=ptr;ptr=null
   if(!d.moved&&performance.now()-d.t<300)rotate()
   // (A lift right as a new block appears is from the last drag, not a drop of this one.)
   else if(d.moved&&d.t>heldAt)drop()
  }
  const pc=()=>{ptr=null}
  el.addEventListener('pointerdown',pd);el.addEventListener('pointermove',pm);el.addEventListener('pointerup',pu);el.addEventListener('pointercancel',pc)
  // The weather, once the tower is high enough (not in puzzles).
  const weather=md.kind!=='puzzle'
  const wind={next:0,dir:1,warned:false}
  const bird:{state:'off'|'in'|'sit'|'out';x:number;y:number;from:number;at:number;on:Piece|null;next:number}={state:'off',x:0,y:0,from:0,at:0,on:null,next:0}
  let raf=0,last=performance.now(),t=0,acc=0
  const loop=(now:number)=>{
   const dt=Math.min(50,now-last);last=now;t+=dt/16.67
   const i=input.current,m=dt/16.67
   spin=Math.abs(spin)<0.01?0:spin*(1-Math.min(1,0.35*m))
   let timer:number|null=null
   if(active&&!ended.current){
    // In KONO's paws: ◀ ▶ (or the arrow keys) carry it smoothly; it glides after your finger and swings a little.
    if(i.nudge){holdX+=i.nudge*T/2;i.nudge=0}
    if(i.left||i.right)holdX+=(i.right?1:-1)*4*m
    const b=active.body,half=(b.bounds.max.x-b.bounds.min.x)/2
    holdX=Math.max(half+4,Math.min(W-half-4,holdX))
    const nx=b.position.x+(holdX-b.position.x)*Math.min(1,0.3*m),ny=b.position.y+(hangY(b)-b.position.y)*Math.min(1,0.12*m)
    Body.setPosition(b,{x:nx,y:ny})
    swing+=((nx-lastX)/Math.max(m,0.01)-swing)*0.3;lastX=nx
    // KONO lets go by itself after a while (the ring round KONO shows the last three seconds).
    const left=holdMs-(now-heldAt);if(left<3000)timer=Math.max(0,left/Math.min(3000,holdMs))
    if(left<=0)release()
   }else{swing*=0.9;if(!ended.current&&now>settleUntil){spawn();if(active&&i.queued){i.queued=false;release()}}}
   for(const p of placed)if(p.squash>0)p.squash=Math.max(0,p.squash-0.08*m)
   // A balloon holds its block up as it comes down, then pops once it's resting.
   for(const p of placed)if(p.kind==='balloon'&&!p.popped){
    if(now-p.at<1800&&p.rest<10)push(p.body,p.body.position,{x:0,y:-engine.gravity.y*engine.gravity.scale*p.body.mass*0.8})
    else{p.popped=true;fx('squish',soundRef.current);puff(p.body.position.x,p.body.bounds.min.y-14,8,'#ff9fb4')}
   }
   // Wind: a gust every so often (with a warning first), pushing the loose blocks one way.
   let gust=0
   if(weather&&state.current.best>=WIND_FROM&&!ended.current){
    if(!wind.next)wind.next=now+4000
    if(!wind.warned&&now>wind.next-1200){wind.warned=true;wind.dir=Math.random()<.5?-1:1;announce(wind.dir>0?'Wind →':'← Wind','A gust of wind from the '+(wind.dir>0?'left':'right')+'.')}
    if(now>wind.next){const k=(now-wind.next)/2200;if(k<1){gust=Math.sin(k*Math.PI)*wind.dir;for(const p of loose())push(p.body,p.body.position,{x:gust*p.body.mass*0.00009,y:0})
     if(!calm&&Math.random()<0.3*m)fxs.push({x:wind.dir>0?-10:W+10,y:cam.y+Math.random()*H,vx:wind.dir*(3+Math.random()*2),vy:(Math.random()-.5)*.6,life:2.4,color:['#7fcf5e','#ffb38a','#f59ac4'][Math.floor(Math.random()*3)],size:4,kind:'leaf',spin:Math.random()*6})}
     else{wind.next=now+9000+Math.random()*7000;wind.warned=false}}
   }
   // A bird: flies in, perches on the top block (its weight to one side), then flies off.
   if(weather&&state.current.best>=BIRD_FROM&&!ended.current){
    if(!bird.next)bird.next=now+6000
    const top=loose().filter(p=>p.rest>=24).sort((a,b)=>a.body.bounds.min.y-b.body.bounds.min.y)[0]
    if(bird.state==='off'&&now>bird.next&&top){bird.state='in';bird.on=top;bird.at=now;bird.from=Math.random()<.5?-30:W+30;bird.x=bird.from;bird.y=cam.y+40;announce('🐦 A bird!','A bird landed on your tower.')}
    if(bird.state!=='off'&&bird.on){
     const b=bird.on.body,perch={x:b.bounds.max.x-T*0.6,y:b.bounds.min.y-7}
     if(bird.state==='in'){const k=Math.min(1,(now-bird.at)/1300);bird.x=bird.from+(perch.x-bird.from)*k;bird.y=cam.y+40+(perch.y-cam.y-40)*k*k;if(k>=1){bird.state='sit';bird.at=now}}
     else if(bird.state==='sit'){bird.x=perch.x;bird.y=perch.y;push(b,{x:perch.x,y:perch.y+7},{x:0,y:b.mass*0.00035});if(now-bird.at>3200||b.speed>2){bird.state='out';bird.at=now}}
     else{const k=(now-bird.at)/1300;bird.x+=(bird.from<0?-4:4)*m;bird.y-=3*m;if(k>1){bird.state='off';bird.on=null;bird.next=now+14000+Math.random()*10000}}
    }
   }
   // Fixed small steps (120 a second): smooth on 60 Hz and 120 Hz screens alike.
   acc+=dt;while(acc>=1000/120){Engine.update(engine,1000/120);acc-=1000/120}
   // Fell off: the block is gone. One tumble costs one heart, however many blocks go over with it.
   for(let k=placed.length-1;k>=0;k--){const p=placed[k];if(p.body.position.y>ISLAND_TOP+260){Composite.remove(engine.world,p.body);placed.splice(k,1);for(const q of placed)wake(q.body)
    if(bird.on===p){bird.state='out';bird.at=now}
    if(now<graceUntil)continue
    graceUntil=now+2500;lastHeartAt=now;streak=0;state.current.hearts--;setHearts(state.current.hearts);shake=calm?0:1;fx('thud',soundRef.current)
    announce(state.current.hearts>0?'Oops!':'Tumble!',state.current.hearts>0?'A block fell off. '+state.current.hearts+(state.current.hearts===1?' heart':' hearts')+' left.':'Tumble! No hearts left.')
    if(state.current.hearts<=0&&!ended.current){setOver(true);gameSound('lose',soundRef.current);finish()}}}
   // A block counts once it has been still for about half a second (not while it pauses mid-topple).
   for(const p of placed){
    p.rest=p.locked||p.body.speed<0.4&&Math.abs(p.body.angularVelocity)<0.015?p.rest+1:0
    // Settled for the first time: was it a Perfect (it stayed just as you let it go)?
    if(p.rest>=24&&!p.judged&&!p.locked){p.judged=true
     if(isPerfect(p.drop,{x:p.body.position.x,angle:p.body.angle})){streak++;state.current.perfects++;sparkle(p.body.position.x,p.body.bounds.min.y);fx('match',soundRef.current,Math.min(10,streak-1));announce(streak>1?'Perfect ×'+streak+'!':'Perfect!',streak>1?'Perfect, '+streak+' in a row.':'Perfect.')}
     else streak=0}
   }
   const h=towerHeight(placed.map(p=>({top:p.body.bounds.min.y,speed:p.rest>=24?0:1})),ISLAND_TOP,T)
   if(h>state.current.best){state.current.best=h;setHeight(h);if(frame.current)frame.current.dataset.height=String(h)
    if(goal&&h>=goal.goal&&!state.current.won){state.current.won=true;cheer=1.5;confetti(topY());fx('fanfare',soundRef.current);announce('Flag reached! 🚩','You reached the flag at row '+goal.goal+'. Level complete!');finish(1800)}
    else if(Math.floor(h/5)>milestone){milestone=Math.floor(h/5);cheer=1;confetti(topY());fx('star',soundRef.current,Math.min(8,milestone));announce(h+' high!','Row '+h+'.')}
    else setSay('Row '+h+'.')
    // Every ten rows: the lower part turns to stone, safe from tumbling.
    const line=lockLine(h,ISLAND_TOP,T)
    if(line!==null&&Math.floor(h/LOCK_EVERY)>lockedTo){lockedTo=Math.floor(h/LOCK_EVERY);let n=0
     for(const p of placed)if(!p.locked&&p.rest>=24&&p.body.bounds.min.y>=line){p.locked=true;Body.setStatic(p.body,true);n++;puff(p.body.position.x,p.body.position.y,3,'#cfe8b0')}
     if(n){fx('make',soundRef.current);window.setTimeout(()=>announce('Stone base! 🪨','The lower rows turned to stone. They can’t fall now.'),700)}}
   }
   // Puzzle: out of blocks and the tower has settled short of the flag.
   if(goal&&!state.current.won&&!ended.current&&budget<=0&&!active){
    if(!outAt)outAt=now+2600
    else if(now>outAt){announce('Out of blocks','Out of blocks. The flag was at row '+goal.goal+'.');setOver(true);gameSound('lose',soundRef.current);finish(1200)}
   }
   // How much the tower sways (the settled, loose blocks), for the meter and KONO's face.
   let raw=0
   for(const p of placed)if(p.judged&&!p.locked)raw=Math.max(raw,p.body.speed/2.5,Math.abs(p.body.angularVelocity)/0.05)
   sway+=(Math.min(1,raw)-sway)*0.12*m
   if(sway>0.7)shakyFor+=dt;else if(sway<0.3)shakyFor=0
   if(shakyFor>400)shaky=true
   if(shaky&&sway<0.1){shaky=false;if(now-lastHeartAt>2500&&!ended.current){fx('phew',soundRef.current);announce('Phew!')}}
   // Dust, sparkles, leaves and confetti.
   for(let k=fxs.length-1;k>=0;k--){const f=fxs[k];f.x+=f.vx*m;f.y+=f.vy*m;f.vy+=(f.kind==='confetti'?0.05:f.kind==='leaf'?0.004:0.02)*m;if(f.kind!=='leaf')f.vx*=0.98;f.life-=(f.kind==='confetti'?0.012:f.kind==='leaf'?0.01:0.03)*m;if(f.spin!==undefined)f.spin+=0.15*m;if(f.life<=0)fxs.splice(k,1)}
   // The view climbs with the tower (a soft spring): the top of the tower sits low, the new block high above it.
   const want=Math.min(0,towerTop()-H*0.64)
   cam.v+=((want-cam.y)*0.02-cam.v*0.18)*m;cam.y+=cam.v*m
   cheer=Math.max(0,cheer-0.012*m);shake=Math.max(0,shake-0.04*m)
   // Older devices draw at 30 frames a second (the physics keeps its own steady pace).
   if(!lite||now-lastPaint>=32){lastPaint=now
    const kono=cheer>0?'dance':now<graceUntil?'eyes':sway>0.45?'gasp':'happy'
    paint(canvas.current,{spin,swing,timer,hold:{x:active?active.body.position.x:holdX,y:active?active.body.bounds.min.y:Math.min(ISLAND_TOP-6*T,towerTop()-3.5*T)-T*2},placed,active,cam:cam.y,t,shake,imgs,height:state.current.best,fxs,best:md.kind==='classic'?bestRef.current??0:0,goal:goal?.goal??0,lite,calm,sway,kono,gust,bird:bird.state==='off'?null:{x:bird.x,y:bird.y,sitting:bird.state==='sit'}})}
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);document.removeEventListener('visibilitychange',back);el.removeEventListener('pointerdown',pd);el.removeEventListener('pointermove',pm);el.removeEventListener('pointerup',pu);el.removeEventListener('pointercancel',pc);Events.off(engine,'collisionStart');Engine.clear(engine)}
 },[])
 useEffect(()=>{if(!call)return;const id=window.setTimeout(()=>setCall(null),1000);return()=>window.clearTimeout(id)},[call])
 const hold=(k:'left'|'right',on:boolean)=>{const i=input.current;if(on&&!i[k])i.nudge=k==='left'?-1:1;i[k]=on}
 const turn=()=>(frame.current as (HTMLDivElement&{__rotate?:()=>void})|null)?.__rotate?.()
 const label=mode.kind==='daily'?'Today’s tower':mode.kind==='puzzle'?'Level '+mode.level:best!==null?'Best '+best:'KONO Teeter Tower'
 return <div className="break-game kono-teeter">
  <div className="blast-top"><span className="blast-best">{label}</span>{event&&<span className="teeter-event" role="status">{EVENTS[event.kind].emoji} {EVENTS[event.kind].name} <b>×{event.left}</b></span>}{puzzle&&<span className="teeter-goal">🚩 Row {puzzle.goal} · <b>{left}</b> block{left===1?'':'s'} left</span>}<span className="teeter-hearts" aria-label={hearts+' hearts left'}>{Array.from({length:HEARTS},(_,i)=><i key={i} className={i<hearts?'is-on':undefined}>♥</i>)}</span></div>
  <div ref={frame} className={'teeter-frame'+(over?' is-over':'')} role="img" aria-label={'KONO Teeter Tower, '+height+' rows high'} data-height="0" data-blocks="0">
   <canvas ref={canvas} width={W*2} height={H*2} aria-hidden="true"/>
   <strong key={height} className="teeter-score" aria-hidden="true">{height}</strong>
   <span className="teeter-next" aria-label={'Next block: '+(next.kind?SPECIALS[next.kind].name:next.shape)}><small>Next</small><NextShape shape={next.shape} kind={next.kind}/></span>
   {call&&<span key={call.at} className="teeter-call" aria-hidden="true">{call.text}</span>}
   {!started&&!over&&<p className="teeter-hint"><b>{puzzle?'Reach the flag at row '+puzzle.goal+'!':'Build it tall!'}</b><span>Slide your finger to carry the block · lift to drop it · tap to turn</span></p>}
  </div>
  <p className="teeter-say" aria-live="polite">{say}</p>
  <div className="teeter-pad" role="group" aria-label="Controls">
   <button type="button" aria-label="Left" onPointerDown={()=>hold('left',true)} onPointerUp={()=>hold('left',false)} onPointerLeave={()=>hold('left',false)}>◀</button>
   <button type="button" aria-label="Turn" onClick={turn}>⟳</button>
   <button type="button" aria-label="Drop" onClick={()=>(frame.current as (HTMLDivElement&{__drop?:()=>void})|null)?.__drop?.()}>▼</button>
   <button type="button" aria-label="Right" onPointerDown={()=>hold('right',true)} onPointerUp={()=>hold('right',false)} onPointerLeave={()=>hold('right',false)}>▶</button>
  </div>
  <p className="blast-help">KONO holds each block above the tower. Slide your finger anywhere to carry it and lift to drop it (or ◀ ▶ to carry, ▼ to drop; the arrow keys and Space work too). Tap (or ⟳, ↑) to turn it. It drops for real, so it can bounce, slide and tip; KONO lets go by itself after eight seconds. Every ten rows the bottom turns to stone. Specials: 🍯 sticks, 🪨 heavy, 🎈 lands softly, 🧊 slippery, 🍮 bouncy jelly. Now and then the next three blocks are big 🔍, slippery 💦, or KONO’s in a hurry ⏱️. Blocks that fall off the island cost a heart.</p>
 </div>
}

function NextShape({shape,kind}:{shape:ShapeId;kind:Special|null}){
 const cells=SHAPES[shape],w=Math.max(...cells.map(c=>c[0]))+1,h=Math.max(...cells.map(c=>c[1]))+1
 return <span className="teeter-next-shape"><svg viewBox={`0 0 ${w*10} ${h*10}`} width={w*10} height={h*10} aria-hidden="true">{cells.map(([x,y],i)=><rect key={i} x={x*10+.5} y={y*10+.5} width="9" height="9" rx="2.5" fill={kind?SPECIALS[kind].color:COLORS[shape]}/>)}</svg>{kind&&<i aria-hidden="true">{SPECIALS[kind].emoji}</i>}</span>
}

type Bit={x:number;y:number;vx:number;vy:number;life:number;color:string;size:number;kind:'dust'|'confetti'|'spark'|'leaf';spin?:number}
type Scene={spin:number;swing:number;timer:number|null;hold:{x:number;y:number};placed:Piece[];active:Piece|null;cam:number;t:number;shake:number;imgs:Record<string,HTMLImageElement>;height:number;fxs:Bit[];best:number;goal:number;lite:boolean;calm:boolean;sway:number;kono:'happy'|'cheer'|'dance'|'gasp'|'eyes';gust:number;bird:{x:number;y:number;sitting:boolean}|null}
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
 const k=Math.min(1,s.height/30),[top,bot]=skyAt(k)
 if(s.lite){g.fillStyle=rgb(mix(top,bot,.5));g.fillRect(0,0,W,H)}
 else{const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,rgb(top));sky.addColorStop(1,rgb(bot));g.fillStyle=sky;g.fillRect(0,0,W,H)}
 // Stars come out as the tower climbs (and twinkle).
 if(k>.5){for(let i=0;i<(s.lite?20:46);i++){const x=(i*97)%W,y=(((i*53)%(H*0.75))-s.cam*0.08+H)%(H*0.8);g.fillStyle=`rgba(255,255,255,${Math.min(1,(k-.5)*2)*(s.calm?.8:.5+.5*Math.sin(s.t*0.05+i))})`;g.fillRect(x,y,i%5?1.5:2.5,i%5?1.5:2.5)}}
 // The sun sinks and the moon rises.
 const sunY=90+k*260,moonY=360-k*290
 if(k<.75){if(!s.lite){const sg=g.createRadialGradient(330,sunY,6,330,sunY,70);sg.addColorStop(0,'rgba(255,250,220,.95)');sg.addColorStop(.3,'rgba(255,236,170,.6)');sg.addColorStop(1,'rgba(255,236,170,0)');g.fillStyle=sg;g.fillRect(250,sunY-80,160,160)}g.fillStyle='#fff6d8';g.beginPath();g.arc(330,sunY,20,0,7);g.fill()}
 if(k>.45){g.globalAlpha=Math.min(1,(k-.45)*3);g.fillStyle='#fdf6e0';g.beginPath();g.arc(80,moonY,16,0,7);g.fill();g.fillStyle=rgb(top);g.beginPath();g.arc(88,moonY-5,14,0,7);g.fill();g.globalAlpha=1}
 // Far-off floating islands drift past slowly (depth), tinted by the air.
 if(!s.lite)for(const [x,y0,w] of [[60,180,70],[340,420,54],[200,40,44]] as const){
  const y=((y0-s.cam*0.25)%(H+200)+H+200)%(H+200)-100
  g.globalAlpha=.7
  g.fillStyle=rgb(mix([170,120,90],top,.55));g.beginPath();g.moveTo(x-w/2,y+2);g.quadraticCurveTo(x-w/3,y+w*.35,x-2,y+w*.5);g.quadraticCurveTo(x+w/3,y+w*.3,x+w/2,y+2);g.fill()
  g.fillStyle=rgb(mix([110,190,110],top,.45));g.beginPath();g.roundRect(x-w/2,y-3,w,7,4);g.fill()
  g.fillStyle=rgb(mix([90,160,100],top,.45));g.beginPath();g.arc(x-w/5,y-9,7,0,7);g.arc(x-w/5+6,y-12,6,0,7);g.fill()
  g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.ellipse(x+w/2-4,y+6,10,4,0,0,7);g.fill()
  g.globalAlpha=1
 }
 // Clouds drift by, slower than the tower moves (and pushed along in a gust).
 for(const [img,y0,sp,w] of [['cloud',90,0.15,120],['cloud2',230,0.1,96],['cloud',380,0.2,140]] as const){const i=s.imgs[img];if(!ok(i))continue;const x=((s.t*sp+y0*3)%(W+w*2))-w+s.gust*20,y=((y0-s.cam*0.4)%(H+120)+H+120)%(H+120)-60;g.globalAlpha=k>.6?.35:.9;g.drawImage(i,x,y,w,w*i.naturalHeight/i.naturalWidth);g.globalAlpha=1}
 const shake=s.shake&&!s.calm?Math.sin(s.t*2.4)*3*s.shake:0
 g.save();g.translate(shake,-s.cam)
 // A ruler up the left side: a tick each row, a number each five.
 const night=k>.6,ink=night?'rgba(255,255,255,':'rgba(40,60,110,'
 for(let n=1;n<=Math.max(10,s.height+12,s.goal+2);n++){const y=ISLAND_TOP-n*T;if(y<s.cam-20||y>s.cam+H+20)continue
  g.fillStyle=ink+(n%5?'.18)':'.4)');g.fillRect(0,y-1,n%5?6:12,2)
  if(n%5===0&&y-s.cam>44){g.font='800 11px system-ui,sans-serif';g.fillStyle=ink+'.55)';g.fillText(String(n),15,y+4)}}
 // Your best so far: a gold line to beat. In a puzzle, the flag to reach.
 if(s.best>0)marker(g,ISLAND_TOP-s.best*T,'★ Best '+s.best,'#ffc83c','#5a3a10','rgba(255,200,60,.85)')
 if(s.goal>0){const y=ISLAND_TOP-s.goal*T,fx0=W/2+ISLAND_W/2+4;marker(g,y,'🚩 Row '+s.goal,'#7fd1ae','#14432f','rgba(60,170,120,.9)')
  g.strokeStyle='#5a3a22';g.lineWidth=2;g.beginPath();g.moveTo(fx0,y);g.lineTo(fx0,y-30);g.stroke()
  g.fillStyle='#ff6b81';g.beginPath();g.moveTo(fx0+1,y-30);g.lineTo(fx0+19+(s.calm?0:Math.sin(s.t*0.15)*2),y-24);g.lineTo(fx0+1,y-18);g.fill()}
 // The island: a grassy ledge, layered earth with roots and vines, a tree at each end.
 const ix=W/2-ISLAND_W/2-14,iw=ISLAND_W+28
 if(s.lite)g.fillStyle='#9a6c42'
 else{const earth=g.createLinearGradient(0,ISLAND_TOP,0,ISLAND_TOP+110);earth.addColorStop(0,'#c49460');earth.addColorStop(.5,'#94673e');earth.addColorStop(1,'#5e3e24');g.fillStyle=earth}
 g.beginPath();g.moveTo(ix,ISLAND_TOP+6);g.lineTo(ix+iw,ISLAND_TOP+6);g.quadraticCurveTo(ix+iw-6,ISLAND_TOP+40,ix+iw-34,ISLAND_TOP+64);g.quadraticCurveTo(W/2+20,ISLAND_TOP+132,W/2-4,ISLAND_TOP+128);g.quadraticCurveTo(ix+50,ISLAND_TOP+110,ix+30,ISLAND_TOP+62);g.quadraticCurveTo(ix+6,ISLAND_TOP+40,ix,ISLAND_TOP+6);g.fill()
 if(!s.lite){
  g.strokeStyle='rgba(255,230,190,.25)';g.lineWidth=3;for(const d of [26,48]){g.beginPath();g.moveTo(ix+14+d/3,ISLAND_TOP+d);g.quadraticCurveTo(W/2,ISLAND_TOP+d+10,ix+iw-14-d/3,ISLAND_TOP+d);g.stroke()}
  g.fillStyle='rgba(80,50,30,.5)';for(const [x,y,r] of [[ix+60,ISLAND_TOP+30,4],[ix+150,ISLAND_TOP+44,5],[ix+220,ISLAND_TOP+26,3],[W/2+10,ISLAND_TOP+84,4]]){g.beginPath();g.ellipse(x,y,r*1.4,r,0,0,7);g.fill()}
  g.strokeStyle='#5a3a22';g.lineWidth=2;for(let r=0;r<5;r++){const x=ix+50+r*38;g.beginPath();g.moveTo(x,ISLAND_TOP+70+(r===2?40:0));g.quadraticCurveTo(x+6+Math.sin(s.t*0.03+r)*2,ISLAND_TOP+92+r%2*8+(r===2?40:0),x-2,ISLAND_TOP+108+r*3+(r===2?30:0));g.stroke()}
  g.strokeStyle='#4f9a3c';g.lineWidth=2.5;for(const [x,len] of [[ix+8,40],[ix+iw-10,52],[ix+96,26]] as const){const sw=s.gust*5;g.beginPath();g.moveTo(x,ISLAND_TOP+8);g.quadraticCurveTo(x+Math.sin(s.t*0.04+x)*4+sw,ISLAND_TOP+8+len/2,x+2+sw,ISLAND_TOP+8+len);g.stroke();g.fillStyle='#7fcf5e';g.beginPath();g.ellipse(x+2+sw,ISLAND_TOP+8+len,3,4,0,0,7);g.fill()}
 }
 if(ok(s.imgs.treeL))g.drawImage(s.imgs.treeL,ix-38,ISLAND_TOP-74,70,80)
 if(ok(s.imgs.treeR))g.drawImage(s.imgs.treeR,ix+iw-34,ISLAND_TOP-82,76,88)
 if(s.lite)g.fillStyle='#6cbf4f'
 else{const grass=g.createLinearGradient(0,ISLAND_TOP-2,0,ISLAND_TOP+12);grass.addColorStop(0,'#86d65e');grass.addColorStop(1,'#4f9a3c');g.fillStyle=grass}
 g.beginPath();g.roundRect(ix,ISLAND_TOP-2,iw,14,7);g.fill()
 if(ok(s.imgs.grass))for(let x=ix;x<ix+iw-10;x+=40)g.drawImage(s.imgs.grass,x,ISLAND_TOP-14,40,16)
 // Little flowers along the edge.
 if(!s.lite)for(let f=0;f<7;f++){const x=ix+16+f*((iw-32)/6),c=['#ffb3c7','#fff3a0','#c9b6ff','#ffffff'][f%4];g.fillStyle=c;for(let p=0;p<5;p++){const a=p/5*6.28;g.beginPath();g.arc(x+Math.cos(a)*2.2,ISLAND_TOP+4+Math.sin(a)*2.2,1.6,0,7);g.fill()}g.fillStyle='#ffcf4a';g.beginPath();g.arc(x,ISLAND_TOP+4,1.3,0,7);g.fill()}
 // A soft shadow under the tower where it meets the grass.
 const foot=s.placed.filter(p=>p.body.bounds.max.y>ISLAND_TOP-6)
 if(foot.length){const a=Math.min(...foot.map(p=>p.body.bounds.min.x)),b=Math.max(...foot.map(p=>p.body.bounds.max.x));g.fillStyle='rgba(30,60,30,.22)';g.beginPath();g.ellipse((a+b)/2,ISLAND_TOP+2,(b-a)/2+6,4,0,0,7);g.fill()}
 // The blocks (stone first, then the loose ones over them).
 for(const p of s.placed)if(p.locked)block(g,p,s.t,'sleep',s.lite)
 for(const p of s.placed)if(!p.locked)block(g,p,s.t,p.body.speed>1.6||Math.abs(p.body.angularVelocity)>0.04?'worried':'happy',s.lite)
 // A bird perched on (or flying to) the top block.
 if(s.bird)birdie(g,s.bird.x,s.bird.y,s.t,s.bird.sitting)
 // The block in KONO's paws: a faint line straight down to aim by, and it swings a little as it's carried.
 const tilt=s.calm?0:Math.max(-0.25,Math.min(0.25,-s.swing*0.04))
 if(s.active){
  const b=s.active.body
  g.strokeStyle='rgba(255,255,255,.5)';g.setLineDash([4,7]);g.lineWidth=2;g.beginPath();g.moveTo(b.position.x,b.bounds.max.y+6);g.lineTo(b.position.x,Math.min(ISLAND_TOP,b.bounds.max.y+90));g.stroke();g.setLineDash([])
  // A turn is instant; the picture swings round to catch up.
  g.save();g.translate(s.hold.x,s.hold.y-34);g.rotate(tilt);g.translate(-s.hold.x,-(s.hold.y-34))
  if(s.spin){g.translate(b.position.x,b.position.y);g.rotate(s.spin);g.translate(-b.position.x,-b.position.y)}
  block(g,s.active,s.t,'look',s.lite)
  g.restore()
 }
 // KONO above on its cloud, holding the block (or waiting for the next): it gasps when the tower sways,
 // shuts its eyes in a tumble and dances at a milestone. A ring counts down the last three seconds of holding.
 {
  const kx=s.hold.x,ky=s.hold.y-58
  if(ok(s.imgs.cloud))g.drawImage(s.imgs.cloud,kx-46,ky+24+Math.sin(s.t*0.08)*1.5,92,30)
  const want=s.kono==='dance'||s.kono==='cheer'?s.imgs.cheer:s.kono==='gasp'?s.imgs.gasp:s.kono==='eyes'?s.imgs.eyes:s.imgs.kono
  const pic=ok(want)?want:s.imgs.kono
  if(ok(pic)){
   const dance=s.kono==='dance'&&!s.calm,hop=dance?Math.abs(Math.sin(s.t*0.4))*10:Math.abs(Math.sin(s.t*0.12))*3,lean=dance?Math.sin(s.t*0.4)*0.22:s.kono==='gasp'&&!s.calm?Math.sin(s.t*0.9)*0.06:tilt*0.6
   g.save();g.translate(kx,ky+24-hop);g.rotate(lean);g.drawImage(pic,-24,-48,48,48);g.restore()
   if(s.kono==='gasp'){g.fillStyle='#8fd0ff';g.beginPath();g.moveTo(kx+20,ky-6);g.quadraticCurveTo(kx+26,ky+2,kx+20,ky+4);g.quadraticCurveTo(kx+14,ky+2,kx+20,ky-6);g.fill()}
   if(dance){g.font='14px system-ui';g.fillStyle='#fff';g.fillText('♪',kx-34,ky+4-Math.sin(s.t*0.2)*4);g.fillText('♫',kx+26,ky-2+Math.sin(s.t*0.2)*4)}
  }
  if(s.timer!==null&&s.active){g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=4;g.beginPath();g.arc(kx,ky,30,0,7);g.stroke()
   g.strokeStyle=s.timer<0.34?'#ff6b6b':'#ffd36b';g.beginPath();g.arc(kx,ky,30,-Math.PI/2,-Math.PI/2+Math.PI*2*s.timer);g.stroke()}
 }
 // Dust, sparkles, leaves and confetti.
 for(const f of s.fxs){g.globalAlpha=Math.max(0,Math.min(1,f.life));g.fillStyle=f.color
  if(f.kind==='dust'){g.beginPath();g.arc(f.x,f.y,f.size*(1.6-f.life*.6),0,7);g.fill()}
  else if(f.kind==='spark'){g.save();g.translate(f.x,f.y);g.rotate(s.t*0.1);g.fillRect(-f.size,-.6,f.size*2,1.2);g.fillRect(-.6,-f.size,1.2,f.size*2);g.restore()}
  else if(f.kind==='leaf'){g.save();g.translate(f.x,f.y);g.rotate(f.spin??0);g.beginPath();g.ellipse(0,0,f.size,f.size/2,0,0,7);g.fill();g.restore()}
  else{g.save();g.translate(f.x,f.y);g.rotate(f.spin??0);g.fillRect(-f.size/2,-f.size/4,f.size,f.size/2);g.restore()}}
 g.globalAlpha=1
 g.restore()
 // The sway meter (top left): green when steady, amber, then red when it's about to go.
 if(s.placed.length>2){
  const x=12,y=14,w=64,v=Math.min(1,s.sway)
  g.fillStyle='rgba(255,255,255,.8)';g.beginPath();g.roundRect(x,y,w+40,20,10);g.fill()
  g.font='800 9px system-ui,sans-serif';g.fillStyle='#5a4a60';g.fillText('SWAY',x+8,y+13.5)
  g.fillStyle='rgba(90,74,96,.15)';g.beginPath();g.roundRect(x+38,y+6,w-2,8,4);g.fill()
  g.fillStyle=v<.35?'#6cc28a':v<.65?'#ffb84d':'#ff6b6b';g.beginPath();g.roundRect(x+38,y+6,Math.max(6,(w-2)*v),8,4);g.fill()
 }
 // A soft vignette pulls the eye to the middle.
 if(!s.lite){const v=g.createRadialGradient(W/2,H*.55,H*.35,W/2,H*.55,H*.8);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,night?'rgba(5,5,30,.35)':'rgba(30,50,90,.18)');g.fillStyle=v;g.fillRect(0,0,W,H)}
}
function marker(g:CanvasRenderingContext2D,y:number,label:string,fill:string,ink:string,line:string){
 g.strokeStyle=line;g.lineWidth=2;g.setLineDash([8,6]);g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();g.setLineDash([])
 g.font='800 11px system-ui,sans-serif';const lw=g.measureText(label).width+14
 g.fillStyle=fill;g.beginPath();g.roundRect(W-lw-8,y-10,lw,20,10);g.fill();g.fillStyle=ink;g.fillText(label,W-lw-1,y+4)
}
function birdie(g:CanvasRenderingContext2D,x:number,y:number,t:number,sitting:boolean){
 const flap=sitting?0:Math.sin(t*0.8)*6
 g.fillStyle='#7cb7e8';g.beginPath();g.ellipse(x,y,8,6.5,0,0,7);g.fill()
 g.fillStyle='#ffffff';g.beginPath();g.ellipse(x+1,y+2,5,3.5,0,0,7);g.fill()
 g.fillStyle='#5a9bd4';g.beginPath();g.moveTo(x-2,y-1);g.quadraticCurveTo(x-10,y-6-flap,x-13,y-2-flap);g.quadraticCurveTo(x-8,y+2,x-2,y+1);g.fill()
 g.fillStyle='#3a2630';g.beginPath();g.arc(x+4,y-2,1.3,0,7);g.fill()
 g.fillStyle='#ffb84d';g.beginPath();g.moveTo(x+7,y-1);g.lineTo(x+11,y);g.lineTo(x+7,y+1.5);g.fill()
 if(sitting){g.strokeStyle='#ffb84d';g.lineWidth=1.2;g.beginPath();g.moveTo(x-2,y+5);g.lineTo(x-2,y+7);g.moveTo(x+2,y+5);g.lineTo(x+2,y+7);g.stroke()}
}
const tiles=(p:Piece)=>p.body.parts.length>1?p.body.parts.slice(1):p.body.parts
type Mood='happy'|'worried'|'look'|'sleep'
// Each look of a tile (color, skin, stone, special, lite) is drawn once into a little picture and reused:
// far cheaper than shading every tile again every frame.
// On phones the browser can wipe a canvas's picture (low graphics memory, or the app sent to the background),
// which left blocks as pale ghosts: so the pictures live in ordinary memory (willReadFrequently), one the
// browser reports lost is thrown away, and they're all drawn afresh when KONO comes back to the screen.
const SPR=T+6,sprites=new Map<string,HTMLCanvasElement>()
const clearSprites=()=>sprites.clear()
function tileSprite(color:string,skin:SkinId,stone:boolean,kind:Special|null,k:number,lite:boolean){
 const key=color+skin+stone+kind+k+lite
 let c=sprites.get(key);if(c)return c
 c=document.createElement('canvas');c.width=c.height=SPR*2
 c.addEventListener('contextlost',()=>sprites.delete(key))
 const g=c.getContext('2d',{willReadFrequently:true})!,h=T/2-0.5,tc=tone(color)
 g.setTransform(2,0,0,2,SPR,SPR)
 // Candy-like: lighter at the top, deeper at the bottom, an outline in the piece's own darker shade.
 if(lite)g.fillStyle=tc.base
 else{const fill=g.createLinearGradient(0,-h,0,h);fill.addColorStop(0,tc.hi);fill.addColorStop(.45,tc.base);fill.addColorStop(1,tc.lo);g.fillStyle=fill}
 if(skin==='jelly'||kind==='jelly')g.globalAlpha=.8
 g.beginPath();g.roundRect(-h,-h,h*2,h*2,stone?4:skin==='jelly'?9:skin==='cookie'?8:6);g.fill()
 g.globalAlpha=1
 g.strokeStyle=tc.edge;g.lineWidth=1.4;g.stroke()
 skinDecor(g,skin,h,k)
 if(stone){
  // Turned to stone: cracks and moss.
  g.strokeStyle='rgba(70,60,50,.35)';g.lineWidth=1;g.beginPath();g.moveTo(-h+4,-2);g.lineTo(-2,1);g.lineTo(3,-3);g.moveTo(2,5);g.lineTo(h-4,7);g.stroke()
  g.fillStyle='#7cbf5a';g.beginPath();g.ellipse(-h+6,-h+2,6,2.5,0,0,7);g.ellipse(h-5,-h+2,4,2,0,0,7);g.fill()
 }else{
  g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.roundRect(-h+3,-h+2.5,h*2-6,4,2);g.fill()
  g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(-h+5,-h+5,1.4,0,7);g.fill()
  if(kind==='honey'){g.fillStyle='#e8a21c';g.beginPath();g.ellipse(-4,h-1,3,4,0,0,7);g.ellipse(5,h,2,3,0,0,7);g.fill()}
  if(kind==='jelly'){g.fillStyle='rgba(255,255,255,.7)';g.beginPath();g.ellipse(-h+7,-h+6,4,2.2,-0.6,0,7);g.ellipse(h-6,h-7,2,1.2,0,0,7);g.fill()}
  if(kind==='ice'){g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=1.2;g.beginPath();g.moveTo(h-8,-h+5);g.lineTo(h-4,-h+9);g.moveTo(h-10,-h+9);g.lineTo(h-7,-h+12);g.stroke()}
  if(kind==='stone'){g.fillStyle='rgba(70,60,80,.25)';for(const [x,y] of [[-6,6],[6,-2],[-2,-6]])g.fillRect(x,y,2,2)}
 }
 sprites.set(key,c);return c
}
function block(g:CanvasRenderingContext2D,p:Piece,t:number,mood:Mood,lite:boolean){
 const b=p.body,parts=tiles(p),stone=p.locked,h=T/2-0.5
 const skin:SkinId=p.kind||stone?'pastel':p.skin,base=stone?'#b4ad9f':p.color
 // A drop shadow under the whole piece first, so tiles never shade each other.
 if(!lite){g.fillStyle='rgba(40,30,70,.18)'
  for(const part of parts){g.save();g.translate(part.position.x+1.5,part.position.y+2.5);g.rotate(b.angle);g.scale(p.size,p.size);g.beginPath();g.roundRect(-h,-h,h*2,h*2,6);g.fill();g.restore()}}
 // Squash on landing: wider and flatter for a moment, about the block's middle.
 // Jelly squashes twice as much, and never quite stops wobbling.
 const sq=(p.squash>0?Math.sin(p.squash*Math.PI)*(p.kind==='jelly'?0.28:0.14)*p.squash:0)+(p.kind==='jelly'&&!p.locked?Math.sin(t*0.45+p.n)*0.035:0)
 if(sq){g.save();g.translate(b.position.x,b.bounds.max.y);g.scale(1+sq,1-sq);g.translate(-b.position.x,-b.bounds.max.y)}
 parts.forEach((part,i)=>{
  g.save();g.translate(part.position.x,part.position.y);g.rotate(b.angle);if(p.size!==1)g.scale(p.size,p.size)
  g.drawImage(tileSprite(skin==='rainbow'?skinTile(skin,base,i,p.n):base,skin,stone,stone?null:p.kind,skin==='cookie'||skin==='starry'||skin==='garden'?(i+p.n)%3:0,lite),-SPR/2,-SPR/2,SPR,SPR)
  // Slippery: a wet shine across each tile.
  if(p.slick&&!stone){g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=1.6;g.beginPath();g.moveTo(-h+5,h-6);g.lineTo(h-6,-h+5);g.stroke()}
  if(i===p.face)face(g,mood,t)
  g.restore()
 })
 if(sq)g.restore()
 // A balloon tied on until it pops.
 if(p.kind==='balloon'&&!p.popped){
  const x=b.position.x,y=b.bounds.min.y
  g.strokeStyle='rgba(90,70,90,.6)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+4,y-10,x,y-20);g.stroke()
  g.fillStyle='#ff7b98';g.beginPath();g.ellipse(x,y-30,9,11,0,0,7);g.fill()
  g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.ellipse(x-3,y-34,2.5,3.5,0,0,7);g.fill()
 }
}
// Each skin's little touch on a tile: jelly's big shine, cookie sprinkles, a garden sprout, starry sparkles.
function skinDecor(g:CanvasRenderingContext2D,skin:SkinId,h:number,k:number){
 if(skin==='jelly'){g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.ellipse(-h+7,-h+7,4,2.5,-0.6,0,7);g.fill()}
 else if(skin==='cookie'){const cs=['#ff8fb1','#7cc3ef','#ffe27a','#7fd1ae'];for(let j=0;j<3;j++){g.fillStyle=cs[(k+j)%4];g.save();g.translate([-7,6,-2][j],[6,4,-7][j]);g.rotate(j+k);g.fillRect(-2,-.7,4,1.4);g.restore()}}
 else if(skin==='garden'&&k%3===0){g.fillStyle='#4f9a3c';g.beginPath();g.ellipse(5,-h-1,3,1.6,-0.5,0,7);g.ellipse(9,-h-2,3,1.6,0.5,0,7);g.fill()}
 else if(skin==='starry'){g.fillStyle='rgba(255,255,230,.9)';for(const [x,y] of [[-7,-6],[7,6],[6,-8]])g.fillRect(x+(k%3)-1,y,1.4,1.4)}
}
function face(g:CanvasRenderingContext2D,mood:Mood,t:number){
 const ink='#3a2630',blink=mood==='sleep'||mood!=='worried'&&Math.floor(t/90)%7===0
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
