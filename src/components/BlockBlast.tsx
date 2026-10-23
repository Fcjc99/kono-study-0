import {useRef,useState} from 'react'
import {SIZE,anyFits,deal,fits,movePoints,place,praise,shapeSize,writeBlastSave,type BlastSave,type Grid,type Piece} from '../store/blockBlast'
import {playSfx} from '../konoSounds'

/** KONO blast, the arcade's block puzzle (the rules are in store/blockBlast), in the look of the classic
 * block games: a deep blue board, glossy jewel blocks, a burst and a cheer ("Great!", "Combo ×2") when lines
 * clear, and sounds for picking up and landing. A clear plays the app's task-complete chime (a little
 * higher with each combo) and KONO cheers you on below the board.
 *
 * Each clear pays coins at once (`onCoins`, store/konoCoins › blastCoins), and the game is saved on this
 * device after every move, so leaving and coming back carries on where it was; End game finishes it.
 *
 * Drag a piece onto the board, or tap a piece and then the square for its top-left corner. From the
 * keyboard: 1–3 pick a piece, the arrows move around the board and Enter puts it down. A dragged piece
 * grows to the board's size and floats a little above the finger so it stays in view; it follows the finger
 * without re-drawing the board, which only changes when the square it would land on does. The squares
 * and pieces aren't buttons, so the app's button look stays off them. */
