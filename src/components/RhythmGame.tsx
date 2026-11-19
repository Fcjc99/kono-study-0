import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {LEVELS,CLEAR_AT,CLEAR_NAME,accuracy,approachFor,clearOf,count,freshTally,grade,hitIn,missedBy,playOf,timingDrift,timingWasReset,readBeatBest,readClassic,readKeys,readOffset,readSpeed,readTicks,saveBeatBest,saveClassic,saveKeys,saveOffset,saveSpeed,saveTicks,wrongColumn,scoreOf,judge,type Chart,type Clear,type Judge,type Level,type Play,type Tally} from '../store/rhythm'
import {stopMusic} from '../arcadeAudio'
import {click,heardNow,inputLag,keyNote} from '../game/audioClock'
import BeatSync from './BeatSync'
import charts from '../game/data/rhythmCharts.json'
import type {GameHandle} from './GameScreen'
import './rhythm-game.css'

/** `hit: 'tick'`: a song whose chart pitches can't be trusted (the chart tool sets it when a sung song's pitches don't sit in its key): a hit plays a soft drum tick, not a note that could clash with the voice. */
type Song={id:string;title:string;bpm:number;ms:number;hit?:'tick';charts:Record<Level,Chart>}
const SONGS=(charts as unknown as {songs:Song[]}).songs
const FROM:Record<string,string>={candy:'🍬 Sweet swap',gems:'💎 Gem blitz',blast:'🧱 KONO blast','flow-1':'🌌 Flow · Drift','flow-2':'🌌 Flow · Tide','flow-3':'🌌 Flow · Pulse','flow-4':'🌌 Flow · Aurora','flow-5':'🌌 Flow · Zenith','beijing-delai':'🎤 With lyrics','casa-fantasma':'🎤 With lyrics','peanut-butter-delai':'🎤 With lyrics'}
const LANE_COLORS=['#ff7ab6','#7ad7ff','#9dff8a','#ffd36b']
const LEVEL_COLORS:Record<Level,string>={easy:'#3fb59a',medium:'#e0953c',jeff:'#c65ad0'}
// Each song's cover: an emoji on two colors.
const JACKETS:Record<string,[string,string,string]>={candy:['🍬','#ff9ac8','#ffd58a'],gems:['💎','#7fd8ff','#a98bff'],blast:['🧱','#ffb36b','#ff6b8a'],'flow-1':['🌌','#3a3f9e','#8fa2ff'],'flow-2':['🌊','#2f7fb8','#9ff0ff'],'flow-3':['🌙','#2a2350','#c27bff'],'flow-4':['🌠','#4b2d8f','#ff9ae0'],'flow-5':['✨','#1d5a6e','#ffe28a'],'beijing-delai':['🏮','#d8323c','#ffcf5a'],'casa-fantasma':['👻','#2b1d45','#7fe0c8'],'peanut-butter-delai':['🥜','#c98a4b','#ffe3a8']}
function Jacket({id,big=false}:{id:string;big?:boolean}){const [e,a,b]=JACKETS[id]??['🎵','#888','#ccc'];return <span className={'beat-jacket'+(big?' is-big':'')} style={{'--j1':a,'--j2':b} as React.CSSProperties} aria-hidden="true"><span>{e}</span></span>}
/** How hard a chart is, 1-12: how many things to do a second (holds, sky notes and ribbons count a bit more). */
function ratingOf(s:Song,level:Level){const c=s.charts[level],busy=(c.tap.length+c.hold.length*1.3+c.sky.length*1.4+c.ribbon.length*0.5)/(s.ms/1000);return Math.max(1,Math.min(12,Math.round(1+busy*2.4)))}
const KEYS:Record<string,number>={d:0,f:1,j:2,k:3,arrowleft:0,arrowdown:1,arrowup:2,arrowright:3}
const WORD:Record<Judge,string>={perfect:'Perfect',great:'Great',good:'Good',miss:'Miss'}
const WORD_COLOR:Record<Judge,string>={perfect:'#ffe27a',great:'#7ae7ff',good:'#b9ff9e',miss:'#ff7a8a'}
// The last song loaded (decoded once, so Play again starts straight away).
const decoded=new Map<string,AudioBuffer>()
/** How long a warm-up plays. */
const WARMUP_MS=30000
const CLEAR_MARK:Record<Clear,string>={fail:'',clear:'✓',full:'FC',all:'AP'}
export type BeatResult={drift:number|null;song:string;title:string;level:Level;score:number;acc:number;grade:string;best:number;tally:Tally;clear:Clear;failed:boolean;newBest:boolean;classic?:boolean;/** Ended with ■ End before the song was over. */ended?:boolean;warmup?:boolean;tiles:number;of:number
 /** Each tile, in order: when (ms into the song) and how it went (unplayed if the song stopped first). */
 timeline:{t:number;j:Judge|null}[];ms:number}

/** The board: four columns of tiles, side by side and centered (narrow and tall, like a piano's keys seen
 * from above), with the line near the bottom. Tiles come down from the top and reach the line on their note. */
