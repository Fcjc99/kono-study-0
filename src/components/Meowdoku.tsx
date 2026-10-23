import {useEffect,useRef,useState} from 'react'
import {check,saveMeowLevel,type Puzzle} from '../store/meowdoku'
import {playSfx} from '../konoSounds'

/** Meowdoku (store/meowdoku has the rules): tap a square for ✕ (a note to yourself), again for a cat, and
 * again to clear it. Cats that break a rule shake red. Solving moves you up a level (saved on this device),
 * and the boards get bigger. In KONO blast's look: patches are the jewel colors on the navy board. */
const clock=(s:number)=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0')
export default function Meowdoku({level,puzzle,sound,onEnd}:{level:number;puzzle:Puzzle;sound:boolean;onEnd:(level:number,seconds:number)=>void}){
 const [marks,setMarks]=useState<('x'|'cat'|null)[]>(()=>Array(puzzle.n*puzzle.n).fill(null))
 const [seconds,setSeconds]=useState(0),[solved,setSolved]=useState(false)
 const started=useRef(0)
 useEffect(()=>{
  started.current=performance.now()
  const t=window.setInterval(()=>setSeconds(Math.floor((performance.now()-started.current)/1000)),500)
  return ()=>window.clearInterval(t)
 },[])
 const n=puzzle.n,cats=new Set(marks.flatMap((m,i)=>m==='cat'?[i]:[])),{wrong}=check(puzzle,cats)
 const tap=(i:number)=>{
  if(solved)return
  const next=[...marks];next[i]=marks[i]===null?'x':marks[i]==='x'?'cat':null;setMarks(next)
  const nowCats=new Set(next.flatMap((m,k)=>m==='cat'?[k]:[]))
  if(next[i]==='cat'){
   const result=check(puzzle,nowCats)
   playSfx(result.wrong.has(i)?'tick':'pop',sound)
   if(result.solved){
    setSolved(true);saveMeowLevel(level+1)
    playSfx('win',sound);window.setTimeout(()=>onEnd(level,seconds),1300)
   }
  }
 }
 // Edges between patches are drawn thicker, so the patches read at a glance.
 const edge=(i:number,j:number|null)=>j===null||puzzle.regions[i]!==puzzle.regions[j]
 return <div className={'break-game meow'+(solved?' is-solved':'')}>
  <p className="break-game-status"><span>Level <strong>{level}</strong></span><span>{n} × {n} · {clock(seconds)}</span></p>
  <div className="meow-board" role="grid" aria-label={'Meowdoku, '+n+' by '+n} style={{gridTemplateColumns:'repeat('+n+',1fr)'}}>
   {marks.map((m,i)=>{const r=Math.floor(i/n),c=i%n
    return <div key={i} role="gridcell" tabIndex={0} data-r={r} data-c={c} className={'meow-cell is-c'+(puzzle.regions[i]%7)+(m==='cat'&&wrong.has(i)?' is-wrong':'')+(edge(i,c<n-1?i+1:null)?' edge-r':'')+(edge(i,r<n-1?i+n:null)?' edge-b':'')+(edge(i,c>0?i-1:null)?' edge-l':'')+(edge(i,r>0?i-n:null)?' edge-t':'')}
     aria-label={'Row '+(r+1)+', column '+(c+1)+(m==='cat'?', cat':m==='x'?', marked':'')}
     onClick={()=>tap(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tap(i)}}}>
     {m==='cat'?<span className="meow-cat" aria-hidden="true">🐱</span>:m==='x'?<span className="meow-x" aria-hidden="true">✕</span>:null}
    </div>})}
  </div>
  <p className="meow-help">{solved?'Purr-fect! 🎉':'One 🐱 in every row, column and color. Cats can’t touch, even corner to corner. Tap once for ✕, twice for a cat.'}</p>
  {!solved&&<p className="land-game-done"><button type="button" onClick={()=>setMarks(Array(n*n).fill(null))}>Clear board</button></p>}
 </div>
}
