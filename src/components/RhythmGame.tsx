import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {LEVELS,CLEAR_AT,CLEAR_NAME,MAX_SCORE,WINDOWS,accuracy,approachFor,clearOf,count,freshTally,grade,hitIn,missedBy,playOf,readBeatBest,readOffset,readSpeed,ribbonX,saveBeatBest,saveOffset,saveSpeed,scoreOf,skyHit,judge,type Chart,type Clear,type Judge,type Level,type Play,type Tally} from '../store/rhythm'
import {stopMusic} from '../arcadeAudio'
import charts from '../game/data/rhythmCharts.json'
import type {GameHandle} from './GameScreen'
import './rhythm-game.css'

type Song={id:string;title:string;bpm:number;ms:number;charts:Record<Level,Chart>}
const SONGS=(charts as unknown as {songs:Song[]}).songs
const FROM:Record<string,string>={candy:'🍬 Candy crush',gems:'💎 Gem blitz',blast:'🧱 KONO blast','flow-1':'🌌 Flow · Drift','flow-2':'🌌 Flow · Tide','flow-3':'🌌 Flow · Pulse','flow-4':'🌌 Flow · Aurora','flow-5':'🌌 Flow · Zenith'}
const LANE_COLORS=['#ff7ab6','#7ad7ff','#9dff8a','#ffd36b']
const HAND_COLORS=['#5fd3ff','#ff7ad1']
const KEYS:Record<string,number>={d:0,f:1,j:2,k:3,arrowleft:0,arrowdown:1,arrowup:2,arrowright:3}
const WORD:Record<Judge,string>={perfect:'Perfect',great:'Great',good:'Good',miss:'Miss'}
const WORD_COLOR:Record<Judge,string>={perfect:'#ffe27a',great:'#7ae7ff',good:'#b9ff9e',miss:'#ff7a8a'}
const CLEAR_MARK:Record<Clear,string>={fail:'',clear:'✓',full:'FC',all:'AP'}
export type BeatResult={song:string;title:string;level:Level;score:number;acc:number;grade:string;best:number;tally:Tally;clear:Clear;failed:boolean;newBest:boolean}

/** The track in perspective: depth z (0 at the line, 1 far off) to a scale, and from there to the screen. */
const persp=(z:number)=>1/(1+3*Math.max(0,z))
type Field={W:number;H:number;cx:number;hitY:number;horizonY:number;floorW:number;skyH:number}
function fieldOf(W:number,H:number):Field{const hitY=H-Math.max(84,H*0.13),horizonY=H*0.17;return {W,H,cx:W/2,hitY,horizonY,floorW:Math.min(W*0.94,620),skyH:(hitY-horizonY)*0.46}}
const yAt=(f:Field,z:number)=>f.horizonY+(f.hitY-f.horizonY)*(persp(z)-0.25)/0.75
const xAt=(f:Field,x:number,z:number)=>f.cx+(x-0.5)*f.floorW*persp(z)
const skyY=(f:Field,z:number)=>yAt(f,z)-f.skyH*persp(z)

/** KONO Beat: the arcade's songs as a rhythm game on a track running off into the distance. Floor notes come
 * down four lanes (D F J K or the arrows, or tap the lanes; a hold stays pressed to its end); sky notes float
 * above the track (tap up high, or Space); ribbons wind through the sky with the melody (keep a finger on them,
 * or hold S for the blue one and L for the pink). Pick a song and Easy, Medium or Jeff tier (store/rhythm has
 * the rules). The song is the clock: notes are placed by how far into it it is, smoothed between the browser's
 * time updates. Note speed and a timing nudge (for headphones that lag) are kept on this device. */
