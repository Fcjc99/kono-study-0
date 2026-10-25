import {useEffect,useId,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {BOOSTERS,W,adjacent,candyLevel,candyStars,type Board,type Effect,type Maker,type Piece,type Special,type BoosterId} from '../store/match3'
import {BEAM_MS,BOMB_CHARGE_MS,CHARGE_MS,COMBO_MS,SWAP_MS,blowAll,hintFor,live,settled,smash,specialsLeft,step,trySwap,view,type Ev,type Live,type Look} from '../store/match3live'
import {gameSound} from '../konoSounds'
import {fx as play3,musicLift,startMusic,stopMusic} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'
import {ArtDefs,PieceArt} from './Match3Art'
import Sparks,{type SparksHandle} from './Sparks'

/** Candy crush and Gem blitz (the rules are in store/match3), drawn and animated after the games they follow.
 * The board plays in real time (store/match3live), drawn every frame: swaps slide, matched gems shrink away
 * and matched candies burst into pieces (sliding together first into a special they make), a striped candy's
 * or star gem's beam runs out along its row or column taking pieces as it goes, wrapped candies and flame
 * gems explode with a shockwave, a color bomb's or hypercube's lightning strikes its pieces one by one, and
 * big moments shake the board. Gem blitz lets you keep swapping while the rest of the board explodes and
 * falls; Candy crush waits for it to settle. Swipe a piece toward a neighbor (or tap one, then the other).
 * Stand still a few seconds and a move wiggles as a hint.
 * - Candy crush: the six classic candies on a light board. Each level has a target and a number of moves
 *   (even levels have jelly to clear too), with 1–3 stars. Cascades get "Sweet!", "Tasty!", "Delicious!",
 *   "Divine!". Win with moves left and they turn into striped candies that all go off: Sugar crush!
 * - Gem blitz: seven faceted gems on a dark board, one minute. Some gems carry +5 seconds, big cascades drop
 *   in ×2 … ×8 multipliers, quick moves in a row earn a Speed bonus (200, climbing to 1,000) and fill the
 *   Ignition meter; full, it lights Blazing speed for eight seconds (the board burns and every match explodes
 *   like a flame gem). A hypercube darkens the board so only the gems it takes stay lit. When
 *   time's up every special left goes off in a Last hurrah.
 * Both have their own soundtrack (arcadeAudio) and sound effects (a whoosh for a swap, chimes that climb
 * down a cascade, lasers, explosions, lightning, fire), sparks and shards flying from every clear
 * (Sparks), and their own scenery: a candy sky with drifting clouds, or a starry nebula. */
const SPARK_GEMS=['#ff5468','#ff9a2e','#ffe03d','#3fe07a','#3d9bff','#c14dff','#eef3fb'],SPARK_CANDY=['#ff2e48','#ff8a14','#ffd60a','#2fd14a','#1f8bff','#a83ae8']
const BLITZ_MS=60_000,SPEEDY_MS=1700,IGNITE=9,BLAZE_MS=8000
const CANDY_CHEERS=['','','Sweet!','Tasty!','Delicious!','Divine!']
/** What a special shouts as it goes off, right where it is (so you can tell what just happened). */
function calloutFor(mode:'gems'|'candy',type:Effect['type'],combo:boolean,size:number){
 if(mode==='candy')return type==='row'||type==='col'?'Striped!':type==='cross'?(combo?'Double stripes!':'Striped!'):type==='nova'?'Giant stripes!':type==='area'?(size>9?'Mega wrap!':'Wrapped!'):type==='color'?(combo?'Rainbow blast!':'Color bomb!'):''
 return type==='area'?(size>9?'Inferno!':'Flame!'):type==='cross'?'Star!':type==='nova'?'Supernova!':type==='color'?'Hypercube!':type==='row'||type==='col'?'Lightning!':''
}
const GEM_CHEERS=['','','Good!','Excellent!','Awesome!','Spectacular!','Extraordinary!','Unbelievable!']
type Fx={key:number;e:Effect;delays:number[];combo?:boolean}
type Frag={key:number;at:number;kind:number;special?:Special}
type Pop={key:number;x:number;y:number;n:number;kind?:number;each?:boolean;size?:'big'|'huge'}
/** Something flying across the board, in px from its top left: points to the score, or a move left (a star)
 * from the moves counter to the candy it turns striped. */
type Flight={key:number;x0:number;y0:number;x1:number;y1:number;text:string;kind:'pts'|'star';ms:number}
/** A tiny buzz on a phone that has one (a tick for a pick, a thump for a special). */
function buzz(pattern:number|number[]){try{navigator.vibrate?.(pattern)}catch{/* not allowed */}}
const FLY_MS=650,STAR_MS=420,FINALE_GAP=260
/** How the round is going: the opening drop, play, the finale (Sugar crush or Last hurrah, and the wait
 * before it), over. */
type Phase='intro'|'play'|'wait'|'finale'|'done'
export default function Match3({ref,mode,level,start,sound,onEnd,boosters}:{ref:Ref<GameHandle>;mode:'gems'|'candy';level:number;start:{maker:Maker;board:Board;jelly?:Set<number>};sound:boolean;onEnd:(score:number,won:boolean,stars:number)=>void;boosters?:{balance:number;buy:(id:BoosterId)=>boolean}}){
 // Candy crush's boosters: one armed (tapped, waiting to be used), and whether the move under way was a
 // booster's (it doesn't count as one of the level's moves).
 const [armed,setArmed]=useState<BoosterId|null>(null),freeMove=useRef(false)
 const goal=candyLevel(level)
 const [rt0]=useState(()=>live(start.maker,start.board)),eng=useRef<Live>(rt0)
 const [looks,setLooks]=useState<Look[]>(()=>view(rt0)),[intro,setIntro]=useState(true)
 const [jelly,setJelly]=useState<Set<number>>(()=>new Set(start.jelly??[]))
 const [hop,setHop]=useState<{id:number;kind:'hop'|'wiggle'|'blink'|'shine'}|null>(null)
 const [nope,setNope]=useState<number[]>([]),[shiver,setShiver]=useState<Set<number>>(()=>new Set()),[heat,setHeat]=useState(0),[flights,setFlights]=useState<Flight[]>([]),[bump,setBump]=useState(0)
 const movesRef=useRef<HTMLSpanElement>(null),scoreEl=useRef<HTMLElement>(null),lastSwap=useRef<[number,number]|null>(null)
 const [sel,setSel]=useState<number|null>(null),[hint,setHint]=useState<[number,number]|null>(null)
 const [score,setScore]=useState(0),[moves,setMoves]=useState(goal.moves),[left,setLeft]=useState(BLITZ_MS),[mult,setMult]=useState(1),[speed,setSpeed]=useState(0),[blazing,setBlazing]=useState(false)
 const [fx,setFx]=useState<Fx[]>([]),[frags,setFrags]=useState<Frag[]>([]),[pops,setPops]=useState<Pop[]>([])
 const [callouts,setCallouts]=useState<{key:number;x:number;y:number;text:string;type:string}[]>([]),[spot,setSpot]=useState<{key:number;x:number;y:number;ms:number}|null>(null),[punch,setPunch]=useState(0)
 const [cheer,setCheer]=useState<{key:number;text:string;big?:boolean}|null>(null),[done,setDone]=useState<string|null>(null),[quake,setQuake]=useState(0)
 const sparks=useRef<SparksHandle>(null),boardRef=useRef<HTMLDivElement>(null),scoreRef=useRef(0),ended=useRef(false),keys=useRef(0),movesLeft=useRef(goal.moves)
 const jellyNow=useRef(new Set(start.jelly??[])),multNow=useRef(1),extraMs=useRef(0),lastMove=useRef(0),speedNow=useRef(0),idleAt=useRef(0)
 const phase=useRef<Phase>('intro'),timeUp=useRef(false),moved=useRef(false),rounds=useRef(0),finaleText=useRef(''),cheered=useRef(0)
 const press=useRef<{at:number;x:number;y:number;moved:boolean}|null>(null)
 const onEndRef=useRef(onEnd),onEvent=useRef<(e:Ev)=>void>(()=>{}),onCalm=useRef(()=>{})
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 // The board runs every frame: it moves on, says what happened (sounds, sparks, points), and is drawn.
 useEffect(()=>{
  let raf=0,last=performance.now(),drew=true
  const loop=(now:number)=>{
   const rt=eng.current,moving=step(rt,Math.min(40,Math.max(0,now-last)))
   last=now
   for(const e of rt.events.splice(0))onEvent.current(e)
   if(moving||drew)setLooks(view(rt))
   drew=moving
   if(settled(rt))onCalm.current()
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>cancelAnimationFrame(raf)
 },[])
 // The soundtrack plays for the round.
 useEffect(()=>{startMusic(mode,sound);return ()=>stopMusic()},[mode,sound])
 const stars=()=>candyStars(scoreRef.current,goal.target)
 const finish=(won:boolean,text:string)=>{if(ended.current)return;ended.current=true;phase.current='done';setDone(text);stopMusic();if(won)sparks.current?.burst(0.5,0.4,{kind:'confetti',n:90,speed:2.2,size:9});window.setTimeout(()=>onEndRef.current(scoreRef.current,won,mode==='candy'?(won?Math.max(1,stars()):0):0),1500)}
 // Cheers ring a little chime (not the +5 seconds and Speed notes).
 const say=(text:string,big=false)=>{const key=++keys.current;setCheer({key,text,big});if(!/^(\+|×|Speed )/.test(text))play3('star',sound);window.setTimeout(()=>setCheer(c=>c?.key===key?null:c),1200)}
 // Gem blitz's minute (and its +5 second gems); when it's up, the board settles, then the Last hurrah.
 useEffect(()=>{
  if(mode!=='gems')return
  const startAt=performance.now();let lastTick=0
  const t=window.setInterval(()=>{
   const rest=BLITZ_MS+extraMs.current-(performance.now()-startAt);setLeft(Math.max(0,rest))
   // The last five seconds tick.
   const sec=Math.ceil(rest/1000);if(sec<=5&&sec>0&&sec!==lastTick){lastTick=sec;play3('tick',sound)}
   if(rest<=0&&!timeUp.current&&!ended.current){timeUp.current=true;window.clearInterval(t);play3('timeup',sound)}
  },200)
  return ()=>window.clearInterval(t)
 },[mode]) // eslint-disable-line react-hooks/exhaustive-deps
 // ■ End: finish now (Candy crush counts it as won only if the level's goal is already met).
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;const won=mode==='gems'||(scoreRef.current>=goal.target&&!jellyNow.current.size);onEndRef.current(scoreRef.current,won,mode==='candy'&&won?Math.max(1,stars()):0)}}),[mode,goal.target]) // eslint-disable-line react-hooks/exhaustive-deps
 const centre=(at:number):[number,number]=>[(at%W+0.5)/W,(Math.floor(at/W)+0.5)/W]
 const later=<T,>(set:React.Dispatch<React.SetStateAction<T[]>>,item:T&{key:number},ms:number,cap=40)=>{set(list=>[...list.slice(-cap),item]);window.setTimeout(()=>set(list=>list.filter(x=>(x as {key:number}).key!==item.key)),ms)}
 const addScore=(n:number)=>{scoreRef.current+=n;setScore(scoreRef.current)}
 // Board-relative px of a point on the board (shares of it) or of an element's middle.
 const boardBox=()=>boardRef.current?.getBoundingClientRect()
 const elMid=(el:Element|null)=>{const b=boardBox(),r=el?.getBoundingClientRect();return b&&r?[r.left+r.width/2-b.left,r.top+r.height/2-b.top]:null}
 const fly=(f:Omit<Flight,'key'>)=>later(setFlights,{key:++keys.current,...f},f.ms+80,12)
 // Points fly up to the score, and the score bumps as they land.
 const flyPoints=(x:number,y:number,n:number)=>{
  const b=boardBox(),to=elMid(scoreEl.current);if(!b||!to)return
  fly({x0:x*b.width,y0:y*b.height,x1:to[0],y1:to[1],text:'+'+n.toLocaleString(),kind:'pts',ms:FLY_MS})
  window.setTimeout(()=>{const k=++keys.current;setBump(k);window.setTimeout(()=>setBump(v=>v===k?0:v),300)},FLY_MS)
 }
 const popSize=(n:number)=>n>=(mode==='candy'?300:5000)?'huge' as const:n>=(mode==='candy'?120:1500)?'big' as const:undefined
 const shake=()=>{const key=++keys.current;setQuake(key);window.setTimeout(()=>setQuake(q=>q===key?0:q),420)}
 // What the board says happened.
 const handle=(e:Ev)=>{
  const sp=sparks.current,colors=mode==='gems'?SPARK_GEMS:SPARK_CANDY
  if(e.t==='match'){
   play3('match',sound,e.level-1)
   const pts=e.points*(mode==='gems'?multNow.current:1);addScore(pts)
   // Gem blitz shows one gold total for the match (Candy crush shows each candy's points as it bursts).
   if(mode==='gems'){const xs=e.cells.map(c=>c%W+0.5),ys=e.cells.map(c=>Math.floor(c/W)+0.5);later(setPops,{key:++keys.current,x:xs.reduce((a,b)=>a+b,0)/xs.length,y:ys.reduce((a,b)=>a+b,0)/ys.length,n:pts,size:popSize(pts)},900)}
   // A combo stack: each step of a cascade warms the scenery and lifts the music a little.
   if(e.level>=2){setHeat(h=>Math.max(h,Math.min(5,e.level-1)));musicLift(e.level-1)}
   // Four or more: the pieces about to become a special shiver as they gather.
   if(e.cells.length>=4){const k=new Set(e.cells);setShiver(k);window.setTimeout(()=>setShiver(c=>c===k?new Set():c),300)}
   if(e.level>=2&&e.level>cheered.current){cheered.current=e.level;const list=mode==='candy'?CANDY_CHEERS:GEM_CHEERS;say(list[Math.min(e.level,list.length-1)])}
   if(e.level>=3)gameSound('big',sound,e.level-3)
  }else if(e.t==='clear'){
   const [x,y]=centre(e.at),col=colors[e.kind]??'#fff'
   // Jelly under a cleared square is gone.
   if(jellyNow.current.delete(e.at)){setJelly(new Set(jellyNow.current));play3('squish',sound)}
   if(mode==='candy'){
    // Candy crush: the candy bursts into pieces with a splash of glassy shards in its color (one sliding
    // into a new special just goes in).
    if(e.merge===undefined){later(setFrags,{key:++keys.current,at:e.at,kind:e.kind,special:e.special},620,48);sp?.burst(x,y,{kind:'shard',n:6,color:[col,col,'#fff'],size:7,speed:1.15});sp?.ring(x,y,'rgba(255,255,255,.75)',30)}
    if(e.pts)later(setPops,{key:++keys.current,x:e.at%W+0.5,y:Math.floor(e.at/W)+0.5,n:e.pts,kind:e.kind,each:true},900,64)
   }
   // Bejeweled: a few small sparks where the gem shrank away.
   else window.setTimeout(()=>{sp?.burst(x,y,{kind:'spark',n:e.merge===undefined?6:3,color:[col,'#fff'],size:5,speed:0.7});if(e.merge===undefined)sp?.burst(x,y,{kind:'star',n:1,color:'#fff',size:6,speed:0.2})},e.merge===undefined?170:120)
  }else if(e.t==='fire'){
   const pts=e.points*(mode==='gems'?multNow.current:1);addScore(pts)
   const ef=e.e,[x,y]=centre(ef.at),key=++keys.current,span=Math.max(0,...e.delays)
   later(setFx,{key,e:ef,delays:e.delays,combo:e.combo},span+(mode==='candy'?1500:900),8)
   // Its name, big, where it went off; the board jolts with it (Candy crush).
   const text=calloutFor(mode,ef.type,!!e.combo,ef.cells.length)
   if(text)later(setCallouts,{key:++keys.current,x:Math.min(0.8,Math.max(0.2,x)),y:Math.min(0.85,Math.max(0.12,y)),text,type:ef.type+(e.combo?' is-combo':'')},mode==='candy'?1700:1100,3)
   if(mode==='candy'){const k=++keys.current;setPunch(k);window.setTimeout(()=>setPunch(p=>p===k?0:p),380);setSpot(sp0=>sp0&&Math.abs(sp0.x-x)<0.01&&Math.abs(sp0.y-y)<0.01?null:sp0)}
   if(ef.type==='row'||ef.type==='col'||ef.type==='cross'||ef.type==='nova'){play3('laser',sound);sp?.burst(x,y,{kind:'spark',n:ef.type==='nova'?36:18,color:mode==='gems'?['#fff','#bfe9ff','#6fc3ff']:['#fff','#fff6b0','#ffd0f0'],speed:ef.type==='nova'?2.4:1.6,size:7})}
   if(ef.type==='nova')sp?.burst(x,y,{kind:'star',n:14,color:['#fff','#ff8bf0','#ffe98a'],speed:1.8,size:9})
   if(ef.type==='color'){sp?.burst(x,y,{kind:'star',n:18,color:['#ff4d6d','#ffd84d','#4dd2ff','#7dff6a','#c58bff','#fff'],speed:1.6,size:8});sp?.ring(x,y,'#fff',110)}
   if(ef.type==='area'){play3('boom',sound);sp?.burst(x,y,{kind:mode==='gems'?'ember':'spark',n:ef.cells.length>9?44:26,color:['#fff6c2','#ffb02e','#ff5a1f'],speed:ef.cells.length>9?2.2:1.6,size:8})}
   if(ef.type==='color')play3('zap',sound)
   if(ef.type==='board'){sp?.burst(0.5,0.5,{kind:'confetti',n:120,speed:2.6,size:9});sp?.ring(0.5,0.5,'#fff',400);play3('mega',sound);say(mode==='candy'?'Sugar crush!':'Unbelievable!',true)}
   if(e.combo||ef.type==='area'||ef.type==='nova'||ef.type==='board')shake()
   buzz(ef.type==='color'||ef.type==='board'?[40,30,90]:e.combo||ef.type==='area'||ef.type==='nova'?[25,20,40]:22)
   if(pts>0&&ef.type!=='board')window.setTimeout(()=>flyPoints(x,y,pts),Math.min(700,span)+150)
   if(mode==='gems'){const xs=ef.cells.map(c=>c%W+0.5),ys=ef.cells.map(c=>Math.floor(c/W)+0.5);window.setTimeout(()=>later(setPops,{key:++keys.current,x:xs.reduce((a,b)=>a+b,0)/xs.length,y:ys.reduce((a,b)=>a+b,0)/ys.length,n:pts},900),Math.min(600,span))}
  }else if(e.t==='charge'){
   // A special winding up: a shimmer and a bright ring closing in on it.
   const [x,y]=centre(e.at);play3('charge',sound);sp?.burst(x,y,{kind:'star',n:e.combo?10:5,color:['#fff','#fff6c2'],size:5,speed:0.5})
   if(e.combo){say('Combo!',true);sp?.ring(x,y,'#fff',90)}
   buzz([12,30,12])
   // Candy crush: the board dims around the special while it winds up, a spotlight on it.
   if(mode==='candy'){const ms=e.combo?COMBO_MS.candy:(e.special==='color'?BOMB_CHARGE_MS:CHARGE_MS).candy,k=++keys.current;setSpot({key:k,x,y,ms});window.setTimeout(()=>setSpot(s0=>s0?.key===k?null:s0),ms+120);window.setTimeout(()=>sp?.ring(x,y,'rgba(255,255,255,.9)',60),ms*0.5)}
  }else if(e.t==='aim'){
   // Sugar crush: a move left flies off the counter as a star to the candy it turns striped.
   window.setTimeout(()=>{
    const from=elMid(movesRef.current),b=boardBox();if(!from||!b)return
    const [x,y]=centre(e.at);fly({x0:from[0],y0:from[1],x1:x*b.width,y1:y*b.height,text:'★',kind:'star',ms:STAR_MS})
    movesLeft.current=Math.max(0,movesLeft.current-1);setMoves(m=>Math.max(0,m-1));play3('tick',sound)
   },e.in)
  }else if(e.t==='made'){
   const [x,y]=centre(e.at);sp?.burst(x,y,{kind:'star',n:10,color:['#fff','#ffe98a'],size:7});sp?.ring(x,y,'#fff',50);play3('make',sound);buzz(10)
  }else if(e.t==='time'){extraMs.current+=e.n*1000;say('+'+e.n+' seconds!');play3('time',sound)}
  else if(e.t==='mult'){if(e.n>multNow.current){multNow.current=e.n;setMult(e.n);say('×'+e.n+' multiplier!',true);play3('mult',sound)}}
  else if(e.t==='shuffle')say(mode==='candy'?'Shuffle!':'No more moves!')
  else if(e.t==='nope'){
   // Not a match: the two bump and spring back with a little shake (and a buzz).
   const pair=lastSwap.current;if(!pair)return
   window.setTimeout(()=>{setNope(pair);buzz([12,40,12]);window.setTimeout(()=>setNope(n=>n===pair?[]:n),380)},SWAP_MS*2)
  }
 }
 // The board has settled: the opening drop is over, a Candy crush move is counted, or the finale goes on.
 const calm=()=>{
  cheered.current=0;setHeat(0);musicLift(0)
  if(phase.current==='intro'){phase.current='play';setIntro(false);idleAt.current=-1}
  if(ended.current)return
  if(phase.current==='finale'){
   // Every special left goes off, round after round, until none is left.
   if(specialsLeft(eng.current)&&rounds.current<6){rounds.current++;blowAll(eng.current,0)}else finish(true,finaleText.current)
   return
  }
  if(phase.current!=='play')return
  if(moved.current){moved.current=false;counted()}
  if(mode==='gems'&&timeUp.current&&phase.current==='play')lastHurrah()
 }
 const lastHurrah=()=>{
  phase.current='finale';finaleText.current='Time’s up!'
  if(!specialsLeft(eng.current)){finish(true,'Time’s up!');return}
  say('Last hurrah!',true);play3('fanfare',sound);blowAll(eng.current,0)
 }
 // A Candy crush move, once the board has settled from it.
 const counted=()=>{
  if(freeMove.current)freeMove.current=false
  else{movesLeft.current-=1;setMoves(movesLeft.current);if(movesLeft.current>0&&movesLeft.current<=3)play3('tick',sound)}
  const met=scoreRef.current>=goal.target&&!jellyNow.current.size
  if(met){
   // Sugar crush: each move left becomes a striped candy, and they all go off.
   if(movesLeft.current>0){
    say('Sugar crush!',true);play3('fanfare',sound);const extra=movesLeft.current
    phase.current='wait';finaleText.current='Level '+level+' complete!'
    // Each move left counts down off the counter and flies onto the board as a star, one by one.
    window.setTimeout(()=>{if(ended.current)return;phase.current='finale';blowAll(eng.current,extra,FINALE_GAP,STAR_MS)},700)
   }else finish(true,'Level '+level+' complete!')
  }else if(movesLeft.current<=0)finish(false,'Out of moves')
 }
 // Gem blitz takes a swap whenever the two are at rest; Candy crush once the board has settled.
 const canPlay=()=>!ended.current&&phase.current==='play'&&(mode==='gems'?!timeUp.current:!moved.current&&settled(eng.current))
 // A hint: after five seconds without a move, a move that works wiggles.
 useEffect(()=>{
  idleAt.current=performance.now()
  const t=window.setInterval(()=>{if(idleAt.current<0)idleAt.current=performance.now();if(canPlay()&&performance.now()-idleAt.current>5000)setHint(hintFor(eng.current))},1000)
  return ()=>window.clearInterval(t)
 },[]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{onEvent.current=handle;onCalm.current=calm})
 // The board idles with life: now and then a piece hops (a candy) or catches the light (a gem), and a glint
 // twinkles somewhere on the board.
 useEffect(()=>{
  const t=window.setInterval(()=>{
   const rt=eng.current
   if(ended.current||!settled(rt))return
   const at=Math.floor(Math.random()*W*W),x=rt.cells[at]
   // Candies hop, wiggle or give a sleepy blink; gems catch the light or hop.
   if(x){const r=Math.random(),kind=mode==='candy'?(r<0.45?'hop':r<0.8?'wiggle':'blink'):(r<0.6?'shine':'hop');setHop({id:x.p.id,kind});window.setTimeout(()=>setHop(h=>h?.id===x.p.id?null:h),700)}
   const g=Math.floor(Math.random()*W*W),[gx,gy]=centre(g)
   sparks.current?.burst(gx+(Math.random()-0.5)*0.05,gy-0.03,{kind:'star',n:1,color:'#fff',size:mode==='gems'?7:6,speed:0.05})
  },700)
  return ()=>window.clearInterval(t)
 },[]) // eslint-disable-line react-hooks/exhaustive-deps
 const attempt=(a:number,c:number)=>{
  if(!canPlay())return
  // The free swap: any two, paid for as it's used.
  const free=armed==='swap'
  if(free&&!boosters?.buy('swap'))return
  lastSwap.current=[a,c]
  const r=trySwap(eng.current,a,c,free)
  if(!r)return
  if(free){setArmed(null);freeMove.current=true;say('Free swap!')}
  setSel(null);setHint(null);idleAt.current=performance.now();play3('swap',sound)
  // Not a match: the two slide over and straight back.
  if(r==='nope'){window.setTimeout(()=>play3('nope',sound),SWAP_MS+40);return}
  if(mode==='candy'){moved.current=true;return}
  // Gem blitz's speed, as in Bejeweled Blitz: a quick move after a quick move is a Speed bonus (from the
  // third on: 200, then 100 more each time, up to 1,000), and each one fills the Ignition meter.
  const now=performance.now();speedNow.current=now-lastMove.current<SPEEDY_MS?speedNow.current+1:0;lastMove.current=now
  if(!eng.current.m.blazing)setSpeed(speedNow.current)
  if(speedNow.current>=2){const bonus=Math.min(1000,200+100*(speedNow.current-2))*multNow.current;addScore(bonus);say('Speed +'+bonus.toLocaleString())}
  if(!eng.current.m.blazing&&speedNow.current>=IGNITE){
   // Blazing speed: for eight seconds every match bursts like a flame gem.
   speedNow.current=0;setSpeed(0);eng.current.m.blazing=true;setBlazing(true)
   window.setTimeout(()=>{eng.current.m.blazing=false;setBlazing(false)},BLAZE_MS)
   say('Blazing speed!',true);play3('blaze',sound);sparks.current?.burst(0.5,0.95,{kind:'ember',n:60,color:['#fff6c2','#ffb02e','#ff5a1f'],speed:1.8,size:9})
  }
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
  // The lollipop hammer: a tap smashes that candy (paid for as it's used).
  if(armed==='hammer'){
   if(!canPlay())return
   if(!boosters?.buy('hammer'))return
   if(smash(eng.current,p.at)){setArmed(null);freeMove.current=true;moved.current=true;play3('boom',sound);shake();const [x,y]=centre(p.at);sparks.current?.burst(x,y,{kind:'star',n:12,color:['#fff','#ff9de0','#ffd84d'],size:8,speed:1.4})}
   return
  }
  const s=sel
  if(s===null){setSel(p.at);buzz(8);return}
  if(s===p.at){setSel(null);return}
  const near=Math.abs(s-p.at)===W||(Math.abs(s-p.at)===1&&Math.floor(s/W)===Math.floor(p.at/W))
  if(near)attempt(s,p.at);else{setSel(p.at);buzz(8)}
 }
 const pos=(i:number)=>({left:(i%W)*100/W+'%',top:Math.floor(i/W)*100/W+'%'})
 const label=(p:Piece)=>(mode==='candy'?['red','orange','yellow','green','blue','purple']:['red','orange','yellow','green','blue','purple','white'])[p.kind]+(p.special?' '+({row:mode==='candy'?'striped':'lightning',col:mode==='candy'?'striped':'lightning',area:mode==='candy'?'wrapped':'flame',cross:'star',color:mode==='candy'?'color bomb':'hypercube',nova:'supernova'})[p.special]:'')+(p.bonus==='time'?' +5 seconds':p.bonus==='mult'?' ×'+p.mult:'')
 const progress=Math.min(1,score/(goal.target*2))
 return <div className={'break-game match3 is-'+mode+(blazing?' is-blazing':'')+(heat?' is-hot':'')} style={{'--heat':heat/5} as React.CSSProperties}>
  <div className="m3-bg" aria-hidden="true"><i/><i/><i/></div>
  <ArtDefs mode={mode}/>
  <div className="blast-top">
   <span className="blast-best">{mode==='candy'?'Level '+level:'⏱ '+Math.ceil(left/1000)+'s'}</span>
   {mode==='candy'?<span ref={movesRef} key={moves<=3?moves:'m'} className={'blast-coins m3-moves'+(moves>0&&moves<=3&&!done?' is-low':'')}>{moves} move{moves===1?'':'s'}</span>:<span className="blast-coins m3-mult" aria-label={'Multiplier ×'+mult}>×{mult}</span>}
   <strong ref={scoreEl} key={score} className={'blast-score'+(bump?' is-bump':'')} aria-label={'Score '+score}>{score.toLocaleString()}</strong>
  </div>
  {mode==='candy'?<div className="match3-goal" role="progressbar" aria-label={'Target '+goal.target} aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={Math.min(score,goal.target)}>
   <span style={{width:progress*100+'%'}}/>{[0.5,0.75,1].map((x,k)=><i key={k} className={progress>=x?'is-lit':''} style={{left:x*100+'%'}} aria-hidden="true">★</i>)}
   <b>{goal.jelly?(jelly.size?jelly.size+' jelly left · ':'Jelly cleared ✓ · '):''}{Math.min(score,goal.target).toLocaleString()} / {goal.target.toLocaleString()}</b>
  </div>
  :<div className="match3-goal is-time" aria-hidden="true"><span style={{width:Math.min(1,left/BLITZ_MS)*100+'%'}}/></div>}
  {mode==='gems'&&<div className={'m3-ignite'+(blazing?' is-on':'')} role="meter" aria-label="Ignition" aria-valuemin={0} aria-valuemax={IGNITE} aria-valuenow={blazing?IGNITE:Math.min(IGNITE,speed)}><span style={{width:(blazing?100:Math.min(1,speed/IGNITE)*100)+'%'}}/><b>{blazing?'🔥 Blazing speed!':'Ignition'}</b></div>}
  <div className={'blast-frame'+(quake?' is-quake':'')+(punch?' is-punch':'')}>
   <div ref={boardRef} className={'match3-board'+(sel!==null?' has-pick':'')} role="grid" aria-label={mode==='candy'?'Candy board':'Gem board'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{press.current=null}}>
    <div className="match3-pieces">
    {[...jelly].map(i=><span key={'j'+i} className="m3-jelly" style={pos(i)} aria-hidden="true"/>)}
    {/* In a fixed order (by piece), so the page never moves an element; each piece is placed and scaled as
        the board says, every frame. Gems above the board fade in as they drop toward it. */}
    {looks.map(l=>{const p=l.p,i=l.at,o=l.o*(mode==='gems'?Math.max(0,Math.min(1,l.y+1.6)):1),plain=l.sx===1&&l.sy===1&&o===1&&l.b===1&&l.rot===0
     return <div key={p.id} role="gridcell" data-i={i} data-kind={p.kind} aria-label={'Row '+(Math.floor(i/W)+1)+', column '+(i%W+1)+': '+label(p)}
      className={'match3-piece k'+p.kind+(p.special?' is-'+p.special:'')+(p.bonus?' has-'+p.bonus:'')+(sel===i?' is-picked':sel!==null&&!l.clearing&&adjacent(sel,i)?' is-near':'')+(l.born?' is-made':'')+(l.clearing?' is-clearing':'')+(intro?' is-intro':'')+(hint?.includes(i)&&!l.clearing?' is-hint':'')+(l.charge?' is-charging':'')+(hop?.id===p.id&&!l.clearing?' is-'+hop.kind:'')+(nope.includes(i)&&!l.clearing?' is-nope':'')+(shiver.has(i)?' is-shiver':'')} style={{transform:'translate('+l.x*100+'%,'+l.y*100+'%)',zIndex:l.z,'--d':(p.id%29)*0.41+'s','--charge':l.charge,...(sel!==null&&sel!==i?{'--nx':Math.sign(sel%W-i%W),'--ny':Math.sign(Math.floor(sel/W)-Math.floor(i/W))}:{})} as React.CSSProperties}>
      {/* A special's own glow behind it (a halo that brightens as it charges up). */}
      {p.special&&!l.clearing&&<i className="m3-halo" aria-hidden="true"/>}
      {p.special&&!l.clearing&&<i className="m3-rays" aria-hidden="true"/>}
      <span className="m3-gem" aria-hidden="true" style={plain?undefined:{transform:'scale('+l.sx.toFixed(3)+','+l.sy.toFixed(3)+')'+(l.rot?' rotate('+l.rot.toFixed(1)+'deg)':''),transformOrigin:l.clearing||l.charge?'50% 50%':'50% 100%',opacity:o,filter:l.b!==1?'brightness('+l.b.toFixed(2)+')':undefined}}><PieceArt mode={mode} kind={p.kind} special={p.special}/></span>{p.special&&!l.clearing&&<i className="m3-twinkle" aria-hidden="true"/>}{p.bonus==='mult'&&<b className="m3-badge" aria-hidden="true">×{p.mult}</b>}{p.bonus==='time'&&<b className="m3-badge is-time" aria-hidden="true">+5</b>}
     </div>})}
    </div>
    <div className="m3-fx" aria-hidden="true">
     {fx.map(f=><Effect key={f.key} e={f.e} delays={f.delays} mode={mode} combo={f.combo}/>)}
     {frags.map(f=><span key={f.key} className="m3-frag" style={pos(f.at)}>{[0,1,2,3].map(q=><i key={q} className={'q'+q}><PieceArt mode={mode} kind={f.kind} special={f.special}/></i>)}</span>)}
     {/* Candy crush shows each candy's points over it, in its color; Gem blitz one total for each clear. */}
     {pops.map(p=><span key={p.key} className={'m3-pop'+(p.each?' is-each k'+p.kind:'')+(p.size?' is-'+p.size:'')} style={{left:p.x*100/W+'%',top:p.y*100/W+'%'}}>{p.n.toLocaleString()}</span>)}
    </div>
    {spot&&<span key={spot.key} className="m3-spot" aria-hidden="true" style={{'--x':spot.x*100+'%','--y':spot.y*100+'%','--ms':spot.ms+'ms'} as React.CSSProperties}/>}
    {hint&&sel===null&&(()=>{const [a,b]=hint,ax=a%W,ay=Math.floor(a/W),bx=b%W,by=Math.floor(b/W);return <span className="m3-hint-arrow" aria-hidden="true" style={{left:((ax+bx)/2+0.5)*100/W+'%',top:((ay+by)/2+0.5)*100/W+'%',rotate:Math.atan2(by-ay,bx-ax)+'rad'}}><i/><i/></span>})()}
    {flights.map(f=><span key={f.key} className={'m3-fly is-'+f.kind} aria-hidden="true" style={{left:f.x0,top:f.y0,'--dx':f.x1-f.x0+'px','--dy':f.y1-f.y0+'px','--ms':f.ms+'ms'} as React.CSSProperties}>{f.text}</span>)}
    <Sparks ref={sparks} always/>
    {callouts.map(c=><p key={c.key} className={'m3-callout is-'+c.type} aria-hidden="true" style={{left:c.x*100+'%',top:c.y*100+'%'}}><span>{c.text}</span></p>)}
    {cheer&&<p key={cheer.key} className={'blast-cheer m3-cheer'+(cheer.big?' is-big':'')} role="status"><span>{cheer.text}</span></p>}
    {done&&<p className="blast-over" role="status">{done}</p>}
   </div>
  </div>
  {mode==='candy'&&boosters&&<div className="m3-boosters" role="group" aria-label="Boosters">
   {(Object.keys(BOOSTERS) as BoosterId[]).map(id=>{const b=BOOSTERS[id],short=boosters.balance<b.price
    return <button key={id} type="button" aria-pressed={armed===id} className={armed===id?'is-armed':''} disabled={short&&armed!==id} onClick={()=>setArmed(a=>a===id?null:id)}><span aria-hidden="true">{b.emoji}</span><b>{b.name}</b><small>{armed===id?b.how+' · tap here to cancel':b.price+' coins'+(short?' (not enough)':'')}</small></button>})}
  </div>}
  <p className="blast-help">{mode==='candy'?'Match 4 for a striped candy, an L or T for a wrapped one, 5 for a color bomb. Move a special to set it off, or swap two together for a combo!':'Match 4 for a flame gem, an L or T for a star, 5 for a hypercube, 6 for a supernova. Quick moves in a row light Blazing speed!'}</p>
 </div>
}

