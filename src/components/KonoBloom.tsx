import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {JAR,LADDER,RADIUS,clampX,drop,newGarden,step,type Garden} from '../store/bloom'
import {gameSound} from '../konoSounds'
import {fx,startMusic,stopMusic} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'
import './bloom.css'

const S=4 // canvas pixels per jar unit
const STEP=1000/120 // physics runs in fixed small steps (smooth on 60 Hz and 120 Hz screens alike)
/** KONO Bloom (rules in store/bloom): KONO holds the next fruit over the jar; move (or drag) to aim and let
 * go (or tap, or press Space) to drop it. Two the same grow into the next fruit on the ladder, with a splash
 * of juice and the points floating up; quick growths in a row make a combo. The fruit have faces: they
 * blink, beam when they've just grown, and look worried when the jar's too full. The KONO playlist plays. */
export default function KonoBloom({ref,best,sound,onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(score:number,biggest:number)=>void}){
 const [start]=useState<Garden>(()=>newGarden())
 const canvas=useRef<HTMLCanvasElement>(null),garden=useRef<Garden>(start),aim=useRef(50),cool=useRef(0)
 const [hud,setHud]=useState({score:0,next:start.next,best:0,danger:false})
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),kono=useRef<{happy:HTMLImageElement;cheer:HTMLImageElement;gasp:HTMLImageElement}|null>(null),look=useRef(new Map<number,Look>())
 const shown=useRef(50) // where KONO is (it glides after your finger)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 // Its music: the KONO playlist ("Both tracks · alternating"); the music button turns it off.
 useEffect(()=>{startMusic('bloom',sound);return ()=>stopMusic()},[sound])
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(garden.current.score,garden.current.best)}}),[])
 const release=()=>{
  if(ended.current||garden.current.over||performance.now()<cool.current)return
  // It drops from where KONO is holding it (what you see), not where your finger has run ahead to.
  garden.current=drop(garden.current,shown.current);cool.current=performance.now()+380;fx('tick',soundRef.current)
 }
 const releaseRef=useRef(release)
 useEffect(()=>{releaseRef.current=release})
 useEffect(()=>{
  const img=(src:string)=>{const i=new Image();i.src=src;return i}
  kono.current={happy:img('/garden/kono/happy.webp'),cheer:img('/garden/kono/excited.webp'),gasp:img('/garden/kono/question.webp')}
  const held={left:false,right:false}
  const key=(e:KeyboardEvent,down:boolean)=>{
   if(e.code==='ArrowLeft'||e.code==='KeyA'){held.left=down;if(down)aim.current=Math.max(0,aim.current-3);e.preventDefault()}
   else if(e.code==='ArrowRight'||e.code==='KeyD'){held.right=down;if(down)aim.current=Math.min(JAR.w,aim.current+3);e.preventDefault()}
   else if(down&&(e.code==='Space'||e.code==='ArrowDown')){e.preventDefault();releaseRef.current()}
  }
  const kd=(e:KeyboardEvent)=>key(e,true),ku=(e:KeyboardEvent)=>key(e,false)
  window.addEventListener('keydown',kd);window.addEventListener('keyup',ku)
  const back=()=>{if(!document.hidden)sprites.clear()}
  document.addEventListener('visibilitychange',back)
  const fxs:Bit[]=[],floats:Float[]=[]
  let raf=0,last=performance.now(),acc=0,combo=0,comboAt=-1e9,shake=0,cheer=0,t=0
  const loop=(now:number)=>{
   const dt=Math.min(50,now-last);last=now;t+=dt/16.67
   const m=dt/16.67
   // Held arrow keys aim smoothly; KONO glides after the aim (no jumping about).
   if(held.left)aim.current=Math.max(0,aim.current-1.4*m)
   if(held.right)aim.current=Math.min(JAR.w,aim.current+1.4*m)
   shown.current+=(aim.current-shown.current)*Math.min(1,0.35*m)
   if(!ended.current){
    const before=garden.current
    acc+=dt;let g=before
    while(acc>=STEP){
     const pre=g;g=step(g,STEP/(1000/60));acc-=STEP
     // Each new growth: juice, the points floating up, a combo if they come quickly, and a sound.
     for(const p of g.pops)if(p.at>=pre.frame&&!pre.pops.includes(p)){
      const tier=Math.min(p.tier,LADDER.length-1),col=LADDER[tier].color
      combo=now-comboAt<1300?combo+1:1;comboAt=now
      for(let k=0;k<14;k++){const a=Math.random()*Math.PI*2,v=1.2+Math.random()*2.6;fxs.push({x:p.x*S,y:p.y*S,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1.6,life:1,color:k%3?col:'#ffffff',size:3+Math.random()*5})}
      if(combo>1)for(const f of floats)f.sub=''
      floats.push({x:p.x*S,y:p.y*S,text:p.tier>=LADDER.length?'🌈 +100':'+'+((p.tier+1)*(p.tier+2)/2),sub:combo>1?'Combo ×'+combo:'',at:now})
      if(p.tier>=6){shake=Math.min(1,0.4+p.tier*0.06);cheer=1}
      fx(p.tier>=8?'mega':'match',soundRef.current,Math.min(10,tier+combo-1))
      try{if(p.tier>=6)navigator.vibrate?.(14)}catch{/* no vibration */}
     }
    }
    garden.current=g
    if(g.score!==before.score||g.next!==before.next||(g.danger>30)!==(before.danger>30))setHud({score:g.score,next:g.next,best:g.best,danger:g.danger>30})
    if(g.over&&!ended.current){ended.current=true;gameSound('lose',soundRef.current);window.setTimeout(()=>onEndRef.current(g.score,g.best),1000)}
   }
   // How each fruit moves on top of the physics: a new one pops in small, bounces past full size and
   // settles; a hard landing squashes it for a moment; now and then it blinks.
   const looks=look.current,seen=new Set<number>()
   for(const b of garden.current.balls){seen.add(b.id);let l=looks.get(b.id)
    if(!l){l={born:b.age>=30?0:-1,squash:0,vy:b.vy,blink:Math.random()*400};looks.set(b.id,l)}
    if(l.born>=0)l.born+=m
    if(l.vy>0.9&&b.vy<l.vy*0.4)l.squash=Math.min(0.22,l.vy*0.1)
    l.squash=Math.max(0,l.squash-0.02*m);l.vy=b.vy}
   for(const id of looks.keys())if(!seen.has(id))looks.delete(id)
   for(let k=fxs.length-1;k>=0;k--){const f=fxs[k];f.x+=f.vx*m*2;f.y+=f.vy*m*2;f.vy+=0.12*m;f.life-=0.03*m;if(f.life<=0)fxs.splice(k,1)}
   for(let k=floats.length-1;k>=0;k--)if(now-floats[k].at>1100)floats.splice(k,1)
   shake=Math.max(0,shake-0.06*m);cheer=Math.max(0,cheer-0.015*m)
   const cooling=performance.now()<cool.current,grow=cooling?1-(cool.current-performance.now())/380:1
   draw(canvas.current,garden.current,shown.current,grow,kono.current,looks,fxs,floats,now,t,shake,cheer)
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);document.removeEventListener('visibilitychange',back)}
 },[])
 const aimAt=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();aim.current=(e.clientX-r.left)/r.width*JAR.w}
 return <div className="break-game kono-bloom">
  <div className={'bloom-frame'+(hud.danger?' is-danger':'')}>
   <div className="bloom-bar">
    <p className="bloom-next" aria-label={'Next: '+LADDER[hud.next].name}><span aria-hidden="true">Next</span><FruitIcon tier={hud.next} size={32}/></p>
    <strong className="bloom-score" aria-live="polite">{hud.score.toLocaleString()}</strong>
    <p className="bloom-best">{best!==null?'Best '+best.toLocaleString():''}</p>
   </div>
   {hud.danger&&<span className="bloom-warn" role="status">Too full! Get under the line</span>}
   <canvas ref={canvas} width={JAR.w*S} height={JAR.h*S} role="img" aria-label={'KONO Bloom fruit jar, '+hud.score+' points. Move to aim and let go to drop (or the arrow keys and Space); two the same fruit grow into the next one'}
    onPointerMove={aimAt} onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);aimAt(e)}} onPointerUp={e=>{aimAt(e);release()}}/>
  </div>
  <ol className="bloom-ladder" aria-label="The fruit ladder: two the same grow into the next">{LADDER.map((t,i)=><li key={t.name} className={(i<=hud.best?'is-grown':'')+(i===hud.best&&hud.best>0?' is-best':'')} style={{'--c':t.color} as React.CSSProperties}><FruitIcon tier={i}/><small>{t.name}</small></li>)}</ol>
 </div>
}

