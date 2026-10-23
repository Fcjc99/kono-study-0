import {useRef,useState} from 'react'
import {SIZE,anyFits,deal,fits,movePoints,place,praise,shapeSize,type Grid,type Piece} from '../store/blockBlast'
import {playSfx} from '../konoSounds'

/** KONO blast, the arcade's block puzzle (the rules are in store/blockBlast), in the look of the classic
 * block games: a deep blue board, glossy jewel blocks, a burst and a cheer ("Great!", "Combo ×2") when lines
 * clear, and a sound for picking up, landing and clearing (higher with each combo).
 *
 * Drag a piece onto the board, or tap a piece and then the square for its top-left corner. From the
 * keyboard: 1–3 pick a piece, the arrows move around the board and Enter puts it down. While dragging, the
 * piece floats a little above the finger so it stays in view, and the squares it would land on (and the
 * lines it would clear) light up in its color. The squares and pieces aren't buttons, so the app's button
 * look stays off them. */
const lift=56
type Burst={key:number;cells:{j:number;color:number;delay:number;dx:number;dy:number}[]}
export default function BlockBlast({start,best,sound,onEnd}:{start:Piece[];best:number|null;sound:boolean;onEnd:(score:number)=>void}){
 const [grid,setGrid]=useState<Grid>(()=>Array(SIZE*SIZE).fill(null))
 const [tray,setTray]=useState<(Piece|null)[]>(start)
 const [score,setScore]=useState(0),[streak,setStreak]=useState(0),[picked,setPicked]=useState<number|null>(null)
 const [drag,setDrag]=useState<{i:number;x:number;y:number;moved:boolean;cell:number}|null>(null)
 const [aim,setAim]=useState<{r:number;c:number}|null>(null),[cursor,setCursor]=useState<{r:number;c:number}|null>(null)
 const [burst,setBurst]=useState<Burst|null>(null),[cheer,setCheer]=useState<{key:number;text:string;combo:number}|null>(null)
 const [gain,setGain]=useState<{key:number;n:number;r:number;c:number}|null>(null),[over,setOver]=useState(false)
 const boardRef=useRef<HTMLDivElement>(null),moves=useRef(0)
 const active=drag?drag.i:picked,piece=active===null?null:tray[active]
 // Where the dragged piece would land: its top-left square, from the floating piece's position.
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
  const key=++moves.current,points=movePoints(p.shape.cells.length,done.lines,streak),total=score+points
  let left=tray.map((t,k)=>k===i?null:t)
  if(left.every(t=>!t))left=deal(Math.random)
  setGrid(done.grid);setTray(left);setScore(total);setPicked(null);setAim(null)
  setStreak(done.lines?streak+1:0)
  const size=shapeSize(p.shape)
  setGain({key,n:points,r:r+size.rows/2,c:c+size.cols/2})
  if(done.lines){
   // The cleared squares burst outward from where the piece landed, one after another.
   setBurst({key,cells:done.cleared.map((j,k)=>{const y=Math.floor(j/SIZE),x=j%SIZE,angle=Math.random()*Math.PI*2;return {j,color:done.colors[k],delay:(Math.abs(y-r)+Math.abs(x-c))*28,dx:Math.cos(angle)*40,dy:Math.sin(angle)*40-20}})})
   setCheer({key,text:praise(done.lines),combo:streak})
   playSfx('clear',sound,1+Math.min(streak,8)*0.07)
   window.setTimeout(()=>{setBurst(b=>b?.key===key?null:b);setCheer(t=>t?.key===key?null:t)},1300)
  }else playSfx('place',sound)
  if(!left.some(t=>t&&anyFits(done.grid,t.shape))){setOver(true);window.setTimeout(()=>playSfx('over',sound),500);window.setTimeout(()=>onEnd(total),2000)}
  return true
 }
 const pick=(i:number)=>{if(over||!tray[i])return;playSfx('tick',sound);setPicked(k=>k===i?null:i)}
 // The squares lit up for the piece being aimed: where it lands and the lines it would clear.
 const target=drag?aim:aim??(picked!==null?cursor:null)
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
  <div className="blast-top"><span className="blast-best" aria-label={best===null?'No best yet':'Best '+best}>👑 {Math.max(best??0,score)}</span><strong key={score} className="blast-score" aria-label={'Score '+score}>{score}</strong></div>
  <div className="blast-frame">
   <div ref={boardRef} className="blast-board" role="grid" tabIndex={0} aria-label="KONO blast board" onKeyDown={onKey} onPointerLeave={()=>{if(!drag)setAim(null)}}>
    {grid.map((color,j)=>{const r=Math.floor(j/SIZE),c=j%SIZE,lit=landing.has(j)||clearing.has(j)
     return <div key={j} role="gridcell" className={'blast-cell'+(color!==null?' is-block is-c'+color:'')+(lit&&piece?' is-lit is-c'+piece.color:'')+(landing.has(j)?' is-landing':'')+(cursor?.r===r&&cursor.c===c?' is-cursor':'')} data-r={r} data-c={c}
      aria-label={'Row '+(r+1)+', column '+(c+1)+(color!==null?', filled':'')}
      onPointerEnter={()=>{if(picked!==null&&!drag)setAim(fits(grid,tray[picked]!.shape,r,c)?{r,c}:null)}}
      onClick={()=>{if(picked!==null)putDown(picked,r,c)}}/>})}
    {burst&&<div key={burst.key} className="blast-burst" aria-hidden="true">{burst.cells.map(b=><span key={b.j} className={'is-c'+b.color} style={{left:(b.j%SIZE)*100/SIZE+'%',top:Math.floor(b.j/SIZE)*100/SIZE+'%',animationDelay:b.delay+'ms',['--dx' as string]:b.dx+'px',['--dy' as string]:b.dy+'px'}}/>)}</div>}
    {gain&&<span key={gain.key} className="blast-gain" style={{left:gain.c*100/SIZE+'%',top:gain.r*100/SIZE+'%'}} aria-hidden="true">+{gain.n}</span>}
    {cheer&&<p key={cheer.key} className="blast-cheer" role="status">{cheer.combo>0&&<small>Combo ×{cheer.combo+1}</small>}<span>{cheer.text}</span></p>}
    {over&&<p className="blast-over" role="status">No more space!</p>}
   </div>
  </div>
  <div className="blast-tray" aria-label="Pieces" role="group">
   {tray.map((p,i)=>{if(!p)return <span key={i} className="blast-slot"/>
    const size=shapeSize(p.shape),fitsSomewhere=anyFits(grid,p.shape)
    return <div key={i} role="button" tabIndex={0} className={'blast-slot blast-piece'+(picked===i?' is-picked':'')+(drag?.i===i&&drag.moved?' is-dragging':'')+(fitsSomewhere?'':' is-stuck')} aria-label={'Piece '+(i+1)+': '+p.shape.cells.length+' square'+(p.shape.cells.length===1?'':'s')} aria-pressed={picked===i}
     onPointerDown={e=>{if(over)return;e.currentTarget.setPointerCapture(e.pointerId);setDrag({i,x:e.clientX,y:e.clientY,moved:false,cell:(boardRef.current?.getBoundingClientRect().width??320)/SIZE})}}
     onPointerMove={e=>{if(drag?.i!==i)return;const moved=drag.moved||Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;if(moved&&!drag.moved)playSfx('tick',sound);setDrag({...drag,x:e.clientX,y:e.clientY,moved});if(moved)setAim(aimFrom(i,e.clientX,e.clientY))}}
     onPointerUp={e=>{if(drag?.i!==i)return;const a=drag.moved?aimFrom(i,e.clientX,e.clientY):null;setDrag(null);if(drag.moved){if(!(a&&putDown(i,a.r,a.c)))setAim(null)}else pick(i)}}
     onPointerCancel={()=>{setDrag(null);setAim(null)}}
     onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(i)}}}>
     <span className="blast-mini" style={{gridTemplateColumns:'repeat('+size.cols+',1fr)',gridTemplateRows:'repeat('+size.rows+',1fr)',width:size.cols*20,height:size.rows*20}} aria-hidden="true">
      {p.shape.cells.map(([r,c])=><span key={r+','+c} className={'is-c'+p.color} style={{gridRow:r+1,gridColumn:c+1}}/>)}
     </span>
    </div>})}
  </div>
  {drag?.moved&&tray[drag.i]&&<Floating piece={tray[drag.i]!} x={drag.x} y={drag.y} cell={drag.cell}/>}
  <p className="blast-help">{picked!==null?'Now tap the square for the piece’s top-left corner.':'Drag a piece onto the board, or tap it and then a square.'}</p>
 </div>
}

/** The piece following the finger, at the board's size, a little above it. */
function Floating({piece,x,y,cell}:{piece:Piece;x:number;y:number;cell:number}){
 const size=shapeSize(piece.shape)
 return <span className="blast-float" style={{left:x-size.cols*cell/2,top:y-lift-size.rows*cell/2,gridTemplateColumns:'repeat('+size.cols+','+cell+'px)',gridTemplateRows:'repeat('+size.rows+','+cell+'px)'}} aria-hidden="true">
  {piece.shape.cells.map(([r,c])=><span key={r+','+c} className={'is-c'+piece.color} style={{gridRow:r+1,gridColumn:c+1}}/>)}
 </span>
}