const lift=64
const CHEERS=['Nice one! 🌟','You’re on a roll!','KONO is cheering for you!','Look at you go!','So satisfying! ✨','That’s the spot!','Brilliant move!','Keep it up, superstar!','Tidy, just like your planner! 📒','You make it look easy!']
const COMBO_CHEERS=['Combo! Keep it going! 🔥','You’re unstoppable!','KONO can’t believe it!','On fire! Don’t stop now!']
const BIG_CHEERS=['Lines everywhere! Amazing!','WOW! KONO is doing a happy dance! 💃','That was incredible!']
const pickOne=(list:string[])=>list[Math.floor(Math.random()*list.length)]
/** The same chime as finishing a task, a little higher with each combo. */
function chime(streak:number){try{const a=new Audio('/audio/completion.wav') as HTMLAudioElement&{preservesPitch?:boolean};a.preservesPitch=false;a.playbackRate=Math.min(1.6,1+streak*0.08);void a.play().catch(()=>undefined)}catch{/* no audio */}}
type Burst={key:number;cells:{j:number;color:number;delay:number;dx:number;dy:number}[]}
export default function BlockBlast({start,saved,best,sound,onCoins,onEnd}:{start:Piece[];saved:BlastSave|null;best:number|null;sound:boolean;onCoins?:(lines:number,streak:number)=>number|null;onEnd:(score:number)=>void}){
 const [grid,setGrid]=useState<Grid>(()=>saved?.grid??Array(SIZE*SIZE).fill(null))
 const [tray,setTray]=useState<(Piece|null)[]>(saved?.tray??start)
 const [score,setScore]=useState(saved?.score??0),[streak,setStreak]=useState(saved?.streak??0),[picked,setPicked]=useState<number|null>(null)
 // The piece being dragged, where the drag started and the board's square size (the floating piece's start).
 const [held,setHeld]=useState<{i:number;x:number;y:number;cell:number}|null>(null),dragging=held?.i??null
 const [aim,setAim]=useState<{r:number;c:number}|null>(null),[cursor,setCursor]=useState<{r:number;c:number}|null>(null)
 const [burst,setBurst]=useState<Burst|null>(null),[cheer,setCheer]=useState<{key:number;text:string;combo:number;coins:number}|null>(null)
 const [gain,setGain]=useState<{key:number;n:number;r:number;c:number}|null>(null),[over,setOver]=useState(false),[earned,setEarned]=useState(0),[konoSays,setKonoSays]=useState<{key:number;text:string}|null>(null)
 const boardRef=useRef<HTMLDivElement>(null),floatRef=useRef<HTMLSpanElement>(null),moves=useRef(0)
 const drag=useRef<{i:number;x:number;y:number;moved:boolean;cell:number;aim:string}|null>(null)
 const active=dragging??picked,piece=active===null?null:tray[active]
 // Where a dragged piece would land: its top-left square, from the floating piece's position.
 const aimFrom=(i:number,x:number,y:number)=>{
  const p=tray[i],box=boardRef.current?.getBoundingClientRect()
  if(!p||!box)return null
  const size=shapeSize(p.shape),cell=box.width/SIZE
  const a={r:Math.round((y-lift-size.rows*cell/2-box.top)/cell),c:Math.round((x-size.cols*cell/2-box.left)/cell)}
  return fits(grid,p.shape,a.r,a.c)?a:null
 }
 const putDown=(i:number,r:number,c:number)=>{
  const p=tray[i]
  if(!p||over)return false
  const done=place(grid,p,r,c)
  if(!done)return false
  const key=++moves.current,points=movePoints(p.shape.cells.length,done.lines,streak),total=score+points,nextStreak=done.lines?streak+1:0
  let left=tray.map((t,k)=>k===i?null:t)
  if(left.every(t=>!t))left=deal(Math.random)
  setGrid(done.grid);setTray(left);setScore(total);setPicked(null);setAim(null);setStreak(nextStreak)
  const size=shapeSize(p.shape)
  setGain({key,n:points,r:r+size.rows/2,c:c+size.cols/2})
  if(done.lines){
   // The cleared squares burst outward from where the piece landed, one after another.
   setBurst({key,cells:done.cleared.map((j,k)=>{const y=Math.floor(j/SIZE),x=j%SIZE,angle=Math.random()*Math.PI*2;return {j,color:done.colors[k],delay:(Math.abs(y-r)+Math.abs(x-c))*28,dx:Math.cos(angle)*40,dy:Math.sin(angle)*40-20}})})
   const coins=onCoins?.(done.lines,streak)??0
   if(coins)setEarned(n=>n+coins)
   setCheer({key,text:praise(done.lines),combo:streak,coins})
   if(sound)chime(streak)
   setKonoSays({key,text:pickOne(done.lines>=3?BIG_CHEERS:streak>0?COMBO_CHEERS:CHEERS)})
   window.setTimeout(()=>{setBurst(b=>b?.key===key?null:b);setCheer(t=>t?.key===key?null:t)},1300)
  }else playSfx('place',sound)
  const stuck=!left.some(t=>t&&anyFits(done.grid,t.shape))
  writeBlastSave(stuck?null:{grid:done.grid,tray:left,score:total,streak:nextStreak})
  if(stuck){setOver(true);window.setTimeout(()=>playSfx('over',sound),500);window.setTimeout(()=>onEnd(total),2000)}
  return true
 }
 const endGame=()=>{if(over)return;writeBlastSave(null);setOver(true);onEnd(score)}
 const pick=(i:number)=>{if(over||!tray[i])return;playSfx('tick',sound);setPicked(k=>k===i?null:i)}
 // The floating piece follows the finger by itself (no re-render); the board only updates when the aim moves.
 const follow=(x:number,y:number)=>{const d=drag.current,el=floatRef.current;if(!d||!el)return;const p=tray[d.i];if(!p)return;const size=shapeSize(p.shape);el.style.transform=`translate3d(${x-size.cols*d.cell/2}px,${y-lift-size.rows*d.cell/2}px,0)`}
 const down=(e:React.PointerEvent<HTMLDivElement>,i:number)=>{
  if(over||!tray[i])return
  e.currentTarget.setPointerCapture(e.pointerId)
  drag.current={i,x:e.clientX,y:e.clientY,moved:false,cell:(boardRef.current?.getBoundingClientRect().width??320)/SIZE,aim:''}
 }
 const moveDrag=(e:React.PointerEvent<HTMLDivElement>,i:number)=>{
  const d=drag.current
  if(!d||d.i!==i)return
  if(!d.moved){if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<5)return;d.moved=true;setPicked(null);setHeld({i,x:e.clientX,y:e.clientY,cell:d.cell});playSfx('tick',sound)}
  follow(e.clientX,e.clientY)
  const a=aimFrom(i,e.clientX,e.clientY),key=a?a.r+','+a.c:''
  if(key!==d.aim){d.aim=key;setAim(a)}
 }
 const upDrag=(e:React.PointerEvent<HTMLDivElement>,i:number)=>{
  const d=drag.current
  if(!d||d.i!==i)return
  drag.current=null;setHeld(null)
  if(!d.moved){pick(i);return}
  const a=aimFrom(i,e.clientX,e.clientY)
  if(!(a&&putDown(i,a.r,a.c)))setAim(null)
 }
 // The squares lit up for the piece being aimed: where it lands and the lines it would clear.
 const target=dragging!==null?aim:aim??(picked!==null?cursor:null)
 const shown=piece&&target?place(grid,piece,target.r,target.c):null
 const landing=new Set(piece&&target&&shown?piece.shape.cells.map(([dr,dc])=>(target.r+dr)*SIZE+target.c+dc):[])
 const clearing=new Set(shown?.cleared??[])
 const onKey=(e:React.KeyboardEvent)=>{
  const move:Record<string,[number,number]>={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}
  if(move[e.key]){e.preventDefault();const [dr,dc]=move[e.key],at=cursor??{r:0,c:0};setCursor({r:Math.min(SIZE-1,Math.max(0,at.r+dr)),c:Math.min(SIZE-1,Math.max(0,at.c+dc))})}
  else if(/^[123]$/.test(e.key))pick(Number(e.key)-1)
  else if(e.key==='Enter'&&picked!==null&&cursor){e.preventDefault();putDown(picked,cursor.r,cursor.c)}
 }
 return <div className={'break-game blast'+(over?' is-over':'')}>
  <div className="blast-top">
   <span className="blast-best" aria-label={best===null?'No best yet':'Best '+best}>👑 {Math.max(best??0,score)}</span>
   {onCoins&&<span className="blast-coins" aria-label={'Coins this game: '+earned}>🪙 +{earned}</span>}
   <strong key={score} className="blast-score" aria-label={'Score '+score}>{score}</strong>
  </div>
  <div className="blast-frame">
   <div ref={boardRef} className="blast-board" role="grid" tabIndex={0} aria-label="KONO blast board" onKeyDown={onKey} onPointerLeave={()=>{if(dragging===null)setAim(null)}}>
    {grid.map((color,j)=>{const r=Math.floor(j/SIZE),c=j%SIZE,lit=landing.has(j)||clearing.has(j)
     return <div key={j} role="gridcell" className={'blast-cell'+(color!==null?' is-block is-c'+color:'')+(lit&&piece?' is-lit is-c'+piece.color:'')+(landing.has(j)?' is-landing':'')+(cursor?.r===r&&cursor.c===c?' is-cursor':'')} data-r={r} data-c={c}
      aria-label={'Row '+(r+1)+', column '+(c+1)+(color!==null?', filled':'')}
      onPointerEnter={()=>{if(picked!==null&&dragging===null)setAim(fits(grid,tray[picked]!.shape,r,c)?{r,c}:null)}}
      onClick={()=>{if(picked!==null)putDown(picked,r,c)}}/>})}
    {burst&&<div key={burst.key} className="blast-burst" aria-hidden="true">{burst.cells.map(b=><span key={b.j} className={'is-c'+b.color} style={{left:(b.j%SIZE)*100/SIZE+'%',top:Math.floor(b.j/SIZE)*100/SIZE+'%',animationDelay:b.delay+'ms',['--dx' as string]:b.dx+'px',['--dy' as string]:b.dy+'px'}}/>)}</div>}
    {gain&&<span key={gain.key} className="blast-gain" style={{left:gain.c*100/SIZE+'%',top:gain.r*100/SIZE+'%'}} aria-hidden="true">+{gain.n}</span>}
    {cheer&&<p key={cheer.key} className="blast-cheer" role="status">{cheer.combo>0&&<small>Combo ×{cheer.combo+1}</small>}<span>{cheer.text}</span>{cheer.coins>0&&<em>+{cheer.coins} 🪙</em>}</p>}
    {over&&<p className="blast-over" role="status">No more space!</p>}
   </div>
  </div>
  <p className="blast-kono" aria-live="polite">{konoSays&&<span key={konoSays.key}><img src="/garden/kono/excited.webp" alt=""/><b>{konoSays.text}</b></span>}</p>
  <div className="blast-tray" aria-label="Pieces" role="group">
   {tray.map((p,i)=>{if(!p)return <span key={i} className="blast-slot"/>
    const size=shapeSize(p.shape),fitsSomewhere=anyFits(grid,p.shape)
    return <div key={i} role="button" tabIndex={0} className={'blast-slot blast-piece'+(picked===i?' is-picked':'')+(dragging===i?' is-dragging':'')+(fitsSomewhere?'':' is-stuck')} aria-label={'Piece '+(i+1)+': '+p.shape.cells.length+' square'+(p.shape.cells.length===1?'':'s')} aria-pressed={picked===i}
     onPointerDown={e=>down(e,i)} onPointerMove={e=>moveDrag(e,i)} onPointerUp={e=>upDrag(e,i)}
     onPointerCancel={()=>{drag.current=null;setHeld(null);setAim(null)}}
     onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(i)}}}>
     <span className="blast-mini" style={{gridTemplateColumns:'repeat('+size.cols+',1fr)',gridTemplateRows:'repeat('+size.rows+',1fr)',width:size.cols*20,height:size.rows*20}} aria-hidden="true">
      {p.shape.cells.map(([r,c])=><span key={r+','+c} className={'is-c'+p.color} style={{gridRow:r+1,gridColumn:c+1}}/>)}
     </span>
    </div>})}
  </div>
  {held&&tray[held.i]&&<Floating ref={floatRef} piece={tray[held.i]!} x={held.x} y={held.y} cell={held.cell}/>}
  <div className="blast-foot"><p className="blast-help">{picked!==null?'Now tap the square for the piece’s top-left corner.':'Drag a piece onto the board, or tap it and then a square.'}</p>{!over&&<button type="button" className="blast-end" onClick={endGame}>End game</button>}</div>
 </div>
}

/** The piece following the finger, at the board's size: drawn where the drag started, then moved by its ref
 * (see follow()). */
function Floating({ref,piece,x,y,cell}:{ref:React.Ref<HTMLSpanElement>;piece:Piece;x:number;y:number;cell:number}){
 const size=shapeSize(piece.shape)
 return <span ref={ref} className="blast-float" style={{transform:`translate3d(${x-size.cols*cell/2}px,${y-lift-size.rows*cell/2}px,0)`,gridTemplateColumns:'repeat('+size.cols+','+cell+'px)',gridTemplateRows:'repeat('+size.rows+','+cell+'px)'}} aria-hidden="true">
  {piece.shape.cells.map(([r,c])=><span key={r+','+c} className={'is-c'+piece.color} style={{gridRow:r+1,gridColumn:c+1}}/>)}
 </span>
}
