import {useEffect,useId,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {W,candyLevel,candyStars,finale,findMove,play,type Board,type Effect,type Frame,type Maker,type Piece} from '../store/match3'
import {gameSound} from '../konoSounds'
import type {GameHandle} from './GameScreen'

/** Candy crush and Gem blitz (the rules are in store/match3), drawn and animated after the games they follow.
 * Swipe a piece toward a neighbor (or tap one, then the other). Pieces slide and drop in, cleared ones
 * burst into shards with the points floating up, a striped candy or a star gem fires a beam along its row
 * or column, wrapped candies and flame gems explode in a ring, a color bomb or hypercube throws lightning
 * at every piece it takes, and big moments shake the board. Stand still a few seconds and a move wiggles
 * as a hint.
 * - Candy crush: the six classic candies on a light board. Each level has a target and a number of moves
 *   (even levels have jelly to clear too), with 1–3 stars. Cascades get "Sweet!", "Tasty!", "Delicious!",
 *   "Divine!". Win with moves left and they turn into striped candies that all go off: Sugar crush!
 * - Gem blitz: seven faceted gems on a dark board, one minute. Some gems carry +5 seconds, big cascades drop
 *   in ×2 … ×8 multipliers, quick moves in a row earn a Speed bonus (200, climbing to 1,000) and fill the
 *   Ignition meter; full, it lights Blazing speed for eight seconds (the board burns and every match explodes
 *   like a flame gem). A hypercube darkens the board so only the gems it takes stay lit. When
 *   time's up every special left goes off in a Last hurrah. */
const BLITZ_MS=60_000,SPEEDY_MS=1700,IGNITE=9,BLAZE_MS=8000
const CANDY_CHEERS=['','','Sweet!','Tasty!','Delicious!','Divine!']
const GEM_CHEERS=['','','Good!','Excellent!','Awesome!','Spectacular!','Extraordinary!','Unbelievable!']
type Fx={key:number;effects:Effect[];cleared:{at:number;kind:number}[];pop:{n:number;x:number;y:number}|null;big:boolean}
export default function Match3({ref,mode,level,start,sound,onEnd}:{ref:Ref<GameHandle>;mode:'gems'|'candy';level:number;start:{maker:Maker;board:Board;jelly?:Set<number>};sound:boolean;onEnd:(score:number,won:boolean,stars:number)=>void}){
 const goal=candyLevel(level)
 const [board,setBoard]=useState<Board>(start.board),[born,setBorn]=useState<Set<number>>(new Set())
 const [jelly,setJelly]=useState<Set<number>>(()=>new Set(start.jelly??[]))
 const [sel,setSel]=useState<number|null>(null),[shake,setShake]=useState<number[]>([]),[hint,setHint]=useState<[number,number]|null>(null)
 const [score,setScore]=useState(0),[moves,setMoves]=useState(goal.moves),[left,setLeft]=useState(BLITZ_MS),[mult,setMult]=useState(1),[speed,setSpeed]=useState(0),[blazing,setBlazing]=useState(false)
 const [fx,setFx]=useState<Fx[]>([]),[cheer,setCheer]=useState<{key:number;text:string;big?:boolean}|null>(null),[done,setDone]=useState<string|null>(null),[quake,setQuake]=useState(0)
 const boardRef=useRef<HTMLDivElement>(null),busy=useRef(false),scoreRef=useRef(0),ended=useRef(false),keys=useRef(0),boardNow=useRef(start.board),movesLeft=useRef(goal.moves)
 const jellyNow=useRef(new Set(start.jelly??[])),multNow=useRef(1),extraMs=useRef(0),lastMove=useRef(0),speedNow=useRef(0),idleAt=useRef(0)
 const press=useRef<{at:number;x:number;y:number;moved:boolean}|null>(null)
 const onEndRef=useRef(onEnd),hurrah=useRef(()=>{})
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 const stars=()=>candyStars(scoreRef.current,goal.target)
 const finish=(won:boolean,text:string)=>{if(ended.current)return;ended.current=true;setDone(text);window.setTimeout(()=>onEndRef.current(scoreRef.current,won,mode==='candy'?(won?Math.max(1,stars()):0):0),1500)}
 const say=(text:string,big=false)=>{const key=++keys.current;setCheer({key,text,big});window.setTimeout(()=>setCheer(c=>c?.key===key?null:c),1200)}
 // Gem blitz's minute (and its +5 second gems); when it's up, a move under way finishes, then the Last hurrah.
 useEffect(()=>{
  if(mode!=='gems')return
  const startAt=performance.now()
  const t=window.setInterval(()=>{
   const rest=BLITZ_MS+extraMs.current-(performance.now()-startAt);setLeft(Math.max(0,rest))
   if(rest<=0&&!busy.current&&!ended.current){window.clearInterval(t);hurrah.current()}
  },200)
  return ()=>window.clearInterval(t)
  // hurrah.current only reads refs.
 },[mode])
 // A hint: after five seconds without a move, a move that works wiggles.
 useEffect(()=>{
  idleAt.current=performance.now()
  const t=window.setInterval(()=>{if(!busy.current&&!ended.current&&performance.now()-idleAt.current>5000){const mv=findMove(boardNow.current);setHint(mv)}},1000)
  return ()=>window.clearInterval(t)
 },[])
 // ■ End: finish now (Candy crush counts it as won only if the level's goal is already met).
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;const won=mode==='gems'||(scoreRef.current>=goal.target&&!jellyNow.current.size);onEndRef.current(scoreRef.current,won,mode==='candy'&&won?Math.max(1,stars()):0)}}),[mode,goal.target]) // eslint-disable-line react-hooks/exhaustive-deps
 const show=(next:Board)=>{const had=new Set(boardNow.current.map(p=>p?.id));setBorn(new Set(next.flatMap(p=>p&&!had.has(p.id)?[p.id]:[])));boardNow.current=next;setBoard(next)}
 // Plays a move's steps one after another, then `after`.
 const run=(frames:Frame[],after:()=>void)=>{
  busy.current=true;setHint(null)
  let at=0
  for(const f of frames){
   window.setTimeout(()=>{
    show(f.board)
    if(f.time){extraMs.current+=f.time*1000;say('+'+f.time+' seconds!')}
    if(f.mult>multNow.current){multNow.current=f.mult;setMult(f.mult);say('×'+f.mult+' multiplier!',true)}
    if(!f.cleared.length)return
    const pts=f.points*(mode==='gems'?multNow.current:1)
    scoreRef.current+=pts;setScore(scoreRef.current)
    // Jelly under a cleared square is gone.
    if(jellyNow.current.size){let changed=false;for(const c of f.cleared)if(jellyNow.current.delete(c.at))changed=true;if(changed)setJelly(new Set(jellyNow.current))}
    const xs=f.cleared.map(c=>c.at%W+0.5),ys=f.cleared.map(c=>Math.floor(c.at/W)+0.5)
    const big=f.effects.length>=2||f.effects.some(e=>e.type==='color'||e.type==='board'||e.type==='nova')
    const key=++keys.current
    setFx(list=>[...list.slice(-3),{key,effects:f.effects,cleared:f.cleared,big,pop:{n:pts,x:xs.reduce((a,b)=>a+b,0)/xs.length,y:ys.reduce((a,b)=>a+b,0)/ys.length}}])
    window.setTimeout(()=>setFx(list=>list.filter(x=>x.key!==key)),900)
    if(big){setQuake(key);window.setTimeout(()=>setQuake(q=>q===key?0:q),420)}
    if(f.effects.some(e=>e.type==='board'))say(mode==='candy'?'Sugar crush!':'Unbelievable!',true)
    else if(f.cascade>=2)say((mode==='candy'?CANDY_CHEERS:GEM_CHEERS)[Math.min(f.cascade,(mode==='candy'?CANDY_CHEERS:GEM_CHEERS).length-1)])
    gameSound(big||f.effects.length?'big':'score',sound,f.cascade-1)
   },at)
   at+=f.cleared.length?(f.effects.length?380:280):(f.points===0&&f.cascade===0?60:230)
  }
  window.setTimeout(()=>{busy.current=false;idleAt.current=performance.now();after()},at+40)
 }
 const lastHurrah=()=>{
  if(ended.current)return
  const specials=boardNow.current.some(p=>p?.special&&p.special!=='color')
  if(!specials){finish(true,'Time’s up!');return}
  say('Last hurrah!',true)
  run(finale(boardNow.current,start.maker,0),()=>finish(true,'Time’s up!'))
 }
 useEffect(()=>{hurrah.current=lastHurrah})
 const attempt=(a:number,c:number)=>{
  if(busy.current||ended.current)return
  const frames=play(boardNow.current,a,c,start.maker)
  if(!frames){setShake([a,c]);gameSound('nope',sound);window.setTimeout(()=>setShake([]),380);return}
  setSel(null)
  const swapped=[...boardNow.current];[swapped[a],swapped[c]]=[swapped[c],swapped[a]];show(swapped)
  // Gem blitz's speed, as in Bejeweled Blitz: a quick move after a quick move is a Speed bonus (from the
  // third on: 200, then 100 more each time, up to 1,000), and each one fills the Ignition meter.
  if(mode==='gems'){
   const now=performance.now();speedNow.current=now-lastMove.current<SPEEDY_MS?speedNow.current+1:0;lastMove.current=now
   if(!start.maker.blazing)setSpeed(speedNow.current)
   if(speedNow.current>=2){const bonus=Math.min(1000,200+100*(speedNow.current-2))*multNow.current;scoreRef.current+=bonus;setScore(scoreRef.current);say('Speed +'+bonus.toLocaleString())}
  }
  window.setTimeout(()=>run(frames,()=>{
   if(mode==='gems'&&!start.maker.blazing&&speedNow.current>=IGNITE){
    // Blazing speed: for eight seconds every match bursts like a flame gem.
    speedNow.current=0;setSpeed(0);start.maker.blazing=true;setBlazing(true)
    window.setTimeout(()=>{start.maker.blazing=false;setBlazing(false)},BLAZE_MS)
    say('Blazing speed!',true);gameSound('big',sound,4)
   }
   if(mode==='candy'){
    movesLeft.current-=1;setMoves(movesLeft.current)
    const met=scoreRef.current>=goal.target&&!jellyNow.current.size
    if(met){
     // Sugar crush: each move left becomes a striped candy, and they all go off.
     if(movesLeft.current>0){say('Sugar crush!',true);const extra=movesLeft.current;movesLeft.current=0;setMoves(0);window.setTimeout(()=>run(finale(boardNow.current,start.maker,extra),()=>finish(true,'Level '+level+' complete!')),700)}
     else finish(true,'Level '+level+' complete!')
    }else if(movesLeft.current<=0)finish(false,'Out of moves')
   }
  }),170)
 }
 const indexAt=(x:number,y:number)=>{const r=boardRef.current?.getBoundingClientRect();if(!r)return -1;const c=Math.floor((x-r.left)/(r.width/W)),row=Math.floor((y-r.top)/(r.height/W));return c<0||row<0||c>=W||row>=W?-1:row*W+c}
 const down=(e:React.PointerEvent<HTMLDivElement>)=>{const at=indexAt(e.clientX,e.clientY);if(at<0)return;idleAt.current=performance.now();setHint(null);e.currentTarget.setPointerCapture(e.pointerId);press.current={at,x:e.clientX,y:e.clientY,moved:false}}
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
 const pos=(i:number)=>({left:(i%W)*100/W+'%',top:Math.floor(i/W)*100/W+'%'})
 const label=(p:Piece)=>(mode==='candy'?['red','orange','yellow','green','blue','purple']:['red','orange','yellow','green','blue','purple','white'])[p.kind]+(p.special?' '+({row:mode==='candy'?'striped':'lightning',col:mode==='candy'?'striped':'lightning',area:mode==='candy'?'wrapped':'flame',cross:'star',color:mode==='candy'?'color bomb':'hypercube',nova:'supernova'})[p.special]:'')+(p.bonus==='time'?' +5 seconds':p.bonus==='mult'?' ×'+p.mult:'')
 const progress=Math.min(1,score/(goal.target*2))
 return <div className={'break-game match3 is-'+mode+(blazing?' is-blazing':'')}>
  <div className="blast-top">
   <span className="blast-best">{mode==='candy'?'Level '+level:'⏱ '+Math.ceil(left/1000)+'s'}</span>
   {mode==='candy'?<span className="blast-coins">{moves} move{moves===1?'':'s'}</span>:<span className="blast-coins m3-mult" aria-label={'Multiplier ×'+mult}>×{mult}</span>}
   <strong key={score} className="blast-score" aria-label={'Score '+score}>{score.toLocaleString()}</strong>
  </div>
  {mode==='candy'?<div className="match3-goal" role="progressbar" aria-label={'Target '+goal.target} aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={Math.min(score,goal.target)}>
   <span style={{width:progress*100+'%'}}/>{[0.5,0.75,1].map((x,k)=><i key={k} className={progress>=x?'is-lit':''} style={{left:x*100+'%'}} aria-hidden="true">★</i>)}
   <b>{goal.jelly?(jelly.size?jelly.size+' jelly left · ':'Jelly cleared ✓ · '):''}{Math.min(score,goal.target).toLocaleString()} / {goal.target.toLocaleString()}</b>
  </div>
  :<div className="match3-goal is-time" aria-hidden="true"><span style={{width:Math.min(1,left/BLITZ_MS)*100+'%'}}/></div>}
  {mode==='gems'&&<div className={'m3-ignite'+(blazing?' is-on':'')} role="meter" aria-label="Ignition" aria-valuemin={0} aria-valuemax={IGNITE} aria-valuenow={blazing?IGNITE:Math.min(IGNITE,speed)}><span style={{width:(blazing?100:Math.min(1,speed/IGNITE)*100)+'%'}}/><b>{blazing?'🔥 Blazing speed!':'Ignition'}</b></div>}
  <div className={'blast-frame'+(quake?' is-quake':'')}>
   <div ref={boardRef} className="match3-board" role="grid" aria-label={mode==='candy'?'Candy board':'Gem board'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{press.current=null}}>
    {[...jelly].map(i=><span key={'j'+i} className="m3-jelly" style={pos(i)} aria-hidden="true"/>)}
    {board.map((p,i)=>p&&<div key={p.id} role="gridcell" data-i={i} data-kind={p.kind} aria-label={'Row '+(Math.floor(i/W)+1)+', column '+(i%W+1)+': '+label(p)}
     className={'match3-piece k'+p.kind+(p.special?' is-'+p.special:'')+(p.bonus?' has-'+p.bonus:'')+(sel===i?' is-picked':'')+(shake.includes(i)?' is-shake':'')+(born.has(p.id)?' is-new':'')+(hint?.includes(i)?' is-hint':'')} style={pos(i)}>
     <span className="m3-gem" aria-hidden="true"/>{p.bonus==='mult'&&<b className="m3-badge" aria-hidden="true">×{p.mult}</b>}{p.bonus==='time'&&<b className="m3-badge is-time" aria-hidden="true">+5</b>}
    </div>)}
    {fx.map(f=><div key={f.key} className="m3-fx" aria-hidden="true">
     {f.cleared.map(c=><span key={c.at} className={'m3-shard k'+c.kind} style={pos(c.at)}/>)}
     {f.effects.map((e,k)=><Effect key={k} e={e}/>)}
     {f.pop&&<span className="m3-pop" style={{left:f.pop.x*100/W+'%',top:f.pop.y*100/W+'%'}}>+{f.pop.n.toLocaleString()}</span>}
    </div>)}
    {cheer&&<p key={cheer.key} className={'blast-cheer m3-cheer'+(cheer.big?' is-big':'')} role="status"><span>{cheer.text}</span></p>}
    {done&&<p className="blast-over" role="status">{done}</p>}
   </div>
  </div>
  <p className="blast-help">{mode==='candy'?'Match 4 for a striped candy, an L or T for a wrapped one, 5 for a color bomb. Swap two specials together for a combo!':'Match 4 for a flame gem, an L or T for a star, 5 for a hypercube, 6 for a supernova. Quick moves in a row light Blazing speed!'}</p>
 </div>
}