/** A special going off, timed with the board (`delays`: when it reaches each square): a beam running out both
 * ways along its row or column with a bright head (three wide for a supernova), an explosion's white-hot
 * core and shockwave, lightning from a color bomb striking each piece in turn while the rest of the board
 * goes dark, a flash for the whole board. */
function Effect({e,delays,mode,combo}:{e:Effect;delays:number[];mode:'gems'|'candy';combo?:boolean}){
 const id=useId()
 const r=Math.floor(e.at/W),c=e.at%W,beam=BEAM_MS[mode],cell=100/W
 const run=(kind:'row'|'col',n:number,wide:boolean)=>{
  const at=kind==='row'?c:r,parts:React.ReactNode[]=[]
  for(const side of [0,1]){
   const len=side?W-at-0.5:at+0.5,t=Math.max(60,len*beam)+'ms'
   const box=kind==='row'?{top:n*cell+'%',left:(side?at+0.5:0)*cell+'%',width:len*cell+'%'}:{left:n*cell+'%',top:(side?at+0.5:0)*cell+'%',height:len*cell+'%'}
   parts.push(<span key={kind+n+side} className={'m3-beam is-run is-'+kind+(side?(kind==='row'?' is-r':' is-d'):'')+(wide?' is-wide':'')} style={{...box,'--t':t} as unknown as React.CSSProperties}/>)
   const from=(at+0.5)*cell+'%',to=(side?100:0)+'%',across=(n+0.5)*cell+'%'
   const head:Record<string,string>=kind==='row'?{'--t':t,'--x0':from,'--x1':to,'--y0':across,'--y1':across}:{'--t':t,'--y0':from,'--y1':to,'--x0':across,'--x1':across}
   parts.push(<span key={'h'+kind+n+side} className="m3-head" style={head as React.CSSProperties}/>)
  }
  return parts
 }
 // The special's launch, where it was: a burst in its own style (see .m3-launch).
 const launch=<span className={'m3-launch is-'+e.type+(combo?' is-combo':'')} style={{left:(c+0.5)*cell+'%',top:(r+0.5)*cell+'%'}}/>
 if(e.type==='row')return <>{launch}{run('row',r,false)}</>
 if(e.type==='col')return <>{launch}{run('col',c,false)}</>
 if(e.type==='cross')return <>{launch}{run('row',r,!!combo)}{run('col',c,!!combo)}</>
 if(e.type==='nova')return <>{launch}{[r-1,r,r+1].filter(y=>y>=0&&y<W).map(y=>run('row',y,true))}{[c-1,c,c+1].filter(x=>x>=0&&x<W).map(x=>run('col',x,true))}</>
 const big=e.cells.length>9,centre={left:(c+0.5)*cell+'%',top:(r+0.5)*cell+'%'}
 if(e.type==='area')return <>{launch}<span className={'m3-core'+(big?' is-big':'')} style={centre}/><span className={'m3-wave'+(big?' is-big':'')} style={centre}/><span className={'m3-ring'+(big?' is-big':'')} style={centre}/></>
 if(e.type==='board')return <>{launch}<span className="m3-flash"/></>
 // A color bomb or hypercube darkens the board; only the pieces it takes stay lit while the lightning hits them.
 const span=Math.max(0,...delays)
 return <>{launch}<svg className="m3-bolts" viewBox={'0 0 '+W+' '+W} preserveAspectRatio="none">
  <defs><mask id={id}><rect width={W} height={W} fill="#fff"/>{e.cells.map(i=><rect key={i} x={i%W} y={Math.floor(i/W)} width={1} height={1} rx={0.25} fill="#000"/>)}</mask></defs>
  <rect className="m3-dim" width={W} height={W} mask={'url(#'+id+')'} style={{animationDuration:span+750+'ms'}}/>
  {e.cells.map((i,k)=>{const y=Math.floor(i/W)+0.5,x=i%W+0.5,mx=(x+c+0.5)/2+((i*7)%3-1)*0.4,my=(y+r+0.5)/2+((i*5)%3-1)*0.4;return <polyline key={i} style={{animationDelay:Math.max(0,delays[k]-60)+'ms'}} points={(c+0.5)+','+(r+0.5)+' '+mx+','+my+' '+x+','+y}/>})}</svg></>
}
