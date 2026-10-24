import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {check,clashes,meowAuto,meowBest,ruledOut,saveMeowAuto,saveMeowBest,saveMeowLevel,solve,type Puzzle} from '../store/meowdoku'
import {gameSound} from '../konoSounds'
import type {GameHandle} from './GameScreen'

/** Meowdoku (store/meowdoku has the rules), played like the Meowdoku app: tap a square for ✕ (a note to
 * yourself; tap again to clear it), double-tap for a cat, tap a cat to take it away. A cat that isn't in the
 * answer costs one of your three hearts (and turns back into ✕); lose all three and the level is over.
 * Drag across squares to ✕ them all. Cats that break a rule shake red, and the row,
 * column or patch they share lights up. Auto ✕ shades every square a cat rules out; Undo takes back the
 * last change; Hint shows a cat that's wrong, or places one that's right. Solving sends a wave across the
 * board, saves your best time for the size, and moves you up a level (saved on this device); the boards get
 * bigger. In KONO blast's look: patches are the jewel colors on the navy board.
 * ■ End gives the puzzle up (the level stays); ↻ Restart clears the board. */
type Mark='x'|'cat'|null
const HEARTS=3,DOUBLE_MS=400
const clock=(s:number)=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0')
export default function Meowdoku({ref,level,puzzle,sound,onEnd}:{ref:Ref<GameHandle>;level:number;puzzle:Puzzle;sound:boolean;onEnd:(level:number,seconds:number,solved:boolean,extra?:{best?:boolean;hints?:number;lives?:number})=>void}){
 const n=puzzle.n
 const [marks,setMarks]=useState<Mark[]>(()=>Array(n*n).fill(null)),[history,setHistory]=useState<Mark[][]>([])
 const [seconds,setSeconds]=useState(0),[solved,setSolved]=useState(false),[auto,setAuto]=useState(meowAuto)
 const [hearts,setHearts]=useState(HEARTS),[miss,setMiss]=useState<number|null>(null)
 const [flash,setFlash]=useState<number|null>(null),[best]=useState(()=>meowBest(n))
 const started=useRef(0),drag=useRef<{from:number;moved:boolean;last:number}|null>(null),answer=useRef<number[]|null>(null),solvedRef=useRef(false),hintsUsed=useRef(0),lastTap=useRef<{at:number;time:number}|null>(null),heartsNow=useRef(HEARTS)
 useEffect(()=>{
  started.current=performance.now()
  const t=window.setInterval(()=>{if(!solvedRef.current)setSeconds(Math.floor((performance.now()-started.current)/1000))},500)
  return ()=>window.clearInterval(t)
 },[])
 const cats=new Set(marks.flatMap((m,i)=>m==='cat'?[i]:[])),{wrong}=check(puzzle,cats),hot=clashes(puzzle,cats),out=auto?ruledOut(puzzle,cats):new Set<number>()
 const commit=(next:Mark[],at:number|null)=>{
  setHistory(h=>[...h.slice(-80),marks]);setMarks(next)
  if(at===null||next[at]!=='cat')return
  // A cat that isn't in the answer costs a heart, and turns back into ✕.
  answer.current??=solve(puzzle)
  if(!answer.current.includes(at)){
   heartsNow.current--;setHearts(heartsNow.current);setMiss(at);gameSound('nope',sound)
   window.setTimeout(()=>{setMiss(m=>m===at?null:m);setMarks(m=>{const b=[...m];if(b[at]==='cat')b[at]='x';return b})},650)
   if(heartsNow.current<=0){solvedRef.current=true;setSolved(true);window.setTimeout(()=>onEnd(level,seconds,false,{lives:0}),1100)}
   return
  }
  const nowCats=new Set(next.flatMap((m,k)=>m==='cat'?[k]:[])),result=check(puzzle,nowCats)
  gameSound(result.wrong.has(at)?'nope':'score',sound,nowCats.size)
  if(result.solved){
   const secs=seconds
   solvedRef.current=true;setSolved(true);saveMeowLevel(level+1)
   const isBest=saveMeowBest(n,secs)
   window.setTimeout(()=>onEnd(level,secs,true,{best:isBest,hints:hintsUsed.current}),1700)
  }
 }
 // `time` is the event's timestamp: a second tap on the same square soon after is a double-tap.
 const tap=(i:number,time:number)=>{
  if(solved)return
  const double=lastTap.current?.at===i&&time-lastTap.current.time<DOUBLE_MS
  lastTap.current=double?null:{at:i,time}
  const next=[...marks];next[i]=marks[i]==='cat'?null:double?'cat':marks[i]==='x'?null:'x';commit(next,i)
 }
 const undo=()=>{if(solved||!history.length)return;setMarks(history[history.length-1]);setHistory(h=>h.slice(0,-1))}
 // Hint: a cat in the wrong place blinks first; otherwise one of the answer's cats is placed.
 const hint=()=>{
  if(solved)return
  answer.current??=solve(puzzle)
  const right=new Set(answer.current),bad=[...cats].find(i=>!right.has(i))
  hintsUsed.current++
  if(bad!==undefined){setFlash(bad);window.setTimeout(()=>setFlash(f=>f===bad?null:f),1600);gameSound('nope',sound);return}
  const at=answer.current.find(i=>marks[i]!=='cat')
  if(at===undefined)return
  const next=[...marks];next[at]='cat';setFlash(at);window.setTimeout(()=>setFlash(f=>f===at?null:f),1600);commit(next,at)
 }
 const toggleAuto=()=>{setAuto(a=>{saveMeowAuto(!a);return !a})}
 useImperativeHandle(ref,()=>({end:()=>{if(!solved)onEnd(level,seconds,false)}}),[solved,level,seconds,onEnd])
 // Pointer: a tap cycles the square; dragging from it across others marks the empty ones ✕.
 const cellAt=(x:number,y:number)=>{const el=document.elementFromPoint(x,y)?.closest<HTMLElement>('.meow-cell');return el?Number(el.dataset.i):-1}
 const down=(e:React.PointerEvent)=>{if(solved)return;const i=cellAt(e.clientX,e.clientY);if(i<0)return;drag.current={from:i,moved:false,last:i}}
 const move=(e:React.PointerEvent)=>{
  const d=drag.current;if(!d)return
  const i=cellAt(e.clientX,e.clientY);if(i<0||i===d.last)return
  d.last=i
  setMarks(m=>{
   if(!d.moved){d.moved=true;setHistory(h=>[...h.slice(-80),m])}
   const next=[...m];for(const k of [d.from,i])if(next[k]===null)next[k]='x';return next
  })
 }
 const up=(e:React.PointerEvent)=>{const d=drag.current;drag.current=null;if(d&&!d.moved)tap(d.from,e.timeStamp)}
 // Edges between patches are drawn thicker, so the patches read at a glance.
 const edge=(i:number,j:number|null)=>j===null||puzzle.regions[i]!==puzzle.regions[j]
 return <div className={'break-game meow'+(solved?(hearts>0?' is-solved':' is-failed'):'')}>
  <p className="break-game-status"><span>Level <strong>{level}</strong></span><span className="meow-hearts" aria-label={hearts+' heart'+(hearts===1?'':'s')+' left'}>{Array.from({length:HEARTS},(_,k)=><i key={k} className={k<hearts?'':'is-lost'} aria-hidden="true">❤️</i>)}</span><span>{n} × {n} · {clock(seconds)}{best!==null&&<small className="meow-best"> · best {clock(best)}</small>}</span></p>
  <div className="meow-board" role="grid" aria-label={'Meowdoku, '+n+' by '+n} style={{gridTemplateColumns:'repeat('+n+',1fr)'}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null}}>
   {marks.map((m,i)=>{const r=Math.floor(i/n),c=i%n,shaded=m===null&&out.has(i)
    return <div key={i} role="gridcell" tabIndex={0} data-i={i} data-r={r} data-c={c} style={{'--wave':(r+c)*70+'ms'} as React.CSSProperties}
     className={'meow-cell is-c'+(puzzle.regions[i]%7)+(m==='cat'&&wrong.has(i)?' is-wrong':'')+(hot.has(i)?' is-hot':'')+(shaded?' is-out':'')+(flash===i?' is-flash':'')+(miss===i?' is-miss':'')+(edge(i,c<n-1?i+1:null)?' edge-r':'')+(edge(i,r<n-1?i+n:null)?' edge-b':'')+(edge(i,c>0?i-1:null)?' edge-l':'')+(edge(i,r>0?i-n:null)?' edge-t':'')}
     aria-label={'Row '+(r+1)+', column '+(c+1)+(m==='cat'?', cat':m==='x'?', marked':shaded?', ruled out':'')}
     onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tap(i,e.timeStamp)}}}>
     {m==='cat'?<span className="meow-cat" aria-hidden="true">🐱</span>:m==='x'||shaded?<span className="meow-x" aria-hidden="true">✕</span>:null}
    </div>})}
  </div>
  <div className="meow-tools">
   <button type="button" className="meow-tool" onClick={undo} disabled={solved||!history.length}>↶ Undo</button>
   <button type="button" className="meow-tool" onClick={hint} disabled={solved}>💡 Hint</button>
   <button type="button" className={'meow-tool'+(auto?' is-on':'')} aria-pressed={auto} onClick={toggleAuto}>Auto ✕</button>
  </div>
  <p className="meow-help">{solved?(hearts>0?'Purr-fect! 🎉':'Out of hearts 💔'):'One 🐱 in every row, column and color. Cats can’t touch, even corner to corner. Tap for ✕, double-tap for a cat, tap a cat to take it away. Drag to ✕ a few at once. A wrong cat costs a ❤️.'}</p>
 </div>
}
