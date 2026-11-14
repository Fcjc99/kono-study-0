import './break-games.css'
import {lazy,Suspense,useEffect,useRef,useState} from 'react'
import BlockBlast from './BlockBlast'
import GameScreen,{type GameHandle,type GameResult} from './GameScreen'
import Meowdoku from './Meowdoku'
import Match3 from './Match3'
import FlowGame from './FlowGame'
import FlappyKono from './FlappyKono'
import PaperKono from './PaperKono'
import KonoStack from './KonoStack'
import {LADDER} from '../store/bloom'
// KONO Beat brings its charts (every song, three levels): loaded when it's opened.
const RhythmGame=lazy(()=>import('./RhythmGame'))
import BeatSummary from './BeatSummary'
// KONO Medal Cove is 3D (three.js): loaded when it's opened, or quietly ahead of time while the arcade is
// open (prefetchCove), so tapping it doesn't wait on the download.
const loadCove=()=>import('./MedalCoveGame')
const MedalCove=lazy(loadCove)
// KONO Teeter Tower brings its physics engine (matter-js) only when it's opened.
const KonoTeeter=lazy(()=>import('./KonoTeeter'))
const KonoBloom=lazy(()=>import('./KonoBloom'))
const TeeterModes=lazy(()=>import('./TeeterModes'))
const TeeterBoard=lazy(()=>import('./TeeterModes').then(m=>({default:m.TeeterBoard})))
let coveFetched=false
/** The arcade is open: a few seconds later, when the device is idle, fetch Medal Cove's 3D machine in the
 * background, unless the person has asked to save data or is on a slow connection. */
function prefetchCove(){
 if(coveFetched)return ()=>undefined
 const net=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection
 if(net?.saveData||/(^|-)2g$/.test(net?.effectiveType??''))return ()=>undefined
 const go=()=>{if(coveFetched)return;coveFetched=true;void loadCove().catch(()=>{coveFetched=false})}
 const idle=(window as Window&{requestIdleCallback?:(f:()=>void,o?:{timeout:number})=>number}).requestIdleCallback
 const t=window.setTimeout(()=>idle?idle(go,{timeout:4000}):go(),3000)
 return ()=>window.clearTimeout(t)
}
import {flapMedal} from '../store/flappy'
import {readBlastFace} from '../store/blastFace'
import BlastFacePicker from './BlastFacePicker'
import GameCover from './GameCovers'
import {deal,readBlastSave,writeBlastSave,type BlastSave,type Piece} from '../store/blockBlast'
import {meowLevel,newMeowPuzzle,type Puzzle} from '../store/meowdoku'
import {chosenSkin,dailyBest,dailySeed,puzzleLevel,saveDailyBest,saveSkin,saveTeeterLevel,skinItem,teeterLevel,teeterControl,saveTeeterControl,type TeeterControl,type SkinId,type TeeterHub,type TeeterMode} from '../store/teeter'
import type {TeeterPick} from './TeeterModes'
import {BOOSTERS,candyLevelNow,candyStarsKept,freshBoard,jellyFor,maker,saveCandyLevel,saveCandyStars,type Board,type Maker} from '../store/match3'
import type {ShopItem} from '../store/konoCoins'

/** KONO Town's arcade: KONO blast (the block puzzle), KONO Stack (build a tower), KONO Bloom (drop and grow), KONO Medal Cove (a medal pusher), Meowdoku (the cat puzzle), Gem blitz and Sweet swap
 * (match-3), KONO Flow (falling blocks), KONO Beat (the songs as a rhythm game), KONO Hop and KONO.io (claim the map, after Paper.io 2). Every
 * game plays full screen in KONO blast's look, and `onScore` can turn a score into coins (it returns what to
 * add to the result line). The same games are the break games offered when a focus session finishes
 * ("Take a short break"): the break lasts five minutes, and when it's over the games stop and KONO says it's
 * time for the next session. Best scores are kept on this device only. Loaded only when opened, so it never
 * adds to the app's startup. */
