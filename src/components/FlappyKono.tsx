import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {FLAP,flap,flapMedal,newFlight,step,type Flight} from '../store/flappy'
import {gameSound} from '../konoSounds'
import {fx,startMusic,stopMusic} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

/** Flappy KONO (the rules are in store/flappy): tap, click or press Space to flap. KONO tilts up as it
 * flaps and noses down as it falls, through jewel pipes, over a night sky with twinkling stars, drifting
 * clouds and hills that slide slower than the ground (parallax). "Get ready" waits for the first tap;
 * a hit flashes the screen, KONO drops, and the run ends with its medal. A chiptune soundtrack plays from the
 * first flap, with a whoosh for each flap and a ding for each pipe. */
const JEWELS=[['#ef4b5c','#ff8a96','#b52b3b'],['#f7922f','#ffc078','#c4650f'],['#f6cf33','#fff08a','#c79c0c'],['#46c35a','#8eeb98','#258f37'],['#2fc2e8','#8ae6ff','#1888ad'],['#3e6fe6','#86a8ff','#2346b0'],['#a35be0','#d1a2ff','#7134ad']]
const STARS=Array.from({length:46},(_,k)=>({x:(k*73)%FLAP.w,y:(k*131)%(FLAP.ground-120),r:k%5===0?1.6:1,tw:k*0.7}))
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
  <div className="blast-top"><span className="blast-best">{best!==null?'Best '+best:'Flappy KONO'}</span><span className="blast-coins">{medal?medal.emoji+' '+medal.name:''}</span></div>
  <div className="flappy-frame" onPointerDown={e=>{e.preventDefault();press()}}>
   <canvas ref={canvas} width={FLAP.w*2} height={FLAP.h*2} role="img" aria-label={'Flappy KONO, score '+score}/>
   <strong key={score} className="flappy-score" aria-live="polite">{score}</strong>
   {stage==='ready'&&<p className="flappy-ready"><b>Get ready!</b><span>Tap to flap</span></p>}
   {flash>0&&<span key={flash} className="flappy-flash" aria-hidden="true"/>}
  </div>
  <p className="blast-help">Tap, click or press Space to flap. 🥉 10 · 🥈 20 · 🥇 30 · 💎 40</p>
 </div>
}

function draw(c:HTMLCanvasElement|null,f:Flight,phase:'ready'|'fly'|'down',t:number,kono:HTMLImageElement|null){
 const g=c?.getContext('2d');if(!c||!g)return
 g.setTransform(2,0,0,2,0,0)
 const W=FLAP.w,G=FLAP.ground,scroll=phase==='down'?f.frames*FLAP.speed:(phase==='ready'?t:f.frames)*FLAP.speed
 // Night sky, stars, moon.
 const sky=g.createLinearGradient(0,0,0,G);sky.addColorStop(0,'#16205a');sky.addColorStop(0.6,'#3a3f9a');sky.addColorStop(1,'#7a63c9');g.fillStyle=sky;g.fillRect(0,0,W,G)
 for(const s of STARS){g.globalAlpha=0.45+0.55*Math.abs(Math.sin(t*0.03+s.tw));g.fillStyle='#fff';g.beginPath();g.arc((s.x-scroll*0.05+W*10)%W,s.y,s.r,0,7);g.fill()}
 g.globalAlpha=1;g.fillStyle='#fff6c8';g.beginPath();g.arc(W-58,70,20,0,7);g.fill();g.fillStyle='#3a3f9a';g.beginPath();g.arc(W-50,64,17,0,7);g.fill()
 // Clouds and two rows of hills, each slower than the ground.
 g.fillStyle='rgba(255,255,255,.14)'
 for(let k=0;k<4;k++){const x=((k*110-scroll*0.15)%(W+120)+W+120)%(W+120)-60,y=110+k*37%90;for(const [dx,dy,r] of [[0,0,16],[16,-6,20],[34,0,15]]){g.beginPath();g.arc(x+dx,y+dy,r,0,7);g.fill()}}
 const hills=(speed:number,base:number,amp:number,color:string)=>{g.fillStyle=color;g.beginPath();g.moveTo(0,G);for(let x=0;x<=W;x+=6)g.lineTo(x,base-amp*Math.abs(Math.sin((x+scroll*speed)/60)));g.lineTo(W,G);g.fill()}
 hills(0.25,G-40,46,'#2c2f7a');hills(0.5,G-14,30,'#232566')
 // Pipes: a jewel column with a lighter rim and a cap.
 for(const p of f.pipes){const [b,l,d]=JEWELS[p.color],top=p.gapY-FLAP.gap/2,bottom=p.gapY+FLAP.gap/2
  const body=g.createLinearGradient(p.x,0,p.x+FLAP.pipeW,0);body.addColorStop(0,l);body.addColorStop(0.35,b);body.addColorStop(1,d)
  g.fillStyle=body;g.fillRect(p.x+3,0,FLAP.pipeW-6,top-14);g.fillRect(p.x+3,bottom+14,FLAP.pipeW-6,G-bottom-14)
  g.fillRect(p.x-2,top-24,FLAP.pipeW+4,24);g.fillRect(p.x-2,bottom,FLAP.pipeW+4,24)
  g.fillStyle='rgba(255,255,255,.35)';g.fillRect(p.x+8,0,5,top-24);g.fillRect(p.x+8,bottom+24,5,G-bottom-24);g.fillRect(p.x+2,top-21,6,18);g.fillRect(p.x+2,bottom+3,6,18)
  g.fillStyle='rgba(0,0,0,.25)';g.fillRect(p.x-2,top-4,FLAP.pipeW+4,4);g.fillRect(p.x-2,bottom+20,FLAP.pipeW+4,4)
 }
 // Ground: a grassy strip with stripes that scroll at full speed.
 g.fillStyle='#4a3a8a';g.fillRect(0,G,W,FLAP.h-G);g.fillStyle='#46c35a';g.fillRect(0,G,W,10);g.fillStyle='#8eeb98';g.fillRect(0,G,W,3)
 g.fillStyle='rgba(255,255,255,.08)';for(let x=-(scroll%24);x<W;x+=24){g.beginPath();g.moveTo(x,G+10);g.lineTo(x+12,G+10);g.lineTo(x,FLAP.h);g.lineTo(x-12,FLAP.h);g.fill()}
 // KONO: bobbing while you get ready; tilted by its speed in flight.
 const y=phase==='ready'?f.y+Math.sin(t*0.12)*6:f.y,tilt=phase==='ready'?0:Math.max(-0.45,Math.min(1.3,f.vy*0.11))
 g.save();g.translate(FLAP.x,y);g.rotate(tilt)
 g.fillStyle='rgba(255,255,255,.25)';g.beginPath();g.ellipse(-6,2,9,5,-0.4+Math.sin(t*0.6)*0.5,0,7);g.fill()
 if(kono?.complete&&kono.naturalWidth)g.drawImage(kono,-20,-20,40,40)
 else{g.fillStyle='#ffd84d';g.beginPath();g.arc(0,0,FLAP.r,0,7);g.fill()}
 g.restore()
}
