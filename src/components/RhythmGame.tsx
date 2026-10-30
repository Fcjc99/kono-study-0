import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {LEVELS,CLEAR_AT,CLEAR_NAME,WINDOWS,accuracy,approachFor,clearOf,count,freshTally,grade,hitIn,missedBy,playOf,readBeatBest,readOffset,readSpeed,ribbonX,saveBeatBest,saveOffset,saveSpeed,scoreOf,skyHit,judge,type Chart,type Clear,type Judge,type Level,type Play,type Tally} from '../store/rhythm'
import {stopMusic} from '../arcadeAudio'
import charts from '../game/data/rhythmCharts.json'
import type {GameHandle} from './GameScreen'
import './rhythm-game.css'

type Song={id:string;title:string;bpm:number;ms:number;charts:Record<Level,Chart>}
const SONGS=(charts as unknown as {songs:Song[]}).songs
const FROM:Record<string,string>={candy:'🍬 Candy crush',gems:'💎 Gem blitz',blast:'🧱 KONO blast','flow-1':'🌌 Flow · Drift','flow-2':'🌌 Flow · Tide','flow-3':'🌌 Flow · Pulse','flow-4':'🌌 Flow · Aurora','flow-5':'🌌 Flow · Zenith'}
const LANE_COLORS=['#ff7ab6','#7ad7ff','#9dff8a','#ffd36b']
const HAND_COLORS=['#5fd3ff','#ff7ad1']
const LEVEL_COLORS:Record<Level,string>={easy:'#3fb59a',medium:'#e0953c',jeff:'#c65ad0'}
// Each song's cover: an emoji on two colors.
const JACKETS:Record<string,[string,string,string]>={candy:['🍬','#ff9ac8','#ffd58a'],gems:['💎','#7fd8ff','#a98bff'],blast:['🧱','#ffb36b','#ff6b8a'],'flow-1':['🌌','#3a3f9e','#8fa2ff'],'flow-2':['🌊','#2f7fb8','#9ff0ff'],'flow-3':['🌙','#2a2350','#c27bff'],'flow-4':['🌠','#4b2d8f','#ff9ae0'],'flow-5':['✨','#1d5a6e','#ffe28a']}
function Jacket({id,big=false}:{id:string;big?:boolean}){const [e,a,b]=JACKETS[id]??['🎵','#888','#ccc'];return <span className={'beat-jacket'+(big?' is-big':'')} style={{'--j1':a,'--j2':b} as React.CSSProperties} aria-hidden="true"><span>{e}</span></span>}
/** How hard a chart is, 1-12: how many things to do a second (holds, sky notes and ribbons count a bit more). */
function ratingOf(s:Song,level:Level){const c=s.charts[level],busy=(c.tap.length+c.hold.length*1.3+c.sky.length*1.4+c.ribbon.length*0.5)/(s.ms/1000);return Math.max(1,Math.min(12,Math.round(1+busy*2.4)))}
// Motes of light drifting up the sky behind the track (made once: x, y, size, brightness, speed, phase).
const MOTES=Array.from({length:42},(_,i)=>{const r=(k:number)=>{const v=Math.sin(i*12.9898+k*78.233)*43758.5453;return v-Math.floor(v)};return {x:r(1),y:r(2),r:0.6+r(3)*1.8,a:0.2+r(4)*0.5,v:1+r(5)*3,p:r(6)*6}})
const KEYS:Record<string,number>={d:0,f:1,j:2,k:3,arrowleft:0,arrowdown:1,arrowup:2,arrowright:3}
const WORD:Record<Judge,string>={perfect:'Perfect',great:'Great',good:'Good',miss:'Miss'}
const WORD_COLOR:Record<Judge,string>={perfect:'#ffe27a',great:'#7ae7ff',good:'#b9ff9e',miss:'#ff7a8a'}
// The last song loaded (decoded once, so Play again starts straight away).
const decoded=new Map<string,AudioBuffer>()
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
 * down four lanes (D F J K or the arrows, or tap the lanes; a hold stays pressed to its end). Sky notes (tap up
 * high, or Space) and ribbons (keep a finger on them, or hold S / L) still work, but the charts leave them out
 * for now. Pick a song and Easy, Medium or Jeff tier (store/rhythm has
 * the rules). The song is the clock: it plays through Web Audio, and the notes follow the sound card's clock
 * (less the time sound takes to reach the speakers). Note speed and a timing nudge (for headphones that lag) are kept on this device. */