export default function RhythmGame({ref,onEnd}:{ref:Ref<GameHandle>;onEnd:(r:BeatResult)=>void}){
 const [song,setSong]=useState(SONGS[0].id),[level,setLevel]=useState<Level>('easy'),[playing,setPlaying]=useState(false)
 const [offset,setOffsetState]=useState(readOffset),[speed,setSpeedState]=useState(readSpeed)
 const canvas=useRef<HTMLCanvasElement>(null),audio=useRef<HTMLAudioElement|null>(null)
 const play=useRef<Play>({notes:[],ribbons:[],ticks:[],total:0}),tally=useRef<Tally>(freshTally('easy')),done=useRef(false),nextTick=useRef(0)
 const fx=useRef<{x:number;sky:boolean;t:number;j:Judge}[]>([]),word=useRef<{j:Judge;t:number;off?:number}|null>(null)
 // What's held down: floor lanes (keys or fingers), the ribbon keys, and each finger's place.
 const lanesHeld=useRef([0,0,0,0]),keysHeld=useRef<Set<string>>(new Set()),pointers=useRef(new Map<number,{x:number;y:number;lane:number}>())
 const pressedAt=useRef([0,0,0,0]),clock=useRef({a:-1,p:0}),onEndRef=useRef(onEnd)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 const info=SONGS.find(s=>s.id===song)!
 // Where the song is (ms), smoothed: the element's time only updates every so often, so between updates it
 // runs on the frame clock, and snaps back if they drift apart.
 const songMs=()=>{const a=audio.current;if(!a)return 0;const at=a.currentTime*1000,now=performance.now(),c=clock.current
  if(a.paused){c.a=at;c.p=now;return at}
  const est=c.a+(now-c.p)
  if(at!==c.a&&Math.abs(est-at)>25||c.a<0){c.a=at;c.p=now;return at}
  if(at!==c.a){c.a=at;c.p=now}
  return Math.max(at,est)}
 const judged=()=>play.current.notes.filter(n=>n.hit).length+nextTick.current
 const finish=()=>{
  if(done.current)return;done.current=true
  audio.current?.pause()
  const t=tally.current,total=play.current.total,score=scoreOf(t,total),clear=clearOf(t,level,judged(),total)
  const newBest=clear!=='fail'&&saveBeatBest(info.id,level,score,clear)
  onEndRef.current({song:info.id,title:info.title,level,score,acc:accuracy(t,total),grade:clear==='fail'?'F':grade(score),best:t.best,tally:t,clear,failed:clear==='fail',newBest})
 }
 const finishRef=useRef(finish);useEffect(()=>{finishRef.current=finish})
 useImperativeHandle(ref,()=>({end:()=>finishRef.current()}),[])
 const mark=(i:number,ms:number)=>{
  const n=play.current.notes[i],off=ms-n.t,j=judge(off,level);n.hit=j;n.off=off
  tally.current=count(tally.current,j,level,play.current.total,{off});fx.current.push({x:n.x,sky:n.kind==='sky',t:performance.now(),j});word.current={j,t:performance.now(),off}
  if(j==='perfect')navigator.vibrate?.(6)
 }
 const press=(lane:number)=>{
  if(!playing||done.current)return
  pressedAt.current[lane]=performance.now()
  const ms=songMs()-offset,i=hitIn(play.current.notes,lane,ms,level);if(i>=0)mark(i,ms)
 }
 const pressSky=(x:number|null)=>{if(!playing||done.current)return;const ms=songMs()-offset,i=skyHit(play.current.notes,x,ms,level);if(i>=0)mark(i,ms)}
 const pressRef=useRef({press,pressSky});useEffect(()=>{pressRef.current={press,pressSky}})
 // Keys: D F J K (or the arrows) for the floor, Space for the sky, S and L follow the ribbons.
 useEffect(()=>{
  if(!playing)return
  const down=(e:KeyboardEvent)=>{const k=e.key.toLowerCase(),lane=KEYS[k]
   if(lane!==undefined){e.preventDefault();if(!e.repeat){lanesHeld.current[lane]++;pressRef.current.press(lane)}}
   else if(k===' '){e.preventDefault();if(!e.repeat)pressRef.current.pressSky(null)}
   else if(k==='s'||k==='l'){e.preventDefault();keysHeld.current.add(k)}}
  const up=(e:KeyboardEvent)=>{const k=e.key.toLowerCase(),lane=KEYS[k];if(lane!==undefined)lanesHeld.current[lane]=Math.max(0,lanesHeld.current[lane]-1);keysHeld.current.delete(k)}
  window.addEventListener('keydown',down);window.addEventListener('keyup',up)
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)}
 },[playing])
 // The song pauses with the app in the background.
 useEffect(()=>{const vis=()=>{const a=audio.current;if(!a||done.current||!playing)return;if(document.hidden)a.pause();else void a.play().catch(()=>undefined)};document.addEventListener('visibilitychange',vis);return()=>document.removeEventListener('visibilitychange',vis)},[playing])
 useEffect(()=>()=>{audio.current?.pause();audio.current=null},[])

 const start=()=>{
  stopMusic()
  play.current=playOf(info.charts[level],info.bpm);tally.current=freshTally(level);done.current=false;fx.current=[];word.current=null;nextTick.current=0
  lanesHeld.current=[0,0,0,0];keysHeld.current.clear();pointers.current.clear()
  const a=new Audio('/audio/games/'+info.id+'.mp3');a.preload='auto';audio.current=a;clock.current={a:-1,p:0}
  a.addEventListener('ended',()=>finishRef.current(),{once:true})
  setPlaying(true);void a.play().catch(()=>undefined)
 }

 // Every frame while playing: judge what went by, then draw.
 useEffect(()=>{
  if(!playing)return
  const cv=canvas.current;if(!cv)return
  const ctx=cv.getContext('2d');if(!ctx)return
  const ap=approachFor(speed),tol=level==='easy'?0.16:level==='medium'?0.13:0.11
  let raf=0
  const draw=()=>{
   raf=requestAnimationFrame(draw)
   const dpr=Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth,H=cv.clientHeight
   if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
   ctx.setTransform(dpr,0,0,dpr,0,0)
   const f=fieldOf(W,H),now=songMs()-offset,pl=play.current,t=performance.now()
   cv.dataset.ms=String(Math.round(now)) // where the song is (the tests follow it)
   // Which ribbon pieces are at the line now, and is something on each one?
   const live=pl.ribbons.map((r,i)=>({r,i})).filter(({r})=>r.t0<=now&&now<r.t1)
   const fingerX=[...pointers.current.values()].map(p=>(p.x-(f.cx-f.floorW/2))/f.floorW)
   const onRibbon=(i:number)=>{const r=pl.ribbons[i],x=ribbonX(r,now);return keysHeld.current.has(r.hand?'l':'s')||fingerX.some(fx=>Math.abs(fx-x)<=tol)}
   cv.dataset.follow=String(live.filter(({i})=>onRibbon(i)).length)+'/'+live.length
   // Misses: notes that went by; then the holds' and ribbons' moments as they come.
   if(!done.current){
    for(const i of missedBy(pl.notes,now,level)){pl.notes[i].hit='miss';tally.current=count(tally.current,'miss',level,pl.total,{});word.current={j:'miss',t}}
    while(nextTick.current<pl.ticks.length&&pl.ticks[nextTick.current].t<=now){
     const k=pl.ticks[nextTick.current++]
     const ok=k.kind==='hold'?lanesHeld.current[pl.notes[k.of].lane]>0&&pl.notes[k.of].hit!=='miss':onRibbon(k.of)
     tally.current=count(tally.current,ok?'perfect':'miss',level,pl.total,{tick:true});if(!ok)word.current={j:'miss',t}
    }
    if(tally.current.failed){finishRef.current();return}
    const last=Math.max(pl.notes.length?pl.notes[pl.notes.length-1].end??pl.notes[pl.notes.length-1].t:0,pl.ribbons.length?pl.ribbons[pl.ribbons.length-1].t1:0)
    if(now>last+2500)finishRef.current()
   }
   // The sky and the track, pulsing a little on the beat.
   const beat=60000/info.bpm,pulse=Math.max(0,1-(((now%beat)+beat)%beat)/beat)
   const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0d0a24');g.addColorStop(0.55,'#2a1a52');g.addColorStop(1,'#14102c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
   const far=1.15,L=(x:number,z:number)=>[xAt(f,x,z),yAt(f,z)] as const
   ctx.beginPath();ctx.moveTo(...L(0,far));ctx.lineTo(...L(1,far));ctx.lineTo(...L(1,0));ctx.lineTo(...L(0,0));ctx.closePath()
   const fg=ctx.createLinearGradient(0,f.horizonY,0,f.hitY);fg.addColorStop(0,'rgba(255,255,255,0.02)');fg.addColorStop(1,'rgba(160,140,255,0.16)');ctx.fillStyle=fg;ctx.fill()
   for(let l=0;l<4;l++){const held=lanesHeld.current[l]>0||t-pressedAt.current[l]<120;if(held){ctx.beginPath();ctx.moveTo(...L(l/4,far));ctx.lineTo(...L((l+1)/4,far));ctx.lineTo(...L((l+1)/4,0));ctx.lineTo(...L(l/4,0));ctx.closePath();ctx.fillStyle='rgba(255,255,255,0.09)';ctx.fill()}}
   ctx.strokeStyle='rgba(255,255,255,0.16)';ctx.lineWidth=1
   for(let l=0;l<=4;l++){ctx.beginPath();ctx.moveTo(...L(l/4,far));ctx.lineTo(...L(l/4,0));ctx.stroke()}
   // Beat lines run down the track.
   ctx.strokeStyle='rgba(255,255,255,0.07)'
   for(let b=Math.ceil(now/beat)*beat;b<now+ap*far;b+=beat){const z=(b-now)/ap;ctx.beginPath();ctx.moveTo(...L(0,z));ctx.lineTo(...L(1,z));ctx.stroke()}
   // The line, and the sky line above it.
   ctx.fillStyle=`rgba(255,255,255,${0.45+pulse*0.3})`;ctx.fillRect(xAt(f,0,0),f.hitY-2,f.floorW,4)
   ctx.fillStyle='rgba(180,220,255,0.18)';ctx.fillRect(xAt(f,0,0),skyY(f,0)-1,f.floorW,2)
   ctx.textAlign='center';ctx.font='700 12px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.45)'
   for(let l=0;l<4;l++)ctx.fillText('DFJK'[l],xAt(f,(l+0.5)/4,0),f.hitY+22)
   // Ribbons: the part still to come, from the line out to the distance.
   for(const r of pl.ribbons){
    if(r.t1<now||r.t0>now+ap*far)continue
    const a=Math.max(r.t0,now),b=Math.min(r.t1,now+ap*far),steps=Math.max(2,Math.ceil((b-a)/40))
    ctx.strokeStyle=HAND_COLORS[r.hand];ctx.shadowColor=HAND_COLORS[r.hand];ctx.shadowBlur=12;ctx.lineCap='round'
    let px=0,py=0
    for(let s=0;s<=steps;s++){const tt=a+(b-a)*s/steps,z=(tt-now)/ap,x=xAt(f,ribbonX(r,tt),z),y=skyY(f,z)
     if(s){ctx.globalAlpha=0.55+0.4*persp(z);ctx.lineWidth=Math.max(2,20*persp(z));ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke()}
     px=x;py=y}
    ctx.globalAlpha=1;ctx.shadowBlur=0
   }
   // Where to keep a finger: a ring on each ribbon at the line, filled while it's followed.
   for(const {r,i} of live){const x=xAt(f,ribbonX(r,now),0),y=skyY(f,0),on=onRibbon(i);ctx.beginPath();ctx.arc(x,y,on?22:17,0,Math.PI*2);ctx.strokeStyle=HAND_COLORS[r.hand];ctx.lineWidth=3;ctx.stroke();if(on){ctx.fillStyle=HAND_COLORS[r.hand]+'55';ctx.fill()}}
   // Notes, far ones first.
   for(let i=pl.notes.length-1;i>=0;i--){
    const n=pl.notes[i],z=(n.t-now)/ap
    if(z>far)continue
    if(n.kind==='hold'&&n.end){
     if(n.end<now-60)continue
     const z0=Math.max(0,z),z1=Math.min(far,(n.end-now)/ap),w=0.09,keeping=n.hit&&n.hit!=='miss'&&lanesHeld.current[n.lane]>0
     if(z1>z0){ctx.beginPath();ctx.moveTo(xAt(f,n.x-w,z0),yAt(f,z0));ctx.lineTo(xAt(f,n.x+w,z0),yAt(f,z0));ctx.lineTo(xAt(f,n.x+w,z1),yAt(f,z1));ctx.lineTo(xAt(f,n.x-w,z1),yAt(f,z1));ctx.closePath();ctx.fillStyle=LANE_COLORS[n.lane]+(n.hit==='miss'?'33':keeping?'cc':'77');ctx.fill()}
     if(n.hit)continue
    }else if(n.hit||z<-0.2)continue
    const p=persp(z)
    if(n.kind==='sky'){
     const x=xAt(f,n.x,z),y=skyY(f,z),s=16*p
     ctx.strokeStyle='rgba(180,220,255,0.25)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,yAt(f,z));ctx.stroke()
     ctx.fillStyle='#c9f0ff';ctx.shadowColor='#8fe3ff';ctx.shadowBlur=16;ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*1.6,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s*1.6,y);ctx.closePath();ctx.fill();ctx.shadowBlur=0
     continue
    }
    const x=xAt(f,n.x,z),y=yAt(f,z),w=f.floorW*0.2*p,h=Math.max(5,14*p)
    ctx.fillStyle=LANE_COLORS[n.lane];ctx.shadowColor=LANE_COLORS[n.lane];ctx.shadowBlur=12*p
    ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,h/2);ctx.fill();ctx.shadowBlur=0
    ctx.fillStyle='rgba(255,255,255,0.7)';ctx.beginPath();ctx.roundRect(x-w/2+4*p,y-h/2+2*p,w-8*p,h*0.3,h*0.15);ctx.fill()
   }
   // Hits: rings that open out where they landed.
   fx.current=fx.current.filter(e=>t-e.t<400)
   for(const e of fx.current){const k=(t-e.t)/400;ctx.beginPath();ctx.arc(xAt(f,e.x,0),e.sky?skyY(f,0):f.hitY,26+k*40,0,Math.PI*2);ctx.strokeStyle=WORD_COLOR[e.j];ctx.globalAlpha=1-k;ctx.lineWidth=4;ctx.stroke();ctx.globalAlpha=1}
   // Fingers.
   for(const p of pointers.current.values()){ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fill()}
   // Combo, the word (with Early or Late), score, gauge and how far into the song.
   const s=tally.current
   cv.dataset.score=String(scoreOf(s,pl.total))
   ctx.textAlign='center';ctx.fillStyle='#fff'
   if(s.combo>=5){ctx.font='800 '+Math.round(26+Math.min(16,s.combo/12))+'px system-ui,sans-serif';ctx.globalAlpha=0.8;ctx.fillText(String(s.combo),f.cx,f.horizonY+(f.hitY-f.horizonY)*0.3);ctx.font='700 11px system-ui,sans-serif';ctx.fillText('COMBO',f.cx,f.horizonY+(f.hitY-f.horizonY)*0.3+16);ctx.globalAlpha=1}
   const wd=word.current
   if(wd&&t-wd.t<600){const y=f.horizonY+(f.hitY-f.horizonY)*0.45;ctx.globalAlpha=1-(t-wd.t)/600;ctx.font='900 24px system-ui,sans-serif';ctx.fillStyle=WORD_COLOR[wd.j];ctx.fillText(WORD[wd.j],f.cx,y)
    if(wd.off!==undefined&&wd.j!=='miss'&&wd.j!=='perfect'){ctx.font='800 12px system-ui,sans-serif';ctx.fillStyle=wd.off<0?'#8fd0ff':'#ffb08f';ctx.fillText(wd.off<0?'EARLY':'LATE',f.cx,y+17)}
    else if(wd.off!==undefined&&Math.abs(wd.off)<=WINDOWS[level][0]/2){ctx.font='800 11px system-ui,sans-serif';ctx.fillStyle='#fff6c2';ctx.fillText('✦',f.cx,y+16)}
    ctx.globalAlpha=1}
   ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='800 18px system-ui,sans-serif';ctx.fillText(String(scoreOf(s,pl.total)).padStart(7,'0').replace(/\B(?=(\d{3})+(?!\d))/g,','),12,28)
   ctx.font='600 11px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.7)';ctx.fillText('of '+MAX_SCORE.toLocaleString(),12,44)
   ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(0,0,W,4);ctx.fillStyle='#ffd36b';ctx.fillRect(0,0,W*Math.min(1,Math.max(0,now)/info.ms),4)
   const gx=W-122,gw=110;ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(gx,16,gw,9)
   ctx.fillStyle=level==='jeff'?(s.gauge>30?'#ff7ad1':'#ff4d5e'):s.gauge>=CLEAR_AT?'#9dff8a':'#7ad7ff';ctx.fillRect(gx,16,gw*s.gauge/100,9)
   if(level!=='jeff'){ctx.fillStyle='#fff';ctx.fillRect(gx+gw*CLEAR_AT/100-1,13,2,15)}
   ctx.font='700 10px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.7)';ctx.fillText(Math.floor(s.gauge)+'%',gx,40)
  }
  raf=requestAnimationFrame(draw)
  return()=>cancelAnimationFrame(raf)
 // eslint-disable-next-line react-hooks/exhaustive-deps -- runs while a song plays
 },[playing])

 // Fingers: low down on the track hits a floor lane (and keeps a hold); up in the sky hits sky notes; anywhere
 // they follow ribbons.
 const zoneOf=(cv:HTMLCanvasElement,cx:number,cy:number)=>{const r=cv.getBoundingClientRect(),f=fieldOf(r.width,r.height),x=cx-r.left,y=cy-r.top,tx=(x-(f.cx-f.floorW/2))/f.floorW,sky=y<f.hitY-f.skyH*0.5;return {x,y,tx,sky,lane:sky||tx<0||tx>=1?-1:Math.floor(tx*4)}}
 const down=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId)
  const z=zoneOf(e.currentTarget,e.clientX,e.clientY);pointers.current.set(e.pointerId,{x:z.x,y:z.y,lane:z.lane})
  if(z.lane>=0){lanesHeld.current[z.lane]++;press(z.lane)}else if(z.sky)pressSky(Math.min(1,Math.max(0,z.tx)))
 }
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  const p=pointers.current.get(e.pointerId);if(!p)return
  const z=zoneOf(e.currentTarget,e.clientX,e.clientY)
  // Sliding along the floor moves the held lane with the finger.
  if(z.lane!==p.lane){if(p.lane>=0)lanesHeld.current[p.lane]=Math.max(0,lanesHeld.current[p.lane]-1);if(z.lane>=0)lanesHeld.current[z.lane]++}
  pointers.current.set(e.pointerId,{x:z.x,y:z.y,lane:z.lane})
 }
 const up=(e:React.PointerEvent<HTMLCanvasElement>)=>{const p=pointers.current.get(e.pointerId);if(!p)return;if(p.lane>=0)lanesHeld.current[p.lane]=Math.max(0,lanesHeld.current[p.lane]-1);pointers.current.delete(e.pointerId)}
 const nudge=(d:number)=>{const v=Math.max(-300,Math.min(300,offset+d));setOffsetState(v);saveOffset(v)}
 const setSpeed=(v:number)=>{const s=Math.max(1,Math.min(10,Math.round(v*2)/2));setSpeedState(s);saveSpeed(s)}

 if(!playing)return <div className="beat-pick">
  <section aria-label="Songs"><h3>Pick a song</h3><ul className="beat-songs">{SONGS.map(s=>{const b=readBeatBest(s.id,level);return <li key={s.id}><button type="button" aria-pressed={song===s.id} onClick={()=>setSong(s.id)}><b>{s.title}</b><small>{FROM[s.id]} · {Math.round(s.bpm)} BPM · {Math.floor(s.ms/60000)}:{String(Math.floor(s.ms/1000)%60).padStart(2,'0')}</small>{b&&<i aria-label={'Best '+b.score.toLocaleString()+', '+b.grade+(b.clear!=='fail'?', '+CLEAR_NAME[b.clear]:'')}>{b.grade}{CLEAR_MARK[b.clear]&&<em>{CLEAR_MARK[b.clear]}</em>}</i>}</button></li>})}</ul></section>
  <section aria-label="Difficulty"><h3>Difficulty</h3><div className="beat-levels" role="group" aria-label="Difficulty">{LEVELS.map(l=>{const c=info.charts[l.id];return <button type="button" key={l.id} aria-pressed={level===l.id} className={'is-'+l.id} onClick={()=>setLevel(l.id)}><b>{l.name}</b><small>{c.tap.length+c.hold.length+c.sky.length} notes · {l.blurb}</small></button>})}</div></section>
  <div className="beat-go">
   <div className="beat-settings">
    <label className="beat-offset">Speed <button type="button" aria-label="Notes slower" onClick={()=>setSpeed(speed-0.5)}>−</button><output>{speed.toFixed(1)}</output><button type="button" aria-label="Notes faster" onClick={()=>setSpeed(speed+0.5)}>＋</button></label>
    <label className="beat-offset">Timing <button type="button" aria-label="Notes earlier" onClick={()=>nudge(-10)}>−</button><output>{offset>0?'+':''}{offset} ms</output><button type="button" aria-label="Notes later" onClick={()=>nudge(10)}>＋</button></label>
   </div>
   <button type="button" className="primary beat-play" onClick={start}>▶ Play {info.title}</button>
  </div>
  <ul className="beat-how">
   <li><span className="is-floor"/>Floor notes: hit them on the line (<kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd>, or tap the lane). Long ones: hold to the end.</li>
   <li><span className="is-sky"/>Sky notes float up high: tap above the track (or <kbd>Space</kbd>).</li>
   <li><span className="is-ribbon"/>Ribbons follow the melody: keep a finger on the ring (or hold <kbd>S</kbd> for blue, <kbd>L</kbd> for pink).</li>
   <li>{level==='jeff'?'Jeff tier: the gauge starts full and drains with misses. Run out and the song’s over.':'Fill the gauge past '+CLEAR_AT+'% by the end to clear the song.'} Bluetooth headphones? Nudge Timing up if notes feel early.</li>
  </ul>
 </div>
 return <div className="beat-stage"><canvas ref={canvas} className="beat-canvas" role="img" aria-label={'KONO Beat: '+info.title} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/></div>
}
