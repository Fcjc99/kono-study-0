import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import Matter from 'matter-js'
import {gameSound} from '../konoSounds'
import {fx,startMusic,stopMusic} from '../arcadeAudio'
import {isLiteDevice} from '../store/deviceTier'
import type {GameHandle} from './GameScreen'
import {SHAPES,COLORS,SPECIALS,towerHeight,specialFor,seeded,puzzleLevel,isPerfect,lockLine,LOCK_EVERY,skinColor,skinTile,EVENTS,EVENT_BLOCKS,eventFor,RACE_GOAL,rivalStep,SPELLS,spellFor,CATS,COATS,catSwing,catBag,type CatKind,type Spell,type TowerEvent,type TeeterControl,type SkinId,type ShapeId,type Special,type TeeterMode} from '../store/teeter'
import './teeter.css'

const W=420,H=640 // canvas size at 1× (drawn at 2× for sharpness)
const T=26 // one block, in pixels
const ISLAND_TOP=560,ISLAND_W=5*T // the island's grassy top, where the tower stands: five blocks wide, so towers grow tall and thin
const HEARTS=3
const WIND_FROM=15,BIRD_FROM=20 // rows: the weather starts up here

type Piece={body:Matter.Body;shape:ShapeId;color:string;face:number;rest:number;kind:Special|null;locked:boolean;judged:boolean;drop:{x:number;angle:number};at:number;stuck:boolean;popped:boolean;skin:SkinId;n:number;landed:boolean;squash:number;size:number;slick:boolean;vine:boolean;cat:Cat|null}
type Cat={kind:CatKind;coat:number}
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
export default function KonoTeeter({ref,best,sound,mode={kind:'classic'},skin='pastel',control='fall',onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;mode?:TeeterMode;skin?:SkinId;control?:TeeterControl;onEnd:(r:TeeterResult)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),frame=useRef<HTMLDivElement>(null)
 const puzzle=mode.kind==='puzzle'?puzzleLevel(mode.level):null
 const [height,setHeight]=useState(0),[hearts,setHearts]=useState(HEARTS),[call,setCall]=useState<{text:string;at:number}|null>(null),[over,setOver]=useState(false)
 const [next,setNext]=useState<{shape:ShapeId;kind:Special|null;cat:Cat|null}>({shape:'O',kind:null,cat:null}),[started,setStarted]=useState(false),[left,setLeft]=useState(puzzle?.blocks??0),[say,setSay]=useState(''),[event,setEvent]=useState<{kind:TowerEvent;left:number}|null>(null),[spell,setSpell]=useState<Spell|null>(null),[rival,setRival]=useState(0)
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),bestRef=useRef(best),modeRef=useRef(mode),skinRef=useRef(skin),controlRef=useRef(control)
 const state=useRef({best:0,blocks:0,hearts:HEARTS,perfects:0,won:false,snapshot:null as string|null})
 const input=useRef({left:false,right:false,nudge:0,queued:false,down:false,repeatAt:0})
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 // Its song: "Calm Sanctuary Variation" from Medal Cove's playlist (the music button turns it off).
 useEffect(()=>{startMusic('teeter',sound);return ()=>stopMusic()},[sound])
 const snap=()=>{try{state.current.snapshot=canvas.current?.toDataURL('image/jpeg',0.82)??null}catch{state.current.snapshot=null}}
 const result=():TeeterResult=>({height:state.current.best,blocks:state.current.blocks,perfects:state.current.perfects,won:state.current.won,snapshot:state.current.snapshot})
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;snap();onEndRef.current(result())}}),[])

 useEffect(()=>{
  const {Engine,Bodies,Body,Composite,Constraint,Events,Sleeping,Query}=Matter
  const md0=modeRef.current,cats=md0.kind==='cats'
  const look=skinRef.current,falling=controlRef.current==='fall'&&!cats
  const md=md0,goal=md.kind==='puzzle'?puzzleLevel(md.level):null
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
  // Cat drop: cats instead of blocks (no specials), every shape once before any repeats.
  const nextCat=catBag(rand)
  const deal=():{shape:ShapeId;kind:Special|null;cat:Cat|null}=>cats?(dealt++,{shape:'O',kind:null,cat:nextCat()}):{shape:draw(),kind:specialFor(rand,dealt++),cat:null}
  let upcoming=deal()
  let active:Piece|null=null,spin=0,settleUntil=0,cheer=0,milestone=0,lockedTo=0,shake=0,graceUntil=0,streak=0,sway=0,shaky=false,lastHeartAt=-1e9,lastPaint=0,shakyFor=0
  let budget=goal?.blocks??Infinity,outAt=0
  // Race: Rival KONO builds on the islet alongside; first to the finish line wins. Spells: earned every six rows.
  const race=md.kind==='race'
  let rivalH=0,heldSpell:Spell|null=null,smallLeft=0
  const cam={y:0,v:0}
  const announce=(text:string,spoken=text)=>{setCall({text,at:performance.now()});setSay(spoken)}
  const fxs:Bit[]=[]
  const puff=(x:number,y:number,n:number,color='#ffffff')=>{if(calm)n=Math.min(n,3);for(let k=0;k<n;k++)fxs.push({x:x+(Math.random()-.5)*T*2,y,vx:(Math.random()-.5)*1.6,vy:-Math.random()*1.2-.2,life:1,color,size:2+Math.random()*3,kind:'dust'})}
  const sparkle=(x:number,y:number)=>{for(let k=0;k<(calm?3:10);k++){const a=Math.random()*6.28,v=1+Math.random()*1.5;fxs.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-0.5,life:1,color:k%2?'#fff6b0':'#ffffff',size:2+Math.random()*2,kind:'spark'})}}
  const confetti=(y:number)=>{if(calm)return;const cs=Object.values(COLORS);for(let k=0;k<36;k++)fxs.push({x:Math.random()*W,y:y-40-Math.random()*60,vx:(Math.random()-.5)*2,vy:Math.random()*-2,life:1.6,color:cs[k%cs.length],size:4+Math.random()*3,kind:'confetti',spin:Math.random()*6})}
  const make=(shape:ShapeId,kind:Special|null,x:number,y:number,size=1,slick=false,cat:Cat|null=null):Piece=>{
   const S=T*size
   if(cat){
    // A cat: one soft rounded body (a little rounder than a block, so they snuggle and wobble), grippy fur.
    const c=CATS[cat.kind],w=c.w*S,h=c.h*S
    const body=Bodies.rectangle(x,y,w,h,{chamfer:{radius:Math.min(w,h)*c.round},friction:1,frictionStatic:2,frictionAir:0.012,restitution:0,density:0.0016,slop:0.02})
    Body.setInertia(body,body.inertia*8);Body.setStatic(body,true);body.sleepThreshold=180
    return {body,shape,kind:null,color:COATS[cat.coat].base,face:0,rest:0,locked:false,judged:false,drop:{x,angle:0},at:0,stuck:false,popped:false,skin:look,n:dealt,landed:false,squash:0,size,slick,vine:false,cat}
   }
   const cells=SHAPES[shape],cx=cells.reduce((a,c)=>a+c[0],0)/cells.length,cy=cells.reduce((a,c)=>a+c[1],0)/cells.length
   // Square for the physics (rounded corners left a notch under a block's foot, so even a standing L rocked
   // and fell over); they're still drawn rounded.
   const parts=cells.map(([cxl,cyl])=>Bodies.rectangle(x+(cxl-cx)*S,y+(cyl-cy)*S,S,S))
   const stuff=kind==='stone'?{density:0.0048,restitution:0.02}:kind==='ice'?{friction:0.02,frictionStatic:0.04}:kind==='balloon'?{density:0.0009,frictionAir:0.06}:kind==='jelly'?{restitution:0.55,friction:0.35,frictionStatic:0.5,density:0.0011}:slick?{friction:0.05,frictionStatic:0.08}:{}
   // Grippy (stacking feels sure) with only a little bounce: a tower falls from bad balance, a heavy side or an
   // overhang, not from every landing. Slippery and jelly blocks are the exceptions.
   // Made as a real body first, then held still while KONO carries it: setStatic keeps its mass for the drop.
   const body=Body.create({parts,friction:1,frictionStatic:2,frictionAir:0.012,restitution:0,density:0.0016,slop:0.02,...stuff})
   // Settles (sleeps) after about three quarters of a second still, so a standing tower doesn't creep; and it's
   // eight times as hard to spin as a real block, so it tips slowly rather than snapping over (and settles
   // into a lean on an uneven top instead of rocking off it, like Tricky Towers' heavy bricks).
   if(kind!=='jelly')Body.setInertia(body,body.inertia*8)
   Body.setStatic(body,true);body.sleepThreshold=180
   return {body,shape,kind,color:kind?SPECIALS[kind].color:skinColor(look,shape),face:Math.floor(Math.random()*cells.length),rest:0,locked:false,judged:false,drop:{x,angle:0},at:0,stuck:false,popped:false,skin:look,n:dealt,landed:false,squash:0,size,slick,vine:false,cat:null}
  }
  const loose=()=>placed.filter(p=>!p.locked)
  const topY=()=>placed.reduce((m,p)=>Math.min(m,p.body.bounds.min.y),ISLAND_TOP)
  // The tower's top for the view and for KONO's height: only blocks that have landed (one still in the air
  // would make the view jump up and back).
  const towerTop=()=>placed.reduce((m,p)=>p.landed&&p.body.position.y<ISLAND_TOP+40?Math.min(m,p.body.bounds.min.y):m,ISLAND_TOP)
  // KONO carries the next block above the tower: move it anywhere, turn it, then let go and it drops for
  // real. If you wait too long (eight seconds), KONO lets go by itself.
  let holdMs=8000,holdX=W/2,heldAt=0,swing=0,lastX=W/2,fallX=W/2,catDir=1
  // Tower events: now and then the next three blocks are big, slippery, or KONO's in a hurry.
  let ev:{kind:TowerEvent;left:number}|null=null,lastEventAt=-99
  const hangY=(b:Matter.Body)=>Math.min(ISLAND_TOP-6*T,towerTop()-2.6*T)-(b.bounds.max.y-b.position.y)
  const spawn=()=>{
   if(budget<=0)return
   const {shape,kind,cat}=upcoming;upcoming=deal();setNext(upcoming)
   if(!ev&&!cats){const e=eventFor(rand,state.current.blocks,lastEventAt);if(e){ev={kind:e,left:EVENT_BLOCKS};lastEventAt=state.current.blocks;announce(EVENTS[e].emoji+' '+EVENTS[e].name+'!',EVENTS[e].line);fx('charge',soundRef.current)}}
   const now=ev
   setEvent(now?{kind:now.kind,left:now.left}:null)
   holdMs=cats?Infinity:now?.kind==='hurry'?3000:8000
   const small=smallLeft>0&&now?.kind!=='big';if(small)smallLeft--
   active=make(shape,kind,holdX,ISLAND_TOP-8*T,now?.kind==='big'?1.5:small?0.7:1,now?.kind==='slippery',cat)
   if(now){now.left--;if(now.left<=0)ev=null}
   // Falling (Tricky Towers style): it starts high above the tower, in the middle, and comes down steadily.
   // Held (Cat Stack style): KONO carries it just above the tower.
   if(falling){fallX=W/2;Body.setPosition(active.body,{x:fallX,y:Math.min(ISLAND_TOP-10*T,towerTop()-8*T)})}
   else Body.setPosition(active.body,{x:holdX,y:hangY(active.body)-T})
   Composite.add(engine.world,active.body);heldAt=performance.now()
   if(kind&&!(now&&now.left===EVENT_BLOCKS-1))announce(SPECIALS[kind].emoji+' '+SPECIALS[kind].name+'!')
  }
  const release=()=>{
   if(!active)return
   const p=active;active=null
   // Let go: it falls with gravity (and keeps a little of the sideways swing).
   // Wake it first: held still in KONO's paws for a few seconds, the physics puts it to sleep, and a sleeping
   // body let go would hang in the air (a cat waited on, then dropped, floated there).
   Body.setStatic(p.body,false);wake(p.body);Body.setVelocity(p.body,falling?{x:0,y:0.5}:{x:Math.max(-1.5,Math.min(1.5,swing*0.25)),y:p.kind==='balloon'?0.2:0})
   p.drop={x:p.body.position.x,angle:p.body.angle};p.at=performance.now()
   placed.push(p);state.current.blocks++;setStarted(true)
   if(goal){budget--;setLeft(budget)}
   if(!falling)fx('swap',soundRef.current)
   settleUntil=performance.now()+(falling?250:900);input.current.down=false
   if(frame.current){frame.current.dataset.blocks=String(state.current.blocks);frame.current.dataset.lastX=String(Math.round(p.body.position.x))}
  }
  // Honey: sticks fast to the first block (or the island) it touches.
  Events.on(engine,'collisionStart',e=>{
   for(const pair of e.pairs){
    const a=pair.bodyA.parent,b=pair.bodyB.parent
    // A dropped block's first bump: a thump, a puff of dust and a squash; each one a note higher.
    // Like Tricky Towers' bricks, it lands and stops: most of its speed and spin is gone on the first touch.
    for(const body of [a,b]){const p=placed.find(q=>q.body===body);if(p&&!p.landed){p.landed=true;if(p.kind!=='jelly'&&p.kind!=='balloon'){Body.setVelocity(p.body,{x:p.body.velocity.x*0.15,y:Math.min(0.4,p.body.velocity.y*0.2)});Body.setAngularVelocity(p.body,p.body.angularVelocity*0.15)};p.squash=p.kind==='jelly'?1:Math.min(1,0.4+p.body.speed/6);puff(p.body.position.x,p.body.bounds.max.y,6)
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
  // Cast the spell you hold.
  const cast=()=>{
   if(!heldSpell||ended.current)return
   const sp=heldSpell;heldSpell=null;setSpell(null)
   if(sp==='vines'){for(const p of placed)if(!p.locked&&p.landed&&p.body.position.y<ISLAND_TOP+20){p.locked=true;p.vine=true;Body.setStatic(p.body,true);puff(p.body.position.x,p.body.position.y,4,'#9fe08a')}}
   else if(sp==='small')smallLeft=3
   else{const k=placed.map(p=>!p.locked).lastIndexOf(true);if(k>=0){const p=placed[k];Composite.remove(engine.world,p.body);placed.splice(k,1);puff(p.body.position.x,p.body.position.y,10,'#ffffff');for(const q of placed)wake(q.body)}}
   fx('make',soundRef.current);announce(SPELLS[sp].emoji+' '+SPELLS[sp].name+'!',SPELLS[sp].line)
  }
  // Turn a quarter (the picture swings round to catch up).
  const others=()=>[ground,...placed.map(p=>p.body)]
  const fits=(b:Matter.Body,x:number)=>{const was={...b.position};Body.setPosition(b,{x,y:was.y});const ok=b.bounds.min.x>=2&&b.bounds.max.x<=W-2&&!Query.collides(b,others()).length;Body.setPosition(b,was);return ok}
  // Falling: ◀ ▶ move half a block at a time (it slides there smoothly), never into the tower.
  const stepX=(dir:number)=>{if(!active)return;const x=fallX+dir*T/2;if(fits(active.body,x))fallX=x}
  // Turn a quarter (the picture swings round to catch up). Falling, against the tower or an edge it shifts
  // over half a block or a block to fit.
  const rotate=()=>{
   if(!active||cats)return
   const b=active.body;Body.rotate(b,Math.PI/2)
   if(falling){const kick=[0,-T/2,T/2,-T,T].find(k=>fits(b,fallX+k));if(kick===undefined){Body.rotate(b,-Math.PI/2);return}fallX+=kick}
   spin-=Math.PI/2;fx('tick',soundRef.current)
  }
  const drop=()=>{if(active)release()}
  const key=(e:KeyboardEvent,down:boolean)=>{
   if((e.target as HTMLElement)?.closest?.('input,textarea'))return
   const k=e.code,i=input.current
   if(k==='ArrowLeft'||k==='KeyA'){if(down&&!e.repeat){i.nudge=-1;i.repeatAt=performance.now()+170}i.left=down;e.preventDefault()}
   else if(k==='ArrowRight'||k==='KeyD'){if(down&&!e.repeat){i.nudge=1;i.repeatAt=performance.now()+170}i.right=down;e.preventDefault()}
   // Falling: ▼ held speeds this block down (the next one waits for a fresh press). Held: ▼ lets go, and a
   // press before the block is in KONO's paws waits for it.
   else if(k==='ArrowDown'||k==='KeyS'||k==='Space'){if(falling){if(!e.repeat)i.down=down}else{if(down&&!e.repeat){if(active)drop();else i.queued=true}if(!down)i.queued=false}e.preventDefault()}
   else if((k==='ArrowUp'||k==='KeyW'||k==='KeyX')&&down&&!e.repeat){rotate();e.preventDefault()}
  }
  const kd=(e:KeyboardEvent)=>key(e,true),ku=(e:KeyboardEvent)=>key(e,false)
  window.addEventListener('keydown',kd);window.addEventListener('keyup',ku)
  const back=()=>{if(!document.hidden)clearSprites()}
  document.addEventListener('visibilitychange',back)
  const pad=frame.current as (HTMLDivElement&{__rotate?:()=>void;__down?:(on:boolean)=>void})|null
  if(pad){(pad as unknown as {__cast:()=>void}).__cast=cast;pad.__rotate=rotate;pad.__down=on=>{if(falling)input.current.down=on;else if(on){if(active)drop();else if(cats)input.current.queued=true}}}
  // A finger: drag anywhere to carry the block (it follows your finger, wherever you touched), lift to drop
  // it; a quick tap turns it.
  const el=frame.current!
  let ptr:{id:number;sx:number;sy:number;hx:number;t:number;moved:boolean}|null=null
  const toX=(e:PointerEvent)=>{const r=el.getBoundingClientRect();return (e.clientX-r.left)/r.width*W}
  const toY=(e:PointerEvent)=>{const r=el.getBoundingClientRect();return (e.clientY-r.top)/r.height*H}
  const pd=(e:PointerEvent)=>{
   if(e.button>0||ended.current)return
   e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch{/* not capturable */}
   ptr={id:e.pointerId,sx:toX(e),sy:toY(e),hx:falling?fallX:holdX,t:performance.now(),moved:false}
  }
  const pm=(e:PointerEvent)=>{
   if(!ptr||e.pointerId!==ptr.id||cats)return
   const x=toX(e),y=toY(e);if(Math.abs(x-ptr.sx)>8||Math.abs(y-ptr.sy)>8)ptr.moved=true
   if(!ptr.moved)return
   if(!falling){holdX=Math.max(24,Math.min(W-24,ptr.hx+(x-ptr.sx)));return}
   // Falling: slide sideways to steer (half a block at a time, never into the tower); pull down to hurry it.
   const want=ptr.hx+Math.round((x-ptr.sx)/(T/2))*(T/2);let guard=24
   while(Math.abs(want-fallX)>1&&guard--){const was=fallX;stepX(Math.sign(want-fallX));if(fallX===was)break}
   input.current.down=y-ptr.sy>40
  }
  const pu=(e:PointerEvent)=>{
   if(!ptr||e.pointerId!==ptr.id)return
   const d=ptr;ptr=null
   if(falling)input.current.down=false
   // Cat drop: any tap lets the cat go (one tapped before the next cat's in KONO's paws waits for it).
   if(cats){if(active)drop();else input.current.queued=true;return}
   if(!d.moved&&performance.now()-d.t<300)rotate()
   // (A lift right as a new block appears is from the last drag, not a drop of this one.)
   else if(!falling&&d.moved&&d.t>heldAt)drop()
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
   if(active&&!ended.current&&falling){
    // Falling steadily (faster as the tower grows, and in a hurry); ▼ or a pull down hurries it.
    if(i.nudge){stepX(i.nudge);i.nudge=0}
    else if((i.left||i.right)&&now>=i.repeatAt){stepX(i.right?1:-1);i.repeatAt=now+75}
    const b=active.body,dx=fallX-b.position.x
    if(dx)Body.setPosition(b,{x:Math.abs(dx)<0.6?fallX:b.position.x+dx*Math.min(1,0.5*m),y:b.position.y})
    const speed=(i.down?8:(ev?.kind==='hurry'||holdMs===3000?2.2:1.05)+Math.min(0.8,state.current.best*0.02))*m
    // Down in small steps; touching the island or the tower, it's in physics' hands (gently, no slam).
    let landed=false
    for(let go=speed;go>0&&!landed;go-=3){const was={...b.position};Body.setPosition(b,{x:was.x,y:was.y+Math.min(3,go)});if(Query.collides(b,others()).length){Body.setPosition(b,was);landed=true}}
    if(landed||b.bounds.min.y>ISLAND_TOP+60){Body.setPosition(b,{x:b.position.x,y:b.position.y});release()}
   }else if(active&&!ended.current){
    // In KONO's paws: ◀ ▶ (or the arrow keys) carry it smoothly; it glides after your finger and swings a little.
    const b=active.body,half=(b.bounds.max.x-b.bounds.min.x)/2
    // Cat drop: KONO swings the cat from side to side by itself (faster as the tower grows); time your tap.
    if(cats){i.nudge=0;holdX+=catDir*catSwing(state.current.best)*m;if(holdX>W-half-8){holdX=W-half-8;catDir=-1}else if(holdX<half+8){holdX=half+8;catDir=1}
     if(frame.current)frame.current.dataset.aim=String(Math.round(holdX))}
    else{if(i.nudge){holdX+=i.nudge*T/2;i.nudge=0}
     if(i.left||i.right)holdX+=(i.right?1:-1)*4*m}
    holdX=Math.max(half+4,Math.min(W-half-4,holdX))
    const nx=cats?holdX:b.position.x+(holdX-b.position.x)*Math.min(1,0.3*m),ny=b.position.y+(hangY(b)-b.position.y)*Math.min(1,0.12*m)
    Body.setPosition(b,{x:nx,y:ny})
    swing+=((nx-lastX)/Math.max(m,0.01)-swing)*0.3;lastX=nx
    // KONO lets go by itself after a while (the ring round KONO shows the last three seconds).
    const left=holdMs-(now-heldAt);if(left<3000)timer=Math.max(0,left/Math.min(3000,holdMs))
    if(left<=0)release()
   }else{swing*=0.9;if(!ended.current&&now>settleUntil){spawn();if(!falling&&active&&i.queued){i.queued=false;release()}}}
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
   // A dropped block falls no faster than a steady pace until it first lands: a fast hit makes two blocks
   // overlap for a moment, and the physics then shoves them apart hard enough to fling the tower. Small steps
   // (240 a second) keep contacts clean too.
   acc+=dt;while(acc>=1000/240){for(const p of placed){if(!p.landed&&p.body.velocity.y>4.2)Body.setVelocity(p.body,{x:p.body.velocity.x,y:4.2})
    // Like Tricky Towers' bricks, a landed block grips: it resists tipping (a block that lands on a bump leans
    // slowly rather than snapping off) and sliding (ice, slippery and jelly blocks still slide). Measured on
    // 10 test towers of 16 pieces each, placed the way a careful player would: blocks lost fell from 3.4 to
    // 0.1, blocks sliding after they land from 7.2 to 3.7, and towers grew from 15 to 22 rows; a block hung
    // well over an edge still tips and falls.
    else if(p.landed&&!p.locked&&!p.body.isSleeping&&p.kind!=='jelly'){Body.setAngularVelocity(p.body,p.body.angularVelocity*0.87);if(!p.slick&&p.kind!=='ice')Body.setVelocity(p.body,{x:p.body.velocity.x*0.9,y:p.body.velocity.y})}};Engine.update(engine,1000/240);acc-=1000/240}
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
   if(h>state.current.best){const before=state.current.best;state.current.best=h;setHeight(h);if(frame.current)frame.current.dataset.height=String(h)
    // A spell every six rows (one held at a time).
    if(md.kind!=='puzzle'&&!heldSpell){const sp=spellFor(before,h,Math.random);if(sp){heldSpell=sp;setSpell(sp);window.setTimeout(()=>announce('✨ '+SPELLS[sp].emoji+' '+SPELLS[sp].name,'You earned a spell: '+SPELLS[sp].name+'. '+SPELLS[sp].line),900)}}
    if(race&&h>=RACE_GOAL&&!state.current.won&&!ended.current){state.current.won=true;cheer=1.5;confetti(topY());fx('fanfare',soundRef.current);announce('You win! 🏁','You reached the finish line first!');finish(1800)}
    if(goal&&h>=goal.goal&&!state.current.won){state.current.won=true;cheer=1.5;confetti(topY());fx('fanfare',soundRef.current);announce('Flag reached! 🚩','You reached the flag at row '+goal.goal+'. Level complete!');finish(1800)}
    else if(Math.floor(h/5)>milestone){milestone=Math.floor(h/5);cheer=1;confetti(topY());fx('star',soundRef.current,Math.min(8,milestone));announce(h+' high!','Row '+h+'.')}
    else setSay('Row '+h+'.')
    // Every ten rows: the lower part turns to stone, safe from tumbling.
    const line=lockLine(h,ISLAND_TOP,T)
    if(line!==null&&Math.floor(h/LOCK_EVERY)>lockedTo){lockedTo=Math.floor(h/LOCK_EVERY);let n=0
     for(const p of placed)if(!p.locked&&p.rest>=24&&p.body.bounds.min.y>=line){p.locked=true;Body.setStatic(p.body,true);n++;puff(p.body.position.x,p.body.position.y,3,'#cfe8b0')}
     if(n){fx('make',soundRef.current);window.setTimeout(()=>announce('Stone base! 🪨','The lower rows turned to stone. They can’t fall now.'),700)}}
   }
   // Race: Rival KONO climbs alongside; reaching the finish first ends it.
   if(race&&!ended.current&&state.current.blocks>0){const was=Math.floor(rivalH);rivalH=rivalStep(rivalH,dt,Math.random);if(Math.floor(rivalH)!==was)setRival(Math.floor(rivalH))
    if(rivalH>=RACE_GOAL&&!state.current.won){announce('Rival KONO wins!','Rival KONO reached the finish line first.');setOver(true);gameSound('lose',soundRef.current);finish(1500)}}
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
    paint(canvas.current,{race:race?{goal:RACE_GOAL,rival:rivalH}:null,spin,swing,timer,hold:falling&&active?{x:active.body.position.x+(active.body.position.x>W/2?-78:78),y:active.body.position.y+30}:{x:active?active.body.position.x:holdX,y:active?active.body.bounds.min.y:Math.min(ISLAND_TOP-6*T,towerTop()-2.6*T)-T*2},placed,active,cam:cam.y,t,shake,imgs,height:state.current.best,fxs,best:md.kind==='classic'?bestRef.current??0:0,goal:goal?.goal??0,lite,calm,sway,kono,gust,bird:bird.state==='off'?null:{x:bird.x,y:bird.y,sitting:bird.state==='sit'}})}
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);document.removeEventListener('visibilitychange',back);el.removeEventListener('pointerdown',pd);el.removeEventListener('pointermove',pm);el.removeEventListener('pointerup',pu);el.removeEventListener('pointercancel',pc);Events.off(engine,'collisionStart');Engine.clear(engine)}
 },[])
 useEffect(()=>{if(!call)return;const id=window.setTimeout(()=>setCall(null),1000);return()=>window.clearTimeout(id)},[call])
 const hold=(k:'left'|'right',on:boolean)=>{const i=input.current;if(on&&!i[k]){i.nudge=k==='left'?-1:1;i.repeatAt=performance.now()+170}i[k]=on}
 const downPad=(on:boolean)=>(frame.current as (HTMLDivElement&{__down?:(on:boolean)=>void})|null)?.__down?.(on)
 const turn=()=>(frame.current as (HTMLDivElement&{__rotate?:()=>void})|null)?.__rotate?.()
 const cats=mode.kind==='cats'
 const label=cats?'🐱 Cat drop'+(best!==null?' · Best '+best+' ft':''):mode.kind==='race'?'Race Rival KONO':mode.kind==='daily'?'Today’s tower':mode.kind==='puzzle'?'Level '+mode.level:best!==null?'Best '+best:'KONO Teeter Tower'
 return <div className="break-game kono-teeter">
  <div className="blast-top"><span className="blast-best">{label}</span>{event&&<span className="teeter-event" role="status">{EVENTS[event.kind].emoji} {EVENTS[event.kind].name} <b>×{event.left}</b></span>}{mode.kind==='race'&&<span className="teeter-goal">🏁 Row {RACE_GOAL} · Rival <b>{rival}</b></span>}{spell&&<button type="button" className="teeter-spell" onClick={()=>(frame.current as unknown as {__cast?:()=>void}|null)?.__cast?.()} aria-label={'Cast '+SPELLS[spell].name+': '+SPELLS[spell].line}>{SPELLS[spell].emoji} {SPELLS[spell].name}</button>}{puzzle&&<span className="teeter-goal">🚩 Row {puzzle.goal} · <b>{left}</b> block{left===1?'':'s'} left</span>}<span className="teeter-hearts" aria-label={hearts+' hearts left'}>{Array.from({length:HEARTS},(_,i)=><i key={i} className={i<hearts?'is-on':undefined}>♥</i>)}</span></div>
  <div ref={frame} className={'teeter-frame'+(over?' is-over':'')} role="img" aria-label={cats?'KONO Cat drop, the cat tower is '+height+' feet high':'KONO Teeter Tower, '+height+' rows high'} data-height="0" data-blocks="0">
   <canvas ref={canvas} width={W*2} height={H*2} aria-hidden="true"/>
   <strong key={height} className="teeter-score" aria-hidden="true">{height}{cats&&<small> ft</small>}</strong>
   {next.cat?<span className="teeter-next" aria-label={'Next cat: '+COATS[next.cat.coat].name+' '+CATS[next.cat.kind].name.toLowerCase()}><small>Next</small><img className="teeter-next-cat" src={catIcon(next.cat)} alt="" draggable={false}/></span>
   :<span className="teeter-next" aria-label={'Next block: '+(next.kind?SPECIALS[next.kind].name:next.shape)}><small>Next</small><NextShape shape={next.shape} kind={next.kind}/></span>}
   {call&&<span key={call.at} className="teeter-call" aria-hidden="true">{call.text}</span>}
   {!started&&!over&&<p className="teeter-hint"><b>{cats?'Stack the cats!':puzzle?'Reach the flag at row '+puzzle.goal+'!':mode.kind==='race'?'Race Rival KONO to row '+RACE_GOAL+'!':'Build it tall!'}</b><span>{cats?'KONO swings each cat · tap anywhere to drop it':control==='fall'?'Slide your finger to steer · tap to turn · pull down to hurry':'Slide your finger to carry the block · lift to drop it · tap to turn'}</span></p>}
  </div>
  <p className="teeter-say" aria-live="polite">{say}</p>
  {cats?<div className="teeter-pad is-cats" role="group" aria-label="Controls"><button type="button" aria-label="Drop the cat" onPointerDown={()=>downPad(true)}>🐾 Drop</button></div>:
  <div className="teeter-pad" role="group" aria-label="Controls">
   <button type="button" aria-label="Left" onPointerDown={()=>hold('left',true)} onPointerUp={()=>hold('left',false)} onPointerLeave={()=>hold('left',false)}>◀</button>
   <button type="button" aria-label="Turn" onClick={turn}>⟳</button>
   <button type="button" aria-label={control==='fall'?'Faster':'Drop'} onPointerDown={()=>downPad(true)} onPointerUp={()=>downPad(false)} onPointerLeave={()=>downPad(false)}>▼</button>
   <button type="button" aria-label="Right" onPointerDown={()=>hold('right',true)} onPointerUp={()=>hold('right',false)} onPointerLeave={()=>hold('right',false)}>▶</button>
  </div>}
  <p className="blast-help">{cats?'KONO swings each cat from side to side above the tower, faster as it grows. Tap anywhere (or 🐾 Drop, ↓, Space) to let go. Cats are soft and wobbly, so stack them with care: every ten feet the cats at the bottom fall asleep and stay put. Lose three cats off the island and it’s over. ':control==='fall'?'Blocks fall from the top: slide your finger (or ◀ ▶, the arrow keys) to steer half a block at a time, tap (or ⟳, ↑) to turn, pull down (or hold ▼, ↓, Space) to hurry. Once a block touches the tower it’s real physics, so it can lean, slide and tip. ':'KONO holds each block above the tower. Slide your finger anywhere to carry it and lift to drop it (or ◀ ▶ to carry, ▼ to drop; the arrow keys and Space work too). Tap (or ⟳, ↑) to turn it. It drops for real, so it can bounce, slide and tip; KONO lets go by itself after eight seconds. '}{!cats&&'Every ten rows the bottom turns to stone. Specials: 🍯 sticks, 🪨 heavy, 🎈 lands softly, 🧊 slippery, 🍮 bouncy jelly. Now and then the next three blocks are big 🔍, slippery 💦, or KONO’s in a hurry ⏱️. Blocks that fall off the island cost a heart.'}</p>
 </div>
}

