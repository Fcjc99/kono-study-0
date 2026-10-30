import './break-games.css'
import {lazy,Suspense,useEffect,useRef,useState} from 'react'
import BlockBlast from './BlockBlast'
import GameScreen,{type GameHandle,type GameResult} from './GameScreen'
import Meowdoku from './Meowdoku'
import Match3 from './Match3'
import FlowGame from './FlowGame'
import FlappyKono from './FlappyKono'
import PaperKono from './PaperKono'
// KONO Beat brings its charts (every song, three levels): loaded when it's opened.
const RhythmGame=lazy(()=>import('./RhythmGame'))
import {flapMedal} from '../store/flappy'
import {readBlastFace} from '../store/blastFace'
import BlastFacePicker from './BlastFacePicker'
import GameCover from './GameCovers'
import {deal,readBlastSave,writeBlastSave,type BlastSave,type Piece} from '../store/blockBlast'
import {meowLevel,newMeowPuzzle,type Puzzle} from '../store/meowdoku'
import {BOOSTERS,candyLevelNow,candyStarsKept,freshBoard,jellyFor,maker,saveCandyLevel,saveCandyStars,type Board,type Maker} from '../store/match3'
import type {ShopItem} from '../store/konoCoins'

/** KONO Town's arcade: KONO blast (the block puzzle), Meowdoku (the cat puzzle), Gem blitz and Candy crush
 * (match-3), KONO Flow (falling blocks), KONO Beat (the songs as a rhythm game), Flappy KONO and KONO.io (claim the map, after Paper.io 2). Every
 * game plays full screen in KONO blast's look, and `onScore` can turn a score into coins (it returns what to
 * add to the result line). The same games are the break games offered when a focus session finishes
 * ("Take a short break"): the break lasts five minutes, and when it's over the games stop and KONO says it's
 * time for the next session. Best scores are kept on this device only. Loaded only when opened, so it never
 * adds to the app's startup. */
