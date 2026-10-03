import './break-games.css'
import {useEffect,useRef,useState} from 'react'
import {FINDS,findSrc} from '../store/konoFinds'

/** Break-time games with KONO, offered when a focus session finishes ("Take a short break"). Three quick
 * ones: Snack catch (move KONO to catch falling treats, 30 seconds), Memory match (pairs of KONO's
 * finds) and Peekaboo (tap KONO when it pops out of a bush, 30 seconds). The break itself lasts five
 * minutes; when it's over the games stop and KONO says it's time for the next session. Best scores are
 * kept on this device only. Loaded only when opened, so it never adds to the app's startup. */
type Game='catch'|'memory'|'peekaboo'
export const BREAK_MINUTES=5
const ROUND_MS=30_000
const GAMES:{id:Game;emoji:string;name:string;how:string;best:(n:number)=>string}[]=[
 {id:'catch',emoji:'🍓',name:'Snack catch',how:'Move KONO to catch the falling snacks.',best:n=>'Best: '+n+' snacks'},
 {id:'memory',emoji:'🃏',name:'Memory match',how:'Find the pairs of KONO’s treasures.',best:n=>'Best: '+n+' moves'},
 {id:'peekaboo',emoji:'🌿',name:'Peekaboo',how:'Tap KONO when it peeks out of a bush.',best:n=>'Best: '+n+' boops'},
]
const bestKey=(g:Game)=>'kono-break-best:'+g
function readBest(g:Game):number|null{try{const v=localStorage.getItem(bestKey(g));return v===null?null:Number(v)}catch{return null}}
/** Saves a score if it's a new best (fewer moves is better for Memory match); returns whether it was. */
function saveBest(g:Game,score:number):boolean{
 const old=readBest(g),better=old===null||!Number.isFinite(old)||(g==='memory'?score<old:score>old)
 if(better)try{localStorage.setItem(bestKey(g),String(score))}catch{/* storage unavailable */}
 return better
}
const clock=(ms:number)=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}

const shuffled=<T,>(items:T[])=>{const deck=[...items];for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}return deck}

/** `startedAt` is when the break games were opened (the break runs BREAK_MINUTES from then). */
export default function BreakGames({startedAt,onClose}:{startedAt:number;onClose:()=>void}){
 const [game,setGame]=useState<Game|null>(null),[deck,setDeck]=useState<string[]>([])
 const [now,setNow]=useState(startedAt)
 const [result,setResult]=useState<string|null>(null)
 useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(t)},[])
 const left=startedAt+BREAK_MINUTES*60_000-now,over=left<=0
 const finish=(g:Game,score:number,line:string)=>{const best=saveBest(g,score);setResult(line+(best?' New best! 🎉':''));setGame(null)}
 return <section className="break-games" aria-label="Break games with KONO">
  <header><strong>🎮 Break time with KONO</strong><span role="timer" aria-label="Break time left">{over?'Break’s over':'Break: '+clock(left)}</span><button type="button" onClick={onClose}>Close</button></header>
  {over?<p className="break-over" role="status">That was a nice reset! KONO’s ready for the next session when you are. 📚</p>
  :game==='catch'?<SnackCatch onEnd={n=>finish('catch',n,'KONO caught '+n+' snack'+(n===1?'':'s')+'! 😋')}/>
  :game==='memory'?<MemoryMatch cards={deck} onEnd={n=>finish('memory',n,'All pairs found in '+n+' moves! 🧠')}/>
  :game==='peekaboo'?<Peekaboo onEnd={n=>finish('peekaboo',n,'You booped KONO '+n+' time'+(n===1?'':'s')+'! 🌿')}/>
  :<>{result&&<p className="break-result" role="status">{result}</p>}<div className="break-game-list">{GAMES.map(g=>{const best=readBest(g.id);return <button type="button" key={g.id} onClick={()=>{setResult(null);if(g.id==='memory')setDeck(shuffled([...MEMORY_IDS,...MEMORY_IDS]));setGame(g.id)}}><span aria-hidden="true">{g.emoji}</span><strong>{g.name}</strong><small>{g.how}</small>{best!==null&&<small className="break-best">{g.best(best)}</small>}</button>})}</div></>}
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

/** Memory match: 12 cards, 6 pairs of KONO's finds. */
const MEMORY_IDS=['acorn','shell','clover','feather','star','mushroom']
function MemoryMatch({cards,onEnd}:{cards:string[];onEnd:(moves:number)=>void}){
 const [open,setOpen]=useState<number[]>([]),[matched,setMatched]=useState<Set<string>>(new Set()),[moves,setMoves]=useState(0)
 const flip=(i:number)=>{
  if(open.length>=2||open.includes(i)||matched.has(cards[i]))return
  const next=[...open,i];setOpen(next)
  if(next.length<2)return
  const m=moves+1;setMoves(m)
  if(cards[next[0]]===cards[next[1]]){
   const done=new Set(matched).add(cards[i]);setMatched(done);setOpen([])
   if(done.size===MEMORY_IDS.length)window.setTimeout(()=>onEnd(m),600)
  }else window.setTimeout(()=>setOpen([]),800)
 }
 const name=(id:string)=>FINDS.find(f=>f.id===id)?.name??id
 return <div className="break-game">
  <p className="break-game-status"><span>Moves: <strong>{moves}</strong></span><span>Pairs: {matched.size}/{MEMORY_IDS.length}</span></p>
  <div className="memory-grid">{cards.map((id,i)=>{const shown=open.includes(i)||matched.has(id);return <button type="button" key={i} className={'memory-card'+(shown?' is-open':'')+(matched.has(id)?' is-matched':'')} aria-label={shown?name(id):'Card '+(i+1)} onClick={()=>flip(i)}>{shown?<img src={findSrc(id)} alt=""/>:<span aria-hidden="true">?</span>}</button>})}</div>
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