function NextShape({shape,kind}:{shape:ShapeId;kind:Special|null}){
 const cells=SHAPES[shape],w=Math.max(...cells.map(c=>c[0]))+1,h=Math.max(...cells.map(c=>c[1]))+1
 return <span className="teeter-next-shape"><svg viewBox={`0 0 ${w*10} ${h*10}`} width={w*10} height={h*10} aria-hidden="true">{cells.map(([x,y],i)=><rect key={i} x={x*10+.5} y={y*10+.5} width="9" height="9" rx="2.5" fill={kind?SPECIALS[kind].color:COLORS[shape]}/>)}</svg>{kind&&<i aria-hidden="true">{SPECIALS[kind].emoji}</i>}</span>
}

type Bit={x:number;y:number;vx:number;vy:number;life:number;color:string;size:number;kind:'dust'|'confetti'|'spark'|'leaf';spin?:number}
type Scene={race:{goal:number;rival:number}|null;spin:number;swing:number;timer:number|null;hold:{x:number;y:number};placed:Piece[];active:Piece|null;cam:number;t:number;shake:number;imgs:Record<string,HTMLImageElement>;height:number;fxs:Bit[];best:number;goal:number;lite:boolean;calm:boolean;sway:number;kono:'happy'|'cheer'|'dance'|'gasp'|'eyes';gust:number;bird:{x:number;y:number;sitting:boolean}|null}
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
 // Race: a rainbow finish line, and Rival KONO's tower climbing on the islet alongside.
 if(s.race){const y=ISLAND_TOP-s.race.goal*T,cols=['#ff8fa3','#ffb36b','#ffe27a','#8fe0a6','#8fc8f5','#c3a3f0']
  for(let k=0;k<W;k+=14){g.fillStyle=cols[(k/14)%cols.length];g.beginPath();g.arc(k+7,y,4,0,7);g.fill()}
  marker(g,y,'🏁 Finish','#ffffff','#5a3a6a','rgba(0,0,0,0)')
  const rx=W/2+ISLAND_W/2+92,rows=s.race.rival,base=ISLAND_TOP+12
  for(let k=0;k<Math.floor(rows);k++){g.fillStyle=cols[k%cols.length];g.beginPath();g.roundRect(rx-10,base-(k+1)*T+2,20,T-3,5);g.fill();g.strokeStyle='rgba(60,40,70,.25)';g.lineWidth=1;g.stroke()}
  const ky=base-Math.floor(rows)*T-30
  if(ok(s.imgs.kono)){g.save();g.globalAlpha=.95;g.drawImage(s.imgs.kono,rx-17,ky-6,34,34);g.restore()}
  g.font='800 9px system-ui,sans-serif';const lw=g.measureText('RIVAL').width+10;g.fillStyle='#5a6fd8';g.beginPath();g.roundRect(rx-lw/2,ky-18,lw,13,6);g.fill();g.fillStyle='#fff';g.textAlign='center';g.fillText('RIVAL',rx,ky-8);g.textAlign='start'
  // And a marker at Rival KONO's height on the right edge, so you can see how close it is as you climb.
  const my=ISLAND_TOP-rows*T
  g.strokeStyle='rgba(90,111,216,.7)';g.lineWidth=2;g.setLineDash([5,5]);g.beginPath();g.moveTo(W-70,my);g.lineTo(W,my);g.stroke();g.setLineDash([])
  g.fillStyle='#5a6fd8';g.beginPath();g.roundRect(W-62,my-11,54,22,11);g.fill();g.font='800 10px system-ui,sans-serif';g.fillStyle='#fff';g.fillText('Rival '+Math.floor(rows),W-52,my+4)
  if(ok(s.imgs.kono))g.drawImage(s.imgs.kono,W-86,my-14,26,26)}
 if(s.goal>0){const y=ISLAND_TOP-s.goal*T,fx0=W/2+ISLAND_W/2+4;marker(g,y,'🚩 Row '+s.goal,'#7fd1ae','#14432f','rgba(60,170,120,.9)')
  g.strokeStyle='#5a3a22';g.lineWidth=2;g.beginPath();g.moveTo(fx0,y);g.lineTo(fx0,y-30);g.stroke()
  g.fillStyle='#ff6b81';g.beginPath();g.moveTo(fx0+1,y-30);g.lineTo(fx0+19+(s.calm?0:Math.sin(s.t*0.15)*2),y-24);g.lineTo(fx0+1,y-18);g.fill()}
 // The island: a grassy ledge, layered earth with roots and vines, a tree at each end.
 const ix=W/2-ISLAND_W/2-14,iw=ISLAND_W+28
 if(s.lite)g.fillStyle='#9a6c42'
 else{const earth=g.createLinearGradient(0,ISLAND_TOP,0,ISLAND_TOP+110);earth.addColorStop(0,'#c49460');earth.addColorStop(.5,'#94673e');earth.addColorStop(1,'#5e3e24');g.fillStyle=earth}
 g.beginPath();g.moveTo(ix,ISLAND_TOP+6);g.lineTo(ix+iw,ISLAND_TOP+6);g.quadraticCurveTo(ix+iw-4,ISLAND_TOP+40,ix+iw*0.8,ISLAND_TOP+62);g.quadraticCurveTo(W/2+12,ISLAND_TOP+128,W/2-2,ISLAND_TOP+124);g.quadraticCurveTo(ix+iw*0.3,ISLAND_TOP+108,ix+iw*0.2,ISLAND_TOP+60);g.quadraticCurveTo(ix+4,ISLAND_TOP+40,ix,ISLAND_TOP+6);g.fill()
 if(!s.lite){
  g.strokeStyle='rgba(255,230,190,.25)';g.lineWidth=3;for(const d of [26,48]){g.beginPath();g.moveTo(ix+14+d/3,ISLAND_TOP+d);g.quadraticCurveTo(W/2,ISLAND_TOP+d+10,ix+iw-14-d/3,ISLAND_TOP+d);g.stroke()}
  g.fillStyle='rgba(80,50,30,.5)';for(const [x,y,r] of [[ix+iw*0.25,ISLAND_TOP+30,4],[ix+iw*0.6,ISLAND_TOP+44,5],[ix+iw*0.82,ISLAND_TOP+24,3],[W/2+6,ISLAND_TOP+84,4]]){g.beginPath();g.ellipse(x,y,r*1.4,r,0,0,7);g.fill()}
  g.strokeStyle='#5a3a22';g.lineWidth=2;for(let r=0;r<4;r++){const x=ix+iw*(0.24+r*0.17);g.beginPath();g.moveTo(x,ISLAND_TOP+70+(r===2?40:0));g.quadraticCurveTo(x+6+Math.sin(s.t*0.03+r)*2,ISLAND_TOP+92+r%2*8+(r===2?40:0),x-2,ISLAND_TOP+108+r*3+(r===2?30:0));g.stroke()}
  g.strokeStyle='#4f9a3c';g.lineWidth=2.5;for(const [x,len] of [[ix+8,40],[ix+iw-10,52],[ix+iw*0.55,26]] as const){const sw=s.gust*5;g.beginPath();g.moveTo(x,ISLAND_TOP+8);g.quadraticCurveTo(x+Math.sin(s.t*0.04+x)*4+sw,ISLAND_TOP+8+len/2,x+2+sw,ISLAND_TOP+8+len);g.stroke();g.fillStyle='#7fcf5e';g.beginPath();g.ellipse(x+2+sw,ISLAND_TOP+8+len,3,4,0,0,7);g.fill()}
 }
 // Two little islets float beside the island, a tree on each (scenery only: a block that falls passes by).
 for(const [x,y,w,img,tw,th] of [[ix-74,ISLAND_TOP+34,64,s.imgs.treeL,58,66],[ix+iw+78,ISLAND_TOP+14,60,s.race?null:s.imgs.treeR,60,70]] as const){
  g.fillStyle=s.lite?'#9a6c42':'#a8794a';g.beginPath();g.moveTo(x-w/2,y+4);g.lineTo(x+w/2,y+4);g.quadraticCurveTo(x+w/4,y+w*0.55,x,y+w*0.6);g.quadraticCurveTo(x-w/4,y+w*0.5,x-w/2,y+4);g.fill()
  g.fillStyle='#6cbf4f';g.beginPath();g.roundRect(x-w/2,y-2,w,9,5);g.fill()
  if(img&&ok(img))g.drawImage(img,x-tw/2,y-th+4,tw,th)
 }
 if(s.lite)g.fillStyle='#6cbf4f'
 else{const grass=g.createLinearGradient(0,ISLAND_TOP-2,0,ISLAND_TOP+12);grass.addColorStop(0,'#86d65e');grass.addColorStop(1,'#4f9a3c');g.fillStyle=grass}
 g.beginPath();g.roundRect(ix,ISLAND_TOP-2,iw,14,7);g.fill()
 if(ok(s.imgs.grass))for(let x=ix;x<ix+iw-10;x+=40)g.drawImage(s.imgs.grass,x,ISLAND_TOP-14,40,16)
 // Little flowers along the edge.
 if(!s.lite)for(let f=0;f<4;f++){const x=ix+14+f*((iw-28)/3),c=['#ffb3c7','#fff3a0','#c9b6ff','#ffffff'][f%4];g.fillStyle=c;for(let p=0;p<5;p++){const a=p/5*6.28;g.beginPath();g.arc(x+Math.cos(a)*2.2,ISLAND_TOP+4+Math.sin(a)*2.2,1.6,0,7);g.fill()}g.fillStyle='#ffcf4a';g.beginPath();g.arc(x,ISLAND_TOP+4,1.3,0,7);g.fill()}
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
  // A see-through guide column as wide as the block, straight down to the island, to line the drop up.
  const gy=b.bounds.max.y+4,gw=b.bounds.max.x-b.bounds.min.x,gh=Math.max(0,ISLAND_TOP-gy)
  const col=g.createLinearGradient(0,gy,0,gy+gh);col.addColorStop(0,'rgba(255,255,255,.28)');col.addColorStop(1,'rgba(255,255,255,.04)')
  g.fillStyle=col;g.fillRect(b.bounds.min.x,gy,gw,gh)
  g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1;g.beginPath();g.moveTo(b.bounds.min.x+.5,gy);g.lineTo(b.bounds.min.x+.5,gy+gh);g.moveTo(b.bounds.max.x-.5,gy);g.lineTo(b.bounds.max.x-.5,gy+gh);g.stroke()
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
 if(p.cat){kitty(g,p,p.cat,t,p.locked?'sleep':mood,lite);return}
 const b=p.body,parts=tiles(p),stone=p.locked&&!p.vine,h=T/2-0.5
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
 // Vines (a spell): green ties wound round the block.
 if(p.vine){g.strokeStyle='#4f9a3c';g.lineWidth=2.2;for(const part of parts){g.beginPath();g.moveTo(part.position.x-h,part.position.y-h*0.3);g.quadraticCurveTo(part.position.x,part.position.y+h*0.6,part.position.x+h,part.position.y-h*0.2);g.stroke();g.fillStyle='#7fcf5e';g.beginPath();g.ellipse(part.position.x+h*0.4,part.position.y+h*0.15,3.5,2,0.5,0,7);g.fill()}}
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
/** A cat (Cat drop), drawn about its body: a soft rounded body in its coat, ears, a tail, tabby stripes or
 * calico patches, little paws, and a face that beams, blinks, frets when the tower wobbles and sleeps once
 * the cats below have settled for good. Each shape keeps its head where a cat that shape would. */
