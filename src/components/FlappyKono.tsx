import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {FLAP,flap,flapMedal,newFlight,step,type Flight} from '../store/flappy'
import {gameSound} from '../konoSounds'
import {fx,startMusic,stopMusic} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

/** KONO Hop (the rules are in store/flappy): tap, click or press Space to flap. KONO tilts up as it
 * flaps and noses down as it falls (its little wing flapping), drawn as a bright tap-to-fly game: green pipes
 * with a light stripe, a dark outline and a wide cap, a flat day-blue sky, puffy clouds, a pale city skyline
 * and bushes sliding slower than the striped sandy ground (parallax), crisp pixel edges, and the big
 * outlined score. "Get ready" waits for the first tap;
 * a hit flashes the screen, KONO drops, and the run ends with its medal. A chiptune soundtrack plays from the
 * first flap, with a whoosh for each flap and a ding for each pipe. */
export default function FlappyKono({ref,best,sound,onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(score:number)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),flight=useRef<Flight>(newFlight()),phase=useRef<'ready'|'fly'|'down'>('ready')
 const [score,setScore]=useState(0),[stage,setStage]=useState<'ready'|'fly'|'down'>('ready'),[flash,setFlash]=useState(0)
 const kono=useRef<HTMLImageElement|null>(null),ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 const over=()=>{if(ended.current)return;ended.current=true;window.setTimeout(()=>onEndRef.current(flight.current.score),900)}
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(flight.current.score)}}),[])
 const press=()=>{
  if(ended.current||phase.current==='down')return
  if(phase.current==='ready'){phase.current='fly';setStage('fly');gameSound('start',soundRef.current);startMusic('flap',soundRef.current)}
  flight.current=flap(flight.current);fx('flap',soundRef.current)
 }
 const pressRef=useRef(press)
 useEffect(()=>{pressRef.current=press})
 useEffect(()=>{
  const img=new Image();img.src='/garden/kono/excited.webp';kono.current=img
  const key=(e:KeyboardEvent)=>{if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){e.preventDefault();pressRef.current()}}
  window.addEventListener('keydown',key)
  let raf=0,last=performance.now(),t=0
  const loop=(now:number)=>{
   const n=Math.min(3,(now-last)/(1000/60));last=now;t+=n
   if(phase.current==='fly'||phase.current==='down'){
    const r=step(flight.current,n,Math.random);flight.current=r.flight
    if(r.scored){setScore(r.flight.score);fx('ding',soundRef.current)}
    if(r.hit){phase.current='down';setStage('down');setFlash(f=>f+1);fx('thud',soundRef.current);stopMusic();over()}
   }
   draw(canvas.current,flight.current,phase.current,t,kono.current)
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',key);stopMusic()}
 },[])
 const medal=flapMedal(score)
 return <div className="break-game flappy">
  <div className="blast-top"><span className="blast-best">{best!==null?'Best '+best:'KONO Hop'}</span><span className="blast-coins">{medal?medal.emoji+' '+medal.name:''}</span></div>
  <div className={'flappy-frame'+(stage==='down'?' is-down':'')} onPointerDown={e=>{e.preventDefault();press()}}>
   <canvas ref={canvas} width={FLAP.w*2} height={FLAP.h*2} role="img" aria-label={'KONO Hop, score '+score}/>
   {score>0&&<span key={'p'+score} className="flappy-pass" aria-hidden="true"/>}
   <strong key={score} className="flappy-score" aria-live="polite">{score}</strong>
   {stage==='ready'&&<p className="flappy-ready"><b>Get ready!</b><span>Tap to flap</span></p>}
   {flash>0&&<span key={flash} className="flappy-flash" aria-hidden="true"/>}
  </div>
  <p className="blast-help">Tap, click or press Space to flap. 🥉 10 · 🥈 20 · 🥇 30 · 💎 40</p>
 </div>
}