type Board={W:number;H:number;x0:number;colW:number;top:number;hitY:number}
function boardOf(W:number,H:number):Board{const w=Math.min(W-16,Math.max(280,H*0.62),560),top=78;return {W,H,x0:(W-w)/2,colW:w/4,top,hitY:H-Math.max(70,H*0.15)}}
/** KONO Beat: the arcade's songs as a tiles game on a road seen in 3D. Dark tiles come toward you down four columns, one on each beat
 * where the song really hits (tools/make_rhythm_charts.py), low hits left and bright ones right; tap a tile's column
 * (or D F J K, or the arrows) as it reaches the line, and hold a long tile down to its end. Pick a song and
 * Easy, Medium or Jeff tier (store/rhythm has the rules). The song is the clock: it plays through Web Audio, and the notes follow the sound card's clock
 * (less the time sound takes to reach the speakers). Note speed and a timing nudge (for headphones that lag) are kept on this device. */
export default function RhythmGame({ref,onEnd}:{ref:Ref<GameHandle>;onEnd:(r:BeatResult)=>void}){
 const [song,setSong]=useState(SONGS[0].id),[level,setLevel]=useState<Level>('easy'),[playing,setPlaying]=useState(false)
 const [offset,setOffsetState]=useState(readOffset),[speed,setSpeedState]=useState(readSpeed),[ticks,setTicks]=useState(readTicks),[syncing,setSyncing]=useState(false),[reset]=useState(timingWasReset)
 const [keys,setKeys]=useState(readKeys),[classic,setClassic]=useState(readClassic)
 // Classic: when the song stopped on a wrong or missed tile (the board holds still on it a moment).
 const stoppedAt=useRef(0)
 // The Timing in use while a song plays (only you change it: the arrows, the Sync check or a results suggestion).
 const liveOffset=useRef(offset)
 // Warm-up: the first WARMUP_MS of the song, nothing kept (no fail, no best, no coins).
 const warm=useRef(false)
 // What a screen reader hears while the canvas plays: the start, every 25 in a combo, and a run of misses.
 const [spoken,setSpoken]=useState(''),spokenAt=useRef({combo:0,misses:0})
 const tickedTo=useRef(0)
 const canvas=useRef<HTMLCanvasElement>(null),audio=useRef<{ctx:AudioContext;src:AudioBufferSourceNode;t0:number}|null>(null),[loading,setLoading]=useState(false)
 const play=useRef<Play>({notes:[],ribbons:[],ticks:[],total:0}),tally=useRef<Tally>(freshTally('easy')),done=useRef(false),nextTick=useRef(0)
 const fx=useRef<{x:number;sky:boolean;t:number;j:Judge}[]>([]),word=useRef<{j:Judge;t:number;off?:number}|null>(null)
 // What's held down: floor lanes (keys or fingers), the ribbon keys, and each finger's place.
 const lanesHeld=useRef([0,0,0,0]),missAt=useRef([0,0,0,0]),pointers=useRef(new Map<number,{x:number;y:number;lane:number}>())
 const pressedAt=useRef([0,0,0,0]),startedAt=useRef(0),onEndRef=useRef(onEnd)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 const info=SONGS.find(s=>s.id===song)!
 // Where the song is (ms): what's reaching the speakers right now (game/audioClock), so a note reaches the
 // line as you hear its hit; the device's own extra delay is the Timing (set by the Sync check).
 const songMs=()=>{const a=audio.current;if(!a)return 0;return (heardNow(a.ctx)-a.t0)*1000}
 const stopSong=()=>{const a=audio.current;audio.current=null;if(!a)return;try{a.src.onended=null;a.src.stop()}catch{/* not started */}void a.ctx.close().catch(()=>undefined)}
 const judged=()=>play.current.notes.filter(n=>n.hit).length+nextTick.current
 const finish=()=>{
  if(done.current)return;done.current=true
  const early=!warm.current&&!stoppedAt.current&&songMs()-liveOffset.current<info.ms-2000
  stopSong()
  const t=tally.current,total=warm.current?Math.max(1,judged()):play.current.total,score=scoreOf(t,total),clear=clearOf(t,level,judged(),total)
  const newBest=!warm.current&&clear!=='fail'&&saveBeatBest(info.id,level,score,clear)
  onEndRef.current({drift:warm.current?null:timingDrift(play.current.notes.flatMap(n=>n.hit&&n.hit!=='miss'&&n.off!==undefined?[n.off]:[])),song:info.id,title:info.title,level,score,acc:accuracy(t,total),grade:early?grade(score):clear==='fail'&&!warm.current?'F':grade(score),ended:early,best:t.best,tally:t,clear:warm.current&&clear==='fail'?'clear':clear,failed:clear==='fail'&&!warm.current,newBest,classic,warmup:warm.current,tiles:play.current.notes.filter(n=>n.hit&&n.hit!=='miss').length,of:warm.current?play.current.notes.filter(n=>n.hit).length:play.current.notes.length,timeline:play.current.notes.filter(n=>n.kind!=='sky').map(n=>({t:n.t,j:n.hit??null})),ms:info.ms})
 }
 const finishRef=useRef(finish);useEffect(()=>{finishRef.current=finish})
 useImperativeHandle(ref,()=>({end:()=>finishRef.current()}),[])
 const mark=(i:number,ms:number)=>{
  const n=play.current.notes[i],off=ms-n.t,j=judge(off,level);n.hit=j;n.off=off
  tally.current=count(tally.current,j,level,play.current.total,{off});fx.current.push({x:n.x,sky:n.kind==='sky',t:performance.now(),j});word.current={j,t:performance.now(),off}
  if(j==='perfect')navigator.vibrate?.(6)
  // The tile's own note, so tapping along plays the tune.
  const a=audio.current;if(keys&&a){if(info.hit==='tick')click(a.ctx,a.ctx.currentTime,{freq:n.lane<2?700:1100,gain:0.2});else if(n.midi)keyNote(a.ctx,a.ctx.currentTime,n.midi,{long:n.kind==='hold'})}
 }
 // Classic: a wrong or missed tile ends it. The song stops there, the board holds the red tile a moment, then
 // the results.
 const stopHere=(lane:number)=>{
  if(stoppedAt.current)return
  stoppedAt.current=performance.now();missAt.current[lane]=stoppedAt.current
  tally.current={...tally.current,failed:true};word.current={j:'miss',t:stoppedAt.current}
  const a=audio.current;if(a)void a.ctx.suspend().catch(()=>undefined)
  navigator.vibrate?.(40)
 }
 const press=(lane:number,lag=0)=>{
  if(!playing||done.current||stoppedAt.current)return
  pressedAt.current[lane]=performance.now()
  // When the finger landed (lag: how long the event waited for the page), not when this runs.
  const ms=songMs()-lag-liveOffset.current
  // Timing never changes by itself during a song (auto-sync used to, and it drifted with the player's own
  // early or late taps); the results suggest a change instead, from how the hits landed.
  const i=hitIn(play.current.notes,lane,ms,level);if(i>=0)mark(i,ms)
  else if(classic&&!warm.current&&wrongColumn(play.current.notes,lane,ms,level))stopHere(lane)
 }
 const pressRef=useRef({press});useEffect(()=>{pressRef.current={press}})
 // Keys: D F J K (or the arrows), one for each column.
 useEffect(()=>{
  if(!playing)return
  const down=(e:KeyboardEvent)=>{const k=e.key.toLowerCase(),lane=KEYS[k]
   if(lane!==undefined){e.preventDefault();if(!e.repeat){lanesHeld.current[lane]++;pressRef.current.press(lane,inputLag(e))}}
}
  const up=(e:KeyboardEvent)=>{const k=e.key.toLowerCase(),lane=KEYS[k];if(lane!==undefined)lanesHeld.current[lane]=Math.max(0,lanesHeld.current[lane]-1)}
  window.addEventListener('keydown',down);window.addEventListener('keyup',up)
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)}
 },[playing])
 // The song pauses with the app in the background.
 useEffect(()=>{const vis=()=>{const a=audio.current;if(!a||done.current||!playing)return;void (document.hidden?a.ctx.suspend():a.ctx.resume()).catch(()=>undefined)};document.addEventListener('visibilitychange',vis);return()=>document.removeEventListener('visibilitychange',vis)},[playing])
 const stopRef=useRef(stopSong);useEffect(()=>{stopRef.current=stopSong})
 useEffect(()=>()=>stopRef.current(),[])

 // Play: the song is loaded whole and played through Web Audio (its clock is what the notes follow), starting
 // a moment after the track appears.
 const start=async(warmup=false)=>{
  if(loading)return
  warm.current=warmup
  stopMusic();setLoading(true)
  const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext
  const ctx=new Ctx()
  try{
   let buf=decoded.get(info.id)
   if(!buf){const data=await (await fetch('/audio/games/'+info.id+'.mp3')).arrayBuffer();buf=await ctx.decodeAudioData(data);decoded.clear();decoded.set(info.id,buf)}
   play.current=playOf(info.charts[level],info.bpm);tally.current=freshTally(level);done.current=false;fx.current=[];word.current=null;nextTick.current=0;tickedTo.current=0
   lanesHeld.current=[0,0,0,0];missAt.current=[0,0,0,0];pointers.current.clear();stoppedAt.current=0;liveOffset.current=offset
   const src=ctx.createBufferSource();src.buffer=buf;src.connect(ctx.destination)
   await ctx.resume().catch(()=>undefined)
   const t0=ctx.currentTime+0.8;src.start(t0);src.onended=()=>finishRef.current()
   audio.current={ctx,src,t0};startedAt.current=performance.now();spokenAt.current={combo:0,misses:0};setSpoken(info.title+' started. Tap D, F, J or K as each tile reaches the line.')
   setPlaying(true)
  }catch{void ctx.close().catch(()=>undefined)}
  finally{setLoading(false)}
 }

 // Every frame while playing: judge what went by, then draw the board.
 useEffect(()=>{
  if(!playing)return
  const cv=canvas.current;if(!cv)return
  const ctx=cv.getContext('2d');if(!ctx)return
  // The live song time, for the tests to press keys exactly on a note (frames can be slow on a test machine).
  Object.assign(cv,{songNow:()=>songMs()-liveOffset.current,songRaw:()=>songMs()})
  const ap=approachFor(speed)
  // When each tile was hit or missed (for its fade), by note.
  const doneAt=new Map<number,number>()
  let raf=0
  const draw=()=>{
   raf=requestAnimationFrame(draw)
   const dpr=Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth,H=cv.clientHeight
   if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
   ctx.setTransform(dpr,0,0,dpr,0,0)
   const b=boardOf(W,H),offset=liveOffset.current,now=songMs()-offset,pl=play.current,t=performance.now()
   cv.dataset.ms=String(Math.round(now)) // where the song is (the tests follow it)
   // Note ticks: a soft click on every note, a little ahead, on the song's own clock (so they sound exactly
   // with the music, whatever the device's delay).
   if(ticks&&audio.current&&!done.current){const a=audio.current,ahead=now+offset+400
    for(const n of pl.notes){if(n.t<tickedTo.current||n.t>=ahead)continue;if(n.t>=now+offset-20)click(a.ctx,a.t0+n.t/1000,{freq:n.kind==='hold'?1200:1600,gain:0.16})}
    tickedTo.current=Math.max(tickedTo.current,ahead)}
   // Misses: tiles that went by; then each long tile's moments as they come (kept while it's held down).
   if(stoppedAt.current&&!done.current){if(t-stoppedAt.current>900){finishRef.current();return}}
   else if(!done.current){
    for(const i of missedBy(pl.notes,now,level)){pl.notes[i].hit='miss';tally.current=count(tally.current,'miss',level,pl.total);word.current={j:'miss',t};missAt.current[pl.notes[i].lane]=t;if(classic&&!warm.current){stopHere(pl.notes[i].lane);break}}
    while(nextTick.current<pl.ticks.length&&pl.ticks[nextTick.current].t<=now){
     const k=pl.ticks[nextTick.current++]
     const ok=k.kind==='hold'&&lanesHeld.current[pl.notes[k.of].lane]>0&&pl.notes[k.of].hit!=='miss'
     tally.current=count(tally.current,ok?'perfect':'miss',level,pl.total,{tick:true});if(!ok)word.current={j:'miss',t}
    }
    if(warm.current&&tally.current.failed)tally.current={...tally.current,failed:false,gauge:Math.max(tally.current.gauge,1)}
    if(warm.current&&now>WARMUP_MS){finishRef.current();return}
    // The song always plays to its end: an empty gauge (Jeff tier) only means it isn't cleared, decided when
    // the music finishes (the song's own end ends the round; this is only a backstop if that never comes).
    if(now>info.ms+1500)finishRef.current()
   }
   // The board is a road that narrows gently away from you. Tiles keep one steady speed down the screen (so
   // timing reads the same as ever); only their width shrinks with distance. sOf is the width at a moment
   // (1 at the line); yOf and xOf place it (xOf in columns, 0 to 4).
   const px=(b.hitY-b.top)/ap,cx=b.x0+b.colW*2,far=now+ap,near=now-0.08*ap,bw=b.colW*4,NARROW=0.34
   const sOf=(ms:number)=>1-NARROW*Math.min(1,Math.max(-0.1,(ms-now)/ap)),yOf=(ms:number)=>b.hitY-(ms-now)*px,xOf=(col:number,ms:number)=>cx+(col-2)*b.colW*sOf(ms)
   const quad=(c0:number,c1:number,tA:number,tB:number)=>{ctx.beginPath();ctx.moveTo(xOf(c0,tA),yOf(tA));ctx.lineTo(xOf(c1,tA),yOf(tA));ctx.lineTo(xOf(c1,tB),yOf(tB));ctx.lineTo(xOf(c0,tB),yOf(tB));ctx.closePath()}
   const slotMs=Math.min(b.colW*1.25,(b.hitY-b.top)*0.2)/px // a tap tile's length, and its target slot's
   const beat=60000/info.bpm,pulse=Math.max(0,1-(((now%beat)+beat)%beat)/beat)
   // Around the road: KONO's night sky with a soft glow at the horizon, lit on the beat.
   const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1d1a3f');g.addColorStop(1,'#3d2f6e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
   const hz=ctx.createRadialGradient(cx,yOf(far),0,cx,yOf(far),bw*0.75);hz.addColorStop(0,`rgba(255,150,200,${0.3+pulse*0.2})`);hz.addColorStop(1,'rgba(255,150,200,0)');ctx.fillStyle=hz;ctx.fillRect(0,0,W,b.hitY)
   // The road: pale at the line, fading into the sky far away; a column lights up while it's pressed (red on a miss).
   const rg=ctx.createLinearGradient(0,yOf(far),0,b.hitY);rg.addColorStop(0,'rgba(251,250,255,0.18)');rg.addColorStop(0.35,'rgba(251,250,255,0.8)');rg.addColorStop(1,'#fbfaff');ctx.fillStyle=rg;quad(0,4,now,far);ctx.fill()
   for(let l=0;l<4;l++){
    const pressed=lanesHeld.current[l]>0||t-pressedAt.current[l]<120,missed=t-missAt.current[l]<(stoppedAt.current?900:260)
    if(pressed||missed){const lg=ctx.createLinearGradient(0,b.hitY,0,yOf(far));lg.addColorStop(0,missed?'rgba(255,77,106,0.5)':LANE_COLORS[l]+'66');lg.addColorStop(1,missed?'rgba(255,77,106,0)':LANE_COLORS[l]+'00');ctx.fillStyle=lg;quad(l,l+1,now,far);ctx.fill()}}
   ctx.strokeStyle='rgba(40,30,80,0.14)';ctx.lineWidth=1;for(let l=1;l<4;l++){ctx.beginPath();ctx.moveTo(xOf(l,now),b.hitY);ctx.lineTo(xOf(l,far),yOf(far));ctx.stroke()}
   // Faint lines across on each beat, so the tiles' rhythm is easy to read.
   for(let bt=Math.ceil(now/beat)*beat;bt<far;bt+=beat){const y=yOf(bt);ctx.fillStyle=Math.round(bt/beat)%4===0?'rgba(40,30,80,0.12)':'rgba(40,30,80,0.05)';ctx.fillRect(xOf(0,bt),y,xOf(4,bt)-xOf(0,bt),1)}
   // The road's glowing edges.
   for(const c of [0,4]){ctx.strokeStyle=`rgba(255,90,140,${0.25+pulse*0.2})`;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(xOf(c,now),b.hitY);ctx.lineTo(xOf(c,far),yOf(far));ctx.stroke();ctx.strokeStyle='#ff8fb4';ctx.lineWidth=2;ctx.stroke()}
   // The target slots: a tile-shaped socket at the end of each column, exactly the size of a tap tile. A tile
   // fits right into its slot at the perfect moment, so you aim the whole tile, not a thin line.
   for(let l=0;l<4;l++){const c0=l+0.05,c1=l+0.95,pressed=lanesHeld.current[l]>0||t-pressedAt.current[l]<120
    ctx.fillStyle='rgba(40,30,80,0.16)';quad(c0,c1,now,now+slotMs);ctx.fill()
    ctx.fillStyle=LANE_COLORS[l]+(pressed?'88':Math.round(0x22+pulse*0x22).toString(16).padStart(2,'0'));quad(c0,c1,now,now+slotMs);ctx.fill()}
   // The pads under the line, one for each column: where you tap. A pad glows in its color while it's pressed.
   {const y0=b.hitY+10,ph=Math.max(30,Math.min(H-y0-8,b.colW*1.2))
    ctx.textAlign='center'
    for(let l=0;l<4;l++){const x=b.x0+l*b.colW+3,w=b.colW-6,pressed=lanesHeld.current[l]>0||t-pressedAt.current[l]<120
     const pg=ctx.createLinearGradient(0,y0,0,y0+ph);pg.addColorStop(0,pressed?LANE_COLORS[l]:'rgba(255,255,255,0.2)');pg.addColorStop(1,pressed?LANE_COLORS[l]+'66':'rgba(255,255,255,0.06)');ctx.fillStyle=pg;ctx.beginPath();ctx.roundRect(x,y0,w,ph,12);ctx.fill()
     ctx.strokeStyle=pressed?'#fff':LANE_COLORS[l];ctx.lineWidth=pressed?3:2;ctx.stroke()
     ctx.fillStyle=pressed?'#fff':LANE_COLORS[l];ctx.beginPath();ctx.roundRect(x+w*0.18,y0+ph*0.42,w*0.64,Math.max(5,ph*0.12),4);ctx.fill()
     if(ph>54){ctx.font='700 11px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.6)';ctx.fillText('DFJK'[l],x+w/2,y0+ph-10)}}}
   // Tiles, the farthest first. A tap tile is a dark slab with its column's color on its front edge; a long
   // tile runs back to where its note ends, with a line down its middle, lit while it's held. Hit tiles turn
   // grey and fade; missed ones go red.
   const tapMs=slotMs,slab=(c0:number,c1:number,tA:number,color:string)=>{const th=Math.max(4,9*sOf(tA));ctx.fillStyle=color;ctx.fillRect(xOf(c0,tA),yOf(tA),xOf(c1,tA)-xOf(c0,tA),th)}
   ctx.save();ctx.beginPath();ctx.rect(0,0,W,b.hitY+5);ctx.clip() // tiles end at the line, not over the pads
   for(let i=pl.notes.length-1;i>=0;i--){
    const n=pl.notes[i];if(n.kind==='sky'||n.t>far)continue
    const c0=n.lane+0.05,c1=n.lane+0.95
    // Each tile is as long as a key, but never runs into the next tile in its column.
    let h=tapMs;for(let k=i+1;k<pl.notes.length;k++){const m=pl.notes[k];if(m.t-n.t>ap)break;if(m.lane===n.lane&&m.kind!=='sky'){h=Math.min(h,(m.t-n.t)-ap*0.012);break}}
    h=Math.max(14/px,h)
    const end=n.kind==='hold'&&n.end?n.end:n.t+h,tB=Math.min(end,far)
    if(n.hit&&!doneAt.has(i))doneAt.set(i,t)
    if(n.hit==='miss'){const k=Math.min(1,(t-(doneAt.get(i)??t))/500),tA=Math.max(n.t,near);if(k>=1||tB<=tA)continue
     ctx.globalAlpha=1-k*0.6;ctx.fillStyle='#ff4d6a';quad(c0,c1,tA,tB);ctx.fill();ctx.globalAlpha=1;continue}
    if(n.hit&&n.kind!=='hold'){const k=(t-(doneAt.get(i)??t))/260,tA=Math.max(n.t,near);if(k>=1||tB<=tA)continue
     ctx.globalAlpha=1-k;ctx.fillStyle='#d9d5ea';quad(c0,c1,tA,tB);ctx.fill();ctx.globalAlpha=1;continue}
    const kept=n.kind==='hold'&&n.hit&&lanesHeld.current[n.lane]>0
    // Far tiles come out of the haze rather than popping in.
    ctx.globalAlpha=Math.max(0,Math.min(1,(far-n.t)/(ap*0.12)))
    if(n.kind==='hold'&&n.end){
     const tA=n.hit?Math.max(n.t,now):Math.max(n.t,near);if(tB<=tA){ctx.globalAlpha=1;continue}
     const tg=ctx.createLinearGradient(0,yOf(tB),0,yOf(tA));tg.addColorStop(0,'#3a3360');tg.addColorStop(1,'#1c1a2e');ctx.fillStyle=tg;quad(c0,c1,tA,tB);ctx.fill()
     if(kept){ctx.fillStyle=LANE_COLORS[n.lane]+'77';quad(c0,c1,tA,tB);ctx.fill()}
     ctx.strokeStyle=kept?'#fff':'rgba(255,255,255,0.55)';ctx.lineWidth=kept?4:2;ctx.beginPath();ctx.moveTo(xOf(n.lane+0.5,tA),yOf(tA)-6);ctx.lineTo(xOf(n.lane+0.5,tB),yOf(tB)+4);ctx.stroke()
     slab(c0,c1,tA,LANE_COLORS[n.lane])
     ctx.globalAlpha=1;continue
    }
    const tA=Math.max(n.t,near);if(tB<=tA){ctx.globalAlpha=1;continue}
    const tg=ctx.createLinearGradient(0,yOf(tB),0,yOf(tA));tg.addColorStop(0,'#3a3560');tg.addColorStop(1,'#13121f');ctx.fillStyle=tg;quad(c0,c1,tA,tB);ctx.fill()
    // A thin shine along its far edge, and its column's color on the front, so the column reads at a glance.
    ctx.fillStyle='rgba(255,255,255,0.22)';quad(c0+0.07,c1-0.07,tB-h*0.12,tB-h*0.05);ctx.fill()
    slab(c0,c1,tA,LANE_COLORS[n.lane])
    ctx.globalAlpha=1
   }
   ctx.restore()
   // The slots' frames, over the tiles: each one glows brighter as a tile slides into it, and is brightest
   // when the tile sits exactly inside (the perfect moment); a soft glow runs along their front edge.
   {const lg=ctx.createLinearGradient(0,b.hitY-16,0,b.hitY+16);lg.addColorStop(0,'rgba(255,120,170,0)');lg.addColorStop(0.5,`rgba(255,120,170,${0.35+pulse*0.25})`);lg.addColorStop(1,'rgba(255,120,170,0)');ctx.fillStyle=lg;ctx.fillRect(b.x0,b.hitY-16,bw,32)
    for(let l=0;l<4;l++){let fit=0
     for(const n of pl.notes){if(n.t>now+slotMs)break;if(n.lane!==l||n.kind==='sky'||n.hit)continue;fit=Math.max(fit,1-Math.abs(n.t-now)/slotMs)}
     const pressed=lanesHeld.current[l]>0||t-pressedAt.current[l]<120
     ctx.save();ctx.lineJoin='round';ctx.shadowColor=LANE_COLORS[l];ctx.shadowBlur=6+fit*18
     ctx.strokeStyle=pressed||fit>0.8?'#fff':LANE_COLORS[l];ctx.lineWidth=2.5+fit*2;quad(l+0.05,l+0.95,now,now+slotMs);ctx.stroke();ctx.restore()}}
   // Hits: the pad flashes in the hit's color, a column of light shoots up the lane, and a ring spreads on the line.
   fx.current=fx.current.filter(e=>t-e.t<380)
   for(const e of fx.current){const k=(t-e.t)/380,x=b.x0+(e.x*4-0.5)*b.colW+b.colW/2,col=WORD_COLOR[e.j]==='#ffe27a'?'#ffd34d':WORD_COLOR[e.j]
    if(!e.sky&&e.j!=='miss'){const lane=Math.max(0,Math.min(3,Math.round(e.x*4-0.5))),px0=b.x0+lane*b.colW+3,y0=b.hitY+10,ph=Math.max(30,Math.min(H-y0-8,b.colW*1.2))
     ctx.globalAlpha=(1-k)*0.85;ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(px0,y0,b.colW-6,ph,12);ctx.fill()
     const beam=ctx.createLinearGradient(0,b.hitY,0,b.hitY-(b.hitY-b.top)*0.45);beam.addColorStop(0,col);beam.addColorStop(1,'rgba(255,255,255,0)')
     ctx.globalAlpha=(1-k)*0.55;ctx.fillStyle=beam;ctx.fillRect(px0+4,b.hitY-(b.hitY-b.top)*0.45,b.colW-14,(b.hitY-b.top)*0.45)}
    ctx.globalAlpha=1-k;ctx.strokeStyle=WORD_COLOR[e.j]==='#ffe27a'?'#ffb000':WORD_COLOR[e.j];ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,b.hitY,b.colW*0.35+k*b.colW*0.25,14+k*16,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
   // The combo, big at the top of the board, and the word for the last hit under it.
   const s=tally.current,spaced=(txt:string)=>txt.split('').join(' ')
   {const sp=spokenAt.current
    if(s.combo>=sp.combo+25){sp.combo=s.combo-(s.combo%25);setSpoken('Combo '+sp.combo)}else if(s.combo<sp.combo)sp.combo=0
    if(s.miss>=sp.misses+5){sp.misses=s.miss;setSpoken(s.miss+' missed so far')}}
   cv.dataset.score=String(scoreOf(s,pl.total))
   ctx.textAlign='center'
   if(s.combo>=2){ctx.font='800 '+Math.round(44+Math.min(16,s.combo/12))+'px system-ui,sans-serif';ctx.fillStyle='rgba(255,77,120,0.92)';ctx.fillText(String(s.combo),W/2,b.top+60);ctx.font='700 10px system-ui,sans-serif';ctx.fillStyle='rgba(255,77,120,0.7)';ctx.fillText(spaced('COMBO'),W/2,b.top+76)}
   const wd=word.current
   // The word for the last hit, big and glowing just above the line (where your eyes are), popping in.
   if(wd&&t-wd.t<550){const k=(t-wd.t)/550,pop=1+Math.max(0,0.35-k*2.2),size=Math.round(Math.min(46,bw/7)*pop),y=b.hitY-(b.hitY-b.top)*0.26
    const col=wd.j==='perfect'?['#fff6a8','#ffb300']:wd.j==='great'?['#c9f1ff','#2aa7d8']:wd.j==='good'?['#d6ffcf','#43b047']:['#ffd0d8','#ff3d63']
    ctx.globalAlpha=k<0.7?1:(1-k)/0.3;ctx.font='900 italic '+size+'px system-ui,sans-serif'
    const wg=ctx.createLinearGradient(0,y-size,0,y);wg.addColorStop(0,col[0]);wg.addColorStop(1,col[1])
    ctx.save();ctx.shadowColor=col[1];ctx.shadowBlur=18;ctx.lineWidth=5;ctx.strokeStyle='rgba(30,16,60,0.85)';ctx.strokeText(WORD[wd.j].toUpperCase(),W/2,y);ctx.fillStyle=wg;ctx.fillText(WORD[wd.j].toUpperCase(),W/2,y);ctx.restore()
    if(wd.off!==undefined&&wd.j!=='miss'&&wd.j!=='perfect'){ctx.font='800 12px system-ui,sans-serif';ctx.fillStyle=wd.off<0?'#8fc2ff':'#ffb08f';ctx.fillText(spaced(wd.off<0?'EARLY':'LATE'),W/2,y+18)}
    ctx.globalAlpha=1}
   // Top: the song and level on the left; the score, with the gauge under it, on the right; the song's
   // progress along the very top.
   ctx.fillStyle='rgba(20,16,44,0.82)';ctx.fillRect(0,0,W,b.top-10)
   ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='600 15px system-ui,sans-serif';ctx.fillText(info.title,14,28)
   const lv=LEVELS.find(l=>l.id===level)!,chip=lv.name+' '+ratingOf(info,level);ctx.font='700 10px system-ui,sans-serif';const cw=ctx.measureText(chip).width+14
   ctx.fillStyle=LEVEL_COLORS[level];ctx.beginPath();ctx.roundRect(14,36,cw,17,8.5);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(chip,21,48)
   ctx.textAlign='right';ctx.font='300 26px system-ui,sans-serif';ctx.fillStyle='#fff';ctx.fillText(String(scoreOf(s,pl.total)).padStart(7,'0').replace(/\B(?=(\d{3})+(?!\d))/g,','),W-14,32)
   const gw=Math.min(150,W*0.36),gx=W-14-gw;ctx.fillStyle='rgba(255,255,255,0.2)';ctx.beginPath();ctx.roundRect(gx,42,gw,6,3);ctx.fill()
   ctx.fillStyle=level==='jeff'?(s.gauge>30?'#ff8ad8':'#ff4d6a'):s.gauge>=CLEAR_AT?'#9dffcf':'#a9c8ff';ctx.beginPath();ctx.roundRect(gx,42,Math.max(0,gw*s.gauge/100),6,3);ctx.fill()
   if(level!=='jeff'){ctx.fillStyle='#fff';ctx.fillRect(gx+gw*CLEAR_AT/100-1,39,2,12)}
   ctx.font='600 10px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.8)';ctx.fillText(Math.floor(s.gauge)+'%',W-14,62)
   ctx.fillStyle='rgba(255,255,255,0.18)';ctx.fillRect(0,b.top-10,W,3);ctx.fillStyle='#ff5a8c';ctx.fillRect(0,b.top-10,W*Math.min(1,Math.max(0,now)/info.ms),3)
   // The start: the song's name on a band across the board, then away.
   const since=t-startedAt.current
   if(since<2400){const k=since/2400,a=k<0.15?k/0.15:k>0.75?(1-k)/0.25:1,y=H*0.42
    ctx.globalAlpha=a*0.92;ctx.fillStyle='#1c1a2e';ctx.fillRect(b.x0,y-40,bw,80)
    ctx.globalAlpha=a;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='700 '+Math.min(26,bw/13)+'px system-ui,sans-serif';ctx.fillText(info.title,W/2,y+2)
    ctx.font='700 11px system-ui,sans-serif';ctx.fillStyle=LEVEL_COLORS[level];ctx.fillText(spaced((lv.name+' · '+ratingOf(info,level)).toUpperCase()),W/2,y+24);ctx.globalAlpha=1}
  }
  raf=requestAnimationFrame(draw)
  return()=>cancelAnimationFrame(raf)
 // eslint-disable-next-line react-hooks/exhaustive-deps -- runs while a song plays
 },[playing])

 // Fingers: anywhere in a column taps it (and keeps a long tile held); sliding over moves the hold with you.
 const laneAt=(cv:HTMLCanvasElement,cx:number)=>{const r=cv.getBoundingClientRect(),b=boardOf(r.width,r.height),x=cx-r.left;return x<b.x0||x>=b.x0+b.colW*4?-1:Math.floor((x-b.x0)/b.colW)}
 const down=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId)
  const lane=laneAt(e.currentTarget,e.clientX);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY,lane})
  if(lane>=0){lanesHeld.current[lane]++;press(lane,inputLag(e))}
 }
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  const p=pointers.current.get(e.pointerId);if(!p)return
  const lane=laneAt(e.currentTarget,e.clientX)
  if(lane!==p.lane){if(p.lane>=0)lanesHeld.current[p.lane]=Math.max(0,lanesHeld.current[p.lane]-1);if(lane>=0)lanesHeld.current[lane]++}
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY,lane})
 }
 const up=(e:React.PointerEvent<HTMLCanvasElement>)=>{const p=pointers.current.get(e.pointerId);if(!p)return;if(p.lane>=0)lanesHeld.current[p.lane]=Math.max(0,lanesHeld.current[p.lane]-1);pointers.current.delete(e.pointerId)}
 const nudge=(d:number)=>{const v=Math.max(-300,Math.min(300,offset+d));setOffsetState(v);saveOffset(v)}
 const setSpeed=(v:number)=>{const s=Math.max(1,Math.min(10,Math.round(v*2)/2));setSpeedState(s);saveSpeed(s)}

 // Phones fold the settings away under ⚙ Settings, so ▶ Play sits right under the song; wider screens show them.
 const [wideScreen]=useState(()=>{try{return !window.matchMedia('(max-width:759px)').matches}catch{return true}})
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
   <details className="beat-settings-wrap" open={wideScreen||!!reset}><summary>⚙ Settings <span>Speed, timing, ticks</span></summary>
   <div className="beat-settings">
    <label className="beat-offset">Speed <button type="button" aria-label="Notes slower" onClick={()=>setSpeed(speed-0.5)}>−</button><output>{speed.toFixed(1)}</output><button type="button" aria-label="Notes faster" onClick={()=>setSpeed(speed+0.5)}>＋</button></label>
    <label className="beat-offset">Timing <button type="button" aria-label="Notes earlier" onClick={()=>nudge(-5)}>−</button><output>{offset>0?'+':''}{offset} ms</output><button type="button" aria-label="Notes later" onClick={()=>nudge(5)}>＋</button></label>
    <button type="button" className="beat-sync-open" onClick={()=>setSyncing(true)}>Sync check</button>
    <label className="beat-ticks"><input type="checkbox" checked={ticks} onChange={e=>{setTicks(e.target.checked);saveTicks(e.target.checked)}}/> Note ticks</label>
    <label className="beat-ticks"><input type="checkbox" checked={keys} onChange={e=>{setKeys(e.target.checked);saveKeys(e.target.checked)}}/> Tap notes</label>
    <label className="beat-ticks"><input type="checkbox" checked={classic} onChange={e=>{setClassic(e.target.checked);saveClassic(e.target.checked)}}/> Classic (one miss ends the song)</label>
   </div></details>
   {reset&&<p className="beat-reset" role="status">Timing is back to 0 ms: it used to shift by itself and could drift far off. Use Sync check to set it for your speakers or headphones.</p>}
   {syncing&&<BeatSync onDone={ms=>{setOffsetState(ms);saveOffset(ms)}} onClose={()=>setSyncing(false)}/>}
   <button type="button" className="beat-play" onClick={()=>void start()} disabled={loading}>{loading?'Loading…':<>▶ Play <span>{info.title}</span></>}</button>
   <button type="button" className="beat-warmup" onClick={()=>void start(true)} disabled={loading} title="The first 30 seconds; nothing counts">Warm-up · 30 s</button>
   <details className="beat-how"><summary>How to play</summary><ul>
    <li><span className="is-floor"/>Every tile is a note of the song’s tune, on its beat: tap along with the melody you hear. Tap a tile’s column (<kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd>) as it reaches the line; hold a long tile down to its end.</li>
    <li>{level==='jeff'?'Jeff tier: the gauge starts full and drains with misses; keep it above empty to clear the song. The song always plays to the end.':'Fill the gauge past '+CLEAR_AT+'% by the end to clear the song.'} If the tiles feel early or late (Bluetooth headphones often do), run the Sync check once (and after a song, the results offer a Timing fix if your hits landed early or late); Note ticks play a click on every tile so you can hear it. Tap notes plays each tile’s note as you hit it.</li>
    <li><b>Classic:</b> no gauge, no second chances. Tap the wrong column or let a tile go by and the song stops there.</li>
   </ul></details>
  </section>
 </div>
 return <div className="beat-stage"><p className="beat-sr" aria-live="polite">{spoken}</p><canvas ref={canvas} className="beat-canvas" role="img" aria-label={'KONO Beat: '+info.title} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/></div>
}
