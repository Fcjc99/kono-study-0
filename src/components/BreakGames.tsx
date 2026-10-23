import './break-games.css'
import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import BlockBlast from './BlockBlast'
import GameScreen,{type GameHandle,type GameResult} from './GameScreen'
import {gameSound} from '../konoSounds'
import Meowdoku from './Meowdoku'
import Match3 from './Match3'
import FlappyKono from './FlappyKono'
import PaperKono from './PaperKono'
import {flapMedal} from '../store/flappy'
import {deal,readBlastSave,writeBlastSave,type BlastSave,type Piece} from '../store/blockBlast'
import {meowLevel,newMeowPuzzle,type Puzzle} from '../store/meowdoku'
import {candyLevelNow,freshBoard,jellyFor,maker,saveCandyLevel,type Board,type Maker} from '../store/match3'

/** Break-time games with KONO, offered when a focus session finishes ("Take a short break"). Two quick
 * ones: Snack catch (move KONO to catch falling treats, 30 seconds) and Peekaboo (tap KONO when it pops
 * out of a hole, 30 seconds). Every game plays full screen in KONO blast's look. The break itself lasts five
 * minutes; when it's over the games stop and KONO says it's time for the next session. Best scores are
 * kept on this device only. Loaded only when opened, so it never adds to the app's startup.
 * The same games, and KONO blast (the block puzzle), Meowdoku (the cat puzzle), Gem blitz and Candy crush
 * (match-3), Flappy KONO and KONO.io (claim the map, after Paper.io 2), are KONO Town's arcade: no break timer there, and `onScore` can turn a
 * score into coins (it returns what to add to the result line). */
