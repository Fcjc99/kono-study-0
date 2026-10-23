import './land-games.css'
import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import type {LandId} from '../store/konoWorld'
import {KINDS,LAND_GAMES,ROWS,COLS,clearGroup,hasMoves,tumbleBoard,type LandGameId,type Tile} from '../store/landGames'
import {gameSound} from '../konoSounds'
import GameScreen,{type GameHandle,type GameResult} from './GameScreen'

/** Each land's own game on the world map (components/KonoWorld), played from its booth on the land's
 * picture. Like the arcade, the first rounds a day win coins (store/konoCoins › gameCoins) and best scores
 * stay on this device. A game plays full screen with the arcade's start card, ↻ Restart, ■ End and results
 * (components/GameScreen) and its sounds. After classic pet-site games:
 * - Sandy Beach Cove: Shell chase (a snake game, after Meerca Chase): steer KONO to the shells, each one
 *   adds a baby crab to the line behind it; bumping the edge or a crab ends it.
 * - Mossy Forest Glade: Acorn tumble (after Destruct-O-Match): tap two or more touching pieces of a kind to
 *   clear them (bigger groups score much more), the rest tumble down; it ends when no pair is left.
 * - Snowy Mountain Village: Sled dash (after Snowmuncher): KONO sleds downhill; dodge the trees and rocks
 *   and pick up stars, 45 seconds to the bottom.
 * Loaded with the world map only. */
const bestKey=(g:LandGameId)=>'kono-break-best:'+g
function readBest(g:LandGameId):number|null{try{const v=localStorage.getItem(bestKey(g));return v===null?null:Number(v)}catch{return null}}
function saveBest(g:LandGameId,score:number):boolean{
 const old=readBest(g),better=old===null||!Number.isFinite(old)||score>old
 if(better)try{localStorage.setItem(bestKey(g),String(score))}catch{/* storage unavailable */}
 return better
}
const clock=(ms:number)=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}

/** `onScore` turns a finished round into coins (it returns what to add to the result line). */
export default function LandGame({land,sound,kono,onScore}:{land:LandId;sound:boolean;kono:string;onScore:(game:LandGameId,score:number)=>string|null}){
 const game=LAND_GAMES[land]
 const [open,setOpen]=useState(false),[started,setStarted]=useState(false),handle=useRef<GameHandle>(null)
 const [board,setBoard]=useState<Tile[][]>([]),[result,setResult]=useState<string|null>(null),[round,setRound]=useState(0),[ended,setEnded]=useState<GameResult|null>(null)
 // A finished round shows its results card in the game's screen (Play again or Done).
 const finish=(score:number,line:string)=>{const best=score>0&&saveBest(game.id,score),extra=onScore(game.id,score);setResult(line+(best?' New best! 🎉':'')+(extra?' '+extra:''));setEnded({emoji:game.emoji,title:score>0?'Nice one!':'Better luck next time!',line,score:game.unit(score),best:Boolean(best),coins:extra,won:score>0})}
 const start=()=>{setResult(null);setEnded(null);if(game.id==='tumble')setBoard(tumbleBoard());setRound(r=>r+1);setStarted(true)}
 const best=readBest(game.id)
 return <section className="land-game" aria-label={game.name}>
  {open&&<GameScreen title={game.emoji+' '+game.name} tone="blast" sound={sound} result={ended} intro={{emoji:game.emoji,name:game.name,how:game.how,best:best!==null?'Best: '+game.unit(best):null}} started={started} onStart={start} onRestart={start} onEnd={()=>handle.current?.end()} onAgain={start} onLeave={()=>{setOpen(false);setStarted(false);setEnded(null)}}><div className="land-game">{game.id==='chase'?<ShellChase key={round} ref={handle} kono={kono} sound={sound} onEnd={n=>finish(n,'KONO collected '+game.unit(n)+' and '+n+' baby crab'+(n===1?'':'s')+' followed along! 🦀')}/>
  :game.id==='tumble'?<AcornTumble key={round} ref={handle} start={board} sound={sound} onEnd={(n,clear)=>finish(n,(clear?'You cleared the whole glade! ':'')+'That’s '+game.unit(n)+'! 🌰')}/>
  :<SledDash key={round} ref={handle} kono={kono} sound={sound} onEnd={(n,crashed)=>finish(n,(crashed?'Bonk! KONO tumbled into the snow with ':'KONO made it to the bottom with ')+game.unit(n)+'! 🛷')}/>}</div></GameScreen>}
  <div className="land-game-intro">
   <span className="land-game-emoji" aria-hidden="true">{game.emoji}</span>
   <div><strong>{game.name}</strong><p>{game.how}</p>{best!==null&&<small>Best: {game.unit(best)}</small>}</div>
   {result&&<p className="land-game-result" role="status">{result}</p>}
   <button type="button" className="primary" onClick={()=>{setResult(null);setEnded(null);setStarted(false);setOpen(true)}}>{result?'Play again':'Play '+game.name}</button>
  </div>
 </section>
}

