import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {CHANCE_POCKETS,DISH,FIELD,busy,drop,isWinPocket,newCove,step,type Cove} from '../store/pusher'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

const W=720,H=1080 // canvas pixels (shown at half size)
const BOARD=300,FIELD_TOP=330,FIELD_BOTTOM=960
const depth=(y:number)=>y/FIELD.h
const sx=(x:number,y:number)=>W/2+(x-50)*(0.62+0.38*depth(y))*6.6
const sy=(y:number)=>FIELD_TOP+depth(y)*(FIELD_BOTTOM-FIELD_TOP)
const scale=(y:number)=>(0.62+0.38*depth(y))*6.6

/** KONO Medal Cove (rules in store/pusher): a medal pusher on KONO's dock. Touch or move over the field to
 * aim, tap to drop a medal (hold to keep dropping), or ← → and Space. The backboard shows the lottery reels,
 * the lighthouse's three step lamps and the jackpot; a ball lottery and the Jackpot Chance wheel open over
 * the field when they're on. */
export default function MedalCove({ref,best,sound,onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(medals:number,jackpots:number)=>void}){
 const [start]=useState<Cove>(()=>newCove())
 const cove=useRef<Cove>(start),canvas=useRef<HTMLCanvasElement>(null),aim=useRef(50),holding=useRef(false),lastDrop=useRef(0)
 const [hud,setHud]=useState({hand:start.hand,jp:start.jackpot,event:''})
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),quiet=useRef(0)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(cove.current.hand,cove.current.jpWins)}}),[])
 const dropOne=()=>{const c=cove.current;if(ended.current||c.hand<=0)return;cove.current=drop(c,aim.current);lastDrop.current=performance.now();fx('tick',soundRef.current)}
 const dropRef=useRef(dropOne)
 useEffect(()=>{dropRef.current=dropOne})
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.code==='ArrowLeft'||e.code==='KeyA'){aim.current=Math.max(4,aim.current-3);e.preventDefault()}
   else if(e.code==='ArrowRight'||e.code==='KeyD'){aim.current=Math.min(96,aim.current+3);e.preventDefault()}
   else if(e.code==='Space'){e.preventDefault();dropRef.current()}
  }
  window.addEventListener('keydown',key)
  let raf=0,last=performance.now(),acc=0
  const loop=(now:number)=>{
   acc+=Math.min(100,now-last);last=now
   // The machine runs at a steady 60 steps a second, whatever the screen's rate.
   while(acc>=1000/60){
    const before=cove.current
    let c=step(before)
    if(holding.current&&now-lastDrop.current>200&&c.hand>0){c=drop(c,aim.current);lastDrop.current=now}
    cove.current=c;acc-=1000/60
    if(c.won>before.won)fx('ding',soundRef.current)
    if(c.events.length&&c.events[c.events.length-1]!==before.events[before.events.length-1]){const t=c.events[c.events.length-1].text;setHud(h=>({...h,event:t}));if(/JACKPOT!/.test(t)){fx('mega',soundRef.current);gameSound('win',soundRef.current)}else if(/CHANCE|tower|shower|ball/i.test(t))fx('fanfare',soundRef.current)}
    if(c.spinning&&!before.spinning)fx('charge',soundRef.current)
   }
   const c=cove.current
   setHud(h=>h.hand===c.hand&&h.jp===c.jackpot?h:{...h,hand:c.hand,jp:c.jackpot})
   // Out of medals with nothing left going on for a few seconds: the round's over.
   if(c.hand<=0&&!busy(c)){quiet.current+=1;if(quiet.current>240&&!ended.current){ended.current=true;onEndRef.current(c.hand,c.jpWins)}}else quiet.current=0
   draw(canvas.current,c,aim.current)
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',key)}
 },[])
 useEffect(()=>{if(!hud.event)return;const t=window.setTimeout(()=>setHud(h=>({...h,event:''})),2200);return()=>window.clearTimeout(t)},[hud.event])
 // Aim: where you touch across the field, at the drop line just in front of the pusher.
 const aimAt=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*W;aim.current=Math.max(4,Math.min(96,50+(px-W/2)/scale(cove.current.pusher+FIELD.r)))}
 return <div className="break-game medal-cove">
  <div className="blast-top"><span className="blast-best">{best!==null?'Best '+best:'KONO Medal Cove'}</span><span className="blast-coins">🪙 {hud.hand}</span></div>
  <div className="cove-frame">
   <canvas ref={canvas} width={W} height={H} role="img" aria-label={'KONO Medal Cove: '+hud.hand+' medals, jackpot '+hud.jp}
    onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);aimAt(e);holding.current=true;dropOne()}} onPointerMove={aimAt} onPointerUp={()=>{holding.current=false}} onPointerCancel={()=>{holding.current=false}}/>
   {hud.event&&<p key={hud.event} className="cove-event" role="status">{hud.event}</p>}
  </div>
  <p className="blast-help">Aim along the dock and tap to drop a medal (hold to keep dropping). Through the lantern on the pusher, it spins the lottery. Push prize balls off the edge for the ball lottery and a Jackpot Chance!</p>
 </div>
}

