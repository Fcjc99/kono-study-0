import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {LEVELS,CLEAR_AT,CLEAR_NAME,accuracy,approachFor,clearOf,count,freshTally,grade,hitIn,missedBy,playOf,timingDrift,timingWasReset,readBeatBest,readClassic,readHits,readLast,readOffset,readSpeed,readSynced,readTicks,saveBeatBest,saveClassic,saveHits,saveLast,saveOffset,saveSpeed,saveSynced,saveTicks,wrongColumn,scoreOf,judge,type Chart,type Clear,type HitSound,type Judge,type Level,type Play,type Tally} from '../store/rhythm'
import {stopMusic} from '../arcadeAudio'
import {click,heardNow,inputLag,keyNote} from '../game/audioClock'
import BeatSync from './BeatSync'
import charts from '../game/data/rhythmCharts.json'
import type {GameHandle} from './GameScreen'
import './rhythm-game.css'

/** A sung song's lyrics, a line at a time: when it starts and ends (ms into the song), its words, and when each
 * word starts (tools/make_rhythm_charts.py lines them up with the sung syllables). */
export type LyricLine=[number,number,string,number[]]
/** `hit: 'tick'`: every hit plays a soft drum tick, not a note. A tile with no note (midi 0: in a sung song, a rapped word or a beat between lines) plays the tick too, so a hit never plays a note the singer isn't singing. */
type Song={id:string;title:string;bpm:number;ms:number;hit?:'tick';lyrics?:LyricLine[];charts:Record<Level,Chart>}
const SONGS=(charts as unknown as {songs:Song[]}).songs
const SUNG=new Set(['beijing-delai','casa-fantasma','peanut-butter-delai'])
const FROM:Record<string,string>={candy:'Sweet swap',gems:'Gem blitz',blast:'KONO blast','flow-1':'Flow · Drift','flow-2':'Flow · Tide','flow-3':'Flow · Pulse','flow-4':'Flow · Aurora','flow-5':'Flow · Zenith','beijing-delai':'🎤 Sung','casa-fantasma':'🎤 Sung','peanut-butter-delai':'🎤 Sung'}
const LANE_COLORS=['#ff7ab6','#7ad7ff','#9dff8a','#ffd36b'],LANE_DEEP=['#ff3f8e','#2aa9f0','#33cc6c','#ffad14']
const LEVEL_COLORS:Record<Level,string>={easy:'#2fbf8f',medium:'#f59f2a',jeff:'#b06bff'}
// Each song's cover: an emoji on two colors.
const JACKETS:Record<string,[string,string,string]>={candy:['🍬','#ff9ac8','#ffd58a'],gems:['💎','#7fd8ff','#a98bff'],blast:['🧱','#ffb36b','#ff6b8a'],'flow-1':['🌌','#3a3f9e','#8fa2ff'],'flow-2':['🌊','#2f7fb8','#9ff0ff'],'flow-3':['🌙','#2a2350','#c27bff'],'flow-4':['🌠','#4b2d8f','#ff9ae0'],'flow-5':['✨','#1d5a6e','#ffe28a'],'beijing-delai':['🏮','#d8323c','#ffcf5a'],'casa-fantasma':['👻','#2b1d45','#7fe0c8'],'peanut-butter-delai':['🥜','#c98a4b','#ffe3a8']}
const jacketOf=(id:string)=>JACKETS[id]??['🎵','#888','#ccc']
function Jacket({id}:{id:string}){const [e,a,b]=jacketOf(id);return <span className="beat-jacket" style={{'--j1':a,'--j2':b} as React.CSSProperties} aria-hidden="true"><span>{e}</span></span>}
/** How hard a chart is, 1-12: how many things to do a second (holds, sky notes and ribbons count a bit more). */
function ratingOf(s:Song,level:Level){const c=s.charts[level],busy=(c.tap.length+c.hold.length*1.3+c.sky.length*1.4+c.ribbon.length*0.5)/(s.ms/1000);return Math.max(1,Math.min(12,Math.round(1+busy*2.4)))}
const KEYS:Record<string,number>={d:0,f:1,j:2,k:3,arrowleft:0,arrowdown:1,arrowup:2,arrowright:3}
const WORD:Record<Judge,string>={perfect:'Perfect',great:'Great',good:'Good',miss:'Miss'}
const clock=(ms:number)=>{const s=Math.max(0,Math.floor(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
// The last song loaded (decoded once, so Play again starts straight away).
const decoded=new Map<string,AudioBuffer>()
/** How long a warm-up plays. */
const WARMUP_MS=30000
const CLEAR_MARK:Record<Clear,string>={fail:'',clear:'✓',full:'FC',all:'AP'}
export type BeatResult={drift:number|null;song:string;title:string;level:Level;score:number;acc:number;grade:string;best:number;tally:Tally;clear:Clear;failed:boolean;newBest:boolean;classic?:boolean;/** Ended before the song was over. */ended?:boolean;warmup?:boolean;tiles:number;of:number
 /** Each tile, in order: when (ms into the song) and how it went (unplayed if the song stopped first). */
 timeline:{t:number;j:Judge|null}[];ms:number
 /** How early (−) or late (+) each hit landed, ms. */
 offs:number[]}

/** The board: four columns of tiles, side by side and centered (narrow and tall, like a piano's keys seen
 * from above), with the line near the bottom and a pad under each column. On a wide screen it gets a panel
 * either side (the lyrics or the song on the left, how it's going on the right); on a phone the head-up line
 * (and a sung song's lyrics) sit above it. The pads always fit on the screen. */
type Board={W:number;H:number;x0:number;colW:number;top:number;hitY:number;padY:number;padH:number;wide:boolean;panelW:number}
function boardOf(W:number,H:number,lyrics=false):Board{
 const bw=Math.min(W-16,Math.max(280,H*0.62),560),wide=W>=980&&H>=520&&(W-bw)/2>=280
 const padH=Math.round(Math.max(56,Math.min(104,H*0.13,bw/4*1.15))),padY=H-padH-10
 return {W,H,x0:(W-bw)/2,colW:bw/4,top:wide?24:lyrics?146:84,hitY:padY-12,padY,padH,wide,panelW:wide?Math.min(340,(W-bw)/2-48):0}
}

/** KONO Beat: the arcade's songs as a tiles game on a road seen in 3D. Glowing tiles come toward you down four
 * columns (tools/make_rhythm_charts.py: on the tune's notes, or a sung song's syllables, held to its beat); tap a
 * tile's column (or D F J K, or the arrows) as it reaches the line, and hold a long tile down to its end. Pick a
 * song and Easy, Medium or Jeff tier (store/rhythm has the rules). The song is the clock: it plays through Web
 * Audio, and the notes follow the sound card's clock (less the time sound takes to reach the speakers). The game
 * fills the screen while a song plays: ❚❚ (or Escape, or leaving the app) pauses it, with the settings, Restart,
 * End and Leave there; Resume counts you back in. Note speed, the timing, what a hit sounds like and the last
 * song played are kept on this device, and a device's first song starts with a short timing check. */
export default function RhythmGame({ref,onEnd,onLeave}:{ref:Ref<GameHandle>;onEnd:(r:BeatResult)=>void;onLeave?:()=>void}){
 const [last]=useState(readLast)
 const [song,setSong]=useState(()=>last&&SONGS.some(s=>s.id===last.song)?last.song:SONGS[0].id),[level,setLevel]=useState<Level>(()=>last?.level??'easy'),[playing,setPlaying]=useState(false)
 const [offset,setOffsetState]=useState(readOffset),[speed,setSpeedState]=useState(readSpeed),[ticks,setTicks]=useState(readTicks),[reset]=useState(timingWasReset)
 const [hits,setHitsState]=useState<HitSound>(readHits),[classic,setClassic]=useState(readClassic)
 // Overlays: the settings sheet (song select), the timing check (asked for, or a device's first song first),
 // and the pause sheet with its count back in.
 const [sheet,setSheet]=useState(false),[syncing,setSyncing]=useState<null|'ask'|'first'>(null),[paused,setPaused]=useState(false),[pausedAt,setPausedAt]=useState({ms:0,warm:false}),[countIn,setCountIn]=useState(0)
 const [filter,setFilter]=useState<'all'|'sung'|'todo'>('all')
 // Classic: when the song stopped on a wrong or missed tile (the board holds still on it a moment).
 const stoppedAt=useRef(0)
 // The Timing and note speed in use while a song plays (only you change them: the settings, the timing check
 // or a results suggestion), and what a hit plays.
 const liveOffset=useRef(offset),liveSpeed=useRef(speed),liveHits=useRef(hits),livePaused=useRef(false)
 // Warm-up: the first WARMUP_MS of the song, nothing kept (no fail, no best, no coins).
 const warm=useRef(false)
 // What a screen reader hears while the canvas plays: the start, every 25 in a combo, and a run of misses.
 const [spoken,setSpoken]=useState(''),spokenAt=useRef({combo:0,misses:0})
 const tickedTo=useRef(0)
 const canvas=useRef<HTMLCanvasElement>(null),pauseBtn=useRef<HTMLButtonElement>(null),audio=useRef<{ctx:AudioContext;src:AudioBufferSourceNode;t0:number}|null>(null),[loading,setLoading]=useState(false)
 const play=useRef<Play>({notes:[],ribbons:[],ticks:[],total:0}),tally=useRef<Tally>(freshTally('easy')),done=useRef(false),nextTick=useRef(0)
 const fx=useRef<{lane:number;t:number;j:Judge}[]>([]),word=useRef<{j:Judge;t:number;off?:number}|null>(null),doneAt=useRef(new Map<number,number>())
 // What's held down: floor lanes (keys or fingers), and each finger's place.
 const lanesHeld=useRef([0,0,0,0]),missAt=useRef([0,0,0,0]),pointers=useRef(new Map<number,{x:number;y:number;lane:number}>())
 const pressedAt=useRef([0,0,0,0]),startedAt=useRef(0),onEndRef=useRef(onEnd)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 const info=SONGS.find(s=>s.id===song)!
 // Where the song is (ms): what's reaching the speakers right now (game/audioClock), so a note reaches the
 // line as you hear its hit; the device's own extra delay is the Timing (set by the timing check).
 const songMs=()=>{const a=audio.current;if(!a)return 0;return (heardNow(a.ctx)-a.t0)*1000}
 const stopSong=()=>{const a=audio.current;audio.current=null;if(!a)return;try{a.src.onended=null;a.src.stop()}catch{/* not started */}void a.ctx.close().catch(()=>undefined)}
 const judged=()=>play.current.notes.filter(n=>n.hit).length+nextTick.current
 const finish=()=>{
  if(done.current)return;done.current=true
  const early=!warm.current&&!stoppedAt.current&&songMs()-liveOffset.current<info.ms-2000
  stopSong();livePaused.current=false;setPaused(false);setCountIn(0)
  const t=tally.current,total=warm.current?Math.max(1,judged()):play.current.total,score=scoreOf(t,total),clear=clearOf(t,level,judged(),total)
  const newBest=!warm.current&&clear!=='fail'&&saveBeatBest(info.id,level,score,clear)
  const offs=play.current.notes.flatMap(n=>n.hit&&n.hit!=='miss'&&n.off!==undefined?[n.off]:[])
  onEndRef.current({drift:warm.current?null:timingDrift(offs),offs,song:info.id,title:info.title,level,score,acc:accuracy(t,total),grade:early?grade(score):clear==='fail'&&!warm.current?'F':grade(score),ended:early,best:t.best,tally:t,clear:warm.current&&clear==='fail'?'clear':clear,failed:clear==='fail'&&!warm.current,newBest,classic,warmup:warm.current,tiles:play.current.notes.filter(n=>n.hit&&n.hit!=='miss').length,of:warm.current?play.current.notes.filter(n=>n.hit).length:play.current.notes.length,timeline:play.current.notes.filter(n=>n.kind!=='sky').map(n=>({t:n.t,j:n.hit??null})),ms:info.ms})
 }
 const finishRef=useRef(finish);useEffect(()=>{finishRef.current=finish})
 // Pause: the song's clock stops with the sound (the AudioContext is suspended), so the tiles hold still too.
 // Resume counts 3, 2, 1 first. Escape pauses, and resumes when paused.
 const pause=()=>{
  const a=audio.current;if(!playing||!a||done.current||stoppedAt.current)return false
  if(livePaused.current){if(!countIn)resume();return true}
  livePaused.current=true;setPausedAt({ms:songMs()-liveOffset.current,warm:warm.current});setPaused(true);setCountIn(0);void a.ctx.suspend().catch(()=>undefined)
  lanesHeld.current=[0,0,0,0];pointers.current.clear()
  return true
 }
 const countTimer=useRef(0)
 const resume=()=>{
  if(!livePaused.current||countIn)return
  setCountIn(3);let n=3
  window.clearInterval(countTimer.current)
  countTimer.current=window.setInterval(()=>{n--;if(n>0){setCountIn(n);return}
   window.clearInterval(countTimer.current);setCountIn(0);setPaused(false);livePaused.current=false
   const a=audio.current;if(a)void a.ctx.resume().catch(()=>undefined)},matchMedia('(prefers-reduced-motion: reduce)').matches?350:700)
 }
 useEffect(()=>()=>window.clearInterval(countTimer.current),[])
 const pauseRef=useRef(pause);useEffect(()=>{pauseRef.current=pause})
 useImperativeHandle(ref,()=>({end:()=>finishRef.current(),pause:()=>pauseRef.current()}),[])
 const mark=(i:number,ms:number)=>{
  const n=play.current.notes[i],off=ms-n.t,j=judge(off,level);n.hit=j;n.off=off
  tally.current=count(tally.current,j,level,play.current.total,{off});fx.current.push({lane:n.lane,t:performance.now(),j});word.current={j,t:performance.now(),off}
  if(j==='perfect')navigator.vibrate?.(6)
  // What a hit plays: the tile's own note (so tapping along plays the tune, or the sung note), a soft tick
  // where it has none, or nothing.
  const a=audio.current,h=liveHits.current
  if(a&&h!=='off'){if(h==='ticks'||info.hit==='tick'||!n.midi)click(a.ctx,a.ctx.currentTime,{freq:n.lane<2?700:1100,gain:0.2});else keyNote(a.ctx,a.ctx.currentTime,n.midi,{long:n.kind==='hold'})}
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
  if(!playing||done.current||stoppedAt.current||livePaused.current)return
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
   if(lane!==undefined&&!livePaused.current){e.preventDefault();if(!e.repeat){lanesHeld.current[lane]++;pressRef.current.press(lane,inputLag(e))}}}
  const up=(e:KeyboardEvent)=>{const k=e.key.toLowerCase(),lane=KEYS[k];if(lane!==undefined)lanesHeld.current[lane]=Math.max(0,lanesHeld.current[lane]-1)}
  window.addEventListener('keydown',down);window.addEventListener('keyup',up)
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)}
 },[playing])
 // Leaving the app pauses the song (it waits for you on the pause sheet rather than starting up by itself).
 useEffect(()=>{const vis=()=>{if(document.hidden)pauseRef.current()};document.addEventListener('visibilitychange',vis);return()=>document.removeEventListener('visibilitychange',vis)},[])
 const stopRef=useRef(stopSong);useEffect(()=>{stopRef.current=stopSong})
 useEffect(()=>()=>stopRef.current(),[])

 // Play: the song is loaded whole and played through Web Audio (its clock is what the notes follow), starting
 // a moment after the track appears. Restart (from the pause sheet) plays it again from the top.
 const start=async(warmup=false)=>{
  if(loading)return
  warm.current=warmup;saveLast(info.id,level)
  stopSong();stopMusic();setLoading(true)
  window.clearInterval(countTimer.current);livePaused.current=false;setPaused(false);setCountIn(0)
  const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext
  const ctx=new Ctx()
  try{
   let buf=decoded.get(info.id)
   if(!buf){const data=await (await fetch('/audio/games/'+info.id+'.mp3')).arrayBuffer();buf=await ctx.decodeAudioData(data);decoded.clear();decoded.set(info.id,buf)}
   play.current=playOf(info.charts[level],info.bpm);tally.current=freshTally(level);done.current=false;fx.current=[];word.current=null;nextTick.current=0;tickedTo.current=0;doneAt.current=new Map()
   lanesHeld.current=[0,0,0,0];missAt.current=[0,0,0,0];pointers.current.clear();stoppedAt.current=0;liveOffset.current=offset;liveSpeed.current=speed;liveHits.current=hits
   const src=ctx.createBufferSource();src.buffer=buf;src.connect(ctx.destination)
   await ctx.resume().catch(()=>undefined)
   const t0=ctx.currentTime+0.8;src.start(t0);src.onended=()=>finishRef.current()
   audio.current={ctx,src,t0};startedAt.current=performance.now();spokenAt.current={combo:0,misses:0};setSpoken(info.title+' started. Tap D, F, J or K as each tile reaches the line. Escape pauses.')
   setPlaying(true)
  }catch{void ctx.close().catch(()=>undefined)}
  finally{setLoading(false)}
 }
 // ▶ Play: a device's very first song starts with the timing check (or Skip), then plays.
 const go=(warmup=false)=>{if(!readSynced()){setSyncing('first');pendingWarm.current=warmup;return}void start(warmup)}
 const pendingWarm=useRef(false)

 // Every frame while playing: judge what went by, then draw the board.
 useEffect(()=>{
  if(!playing)return
  const cv=canvas.current;if(!cv)return
  const ctx=cv.getContext('2d');if(!ctx)return
  // The live song time, for the tests to press keys exactly on a note (frames can be slow on a test machine).
  Object.assign(cv,{songNow:()=>songMs()-liveOffset.current,songRaw:()=>songMs()})
  const lyr=info.lyrics??[],noteless=play.current.notes.some(n=>n.kind!=='sky'&&!n.midi)
  const [jEmoji,j1,j2]=jacketOf(info.id),lv=LEVELS.find(l=>l.id===level)!,rating=ratingOf(info,level)
  let raf=0
  const draw=()=>{
   raf=requestAnimationFrame(draw)
   const dpr=Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth,H=cv.clientHeight
   if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
   ctx.setTransform(dpr,0,0,dpr,0,0)
   const b=boardOf(W,H,lyr.length>0),offset=liveOffset.current,now=songMs()-offset,pl=play.current,t=performance.now(),ap=approachFor(liveSpeed.current)
   cv.dataset.ms=String(Math.round(now)) // where the song is (the tests follow it)
   const frozen=livePaused.current
   // Guide clicks: a soft click on every note, a little ahead, on the song's own clock (so they sound exactly
   // with the music, whatever the device's delay).
   if(ticks&&audio.current&&!done.current&&!frozen){const a=audio.current,ahead=now+offset+400
    for(const n of pl.notes){if(n.t<tickedTo.current||n.t>=ahead)continue;if(n.t>=now+offset-20)click(a.ctx,a.t0+n.t/1000,{freq:n.kind==='hold'?1200:1600,gain:0.16})}
    tickedTo.current=Math.max(tickedTo.current,ahead)}
   // Misses: tiles that went by; then each long tile's moments as they come (kept while it's held down).
   if(stoppedAt.current&&!done.current){if(t-stoppedAt.current>900){finishRef.current();return}}
   else if(!done.current&&!frozen){
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
   const slotMs=Math.min(b.colW*0.72,(b.hitY-b.top)*0.13)/px // a tap tile's length, and its target slot's
   const beat=60000/info.bpm,pulse=frozen?0:Math.max(0,1-(((now%beat)+beat)%beat)/beat)
   // Around the road: night, with a soft glow at the horizon, lit on the beat.
   const g=ctx.createRadialGradient(cx,H*0.3,0,cx,H*0.3,Math.max(W,H)*0.8);g.addColorStop(0,'#3b1a55');g.addColorStop(0.55,'#170f2c');g.addColorStop(1,'#0b0716');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
   const hz=ctx.createRadialGradient(cx,yOf(far),0,cx,yOf(far),bw*0.8);hz.addColorStop(0,`rgba(255,95,162,${0.22+pulse*0.18})`);hz.addColorStop(1,'rgba(255,95,162,0)');ctx.fillStyle=hz;ctx.fillRect(0,0,W,b.hitY)
   // The road: dark glass, fading into the night far away; a column lights up while it's pressed (red on a miss).
   const rg=ctx.createLinearGradient(0,yOf(far),0,b.hitY);rg.addColorStop(0,'rgba(30,18,58,0)');rg.addColorStop(0.3,'rgba(30,18,58,0.85)');rg.addColorStop(1,'rgba(36,22,70,0.96)');ctx.fillStyle=rg;quad(0,4,now,far);ctx.fill()
   for(let l=0;l<4;l++){
    const pressed=lanesHeld.current[l]>0||t-pressedAt.current[l]<120,missed=t-missAt.current[l]<(stoppedAt.current?900:260)
    if(pressed||missed){const lg=ctx.createLinearGradient(0,b.hitY,0,yOf(far));lg.addColorStop(0,missed?'rgba(255,77,106,0.45)':LANE_COLORS[l]+'55');lg.addColorStop(1,missed?'rgba(255,77,106,0)':LANE_COLORS[l]+'00');ctx.fillStyle=lg;quad(l,l+1,now,far);ctx.fill()}}
   ctx.strokeStyle='rgba(255,255,255,0.07)';ctx.lineWidth=1;for(let l=1;l<4;l++){ctx.beginPath();ctx.moveTo(xOf(l,now),b.hitY);ctx.lineTo(xOf(l,far),yOf(far));ctx.stroke()}
   // Faint lines across on each beat (brighter on the bar), so the tiles' rhythm is easy to read.
   for(let bt=Math.ceil(now/beat)*beat;bt<far;bt+=beat){const y=yOf(bt);ctx.fillStyle=Math.round(bt/beat)%4===0?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.04)';ctx.fillRect(xOf(0,bt),y,xOf(4,bt)-xOf(0,bt),1)}
   // The road's glowing edges: pink on the left, blue on the right.
   for(const [c,col] of [[0,'255,95,162'],[4,'79,195,255']] as const){ctx.strokeStyle=`rgba(${col},${0.18+pulse*0.18})`;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(xOf(c,now),b.hitY);ctx.lineTo(xOf(c,far),yOf(far));ctx.stroke();ctx.strokeStyle=`rgba(${col},0.9)`;ctx.lineWidth=2;ctx.stroke()}
   // The target slots: a tile-shaped socket at the end of each column, exactly the size of a tap tile. A tile
   // fits right into its slot at the perfect moment, so you aim the whole tile, not a thin line.
   for(let l=0;l<4;l++){const pressed=lanesHeld.current[l]>0||t-pressedAt.current[l]<120
    ctx.fillStyle=LANE_COLORS[l]+(pressed?'55':Math.round(0x12+pulse*0x14).toString(16).padStart(2,'0'));quad(l+0.05,l+0.95,now,now+slotMs);ctx.fill()}
   // Tiles, the farthest first: each glows in its column's color (a soft halo, then the tile); a long tile runs
   // back to where its note ends, with a bright line down its middle, lit while it's held. In a sung song a tile
   // that plays the sung note wears a ♪. Hit tiles flash white and fade; missed ones go red.
   ctx.save();ctx.beginPath();ctx.rect(0,0,W,b.hitY+6);ctx.clip() // tiles end at the line, not over the pads
   const tile=(l:number,tA:number,tB:number,alpha=1)=>{
    ctx.globalAlpha=alpha*0.28;ctx.fillStyle=LANE_COLORS[l];quad(l+0.0,l+1.0,tA-slotMs*0.06,tB+slotMs*0.06);ctx.fill()
    ctx.globalAlpha=alpha;const tg=ctx.createLinearGradient(0,yOf(tB),0,yOf(tA));tg.addColorStop(0,LANE_COLORS[l]);tg.addColorStop(1,LANE_DEEP[l]);ctx.fillStyle=tg;quad(l+0.07,l+0.93,tA,tB);ctx.fill()
    ctx.fillStyle='rgba(255,255,255,0.45)';quad(l+0.14,l+0.86,tB-(tB-tA)*0.16,tB-(tB-tA)*0.08);ctx.fill()}
   for(let i=pl.notes.length-1;i>=0;i--){
    const n=pl.notes[i];if(n.kind==='sky'||n.t>far)continue
    // Each tile is as long as a key, but never runs into the next tile in its column.
    let h=slotMs;for(let k=i+1;k<pl.notes.length;k++){const m=pl.notes[k];if(m.t-n.t>ap)break;if(m.lane===n.lane&&m.kind!=='sky'){h=Math.min(h,(m.t-n.t)-ap*0.012);break}}
    h=Math.max(14/px,h)
    const end=n.kind==='hold'&&n.end?n.end:n.t+h,tB=Math.min(end,far)
    if(n.hit&&!doneAt.current.has(i))doneAt.current.set(i,t)
    if(n.hit==='miss'){const k=Math.min(1,(t-(doneAt.current.get(i)??t))/500),tA=Math.max(n.t,near);if(k>=1||tB<=tA)continue
     ctx.globalAlpha=1-k*0.6;ctx.fillStyle='#ff4d6a';quad(n.lane+0.07,n.lane+0.93,tA,tB);ctx.fill();ctx.globalAlpha=1;continue}
    if(n.hit&&n.kind!=='hold'){const k=(t-(doneAt.current.get(i)??t))/240,tA=Math.max(n.t,near);if(k>=1||tB<=tA)continue
     ctx.globalAlpha=1-k;ctx.fillStyle='#ffffff';quad(n.lane+0.07,n.lane+0.93,tA,tB);ctx.fill();ctx.globalAlpha=1;continue}
    const kept=n.kind==='hold'&&n.hit&&lanesHeld.current[n.lane]>0
    // Far tiles come out of the haze rather than popping in.
    const fade=Math.max(0,Math.min(1,(far-n.t)/(ap*0.12)))
    if(n.kind==='hold'&&n.end){
     const tA=n.hit?Math.max(n.t,now):Math.max(n.t,near);if(tB<=tA)continue
     ctx.globalAlpha=fade*(kept?0.75:0.42);const hg=ctx.createLinearGradient(0,yOf(tB),0,yOf(tA));hg.addColorStop(0,LANE_COLORS[n.lane]+'33');hg.addColorStop(1,LANE_COLORS[n.lane]);ctx.fillStyle=hg;quad(n.lane+0.12,n.lane+0.88,tA,tB);ctx.fill()
     ctx.globalAlpha=fade;ctx.strokeStyle=kept?'#fff':'rgba(255,255,255,0.7)';ctx.lineWidth=kept?4:2.5;ctx.beginPath();ctx.moveTo(xOf(n.lane+0.5,tA),yOf(tA));ctx.lineTo(xOf(n.lane+0.5,tB),yOf(tB));ctx.stroke()
     if(!n.hit)tile(n.lane,tA,Math.min(tB,tA+slotMs*0.55),fade)
     ctx.globalAlpha=1;continue
    }
    const tA=Math.max(n.t,near);if(tB<=tA)continue
    tile(n.lane,tA,tB,fade)
    if(noteless&&n.midi&&tB-tA>slotMs*0.5){const s=sOf(tA);ctx.globalAlpha=fade*0.7;ctx.fillStyle='#3a0d2c';ctx.textAlign='center';ctx.font='800 '+Math.round(b.colW*0.26*s)+'px system-ui,sans-serif';ctx.fillText('♪',xOf(n.lane+0.5,tA),(yOf(tA)+yOf(tB))/2+b.colW*0.09*s)}
    ctx.globalAlpha=1
   }
   ctx.restore()
   // The line: the four columns' colors, glowing on the beat; each slot's frame brightens as a tile slides into
   // it, and is brightest when the tile sits exactly inside (the perfect moment).
   {const lg=ctx.createLinearGradient(b.x0,0,b.x0+bw,0);LANE_COLORS.forEach((c,i)=>lg.addColorStop(i/3,c))
    ctx.save();ctx.shadowColor='rgba(255,255,255,0.8)';ctx.shadowBlur=10+pulse*10;ctx.fillStyle=lg;ctx.fillRect(xOf(0,now),b.hitY-2,xOf(4,now)-xOf(0,now),4);ctx.restore()
    for(let l=0;l<4;l++){let fit=0
     for(const n of pl.notes){if(n.t>now+slotMs)break;if(n.lane!==l||n.kind==='sky'||n.hit)continue;fit=Math.max(fit,1-Math.abs(n.t-now)/slotMs)}
     const pressed=lanesHeld.current[l]>0||t-pressedAt.current[l]<120
     ctx.save();ctx.lineJoin='round';ctx.shadowColor=LANE_COLORS[l];ctx.shadowBlur=4+fit*16
     ctx.strokeStyle=pressed||fit>0.8?'#fff':LANE_COLORS[l]+'aa';ctx.lineWidth=1.5+fit*2;quad(l+0.05,l+0.95,now,now+slotMs);ctx.stroke();ctx.restore()}}
   // The pads under the line, one for each column: where you tap. A pad glows in its color while it's pressed,
   // and flashes in a hit's color.
   ctx.textAlign='center'
   for(let l=0;l<4;l++){const x=b.x0+l*b.colW+4,w=b.colW-8,y0=b.padY,ph=b.padH,pressed=lanesHeld.current[l]>0||t-pressedAt.current[l]<120
    ctx.fillStyle=pressed?LANE_COLORS[l]+'5c':LANE_COLORS[l]+'14';ctx.beginPath();ctx.roundRect(x,y0,w,ph,18);ctx.fill()
    ctx.save();if(pressed){ctx.shadowColor=LANE_COLORS[l];ctx.shadowBlur=22}ctx.strokeStyle=pressed?LANE_COLORS[l]:LANE_COLORS[l]+'8c';ctx.lineWidth=2;ctx.stroke();ctx.restore()
    if(ph>50){ctx.font='700 12px system-ui,sans-serif';ctx.fillStyle=pressed?'#fff':'rgba(255,255,255,0.45)';ctx.fillText('DFJK'[l],x+w/2,y0+ph-12)}}
   // Hits: the pad flashes in the hit's color, a column of light shoots up the lane, and a ring spreads on the line.
   fx.current=fx.current.filter(e=>t-e.t<380)
   for(const e of fx.current){if(e.j==='miss')continue;const k=(t-e.t)/380,l=e.lane,col=e.j==='perfect'?'#ffd34d':LANE_COLORS[l],px0=b.x0+l*b.colW+4
    ctx.globalAlpha=(1-k)*0.6;ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(px0,b.padY,b.colW-8,b.padH,18);ctx.fill()
    const beam=ctx.createLinearGradient(0,b.hitY,0,b.hitY-(b.hitY-b.top)*0.45);beam.addColorStop(0,LANE_COLORS[l]);beam.addColorStop(1,'rgba(255,255,255,0)')
    ctx.globalAlpha=(1-k)*0.5;ctx.fillStyle=beam;ctx.fillRect(px0+6,b.hitY-(b.hitY-b.top)*0.45,b.colW-20,(b.hitY-b.top)*0.45)
    ctx.globalAlpha=1-k;ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(px0+(b.colW-8)/2,b.hitY,b.colW*0.32+k*b.colW*0.25,12+k*14,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
   const s=tally.current,spaced=(txt:string)=>txt.split('').join(' '),seen=s.perfect+s.great+s.good+s.miss,acc=seen?accuracy(s,seen):100
   {const sp=spokenAt.current
    if(s.combo>=sp.combo+25){sp.combo=s.combo-(s.combo%25);setSpoken('Combo '+sp.combo)}else if(s.combo<sp.combo)sp.combo=0
    if(s.miss>=sp.misses+5){sp.misses=s.miss;setSpoken(s.miss+' missed so far')}}
   const score=scoreOf(s,pl.total);cv.dataset.score=String(score)
   // The combo, big and faint behind the far end of the road (on a phone; a wide screen has it in the panel).
   if(!b.wide&&s.combo>=2){ctx.textAlign='center';ctx.globalAlpha=0.24;ctx.fillStyle='#fff';ctx.font='900 '+Math.round(Math.min(72,bw/5))+'px system-ui,sans-serif';ctx.fillText(String(s.combo),cx,b.top+(b.hitY-b.top)*0.3);ctx.font='800 12px system-ui,sans-serif';ctx.fillText(spaced('COMBO'),cx,b.top+(b.hitY-b.top)*0.3+18);ctx.globalAlpha=1}
   // The word for the last hit, big and glowing just above the line (where your eyes are), popping in.
   const wd=word.current
   if(wd&&t-wd.t<550){const k=(t-wd.t)/550,pop=1+Math.max(0,0.35-k*2.2),size=Math.round(Math.min(40,bw/8)*pop),y=b.hitY-(b.hitY-b.top)*0.24
    const col=wd.j==='perfect'?['#fff6c4','#ffc53d']:wd.j==='great'?['#d6f4ff','#4fc3ff']:wd.j==='good'?['#dcffd8','#5fe08a']:['#ffd0d8','#ff4d6a']
    ctx.globalAlpha=k<0.7?1:(1-k)/0.3;ctx.textAlign='center';ctx.font='900 '+size+'px system-ui,sans-serif'
    const wg=ctx.createLinearGradient(0,y-size,0,y);wg.addColorStop(0,col[0]);wg.addColorStop(1,col[1])
    ctx.save();ctx.shadowColor=col[1];ctx.shadowBlur=18;ctx.fillStyle=wg;ctx.fillText(spaced(WORD[wd.j].toUpperCase()),cx,y);ctx.restore()
    if(wd.off!==undefined&&wd.j!=='miss'){ctx.font='700 12px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.6)';ctx.fillText(wd.j==='perfect'?(wd.off>=0?'+':'−')+Math.abs(Math.round(wd.off))+' ms':spaced(wd.off<0?'EARLY':'LATE'),cx,y+18)}
    ctx.globalAlpha=1}
   // Lyrics: the line being sung (the words already sung lit gold) and the next one.
   const li=lyr.length?lyr.findLastIndex(l=>l[0]<=now+250):-1,cur=li>=0&&now<lyr[li][1]+1800?lyr[li]:null,nxt=lyr[li+1]&&lyr[li+1][0]-now<7000?lyr[li+1]:null
   cv.dataset.lyric=cur?cur[2]:'' // the line being sung (the tests read it)
   // Between lines: a soft ♪ while nobody sings, then a karaoke lead-in (● ● ●, one dot a beat) into the next line.
   const leadIn=(l:LyricLine|null)=>{if(!l)return '♪';const beats=Math.ceil((l[0]-now)/(60000/info.bpm));return beats>=1&&beats<=3?Array(beats).fill('●').join(' '):'♪'}
   const lyricLine=(l:LyricLine,x:number,y:number,maxW:number,size:number,align:'center'|'left',lit:boolean)=>{
    const words=l[2].split(' ');let f=size;ctx.font='800 '+f+'px system-ui,sans-serif'
    while(f>12&&ctx.measureText(l[2]).width>maxW){f--;ctx.font='800 '+f+'px system-ui,sans-serif'}
    let wx=align==='center'?x-ctx.measureText(l[2]).width/2:x;ctx.textAlign='left'
    words.forEach((w,i)=>{const on=lit&&l[3][i]!==undefined&&l[3][i]<=now+60
     ctx.save();if(on){ctx.fillStyle='#ffc53d';ctx.shadowColor='rgba(255,197,61,0.7)';ctx.shadowBlur=14}else ctx.fillStyle=lit?'rgba(255,255,255,0.92)':'rgba(255,255,255,0.4)'
     ctx.fillText(w,wx,y);ctx.restore();wx+=ctx.measureText(w+' ').width})
    return f}
   const gauge=(x:number,y:number,w:number)=>{
    ctx.fillStyle='rgba(255,255,255,0.12)';ctx.beginPath();ctx.roundRect(x,y,w,7,4);ctx.fill()
    const gg=ctx.createLinearGradient(x,0,x+w,0);if(level==='jeff'){gg.addColorStop(0,s.gauge>30?'#b06bff':'#ff4d6a');gg.addColorStop(1,s.gauge>30?'#ff9ae0':'#ff8a9c')}else{gg.addColorStop(0,s.gauge>=CLEAR_AT?'#2fbf8f':'#4f7dff');gg.addColorStop(1,s.gauge>=CLEAR_AT?'#7ff0c0':'#9fc0ff')}
    ctx.fillStyle=gg;ctx.beginPath();ctx.roundRect(x,y,Math.max(0,w*s.gauge/100),7,4);ctx.fill()
    if(level!=='jeff'){ctx.fillStyle='#fff';ctx.fillRect(x+w*CLEAR_AT/100-1,y-3,2,13)}}
   const lyricLineWrapped=(l:LyricLine,x:number,y:number,maxW:number,size:number,on:boolean)=>{
    // A line in the panel, wrapped onto as many rows as it needs; returns the height it took.
    ctx.font='800 '+size+'px system-ui,sans-serif';ctx.textAlign='left'
    const words=l[2].split(' '),rowH=size*1.3;let wx=x,wy=y
    words.forEach((w,i)=>{const ww=ctx.measureText(w+' ').width;if(wx>x&&wx+ctx.measureText(w).width>x+maxW){wx=x;wy+=rowH}
     const lit=on&&l[3][i]!==undefined&&l[3][i]<=now+60
     ctx.save();if(lit){ctx.fillStyle='#ffc53d';ctx.shadowColor='rgba(255,197,61,0.7)';ctx.shadowBlur=14}else ctx.fillStyle=on?'#fff':'rgba(255,255,255,0.38)'
     ctx.fillText(w,wx,wy);ctx.restore();wx+=ww})
    return wy-y+rowH+12}
   // Top (phone): the song's progress with its name and level, the accuracy, then the gauge. The ❚❚ button sits
   // at the left (it's a real button, over the canvas).
   if(!b.wide){
    if(pauseBtn.current?.style.left){pauseBtn.current.style.removeProperty('left');pauseBtn.current.style.removeProperty('top')}
    const x0=64,x1=W-96
    ctx.fillStyle='rgba(255,255,255,0.12)';ctx.beginPath();ctx.roundRect(x0,16,x1-x0,5,3);ctx.fill()
    const pg=ctx.createLinearGradient(x0,0,x1,0);pg.addColorStop(0,'#ff5fa2');pg.addColorStop(1,'#ffc53d');ctx.fillStyle=pg;ctx.beginPath();ctx.roundRect(x0,16,Math.max(5,(x1-x0)*Math.min(1,Math.max(0,now)/info.ms)),5,3);ctx.fill()
    ctx.font='600 11px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.6)';ctx.textAlign='left';ctx.fillText(clock(now),x0,36);ctx.textAlign='right';ctx.fillText(clock(info.ms),x1,36)
    ctx.textAlign='center';ctx.fillText(lv.name+' '+rating,(x0+x1)/2,36)
    ctx.textAlign='right';ctx.fillStyle='#fff';ctx.font='800 19px system-ui,sans-serif';ctx.fillText(acc.toFixed(1)+'%',W-14,26);ctx.font='700 9px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.55)';ctx.fillText(spaced('ACCURACY'),W-14,39)
    gauge(12,54,W-24)
    if(lyr.length){const y=96;if(cur)lyricLine(cur,W/2,y,W-32,20,'center',true)
     else{ctx.textAlign='center';ctx.font='800 20px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fillText(leadIn(nxt),W/2,y)}
     if(nxt&&nxt!==cur)lyricLine(nxt,W/2,y+24,W-40,14,'center',false)}
   }else{
    // A wide screen: the song (and its lyrics) on the left, how it's going on the right.
    const pw=b.panelW,lx=b.x0/2-pw/2,rx=W-b.x0/2-pw/2,py=24,ph=H-48
    for(const x of [lx,rx]){ctx.fillStyle='rgba(255,255,255,0.05)';ctx.strokeStyle='rgba(255,255,255,0.09)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x,py,pw,ph,24);ctx.fill();ctx.stroke()}
    // Left: the cover, title and level; the lyrics (or, for a song without them, the score); the progress.
    const jg=ctx.createLinearGradient(lx+20,py+20,lx+84,py+84);jg.addColorStop(0,j1);jg.addColorStop(1,j2);ctx.fillStyle=jg;ctx.beginPath();ctx.roundRect(lx+20,py+20,64,64,16);ctx.fill()
    ctx.textAlign='center';ctx.font='34px system-ui,sans-serif';ctx.fillText(jEmoji,lx+52,py+64)
    ctx.textAlign='left';ctx.fillStyle='#fff';let tf=21;ctx.font='800 '+tf+'px system-ui,sans-serif';while(tf>13&&ctx.measureText(info.title).width>pw-120){tf--;ctx.font='800 '+tf+'px system-ui,sans-serif'}ctx.fillText(info.title,lx+98,py+48)
    ctx.font='600 13px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.6)';ctx.fillText(lv.name+' '+rating+' · '+Math.round(info.bpm)+' BPM',lx+98,py+70)
    let y=py+124
    if(lyr.length){ctx.font='800 11px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.45)';ctx.fillText(spaced('LYRICS'),lx+20,y);if(!cur){ctx.textAlign='right';ctx.font='800 14px system-ui,sans-serif';ctx.fillText(leadIn(nxt),lx+pw-20,y);ctx.textAlign='left'}y+=34
     const from=Math.max(0,li-1)
     for(let k=from;k<lyr.length&&y<py+ph-80;k++){const l=lyr[k],on=k===li&&cur!==null,f=lyricLineWrapped(l,lx+20,y,pw-40,on?21:16,on);y+=f}}
    else{ctx.font='800 11px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.45)';ctx.fillText(spaced('SCORE'),lx+20,y);ctx.fillStyle='#fff';ctx.font='800 40px system-ui,sans-serif';ctx.fillText(score.toLocaleString(),lx+20,y+46)}
    const by=py+ph-38;ctx.fillStyle='rgba(255,255,255,0.12)';ctx.beginPath();ctx.roundRect(lx+20,by,pw-40,6,3);ctx.fill()
    const pg=ctx.createLinearGradient(lx+20,0,lx+pw-20,0);pg.addColorStop(0,'#ff5fa2');pg.addColorStop(1,'#ffc53d');ctx.fillStyle=pg;ctx.beginPath();ctx.roundRect(lx+20,by,Math.max(6,(pw-40)*Math.min(1,Math.max(0,now)/info.ms)),6,3);ctx.fill()
    ctx.font='600 12px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.6)';ctx.textAlign='left';ctx.fillText(clock(now),lx+20,by+22);ctx.textAlign='right';ctx.fillText(clock(info.ms),lx+pw-20,by+22)
    // Right: the combo, the hits so far, the gauge, the accuracy and the score; the keys at the bottom.
    ctx.textAlign='left';ctx.font='800 11px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.45)';ctx.fillText(spaced('COMBO'),rx+20,py+38)
    ctx.fillStyle='#fff';ctx.font='900 72px system-ui,sans-serif';ctx.fillText(String(s.combo),rx+18,py+108)
    const rows:[string,number,string][]=[['Perfect',s.perfect,'#c99bff'],['Great',s.great,'#7fd3ff'],['Good',s.good,'#7ff0c0'],['Miss',s.miss,'#ff8a9c']]
    rows.forEach(([n,v,c],i)=>{const ry=py+150+i*36;ctx.font='700 15px system-ui,sans-serif';ctx.fillStyle=c;ctx.textAlign='left';ctx.fillText(n,rx+20,ry);ctx.fillStyle='#fff';ctx.textAlign='right';ctx.fillText(String(v),rx+pw-20,ry);ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(rx+20,ry+13,pw-40,1)})
    let gy=py+150+4*36+16;ctx.textAlign='left';ctx.font='700 13px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.7)';ctx.fillText(level==='jeff'?'Gauge':'Clear gauge',rx+20,gy);ctx.textAlign='right';ctx.fillText(Math.floor(s.gauge)+'%',rx+pw-20,gy)
    gauge(rx+20,gy+12,pw-40);gy+=56
    ctx.textAlign='left';ctx.fillText('Accuracy',rx+20,gy);ctx.textAlign='right';ctx.fillText(acc.toFixed(1)+'%',rx+pw-20,gy);gy+=30
    ctx.textAlign='left';ctx.fillText('Score',rx+20,gy);ctx.textAlign='right';ctx.fillText(score.toLocaleString(),rx+pw-20,gy)
    ctx.textAlign='left';ctx.font='600 12px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fillText('D F J K  hit · Esc  pause',rx+20,py+ph-26)
    // ❚❚ sits in the corner of this panel.
    const pb=pauseBtn.current;if(pb){const r=cv.getBoundingClientRect(),host=pb.offsetParent?.getBoundingClientRect();if(host){pb.style.setProperty('left',(r.left-host.left+rx+pw-62)+'px','important');pb.style.setProperty('top',(r.top-host.top+py+ph-62)+'px','important')}}
   }
   // The start: the song's name on a band across the board, then away.
   const since=t-startedAt.current
   if(since<2400){const k=since/2400,a=k<0.15?k/0.15:k>0.75?(1-k)/0.25:1,y=b.top+(b.hitY-b.top)*0.42
    ctx.globalAlpha=a*0.9;ctx.fillStyle='#120b24';ctx.fillRect(b.x0,y-42,bw,84)
    ctx.globalAlpha=a;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='800 '+Math.min(26,bw/13)+'px system-ui,sans-serif';ctx.fillText(info.title,cx,y+2)
    ctx.font='800 11px system-ui,sans-serif';ctx.fillStyle=LEVEL_COLORS[level];ctx.fillText(spaced((lv.name+' · '+rating+(warm.current?' · warm-up':'')).toUpperCase()),cx,y+24);ctx.globalAlpha=1}
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
  if(lane>=0&&!livePaused.current){lanesHeld.current[lane]++;press(lane,inputLag(e))}
 }
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  const p=pointers.current.get(e.pointerId);if(!p)return
  const lane=laneAt(e.currentTarget,e.clientX)
  if(lane!==p.lane){if(p.lane>=0)lanesHeld.current[p.lane]=Math.max(0,lanesHeld.current[p.lane]-1);if(lane>=0)lanesHeld.current[lane]++}
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY,lane})
 }
 const up=(e:React.PointerEvent<HTMLCanvasElement>)=>{const p=pointers.current.get(e.pointerId);if(!p)return;if(p.lane>=0)lanesHeld.current[p.lane]=Math.max(0,lanesHeld.current[p.lane]-1);pointers.current.delete(e.pointerId)}
 const setOffset=(v:number)=>{v=Math.max(-300,Math.min(300,v));setOffsetState(v);saveOffset(v);liveOffset.current=v}
 const setSpeed=(v:number)=>{const s=Math.max(1,Math.min(10,Math.round(v*2)/2));setSpeedState(s);saveSpeed(s);liveSpeed.current=s}
 const setHits=(v:HitSound)=>{setHitsState(v);saveHits(v);liveHits.current=v}

 // The settings, in plain words (on the song select's ⚙ sheet, and on the pause sheet while a song plays).
 const settings=(during:boolean)=><div className="beat-settings">
  <div className="beat-set"><span><b>Note speed</b><small>How fast the tiles come down</small></span><span className="beat-step"><button type="button" aria-label="Notes slower" onClick={()=>setSpeed(speed-0.5)}>−</button><output>{speed.toFixed(1)}</output><button type="button" aria-label="Notes faster" onClick={()=>setSpeed(speed+0.5)}>+</button></span></div>
  <div className="beat-set"><span><b>Timing</b><small>{during?'Shift it if the tiles feel early or late':<>For your speakers or headphones · <button type="button" className="beat-link" onClick={()=>setSyncing('ask')}>Timing check</button></>}</small></span><span className="beat-step beat-timing"><button type="button" aria-label="Notes earlier" onClick={()=>setOffset(offset-5)}>−</button><output>{offset>0?'+':''}{offset} ms</output><button type="button" aria-label="Notes later" onClick={()=>setOffset(offset+5)}>+</button></span></div>
  <div className="beat-set"><span><b>Hit sounds</b><small>{hits==='notes'?'Each tile plays its note (a tick where it has none)':hits==='ticks'?'A soft tick on every hit':'Just the song'}</small></span><span className="beat-seg" role="radiogroup" aria-label="Hit sounds">{(['notes','ticks','off'] as HitSound[]).map(v=><button type="button" key={v} role="radio" aria-checked={hits===v} onClick={()=>setHits(v)}>{v==='notes'?'Notes':v==='ticks'?'Ticks':'Off'}</button>)}</span></div>
  <label className="beat-set beat-check"><span><b>Guide clicks</b><small>A click on every tile, to hear the timing</small></span><input type="checkbox" checked={ticks} onChange={e=>{setTicks(e.target.checked);saveTicks(e.target.checked)}}/></label>
  {!during&&<label className="beat-set beat-check"><span><b>Classic</b><small>One miss or wrong tap ends the song</small></span><input type="checkbox" checked={classic} onChange={e=>{setClassic(e.target.checked);saveClassic(e.target.checked)}}/></label>}
 </div>
 const syncSheet=syncing&&<div className="beat-overlay"><BeatSync first={syncing==='first'} onDone={ms=>{setOffset(ms);saveSynced()}} onClose={()=>{const first=syncing==='first';setSyncing(null);if(first){saveSynced();void start(pendingWarm.current)}}}/></div>

 const pickSong=(id:string)=>{setSong(id);saveLast(id,level)}
 const pickLevel=(l:Level)=>{setLevel(l);saveLast(song,l)}
 if(!playing){
  const best=readBeatBest(info.id,level),[,j1,j2]=jacketOf(info.id),li0=info.lyrics?.findIndex(l=>l[2].split(' ').length>=4)??-1,firstLine=li0>=0?info.lyrics![li0][2]:undefined,secondLine=li0>=0?info.lyrics![li0+1]?.[2]?.replace(/[.,!?;:—–-]+$/,''):undefined
  const shown=SONGS.filter(s=>filter==='all'||filter==='sung'&&SUNG.has(s.id)||filter==='todo'&&!(readBeatBest(s.id,level)?.clear&&readBeatBest(s.id,level)!.clear!=='fail'))
  return <div className="beat-ui beat-pick">
   <div className="beat-main">
    <section className="beat-hero" aria-label="Song" style={{'--j1':j1,'--j2':j2} as React.CSSProperties}>
     <span className="beat-tag">{SUNG.has(info.id)?'🎤 Sung · tiles on the singing':FROM[info.id]}</span>
     <span className="beat-hero-art" aria-hidden="true">{jacketOf(info.id)[0]}</span>
     <h3>{info.title}</h3>
     <p className="beat-meta">{Math.round(info.bpm)} BPM · {clock(info.ms)}</p>
     {firstLine&&<p className="beat-hero-lyric">“{firstLine}{secondLine&&<span> / {secondLine}…</span>}”</p>}
     <button type="button" className="beat-gear" aria-label="Settings" onClick={()=>setSheet(true)}>⚙</button>
    </section>
    <div className="beat-levels" role="group" aria-label="Difficulty">{LEVELS.map(l=>{const b=readBeatBest(info.id,l.id);return <button type="button" key={l.id} aria-pressed={level===l.id} style={{'--lv':LEVEL_COLORS[l.id]} as React.CSSProperties} onClick={()=>pickLevel(l.id)}><span>{l.name}</span><b>{ratingOf(info,l.id)}</b><small>{b?'Best '+b.grade+(CLEAR_MARK[b.clear]?' · '+CLEAR_MARK[b.clear]:''):'Not played'}</small></button>})}</div>
    <p className="beat-blurb">{LEVELS.find(l=>l.id===level)!.blurb}{best&&<> · best <b>{best.score.toLocaleString()}</b>{best.clear!=='fail'&&<> · {CLEAR_NAME[best.clear].replace('!','')}</>}</>}</p>
    {reset&&<p className="beat-reset" role="status">Timing is back to 0 ms: it used to shift by itself and could drift far off. Run the timing check (⚙ Settings) to set it for your speakers or headphones.</p>}
    <button type="button" className="beat-play" onClick={()=>go()} disabled={loading}>{loading?'Loading…':<>▶ Play <span>{info.title}</span></>}</button>
    <button type="button" className="beat-warmup" onClick={()=>go(true)} disabled={loading}>Warm-up · 30 s <small>nothing counts</small></button>
   </div>
   <section className="beat-list" aria-label="Songs">
    <div className="beat-list-head"><h3>All songs</h3><span>{SONGS.length} · {SUNG.size} sung</span></div>
    <div className="beat-chips" role="group" aria-label="Show">{([['all','All'],['sung','🎤 Sung'],['todo','Not cleared']] as const).map(([k,n])=><button type="button" key={k} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{n}</button>)}</div>
    <ul className="beat-songs">{shown.map(s=>{const b=readBeatBest(s.id,level);return <li key={s.id}><button type="button" aria-pressed={song===s.id} onClick={()=>pickSong(s.id)}><Jacket id={s.id}/><span className="beat-song-text"><b>{s.title}</b><small>{FROM[s.id]} · {Math.round(s.bpm)} BPM · {clock(s.ms)}</small></span>{b?<i aria-label={'Best '+b.score.toLocaleString()+', '+b.grade+(b.clear!=='fail'?', '+CLEAR_NAME[b.clear]:'')}>{b.grade}{CLEAR_MARK[b.clear]&&<em>{CLEAR_MARK[b.clear]}</em>}</i>:<i className="is-none" aria-hidden="true">—</i>}</button></li>})}
     {!shown.length&&<li className="beat-empty">Every song here is cleared on {LEVELS.find(l=>l.id===level)!.name}. 🎉</li>}</ul>
   </section>
   {sheet&&<div className="beat-overlay" onClick={e=>{if(e.target===e.currentTarget)setSheet(false)}}><section className="beat-sheet" role="dialog" aria-label="Settings"><div className="beat-sheet-head"><h3>Settings</h3><button type="button" className="beat-done" onClick={()=>setSheet(false)}>Done</button></div>{settings(false)}
    <details className="beat-how"><summary>How to play</summary><ul>
     <li>Tap a tile’s column (<kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd>, or the arrows) as it reaches the line; hold a long tile down to its end. Escape pauses.</li>
     <li>Fill the gauge past {CLEAR_AT}% by the end to clear a song. On Jeff tier it starts full and drains with misses: keep it above empty. The song always plays to the end.</li>
     <li>In a sung song the tiles are on the singing: a ♪ tile plays the sung note, the others a soft tick.</li>
     <li>If the tiles feel early or late (Bluetooth headphones often do), run the timing check; after a song, the results offer a fix too.</li>
    </ul></details></section></div>}
   {syncSheet}
  </div>
 }
 return <div className="beat-ui beat-stage"><p className="beat-sr" aria-live="polite">{spoken}</p>
  <canvas ref={canvas} className="beat-canvas" role="img" aria-label={'KONO Beat: '+info.title} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/>
  <button ref={pauseBtn} type="button" className="beat-pause" aria-label="Pause" onClick={()=>pause()}><span aria-hidden="true">❚❚</span></button>
  {paused&&<div className="beat-overlay is-dim">{countIn>0?<p className="beat-countin" role="status" aria-live="assertive">{countIn}</p>:<section className="beat-sheet" role="dialog" aria-label="Paused">
   <div className="beat-sheet-head"><h3>Paused</h3><small>{info.title} · {LEVELS.find(l=>l.id===level)!.name}{pausedAt.warm?' warm-up':''} · {clock(pausedAt.ms)} of {clock(info.ms)}</small></div>
   <button type="button" className="beat-play" onClick={resume} autoFocus>▶ Resume</button>
   <div className="beat-row3"><button type="button" onClick={()=>void start(pausedAt.warm)}>↻ Restart</button><button type="button" onClick={()=>finishRef.current()}>■ End</button><button type="button" onClick={()=>{stopSong();onLeave?.()}}>✕ Leave</button></div>
   {settings(true)}
  </section>}</div>}
 </div>
}