type Game='blast'|'meow'|'gems'|'candy'|'flap'|'paper'|'flow'|'beat'|'stack'|'teeter'|'bloom'|'cove'
export const BREAK_MINUTES=5
const GAMES:{id:Game;emoji:string;name:string;how:string;best:(n:number)=>string}[]=[
 {id:'blast',emoji:'🧱',name:'KONO blast',how:'Fit the pieces on the board; fill a row or column to clear it.',best:n=>'Best: '+n+' points'},
 {id:'meow',emoji:'🐱',name:'Meowdoku',how:'One cat in every row, column and color, and no two cats touching.',best:n=>'Best: level '+n},
 {id:'gems',emoji:'💎',name:'Gem blitz',how:'Swap gems to match 3 or more. One minute, as many points as you can!',best:n=>'Best: '+n+' points'},
 {id:'candy',emoji:'🍬',name:'Sweet swap',how:'Match candies to reach each level’s target in the moves you have.',best:n=>'Best: level '+n},
 {id:'flow',emoji:'🌌',name:'KONO Flow',how:'Turn and drop the falling shapes to fill rows of light. Fill the Flow meter to stop time and clear them all at once!',best:n=>'Best: '+n.toLocaleString()+' points'},
 {id:'beat',emoji:'🥁',name:'KONO Beat',how:'Tap the tiles as they reach the line, in time with the tune. Easy, Medium or Jeff tier!',best:n=>'Best: '+n.toLocaleString()},
 {id:'stack',emoji:'🏢',name:'KONO Stack',how:'Tap to set each sliding floor on KONO’s tower. Line them up: whatever hangs over breaks off.',best:n=>'Best: '+n+' floor'+(n===1?'':'s')},
 {id:'teeter',emoji:'🗼',name:'KONO Teeter Tower',how:'Stack blocks on a tiny floating island with real physics, and keep the tower standing. Classic, today’s tower, puzzles, a race or Cat drop.',best:n=>'Best: '+n+' row'+(n===1?'':'s')+' high'},
 {id:'cove',emoji:'🪙',name:'KONO Medal Cove',how:'Drop medals down KONO’s pin board and push the pile off the dock. Light all 5 lamps for the BIG BONUS and chase the JACKPOT!',best:n=>'Best: '+n+' medals'},
 {id:'bloom',emoji:'🌸',name:'KONO Bloom',how:'Drop fruit into KONO’s jar: two the same grow into the next one, all the way to the Rainbow Fruit. Stay under the dashed line!',best:n=>'Best: '+n.toLocaleString()+' points'},
 {id:'flap',emoji:'🐤',name:'KONO Hop',how:'Tap to hop KONO through the gaps in the pipes.',best:n=>'Best: '+n+' pipe'+(n===1?'':'s')},
 {id:'paper',emoji:'🟦',name:'KONO.io',how:'Leave your land, loop around and come home to claim it. Don’t let anyone cut your trail! Solo, or Blue against Red.',best:n=>'Best: '+n+'% of the map'},
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
export default function BreakGames({startedAt,onClose,arcade=false,sound=false,onScore,onBlastCoins,coins,teeter}:{startedAt:number;onClose?:()=>void;arcade?:boolean;sound?:boolean;onScore?:(game:Game,score:number)=>string|null;onBlastCoins?:(lines:number,streak:number)=>number|null;coins?:{balance:number;onBuy:(item:ShopItem)=>void};teeter?:TeeterHub}){
 const [game,setGame]=useState<Game|null>(null),[pieces,setPieces]=useState<Piece[]>([]),[blastSave,setBlastSave]=useState<BlastSave|null>(null)
 const [meow,setMeow]=useState<{level:number;puzzle:Puzzle}|null>(null),[match,setMatch]=useState<{maker:Maker;board:Board;level:number;jelly?:Set<number>}|null>(null)
 const [paperMode,setPaperMode]=useState<'solo'|'team'>('solo')
 // KONO Teeter Tower: the classic climb, today's tower or the next puzzle level.
 const [teeterPick,setTeeterPick]=useState<TeeterPick>('classic')
 // Block skins: owned ones (from the family plan) and the one picked on this device.
 const [teeterSkin,setTeeterSkin]=useState<SkinId>(()=>chosenSkin(teeter?.skins??new Set<SkinId>(['pastel'])))
 const pickSkin=(id:SkinId)=>{saveSkin(id);setTeeterSkin(id)}
 // Falling (Tricky Towers style) or Hold & drop (Cat Stack style), remembered on this device.
 const [teeterCtl,setTeeterCtl]=useState<TeeterControl>(teeterControl)
 const pickControl=(c:TeeterControl)=>{saveTeeterControl(c);setTeeterCtl(c)}
 const buySkin=(id:SkinId)=>{const item=skinItem(id);if(!coins||coins.balance<item.price)return;coins.onBuy(item);pickSkin(id)}
 const teeterMode:TeeterMode=teeterPick==='cats'?{kind:'cats'}:teeterPick==='race'?{kind:'race'}:teeterPick==='daily'?{kind:'daily',seed:dailySeed()}:teeterPick==='puzzle'?{kind:'puzzle',level:teeterLevel()}:{kind:'classic'}
 // KONO blast's face blocks (a photo kept on this device), set on its start card.
 const [blastFace,setBlastFace]=useState(()=>readBlastFace())
 // The Sweet swap level picked on the map (the next one to beat, unless you pick one you've played).
 const [candyPick,setCandyPick]=useState<number|null>(null)
 const [ended,setEnded]=useState<GameResult|null>(null),[round,setRound]=useState(0),[started,setStarted]=useState(false)
 useEffect(()=>arcade?prefetchCove():undefined,[arcade])
 const handle=useRef<GameHandle>(null)
 const [now,setNow]=useState(startedAt)
 const [result,setResult]=useState<string|null>(null)
 useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(t)},[])
 const left=startedAt+BREAK_MINUTES*60_000-now,over=!arcade&&left<=0
 // A finished round: its results card (in the game's screen), the best kept, and coins for it.
 // `coinScore` is what earns coins when it isn't the score kept as a best (Sweet swap keeps the level).
 const finish=(g:Game,score:number,line:string,{title='Nice game!',coinScore=score,scoreText,won=true,behind=false,detail}:{title?:string;coinScore?:number;scoreText?:string;won?:boolean;behind?:boolean;detail?:React.ReactNode}={})=>{
  const best=score>0&&saveBest(g,score),extra=g==='blast'?null:onScore?.(g,coinScore),info=GAMES.find(x=>x.id===g)!
  setResult(line+(best?' New best! 🎉':'')+(extra?' '+extra:''))
  setEnded({emoji:info.emoji,title,line,score:scoreText??info.best(score).replace(/^Best: /,''),best:Boolean(best),coins:extra,won,behind,detail})
 }
 // Opening a game shows its start card; Start (and Restart, and Play again) begins a round: a fresh board
 // (KONO blast carries on a saved game unless `fresh`; Meowdoku and Sweet swap pick up at your level).
 const open=(g:Game)=>{setResult(null);setEnded(null);setStarted(false);setGame(g)}
 const begin=(g:Game,fresh=false)=>{
  setEnded(null);setRound(n=>n+1);setStarted(true)
  if(g==='blast'){if(fresh)writeBlastSave(null);setPieces(deal(Math.random));setBlastSave(fresh?null:readBlastSave())}
  if(g==='meow'){const level=meowLevel();setMeow({level,puzzle:newMeowPuzzle(level)})}
  if(g==='gems'||g==='candy'){const mk=maker(g,Math.random),level=g==='candy'?candyPick??candyLevelNow():1;setMatch({maker:mk,board:freshBoard(mk),level,jelly:g==='candy'?jellyFor(level,Math.random):undefined})}
  setGame(g)
 }
 // The 3D machine couldn't start (no WebGL, say) and the player chose Leave: no score and no coins.
 const failed=(g:Game)=>()=>finish(g,0,'The 3D medal machine couldn’t start on this device or browser.',{title:'Machine unavailable',coinScore:0,scoreText:'—',won:false})
 const info=GAMES.find(g=>g.id===game)
 const playing=over?null:game==='blast'?<BlockBlast key={round} ref={handle} face={blastFace} start={pieces} saved={blastSave} best={readBest('blast')} sound={sound} onCoins={onBlastCoins} onEnd={n=>finish('blast',n,'KONO blast: '+n+' point'+(n===1?'':'s')+'! 🧱')}/>
 :game==='meow'&&meow?<Meowdoku key={round} ref={handle} level={meow.level} puzzle={meow.puzzle} sound={sound} onEnd={(level,seconds,solved,extra)=>solved?finish('meow',level,'Solved in '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+(extra?.best?' — a new best for '+meow.puzzle.n+' × '+meow.puzzle.n+'!':'.')+(extra?.hints?' ('+extra.hints+' hint'+(extra.hints===1?'':'s')+')':'')+' Next up: level '+(level+1)+'.',{title:'Purr-fect!',coinScore:meow.puzzle.n,scoreText:'Level '+level}):finish('meow',0,(extra?.lives===0?'Three wrong cats. ':'')+'This one stays at level '+level+'. Play again for a new puzzle.',{title:extra?.lives===0?'Out of hearts 💔':'Puzzle skipped',coinScore:0,scoreText:'Level '+level,won:false})}/>
  :game==='flap'?<FlappyKono key={round} ref={handle} best={readBest('flap')} sound={sound} onEnd={n=>{const medal=flapMedal(n);finish('flap',n,(medal?medal.emoji+' '+medal.name+' medal! ':'')+'KONO flew through '+n+' pipe'+(n===1?'':'s')+'.',{title:medal?medal.name+' medal!':n>0?'Nice flying!':'Bonk!',scoreText:n+' pipe'+(n===1?'':'s'),won:n>0})}}/>
  :game==='stack'?<KonoStack key={round} ref={handle} best={readBest('stack')} sound={sound} onEnd={(n,perfects)=>finish('stack',n,'KONO’s tower is '+n+' floor'+(n===1?'':'s')+' tall'+(perfects?', with '+perfects+' Perfect'+(perfects===1?'':'s'):'')+'. 🏢',{title:n>=50?'Sky-high!':n>=20?'What a tower!':n>0?'Nice building!':'Missed the base',coinScore:n,scoreText:n+' floor'+(n===1?'':'s'),won:n>0,behind:true})}/>
  :game==='teeter'?<Suspense fallback={<p role="status">Building the island…</p>}><KonoTeeter key={round} ref={handle} best={readBest('teeter')} sound={sound} mode={teeterMode} skin={teeterSkin} control={teeterCtl} onEnd={r=>{
   const shot=r.snapshot&&r.blocks>0?<img className="teeter-shot" src={r.snapshot} alt={'Your tower, '+r.height+' row'+(r.height===1?'':'s')+' high'}/>:undefined
   const perf=r.perfects?' '+r.perfects+' Perfect'+(r.perfects===1?'':'s')+'!':'',rows=(n:number)=>n+' row'+(n===1?'':'s')
   if(teeterMode.kind==='puzzle'){const lv=teeterMode.level,g=puzzleLevel(lv);if(r.won)saveTeeterLevel(lv+1)
    finish('teeter',r.height,r.won?'You reached the flag at row '+g.goal+' with '+r.blocks+' block'+(r.blocks===1?'':'s')+'.'+perf+' Level '+(lv+1)+' is next. 🚩':'The flag was at row '+g.goal+' and your tower reached '+rows(r.height)+'. Try the level again!',{title:r.won?'Level '+lv+' complete!':'So close!',coinScore:r.won?g.goal+lv:Math.floor(r.height/2),scoreText:'Level '+lv,won:r.won,detail:shot});return}
   if(teeterMode.kind==='cats'){const ft=r.height+(r.height===1?' foot':' feet');finish('teeter',r.height,'Your cat tower stood '+ft+' high, from '+r.blocks+' cat'+(r.blocks===1?'':'s')+'. 🐱',{title:r.height>=30?'Cats in the stars!':r.height>=15?'Purr-fect tower!':r.height>=5?'Meow-velous!':'Cat-astrophe!',coinScore:r.height+Math.floor(r.perfects/2),scoreText:ft,won:r.height>0,detail:r.snapshot&&r.blocks>0?<img className="teeter-shot" src={r.snapshot} alt={'Your cat tower, '+ft+' high'}/>:undefined});return}
   if(teeterMode.kind==='race'){finish('teeter',r.height,r.won?'You reached the finish line before Rival KONO, from '+r.blocks+' block'+(r.blocks===1?'':'s')+'.'+perf+' 🏁':'Rival KONO got to the finish first; your tower reached '+rows(r.height)+'. Have another go!',{title:r.won?'You beat Rival KONO!':'Rival KONO won this time',coinScore:r.won?r.height+10:Math.floor(r.height/2),scoreText:rows(r.height),won:r.won,detail:shot});return}
   if(teeterMode.kind==='daily'){const better=saveDailyBest(r.height,teeterMode.seed)
    // On the family board: your best today (it replaces your earlier one only if it's higher).
    let board=teeter?.board
    if(teeter&&r.blocks>0){teeter.onDaily(teeterMode.seed,r.height);const mine=board?.find(b=>b.me);board=[...(board??[]).filter(b=>!b.me),{...(mine??{name:'You'}),me:true,height:Math.max(mine?.height??0,r.height)}].sort((a,b)=>b.height-a.height)}
    finish('teeter',r.height,'Today’s tower stood '+rows(r.height)+' high'+(better?', your best today!':' (your best today: '+dailyBest(teeterMode.seed)+').')+perf+' 📅',{title:better&&r.height>0?'Today’s best!':r.height>=10?'What a tower!':'Timber!',coinScore:r.height+Math.floor(r.perfects/2),scoreText:rows(r.height),won:r.height>0,detail:<>{shot}{board&&<Suspense fallback={null}><TeeterBoard rows={board}/></Suspense>}</>});return}
   finish('teeter',r.height,'KONO’s tower stood '+rows(r.height)+' high, from '+r.blocks+' block'+(r.blocks===1?'':'s')+'.'+perf+' 🗼',{title:r.height>=30?'Starry heights!':r.height>=20?'Sky high!':r.height>=10?'What a tower!':'Timber!',coinScore:r.height+Math.floor(r.perfects/2),won:r.height>0,detail:shot})
  }}/></Suspense>
  :game==='cove'?<Suspense fallback={<p role="status">Setting up the cove…</p>}><MedalCove key={round} onFail={failed('cove')} ref={handle} best={readBest('cove')} sound={sound} onEnd={(n,jps,practice)=>practice?finish('cove',0,'A practice round (with sample medals): '+n+' medals in hand. Practice rounds don’t earn coins or set a best. 🪙',{title:'Practice round',coinScore:0,scoreText:n+' practice medals',won:true}):finish('cove',n,(jps?'🎉 '+jps+' jackpot'+(jps===1?'':'s')+'! ':'')+'You finished with '+n+' medal'+(n===1?'':'s')+'. 🪙',{title:jps?'JACKPOT!':n>=100?'Big haul!':n>0?'Nice pushing!':'All pushed out',scoreText:n+' medals',won:n>0})}/></Suspense>
  :game==='bloom'?<Suspense fallback={<p role="status">Filling the jar…</p>}><KonoBloom key={round} ref={handle} best={readBest('bloom')} sound={sound} onEnd={(n,biggest)=>finish('bloom',n,'You grew up to '+LADDER[biggest].emoji+' '+LADDER[biggest].name+'. 🍓',{title:biggest>=10?'A Rainbow Fruit!':biggest>=7?'What a fruit bowl!':'Juicy!',scoreText:n.toLocaleString()+' points',won:n>0})}/></Suspense>
  :game==='flow'?<FlowGame key={round} ref={handle} sound={sound} onEnd={r=>{
   // Sprint is about time (its best is kept in the game); the others about points.
   const t=Math.floor(r.time/60000)+':'+(r.time/1000%60).toFixed(2).padStart(5,'0')
   if(r.mode==='sprint')finish('flow',0,r.done?(r.best?'A new best Sprint! ':'')+r.lines+' lines in '+t+'. 🌌':'Sprint stopped at '+r.lines+' of 40 lines.',{title:r.done?'Sprint done!':'Game over',coinScore:r.done?r.score:Math.round(r.score/2),scoreText:r.done?t:r.lines+' lines',won:r.done})
   else finish('flow',r.mode==='marathon'?r.score:0,(r.best?'A new best '+(r.mode==='ultra'?'Ultra':r.mode==='zen'?'Zen':'Marathon')+'! ':'')+r.lines+' line'+(r.lines===1?'':'s')+', level '+r.level+'. 🌌',{title:r.mode==='ultra'?(r.done?'Time’s up!':'Game over'):r.mode==='zen'?'Nice and calm':'Game over',coinScore:r.score,scoreText:r.score.toLocaleString()+' points'})
  }}/>
  :game==='beat'?<Suspense fallback={<p role="status">Loading the songs…</p>}><RhythmGame key={round} ref={handle} onEnd={r=>{
   // Coins follow how well it went, more for harder levels; the best kept is the score.
   const mult=r.level==='jeff'?1.8:r.level==='medium'?1.4:1,lvl=r.level==='jeff'?'Jeff tier':r.level==='medium'?'Medium':'Easy',t=r.tally
   if(r.warmup){finish('beat',0,r.title+' warm-up: '+t.perfect+' perfect, '+t.great+' great, '+t.good+' good, '+t.miss+' missed'+(t.early+t.late?' ('+t.early+' early, '+t.late+' late)':'')+'. Warm-ups don’t count; play the whole song when you’re ready.',{title:'Warm-up done',coinScore:0,scoreText:r.score.toLocaleString(),won:true,detail:<BeatSummary r={r}/>});return}
   finish('beat',r.failed?0:r.score,r.title+' ('+lvl+'): '+t.perfect+' perfect, '+t.great+' great, '+t.good+' good, '+t.miss+' missed'+(t.early+t.late?' ('+t.early+' early, '+t.late+' late)':'')+'. Best combo '+t.best+'.'+(r.failed?(r.classic?' Classic: stopped at tile '+r.tiles+' of '+r.of+'.':' Clear the gauge to finish the song!'):' 🥁'),{title:r.clear==='fail'?(r.classic?'Classic: '+r.tiles+' tiles':'Song failed'):r.clear==='all'?'All perfect! 🌟':r.clear==='full'?'Full combo! ✨':'Song clear!',coinScore:Math.round(r.acc/100*(r.failed?10:30)*mult),scoreText:r.score.toLocaleString(),won:!r.failed,detail:<BeatSummary r={r}/>})
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
  {game&&!over&&info&&<GameScreen title={info.emoji+' '+info.name} tone="blast" game={game} sound={sound} result={ended}
   intro={{emoji:info.emoji,art:<GameCover game={game}/>,name:info.name,how:info.how,best:readBest(game)!==null?info.best(readBest(game)!):null,...(game==='blast'?{...(kept?{start:'Continue ('+kept.score+' points)',alt:{label:'New game',onClick:()=>begin('blast',true)}}:{}),extra:<BlastFacePicker onChange={setBlastFace}/>}:game==='meow'?{start:'Start level '+meowLevel()}:game==='candy'?{start:'Start level '+(candyPick??candyLevelNow()),extra:<CandyMap pick={candyPick??candyLevelNow()} onPick={setCandyPick}/>}:game==='teeter'?{start:teeterPick==='cats'?'Start Cat drop':teeterPick==='race'?'Start the race':teeterPick==='daily'?'Play today’s tower':teeterPick==='puzzle'?'Start level '+teeterLevel():'Start',extra:<Suspense fallback={null}><TeeterModes pick={teeterPick} onPick={setTeeterPick} control={teeterCtl} onControl={pickControl} board={teeter?.board} skins={{owned:teeter?.skins??new Set<SkinId>(['pastel']),chosen:teeterSkin,onChoose:pickSkin,balance:coins?.balance,onBuy:teeter&&coins?buySkin:undefined}}/></Suspense>}:game==='paper'?{start:'Solo',alt:{label:'Team battle',onClick:()=>{setPaperMode('team');begin('paper')}}}:{})}}
   started={started} onStart={()=>{if(game==='paper')setPaperMode('solo');begin(game)}} onRestart={()=>begin(game,true)} onEnd={()=>handle.current?.end()}
   onAgain={()=>begin(game,true)} onLeave={()=>{setGame(null);setEnded(null);setStarted(false)}}>
   {!arcade&&<p className="game-screen-timer" role="timer">{'Break: '+clock(left)}</p>}
   {playing}
  </GameScreen>}
 </section>
}

/** Sweet swap's level map: a winding path of levels, the ones you've beaten with their stars, the next one
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
