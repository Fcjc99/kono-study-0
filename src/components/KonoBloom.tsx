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
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),kono=useRef<HTMLImageElement|null>(null),look=useRef(new Map<number,Look>())
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
   // How each thing moves on top of the physics: a merge pops in small, blooms past full size and settles;
   // a hard landing squashes it for a moment.
   const looks=look.current,seen=new Set<number>()
   for(const b of garden.current.balls){seen.add(b.id);let l=looks.get(b.id)
    if(!l){l={born:b.age>=30?0:-1,squash:0,vy:b.vy};looks.set(b.id,l)}
    if(l.born>=0)l.born+=n
    if(l.vy>0.9&&b.vy<l.vy*0.4)l.squash=Math.min(0.2,l.vy*0.09)
    l.squash=Math.max(0,l.squash-0.02*n);l.vy=b.vy}
   for(const id of looks.keys())if(!seen.has(id))looks.delete(id)
   draw(canvas.current,garden.current,aim.current,performance.now()<cool.current,kono.current,looks)
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',key)}
 },[])
 const aimAt=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();aim.current=(e.clientX-r.left)/r.width*JAR.w}
 return <div className="break-game kono-bloom">
  <div className="blast-top"><span className="blast-best">{best!==null?'Best '+best.toLocaleString():'KONO Bloom'}</span></div>
  <div className={'bloom-frame'+(hud.danger?' is-danger':'')}>
   {hud.danger&&<span className="bloom-warn" role="status">Too full! Get under the line</span>}
   <strong className="bloom-score" aria-live="polite">{hud.score.toLocaleString()}</strong>
   <canvas ref={canvas} width={JAR.w*S} height={JAR.h*S} role="img" aria-label={'KONO Bloom garden jar, '+hud.score+' points'}
    onPointerMove={aimAt} onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);aimAt(e)}} onPointerUp={e=>{aimAt(e);release()}}/>
  </div>
  <aside className="bloom-side">
   <p className="bloom-next" aria-label={'Next: '+LADDER[hud.next].name}><small>Next</small><span className="bloom-next-ball" style={{'--c':LADDER[hud.next].color} as React.CSSProperties} aria-hidden="true">{LADDER[hud.next].emoji}</span><b>{LADDER[hud.next].name}</b></p>
   <ol className="bloom-ladder" aria-label="The garden ladder: two the same grow into the next">{LADDER.map((t,i)=><li key={t.name} className={(i<=hud.best?'is-grown':'')+(i===hud.best&&hud.best>0?' is-best':'')} style={{'--c':t.color} as React.CSSProperties}><span aria-hidden="true">{t.emoji}</span><small>{t.name}</small></li>)}</ol>
  </aside>
  <p className="blast-help">Move to aim and let go to drop (or ← → and Space). Two the same grow into the next one. Keep the jar under the dashed line!</p>
 </div>
}

