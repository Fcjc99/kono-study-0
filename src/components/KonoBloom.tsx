import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {JAR,LADDER,RADIUS,clampX,drop,newGarden,step,type Garden} from '../store/bloom'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

const S=4 // canvas pixels per jar unit
/** KONO Bloom (rules in store/bloom): KONO holds the next seed over the garden jar; move (or drag) to aim
 * and let go (or tap, or press Space) to drop it. Things that grow pop with a ring of petals; the jar glows
 * red at the dashed line when it's getting too full. The garden ladder shows along the bottom, the ones
 * you've grown lit up. */
export default function KonoBloom({ref,best,sound,onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(score:number,biggest:number)=>void}){
 const [start]=useState<Garden>(()=>newGarden())
 const canvas=useRef<HTMLCanvasElement>(null),garden=useRef<Garden>(start),aim=useRef(50),cool=useRef(0)
 const [hud,setHud]=useState({score:0,next:start.next,best:0,danger:false})
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),kono=useRef<HTMLImageElement|null>(null)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(garden.current.score,garden.current.best)}}),[])
 const release=()=>{
  if(ended.current||garden.current.over||performance.now()<cool.current)return
  garden.current=drop(garden.current,aim.current);cool.current=performance.now()+420;fx('tick',soundRef.current)
 }
 const releaseRef=useRef(release)
 useEffect(()=>{releaseRef.current=release})
 useEffect(()=>{
  const img=new Image();img.src='/garden/kono/happy.webp';kono.current=img
  const key=(e:KeyboardEvent)=>{
   if(e.code==='ArrowLeft'||e.code==='KeyA'){aim.current=Math.max(0,aim.current-4);e.preventDefault()}
   else if(e.code==='ArrowRight'||e.code==='KeyD'){aim.current=Math.min(JAR.w,aim.current+4);e.preventDefault()}
   else if(e.code==='Space'||e.code==='ArrowDown'){e.preventDefault();releaseRef.current()}
  }
  window.addEventListener('keydown',key)
  let raf=0,last=performance.now(),seenPops=0
  const loop=(now:number)=>{
   const n=Math.min(2,(now-last)/(1000/60));last=now
   if(!ended.current){
    const before=garden.current
    garden.current=step(before,n)
    const g=garden.current
    if(g.pops.length&&g.pops[g.pops.length-1].at>=seenPops&&g.score!==before.score){seenPops=g.frame;fx(g.pops[g.pops.length-1].tier>=8?'mega':'match',soundRef.current,Math.min(8,g.pops[g.pops.length-1].tier))}
    if(g.score!==before.score||g.next!==before.next||(g.danger>30)!==(before.danger>30))setHud({score:g.score,next:g.next,best:g.best,danger:g.danger>30})
    if(g.over&&!ended.current){ended.current=true;gameSound('lose',soundRef.current);window.setTimeout(()=>onEndRef.current(g.score,g.best),1000)}
   }
   draw(canvas.current,garden.current,aim.current,performance.now()<cool.current,kono.current)
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',key)}
 },[])
 const aimAt=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();aim.current=(e.clientX-r.left)/r.width*JAR.w}
 return <div className="break-game kono-bloom">
  <div className="blast-top"><span className="blast-best">{best!==null?'Best '+best.toLocaleString():'KONO Bloom'}</span><span className="blast-coins">Next {LADDER[hud.next].emoji}</span></div>
  <div className={'bloom-frame'+(hud.danger?' is-danger':'')}>
   <strong className="bloom-score" aria-live="polite">{hud.score.toLocaleString()}</strong>
   <canvas ref={canvas} width={JAR.w*S} height={JAR.h*S} role="img" aria-label={'KONO Bloom garden jar, '+hud.score+' points'}
    onPointerMove={aimAt} onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);aimAt(e)}} onPointerUp={e=>{aimAt(e);release()}}/>
  </div>
  <ol className="bloom-ladder" aria-label="The garden ladder">{LADDER.map((t,i)=><li key={t.name} className={i<=Math.max(hud.best,4)?'is-seen':undefined} title={t.name}><span aria-hidden="true">{t.emoji}</span><span className="sr-only">{t.name}</span></li>)}</ol>
  <p className="blast-help">Move to aim and let go to drop (or ← → and Space). Two the same grow into the next one. Keep the jar under the dashed line!</p>
 </div>
}

