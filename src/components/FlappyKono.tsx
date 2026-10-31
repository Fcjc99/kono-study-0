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
  <div className="flappy-frame" onPointerDown={e=>{e.preventDefault();press()}}>
   <canvas ref={canvas} width={FLAP.w*2} height={FLAP.h*2} role="img" aria-label={'KONO Hop, score '+score}/>
   <strong key={score} className="flappy-score" aria-live="polite">{score}</strong>
   {stage==='ready'&&<p className="flappy-ready"><b>Get ready!</b><span>Tap to flap</span></p>}
   {flash>0&&<span key={flash} className="flappy-flash" aria-hidden="true"/>}
  </div>
  <p className="blast-help">Tap, click or press Space to flap. 🥉 10 · 🥈 20 · 🥇 30 · 💎 40</p>
 </div>
}

function draw(c:HTMLCanvasElement|null,f:Flight,phase:'ready'|'fly'|'down',t:number,kono:HTMLImageElement|null){
 const g=c?.getContext('2d');if(!c||!g)return
 g.setTransform(2,0,0,2,0,0);g.imageSmoothingEnabled=false
 const W=FLAP.w,G=FLAP.ground,scroll=phase==='down'?f.frames*FLAP.speed:(phase==='ready'?t:f.frames)*FLAP.speed
 const wrap=(x:number,span:number)=>((x%span)+span)%span
 // A sunny day: a flat sky-blue, a row of puffy clouds, a pale city skyline and green bushes, each
 // sliding slower than the ground.
 g.fillStyle='#4ec0ca';g.fillRect(0,0,W,G)
 const cloudY=G-118
 g.fillStyle='#e9fcd9'
 for(let k=-1;k<9;k++){const x=wrap(k*44-scroll*0.12,W+44)-22;for(const [dx,dy,r] of [[0,10,18],[18,2,22],[38,8,17]]){g.beginPath();g.arc(Math.round(x+dx),cloudY+dy,r,0,7);g.fill()}}
 g.fillRect(0,cloudY+12,W,G-cloudY)
 // The city: blocky towers with rows of windows.
 const towers=[[0,46,26],[24,30,22],[44,56,30],[72,38,20],[90,64,26],[114,34,24],[136,50,22],[156,28,18],[172,60,28],[198,42,24],[220,54,20],[238,36,26],[262,48,26]]
 const cityBase=G-26
 for(let rep=-1;rep<2;rep++){
  const off=Math.round(wrap(-scroll*0.25,288)+rep*288)
  for(const [x,h,w] of towers){
   const tx=off+x,ty=cityBase-h
   g.fillStyle='#a5e2c3';g.fillRect(tx,ty,w,h)
   g.fillStyle='#d0f1df';g.fillRect(tx,ty,w,3)
   g.fillStyle='#7fcbb0';for(let wy=ty+7;wy<cityBase-4;wy+=8)for(let wx=tx+4;wx<tx+w-4;wx+=7)g.fillRect(wx,wy,3,4)
  }
 }
 // Bushes along the bottom of the sky.
 g.fillStyle='#5ee270'
 for(let k=-1;k<12;k++){const x=Math.round(wrap(k*30-scroll*0.5,W+30)-15);g.beginPath();g.arc(x,cityBase+6,17,0,7);g.arc(x+16,cityBase+2,14,0,7);g.fill()}
 g.fillRect(0,cityBase+6,W,G-cityBase-6)
 g.fillStyle='#4ac95c';g.fillRect(0,G-6,W,6)
 // Pipes: bright green with a light stripe, a dark outline, and a wider cap at the open end.
 const OUT='#543847',BODY='#73bf2e',LIGHT='#9ce659',SHADE='#558022'
 const pipe=(x:number,y0:number,y1:number)=>{
  if(y1<=y0)return
  g.fillStyle=OUT;g.fillRect(x+2,y0,FLAP.pipeW-4,y1-y0)
  g.fillStyle=BODY;g.fillRect(x+4,y0,FLAP.pipeW-8,y1-y0)
  g.fillStyle=LIGHT;g.fillRect(x+8,y0,6,y1-y0);g.fillRect(x+16,y0,2,y1-y0)
  g.fillStyle=SHADE;g.fillRect(x+FLAP.pipeW-14,y0,8,y1-y0)
 }
 const cap=(x:number,y:number)=>{
  g.fillStyle=OUT;g.fillRect(x-3,y,FLAP.pipeW+6,24)
  g.fillStyle=BODY;g.fillRect(x-1,y+2,FLAP.pipeW+2,20)
  g.fillStyle=LIGHT;g.fillRect(x+3,y+2,6,20);g.fillRect(x+11,y+2,2,20)
  g.fillStyle=SHADE;g.fillRect(x+FLAP.pipeW-11,y+2,9,20)
  g.fillStyle='rgba(0,0,0,.12)';g.fillRect(x-1,y+18,FLAP.pipeW+2,4)
 }
 for(const p of f.pipes){const x=Math.round(p.x),top=Math.round(p.gapY-FLAP.gap/2),bottom=Math.round(p.gapY+FLAP.gap/2)
  pipe(x,0,top-24);cap(x,top-24)
  pipe(x,bottom+24,G);cap(x,bottom)
 }
 // Ground: the striped grass edge (sliding at full speed) over sandy earth.
 g.fillStyle=OUT;g.fillRect(0,G,W,2)
 g.fillStyle='#9be659';g.fillRect(0,G+2,W,12)
 g.fillStyle='#73bf2e';const sx=-Math.round(scroll%12)
 for(let x=sx-12;x<W+12;x+=12){g.beginPath();g.moveTo(x,G+14);g.lineTo(x+6,G+2);g.lineTo(x+12,G+2);g.lineTo(x+6,G+14);g.fill()}
 g.fillStyle='#5b8c2a';g.fillRect(0,G+14,W,2)
 g.fillStyle='#d7a84c';g.fillRect(0,G+16,W,3)
 g.fillStyle='#ded895';g.fillRect(0,G+19,W,FLAP.h-G-19)
 // KONO: bobbing while you get ready; tilted by its speed in flight, with a little wing that flaps.
 g.imageSmoothingEnabled=true
 const y=phase==='ready'?f.y+Math.sin(t*0.12)*5:f.y,tilt=phase==='ready'?0:Math.max(-0.45,Math.min(1.4,f.vy*0.11))
 g.save();g.translate(FLAP.x,y);g.rotate(tilt)
 if(kono?.complete&&kono.naturalWidth)g.drawImage(kono,-20,-20,40,40)
 else{g.fillStyle='#ffd84d';g.beginPath();g.arc(0,0,FLAP.r,0,7);g.fill()}
 const flapAngle=phase==='down'?0.6:Math.sin(t*0.5)*0.7
 g.fillStyle='#fff';g.strokeStyle=OUT;g.lineWidth=1.5;g.beginPath();g.ellipse(-11,4,8,5,-0.3+flapAngle,0,7);g.fill();g.stroke()
 g.restore()
}