/** A fruit as a little picture (the next one, and the ladder), drawn the same way as in the jar. */
function FruitIcon({tier,size}:{tier:number;size?:number}){
 return <img src={iconUrl(tier)} alt="" width={size} height={size} draggable={false}/>
}
const icons=new Map<number,string>()
function iconUrl(tier:number){
 let u=icons.get(tier);if(u)return u
 const c=document.createElement('canvas'),R=36;c.width=c.height=R*2+44
 const x=c.getContext('2d')!;fruit(x,c.width/2,c.height/2+10,R,tier);face(x,c.width/2,c.height/2+10,R,'happy',tier)
 u=c.toDataURL();icons.set(tier,u);return u
}

type Look={born:number;squash:number;vy:number;blink:number}
type Bit={x:number;y:number;vx:number;vy:number;life:number;color:string;size:number}
type Float={x:number;y:number;text:string;sub:string;at:number}
/** Where a drop at `x` would come to rest first: on the floor, or on top of whatever's under it. */
function landing(g:Garden,x:number,tier:number){
 const r=RADIUS[tier];let y=JAR.h-r
 for(const b of g.balls){const R=RADIUS[b.tier]+r,dx=Math.abs(b.x-x);if(dx<R){const top=b.y-Math.sqrt(R*R-dx*dx);if(top<y)y=top}}
 return Math.max(JAR.dropY,y)
}
function draw(c:HTMLCanvasElement|null,g:Garden,aim:number,grow:number,kono:{happy:HTMLImageElement;cheer:HTMLImageElement;gasp:HTMLImageElement}|null,looks:Map<number,Look>,fxs:Bit[],floats:Float[],now:number,t:number,shake:number,cheer:number){
 const x=c?.getContext('2d');if(!c||!x)return
 const W=c.width,H=c.height,danger=g.danger>30
 x.save();if(shake)x.translate(Math.sin(t*2.3)*4*shake,Math.cos(t*2.9)*2*shake)
 // The jar: a soft peach-to-mint glass with a few drifting polka dots, a wicker basket floor and a glassy shine.
 const glass=x.createLinearGradient(0,0,0,H);glass.addColorStop(0,'#fff4ea');glass.addColorStop(.55,'#fde7ef');glass.addColorStop(1,'#e3f6e6')
 x.fillStyle=glass;x.fillRect(-10,-10,W+20,H+20)
 x.fillStyle='rgba(255,255,255,.55)';for(let i=0;i<18;i++){const px=(i*83)%W,py=((i*137)%H+t*0.15*(1+i%3))%H;x.beginPath();x.arc(px,py,4+(i%3)*3,0,7);x.fill()}
 const floor=x.createLinearGradient(0,H-26,0,H);floor.addColorStop(0,'#e9b27a');floor.addColorStop(1,'#c8864f');x.fillStyle=floor;x.fillRect(0,H-22,W,22)
 x.strokeStyle='rgba(120,70,40,.35)';x.lineWidth=2;for(let i=0;i<W;i+=18){x.beginPath();x.moveTo(i,H-22);x.quadraticCurveTo(i+9,H-11,i,H);x.stroke()}
 // The line not to fill past: a ribbon of dashes and a label, and the space above tinted red the longer
 // something sits over it.
 const warn=Math.min(1,g.danger/120),pulse=danger?0.5+0.5*Math.sin(g.frame/5):0
 x.fillStyle='rgba(255,110,130,'+(0.04+warn*0.2)+')';x.fillRect(0,0,W,JAR.line*S)
 x.save();x.setLineDash([14,10]);x.lineWidth=5;x.lineCap='round';x.strokeStyle='rgba(232,84,110,'+(0.55+pulse*0.4)+')'
 x.beginPath();x.moveTo(6,JAR.line*S);x.lineTo(W-6,JAR.line*S);x.stroke();x.restore()
 x.font='800 17px system-ui';x.textAlign='left';x.textBaseline='top';x.fillStyle='rgba(200,60,90,.75)';x.fillText('♡ keep below the line',12,JAR.line*S+8)
 // Where it'll go: a soft guide straight down to where it'll first land, and its shadow outline there.
 const tier=g.next,ax=clampX(aim,tier)*S
 if(!g.over){
  const ly=landing(g,ax/S,tier)*S,r=RADIUS[tier]*S
  x.save();x.strokeStyle='rgba(150,110,170,.35)';x.lineWidth=3;x.setLineDash([2,10]);x.lineCap='round';x.beginPath();x.moveTo(ax,JAR.dropY*S+18+r);x.lineTo(ax,ly-r);x.stroke()
  x.setLineDash([]);x.fillStyle='rgba(255,255,255,.4)';x.strokeStyle='rgba(150,110,170,.35)';x.lineWidth=3;x.beginPath();x.arc(ax,ly,r,0,Math.PI*2);x.fill();x.stroke();x.restore()
 }
 // The fruit.
 for(const b of g.balls){const l=looks.get(b.id),age=l&&l.born>=0?l.born:99
  const pop=age<60?1-0.45*Math.exp(-age/9)*Math.cos(age/3.4):1,sq=l?.squash??0
  const mood:Mood=b.vy>1.3?'whee':age<45?'beam':danger&&b.y*S<JAR.line*S+RADIUS[b.tier]*S*3?'worried':l&&((t+l.blink)%240<6)?'blink':'happy'
  // A gentle breathing bob, each fruit in its own time.
  const br=Math.sin(t*0.07+b.id*1.7)*0.022
  drawFruit(x,b.x*S,b.y*S,b.tier,pop*(1+sq+br),pop*(1-sq-br),mood)
  // Big fruit twinkle.
  if(b.tier>=6){const r=RADIUS[b.tier]*S,tw=(Math.sin(t*0.12+b.id)+1)/2;x.fillStyle='rgba(255,255,255,'+(0.4+tw*0.6)+')';const px=b.x*S+r*0.72,py=b.y*S-r*0.78,q=r*0.12*(0.6+tw*0.5);x.beginPath();for(let k=0;k<8;k++){const a=k/8*Math.PI*2,d=k%2?q*0.35:q;x.lineTo(px+Math.cos(a)*d,py+Math.sin(a)*d)}x.closePath();x.fill()}}
 // KONO over the jar holding the next fruit (it pops into KONO's paws after each drop).
 if(!g.over&&kono){
  const pic=cheer>0.2&&ok(kono.cheer)?kono.cheer:danger&&ok(kono.gasp)?kono.gasp:kono.happy
  if(ok(pic)){const hop=cheer>0.2?Math.abs(Math.sin(t*0.4))*8:Math.abs(Math.sin(t*0.1))*2;x.drawImage(pic,ax-36,-6-hop,72,72*pic.naturalHeight/pic.naturalWidth)}
  if(grow>0){const k=grow<1?0.3+0.7*grow+Math.sin(grow*Math.PI)*0.15:1;drawFruit(x,ax,JAR.dropY*S+18,tier,k,k,'look')}
 }
 // Juice and sparkles.
 for(const f of fxs){x.globalAlpha=Math.max(0,f.life);x.fillStyle=f.color;x.beginPath();x.arc(f.x,f.y,f.size*(0.5+f.life*0.5),0,7);x.fill()}
 x.globalAlpha=1
 // Growing pops: a ring, and the points (and combo) floating up.
 for(const p of g.pops){const k=(g.frame-p.at)/40;if(k<0||k>1)continue
  const r=(RADIUS[Math.min(p.tier,RADIUS.length-1)]+k*14)*S
  x.save();x.globalAlpha=(1-k)*0.8;x.strokeStyle=p.tier>=LADDER.length?'#ff6fd8':LADDER[p.tier].color;x.lineWidth=6*(1-k)+1
  x.beginPath();x.arc(p.x*S,p.y*S,r,0,Math.PI*2);x.stroke();x.restore()}
 for(const f of floats){const k=(now-f.at)/1100,y=f.y-k*70
  x.save();x.globalAlpha=k<0.75?1:1-(k-0.75)*4;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round'
  x.font='900 30px system-ui';x.lineWidth=7;x.strokeStyle='#fff';x.strokeText(f.text,f.x,y);x.fillStyle='#e8546e';x.fillText(f.text,f.x,y)
  if(f.sub){x.font='900 20px system-ui';x.strokeText(f.sub,f.x,y+28);x.fillStyle='#8a5cd8';x.fillText(f.sub,f.x,y+28)}
  x.restore()}
 // A glassy shine down the left side.
 const shine=x.createLinearGradient(0,0,W*0.18,0);shine.addColorStop(0,'rgba(255,255,255,.55)');shine.addColorStop(1,'rgba(255,255,255,0)')
 x.fillStyle=shine;x.fillRect(0,0,W*0.18,H-22)
 x.restore()
}
const ok=(i?:HTMLImageElement)=>!!i&&i.complete&&i.naturalWidth>0
type Mood='happy'|'beam'|'blink'|'worried'|'look'|'whee'
function drawFruit(x:CanvasRenderingContext2D,cx:number,cy:number,tier:number,sx:number,sy:number,mood:Mood){
 const r=RADIUS[tier]*S,spr=sprite(tier),pad=spr.width/2
 x.save()
 // Scaled about its bottom, so a squash sits on what it landed on.
 // A soft mochi squish (a touch wider and lower), and any squash, about its bottom.
 sx*=1.035;sy*=0.965
 x.translate(cx,cy+r);x.scale(sx,sy);x.translate(-cx,-(cy+r))
 x.drawImage(spr,cx-pad/SPR_SCALE,cy-pad/SPR_SCALE,spr.width/SPR_SCALE,spr.height/SPR_SCALE)
 face(x,cx,cy,r,mood,tier)
 x.restore()
}
// Each fruit's picture is drawn once, at twice the size (sharp on any screen), and reused; kept in ordinary
// memory so a phone can't wipe it (and redrawn when the game comes back to the screen).
const SPR_SCALE=2,sprites=new Map<number,HTMLCanvasElement>()
function sprite(tier:number){
 let c=sprites.get(tier);if(c)return c
 const r=RADIUS[tier]*S,pad=Math.ceil(r*1.5)
 c=document.createElement('canvas');c.width=c.height=pad*2*SPR_SCALE
 c.addEventListener('contextlost',()=>sprites.delete(tier))
 const x=c.getContext('2d',{willReadFrequently:true})!;x.scale(SPR_SCALE,SPR_SCALE);fruit(x,pad,pad,r,tier)
 sprites.set(tier,c);return c
}
const shade=(hex:string,f:number)=>{const n=parseInt(hex.slice(1),16),c=(v:number)=>Math.max(0,Math.min(255,Math.round(v*f)));return 'rgb('+c(n>>16)+','+c(n>>8&255)+','+c(n&255)+')'}
/** A fruit's body, kawaii and soft ("2.5D"): a flat bright colour, a gentle shade underneath, a big glossy
 * shine and an outline in the fruit's own darker shade, with its own simple touches (stem, leaf, seeds…). */