type Game='blast'|'meow'|'gems'|'candy'|'flap'|'paper'|'flow'|'beat'
export const BREAK_MINUTES=5
const GAMES:{id:Game;emoji:string;name:string;how:string;best:(n:number)=>string}[]=[
 {id:'blast',emoji:'🧱',name:'KONO blast',how:'Fit the pieces on the board; fill a row or column to clear it.',best:n=>'Best: '+n+' points'},
 {id:'meow',emoji:'🐱',name:'Meowdoku',how:'One cat in every row, column and color, and no two cats touching.',best:n=>'Best: level '+n},
 {id:'gems',emoji:'💎',name:'Gem blitz',how:'Swap gems to match 3 or more. One minute, as many points as you can!',best:n=>'Best: '+n+' points'},
 {id:'candy',emoji:'🍬',name:'Candy crush',how:'Match candies to reach each level’s target in the moves you have.',best:n=>'Best: level '+n},
 {id:'flow',emoji:'🌌',name:'KONO Flow',how:'Turn and drop the falling shapes to fill rows of light. Fill the Flow meter, then set it off: time stops while the rows you fill pile up, and they all clear at once!',best:n=>'Best: '+n.toLocaleString()+' points'},
 {id:'beat',emoji:'🥁',name:'KONO Beat',how:'The arcade’s songs as a rhythm game: hit the notes on the beat as they reach the line, and hold the long ones. Easy, Medium, or Jeff tier!',best:n=>'Best: '+n.toLocaleString()},
 {id:'flap',emoji:'🐤',name:'Flappy KONO',how:'Tap to flap KONO through the gaps in the pipes.',best:n=>'Best: '+n+' pipe'+(n===1?'':'s')},
 {id:'paper',emoji:'🟦',name:'KONO.io',how:'Leave your land, loop around and come home to claim it. Cut the bots’ trails, and keep yours safe! Play solo, or in a team battle: Blue against Red for two minutes.',best:n=>'Best: '+n+'% of the map'},
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
export default function BreakGames({startedAt,onClose,arcade=false,sound=false,onScore,onBlastCoins,coins}:{startedAt:number;onClose?:()=>void;arcade?:boolean;sound?:boolean;onScore?:(game:Game,score:number)=>string|null;onBlastCoins?:(lines:number,streak:number)=>number|null;coins?:{balance:number;onBuy:(item:ShopItem)=>void}}){
 const [game,setGame]=useState<Game|null>(null),[pieces,setPieces]=useState<Piece[]>([]),[blastSave,setBlastSave]=useState<BlastSave|null>(null)
 const [meow,setMeow]=useState<{level:number;puzzle:Puzzle}|null>(null),[match,setMatch]=useState<{maker:Maker;board:Board;level:number;jelly?:Set<number>}|null>(null)
 const [paperMode,setPaperMode]=useState<'solo'|'team'>('solo')
 // KONO blast's face blocks (a photo kept on this device), set on its start card.
 const [blastFace,setBlastFace]=useState(()=>readBlastFace())
 // The Candy crush level picked on the map (the next one to beat, unless you pick one you've played).
 const [candyPick,setCandyPick]=useState<number|null>(null)
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
  if(g==='gems'||g==='candy'){const mk=maker(g,Math.random),level=g==='candy'?candyPick??candyLevelNow():1;setMatch({maker:mk,board:freshBoard(mk),level,jelly:g==='candy'?jellyFor(level,Math.random):undefined})}
  setGame(g)
 }
 const info=GAMES.find(g=>g.id===game)
 const playing=over?null:game==='blast'?<BlockBlast key={round} ref={handle} face={blastFace} start={pieces} saved={blastSave} best={readBest('blast')} sound={sound} onCoins={onBlastCoins} onEnd={n=>finish('blast',n,'KONO blast: '+n+' point'+(n===1?'':'s')+'! 🧱')}/>
 :game==='meow'&&meow?<Meowdoku key={round} ref={handle} level={meow.level} puzzle={meow.puzzle} sound={sound} onEnd={(level,seconds,solved,extra)=>solved?finish('meow',level,'Solved in '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+(extra?.best?' — a new best for '+meow.puzzle.n+' × '+meow.puzzle.n+'!':'.')+(extra?.hints?' ('+extra.hints+' hint'+(extra.hints===1?'':'s')+')':'')+' Next up: level '+(level+1)+'.',{title:'Purr-fect!',coinScore:meow.puzzle.n,scoreText:'Level '+level}):finish('meow',0,(extra?.lives===0?'Three wrong cats. ':'')+'This one stays at level '+level+'. Play again for a new puzzle.',{title:extra?.lives===0?'Out of hearts 💔':'Puzzle skipped',coinScore:0,scoreText:'Level '+level,won:false})}/>
  :game==='flap'?<FlappyKono key={round} ref={handle} best={readBest('flap')} sound={sound} onEnd={n=>{const medal=flapMedal(n);finish('flap',n,(medal?medal.emoji+' '+medal.name+' medal! ':'')+'KONO flew through '+n+' pipe'+(n===1?'':'s')+'.',{title:medal?medal.name+' medal!':n>0?'Nice flying!':'Bonk!',scoreText:n+' pipe'+(n===1?'':'s'),won:n>0})}}/>
  :game==='flow'?<FlowGame key={round} ref={handle} sound={sound} onEnd={r=>{
   // Sprint is about time (its best is kept in the game); the others about points.
   const t=Math.floor(r.time/60000)+':'+(r.time/1000%60).toFixed(2).padStart(5,'0')
   if(r.mode==='sprint')finish('flow',0,r.done?(r.best?'A new best Sprint! ':'')+r.lines+' lines in '+t+'. 🌌':'Sprint stopped at '+r.lines+' of 40 lines.',{title:r.done?'Sprint done!':'Game over',coinScore:r.done?r.score:Math.round(r.score/2),scoreText:r.done?t:r.lines+' lines',won:r.done})
   else finish('flow',r.mode==='marathon'?r.score:0,(r.best?'A new best '+(r.mode==='ultra'?'Ultra':r.mode==='zen'?'Zen':'Marathon')+'! ':'')+r.lines+' line'+(r.lines===1?'':'s')+', level '+r.level+'. 🌌',{title:r.mode==='ultra'?(r.done?'Time’s up!':'Game over'):r.mode==='zen'?'Nice and calm':'Game over',coinScore:r.score,scoreText:r.score.toLocaleString()+' points'})
  }}/>
  :game==='beat'?<Suspense fallback={<p role="status">Loading the songs…</p>}><RhythmGame key={round} ref={handle} onEnd={r=>{
   // Coins follow how well it went, more for harder levels; the best kept is the score.
   const mult=r.level==='jeff'?1.8:r.level==='medium'?1.4:1,lvl=r.level==='jeff'?'Jeff tier':r.level==='medium'?'Medium':'Easy',t=r.tally
   finish('beat',r.failed?0:r.score,r.title+' ('+lvl+'): '+t.perfect+' perfect, '+t.great+' great, '+t.good+' good, '+t.miss+' missed'+(t.early+t.late?' ('+t.early+' early, '+t.late+' late)':'')+'. Best combo '+t.best+'.'+(r.failed?' Clear the gauge to finish the song!':' 🥁'),{title:r.clear==='fail'?'Song failed':r.clear==='all'?'All perfect! 🌟':r.clear==='full'?'Full combo! ✨':'Song clear!',coinScore:Math.round(r.acc/100*(r.failed?10:30)*mult),scoreText:r.score.toLocaleString()+' · '+r.grade,won:!r.failed})
  }}/></Suspense>
  :game==='paper'?<PaperKono key={round} ref={handle} mode={paperMode} sound={sound} onEnd={r=>r.team?finish('paper',0,'Blue '+r.team.blue+'% · Red '+r.team.red+'%'+(r.kills?'. You cut '+r.kills+' trail'+(r.kills===1?'':'s'):'')+'.',{title:r.team.won?'Blue wins! 🏆':r.team.blue===r.team.red?'A tie!':'Red wins this time',coinScore:(r.team.won?25:10)+r.kills*5,scoreText:'Team battle',won:r.team.won}):finish('paper',r.share,'You claimed '+r.share+'% of the map'+(r.kills?' and cut '+r.kills+' trail'+(r.kills===1?'':'s'):'')+'. Rank #'+r.rank+'.',{title:r.rank===1?'Top of the map!':'Nice run!',coinScore:Math.round(r.share+r.kills*5),scoreText:r.share+'%',won:r.share>1})}/>
  :(game==='gems'||game==='candy')&&match?<Match3 key={round} ref={handle} mode={game} level={match.level} start={match} sound={sound} boosters={game==='candy'&&coins?{balance:coins.balance,buy:id=>{const b=BOOSTERS[id];if(coins.balance<b.price)return false;coins.onBuy({key:'booster:'+id,kind:'booster',id,name:b.name,price:b.price,emoji:b.emoji});return true}}:undefined} onEnd={(score,won,stars)=>{
   if(game==='candy'){if(won){saveCandyLevel(match.level+1);saveCandyStars(match.level,stars)};setCandyPick(null);finish('candy',won?match.level:match.level-1,won?'★'.repeat(stars)+'☆'.repeat(3-stars)+' · '+score.toLocaleString()+' points!':'So close! '+score+' points. Try the level again.',{title:won?'Level '+match.level+' complete!':'Out of moves',coinScore:won?score:Math.round(score/2),scoreText:score+' points',won})}
   else finish('gems',score,'One minute of gem swapping!',{title:'Time’s up!'})
  }}/>
  :null
 const kept=readBlastSave()
 return <section className={'break-games'+(arcade?' is-arcade':'')} aria-label={arcade?'Arcade':'Break games with KONO'}>
  {!arcade&&<header><strong>🎮 Break time with KONO</strong><span role="timer" aria-label="Break time left">{over?'Break’s over':'Break: '+clock(left)}</span>{onClose&&<button type="button" onClick={onClose}>Close</button>}</header>}
  {over?<p className="break-over" role="status">That was a nice reset! KONO’s ready for the next session when you are. 📚</p>
  :<>{result&&<p className="break-result" role="status">{result}</p>}<div className="break-game-list">{GAMES.map(g=>{const best=readBest(g.id);return <button type="button" key={g.id} onClick={()=>open(g.id)}><GameCover game={g.id}/><strong>{g.name}</strong><small>{g.id==='blast'&&kept?'Carry on your game ('+kept.score+' points so far)':g.id==='meow'&&meowLevel()>1?'Level '+meowLevel()+' is next':g.id==='candy'&&candyLevelNow()>1?'Level '+candyLevelNow()+' is next':g.how}</small>{best!==null&&<small className="break-best">{g.best(best)}</small>}</button>})}</div></>}
  {game&&!over&&info&&<GameScreen title={info.emoji+' '+info.name} tone="blast" sound={sound} result={ended}
   intro={{emoji:info.emoji,name:info.name,how:info.how,best:readBest(game)!==null?info.best(readBest(game)!):null,...(game==='blast'?{...(kept?{start:'Continue ('+kept.score+' points)',alt:{label:'New game',onClick:()=>begin('blast',true)}}:{}),extra:<BlastFacePicker onChange={setBlastFace}/>}:game==='meow'?{start:'Start level '+meowLevel()}:game==='candy'?{start:'Start level '+(candyPick??candyLevelNow()),extra:<CandyMap pick={candyPick??candyLevelNow()} onPick={setCandyPick}/>}:game==='paper'?{start:'Solo',alt:{label:'Team battle',onClick:()=>{setPaperMode('team');begin('paper')}}}:{})}}
   started={started} onStart={()=>{if(game==='paper')setPaperMode('solo');begin(game)}} onRestart={()=>begin(game,true)} onEnd={()=>handle.current?.end()}
   onAgain={()=>begin(game,true)} onLeave={()=>{setGame(null);setEnded(null);setStarted(false)}}>
   {!arcade&&<p className="game-screen-timer" role="timer">{'Break: '+clock(left)}</p>}
   {playing}
  </GameScreen>}
 </section>
}

