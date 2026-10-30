import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {LEVELS,APPROACH,accuracy,count,freshTally,grade,hitIn,judge,missedBy,readBeatBest,readOffset,saveBeatBest,saveOffset,type Judge,type Level,type Note,type Tally} from '../store/rhythm'
import {stopMusic} from '../arcadeAudio'
import charts from '../game/data/rhythmCharts.json'
import type {GameHandle} from './GameScreen'
import './rhythm-game.css'

type Song={id:string;title:string;bpm:number;ms:number;charts:Record<Level,number[][]>}
const SONGS=(charts as {songs:Song[]}).songs
const FROM:Record<string,string>={candy:'🍬 Candy crush',gems:'💎 Gem blitz',blast:'🧱 KONO blast','flow-1':'🌌 Flow · Drift','flow-2':'🌌 Flow · Tide','flow-3':'🌌 Flow · Pulse','flow-4':'🌌 Flow · Aurora','flow-5':'🌌 Flow · Zenith'}
const LANE_COLORS=['#ff7ab6','#7ad7ff','#9dff8a','#ffd36b']
const KEYS:Record<string,number>={d:0,f:1,j:2,k:3,arrowleft:0,arrowdown:1,arrowup:2,arrowright:3}
const WORD:Record<Judge,string>={perfect:'Perfect',great:'Great',good:'Good',miss:'Miss'}
const WORD_COLOR:Record<Judge,string>={perfect:'#ffe27a',great:'#7ae7ff',good:'#b9ff9e',miss:'#ff7a8a'}
export type BeatResult={song:string;title:string;level:Level;score:number;acc:number;grade:string;best:number;tally:Tally;full:boolean;failed:boolean;newBest:boolean}

/** KONO Beat: the arcade's songs as a rhythm game, after the falling-note games -- notes drop down four
 * lanes and are hit as they reach the line (D F J K or the arrow keys, or tap the lanes). Pick a song and
 * Easy, Medium or Jeff tier; the charts come from the songs themselves (store/rhythm). Perfect, Great and
 * Good build a combo and score; misses cost life (Easy never fails). The song is the clock: the notes are
 * placed by how far into the song it is, smoothed between the browser's time updates. A timing nudge (kept
 * on this device) fixes headphones that lag. */