type Look={born:number;squash:number;vy:number}
/** Where a drop at `x` would come to rest first: on the floor, or on top of whatever's under it. */
function landing(g:Garden,x:number,tier:number){
 const r=RADIUS[tier];let y=JAR.h-r
 for(const b of g.balls){const R=RADIUS[b.tier]+r,dx=Math.abs(b.x-x);if(dx<R){const top=b.y-Math.sqrt(R*R-dx*dx);if(top<y)y=top}}
 return Math.max(JAR.dropY,y)
}
function draw(c:HTMLCanvasElement|null,g:Garden,aim:number,cooling:boolean,kono:HTMLImageElement|null,looks:Map<number,Look>){
 const x=c?.getContext('2d');if(!c||!x)return
 x.clearRect(0,0,c.width,c.height)
 // The jar: soft glass with soil at the bottom.
 const glass=x.createLinearGradient(0,0,0,c.height);glass.addColorStop(0,'#eaf7ff');glass.addColorStop(1,'#d8f0dc')
 x.fillStyle=glass;x.fillRect(0,0,c.width,c.height)
 x.fillStyle='#b98a5e';x.fillRect(0,c.height-10,c.width,10)
 // The line not to fill past: a clear dashed red line with its label, and the space above it tinted red,
 // more strongly the longer something sits over it.
 const warn=Math.min(1,g.danger/120),pulse=g.danger>30?0.5+0.5*Math.sin(g.frame/5):0
 x.fillStyle='rgba(255,90,100,'+(0.06+warn*0.22)+')';x.fillRect(0,0,c.width,JAR.line*S)
 x.save();x.setLineDash([16,10]);x.lineWidth=6;x.strokeStyle='rgba(214,48,68,'+(0.75+pulse*0.25)+')'
 x.beginPath();x.moveTo(0,JAR.line*S);x.lineTo(c.width,JAR.line*S);x.stroke();x.restore()
 x.font='800 18px system-ui';x.textAlign='left';x.textBaseline='top';x.fillStyle='rgba(176,30,52,.8)';x.fillText('keep below the line',12,JAR.line*S+8)
 // KONO holding the next one, and where it'll fall.
 const tier=g.next,ax=clampX(aim,tier)*S
 if(!g.over){
  // Where it'll go: a guide straight down to where it'll first land, and its outline there.
  const ly=landing(g,ax/S,tier)*S,r=RADIUS[tier]*S
  x.save();x.strokeStyle='rgba(70,60,110,.5)';x.lineWidth=3;x.setLineDash([8,8]);x.beginPath();x.moveTo(ax,JAR.dropY*S+14+r);x.lineTo(ax,ly-r);x.stroke()
  x.setLineDash([10,8]);x.lineWidth=3;x.strokeStyle=LADDER[tier].color;x.fillStyle='rgba(255,255,255,.35)';x.beginPath();x.arc(ax,ly,r,0,Math.PI*2);x.fill();x.stroke();x.restore()
  if(kono?.complete&&kono.naturalWidth)x.drawImage(kono,ax-34,0,68,68*kono.naturalHeight/kono.naturalWidth)
  if(!cooling)ball(x,ax,JAR.dropY*S+14,tier,0.95)
 }
 for(const b of g.balls){const l=looks.get(b.id),t=l&&l.born>=0?l.born:99
  // Bloom: small, past full size, back (a damped spring); squash: wider and shorter for a moment.
  const grow=t<60?1-0.45*Math.exp(-t/9)*Math.cos(t/3.4):1,sq=l?.squash??0
  ball(x,b.x*S,b.y*S,b.tier,1,grow*(1+sq),grow*(1-sq))}
 // Growing pops: a ring of petals.
 for(const p of g.pops){const t=(g.frame-p.at)/40;if(t<0||t>1)continue
  const r=(RADIUS[Math.min(p.tier,RADIUS.length-1)]+t*14)*S
  x.save();x.globalAlpha=1-t;x.strokeStyle=p.tier>=LADDER.length?'#ff6fd8':LADDER[p.tier].color;x.lineWidth=6*(1-t)+1
  x.beginPath();x.arc(p.x*S,p.y*S,r,0,Math.PI*2);x.stroke()
  for(let k=0;k<8;k++){const a=k/8*Math.PI*2+t;x.fillStyle=x.strokeStyle;x.beginPath();x.arc(p.x*S+Math.cos(a)*r,p.y*S+Math.sin(a)*r,6*(1-t)+2,0,Math.PI*2);x.fill()}
  if(p.tier>=LADDER.length){x.font='bold 64px system-ui';x.textAlign='center';x.fillText('🌈',p.x*S,p.y*S)}
  x.restore()}
}
function ball(x:CanvasRenderingContext2D,cx:number,cy:number,tier:number,alpha:number,sx=1,sy=1){
 const r=RADIUS[tier]*S,t=LADDER[tier]
 x.save();x.globalAlpha=alpha
 // Scaled about its bottom, so a squash sits on what it landed on.
 if(sx!==1||sy!==1){x.translate(cx,cy+r);x.scale(sx,sy);x.translate(-cx,-(cy+r))}
 const grad=x.createRadialGradient(cx-r*.35,cy-r*.4,r*.1,cx,cy,r);grad.addColorStop(0,'#fff');grad.addColorStop(.35,t.color);grad.addColorStop(1,shade(t.color))
 x.fillStyle=grad;x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fill()
 x.lineWidth=3;x.strokeStyle='rgba(60,40,70,.25)';x.stroke()
 x.font=Math.round(r*1.15)+'px system-ui,"Apple Color Emoji","Noto Color Emoji"';x.textAlign='center';x.textBaseline='middle';x.fillText(t.emoji,cx,cy+r*.06)
 x.restore()
}
const shade=(hex:string)=>{const n=parseInt(hex.slice(1),16),f=(v:number)=>Math.round(v*.72);return 'rgb('+f(n>>16)+','+f(n>>8&255)+','+f(n&255)+')'}
