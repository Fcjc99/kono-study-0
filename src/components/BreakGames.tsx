import './break-games.css'
import {useEffect,useRef,useState} from 'react'
import BlockBlast from './BlockBlast'
import GameScreen from './GameScreen'
import {deal,readBlastSave,type BlastSave,type Piece} from '../store/blockBlast'

/** Break-time games with KONO, offered when a focus session finishes ("Take a short break"). Two quick
 * ones: Snack catch (move KONO to catch falling treats, 30 seconds) and Peekaboo (tap KONO when it pops
 * out of a hole, 30 seconds). Every game plays full screen in KONO blast's look. The break itself lasts five
 * minutes; when it's over the games stop and KONO says it's time for the next session. Best scores are
 * kept on this device only. Loaded only when opened, so it never adds to the app's startup.
 * The same games (and KONO blast, the block puzzle) are KONO Town's arcade: no break timer there, and `onScore` can turn a
 * score into coins (it returns what to add to the result line). */
type Game='catch'|'peekaboo'|'blast'
export const BREAK_MINUTES=5
const ROUND_MS=30_000
const GAMES:{id:Game;emoji:string;name:string;how:string;best:(n:number)=>string;arcade?:boolean}[]=[
 {id:'catch',emoji:'🍓',name:'Snack catch',how:'Move KONO to catch the falling snacks.',best:n=>'Best: '+n+' snacks'},
 {id:'peekaboo',emoji:'🌿',name:'Peekaboo',how:'Tap KONO when it peeks out of a bush.',best:n=>'Best: '+n+' boops'},
 {id:'blast',emoji:'🧱',name:'KONO blast',how:'Fit the pieces on the board; fill a row or column to clear it.',best:n=>'Best: '+n+' points',arcade:true},
]
const bestKey=(g:Game)=>'kono-break-best:'+g
function readBest(g:Game):number|null{try{const v=localStorage.getItem(bestKey(g));return v===null?null:Number(v)}catch{return null}}
/** Saves a score if it's a new best; returns whether it was. */
function saveBest(g:Game,score:number):boolean{
 const old=readBest(g),better=old===null||!Number.isFinite(old)||score>old
 if(better)try{localStorage.setItem(bestKey(g),String(score))}catch{/* storage unavailable */}
 return better
}
const clock=(ms:number)=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}

/** `startedAt` is when the break games were opened (the break runs BREAK_MINUTES from then). */
/** Games play full screen (GameScreen); Leave goes back to the list. KONO blast pays coins as lines clear
 * (`onBlastCoins`) and is saved as it goes, so Leave keeps it for next time. */
export default function BreakGames({startedAt,onClose,arcade=false,sound=false,onScore,onBlastCoins}:{startedAt:number;onClose?:()=>void;arcade?:boolean;sound?:boolean;onScore?:(game:Game,score:number)=>string|null;onBlastCoins?:(lines:number,streak:number)=>number|null}){
 const [game,setGame]=useState<Game|null>(null),[pieces,setPieces]=useState<Piece[]>([]),[blastSave,setBlastSave]=useState<BlastSave|null>(null)
 const [now,setNow]=useState(startedAt)
 const [result,setResult]=useState<string|null>(null)
 useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(t)},[])
 const left=startedAt+BREAK_MINUTES*60_000-now,over=!arcade&&left<=0
 const finish=(g:Game,score:number,line:string)=>{const best=saveBest(g,score),extra=g==='blast'?null:onScore?.(g,score);setResult(line+(best?' New best! 🎉':'')+(extra?' '+extra:''));setGame(null)}
 const info=GAMES.find(g=>g.id===game)
 const playing=over?null:game==='catch'?<SnackCatch onEnd={n=>finish('catch',n,'KONO caught '+n+' snack'+(n===1?'':'s')+'! 😋')}/>
  :game==='peekaboo'?<Peekaboo onEnd={n=>finish('peekaboo',n,'You booped KONO '+n+' time'+(n===1?'':'s')+'! 🌿')}/>
  :game==='blast'?<BlockBlast start={pieces} saved={blastSave} best={readBest('blast')} sound={sound} onCoins={onBlastCoins} onEnd={n=>finish('blast',n,'KONO blast: '+n+' point'+(n===1?'':'s')+'! 🧱')}/>
  :null
 const kept=readBlastSave()
 return <section className={'break-games'+(arcade?' is-arcade':'')} aria-label={arcade?'Arcade':'Break games with KONO'}>
  {!arcade&&<header><strong>🎮 Break time with KONO</strong><span role="timer" aria-label="Break time left">{over?'Break’s over':'Break: '+clock(left)}</span>{onClose&&<button type="button" onClick={onClose}>Close</button>}</header>}
  {over?<p className="break-over" role="status">That was a nice reset! KONO’s ready for the next session when you are. 📚</p>
  :<>{result&&<p className="break-result" role="status">{result}</p>}<div className="break-game-list">{GAMES.filter(g=>arcade||!g.arcade).map(g=>{const best=readBest(g.id);return <button type="button" key={g.id} onClick={()=>{setResult(null);if(g.id==='blast'){setPieces(deal(Math.random));setBlastSave(readBlastSave())}setGame(g.id)}}><span aria-hidden="true">{g.emoji}</span><strong>{g.name}</strong><small>{g.id==='blast'&&kept?'Carry on your game ('+kept.score+' points so far)':g.how}</small>{best!==null&&<small className="break-best">{g.best(best)}</small>}</button>})}</div></>}
  {playing&&info&&<GameScreen title={info.emoji+' '+info.name} tone="blast" onLeave={()=>setGame(null)}>
   {!arcade&&<p className="game-screen-timer" role="timer">{'Break: '+clock(left)}</p>}
   {playing}
  </GameScreen>}
 </section>
}