export default function RhythmGame({ref,onEnd}:{ref:Ref<GameHandle>;onEnd:(r:BeatResult)=>void}){
 const [song,setSong]=useState(SONGS[0].id),[level,setLevel]=useState<Level>('easy'),[playing,setPlaying]=useState(false)
 const [offset,setOffsetState]=useState(readOffset),[speed,setSpeedState]=useState(readSpeed)
 const canvas=useRef<HTMLCanvasElement>(null),audio=useRef<{ctx:AudioContext;src:AudioBufferSourceNode;t0:number}|null>(null),[loading,setLoading]=useState(false)
 const play=useRef<Play>({notes:[],ribbons:[],ticks:[],total:0}),tally=useRef<Tally>(freshTally('easy')),done=useRef(false),nextTick=useRef(0)
 const fx=useRef<{x:number;sky:boolean;t:number;j:Judge}[]>([]),word=useRef<{j:Judge;t:number;off?:number}|null>(null)
 // What's held down: floor lanes (keys or fingers), the ribbon keys, and each finger's place.
 const lanesHeld=useRef([0,0,0,0]),keysHeld=useRef<Set<string>>(new Set()),pointers=useRef(new Map<number,{x:number;y:number;lane:number}>())
 const pressedAt=useRef([0,0,0,0]),startedAt=useRef(0),onEndRef=useRef(onEnd)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 const info=SONGS.find(s=>s.id===song)!
 // Where the song is (ms), on the sound card's own clock (exact to the sample), less the time the sound
 // takes to reach the speakers, so a note reaches the line as you hear its hit.
 const songMs=()=>{const a=audio.current;if(!a)return 0;const c=a.ctx;return (c.currentTime-a.t0-(c.outputLatency||c.baseLatency||0))*1000}
 const stopSong=()=>{const a=audio.current;audio.current=null;if(!a)return;try{a.src.onended=null;a.src.stop()}catch{/* not started */}void a.ctx.close().catch(()=>undefined)}
 const judged=()=>play.current.notes.filter(n=>n.hit).length+nextTick.current
 const finish=()=>{
  if(done.current)return;done.current=true
  stopSong()
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
 useEffect(()=>{const vis=()=>{const a=audio.current;if(!a||done.current||!playing)return;void (document.hidden?a.ctx.suspend():a.ctx.resume()).catch(()=>undefined)};document.addEventListener('visibilitychange',vis);return()=>document.removeEventListener('visibilitychange',vis)},[playing])
 const stopRef=useRef(stopSong);useEffect(()=>{stopRef.current=stopSong})
 useEffect(()=>()=>stopRef.current(),[])

 // Play: the song is loaded whole and played through Web Audio (its clock is what the notes follow), starting
 // a moment after the track appears.
 const start=async()=>{
  if(loading)return
  stopMusic();setLoading(true)
  const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext
  const ctx=new Ctx()
  try{
   let buf=decoded.get(info.id)
   if(!buf){const data=await (await fetch('/audio/games/'+info.id+'.mp3')).arrayBuffer();buf=await ctx.decodeAudioData(data);decoded.clear();decoded.set(info.id,buf)}
   play.current=playOf(info.charts[level],info.bpm);tally.current=freshTally(level);done.current=false;fx.current=[];word.current=null;nextTick.current=0
   lanesHeld.current=[0,0,0,0];keysHeld.current.clear();pointers.current.clear()
   const src=ctx.createBufferSource();src.buffer=buf;src.connect(ctx.destination)
   await ctx.resume().catch(()=>undefined)
   const t0=ctx.currentTime+0.8;src.start(t0);src.onended=()=>finishRef.current()
   audio.current={ctx,src,t0};startedAt.current=performance.now()
   setPlaying(true)
  }catch{void ctx.close().catch(()=>undefined)}
  finally{setLoading(false)}
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
   // A twilight sky with a glow at the horizon and motes of light drifting up; the track is dark glass.
   const beat=60000/info.bpm,pulse=Math.max(0,1-(((now%beat)+beat)%beat)/beat)
   const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1a1d4a');g.addColorStop(0.42,'#4d4f9c');g.addColorStop(0.78,'#a99ad8');g.addColorStop(1,'#f0d6ea');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
   const hg=ctx.createRadialGradient(f.cx,f.horizonY,0,f.cx,f.horizonY,Math.max(W,H)*0.55);hg.addColorStop(0,`rgba(255,238,250,${0.5+pulse*0.12})`);hg.addColorStop(1,'rgba(255,238,250,0)');ctx.fillStyle=hg;ctx.fillRect(0,0,W,H)
   ctx.fillStyle='#fff'
   for(const m of MOTES){const y=((m.y-t*m.v/1e5)%1+1)%1;ctx.globalAlpha=m.a*(0.55+0.45*Math.sin(t/900+m.p));ctx.beginPath();ctx.arc(m.x*W,y*H,m.r,0,Math.PI*2);ctx.fill()}
   ctx.globalAlpha=1
   const far=1.15,L=(x:number,z:number)=>[xAt(f,x,z),yAt(f,z)] as const
   const quad=(x0:number,x1:number,z0:number,z1:number)=>{ctx.beginPath();ctx.moveTo(...L(x0,z1));ctx.lineTo(...L(x1,z1));ctx.lineTo(...L(x1,z0));ctx.lineTo(...L(x0,z0));ctx.closePath()}
   quad(0,1,0,far);const tg=ctx.createLinearGradient(0,f.horizonY,0,f.hitY);tg.addColorStop(0,'rgba(18,16,48,0.25)');tg.addColorStop(1,'rgba(18,16,48,0.72)');ctx.fillStyle=tg;ctx.fill()
   for(let l=0;l<4;l++){if(lanesHeld.current[l]>0||t-pressedAt.current[l]<140){quad(l/4,(l+1)/4,0,far);const lg=ctx.createLinearGradient(0,f.hitY,0,f.horizonY);lg.addColorStop(0,LANE_COLORS[l]+'66');lg.addColorStop(1,LANE_COLORS[l]+'00');ctx.fillStyle=lg;ctx.fill()}}
   ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,0.13)'
   for(let l=1;l<4;l++){ctx.beginPath();ctx.moveTo(...L(l/4,far));ctx.lineTo(...L(l/4,0));ctx.stroke()}
   ctx.strokeStyle='rgba(255,255,255,0.75)';ctx.lineWidth=2;ctx.shadowColor='#fff';ctx.shadowBlur=10
   for(const e of [0,1]){ctx.beginPath();ctx.moveTo(...L(e,far));ctx.lineTo(...L(e,0));ctx.stroke()}
   ctx.shadowBlur=0
   // Beat lines run down the track, a bar line a little brighter.
   for(let b=Math.ceil(now/beat)*beat;b<now+ap*far;b+=beat){const z=(b-now)/ap,bar=Math.round(b/beat)%4===0;ctx.strokeStyle=bar?'rgba(255,255,255,0.18)':'rgba(255,255,255,0.06)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...L(0,z));ctx.lineTo(...L(1,z));ctx.stroke()}
   // The line, glowing on the beat, and the sky line above it.
   ctx.shadowColor='#fff';ctx.shadowBlur=14+pulse*12;ctx.fillStyle='#fff';ctx.fillRect(xAt(f,0,0),f.hitY-1.5,f.floorW,3);ctx.shadowBlur=0
   const sy=skyY(f,0),hasSky=pl.ribbons.length>0||pl.notes.some(n=>n.kind==='sky')
   if(hasSky){ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1.5;ctx.setLineDash([6,8]);ctx.beginPath();ctx.moveTo(xAt(f,0,0),sy);ctx.lineTo(xAt(f,1,0),sy);ctx.stroke();ctx.setLineDash([])
   for(const e of [0,1]){ctx.fillStyle='rgba(255,255,255,0.7)';ctx.beginPath();ctx.arc(xAt(f,e,0),sy,3,0,Math.PI*2);ctx.fill()}}
   ctx.textAlign='center';ctx.font='500 11px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.55)'
   for(let l=0;l<4;l++)ctx.fillText('DFJK'[l],xAt(f,(l+0.5)/4,0),f.hitY+22)
   // Ribbons: a soft wide glow under a bright core, from the line out to the distance.
   for(const r of pl.ribbons){
    if(r.t1<now||r.t0>now+ap*far)continue
    const a=Math.max(r.t0,now),b=Math.min(r.t1,now+ap*far),steps=Math.max(2,Math.ceil((b-a)/40)),pts:[number,number,number][]=[]
    for(let s=0;s<=steps;s++){const tt=a+(b-a)*s/steps,z=(tt-now)/ap;pts.push([xAt(f,ribbonX(r,tt),z),skyY(f,z),persp(z)])}
    ctx.lineCap='round'
    for(const [wid,col,al] of [[26,HAND_COLORS[r.hand],0.28],[9,'#ffffff',0.85]] as const)for(let s=1;s<pts.length;s++){ctx.globalAlpha=al*(0.5+0.5*pts[s][2]);ctx.strokeStyle=col;ctx.lineWidth=Math.max(1.5,wid*pts[s][2]);ctx.beginPath();ctx.moveTo(pts[s-1][0],pts[s-1][1]);ctx.lineTo(pts[s][0],pts[s][1]);ctx.stroke()}
    // Its shadow on the track, so you can tell where it is.
    ctx.globalAlpha=0.18;ctx.strokeStyle=HAND_COLORS[r.hand];ctx.lineWidth=4;ctx.beginPath();for(let s=0;s<=steps;s++){const tt=a+(b-a)*s/steps,z=(tt-now)/ap,x=xAt(f,ribbonX(r,tt),z),y=yAt(f,z);if(s)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.stroke()
    ctx.globalAlpha=1
   }
   // Where to keep a finger: a ring on each ribbon at the line, lit while it's followed.
   for(const {r,i} of live){const x=xAt(f,ribbonX(r,now),0),on=onRibbon(i);ctx.shadowColor=HAND_COLORS[r.hand];ctx.shadowBlur=on?22:8;ctx.beginPath();ctx.arc(x,sy,on?21:16,0,Math.PI*2);ctx.strokeStyle=on?'#fff':HAND_COLORS[r.hand];ctx.lineWidth=3;ctx.stroke();if(on){ctx.fillStyle=HAND_COLORS[r.hand]+'66';ctx.fill()}ctx.shadowBlur=0}
   // Notes, far ones first: glassy bars on the floor, prisms in the sky.
   for(let i=pl.notes.length-1;i>=0;i--){
    const n=pl.notes[i],z=(n.t-now)/ap
    if(z>far)continue
    if(n.kind==='hold'&&n.end){
     if(n.end<now-60)continue
     const z0=Math.max(0,z),z1=Math.min(far,(n.end-now)/ap),w=0.085,keeping=n.hit&&n.hit!=='miss'&&lanesHeld.current[n.lane]>0
     if(z1>z0){quad(n.x-w,n.x+w,z0,z1);const hg2=ctx.createLinearGradient(0,yAt(f,z0),0,yAt(f,z1));hg2.addColorStop(0,LANE_COLORS[n.lane]+(n.hit==='miss'?'30':keeping?'ee':'99'));hg2.addColorStop(1,LANE_COLORS[n.lane]+'22');ctx.fillStyle=hg2;ctx.fill();ctx.strokeStyle='rgba(255,255,255,'+(n.hit==='miss'?0.15:0.6)+')';ctx.lineWidth=1.5;ctx.stroke()}
     if(n.hit)continue
    }else if(n.hit||z<-0.2)continue
    const p=persp(z)
    if(n.kind==='sky'){
     const x=xAt(f,n.x,z),y=skyY(f,z),s=15*p
     ctx.fillStyle='rgba(255,255,255,0.22)';ctx.beginPath();ctx.ellipse(x,yAt(f,z),s*1.4,s*0.35,0,0,Math.PI*2);ctx.fill()
     ctx.shadowColor='#bfe9ff';ctx.shadowBlur=18*p
     ctx.beginPath();ctx.moveTo(x,y-s*1.3);ctx.lineTo(x+s*1.5,y);ctx.lineTo(x,y+s*1.3);ctx.lineTo(x-s*1.5,y);ctx.closePath()
     const pg=ctx.createLinearGradient(x-s,y-s,x+s,y+s);pg.addColorStop(0,'#ffffff');pg.addColorStop(1,'#9fd9ff');ctx.fillStyle=pg;ctx.fill();ctx.shadowBlur=0
     ctx.strokeStyle='rgba(60,90,160,0.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-s*1.5,y);ctx.lineTo(x+s*1.5,y);ctx.stroke()
     continue
    }
    const x=xAt(f,n.x,z),y=yAt(f,z),w=f.floorW*0.21*p,h=Math.max(5,13*p)
    ctx.shadowColor=LANE_COLORS[n.lane];ctx.shadowBlur=16*p
    const ng=ctx.createLinearGradient(0,y-h/2,0,y+h/2);ng.addColorStop(0,'#ffffff');ng.addColorStop(0.5,LANE_COLORS[n.lane]);ng.addColorStop(1,LANE_COLORS[n.lane]);ctx.fillStyle=ng
    ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,3*p+1);ctx.fill();ctx.shadowBlur=0
    ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=1;ctx.stroke()
   }
   // Hits: a ring and a few sparks where they landed.
   fx.current=fx.current.filter(e=>t-e.t<450)
   for(const e of fx.current){const k=(t-e.t)/450,x=xAt(f,e.x,0),y=e.sky?sy:f.hitY,c=WORD_COLOR[e.j]
    ctx.globalAlpha=1-k;ctx.strokeStyle=c;ctx.lineWidth=3*(1-k)+1;ctx.beginPath();ctx.arc(x,y,20+k*44,0,Math.PI*2);ctx.stroke()
    if(e.j!=='miss'){ctx.fillStyle='#fff';for(let q=0;q<8;q++){const ang=q*Math.PI/4+e.t%1,d=10+k*60;ctx.beginPath();ctx.arc(x+Math.cos(ang)*d,y+Math.sin(ang)*d*0.6,2.2*(1-k)+0.5,0,Math.PI*2);ctx.fill()}}
    ctx.globalAlpha=1}
   // Fingers.
   for(const p of pointers.current.values()){ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=2;ctx.stroke()}
   // Combo and the word (with Early or Late), thin and spaced out.
   const s=tally.current,spaced=(txt:string)=>txt.split('').join(' ')
   cv.dataset.score=String(scoreOf(s,pl.total))
   ctx.textAlign='center';ctx.fillStyle='#fff'
   if(s.combo>=5){const y=f.horizonY+(f.hitY-f.horizonY)*0.32;ctx.globalAlpha=0.85;ctx.font='200 '+Math.round(34+Math.min(14,s.combo/15))+'px system-ui,sans-serif';ctx.fillText(String(s.combo),f.cx,y);ctx.font='600 10px system-ui,sans-serif';ctx.fillText(spaced('COMBO'),f.cx,y+16);ctx.globalAlpha=1}
   const wd=word.current
   if(wd&&t-wd.t<600){const y=f.horizonY+(f.hitY-f.horizonY)*0.48,k=(t-wd.t)/600;ctx.globalAlpha=1-k;ctx.font='300 '+Math.round(22+(1-Math.min(1,k*4))*4)+'px system-ui,sans-serif';ctx.fillStyle=WORD_COLOR[wd.j];ctx.shadowColor=WORD_COLOR[wd.j];ctx.shadowBlur=10;ctx.fillText(spaced(WORD[wd.j].toUpperCase()),f.cx,y);ctx.shadowBlur=0
    if(wd.off!==undefined&&wd.j!=='miss'&&wd.j!=='perfect'){ctx.font='600 10px system-ui,sans-serif';ctx.fillStyle=wd.off<0?'#a9dcff':'#ffc2a9';ctx.fillText(spaced(wd.off<0?'EARLY':'LATE'),f.cx,y+16)}
    else if(wd.off!==undefined&&Math.abs(wd.off)<=WINDOWS[level][0]/2){ctx.font='600 11px system-ui,sans-serif';ctx.fillStyle='#fff6c2';ctx.fillText('✦',f.cx,y+16)}
    ctx.globalAlpha=1}
   // Top: the song and level on the left; the score, with the gauge under it, on the right.
   ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='300 15px system-ui,sans-serif';ctx.fillText(info.title,14,28)
   const lv=LEVELS.find(l=>l.id===level)!,chip=lv.name+' '+ratingOf(info,level);ctx.font='700 10px system-ui,sans-serif';const cw=ctx.measureText(chip).width+14
   ctx.fillStyle=LEVEL_COLORS[level];ctx.beginPath();ctx.roundRect(14,36,cw,17,8.5);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(chip,21,48)
   ctx.textAlign='right';ctx.font='200 28px system-ui,sans-serif';ctx.fillStyle='#fff';ctx.fillText(String(scoreOf(s,pl.total)).padStart(7,'0').replace(/\B(?=(\d{3})+(?!\d))/g,','),W-14,34)
   const gw=Math.min(150,W*0.36),gx=W-14-gw;ctx.fillStyle='rgba(255,255,255,0.2)';ctx.beginPath();ctx.roundRect(gx,42,gw,6,3);ctx.fill()
   ctx.fillStyle=level==='jeff'?(s.gauge>30?'#ff8ad8':'#ff4d6a'):s.gauge>=CLEAR_AT?'#9dffcf':'#a9c8ff';ctx.beginPath();ctx.roundRect(gx,42,Math.max(0,gw*s.gauge/100),6,3);ctx.fill()
   if(level!=='jeff'){ctx.fillStyle='#fff';ctx.fillRect(gx+gw*CLEAR_AT/100-1,39,2,12)}
   ctx.font='600 10px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.8)';ctx.fillText(Math.floor(s.gauge)+'%',W-14,64)
   ctx.fillStyle='rgba(255,255,255,0.18)';ctx.fillRect(0,H-3,W,3);ctx.fillStyle='#fff';ctx.fillRect(0,H-3,W*Math.min(1,Math.max(0,now)/info.ms),3)
   // The start: the song's name slides in across a band of light.
   const since=t-startedAt.current
   if(since<2400){const k=since/2400,a=k<0.15?k/0.15:k>0.75?(1-k)/0.25:1,y=H*0.42
    ctx.globalAlpha=a*0.85;const bg=ctx.createLinearGradient(0,0,W,0);bg.addColorStop(0,'rgba(255,255,255,0)');bg.addColorStop(0.5,'rgba(255,255,255,0.9)');bg.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=bg;ctx.fillRect(0,y-38,W,76)
    ctx.globalAlpha=a;ctx.textAlign='center';ctx.fillStyle='#2a2858';ctx.font='300 '+Math.min(30,W/14)+'px system-ui,sans-serif';ctx.fillText(info.title,f.cx+(1-a)*30,y+4)
    ctx.font='700 11px system-ui,sans-serif';ctx.fillStyle=LEVEL_COLORS[level];ctx.fillText(spaced((lv.name+' · '+ratingOf(info,level)).toUpperCase()),f.cx,y+24);ctx.globalAlpha=1}
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

 const best=readBeatBest(info.id,level),lv=LEVELS.find(l=>l.id===level)!
 if(!playing)return <div className="beat-pick">
  <section className="beat-list" aria-label="Songs"><h3>Songs</h3><ul className="beat-songs">{SONGS.map(s=>{const b=readBeatBest(s.id,level);return <li key={s.id}><button type="button" aria-pressed={song===s.id} onClick={()=>setSong(s.id)}><Jacket id={s.id}/><span className="beat-song-text"><b>{s.title}</b><small>{FROM[s.id]}</small></span>{b&&<i aria-label={'Best '+b.score.toLocaleString()+', '+b.grade+(b.clear!=='fail'?', '+CLEAR_NAME[b.clear]:'')}>{b.grade}{CLEAR_MARK[b.clear]&&<em>{CLEAR_MARK[b.clear]}</em>}</i>}</button></li>})}</ul></section>
  <section className="beat-detail" aria-label="Song" style={{'--lv':LEVEL_COLORS[level]} as React.CSSProperties}>
   <Jacket id={info.id} big/>
   <div className="beat-info">
    <h3>{info.title}</h3>
    <p>{FROM[info.id]} · {Math.round(info.bpm)} BPM · {Math.floor(info.ms/60000)}:{String(Math.floor(info.ms/1000)%60).padStart(2,'0')}</p>
    <p className="beat-best">{best?<>Best <b>{best.score.toLocaleString()}</b> <span>{best.grade}</span>{best.clear!=='fail'&&<span>{CLEAR_NAME[best.clear].replace('!','')}</span>}</>:'Not played yet on '+lv.name}</p>
   </div>
   <div className="beat-levels" role="group" aria-label="Difficulty">{LEVELS.map(l=><button type="button" key={l.id} aria-pressed={level===l.id} className={'is-'+l.id} style={{'--lv':LEVEL_COLORS[l.id]} as React.CSSProperties} onClick={()=>setLevel(l.id)}><span>{l.name}</span><b>{ratingOf(info,l.id)}</b></button>)}</div>
   <p className="beat-blurb">{(()=>{const c=info.charts[level];return c.tap.length+c.hold.length+c.sky.length})()} notes · {lv.blurb}</p>
   <div className="beat-settings">
    <label className="beat-offset">Speed <button type="button" aria-label="Notes slower" onClick={()=>setSpeed(speed-0.5)}>−</button><output>{speed.toFixed(1)}</output><button type="button" aria-label="Notes faster" onClick={()=>setSpeed(speed+0.5)}>＋</button></label>
    <label className="beat-offset">Timing <button type="button" aria-label="Notes earlier" onClick={()=>nudge(-10)}>−</button><output>{offset>0?'+':''}{offset} ms</output><button type="button" aria-label="Notes later" onClick={()=>nudge(10)}>＋</button></label>
   </div>
   <button type="button" className="beat-play" onClick={()=>void start()} disabled={loading}>{loading?'Loading…':<>▶ Play <span>{info.title}</span></>}</button>
   <details className="beat-how"><summary>How to play</summary><ul>
    <li><span className="is-floor"/>Floor notes: hit them on the line (<kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd>, or tap the lane). Long ones: hold to the end.</li>
    <li>{level==='jeff'?'Jeff tier: the gauge starts full and drains with misses. Run out and the song’s over.':'Fill the gauge past '+CLEAR_AT+'% by the end to clear the song.'} Notes land on the song’s beat; with Bluetooth headphones, nudge Timing up if they feel early.</li>
   </ul></details>
  </section>
 </div>
 return <div className="beat-stage"><canvas ref={canvas} className="beat-canvas" role="img" aria-label={'KONO Beat: '+info.title} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/></div>
}