/** What a special piece did: a beam along its row or column (three wide for a supernova), a ring for an
 * explosion, lightning from a color bomb to each piece it takes, a flash for the whole board. */
function Effect({e}:{e:Effect}){
 const id=useId()
 const r=Math.floor(e.at/W),c=e.at%W
 const beam=(kind:'row'|'col',n:number,wide=1)=><span key={kind+n} className={'m3-beam is-'+kind+(wide>1?' is-wide':'')} style={kind==='row'?{top:n*100/W+'%'}:{left:n*100/W+'%'}}/>
 if(e.type==='row')return beam('row',r)
 if(e.type==='col')return beam('col',c)
 if(e.type==='cross')return <>{beam('row',r)}{beam('col',c)}</>
 if(e.type==='nova')return <>{[r-1,r,r+1].filter(y=>y>=0&&y<W).map(y=>beam('row',y,3))}{[c-1,c,c+1].filter(x=>x>=0&&x<W).map(x=>beam('col',x,3))}</>
 if(e.type==='area')return <span className={'m3-ring'+(e.cells.length>9?' is-big':'')} style={{left:(c+0.5)*100/W+'%',top:(r+0.5)*100/W+'%'}}/>
 if(e.type==='board')return <span className="m3-flash"/>
 // A color bomb or hypercube darkens the board; only the pieces it takes stay lit while the lightning hits them.
 return <svg className="m3-bolts" viewBox={'0 0 '+W+' '+W} preserveAspectRatio="none">
  <defs><mask id={id}><rect width={W} height={W} fill="#fff"/>{e.cells.map(i=><rect key={i} x={i%W} y={Math.floor(i/W)} width={1} height={1} rx={0.25} fill="#000"/>)}</mask></defs>
  <rect className="m3-dim" width={W} height={W} mask={'url(#'+id+')'}/>
  {e.cells.map(i=>{const y=Math.floor(i/W)+0.5,x=i%W+0.5,mx=(x+c+0.5)/2+((i*7)%3-1)*0.4,my=(y+r+0.5)/2+((i*5)%3-1)*0.4;return <polyline key={i} points={(c+0.5)+','+(r+0.5)+' '+mx+','+my+' '+x+','+y}/>})}</svg>
}