/** Snack catch: snacks fall in a box; KONO slides along the bottom (drag, tap a side, or ← →). */
const SNACKS=['🍓','🍪','🍙','🍩','🍎','🧁']
function SnackCatch({onEnd}:{onEnd:(score:number)=>void}){
 const boxRef=useRef<HTMLDivElement>(null),konoRef=useRef<HTMLImageElement>(null)
 const [score,setScore]=useState(0),[left,setLeft]=useState(ROUND_MS)
 const [snacks,setSnacks]=useState<{id:number;x:number;y:number;emoji:string;speed:number}[]>([])
 const state=useRef({x:0.5,keys:0,score:0,snacks:[] as {id:number;x:number;y:number;emoji:string;speed:number}[],next:0,id:0})
 const onEndRef=useRef(onEnd)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 useEffect(()=>{
  const s=state.current
  const started=performance.now()
  let raf=0,last=started,done=false
  const tick=(t:number)=>{
   const dt=Math.min(50,t-last);last=t
   if(s.keys)s.x=Math.min(0.94,Math.max(0.06,s.x+s.keys*dt*0.0011))
   if(t>=s.next){s.snacks.push({id:++s.id,x:0.08+Math.random()*0.84,y:-0.06,emoji:SNACKS[Math.floor(Math.random()*SNACKS.length)],speed:0.00028+Math.random()*0.00022});s.next=t+520+Math.random()*420}
   for(const sn of s.snacks)sn.y+=sn.speed*dt
   const caught=s.snacks.filter(sn=>sn.y>0.8&&sn.y<0.96&&Math.abs(sn.x-s.x)<0.11)
   if(caught.length){s.score+=caught.length;setScore(s.score)}
   s.snacks=s.snacks.filter(sn=>!caught.includes(sn)&&sn.y<1.05)
   setSnacks([...s.snacks])
   if(konoRef.current)konoRef.current.style.left=(s.x*100)+'%'
   const remaining=ROUND_MS-(t-started);setLeft(remaining)
   if(remaining<=0){if(!done){done=true;onEndRef.current(s.score)}return}
   raf=requestAnimationFrame(tick)
  }
  raf=requestAnimationFrame(tick)
  const key=(e:KeyboardEvent,down:boolean)=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();s.keys=down?(e.key==='ArrowLeft'?-1:1):0}}
  const kd=(e:KeyboardEvent)=>key(e,true),ku=(e:KeyboardEvent)=>key(e,false)
  window.addEventListener('keydown',kd);window.addEventListener('keyup',ku)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku)}
 },[])
 const move=(clientX:number)=>{const r=boxRef.current?.getBoundingClientRect();if(r)state.current.x=Math.min(0.94,Math.max(0.06,(clientX-r.left)/r.width))}
 return <div className="break-game">
  <p className="break-game-status"><span>Snacks: <strong>{score}</strong></span><span>{clock(left)}</span></p>
  <div ref={boxRef} className="snack-catch" role="application" aria-label="Snack catch: move KONO with the arrow keys or by dragging" tabIndex={0}
   onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);move(e.clientX)}} onPointerMove={e=>{if(e.buttons)move(e.clientX)}}>
   {snacks.map(sn=><span key={sn.id} className="snack" style={{left:(sn.x*100)+'%',top:(sn.y*100)+'%'}} aria-hidden="true">{sn.emoji}</span>)}
   <img ref={konoRef} className="snack-catch-kono" src="/garden/kono/excited.webp" alt="" draggable={false}/>
  </div>
 </div>
}

/** Peekaboo: KONO pops out of one of nine bushes for a moment; tap it for a boop. */
function Peekaboo({onEnd}:{onEnd:(score:number)=>void}){
 const [at,setAt]=useState(-1),[score,setScore]=useState(0),[left,setLeft]=useState(ROUND_MS),[booped,setBooped]=useState(-1)
 const onEndRef=useRef(onEnd),scoreRef=useRef(0)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 useEffect(()=>{
  const started=Date.now()
  let pop=0
  const show=()=>{setBooped(-1);setAt(prev=>{let n=Math.floor(Math.random()*9);if(n===prev)n=(n+1)%9;return n});pop=window.setTimeout(()=>{setAt(-1);pop=window.setTimeout(show,250+Math.random()*350)},750+Math.random()*350)}
  pop=window.setTimeout(show,400)
  const timer=window.setInterval(()=>{const remaining=ROUND_MS-(Date.now()-started);setLeft(remaining);if(remaining<=0){window.clearInterval(timer);window.clearTimeout(pop);onEndRef.current(scoreRef.current)}},200)
  return ()=>{window.clearInterval(timer);window.clearTimeout(pop)}
 },[])
 const boop=(i:number)=>{if(i!==at)return;scoreRef.current+=1;setScore(scoreRef.current);setBooped(i);setAt(-1)}
 return <div className="break-game">
  <p className="break-game-status"><span>Boops: <strong>{score}</strong></span><span>{clock(left)}</span></p>
  <div className="peekaboo-grid">{Array.from({length:9},(_,i)=><button type="button" key={i} className={'peekaboo-bush'+(at===i?' is-up':'')+(booped===i?' is-booped':'')} aria-label={at===i?'Boop KONO!':'Bush'} onClick={()=>boop(i)}>{at===i&&<img src="/garden/kono/happy.webp" alt=""/>}{booped===i&&<span className="peekaboo-boop" aria-hidden="true">💗</span>}<span className="peekaboo-leaves" aria-hidden="true">🌿</span></button>)}</div>
 </div>
}