/** Candy crush's level map: a winding path of levels, the ones you've beaten with their stars, the next one
 * glowing, and a few locked ahead. Tap any you've reached to play it (replaying keeps your place). */
const ROW=58,X=(n:number)=>[50,72,82,68,46,26,16,30][n%8]
function CandyMap({pick,onPick}:{pick:number;onPick:(n:number)=>void}){
 const now=candyLevelNow(),stars=candyStarsKept(),last=Math.max(now+3,8),levels=Array.from({length:last},(_,i)=>last-i)
 // Opens scrolled to the next level (the newest are at the top, the first at the bottom).
 const list=useRef<HTMLOListElement>(null)
 useEffect(()=>{const el=list.current,next=el?.querySelector<HTMLElement>('.is-next')?.closest('li');if(el&&next)el.scrollTop=next.offsetTop-el.clientHeight/2+next.offsetHeight/2},[])
 return <ol ref={list} className="candy-map" aria-label="Level map">
  {/* The path winding through the levels, behind them. */}
  <svg className="candy-map-path" viewBox={'0 0 100 '+levels.length*ROW} preserveAspectRatio="none" aria-hidden="true" style={{height:levels.length*ROW}}><polyline points={levels.map((n,i)=>X(n)+','+(i*ROW+ROW/2)).join(' ')}/></svg>
  {levels.map(n=>{const open=n<=now,s=stars[n]??0
   return <li key={n} style={{'--x':X(n)+'%'} as React.CSSProperties}>
    <button type="button" disabled={!open} aria-pressed={n===pick} aria-label={'Level '+n+(open?(s?', '+s+' star'+(s===1?'':'s'):n===now?', next':''):', locked')} className={(n===pick?'is-picked ':'')+(n===now?'is-next ':'')+(open?'':'is-locked')} onClick={()=>onPick(n)}>
     <b>{open?n:'🔒'}</b>{open&&n<now&&<small aria-hidden="true">{'★'.repeat(s)+'☆'.repeat(3-s)}</small>}
    </button>
   </li>})}
 </ol>
}