type Game='catch'|'peekaboo'|'blast'|'meow'|'gems'|'candy'|'flap'|'paper'
export const BREAK_MINUTES=5
const ROUND_MS=30_000
const GAMES:{id:Game;emoji:string;name:string;how:string;best:(n:number)=>string;arcade?:boolean}[]=[
 {id:'catch',emoji:'🍓',name:'Snack catch',how:'Move KONO to catch the falling snacks.',best:n=>'Best: '+n+' snacks'},
 {id:'peekaboo',emoji:'🌿',name:'Peekaboo',how:'Tap KONO when it peeks out of a bush.',best:n=>'Best: '+n+' boops'},
 {id:'blast',emoji:'🧱',name:'KONO blast',how:'Fit the pieces on the board; fill a row or column to clear it.',best:n=>'Best: '+n+' points',arcade:true},
 {id:'meow',emoji:'🐱',name:'Meowdoku',how:'One cat in every row, column and color, and no two cats touching.',best:n=>'Best: level '+n,arcade:true},
 {id:'gems',emoji:'💎',name:'Gem blitz',how:'Swap gems to match 3 or more. One minute, as many points as you can!',best:n=>'Best: '+n+' points',arcade:true},
 {id:'candy',emoji:'🍬',name:'Candy crush',how:'Match candies to reach each level’s target in the moves you have.',best:n=>'Best: level '+n,arcade:true},
 {id:'flap',emoji:'🐤',name:'Flappy KONO',how:'Tap to flap KONO through the gaps in the pipes.',best:n=>'Best: '+n+' pipe'+(n===1?'':'s'),arcade:true},
 {id:'paper',emoji:'🟦',name:'KONO.io',how:'Leave your land, loop around and come home to claim it. Cut the bots’ trails, and keep yours safe! Play solo, or in a team battle: Blue against Red for two minutes.',best:n=>'Best: '+n+'% of the map',arcade:true},
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
 const [meow,setMeow]=useState<{level:number;puzzle:Puzzle}|null>(null),[match,setMatch]=useState<{maker:Maker;board:Board;level:number;jelly?:Set<number>}|null>(null)
 const [paperMode,setPaperMode]=useState<'solo'|'team'>('solo')
 const [ended,setEnded]=useState<GameResult|null>(null),[round,setRound]=useState(0),[started,setStarted]=useState(false)
 const handle=useRef<GameHandle>(null)
 const [now,setNow]=useState(startedAt)
 const [result,setResult]=useState<string|null>(null)
 useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(t)},[])
 const left=startedAt+BREAK_MINUTES*60_000-now,over=!arcade&&left<=0
 // A finished round: its results card (in the game's screen), the best kept, and coins for it.
 // `coinScore` is what earns coins when it isn't the score kept as a best (Candy crush keeps the level).
 const finish=(g:Game,score:number,line:string,{title='Nice game!',coinScore=score,scoreText,won=true}:{title?:string;coinScore?:number;scoreText?:string;won?:boolean}={})=>{
  const best=score>0&&saveBest(g,score),extra=g==='blast'?null:onScore?.(g,coinScore),info=GAMES.find(x=>x.id===g)!
  setResult(line+(best?' New best! 🎉':'')+(extra?' '+extra:''))
  setEnded({emoji:info.emoji,title,line,score:scoreText??info.best(score).replace(/^Best: /,''),best:Boolean(best),coins:extra,won})
 }
 // Opening a game shows its start card; Start (and Restart, and Play again) begins a round: a fresh board
 // (KONO blast carries on a saved game unless `fresh`; Meowdoku and Candy crush pick up at your level).
 const open=(g:Game)=>{setResult(null);setEnded(null);setStarted(false);setGame(g)}
 const begin=(g:Game,fresh=false)=>{
  setEnded(null);setRound(n=>n+1);setStarted(true)
  if(g==='blast'){if(fresh)writeBlastSave(null);setPieces(deal(Math.random));setBlastSave(fresh?null:readBlastSave())}
  if(g==='meow'){const level=meowLevel();setMeow({level,puzzle:newMeowPuzzle(level)})}
  if(g==='gems'||g==='candy'){const mk=maker(g,Math.random),level=g==='candy'?candyLevelNow():1;setMatch({maker:mk,board:freshBoard(mk),level,jelly:g==='candy'?jellyFor(level,Math.random):undefined})}
  setGame(g)
 }
 const info=GAMES.find(g=>g.id===game)
 const playing=over?null:game==='catch'?<SnackCatch key={round} ref={handle} sound={sound} onEnd={n=>finish('catch',n,'KONO caught '+n+' snack'+(n===1?'':'s')+'! 😋')}/>
  :game==='peekaboo'?<Peekaboo key={round} ref={handle} sound={sound} onEnd={n=>finish('peekaboo',n,'You booped KONO '+n+' time'+(n===1?'':'s')+'! 🌿')}/>
  :game==='blast'?<BlockBlast key={round} ref={handle} start={pieces} saved={blastSave} best={readBest('blast')} sound={sound} onCoins={onBlastCoins} onEnd={n=>finish('blast',n,'KONO blast: '+n+' point'+(n===1?'':'s')+'! 🧱')}/>
 :game==='meow'&&meow?<Meowdoku key={round} ref={handle} level={meow.level} puzzle={meow.puzzle} sound={sound} onEnd={(level,seconds,solved,extra)=>solved?finish('meow',level,'Solved in '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+(extra?.best?' — a new best for '+meow.puzzle.n+' × '+meow.puzzle.n+'!':'.')+(extra?.hints?' ('+extra.hints+' hint'+(extra.hints===1?'':'s')+')':'')+' Next up: level '+(level+1)+'.',{title:'Purr-fect!',coinScore:meow.puzzle.n,scoreText:'Level '+level}):finish('meow',0,'This one stays at level '+level+'. Play again for a new puzzle.',{title:'Puzzle skipped',coinScore:0,scoreText:'Level '+level,won:false})}/>
  :game==='flap'?<FlappyKono key={round} ref={handle} best={readBest('flap')} sound={sound} onEnd={n=>{const medal=flapMedal(n);finish('flap',n,(medal?medal.emoji+' '+medal.name+' medal! ':'')+'KONO flew through '+n+' pipe'+(n===1?'':'s')+'.',{title:medal?medal.name+' medal!':n>0?'Nice flying!':'Bonk!',scoreText:n+' pipe'+(n===1?'':'s'),won:n>0})}}/>
  :game==='paper'?<PaperKono key={round} ref={handle} mode={paperMode} sound={sound} onEnd={r=>r.team?finish('paper',0,'Blue '+r.team.blue+'% · Red '+r.team.red+'%'+(r.kills?'. You cut '+r.kills+' trail'+(r.kills===1?'':'s'):'')+'.',{title:r.team.won?'Blue wins! 🏆':r.team.blue===r.team.red?'A tie!':'Red wins this time',coinScore:(r.team.won?25:10)+r.kills*5,scoreText:'Team battle',won:r.team.won}):finish('paper',r.share,'You claimed '+r.share+'% of the map'+(r.kills?' and cut '+r.kills+' trail'+(r.kills===1?'':'s'):'')+'. Rank #'+r.rank+'.',{title:r.rank===1?'Top of the map!':'Nice run!',coinScore:Math.round(r.share+r.kills*5),scoreText:r.share+'%',won:r.share>1})}/>
  :(game==='gems'||game==='candy')&&match?<Match3 key={round} ref={handle} mode={game} level={match.level} start={match} sound={sound} onEnd={(score,won,stars)=>{
   if(game==='candy'){if(won)saveCandyLevel(match.level+1);finish('candy',won?match.level:match.level-1,won?'★'.repeat(stars)+'☆'.repeat(3-stars)+' · '+score.toLocaleString()+' points!':'So close! '+score+' points. Try the level again.',{title:won?'Level '+match.level+' complete!':'Out of moves',coinScore:won?score:Math.round(score/2),scoreText:score+' points',won})}
   else finish('gems',score,'One minute of gem swapping!',{title:'Time’s up!'})
  }}/>
  :null
 const kept=readBlastSave()
 return <section className={'break-games'+(arcade?' is-arcade':'')} aria-label={arcade?'Arcade':'Break games with KONO'}>
  {!arcade&&<header><strong>🎮 Break time with KONO</strong><span role="timer" aria-label="Break time left">{over?'Break’s over':'Break: '+clock(left)}</span>{onClose&&<button type="button" onClick={onClose}>Close</button>}</header>}
  {over?<p className="break-over" role="status">That was a nice reset! KONO’s ready for the next session when you are. 📚</p>
  :<>{result&&<p className="break-result" role="status">{result}</p>}<div className="break-game-list">{GAMES.filter(g=>arcade||!g.arcade).map(g=>{const best=readBest(g.id);return <button type="button" key={g.id} onClick={()=>open(g.id)}><span aria-hidden="true">{g.emoji}</span><strong>{g.name}</strong><small>{g.id==='blast'&&kept?'Carry on your game ('+kept.score+' points so far)':g.id==='meow'&&meowLevel()>1?'Level '+meowLevel()+' is next':g.id==='candy'&&candyLevelNow()>1?'Level '+candyLevelNow()+' is next':g.how}</small>{best!==null&&<small className="break-best">{g.best(best)}</small>}</button>})}</div></>}
  {game&&!over&&info&&<GameScreen title={info.emoji+' '+info.name} tone="blast" sound={sound} result={ended}
   intro={{emoji:info.emoji,name:info.name,how:info.how,best:readBest(game)!==null?info.best(readBest(game)!):null,...(game==='blast'&&kept?{start:'Continue ('+kept.score+' points)',alt:{label:'New game',onClick:()=>begin('blast',true)}}:game==='meow'?{start:'Start level '+meowLevel()}:game==='candy'?{start:'Start level '+candyLevelNow()}:game==='paper'?{start:'Solo',alt:{label:'Team battle',onClick:()=>{setPaperMode('team');begin('paper')}}}:{})}}
   started={started} onStart={()=>{if(game==='paper')setPaperMode('solo');begin(game)}} onRestart={()=>begin(game,true)} onEnd={()=>handle.current?.end()}
   onAgain={()=>begin(game,true)} onLeave={()=>{setGame(null);setEnded(null);setStarted(false)}}>
   {!arcade&&<p className="game-screen-timer" role="timer">{'Break: '+clock(left)}</p>}
   {playing}
  </GameScreen>}
 </section>
}