function fruit(x:CanvasRenderingContext2D,cx:number,cy:number,r:number,tier:number){
 const t=LADDER[tier],col=t.color,lw=Math.max(2.4,r*0.075),edge=shade(col,0.6)
 const leaf=(lx:number,ly:number,ang:number,len:number,c='#7ed36a')=>{x.save();x.translate(lx,ly);x.rotate(ang);x.fillStyle=c;x.strokeStyle='#3f8f4a';x.lineWidth=Math.max(1.6,r*0.05);x.beginPath();x.moveTo(0,0);x.bezierCurveTo(len*0.25,-len*0.55,len*0.85,-len*0.45,len,0);x.bezierCurveTo(len*0.85,len*0.45,len*0.25,len*0.55,0,0);x.fill();x.stroke()
  x.strokeStyle='rgba(255,255,255,.55)';x.lineWidth=Math.max(1,r*0.025);x.beginPath();x.moveTo(len*0.15,0);x.lineTo(len*0.75,0);x.stroke();x.restore()}
 const stem=(h:number,lean=0.2)=>{x.strokeStyle='#8a5a36';x.lineWidth=Math.max(2.4,r*0.1);x.lineCap='round';x.beginPath();x.moveTo(cx,cy-r*0.88);x.quadraticCurveTo(cx+r*0.05,cy-r-h*0.55,cx+r*lean,cy-r-h);x.stroke()}
 // The round body: flat colour, a soft shade on the lower right, the outline.
 const blob=(c:string,e:string)=>{x.fillStyle=c;x.beginPath();x.arc(cx,cy,r,0,7);x.fill()
  x.save();x.beginPath();x.arc(cx,cy,r,0,7);x.clip();x.fillStyle='rgba(0,0,0,.10)';x.beginPath();x.arc(cx+r*0.35,cy+r*0.4,r*1.05,0,7);x.fill()
  x.fillStyle=c;x.beginPath();x.arc(cx-r*0.12,cy-r*0.14,r*0.92,0,7);x.fill();x.restore()
  x.strokeStyle=e;x.lineWidth=lw;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke()}
 // A soft drop shadow under every fruit.
 x.fillStyle='rgba(90,50,70,.13)';x.beginPath();x.ellipse(cx,cy+r*0.9,r*0.8,r*0.2,0,0,7);x.fill()
 switch(t.kind){
  case 'blueberry':blob(col,edge);x.fillStyle=shade(col,0.55);for(let k=0;k<5;k++){const a=k/5*Math.PI*2-Math.PI/2;x.beginPath();x.ellipse(cx+Math.cos(a)*r*0.13,cy-r*0.7+Math.sin(a)*r*0.13,r*0.1,r*0.05,a,0,7);x.fill()}break
  case 'cherry':stem(r*0.95,0.25);leaf(cx+r*0.2,cy-r*1.8,-0.25,r*0.75);blob(col,edge);break
  case 'strawberry':{x.fillStyle=col;x.beginPath();x.moveTo(cx-r,cy-r*0.25);x.bezierCurveTo(cx-r*1.02,cy+r*0.55,cx-r*0.3,cy+r*1.02,cx,cy+r*1.02);x.bezierCurveTo(cx+r*0.3,cy+r*1.02,cx+r*1.02,cy+r*0.55,cx+r,cy-r*0.25);x.bezierCurveTo(cx+r*0.95,cy-r*1.0,cx-r*0.95,cy-r*1.0,cx-r,cy-r*0.25);x.fill();x.strokeStyle=edge;x.lineWidth=lw;x.stroke()
   x.fillStyle='#fff6b8';for(let k=0;k<16;k++){const a=k*2.39,d=r*(0.3+((k*37)%55)/100),sx=cx+Math.cos(a)*d*0.85,sy=cy+Math.sin(a)*d*0.75+r*0.12;if(Math.abs(sx-cx)<r*0.62&&sy>cy-r*0.15&&sy<cy+r*0.5)continue;x.beginPath();x.ellipse(sx,sy,r*0.045,r*0.075,0,0,7);x.fill()}
   for(let k=0;k<5;k++)leaf(cx,cy-r*0.72,-Math.PI/2+(k-2)*0.6,r*0.5,'#86da6e');x.fillStyle='#86da6e';x.beginPath();x.arc(cx,cy-r*0.74,r*0.13,0,7);x.fill();break}
  case 'kiwi':{x.fillStyle='#a07a4c';x.beginPath();x.arc(cx,cy,r,0,7);x.fill();x.fillStyle='#b8ec6e';x.beginPath();x.arc(cx,cy,r*0.86,0,7);x.fill()
   x.fillStyle='#d9f7a6';x.beginPath();x.arc(cx,cy,r*0.6,0,7);x.fill();x.fillStyle='#fbffe8';x.beginPath();x.ellipse(cx,cy,r*0.3,r*0.24,0,0,7);x.fill()
   x.fillStyle='#2f2a24';for(let k=0;k<16;k++){const a=k/16*Math.PI*2;x.beginPath();x.ellipse(cx+Math.cos(a)*r*0.73,cy+Math.sin(a)*r*0.73,r*0.028,r*0.06,a,0,7);x.fill()}
   x.strokeStyle='#6b4e2c';x.lineWidth=lw;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke();break}
  case 'plum':stem(r*0.3,0.1);leaf(cx+r*0.12,cy-r*1.18,-0.15,r*0.62);blob(col,edge);x.strokeStyle='rgba(255,255,255,.35)';x.lineWidth=r*0.05;x.lineCap='round';x.beginPath();x.arc(cx+r*0.3,cy,r*0.72,-1.95,-1.25);x.stroke();break
  case 'lemon':{x.fillStyle=col;x.strokeStyle=edge;x.lineWidth=lw;x.beginPath();x.ellipse(cx,cy,r*1.0,r*0.92,0,0,7);x.fill();for(const sgn of [-1,1]){x.beginPath();x.ellipse(cx+sgn*r*0.98,cy,r*0.14,r*0.11,0,0,7);x.fill();x.stroke()}x.beginPath();x.ellipse(cx,cy,r*1.0,r*0.92,0,0,7);x.stroke()
   leaf(cx+r*0.05,cy-r*0.86,-0.55,r*0.62);break}
  case 'peach':leaf(cx+r*0.06,cy-r*0.92,-0.7,r*0.62);{x.fillStyle=col;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();x.save();x.beginPath();x.arc(cx,cy,r,0,7);x.clip();x.fillStyle='rgba(255,120,140,.45)';x.beginPath();x.arc(cx+r*0.55,cy+r*0.1,r*0.75,0,7);x.fill();x.restore();x.strokeStyle='#e58a7e';x.lineWidth=lw;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke()
   x.strokeStyle='rgba(229,138,126,.7)';x.lineWidth=r*0.05;x.lineCap='round';x.beginPath();x.moveTo(cx-r*0.02,cy-r*0.9);x.quadraticCurveTo(cx-r*0.4,cy-r*0.35,cx-r*0.2,cy+r*0.1);x.stroke()}break
  case 'mango':leaf(cx+r*0.15,cy-r*0.9,-0.3,r*0.7);{x.fillStyle=col;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();x.save();x.beginPath();x.arc(cx,cy,r,0,7);x.clip();x.fillStyle='rgba(255,90,90,.35)';x.beginPath();x.arc(cx-r*0.6,cy+r*0.5,r*0.8,0,7);x.fill();x.fillStyle='rgba(255,240,120,.5)';x.beginPath();x.arc(cx+r*0.5,cy-r*0.5,r*0.6,0,7);x.fill();x.restore();x.strokeStyle='#e08a3a';x.lineWidth=lw;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke()}break
  case 'coconut':blob(col,edge);x.strokeStyle='rgba(90,55,30,.3)';x.lineWidth=Math.max(1,r*0.03);x.lineCap='round';for(let k=0;k<14;k++){const a=k*0.95,d=r*(0.25+((k*31)%60)/100);x.beginPath();x.moveTo(cx+Math.cos(a)*d,cy+Math.sin(a)*d);x.lineTo(cx+Math.cos(a)*d+r*0.1,cy+Math.sin(a)*d+r*0.04);x.stroke()}
   x.fillStyle='#5a3a24';for(const [dx,dy] of [[-0.14,-0.7],[0.14,-0.7],[0,-0.54]]){x.beginPath();x.arc(cx+dx*r,cy+dy*r,r*0.06,0,7);x.fill()}break
  case 'melon':{// a watermelon: green with darker zigzag stripes
   blob(col,'#3f8f4a');x.save();x.beginPath();x.arc(cx,cy,r*0.97,0,7);x.clip();x.strokeStyle='#4f9e44';x.lineWidth=r*0.13;x.lineJoin='round'
   for(let k=-2;k<=2;k++){x.beginPath();for(let j=0;j<=10;j++){const yy=cy-r+j*(2*r/10),xx=cx+k*r*0.42+(j%2?r*0.07:-r*0.07)+Math.sin((yy-cy)/r*1.2)*k*r*0.08;if(j)x.lineTo(xx,yy);else x.moveTo(xx,yy)}x.stroke()}x.restore()
   x.strokeStyle='#3f8f4a';x.lineWidth=lw;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke();stem(r*0.2,0.15);break}
  default:{// the Rainbow Fruit: soft rainbow bands, a sparkle crown
   const bands=['#ff9aaa','#ffc07a','#ffe58a','#9fe6b2','#9fd2f7','#cdb0f3']
   x.save();x.beginPath();x.arc(cx,cy,r,0,7);x.clip();bands.forEach((b,k)=>{x.fillStyle=b;x.beginPath();x.arc(cx,cy+r*1.6,r*(2.6-k*0.27),0,7);x.fill()});x.restore()
   x.strokeStyle='#e68ac0';x.lineWidth=lw;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke()
   x.fillStyle='#fff3a0';x.strokeStyle='#f0b84a';x.lineWidth=Math.max(1,r*0.025);for(const [dx,dy,sz] of [[0,-1.16,0.2],[-0.48,-1.0,0.12],[0.48,-1.0,0.12]]){const px=cx+dx*r,py=cy+dy*r,q=sz*r;x.beginPath();for(let k=0;k<8;k++){const a=k/8*Math.PI*2-Math.PI/2,d=k%2?q*0.4:q;x.lineTo(px+Math.cos(a)*d,py+Math.sin(a)*d)}x.closePath();x.fill();x.stroke()}}
 }
 // A big glossy shine (the "2.5D" look), and a tiny sparkle.
 x.fillStyle='rgba(255,255,255,.75)';x.beginPath();x.ellipse(cx-r*0.42,cy-r*0.42,r*0.24,r*0.14,-0.75,0,7);x.fill()
 x.beginPath();x.arc(cx-r*0.12,cy-r*0.64,r*0.06,0,7);x.fill()
}
/** A kawaii face: big sparkly eyes (a large shine, a small one and a twinkle), blushing cheeks with little
 * shine lines, and a small mouth with its own personality per fruit (ω, a smile, a grin, a tongue out). It
 * blinks, beams after growing, squeals (> <) while it falls, looks worried near the top when the jar's too
 * full, and looks down at the jar while KONO holds it. */