export default function RhythmGame({ref,onEnd}:{ref:Ref<GameHandle>;onEnd:(r:BeatResult)=>void}){
 const [song,setSong]=useState(SONGS[0].id),[level,setLevel]=useState<Level>('easy'),[playing,setPlaying]=useState(false),[offset,setOffsetState]=useState(readOffset)
 const canvas=useRef<HTMLCanvasElement>(null),audio=useRef<HTMLAudioElement|null>(null)
 const notes=useRef<Note[]>([]),tally=useRef<Tally>(freshTally()),done=useRef(false)
 const fx=useRef<{lane:number;t:number;j:Judge}[]>([]),pressed=useRef([0,0,0,0]),word=useRef<{j:Judge;t:number}|null>(null)
 const clock=useRef({a:-1,p:0}),onEndRef=useRef(onEnd)
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
 const finish=()=>{
  if(done.current)return;done.current=true
  audio.current?.pause()
  const t=tally.current,acc=accuracy(t),left=notes.current.filter(n=>!n.hit).length
  const full=!t.failed&&t.miss===0&&left===0
  const newBest=!t.failed&&saveBeatBest(info.id,level,t.score,acc)
  onEndRef.current({song:info.id,title:info.title,level,score:t.score,acc,grade:t.failed?'F':grade(acc),best:t.best,tally:t,full,failed:t.failed,newBest})
 }
 const finishRef=useRef(finish);useEffect(()=>{finishRef.current=finish})
 useImperativeHandle(ref,()=>({end:()=>finishRef.current()}),[])
 const press=(lane:number)=>{
  if(!playing||done.current)return
  pressed.current[lane]=performance.now()
  const ms=songMs()-offset,i=hitIn(notes.current,lane,ms,level);if(i<0)return
  const n=notes.current[i],j=judge(ms-n.t,level);n.hit=j;n.off=ms-n.t
  tally.current=count(tally.current,j,level);fx.current.push({lane,t:performance.now(),j});word.current={j,t:performance.now()}
  if(j==='perfect')navigator.vibrate?.(6)
 }
 const pressRef=useRef(press);useEffect(()=>{pressRef.current=press})
 // Keys: D F J K, or the arrows.
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{const lane=KEYS[e.key.toLowerCase()];if(lane===undefined||!playing)return;e.preventDefault();if(!e.repeat)pressRef.current(lane)}
  window.addEventListener('keydown',down);return()=>window.removeEventListener('keydown',down)
 },[playing])
 // The song pauses with the app in the background.
 useEffect(()=>{const vis=()=>{const a=audio.current;if(!a||done.current||!playing)return;if(document.hidden)a.pause();else void a.play().catch(()=>undefined)};document.addEventListener('visibilitychange',vis);return()=>document.removeEventListener('visibilitychange',vis)},[playing])
 useEffect(()=>()=>{audio.current?.pause();audio.current=null},[])

 const start=()=>{
  stopMusic()
  notes.current=info.charts[level].map(([t,lane])=>({t,lane}));tally.current=freshTally();done.current=false;fx.current=[];word.current=null
  const a=new Audio('/audio/games/'+info.id+'.mp3');a.preload='auto';audio.current=a;clock.current={a:-1,p:0}
  a.addEventListener('ended',()=>finishRef.current(),{once:true})
  setPlaying(true);void a.play().catch(()=>undefined)
 }

 // Drawing, every frame while playing.
 useEffect(()=>{
  if(!playing)return
  const cv=canvas.current;if(!cv)return
  const ctx=cv.getContext('2d');if(!ctx)return
  let raf=0
  const draw=()=>{
   raf=requestAnimationFrame(draw)
   const dpr=Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth,H=cv.clientHeight
   if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
   ctx.setTransform(dpr,0,0,dpr,0,0)
   const now=songMs()-offset,ap=APPROACH[level],lw=Math.min(110,W/4.4),left=(W-lw*4)/2,hitY=H-96,top=24
   cv.dataset.ms=String(Math.round(now)) // where the song is (the tests follow it)
   // Misses: notes that went by.
   for(const i of missedBy(notes.current,now,level)){const n=notes.current[i];n.hit='miss';tally.current=count(tally.current,'miss',level);word.current={j:'miss',t:performance.now()}}
   if(tally.current.failed&&!done.current){finishRef.current();return}
   const lastT=notes.current.length?notes.current[notes.current.length-1].t:0
   if(!done.current&&now>lastT+2500&&notes.current.every(n=>n.hit))finishRef.current()
   // The field: dark, pulsing a little on the beat.
   const beat=60000/info.bpm,pulse=Math.max(0,1-((now%beat)+beat)%beat/beat)
   const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#160f2b');g.addColorStop(1,'#2a1740');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
   for(let l=0;l<4;l++){
    const x=left+l*lw,flash=Math.max(0,1-(performance.now()-pressed.current[l])/180)
    ctx.fillStyle=`rgba(255,255,255,${0.035+flash*0.12})`;ctx.fillRect(x+3,0,lw-6,H)
    ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()
   }
   // The line, and each lane's target.
   ctx.fillStyle=`rgba(255,255,255,${0.25+pulse*0.25})`;ctx.fillRect(left,hitY-2,lw*4,4)
   for(let l=0;l<4;l++){const cx=left+l*lw+lw/2,flash=Math.max(0,1-(performance.now()-pressed.current[l])/180)
    ctx.beginPath();ctx.arc(cx,hitY,lw*0.32,0,Math.PI*2);ctx.strokeStyle=LANE_COLORS[l];ctx.globalAlpha=0.55+flash*0.45;ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1
    ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='700 13px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('DFJK'[l],cx,H-50)}
   // Notes coming down.
   for(const n of notes.current){
    if(n.hit)continue
    const d=n.t-now;if(d>ap)break
    const y=hitY-d/ap*(hitY-top),cx=left+n.lane*lw+lw/2,w=lw*0.74,h=Math.max(16,lw*0.24)
    ctx.shadowColor=LANE_COLORS[n.lane];ctx.shadowBlur=14;ctx.fillStyle=LANE_COLORS[n.lane]
    ctx.beginPath();ctx.roundRect(cx-w/2,y-h/2,w,h,h/2);ctx.fill();ctx.shadowBlur=0
    ctx.fillStyle='rgba(255,255,255,0.75)';ctx.beginPath();ctx.roundRect(cx-w/2+6,y-h/2+3,w-12,h*0.32,h*0.16);ctx.fill()
   }
   // Hits: rings that open out.
   const t=performance.now();fx.current=fx.current.filter(f=>t-f.t<400)
   for(const f of fx.current){const k=(t-f.t)/400,cx=left+f.lane*lw+lw/2;ctx.beginPath();ctx.arc(cx,hitY,lw*(0.3+k*0.5),0,Math.PI*2);ctx.strokeStyle=WORD_COLOR[f.j];ctx.globalAlpha=1-k;ctx.lineWidth=4;ctx.stroke();ctx.globalAlpha=1}
   // Combo, score, life and how far into the song.
   const s=tally.current
   ctx.textAlign='center';ctx.fillStyle='#fff'
   if(s.combo>=5){ctx.font='800 '+Math.round(28+Math.min(16,s.combo/10))+'px system-ui,sans-serif';ctx.globalAlpha=0.85;ctx.fillText(String(s.combo),W/2,hitY*0.42);ctx.font='700 12px system-ui,sans-serif';ctx.fillText('COMBO',W/2,hitY*0.42+18);ctx.globalAlpha=1}
   const wd=word.current;if(wd&&t-wd.t<600){ctx.font='900 24px system-ui,sans-serif';ctx.fillStyle=WORD_COLOR[wd.j];ctx.globalAlpha=1-(t-wd.t)/600;ctx.fillText(WORD[wd.j],W/2,hitY*0.55);ctx.globalAlpha=1}
   ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='800 18px system-ui,sans-serif';ctx.fillText(s.score.toLocaleString(),12,26)
   ctx.font='600 12px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.7)';ctx.fillText(accuracy(s).toFixed(1)+'%',12,44)
   ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(0,0,W,4);ctx.fillStyle='#ffd36b';ctx.fillRect(0,0,W*Math.min(1,Math.max(0,now)/info.ms),4)
   if(level!=='easy'){const lx=W-112;ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(lx,16,100,8);ctx.fillStyle=s.life>30?'#9dff8a':'#ff7a8a';ctx.fillRect(lx,16,s.life,8)}
  }
  raf=requestAnimationFrame(draw)
  return()=>cancelAnimationFrame(raf)
 // eslint-disable-next-line react-hooks/exhaustive-deps -- runs while a song plays
 },[playing])

 const lanePress=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect(),W=r.width,lw=Math.min(110,W/4.4),left=(W-lw*4)/2,lane=Math.floor((e.clientX-r.left-left)/lw);if(lane>=0&&lane<4){e.preventDefault();press(lane)}}

 if(!playing)return <div className="beat-pick">
  <section aria-label="Songs"><h3>Pick a song</h3><ul className="beat-songs">{SONGS.map(s=>{const b=readBeatBest(s.id,level);return <li key={s.id}><button type="button" aria-pressed={song===s.id} onClick={()=>setSong(s.id)}><b>{s.title}</b><small>{FROM[s.id]} · {Math.round(s.bpm)} BPM · {Math.floor(s.ms/60000)}:{String(Math.floor(s.ms/1000)%60).padStart(2,'0')}</small>{b&&<i aria-label={'Best '+b.grade}>{b.grade}</i>}</button></li>})}</ul></section>
  <section aria-label="Difficulty"><h3>Difficulty</h3><div className="beat-levels" role="group" aria-label="Difficulty">{LEVELS.map(l=><button type="button" key={l.id} aria-pressed={level===l.id} className={'is-'+l.id} onClick={()=>setLevel(l.id)}><b>{l.name}</b><small>{info.charts[l.id].length} notes · {l.blurb}</small></button>)}</div></section>
  <div className="beat-go">
   <label className="beat-offset">Timing <button type="button" aria-label="Notes earlier" onClick={()=>{const v=offset-10;setOffsetState(v);saveOffset(v)}}>−</button><output>{offset>0?'+':''}{offset} ms</output><button type="button" aria-label="Notes later" onClick={()=>{const v=offset+10;setOffsetState(v);saveOffset(v)}}>＋</button></label>
   <button type="button" className="primary beat-play" onClick={start}>▶ Play {info.title}</button>
  </div>
  <p className="beat-how">Hit each note as it reaches the line: <kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd> (or the arrows), or tap the lanes. With Bluetooth headphones, nudge Timing up if the notes feel early.</p>
 </div>
 return <div className="beat-stage"><canvas ref={canvas} className="beat-canvas" role="img" aria-label={'KONO Beat: '+info.title} onPointerDown={lanePress}/></div>
}