/** Shell chase: KONO walks a 12 × 12 beach one square at a time; the line of crabs follows its steps. */
const N=12
type Cell={x:number;y:number}
const START:Cell[]=[{x:3,y:6}]
const at=(c:Cell)=>({left:c.x*100/N+'%',top:c.y*100/N+'%',width:100/N+'%',height:100/N+'%'})
const DIRS:Record<string,Cell>={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}
const KEYS:Record<string,string>={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}
type Chase={body:Cell[];dir:Cell;turns:Cell[];shell:Cell;score:number;over:boolean}
/** Queues a turn (at most two ahead); KONO can't turn straight back into its crabs. */
function queueTurn(st:Chase,name:string){
 const d=DIRS[name],prev=st.turns.at(-1)??st.dir
 if(st.over||st.turns.length>=2||(d.x===-prev.x&&d.y===-prev.y)||(d.x===prev.x&&d.y===prev.y))return
 st.turns.push(d)
}
function ShellChase({ref,kono,sound,onEnd}:{ref:Ref<GameHandle>;kono:string;sound:boolean;onEnd:(shells:number)=>void}){
 const [view,setView]=useState({body:START,shell:{x:8,y:3},score:0,bump:false})
 const s=useRef<Chase>({body:START,dir:DIRS.right,turns:[],shell:{x:8,y:3},score:0,over:false})
 const onEndRef=useRef(onEnd),swipe=useRef<{x:number;y:number}|null>(null)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 useEffect(()=>{
  const st=s.current
  let raf=0,last=performance.now(),wait=700
  const step=()=>{
   const turn=st.turns.shift();if(turn)st.dir=turn
   const head={x:st.body[0].x+st.dir.x,y:st.body[0].y+st.dir.y}
   const grow=head.x===st.shell.x&&head.y===st.shell.y,body=grow?st.body:st.body.slice(0,-1)
   if(head.x<0||head.y<0||head.x>=N||head.y>=N||body.some(c=>c.x===head.x&&c.y===head.y)){
    st.over=true;setView(v=>({...v,bump:true}));window.setTimeout(()=>onEndRef.current(st.score),800);return false
   }
   st.body=[head,...body]
   if(grow){
    st.score+=1;gameSound('score',sound,Math.min(6,Math.floor(st.score/3)))
    const free:Cell[]=[];for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!st.body.some(c=>c.x===x&&c.y===y))free.push({x,y})
    st.shell=free[Math.floor(Math.random()*free.length)]??st.shell
   }
   setView({body:st.body,shell:st.shell,score:st.score,bump:false})
   return true
  }
  const tick=(t:number)=>{
   wait-=t-last;last=t
   // A little faster with every shell.
   while(wait<=0){if(!step())return;wait+=Math.max(115,200-st.score*6)}
   raf=requestAnimationFrame(tick)
  }
  raf=requestAnimationFrame(tick)
  const key=(e:KeyboardEvent)=>{const d=KEYS[e.key];if(d){e.preventDefault();queueTurn(st,d)}}
  window.addEventListener('keydown',key)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',key)}
 },[sound])
 useImperativeHandle(ref,()=>({end:()=>{const st=s.current;if(st.over)return;st.over=true;onEndRef.current(st.score)}}),[])
 const steerTo=(name:string)=>queueTurn(s.current,name)
 return <div className="land-game-play">
  <p className="land-game-status"><span>Shells: <strong>{view.score}</strong></span><span>Crabs: {view.body.length-1}</span></p>
  <div className="chase-board" role="application" tabIndex={0} aria-label="Shell chase: steer KONO with the arrow keys, a swipe or the arrow buttons"
   onPointerDown={e=>{swipe.current={x:e.clientX,y:e.clientY}}}
   onPointerUp={e=>{const from=swipe.current;swipe.current=null;if(!from)return;const dx=e.clientX-from.x,dy=e.clientY-from.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;steerTo(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'))}}>
   <span className="chase-shell" style={at(view.shell)} aria-hidden="true">🐚</span>
   {view.body.slice(1).map((c,i)=><span key={i} className="chase-crab" style={at(c)} aria-hidden="true">🦀</span>)}
   <span className={'chase-kono'+(view.bump?' is-bump':'')} style={at(view.body[0])} aria-hidden="true"><img src={kono} alt="" draggable={false}/></span>
  </div>
  <div className="land-game-pad">
   <button type="button" aria-label="Up" onClick={()=>steerTo('up')}>▲</button>
   <button type="button" aria-label="Left" onClick={()=>steerTo('left')}>◀</button>
   <button type="button" aria-label="Down" onClick={()=>steerTo('down')}>▼</button>
   <button type="button" aria-label="Right" onClick={()=>steerTo('right')}>▶</button>
  </div>
 </div>
}

/** Acorn tumble (the board and its rules are in store/landGames). */
function AcornTumble({ref,start,sound,onEnd}:{ref:Ref<GameHandle>;start:Tile[][];sound:boolean;onEnd:(points:number,cleared:boolean)=>void}){
 const [cols,setCols]=useState(start),[score,setScore]=useState(0),[gain,setGain]=useState<{id:number;n:number;c:number;r:number}|null>(null),[over,setOver]=useState(false)
 useImperativeHandle(ref,()=>({end:()=>{if(over)return;setOver(true);onEnd(score,false)}}),[over,score,onEnd])
 const tap=(c:number,r:number)=>{
  if(over)return
  const done=clearGroup(cols,c,r)
  if(!done){gameSound('nope',sound);return}
  const next=done.cols,points=score+done.points
  gameSound(done.points>=36?'big':'score',sound,Math.round(Math.sqrt(done.points))-1);setCols(next);setScore(points);setGain({id:cols[c][r].id,n:done.points,c,r})
  if(!hasMoves(next)){const cleared=!next.length;setOver(true);window.setTimeout(()=>onEnd(points+(cleared?100:0),cleared),900)}
 }
 return <div className="land-game-play">
  <p className="land-game-status"><span>Points: <strong>{score}</strong></span><span>{over?'No more pairs!':'Pieces left: '+cols.reduce((n,col)=>n+col.length,0)}</span></p>
  <div className="tumble-board" role="group" aria-label="Acorn tumble">
   {cols.map((col,c)=>col.map((t,r)=><button type="button" key={t.id} className="tumble-tile" data-c={c} data-r={r} data-kind={t.kind} style={{left:c*100/COLS+'%',bottom:r*100/ROWS+'%',width:100/COLS+'%',height:100/ROWS+'%'}} aria-label={KINDS[t.kind].name} onClick={()=>tap(c,r)}><span aria-hidden="true">{KINDS[t.kind].emoji}</span></button>))}
   {gain&&<span key={gain.id} className="tumble-gain" style={{left:(gain.c+0.5)*100/COLS+'%',bottom:(gain.r+0.5)*100/ROWS+'%'}} aria-hidden="true">+{gain.n}</span>}
  </div>
 </div>
}

/** Sled dash: KONO sleds down three lanes (KONO stays put, the slope rushes up past it) for 45 seconds. */
const SLED_MS=45_000,KONO_Y=0.2
type Thing={id:number;lane:number;y:number;kind:'tree'|'rock'|'star'}
type Sled={lane:number;things:Thing[];score:number;next:number;id:number;over:boolean}
const steerSled=(st:Sled,d:number)=>{if(!st.over)st.lane=Math.min(2,Math.max(0,st.lane+d));return st.lane}
const THING={tree:'🌲',rock:'🪨',star:'⭐'}
function SledDash({ref,kono,sound,onEnd}:{ref:Ref<GameHandle>;kono:string;sound:boolean;onEnd:(stars:number,crashed:boolean)=>void}){
 const [things,setThings]=useState<Thing[]>([]),[lane,setLane]=useState(1),[score,setScore]=useState(0),[left,setLeft]=useState(SLED_MS),[bump,setBump]=useState(false)
 const s=useRef<Sled>({lane:1,things:[],score:0,next:900,id:0,over:false})
 const onEndRef=useRef(onEnd)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 useEffect(()=>{
  const st=s.current,started=performance.now()
  let raf=0,last=started
  const end=(crashed:boolean)=>{st.over=true;if(crashed)setBump(true);window.setTimeout(()=>onEndRef.current(st.score,crashed),crashed?900:300)}
  const tick=(t:number)=>{
   const dt=Math.min(50,t-last),run=t-started;last=t
   const speed=0.00036+run*0.000000006
   if(run>=st.next){
    // A row: one or two lanes blocked (never all three), and often a star in a free one.
    const lanes=[0,1,2].sort(()=>Math.random()-0.5),blocked=Math.random()<0.3?2:1
    for(let i=0;i<blocked;i++)st.things.push({id:++st.id,lane:lanes[i],y:1.08,kind:Math.random()<0.6?'tree':'rock'})
    if(Math.random()<0.6)st.things.push({id:++st.id,lane:lanes[2],y:1.08,kind:'star'})
    st.next=run+Math.max(430,820-run*0.008)
   }
   for(const th of st.things)th.y-=speed*dt
   const hit=st.things.filter(th=>th.lane===st.lane&&Math.abs(th.y-KONO_Y)<0.06)
   if(hit.some(th=>th.kind!=='star')){setThings([...st.things]);end(true);return}
   if(hit.length){st.score+=hit.length;setScore(st.score);gameSound('score',sound,Math.min(6,Math.floor(st.score/3)))}
   st.things=st.things.filter(th=>!hit.includes(th)&&th.y>-0.1)
   setThings([...st.things]);setLeft(SLED_MS-run)
   if(run>=SLED_MS){end(false);return}
   raf=requestAnimationFrame(tick)
  }
  raf=requestAnimationFrame(tick)
  const key=(e:KeyboardEvent)=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setLane(steerSled(st,e.key==='ArrowLeft'?-1:1))}}
  window.addEventListener('keydown',key)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',key)}
 },[sound])
 useImperativeHandle(ref,()=>({end:()=>{const st=s.current;if(st.over)return;st.over=true;onEndRef.current(st.score,false)}}),[])
 const steer=(d:number)=>setLane(steerSled(s.current,d))
 return <div className="land-game-play">
  <p className="land-game-status"><span>Stars: <strong>{score}</strong></span><span>{clock(left)}</span></p>
  <div className="sled-slope" role="application" tabIndex={0} aria-label="Sled dash: steer with the arrow keys, or tap the left or right side"
   onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();steer(e.clientX-r.left<r.width/2?-1:1)}}>
   {things.map(th=><span key={th.id} className={'sled-thing is-'+th.kind} style={{left:(th.lane*2+1)*100/6+'%',top:th.y*100+'%'}} aria-hidden="true">{THING[th.kind]}</span>)}
   <span className={'sled-kono'+(bump?' is-bump':'')} style={{left:(lane*2+1)*100/6+'%',top:KONO_Y*100+'%'}} aria-hidden="true"><img src={kono} alt="" draggable={false}/><span>🛷</span></span>
  </div>
  <div className="land-game-pad is-two">
   <button type="button" aria-label="Steer left" onClick={()=>steer(-1)}>◀</button>
   <button type="button" aria-label="Steer right" onClick={()=>steer(1)}>▶</button>
  </div>
 </div>
}