function face(x:CanvasRenderingContext2D,cx:number,cy:number,r:number,mood:Mood,tier:number){
 if(r<10)return
 const ey=cy+r*(tier===8?0.18:0.14),ex=r*0.36,er=Math.max(2.2,r*0.135),ink='#2b1d2a'
 // Blush, with three little shine lines.
 x.fillStyle='rgba(255,105,140,.5)';for(const sg of [-1,1]){x.beginPath();x.ellipse(cx+sg*r*0.6,ey+r*0.28,r*0.19,r*0.12,0,0,7);x.fill()}
 x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=Math.max(1,r*0.025);x.lineCap='round'
 for(const sg of [-1,1])for(let k=0;k<3;k++){const bx=cx+sg*r*0.6+(k-1)*r*0.07;x.beginPath();x.moveTo(bx-r*0.02,ey+r*0.31);x.lineTo(bx+r*0.02,ey+r*0.24);x.stroke()}
 x.strokeStyle=ink;x.fillStyle=ink;x.lineWidth=Math.max(1.8,r*0.065);x.lineCap='round';x.lineJoin='round'
 if(mood==='whee'){
  // > <
  for(const sg of [-1,1]){x.beginPath();x.moveTo(cx+sg*ex-sg*er*0.9,ey-er*0.8);x.lineTo(cx+sg*ex+sg*er*0.5,ey);x.lineTo(cx+sg*ex-sg*er*0.9,ey+er*0.8);x.stroke()}
 }else if(mood==='beam'||mood==='blink'){
  for(const sg of [-1,1]){x.beginPath();if(mood==='beam')x.arc(cx+sg*ex,ey+er*0.75,er*1.15,Math.PI*1.12,Math.PI*1.88);else{x.moveTo(cx+sg*ex-er,ey+er*0.2);x.quadraticCurveTo(cx+sg*ex,ey+er*0.95,cx+sg*ex+er,ey+er*0.2)}x.stroke()}
 }else{
  const dy=mood==='look'?er*0.45:0
  for(const sg of [-1,1]){x.fillStyle=ink;x.beginPath();x.ellipse(cx+sg*ex,ey+dy,er,er*1.22,0,0,7);x.fill()
   // a hint of colour low in each eye, then the shines
   x.fillStyle='rgba(120,90,200,.45)';x.beginPath();x.ellipse(cx+sg*ex,ey+dy+er*0.55,er*0.62,er*0.42,0,0,7);x.fill()
   x.fillStyle='#fff';x.beginPath();x.arc(cx+sg*ex-er*0.3,ey+dy-er*0.42,er*0.46,0,7);x.fill()
   x.beginPath();x.arc(cx+sg*ex+er*0.38,ey+dy+er*0.35,er*0.2,0,7);x.fill()
   x.beginPath();x.arc(cx+sg*ex+er*0.1,ey+dy-er*0.75,er*0.1,0,7);x.fill()}
  if(mood==='worried'){x.strokeStyle=ink;x.beginPath();x.moveTo(cx-ex-er*1.2,ey-er*2.1);x.lineTo(cx-ex+er*0.9,ey-er*1.6);x.moveTo(cx+ex+er*1.2,ey-er*2.1);x.lineTo(cx+ex-er*0.9,ey-er*1.6);x.stroke()}
 }
 const my=ey+r*0.24
 x.strokeStyle=ink;x.fillStyle=ink;x.lineWidth=Math.max(1.6,r*0.055)
 if(mood==='worried'){x.beginPath();x.ellipse(cx,my+r*0.04,r*0.06,r*0.08,0,0,7);x.fill();return}
 if(mood==='whee'){x.beginPath();x.ellipse(cx,my+r*0.03,r*0.09,r*0.11,0,0,7);x.fillStyle='#b8344f';x.fill();x.fillStyle='#ff8fa3';x.beginPath();x.ellipse(cx,my+r*0.08,r*0.05,r*0.04,0,0,7);x.fill();return}
 const style=mood==='beam'?'grin':['cat','smile','cat','grin','tongue','cat','smile','grin','cat','tongue','grin'][tier]
 x.beginPath()
 if(style==='grin'){x.moveTo(cx-r*0.13,my-r*0.02);x.quadraticCurveTo(cx,my+r*0.22,cx+r*0.13,my-r*0.02);x.closePath();x.fillStyle='#b8344f';x.fill();x.fillStyle='#ff8fa3';x.beginPath();x.ellipse(cx,my+r*0.08,r*0.06,r*0.035,0,0,7);x.fill()}
 else if(style==='cat'){x.moveTo(cx-r*0.12,my);x.quadraticCurveTo(cx-r*0.06,my+r*0.09,cx,my);x.quadraticCurveTo(cx+r*0.06,my+r*0.09,cx+r*0.12,my);x.stroke()}
 else if(style==='tongue'){x.arc(cx,my-r*0.02,r*0.1,0.15,Math.PI-0.15);x.stroke();x.fillStyle='#ff7f98';x.beginPath();x.ellipse(cx+r*0.03,my+r*0.08,r*0.05,r*0.06,0,0,7);x.fill()}
 else{x.arc(cx,my-r*0.04,r*0.1,0.25,Math.PI-0.25);x.stroke()}
}