function draw(c:HTMLCanvasElement|null,f:Flight,phase:'ready'|'fly'|'down',t:number,kono:HTMLImageElement|null){
 const g=c?.getContext('2d');if(!c||!g)return
 g.setTransform(2,0,0,2,0,0);g.imageSmoothingEnabled=true
 const W=FLAP.w,G=FLAP.ground,scroll=phase==='down'?f.frames*FLAP.speed:(phase==='ready'?t:f.frames)*FLAP.speed
 const wrap=(x:number,span:number)=>((x%span)+span)%span
 // KONO's dawn: a sky that warms toward the horizon, the sun's glow, far mountains, glowing clouds and green
 // hills, each sliding slower the farther away it is.
 const sky=g.createLinearGradient(0,0,0,G);sky.addColorStop(0,'#5fb4ff');sky.addColorStop(0.55,'#a9d8ff');sky.addColorStop(1,'#ffd9e6')
 g.fillStyle=sky;g.fillRect(0,0,W,G)
 const sun=g.createRadialGradient(W*0.78,G*0.22,6,W*0.78,G*0.22,120);sun.addColorStop(0,'rgba(255,248,214,1)');sun.addColorStop(0.18,'rgba(255,236,170,.85)');sun.addColorStop(1,'rgba(255,220,180,0)')
 g.fillStyle=sun;g.fillRect(0,0,W,G)
 const ridge=(speed:number,base:number,amp:number,len:number,col:string)=>{const off=scroll*speed;g.fillStyle=col;g.beginPath();g.moveTo(0,G);for(let x=0;x<=W;x+=6){const u=(x+off)/len;g.lineTo(x,base-Math.abs(Math.sin(u*Math.PI))*amp-Math.sin(u*2.3)*amp*0.25)}g.lineTo(W,G);g.closePath();g.fill()}
 ridge(0.06,G-70,70,140,'rgba(150,140,220,.55)')
 ridge(0.12,G-48,52,110,'rgba(110,150,210,.6)')
 g.save();g.shadowColor='rgba(255,255,255,.95)';g.shadowBlur=14;g.fillStyle='rgba(255,255,255,.92)'
 for(let k=-1;k<7;k++){const x=wrap(k*70-scroll*0.18,W+70)-35,y=40+((k*37)%3)*26;for(const [dx,dy,r] of [[0,6,11],[12,0,15],[27,5,11],[14,8,12]]){g.beginPath();g.arc(x+dx,y+dy,r,0,7);g.fill()}}
 g.restore()
 ridge(0.4,G-14,26,80,'#7fd38a')
 g.fillStyle='#5fbd72';for(let k=-1;k<14;k++){const x=wrap(k*26-scroll*0.4,W+26)-13,y=G-18-Math.abs(Math.sin((x+scroll*0.4)/80*Math.PI))*20;g.beginPath();g.arc(x,y,6,0,7);g.arc(x+5,y-4,5,0,7);g.fill()}
 // The gaps are between jade bamboo stalks: shaded round, a ring at every node, leaves at the open end.
 const stalk=(x:number,y0:number,y1:number)=>{
  if(y1<=y0)return
  const w=FLAP.pipeW,body=g.createLinearGradient(x,0,x+w,0);body.addColorStop(0,'#2f8f5b');body.addColorStop(0.3,'#8fe0a6');body.addColorStop(0.55,'#5cc283');body.addColorStop(1,'#237049')
  g.fillStyle=body;g.fillRect(x+3,y0,w-6,y1-y0)
  g.fillStyle='rgba(20,70,40,.45)';const first=y0+((34-((y0%34)+34)%34)%34)
  for(let y=first;y<y1;y+=34){g.fillRect(x+3,y,w-6,3);g.fillStyle='rgba(220,255,225,.35)';g.fillRect(x+3,y+3,w-6,1.5);g.fillStyle='rgba(20,70,40,.45)'}
 }
 const end=(x:number,y:number,up:boolean)=>{
  const w=FLAP.pipeW,rim=g.createLinearGradient(x,0,x+w,0);rim.addColorStop(0,'#2a8253');rim.addColorStop(0.35,'#a6ecb8');rim.addColorStop(1,'#1f6642')
  g.fillStyle=rim;g.beginPath();g.roundRect(x-2,y,w+4,24,8);g.fill()
  g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x+6,y+4,4,16)
  g.fillStyle='#46b06a';const ly=up?y+2:y+22
  for(const [dx,ang] of [[-2,-0.9],[w+2,0.9]] as const){g.save();g.translate(x+dx,ly);g.rotate(up?ang:-ang);g.beginPath();g.ellipse(0,0,11,4,0,0,7);g.fill();g.restore()}
 }
 for(const p of f.pipes){const x=Math.round(p.x),top=Math.round(p.gapY-FLAP.gap/2),bottom=Math.round(p.gapY+FLAP.gap/2)
  stalk(x,0,top-24);end(x,top-24,false)
  stalk(x,bottom+24,G);end(x,bottom,true)
 }
 // Ground: a grassy edge with blades, then warm earth.
 const earth=g.createLinearGradient(0,G,0,FLAP.h);earth.addColorStop(0,'#6cc36a');earth.addColorStop(0.18,'#4f9e4e');earth.addColorStop(0.2,'#c99a62');earth.addColorStop(1,'#a8784a')
 g.fillStyle=earth;g.fillRect(0,G,W,FLAP.h-G)
 g.fillStyle='#8be07f';const sx=-(scroll%10)
 for(let x=sx-10;x<W+10;x+=10){g.beginPath();g.moveTo(x,G+2);g.quadraticCurveTo(x+3,G-7,x+6,G+2);g.fill()}
 g.fillStyle='rgba(255,255,255,.12)';for(let x=-(scroll%40)-40;x<W+40;x+=40)g.fillRect(x,G+22,18,3)
 // KONO: bobbing while you get ready; tilted by its speed in flight, a little wing, and a trail of sparkles.
 const y=phase==='ready'?f.y+Math.sin(t*0.12)*5:f.y,tilt=phase==='ready'?0:Math.max(-0.45,Math.min(1.4,f.vy*0.11))
 if(phase==='fly')for(let k=1;k<=5;k++){g.fillStyle='rgba(255,240,180,'+(0.5-k*0.08)+')';g.beginPath();g.arc(FLAP.x-k*9,y+Math.sin((t-k*3)*0.3)*2+k*1.2,4.5-k*0.6,0,7);g.fill()}
 g.save();g.translate(FLAP.x,y);g.rotate(tilt)
 g.fillStyle='rgba(0,0,0,.12)';g.beginPath();g.ellipse(2,18,14,4,0,0,7);g.fill()
 if(kono?.complete&&kono.naturalWidth)g.drawImage(kono,-20,-20,40,40)
 else{g.fillStyle='#ffd84d';g.beginPath();g.arc(0,0,FLAP.r,0,7);g.fill()}
 const flapAngle=phase==='down'?0.6:Math.sin(t*0.5)*0.7
 g.fillStyle='#fff';g.strokeStyle='rgba(120,90,110,.6)';g.lineWidth=1.2;g.beginPath();g.ellipse(-11,4,8,5,-0.3+flapAngle,0,7);g.fill();g.stroke()
 g.restore()
}
