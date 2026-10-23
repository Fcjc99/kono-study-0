import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {W,candyLevel,play,type Board,type Maker,type Piece} from '../store/match3'
import {gameSound} from '../konoSounds'
import type {GameHandle} from './GameScreen'

/** Gem blitz and Candy crush (the rules are in store/match3), in KONO blast's look: swipe a piece toward a
 * neighbor (or tap one, then the other) to swap them. Pieces slide, cleared ones burst, new ones drop in
 * from the top, and cascades get a cheer.
 * - Gem blitz: one minute; as many points as you can.
 * - Candy crush: levels; reach the target score in the moves you have (store/match3 › candyLevel). */
const GEMS=['◆','●','▲','■','★','♥'],CANDIES=['🍬','🍭','🍩','🧁','🍪','🍫']
const BLITZ_MS=60_000
const CASCADE_CHEERS=['Sweet!','Tasty!','Delicious!','Divine!','Sugar crush!']
const GEM_CHEERS=['Good!','Excellent!','Awesome!','Spectacular!','Blazing!']
type Burst={key:number;cells:{at:number;kind:number}[]}
export default function Match3({ref,mode,level,start,sound,onEnd}:{ref:Ref<GameHandle>;mode:'gems'|'candy';level:number;start:{maker:Maker;board:Board};sound:boolean;onEnd:(score:number,won:boolean)=>void}){
 const goal=candyLevel(level)
 const [board,setBoard]=useState<Board>(start.board),[born,setBorn]=useState<Set<number>>(new Set())
 const [sel,setSel]=useState<number|null>(null),[shake,setShake]=useState<number[]>([])
 const [score,setScore]=useState(0),[moves,setMoves]=useState(goal.moves),[left,setLeft]=useState(BLITZ_MS)
 const [burst,setBurst]=useState<Burst|null>(null),[cheer,setCheer]=useState<{key:number;text:string}|null>(null),[done,setDone]=useState<string|null>(null)
 const boardRef=useRef<HTMLDivElement>(null),busy=useRef(false),scoreRef=useRef(0),ended=useRef(false),keys=useRef(0),boardNow=useRef(start.board),movesLeft=useRef(goal.moves)
 const press=useRef<{at:number;x:number;y:number;moved:boolean}|null>(null)
 const onEndRef=useRef(onEnd)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 const finish=(won:boolean,text:string)=>{if(ended.current)return;ended.current=true;setDone(text);window.setTimeout(()=>onEndRef.current(scoreRef.current,won),1400)}
 // Gem blitz's minute (a move under way still finishes before time's up counts).
 useEffect(()=>{
  if(mode!=='gems')return
  const startAt=performance.now()
  const t=window.setInterval(()=>{const rest=BLITZ_MS-(performance.now()-startAt);setLeft(Math.max(0,rest));if(rest<=0&&!busy.current){window.clearInterval(t);finish(true,'Time’s up!')}},200)
  return ()=>window.clearInterval(t)
 },[mode])
 // ■ End: finish now (Candy crush counts it as won only if the target's already reached).
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(scoreRef.current,mode==='gems'||scoreRef.current>=goal.target)}}),[mode,goal.target])
 const show=(next:Board)=>{const had=new Set(boardNow.current.map(p=>p?.id));setBorn(new Set(next.flatMap(p=>p&&!had.has(p.id)?[p.id]:[])));boardNow.current=next;setBoard(next)}
 const attempt=(a:number,c:number)=>{
  if(busy.current||ended.current)return
  const frames=play(boardNow.current,a,c,start.maker)
  if(!frames){setShake([a,c]);gameSound('nope',sound);window.setTimeout(()=>setShake([]),380);return}
  busy.current=true;setSel(null)
  const swapped=[...boardNow.current];[swapped[a],swapped[c]]=[swapped[c],swapped[a]];show(swapped)
  let at=200,top=0
  for(const f of frames){
   window.setTimeout(()=>{
    show(f.board)
    if(f.cleared.length){
     scoreRef.current+=f.points;setScore(scoreRef.current);top=Math.max(top,f.cascade)
     const key=++keys.current;setBurst({key,cells:f.cleared});window.setTimeout(()=>setBurst(b=>b?.key===key?null:b),600)
     gameSound('score',sound,f.cascade-1)
     if(f.cascade>=2){setCheer({key,text:(mode==='candy'?CASCADE_CHEERS:GEM_CHEERS)[Math.min(f.cascade-2,4)]});window.setTimeout(()=>setCheer(t=>t?.key===key?null:t),1100)}
    }
   },at)
   at+=f.cleared.length?240:200
  }
  window.setTimeout(()=>{
   busy.current=false
   if(top>=3)gameSound('big',sound,top-3)
   if(mode==='candy'){
    movesLeft.current-=1;setMoves(movesLeft.current)
    if(scoreRef.current>=goal.target)finish(true,'Level '+level+' complete!');else if(movesLeft.current<=0)finish(false,'Out of moves')
   }
  },at)
 }
 const indexAt=(x:number,y:number)=>{const r=boardRef.current?.getBoundingClientRect();if(!r)return -1;const c=Math.floor((x-r.left)/(r.width/W)),row=Math.floor((y-r.top)/(r.height/W));return c<0||row<0||c>=W||row>=W?-1:row*W+c}
 const down=(e:React.PointerEvent<HTMLDivElement>)=>{const at=indexAt(e.clientX,e.clientY);if(at<0)return;e.currentTarget.setPointerCapture(e.pointerId);press.current={at,x:e.clientX,y:e.clientY,moved:false}}
 const move=(e:React.PointerEvent<HTMLDivElement>)=>{
  const p=press.current;if(!p||p.moved)return
  const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.max(Math.abs(dx),Math.abs(dy))<14)return
  p.moved=true
  const r=Math.floor(p.at/W),c=p.at%W,to=Math.abs(dx)>Math.abs(dy)?(dx>0?(c<W-1?p.at+1:-1):(c>0?p.at-1:-1)):(dy>0?(r<W-1?p.at+W:-1):(r>0?p.at-W:-1))
  if(to>=0)attempt(p.at,to)
 }
 const up=()=>{
  const p=press.current;press.current=null
  if(!p||p.moved)return
  const s=sel
  if(s===null){setSel(p.at);return}
  if(s===p.at){setSel(null);return}
  const near=Math.abs(s-p.at)===W||(Math.abs(s-p.at)===1&&Math.floor(s/W)===Math.floor(p.at/W))
  if(near)attempt(s,p.at);else setSel(p.at)
 }
 const look=(p:Piece)=>mode==='candy'?CANDIES[p.kind]:GEMS[p.kind]
 const pos=(i:number)=>({left:(i%W)*100/W+'%',top:Math.floor(i/W)*100/W+'%'})
 const clock=(ms:number)=>Math.ceil(ms/1000)
 return <div className={'break-game match3 is-'+mode}>
  <div className="blast-top">
   <span className="blast-best">{mode==='candy'?'Level '+level:'⏱ '+clock(left)+'s'}</span>
   {mode==='candy'&&<span className="blast-coins">{moves} move{moves===1?'':'s'}</span>}
   <strong key={score} className="blast-score" aria-label={'Score '+score}>{score}</strong>
  </div>
  {mode==='candy'&&<div className="match3-goal" role="progressbar" aria-label={'Target '+goal.target} aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={Math.min(score,goal.target)}><span style={{width:Math.min(100,score/goal.target*100)+'%'}}/><b>{Math.min(score,goal.target)} / {goal.target}</b></div>}
  {mode==='gems'&&<div className="match3-goal is-time" aria-hidden="true"><span style={{width:left/BLITZ_MS*100+'%'}}/></div>}
  <div className="blast-frame">
   <div ref={boardRef} className="match3-board" role="grid" aria-label={mode==='candy'?'Candy board':'Gem board'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{press.current=null}}>
    {board.map((p,i)=>p&&<div key={p.id} role="gridcell" data-i={i} data-kind={p.kind} aria-label={'Row '+(Math.floor(i/W)+1)+', column '+(i%W+1)+(p.special?', special':'')} className={'match3-piece is-c'+p.kind+(p.special?' is-'+p.special:'')+(sel===i?' is-picked':'')+(shake.includes(i)?' is-shake':'')+(born.has(p.id)?' is-new':'')} style={pos(i)}><span aria-hidden="true">{p.special==='color'?'🌈':look(p)}</span></div>)}
    {burst&&<div key={burst.key} className="match3-burst" aria-hidden="true">{burst.cells.map(b=><span key={b.at} className={'is-c'+b.kind} style={pos(b.at)}/>)}</div>}
    {cheer&&<p key={cheer.key} className="blast-cheer" role="status"><span>{cheer.text}</span></p>}
    {done&&<p className="blast-over" role="status">{done}</p>}
   </div>
  </div>
  <p className="blast-help">{mode==='candy'?'Swipe candies to match 3. Match 4 for a striped candy, an L or T for a bomb, 5 for a rainbow.':'Swipe gems to match 3 or more, as many as you can in a minute.'}</p>
 </div>
}
