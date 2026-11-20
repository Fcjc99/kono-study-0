import {useEffect,useRef,useState,type ReactNode} from 'react'
import {gameSound} from '../konoSounds'
import {musicOn,setMusicOn} from '../arcadeAudio'
import {GAME_SCREEN_EVENT} from '../hooks/useComfort'

/** A game, full screen: its own dialog over everything (a native <dialog>, so it stacks above the dialog it
 * was opened from and Escape works). It slides in when it opens and out when it closes, and every game goes
 * through the same three steps, with the same sounds (konoSounds › gameSound):
 * - Start: the game's card (what it is, how to play, your best) and Start (KONO blast adds New game
 *   beside Continue when a game is saved).
 * - Play: the game, with ↻ Restart and ■ End (finish now and see how you did) beside Leave.
 * - Results: the score, a new best, coins, with Play again and Done (a chime for a round won, a soft tune
 *   for one lost, then the coins coming in).
 * Escape leaves (or pauses a game that can, see GameHandle), and only this screen: the event doesn't go on to
 * the dialog it was opened from (KONO Town used to close with it).
 * With Sounds on, 🎵 turns the games' music on and off (kept on this device). KONO's own music pauses while a
 * game is open, so only one song plays at a time. */
/** `behind`: keep the finished game in view behind the results (KONO Stack's tower). */
/** `detail`: more for the results, under the score (KONO Beat's breakdown of the song). */
export type GameResult={emoji:string;title:string;line:string;score?:string;best?:boolean;coins?:string|null;won?:boolean;behind?:boolean;detail?:ReactNode}
/** `extra`: more for the start card, under the how-to (Sweet swap's level map). */
export type GameIntro={emoji:string;art?:React.ReactNode;name:string;how:string;best?:string|null;start?:string;alt?:{label:string;onClick:()=>void};extra?:React.ReactNode}
/** What a game lets its screen do: End finishes the round now with the score so far. `pause`, if a game has it,
 * takes Escape while it plays (KONO Beat pauses its song) and says whether it did; otherwise Escape leaves. */
