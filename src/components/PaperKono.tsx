import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {N,TEAMS,TEAM_TICKS,battleOver,newArena,shares,steer,teamShares,tick,type Arena,type Dir,type Mode} from '../store/paper'
import {gameSound} from '../konoSounds'
import {fx,startMusic,stopMusic} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

/** KONO.io (the rules are in store/paper, after Paper.io 2): you're KONO's blue block. Swipe (or use the
 * arrow keys / WASD) to turn; leave your land to draw a trail and come back to claim everything it closes
 * in. Cut a bot's trail to knock it out; don't let one touch yours. The camera follows you over the map;
 * land is drawn as raised blocks, trails as a lighter path, and the leaderboard shows everyone's share.
 * The run ends when you're cut (or crash); your best share and knockouts become the score.
 * Team battle: you're on Blue with three bots against Red's four. Land comes in the team's color, a bar
 * shows Blue against Red with the two minutes ticking down, and when you're cut you're back on Blue's land
 * three seconds later. When time's up, the team with more of the map wins. */
const TICK_MS=105,VIEW=22
export type PaperResult={share:number;kills:number;rank:number;team?:{blue:number;red:number;won:boolean}}
const clock=(ticks:number)=>{const s=Math.max(0,Math.ceil(ticks*TICK_MS/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
export default function PaperKono({ref,mode='solo',sound,onEnd}:{ref:Ref<GameHandle>;mode?:Mode;sound:boolean;onEnd:(r:PaperResult)=>void}){
 const frame=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),arena=useRef<Arena|null>(null),prev=useRef(new Map<number,{x:number;y:number}>())
 const kono=useRef<HTMLImageElement|null>(null),ended=useRef(false),best=useRef(0),seen=useRef(0)
 const onEndRef=useRef(onEnd),soundRef=useRef(sound)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 const [board,setBoard]=useState<{id:number;name:string;color:string;share:number}[]>([]),[mine,setMine]=useState(0),[feed,setFeed]=useState<{key:number;text:string}|null>(null),[out,setOut]=useState(false)
 const [teams,setTeams]=useState<{blue:number;red:number;left:number}>({blue:0,red:0,left:TEAM_TICKS})
 const result=():PaperResult=>{const a=arena.current!,s=shares(a),me=s.get(1)??0,rank=1+[...s.entries()].filter(([id,v])=>id!==1&&v>me).length;const t=teamShares(a),blue=Math.round(t.get(1)!*10)/10,red=Math.round(t.get(2)!*10)/10
  return {share:Math.round(best.current*10)/10,kills:a.players[0].kills,rank,...(a.mode==='team'?{team:{blue,red,won:blue>red}}:{})}}
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current||!arena.current)return;ended.current=true;onEndRef.current(result())}}),[])
 useEffect(()=>{
  const a=newArena(Math.random,6,'#3e6fe6',mode);arena.current=a
  const img=new Image();img.src='/garden/kono/excited.webp';kono.current=img
  const me=a.players[0]
  const turn=(d:Dir)=>{if(!ended.current&&me.alive)steer(me,d)}
  const keys:Record<string,Dir>={ArrowUp:0,KeyW:0,ArrowRight:1,KeyD:1,ArrowDown:2,KeyS:2,ArrowLeft:3,KeyA:3}
  const key=(e:KeyboardEvent)=>{const d=keys[e.code];if(d!==undefined){e.preventDefault();turn(d)}}
  window.addEventListener('keydown',key)
  // Swipes: each 18px of finger travel turns toward it, so a finger can keep steering without lifting.
  let origin:{x:number;y:number}|null=null
  const el=frame.current!
  const down=(e:PointerEvent)=>{origin={x:e.clientX,y:e.clientY}}
  const move=(e:PointerEvent)=>{if(!origin)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;turn(Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0));origin={x:e.clientX,y:e.clientY}}
  const up=()=>{origin=null}
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)
  gameSound('start',soundRef.current);startMusic('paper',soundRef.current)
  let raf=0,lastTick=performance.now(),lastBoard=0,trailWas=0
  const loop=(now:number)=>{
   if(!ended.current)while(now-lastTick>=TICK_MS){
    lastTick+=TICK_MS
    if(!me.alive&&a.mode==='solo')break
    const wasAlive=me.alive
    prev.current=new Map(a.players.map(p=>[p.id,{x:p.x,y:p.y}]))
    tick(a)
    if(trailWas&&!me.trail.length&&me.alive)fx('claim',soundRef.current,Math.floor(trailWas/6))
    trailWas=me.trail.length
    for(const e of a.log.slice(seen.current)){
     if(e.by===1&&e.who!==1){setFeed({key:a.ticks,text:'You cut '+(a.players.find(p=>p.id===e.who)?.name??'')+'!'});fx('cut',soundRef.current);gameSound('big',soundRef.current,3)}
    }
    seen.current=a.log.length
    if(wasAlive&&!me.alive&&!ended.current){
     const last=a.log.at(-1),how=last&&last.who===1&&last.by?'Cut by '+(a.players.find(p=>p.id===last.by)?.name??'a bot')+'!':'Crashed!'
     setOut(true);fx('thud',soundRef.current)
     // Team battle: back on Blue's land in three seconds. Solo: that's the run.
     if(a.mode==='team')setFeed({key:a.ticks,text:how+' Back in 3…'})
     else{ended.current=true;stopMusic();setFeed({key:a.ticks,text:how});const r=result();window.setTimeout(()=>onEndRef.current(r),1400)}
    }
    if(!wasAlive&&me.alive){setOut(false);setFeed(null);prev.current.delete(1)}
    if(battleOver(a)&&!ended.current){
     ended.current=true;stopMusic()
     const r=result();setFeed({key:a.ticks,text:r.team!.won?'Blue wins!':r.team!.blue===r.team!.red?'A tie!':'Red wins!'});gameSound(r.team!.won?'big':'nope',soundRef.current,4)
     window.setTimeout(()=>onEndRef.current(r),1600)
    }
   }
   if(now-lastBoard>400){
    lastBoard=now
    const s=shares(a);best.current=Math.max(best.current,s.get(1)??0);setMine(s.get(1)??0)
    setBoard(a.players.filter(p=>p.alive||p.id===1).map(p=>({id:p.id,name:p.name,color:p.color,share:s.get(p.id)??0})).sort((x,y)=>y.share-x.share))
    if(a.mode==='team'){const t=teamShares(a);setTeams({blue:t.get(1)!,red:t.get(2)!,left:TEAM_TICKS-a.ticks})}
   }
   draw(canvas.current,a,prev.current,Math.min(1,(now-lastTick)/TICK_MS),kono.current)
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  // The canvas matches the frame's size (sharp on high-density screens).
  const fit=new ResizeObserver(()=>{const c=canvas.current;if(!c)return;const r=el.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr)})
  fit.observe(el)
  return ()=>{cancelAnimationFrame(raf);fit.disconnect();stopMusic();window.removeEventListener('keydown',key);el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up)}
  // result only reads refs; the mode is fixed for a round (a new one remounts).
 },[]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!feed)return;const t=window.setTimeout(()=>setFeed(f=>f?.key===feed.key&&!out?null:f),1800);return ()=>window.clearTimeout(t)},[feed,out])
 const rank=board.findIndex(b=>b.id===1)+1
 return <div className="break-game paper">
  <div ref={frame} className={'paper-frame'+(out?' is-out':'')}>
   <canvas ref={canvas} role="img" aria-label={'KONO.io map: you own '+mine.toFixed(1)+'%'}/>
   {mode==='team'?<div className="paper-teams" role="group" aria-label={'Blue '+teams.blue.toFixed(1)+'%, Red '+teams.red.toFixed(1)+'%, '+clock(teams.left)+' left'}>
    <span className="is-blue" style={{flexGrow:Math.max(0.5,teams.blue)}}>Blue {teams.blue.toFixed(1)}%</span>
    <b role="timer">{clock(teams.left)}</b>
    <span className="is-red" style={{flexGrow:Math.max(0.5,teams.red)}}>{teams.red.toFixed(1)}% Red</span>
   </div>
   :<ol className="paper-board" aria-label="Leaderboard">{board.slice(0,5).map((b,k)=><li key={b.id} className={b.id===1?'is-me':''} style={{'--c':b.color} as React.CSSProperties}><span>{k+1}. {b.name}</span><b>{b.share.toFixed(1)}%</b></li>)}
    {rank>5&&<li className="is-me" style={{'--c':'#3e6fe6'} as React.CSSProperties}><span>{rank}. You</span><b>{mine.toFixed(1)}%</b></li>}</ol>}
   {mode==='solo'&&<p className="paper-mine" aria-label={'You own '+mine.toFixed(1)+'% of the map'}><b>{mine.toFixed(1)}%</b></p>}
   {feed&&<p key={feed.key} className={'blast-cheer paper-feed'+(out?' is-out':'')} role="status"><span>{feed.text}</span></p>}
  </div>
  <p className="blast-help">{mode==='team'?'You’re on Blue (you have the white ring). Claim land for your team, cut Red’s trails, and have more of the map when the two minutes are up!':'Swipe or use the arrow keys to steer. Leave your land, loop around and come home to claim it. Don’t let anyone touch your trail!'}</p>
 </div>
}