const CAT_LOOK:Record<CatKind,{r:number;head:(w:number,h:number)=>[number,number,number]}>={
 loaf:{r:.45,head:(w,h)=>[-w/2+h*.55,-h*.02,h*.4]},
 curl:{r:.5,head:(w,h)=>[-w*.16,-h*.06,h*.34]},
 long:{r:.45,head:(w,h)=>[-w/2+h*.52,0,h*.38]},
 sit:{r:.42,head:(w,h)=>[0,-h/2+w*.44,w*.34]},
 chonk:{r:.45,head:(_w,h)=>[0,-h*.12,h*.32]},
}
function kitty(g:CanvasRenderingContext2D,p:Piece,cat:Cat,t:number,mood:Mood,lite:boolean){
 const b=p.body,c=CATS[cat.kind],coat=COATS[cat.coat],L=CAT_LOOK[cat.kind]
 const w=c.w*T*p.size,h=c.h*T*p.size,[hx,hy,fr]=L.head(w,h),rad=Math.min(w,h)*L.r,tn=tone(coat.base),dark=coat.name==='Midnight'
 const ink=dark?'#2a2433':'#3a2630'
 g.save();g.translate(b.position.x,b.position.y);g.rotate(b.angle)
 // Squash on landing (about its feet), and a slow breath.
 const sq=(p.squash>0?Math.sin(p.squash*Math.PI)*0.16*p.squash:0)+(lite?0:Math.sin(t*0.06+p.n)*0.012)
 if(sq){g.translate(0,h/2);g.scale(1+sq,1-sq);g.translate(0,-h/2)}
 if(!lite){g.fillStyle='rgba(40,30,70,.18)';g.beginPath();g.roundRect(-w/2+1.5,-h/2+2.5,w,h,rad);g.fill()}
 // The tail, behind the body (a sitting cat's wraps round its feet; a curled-up cat's wraps round its front).
 const tail=(path:()=>void,width:number)=>{g.lineCap='round';g.strokeStyle=tn.edge;g.lineWidth=width+3;g.beginPath();path();g.stroke();g.strokeStyle=coat.mark??coat.base;g.lineWidth=width;g.beginPath();path();g.stroke()}
 const tw=Math.max(4,h*.2),wag=lite?0:Math.sin(t*0.08+p.n)*h*.08
 if(cat.kind==='loaf'||cat.kind==='chonk')tail(()=>{g.moveTo(w/2-tw,h*.15);g.quadraticCurveTo(w/2+h*.45,h*.05,w/2+h*.3+wag,-h*.4)},tw)
 else if(cat.kind==='long')tail(()=>{g.moveTo(w/2-tw,0);g.bezierCurveTo(w/2+h*.4,-h*.1,w/2+h*.2,-h*.6,w/2+h*.55+wag,-h*.7)},tw)
 // Ears.
 const ear=(x:number,dir:number)=>{const base=-h/2+rad*.25,top=-h/2-fr*.62
  g.fillStyle=coat.base;g.strokeStyle=tn.edge;g.lineWidth=1.4;g.lineJoin='round'
  g.beginPath();g.moveTo(x-fr*.36,base+2);g.quadraticCurveTo(x+dir*fr*.05,top-2,x+dir*fr*.1,top);g.quadraticCurveTo(x+fr*.3,base-2,x+fr*.42,base+2);g.closePath();g.fill();g.stroke()
  g.fillStyle='#ffb3c7';g.beginPath();g.moveTo(x-fr*.18,base+1);g.quadraticCurveTo(x+dir*fr*.06,top+fr*.18,x+dir*fr*.08,top+fr*.2);g.lineTo(x+fr*.24,base+1);g.closePath();g.fill()}
 ear(hx-fr*.62,-1);ear(hx+fr*.56,1)
 // The body, with a soft top light and a deeper bottom.
 const body=g.createLinearGradient(0,-h/2,0,h/2);body.addColorStop(0,lite?coat.base:tn.hi);body.addColorStop(.45,coat.base);body.addColorStop(1,lite?coat.base:tn.lo)
 g.fillStyle=body;g.beginPath();g.roundRect(-w/2,-h/2,w,h,rad);g.fill()
 g.save();g.clip()
 // Calico (and snow) patches; tabby stripes along the back, away from the face.
 if(coat.patch){g.fillStyle=coat.patch;g.beginPath();g.ellipse(w*.22,-h*.28,w*.24,h*.3,.3,0,7);g.fill()
  if(coat.name==='Calico'){g.fillStyle='#5a4a52';g.beginPath();g.ellipse(-w*.05,h*.32,w*.13,h*.18,-.4,0,7);g.ellipse(hx+fr*.5,-h/2+2,fr*.38,fr*.3,0,0,7);g.fill()}}
 if(coat.mark){g.strokeStyle=coat.mark;g.lineCap='round';g.lineWidth=Math.max(2.2,h*.09)
  const from=cat.kind==='sit'||cat.kind==='chonk'?-w*.3:hx+fr*1.15,to=w/2-6,n=cat.kind==='long'?5:3
  for(let k=0;k<n;k++){const x=from+(to-from)*(k+.5)/n;g.beginPath();g.moveTo(x-2,-h/2-1);g.quadraticCurveTo(x+3,-h/2+h*.16,x-1,-h/2+h*.3);g.stroke()}
  g.beginPath();g.moveTo(hx-fr*.18,hy-fr*.95);g.lineTo(hx-fr*.12,hy-fr*.62);g.moveTo(hx+fr*.18,hy-fr*.95);g.lineTo(hx+fr*.12,hy-fr*.62);g.moveTo(hx,hy-fr*1.02);g.lineTo(hx,hy-fr*.66);g.stroke()}
 // A pale muzzle.
 g.fillStyle=dark?'rgba(255,255,255,.12)':'rgba(255,255,255,.55)';g.beginPath();g.ellipse(hx,hy+fr*.32,fr*.55,fr*.36,0,0,7);g.fill()
 g.restore()
 g.strokeStyle=tn.edge;g.lineWidth=1.5;g.beginPath();g.roundRect(-w/2,-h/2,w,h,rad);g.stroke()
 // Paws peeking out along the bottom (a loaf tucks them in).
 if(cat.kind!=='loaf'&&cat.kind!=='curl'){const px=cat.kind==='long'?[hx-fr*.2,hx+fr*.7,w/2-h*.9,w/2-h*.45]:[hx-fr*.45,hx+fr*.45],pr=Math.max(3,Math.min(w,h)*.11)
  for(const x of px){g.fillStyle=coat.base;g.strokeStyle=tn.edge;g.lineWidth=1.2;g.beginPath();g.ellipse(x,h/2-pr*.55,pr*1.1,pr*.75,0,0,7);g.fill();g.stroke()
   g.strokeStyle=tn.edge;g.lineWidth=.9;g.beginPath();g.moveTo(x-pr*.3,h/2-pr*.9);g.lineTo(x-pr*.3,h/2-pr*.45);g.moveTo(x+pr*.3,h/2-pr*.9);g.lineTo(x+pr*.3,h/2-pr*.45);g.stroke()}}
 if(cat.kind==='sit')tail(()=>{g.moveTo(w/2-3,h*.3);g.quadraticCurveTo(w/2+tw*.6,h/2,w*.05+wag*.4,h/2-tw*.4)},tw*.9)
 if(cat.kind==='curl')tail(()=>{g.moveTo(w/2-tw*.6,h*.05);g.quadraticCurveTo(w/2-tw*.2,h/2-tw*.5,w*.05,h/2-tw*.6);g.quadraticCurveTo(-w*.25,h/2-tw*.6,-w*.32+wag*.3,h*.18)},tw)
 // The face.
 const blink=mood==='sleep'||mood!=='worried'&&Math.floor((t+p.n*37)/90)%7===0,ex=fr*.42,er=Math.max(1.8,fr*.2),ey=hy+(mood==='look'?fr*.06:-fr*.02)
 g.fillStyle='rgba(255,120,150,.5)';g.beginPath();g.ellipse(hx-fr*.66,hy+fr*.3,fr*.17,fr*.11,0,0,7);g.ellipse(hx+fr*.66,hy+fr*.3,fr*.17,fr*.11,0,0,7);g.fill()
 g.strokeStyle=dark?'#fff3d6':ink;g.lineWidth=Math.max(1.1,fr*.08);g.lineCap='round'
 if(blink){g.beginPath();g.arc(hx-ex,ey-er*.3,er*.9,0.15*Math.PI,0.85*Math.PI);g.moveTo(hx+ex+er*.9*Math.cos(0.15*Math.PI),ey-er*.3+er*.9*Math.sin(0.15*Math.PI));g.arc(hx+ex,ey-er*.3,er*.9,0.15*Math.PI,0.85*Math.PI);g.stroke()}
 else{
  const big=mood==='worried'?1.25:1
  if(dark){g.fillStyle='#ffe27a';g.beginPath();g.arc(hx-ex,ey,er*1.25*big,0,7);g.arc(hx+ex,ey,er*1.25*big,0,7);g.fill()}
  g.fillStyle=ink;g.beginPath();g.ellipse(hx-ex,ey,er*big,er*1.15*big,0,0,7);g.ellipse(hx+ex,ey,er*big,er*1.15*big,0,0,7);g.fill()
  g.fillStyle='#fff';g.beginPath();g.arc(hx-ex+er*.35,ey-er*.4,er*.42,0,7);g.arc(hx+ex+er*.35,ey-er*.4,er*.42,0,7);g.arc(hx-ex-er*.35,ey+er*.4,er*.2,0,7);g.arc(hx+ex-er*.35,ey+er*.4,er*.2,0,7);g.fill()}
 // Nose, mouth ("w", or a worried "o") and whiskers.
 const ny=hy+fr*.2
 g.fillStyle='#ff8fab';g.beginPath();g.moveTo(hx-fr*.1,ny-fr*.04);g.lineTo(hx+fr*.1,ny-fr*.04);g.lineTo(hx,ny+fr*.08);g.closePath();g.fill()
 g.strokeStyle=dark?'#fff3d6':ink;g.lineWidth=Math.max(1,fr*.07)
 if(mood==='worried'){g.fillStyle=ink;g.beginPath();g.ellipse(hx,ny+fr*.3,fr*.1,fr*.13,0,0,7);g.fill()}
 else{g.beginPath();g.moveTo(hx,ny+fr*.08);g.quadraticCurveTo(hx-fr*.02,ny+fr*.26,hx-fr*.17,ny+fr*.2);g.moveTo(hx,ny+fr*.08);g.quadraticCurveTo(hx+fr*.02,ny+fr*.26,hx+fr*.17,ny+fr*.2);g.stroke()}
 if(!lite){g.strokeStyle=dark?'rgba(255,243,214,.7)':'rgba(58,38,48,.45)';g.lineWidth=.9
  for(const s of [-1,1])for(const k of [-1,1]){g.beginPath();g.moveTo(hx+s*fr*.45,ny+fr*.12);g.lineTo(hx+s*fr*1.05,ny+fr*.04+k*fr*.14);g.stroke()}}
 // Fast asleep: a little "z".
 if(mood==='sleep'&&!lite){g.fillStyle='rgba(255,255,255,.85)';g.font='800 '+Math.max(7,fr*.5)+'px system-ui';g.fillText('z',hx+fr*.8,-h/2+fr*.1-Math.sin(t*0.05+p.n)*1.5)}
 g.restore()
}
/** A cat as a little picture, for "Next". */
const catIcons=new Map<string,string>()
function catIcon(cat:Cat){
 const key=cat.kind+cat.coat;let u=catIcons.get(key);if(u)return u
 const c=document.createElement('canvas'),k=CATS[cat.kind],w=k.w*T,h=k.h*T,sc=2;c.width=(w+T*1.4)*sc;c.height=(h+T*1.2)*sc
 const g=c.getContext('2d');if(!g)return ''
 g.scale(sc,sc)
 kitty(g,{body:{position:{x:c.width/sc/2-T*.15,y:c.height/sc/2+T*.25},angle:0},size:1,squash:0,n:1} as unknown as Piece,cat,0,'happy',false)
 u=c.toDataURL();catIcons.set(key,u);return u
}