export type GameHandle={end:()=>void;pause?:()=>boolean}
// Where the stage's sparkles sit (left %, top %, delay s, duration s): fixed, so a game looks the same each time.
// A new best's confetti (left %, color, delay s, spin).
const CONFETTI:[number,string,number,number][]=[[6,'#ff5f87',0,320],[14,'#ffd84d',.12,-280],[22,'#5ef2ff',.05,400],[31,'#62f08a',.2,-360],[40,'#c37bff',.08,300],[49,'#ffa14a',.16,-420],[58,'#ff5f87',.02,380],[67,'#5b8cff',.22,-300],[76,'#ffd84d',.1,340],[85,'#62f08a',.18,-380],[93,'#c37bff',.06,420],[18,'#fff',.26,-260],[63,'#fff',.3,280]]
const SPARKS:[number,number,number,number][]=[[8,18,0,7],[22,72,1.2,9],[35,30,2.5,8],[48,86,0.6,10],[61,12,3.1,7.5],[74,58,1.8,9.5],[86,26,0.3,8.5],[93,80,2.2,7],[14,46,3.6,10],[55,44,4.2,8],[70,92,1,9],[30,8,4.8,7.5]]
export default function GameScreen({title,tone,game,sound=false,intro,started=true,onStart,onRestart,onEnd,onLeave,result,onAgain,onEscape,children}:{
 title:string;tone?:string;game?:string;sound?:boolean;onEscape?:()=>boolean
 intro?:GameIntro;started?:boolean;onStart?:()=>void
 onRestart?:()=>void;onEnd?:()=>void;onLeave:()=>void
 result?:GameResult|null;onAgain?:()=>void;children:ReactNode
}){
 const ref=useRef<HTMLDialogElement>(null),[closing,setClosing]=useState(false),[music,setMusic]=useState(musicOn)
 useEffect(()=>{const d=ref.current;d?.showModal();window.dispatchEvent(new CustomEvent(GAME_SCREEN_EVENT,{detail:true}));return()=>{d?.close();window.dispatchEvent(new CustomEvent(GAME_SCREEN_EVENT,{detail:false}))}},[])
 // The results' sounds: a chime or a soft tune, then the coins.
 useEffect(()=>{
  if(!result)return
  gameSound(result.won===false?'lose':'win',sound)
  if(!result.coins)return
  const t=window.setTimeout(()=>gameSound('coin',sound),650)
  return ()=>window.clearTimeout(t)
 },[result,sound])
 // Leave and Done slide the screen away first.
 const leave=()=>{if(closing)return;setClosing(true);window.setTimeout(onLeave,matchMedia('(prefers-reduced-motion: reduce)').matches?0:240)}
 const start=()=>{gameSound('start',sound);onStart?.()}
 const phase=!started&&intro?'start':result?'results':'play'
 // A game that keeps itself in view behind its results (`behind`) stays mounted under them.
 const results=result?<section className={'game-result'+(result.behind?' is-over-game':'')} aria-live="polite" aria-label="Results">
   {/* KONO reacts to the round (cheering for a win or a new best), with the game's emoji as its badge. */}
   <span className="game-result-kono" aria-hidden="true"><img src={result.best||result.won?'/garden/kono/excited.webp':'/garden/kono/happy.webp'} alt="" draggable={false}/><i>{result.emoji}</i></span>
   <h2>{result.title}</h2>
   {result.score&&<p className="game-result-score"><CountUp text={result.score}/></p>}
   {result.best&&<p className="game-result-best">👑 New best!</p>}
   {(result.best||result.won)&&<span className="game-confetti" aria-hidden="true">{CONFETTI.map((c,i)=><i key={i} style={{left:c[0]+'%',background:c[1],animationDelay:c[2]+'s',['--spin' as string]:c[3]+'deg'}}/>)}</span>}
   {result.detail}
   <p className="game-result-line">{result.line}</p>
   {result.coins&&<p className="game-result-coins">{result.coins}</p>}
   <div className="game-result-actions">{onAgain&&<button type="button" className="primary" onClick={()=>{gameSound('start',sound);onAgain()}}>Play again</button>}<button type="button" onClick={leave}>Done</button></div>
  </section>:null
 return <dialog ref={ref} className={'game-screen'+(tone?' is-'+tone:'')+(closing?' is-closing':'')+' is-'+phase} data-game={game} aria-label={title} onCancel={e=>{e.preventDefault();e.stopPropagation();if(phase==='play'&&onEscape?.())return;leave()}}>
  {/* The stage: each game's own colors drifting slowly behind it, with a few sparkles (break-games.css). */}
  <div className="game-stage" aria-hidden="true"><i/><i/><i/>{SPARKS.map((p,i)=><b key={i} style={{left:p[0]+'%',top:p[1]+'%',animationDelay:p[2]+'s',animationDuration:p[3]+'s'}}/>)}</div>
  <header><strong>{title}</strong><span className="game-screen-tools">
   {phase==='play'&&onRestart&&<button type="button" className="game-screen-tool" onClick={()=>{gameSound('start',sound);onRestart()}}>↻<span className="tool-label"> Restart</span></button>}
   {phase==='play'&&onEnd&&<button type="button" className="game-screen-tool" onClick={onEnd}>■<span className="tool-label"> End</span></button>}
   {sound&&<button type="button" className="game-screen-tool" aria-pressed={music} aria-label="Music" onClick={()=>{setMusicOn(!music,sound);setMusic(!music)}}>{music?'🎵':'🔇'}</button>}
   <button type="button" className="game-screen-leave" onClick={leave}>✕<span className="tool-label"> Leave</span></button>
  </span></header>
  <div className="game-screen-body">{phase==='start'&&intro?<section className={'game-result game-start'+(intro.art?' has-art':'')} aria-label="Start">
   {intro.art?<span className="game-start-art" aria-hidden="true">{intro.art}</span>:<span className="game-result-emoji" aria-hidden="true">{intro.emoji}</span>}
   <h2>{intro.name}</h2>
   <p className="game-result-line">{intro.how}</p>
   {intro.best&&<p className="game-result-best">👑 {intro.best}</p>}
   {intro.extra}
   <div className="game-result-actions"><button type="button" className="primary" onClick={start}>{intro.start??'Start'}</button>{intro.alt&&<button type="button" onClick={()=>{gameSound('start',sound);intro.alt!.onClick()}}>{intro.alt.label}</button>}</div>
  </section>:phase==='results'&&result&&!result.behind?results:<>{children}{phase==='results'&&result&&<div className="game-result-over">{results}</div>}</>}</div>
 </dialog>
}

/** The results' score, counted up from zero: the first number in the text runs up over most of a second
 * (the rest of the text stays as it is). Reduced motion shows it at once. */
function CountUp({text}:{text:string}){
 const m=/[\d,]+(\.\d+)?/.exec(text),target=m?Number(m[0].replace(/,/g,'')):NaN
 const [n,setN]=useState(()=>Number.isFinite(target)&&!matchMedia('(prefers-reduced-motion: reduce)').matches?0:target)
 useEffect(()=>{
  if(!Number.isFinite(target)||matchMedia('(prefers-reduced-motion: reduce)').matches)return
  const start=performance.now(),dur=Math.min(1100,400+Math.log10(target+1)*220);let raf=0
  const tick=(now:number)=>{const k=Math.min(1,(now-start)/dur),e=1-Math.pow(1-k,3);setN(target*e);if(k<1)raf=requestAnimationFrame(tick)}
  raf=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(raf)
 },[target])
 if(!m||!Number.isFinite(target))return <>{text}</>
 const decimals=m[1]?m[1].length-1:0,shown=decimals?n.toFixed(decimals):Math.round(n).toLocaleString()
 // The real words stay in the page (for screen readers and search); while it counts, they're see-through and
 // the running number is drawn over them.
 const running=n!==target
 return <span className={running?'count-run':undefined} data-n={running?text.slice(0,m.index)+shown+text.slice(m.index+m[0].length):undefined}>{text}</span>
}