/** Paints the part of the map around you: land as raised blocks (a darker side shows below), trails as a
 * lighter path, and each player's block gliding between squares. */
function draw(c:HTMLCanvasElement|null,a:Arena,prev:Map<number,{x:number;y:number}>,frac:number,kono:HTMLImageElement|null){
 const g=c?.getContext('2d');if(!c||!g||!c.width)return
 const me=a.players[0],pos=(id:number,x:number,y:number)=>{const p=prev.get(id);if(!p||Math.abs(p.x-x)+Math.abs(p.y-y)>1)return {x,y};return {x:p.x+(x-p.x)*frac,y:p.y+(y-p.y)*frac}}
 const cam=pos(1,me.x,me.y),cell=Math.max(c.width,c.height)/VIEW,ox=c.width/2-(cam.x+0.5)*cell,oy=c.height/2-(cam.y+0.5)*cell
 // Trails are in their player's color; land in its owner's (a team's, in team battle).
 const colors=new Map(a.players.map(p=>[p.id,p.color])),lands=a.mode==='team'?new Map(TEAMS.map(t=>[t.id,t.color])):colors
 g.fillStyle='#c9cfe6';g.fillRect(0,0,c.width,c.height)
 g.fillStyle='#eef1fb';g.fillRect(ox,oy,N*cell,N*cell)
 const x0=Math.max(0,Math.floor(-ox/cell)-1),y0=Math.max(0,Math.floor(-oy/cell)-1),x1=Math.min(N,Math.ceil((c.width-ox)/cell)+1),y1=Math.min(N,Math.ceil((c.height-oy)/cell)+1)
 g.strokeStyle='rgba(60,80,140,.08)';g.lineWidth=1;g.beginPath()
 for(let x=x0;x<=x1;x++){g.moveTo(ox+x*cell,oy+y0*cell);g.lineTo(ox+x*cell,oy+y1*cell)}
 for(let y=y0;y<=y1;y++){g.moveTo(ox+x0*cell,oy+y*cell);g.lineTo(ox+x1*cell,oy+y*cell)}
 g.stroke()
 const side=cell*0.28
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const i=y*N+x,o=a.own[i],t=a.trail[i]
  if(t){g.fillStyle=colors.get(t)!;g.globalAlpha=0.5;g.fillRect(ox+x*cell,oy+y*cell,cell+0.5,cell+0.5);g.globalAlpha=1}
  if(!o)continue
  const col=lands.get(o)!
  if(y+1>=N||a.own[i+N]!==o){g.fillStyle=shade(col,-0.32);g.fillRect(ox+x*cell,oy+(y+1)*cell-0.5,cell+0.5,side)}
  g.fillStyle=col;g.fillRect(ox+x*cell,oy+y*cell,cell+0.5,cell+0.5)
 }
 // Players: a block a little bigger than a square, lighter on top, with a face.
 for(const p of a.players){
  if(!p.alive)continue
  const q=pos(p.id,p.x,p.y),px=ox+q.x*cell,py=oy+q.y*cell,s=cell*1.15,d=(s-cell)/2
  g.fillStyle=shade(p.color,-0.4);round(g,px-d,py-d+side,s,s,cell*0.22);g.fill()
  g.fillStyle=shade(p.color,0.22);round(g,px-d,py-d,s,s,cell*0.22);g.fill()
  // In team battle your block has a white ring, so you can find yourself among your teammates.
  if(p.id===1&&a.mode==='team'){g.lineWidth=Math.max(2,cell*0.1);g.strokeStyle='#fff';round(g,px-d,py-d,s,s,cell*0.22);g.stroke()}
  if(p.id===1&&kono?.complete&&kono.naturalWidth)g.drawImage(kono,px-d,py-d-cell*0.15,s,s)
  else if(p.face){g.font=Math.round(cell*0.8)+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(p.face,px+cell/2,py+cell/2)}
  g.font='800 '+Math.round(cell*0.5)+'px system-ui';g.textAlign='center';g.textBaseline='bottom';g.lineWidth=3;g.strokeStyle='rgba(255,255,255,.9)';g.strokeText(p.name,px+cell/2,py-d-2);g.fillStyle=shade(p.color,-0.35);g.fillText(p.name,px+cell/2,py-d-2)
 }
}
function round(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){g.beginPath();g.roundRect(x,y,w,h,r)}
/** A color made lighter (amount > 0) or darker (< 0). */
function shade(hex:string,amount:number){
 const n=parseInt(hex.slice(1),16),f=(v:number)=>Math.round(amount>0?v+(255-v)*amount:v*(1+amount))
 return 'rgb('+f(n>>16&255)+','+f(n>>8&255)+','+f(n&255)+')'
}