// ---- Drawing ----
function medal(g:CanvasRenderingContext2D,x:number,y:number,ball=false){
 const s=scale(y),r=(ball?FIELD.ball:FIELD.r)*s,cx=sx(x,y),cy=sy(y)
 if(ball){const grad=g.createRadialGradient(cx-r*.35,cy-r*.9,r*.15,cx,cy-r*.5,r);grad.addColorStop(0,'#fff');grad.addColorStop(.4,'#b48cff');grad.addColorStop(1,'#5a2fb0')
  g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(cx,cy+r*.15,r,r*.4,0,0,Math.PI*2);g.fill()
  g.fillStyle=grad;g.beginPath();g.arc(cx,cy-r*.5,r,0,Math.PI*2);g.fill();return}
 g.fillStyle='#a0700f';g.beginPath();g.ellipse(cx,cy+r*.16,r,r*.55,0,0,Math.PI*2);g.fill()
 const grad=g.createLinearGradient(cx-r,cy-r,cx+r,cy+r);grad.addColorStop(0,'#fff1a6');grad.addColorStop(.5,'#f2c230');grad.addColorStop(1,'#c99012')
 g.fillStyle=grad;g.beginPath();g.ellipse(cx,cy,r,r*.55,0,0,Math.PI*2);g.fill()
 g.strokeStyle='rgba(150,100,10,.6)';g.lineWidth=1.2;g.beginPath();g.ellipse(cx,cy,r*.66,r*.36,0,0,Math.PI*2);g.stroke()
}
const konoImg=typeof Image!=='undefined'?Object.assign(new Image(),{src:'/garden/kono/excited.webp'}):null
function draw(c:HTMLCanvasElement|null,cove:Cove,aim:number){
 const g=c?.getContext('2d');if(!c||!g)return
 const f=cove.frame
 // Sky and sea behind the cabinet.
 const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#7fd0ff');bg.addColorStop(.3,'#2f8fd8');bg.addColorStop(1,'#14467a');g.fillStyle=bg;g.fillRect(0,0,W,H)
 // The backboard: the reels, the lighthouse's lamps and the jackpot.
 g.fillStyle='#3a2316';round(g,24,16,W-48,BOARD-20,26);g.fill()
 g.fillStyle='#5b3a24';round(g,36,28,W-72,BOARD-44,20);g.fill()
 g.fillStyle='#ffe9a8';g.font='bold 30px system-ui';g.textAlign='center';g.fillText('JACKPOT',W/2,72)
 g.fillStyle='#fff';g.font='bold 54px system-ui';g.fillText(String(cove.jackpot),W/2,128)
 // Reels
 const spin=cove.spinning,reelY=158,reelW=110
 for(let i=0;i<3;i++){const x=W/2-reelW*1.5-12+i*(reelW+12)
  g.fillStyle='#fffaf0';round(g,x,reelY,reelW,96,14);g.fill()
  const stopAt=40+i*25,face=spin?(f-spin.at<stopAt?['🪙','🗼','🔮','⭐','🐚','🌺'][Math.floor((f+i*3)/3)%6]:spin.reels[i]):'🌺'
  g.font='62px system-ui,"Apple Color Emoji","Noto Color Emoji"';g.fillText(face,x+reelW/2,reelY+72)}
 if(cove.queue>0){g.fillStyle='#ffd34d';for(let i=0;i<cove.queue;i++){g.beginPath();g.arc(W/2-36+i*24,272,8,0,Math.PI*2);g.fill()}}
 // The lighthouse with its three step lamps, and the Jackpot Chance's winning pockets.
 for(let i=0;i<3;i++){g.fillStyle=i<cove.steps?'#ffe14d':'#6d5440';g.beginPath();g.arc(70,90+i*44,15,0,Math.PI*2);g.fill();if(i<cove.steps){g.fillStyle='rgba(255,225,77,.35)';g.beginPath();g.arc(70,90+i*44,26,0,Math.PI*2);g.fill()}}
 g.font='22px system-ui';g.fillStyle='#ffe9a8';g.fillText('⭐ steps',70,240)
 g.fillText('🎯 '+cove.winPockets+'/'+CHANCE_POCKETS,W-80,240)
 // KONO cheering on the board, bouncing when something's going on.
 if(konoImg?.complete&&konoImg.naturalWidth){const b=cove.spinning||cove.dish||cove.chance?Math.abs(Math.sin(f/6))*10:0;g.drawImage(konoImg,W-122,58-b,84,84*konoImg.naturalHeight/konoImg.naturalWidth)}
 // The field: a wooden dock deck in perspective, with side rails and the front edge.
 g.fillStyle='#c79a63';g.beginPath();g.moveTo(sx(0,0),sy(0));g.lineTo(sx(100,0),sy(0));g.lineTo(sx(100,FIELD.h),sy(FIELD.h));g.lineTo(sx(0,FIELD.h),sy(FIELD.h));g.closePath();g.fill()
 g.strokeStyle='rgba(120,80,40,.35)';g.lineWidth=2;for(let x=10;x<100;x+=10){g.beginPath();g.moveTo(sx(x,0),sy(0));g.lineTo(sx(x,FIELD.h),sy(FIELD.h));g.stroke()}
 // The side drops near the front (lost medals go there).
 g.fillStyle='#1d3a5c';for(const x of [0,100]){g.beginPath();g.moveTo(sx(x,FIELD.h-16),sy(FIELD.h-16));g.lineTo(sx(x+(x?-4:4),FIELD.h-16),sy(FIELD.h-16));g.lineTo(sx(x+(x?-4:4),FIELD.h),sy(FIELD.h));g.lineTo(sx(x,FIELD.h),sy(FIELD.h));g.closePath();g.fill()}
 // Medals, back to front.
 const list=[...cove.medals].sort((a,b)=>a.y-b.y)
 for(const m of list)medal(g,m.x,m.y,m.ball)
 // The pusher: a painted board sliding in and out, with the lantern hole on its face.
 const p=cove.pusher
 g.fillStyle='#e8f4ff';g.beginPath();g.moveTo(sx(0,0),sy(0)-40);g.lineTo(sx(100,0),sy(0)-40);g.lineTo(sx(100,p),sy(p));g.lineTo(sx(0,p),sy(p));g.closePath();g.fill()
 g.fillStyle='#2f6fb3';g.fillRect(sx(0,p),sy(p)-26,sx(100,p)-sx(0,p),26)
 const hx=sx(cove.checker,p),hw=FIELD.checkerW*scale(p)
 g.fillStyle='#ffcf3d';round(g,hx-hw/2,sy(p)-24,hw,22,8);g.fill();g.fillStyle='#7a3b00';g.font='16px system-ui';g.fillText('🏮',hx,sy(p)-7)
 // Where the next medal goes.
 const ax=sx(aim,p+FIELD.r)
 g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=3;g.setLineDash([8,8]);g.beginPath();g.moveTo(ax,sy(0)-40);g.lineTo(ax,sy(p)-26);g.stroke();g.setLineDash([])
 g.fillStyle='#f2c230';g.beginPath();g.ellipse(ax,sy(0)-50,18,10,0,0,Math.PI*2);g.fill()
 // Towers about to tip.
 for(const t of cove.towers){const tx=sx(t.x,p+12),ty=sy(p+12),k=Math.min(1,(f-t.at)/40)
  for(let i=0;i<Math.round(t.n*k);i++){g.fillStyle=i%2?'#f2c230':'#e0a91c';g.beginPath();g.ellipse(tx,ty-i*5,20,9,0,0,Math.PI*2);g.fill()}}
 // The tray at the front.
 g.fillStyle='#3a2316';g.fillRect(0,FIELD_BOTTOM+10,W,H-FIELD_BOTTOM-10)
 g.fillStyle='#ffe9a8';g.font='bold 34px system-ui';g.fillText('🪙 '+cove.hand+'   ·   won '+cove.won,W/2,H-40)
 // The ball lottery: a dish with eight pockets; the ball circles and settles.
 if(cove.dish)dish(g,cove,f)
 if(cove.chance)chance(g,cove,f)
}
function dish(g:CanvasRenderingContext2D,cove:Cove,f:number){
 const d=cove.dish!,t=Math.min(1,(f-d.at)/170),cx=W/2,cy=640,R=230
 g.fillStyle='rgba(10,20,40,.55)';g.fillRect(0,BOARD,W,FIELD_BOTTOM-BOARD)
 g.fillStyle='#fff6e0';g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.fill()
 g.fillStyle='#e8d5b0';g.beginPath();g.arc(cx,cy,R*.55,0,Math.PI*2);g.fill()
 DISH.forEach((p,i)=>{const a=i/DISH.length*Math.PI*2-Math.PI/2,px=cx+Math.cos(a)*R*.78,py=cy+Math.sin(a)*R*.78
  g.fillStyle=p.prize.kind==='chance'?'#ff5a7a':p.prize.kind==='tower'?'#ffb347':'#7fd0ff';g.beginPath();g.arc(px,py,38,0,Math.PI*2);g.fill()
  g.fillStyle='#2b1a3a';g.font='bold '+(p.label.length>5?17:24)+'px system-ui';g.textAlign='center';g.fillText(p.label,px,py+7)})
 // The ball spirals in and slows down into its pocket.
 const target=d.pocket/DISH.length*Math.PI*2-Math.PI/2,turns=4*(1-(1-t)**2),a=target-Math.PI*2*4+turns*Math.PI*2,rr=R*(0.95-0.17*t)
 g.fillStyle='#b48cff';g.beginPath();g.arc(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,20,0,Math.PI*2);g.fill()
 g.fillStyle='#fff';g.font='bold 30px system-ui';g.fillText('BALL LOTTERY',cx,cy+10)
}
function chance(g:CanvasRenderingContext2D,cove:Cove,f:number){
 const d=cove.chance!,t=Math.min(1,(f-d.at)/200),cx=W/2,cy=640,R=260
 g.fillStyle='rgba(10,10,30,.7)';g.fillRect(0,BOARD,W,FIELD_BOTTOM-BOARD)
 const spin=-(1-(1-t)**3)*Math.PI*2*5-d.pocket/CHANCE_POCKETS*Math.PI*2
 for(let i=0;i<CHANCE_POCKETS;i++){const a0=spin+i/CHANCE_POCKETS*Math.PI*2-Math.PI/2-Math.PI/CHANCE_POCKETS,a1=a0+Math.PI*2/CHANCE_POCKETS,win=isWinPocket(i,cove.winPockets)
  g.fillStyle=win?'#ffd34d':i%2?'#6a4bc4':'#8a6ae0';g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,R,a0,a1);g.closePath();g.fill()
  const am=(a0+a1)/2;g.fillStyle=win?'#5a3200':'#fff';g.font='bold 22px system-ui';g.textAlign='center';g.fillText(win?'JP':'+10',cx+Math.cos(am)*R*.72,cy+Math.sin(am)*R*.72+8)}
 g.fillStyle='#fff';g.beginPath();g.moveTo(cx-18,cy-R-20);g.lineTo(cx+18,cy-R-20);g.lineTo(cx,cy-R+18);g.closePath();g.fill()
 g.fillStyle='#2b1a3a';g.beginPath();g.arc(cx,cy,70,0,Math.PI*2);g.fill();g.fillStyle='#ffd34d';g.font='bold 26px system-ui';g.fillText('JACKPOT',cx,cy-4);g.fillText('CHANCE',cx,cy+26)
}
function round(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