function draw(c:HTMLCanvasElement|null,g:Garden,aim:number,cooling:boolean,kono:HTMLImageElement|null){
 const x=c?.getContext('2d');if(!c||!x)return
 x.clearRect(0,0,c.width,c.height)
 // The jar: soft glass with soil at the bottom.
 const glass=x.createLinearGradient(0,0,0,c.height);glass.addColorStop(0,'#eaf7ff');glass.addColorStop(1,'#d8f0dc')
 x.fillStyle=glass;x.fillRect(0,0,c.width,c.height)
 x.fillStyle='#b98a5e';x.fillRect(0,c.height-10,c.width,10)
 // The line not to fill past.
 x.save();x.setLineDash([12,10]);x.lineWidth=4;x.strokeStyle=g.danger>30?'rgba(230,60,70,'+(0.5+0.5*Math.sin(g.frame/5))+')':'rgba(120,90,140,.45)'
 x.beginPath();x.moveTo(0,JAR.line*S);x.lineTo(c.width,JAR.line*S);x.stroke();x.restore()
 // KONO holding the next one, and where it'll fall.
 const tier=g.next,ax=clampX(aim,tier)*S
 if(!g.over){
  x.save();x.strokeStyle='rgba(120,90,140,.25)';x.lineWidth=3;x.setLineDash([6,8]);x.beginPath();x.moveTo(ax,JAR.dropY*S);x.lineTo(ax,c.height);x.stroke();x.restore()
  if(kono?.complete&&kono.naturalWidth)x.drawImage(kono,ax-34,0,68,68*kono.naturalHeight/kono.naturalWidth)
  if(!cooling)ball(x,ax,JAR.dropY*S+14,tier,0.95)
 }
 for(const b of g.balls)ball(x,b.x*S,b.y*S,b.tier,1)
 // Growing pops: a ring of petals.
 for(const p of g.pops){const t=(g.frame-p.at)/40;if(t<0||t>1)continue
  const r=(RADIUS[Math.min(p.tier,RADIUS.length-1)]+t*14)*S
  x.save();x.globalAlpha=1-t;x.strokeStyle=p.tier>=LADDER.length?'#ff6fd8':LADDER[p.tier].color;x.lineWidth=6*(1-t)+1
  x.beginPath();x.arc(p.x*S,p.y*S,r,0,Math.PI*2);x.stroke()
  for(let k=0;k<8;k++){const a=k/8*Math.PI*2+t;x.fillStyle=x.strokeStyle;x.beginPath();x.arc(p.x*S+Math.cos(a)*r,p.y*S+Math.sin(a)*r,6*(1-t)+2,0,Math.PI*2);x.fill()}
  if(p.tier>=LADDER.length){x.font='bold 64px system-ui';x.textAlign='center';x.fillText('🌈',p.x*S,p.y*S)}
  x.restore()}
}
function ball(x:CanvasRenderingContext2D,cx:number,cy:number,tier:number,alpha:number){
 const r=RADIUS[tier]*S,t=LADDER[tier]
 x.save();x.globalAlpha=alpha
 const grad=x.createRadialGradient(cx-r*.35,cy-r*.4,r*.1,cx,cy,r);grad.addColorStop(0,'#fff');grad.addColorStop(.35,t.color);grad.addColorStop(1,shade(t.color))
 x.fillStyle=grad;x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fill()
 x.lineWidth=3;x.strokeStyle='rgba(60,40,70,.25)';x.stroke()
 x.font=Math.round(r*1.15)+'px system-ui,"Apple Color Emoji","Noto Color Emoji"';x.textAlign='center';x.textBaseline='middle';x.fillText(t.emoji,cx,cy+r*.06)
 x.restore()
}
const shade=(hex:string)=>{const n=parseInt(hex.slice(1),16),f=(v:number)=>Math.round(v*.72);return 'rgb('+f(n>>16)+','+f(n>>8&255)+','+f(n&255)+')'}