/** Snack catch: snacks fall in a box; KONO slides along the bottom (drag, tap a side, or ← →). */
const SNACKS=['🍓','🍪','🍙','🍩','🍎','🧁']
function SnackCatch({ref,sound,onEnd}:{ref:Ref<GameHandle>;sound:boolean;onEnd:(score:number)=>void}){
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
   if(caught.length){s.score+=caught.length;setScore(s.score);gameSound('score',sound,Math.min(4,Math.floor(s.score/5)))}
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
 },[sound])
 useImperativeHandle(ref,()=>({end:()=>onEndRef.current(state.current.score)}),[])
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
function Peekaboo({ref,sound,onEnd}:{ref:Ref<GameHandle>;sound:boolean;onEnd:(score:number)=>void}){
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
 const boop=(i:number)=>{if(i!==at){gameSound('nope',sound);return}scoreRef.current+=1;setScore(scoreRef.current);setBooped(i);setAt(-1);gameSound('score',sound,Math.min(4,Math.floor(scoreRef.current/4)))}
 useImperativeHandle(ref,()=>({end:()=>onEndRef.current(scoreRef.current)}),[])
 return <div className="break-game">
  <p className="break-game-status"><span>Boops: <strong>{score}</strong></span><span>{clock(left)}</span></p>
  <div className="peekaboo-grid">{Array.from({length:9},(_,i)=><button type="button" key={i} className={'peekaboo-bush'+(at===i?' is-up':'')+(booped===i?' is-booped':'')} aria-label={at===i?'Boop KONO!':'Bush'} onClick={()=>boop(i)}>{at===i&&<img src="/garden/kono/happy.webp" alt=""/>}{booped===i&&<span className="peekaboo-boop" aria-hidden="true">💗</span>}<span className="peekaboo-leaves" aria-hidden="true">🌿</span></button>)}</div>
 </div>
}
