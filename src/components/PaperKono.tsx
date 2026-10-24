import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {N,TEAMS,TEAM_TICKS,TICK_MS,battleOver,newArena,shares,steer,teamShares,tick,type Arena,type Mode} from '../store/paper'
import {gameSound} from '../konoSounds'
import {fx,startMusic,stopMusic} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

/** KONO.io (the rules are in store/paper, after Paper.io 2): you're KONO's blue block, steering freely.
 * Drag anywhere (a joystick appears under your finger), point with the mouse, or hold the arrow keys /
 * WASD (two at once go diagonally). Leave your land to draw a trail and come back to claim everything it
 * closes in. Cut a bot's trail to knock it out; don't let one touch yours. Drawn the way Paper.io 2 looks:
 * soft rounded land with a raised edge, smooth curving trails, the camera close on you, a round minimap of
 * the whole map in the corner, and a shockwave where someone is knocked out.
 * The run ends when you're cut (or crash); your best share and knockouts become the score.
 * Team battle: you're on Blue with three bots against Red's four. Land comes in the team's color, a bar
 * shows Blue against Red with the two minutes ticking down, and when you're cut you're back on Blue's land
 * three seconds later. When time's up, the team with more of the map wins. */
const VIEW=26
export type PaperResult={share:number;kills:number;rank:number;team?:{blue:number;red:number;won:boolean}}
type Boom={x:number;y:number;color:string;at:number;text?:string}
const clock=(ticks:number)=>{const s=Math.max(0,Math.ceil(ticks*TICK_MS/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
export default function PaperKono({ref,mode='solo',sound,onEnd}:{ref:Ref<GameHandle>;mode?:Mode;sound:boolean;onEnd:(r:PaperResult)=>void}){
 const frame=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),mini=useRef<HTMLCanvasElement>(null),arena=useRef<Arena|null>(null),prev=useRef(new Map<number,{x:number;y:number}>())
 const kono=useRef<HTMLImageElement|null>(null),ended=useRef(false),best=useRef(0),seen=useRef(0),booms=useRef<Boom[]>([]),stick=useRef<{x:number;y:number;fx:number;fy:number}|null>(null)
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
  const aim=(angle:number)=>{if(!ended.current&&me.alive)steer(me,angle)}
  // Keys: hold one (or two, for a diagonal) to point that way.
  const held=new Set<string>(),dirs:Record<string,[number,number]>={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]}
  const keyAim=()=>{let x=0,y=0;for(const k of held){x+=dirs[k][0];y+=dirs[k][1]}if(x||y)aim(Math.atan2(y,x))}
  const down=(e:KeyboardEvent)=>{if(!dirs[e.code])return;e.preventDefault();held.add(e.code);keyAim()}
  const upKey=(e:KeyboardEvent)=>{held.delete(e.code);keyAim()}
  window.addEventListener('keydown',down);window.addEventListener('keyup',upKey)
  // Touch and drag: a joystick under the finger (its base follows if the finger goes far). A mouse with no
  // button held points KONO toward the cursor.
  const el=frame.current!
  const pdown=(e:PointerEvent)=>{stick.current={x:e.clientX,y:e.clientY,fx:e.clientX,fy:e.clientY};el.setPointerCapture?.(e.pointerId)}
  const pmove=(e:PointerEvent)=>{
   const s=stick.current
   if(s){
    s.fx=e.clientX;s.fy=e.clientY
    const dx=s.fx-s.x,dy=s.fy-s.y,d=Math.hypot(dx,dy)
    if(d>8)aim(Math.atan2(dy,dx))
    if(d>60){s.x=s.fx-dx/d*60;s.y=s.fy-dy/d*60}
   }else if(e.pointerType==='mouse'){const r=el.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);if(Math.hypot(dx,dy)>12)aim(Math.atan2(dy,dx))}
  }
  const pup=()=>{stick.current=null}
  el.addEventListener('pointerdown',pdown);el.addEventListener('pointermove',pmove);el.addEventListener('pointerup',pup);el.addEventListener('pointercancel',pup)
  gameSound('start',soundRef.current);startMusic('paper',soundRef.current)
  let raf=0,lastTick=performance.now(),lastBoard=0,trailWas=0
  const loop=(now:number)=>{
   if(!ended.current)while(now-lastTick>=TICK_MS){
    lastTick+=TICK_MS
    if(!me.alive&&a.mode==='solo')break
    const wasAlive=me.alive
    prev.current=new Map(a.players.map(p=>[p.id,{x:p.x,y:p.y}]))
    tick(a)
    if(trailWas&&!me.trail.length&&me.alive)fx('claim',soundRef.current,Math.floor(trailWas/10))
    trailWas=me.trail.length
    for(const e of a.log.slice(seen.current)){
     const victim=a.players.find(p=>p.id===e.who)
     booms.current.push({x:e.x,y:e.y,color:victim?.color??'#fff',at:now,text:e.by===1&&e.who!==1?'+1 ⭐':undefined})
     if(e.by===1&&e.who!==1){setFeed({key:a.ticks,text:'You cut '+(victim?.name??'')+'!'});fx('cut',soundRef.current);gameSound('big',soundRef.current,3)}
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
    drawMini(mini.current,a)
   }
   booms.current=booms.current.filter(b=>now-b.at<900)
   draw(canvas.current,a,prev.current,Math.min(1,(now-lastTick)/TICK_MS),kono.current,booms.current,now,stick.current,el.getBoundingClientRect())
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  // The canvas matches the frame's size (sharp on high-density screens).
  const fit=new ResizeObserver(()=>{const c=canvas.current;if(!c)return;const r=el.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr)})
  fit.observe(el)
  return ()=>{cancelAnimationFrame(raf);fit.disconnect();stopMusic();window.removeEventListener('keydown',down);window.removeEventListener('keyup',upKey);el.removeEventListener('pointerdown',pdown);el.removeEventListener('pointermove',pmove);el.removeEventListener('pointerup',pup);el.removeEventListener('pointercancel',pup)}
  // result only reads refs; the mode is fixed for a round (a new one remounts).
 },[]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!feed)return;const t=window.setTimeout(()=>setFeed(f=>f?.key===feed.key&&!out?null:f),1800);return ()=>window.clearTimeout(t)},[feed,out])
 const rank=board.findIndex(b=>b.id===1)+1
 return <div className="break-game paper">
  <div ref={frame} className={'paper-frame'+(out?' is-out':'')}>
   <canvas ref={canvas} role="img" aria-label={'KONO.io map: you own '+mine.toFixed(1)+'%'}/>
   <canvas ref={mini} className="paper-mini" width={N} height={N} aria-hidden="true"/>
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
  <p className="blast-help">{mode==='team'?'You’re on Blue (you have the white ring). Claim land for your team, cut Red’s trails, and have more of the map when the two minutes are up!':'Drag to steer (or point with the mouse, or the arrow keys). Leave your land, loop around and come home to claim it. Don’t let anyone touch your trail!'}</p>
 </div>
}

/** Paints the map around you the way Paper.io 2 does: a pale floor, land as soft rounded shapes standing a
 * little above it (a darker edge shows below), trails as smooth lines, each block gliding with its face,
 * shockwaves where someone was knocked out, and the joystick under your finger. */
function draw(c:HTMLCanvasElement|null,a:Arena,prev:Map<number,{x:number;y:number}>,frac:number,kono:HTMLImageElement|null,booms:Boom[],now:number,stick:{x:number;y:number;fx:number;fy:number}|null,rect:DOMRect){
 const g=c?.getContext('2d');if(!c||!g||!c.width)return
 const me=a.players[0],pos=(id:number,x:number,y:number)=>{const p=prev.get(id);if(!p||Math.hypot(p.x-x,p.y-y)>2)return {x,y};return {x:p.x+(x-p.x)*frac,y:p.y+(y-p.y)*frac}}
 const cam=pos(1,me.x,me.y),cell=Math.max(c.width,c.height)/VIEW,ox=c.width/2-cam.x*cell,oy=c.height/2-cam.y*cell
 const colors=new Map(a.players.map(p=>[p.id,p.color])),lands=a.mode==='team'?new Map(TEAMS.map(t=>[t.id,t.color])):colors
 // Off the map is darker; the floor is pale with a soft dot pattern.
 g.fillStyle='#d5dbea';g.fillRect(0,0,c.width,c.height)
 g.fillStyle='#f4f6fb';g.fillRect(ox,oy,N*cell,N*cell)
 const x0=Math.max(0,Math.floor(-ox/cell)-1),y0=Math.max(0,Math.floor(-oy/cell)-1),x1=Math.min(N,Math.ceil((c.width-ox)/cell)+1),y1=Math.min(N,Math.ceil((c.height-oy)/cell)+1)
 g.fillStyle='rgba(80,100,160,.09)'
 for(let y=y0-(y0%4);y<y1;y+=4)for(let x=x0-(x0%4);x<x1;x+=4){g.beginPath();g.arc(ox+(x+2)*cell,oy+(y+2)*cell,cell*0.16,0,7);g.fill()}
 // Land: a smooth outline for each owner's land. Each square's ownership is softened with its neighbors
 // (1-2-1 weights each way), and the outline is traced where that reaches one half (marching squares,
 // between square centers), so straight edges sit on the squares' sides while corners round off and
 // staircases become smooth diagonals. The same shapes drawn a little lower, darker, are the raised edge.
 const side=cell*0.3
 const gx0=Math.max(0,x0-1),gy0=Math.max(0,y0-1),gx1=Math.min(N,x1+1),gy1=Math.min(N,y1+1),gw=gx1-gx0,gh=gy1-gy0
 const owners=new Set<number>();for(let y=gy0;y<gy1;y++)for(let x=gx0;x<gx1;x++){const o=a.own[y*N+x];if(o)owners.add(o)}
 const shapes:{col:string;path:Path2D}[]=[]
 for(const o of owners){
  const f=new Float32Array(gw*gh),is=(x:number,y:number)=>x>=0&&y>=0&&x<N&&y<N&&a.own[y*N+x]===o?1:0
  for(let y=gy0;y<gy1;y++)for(let x=gx0;x<gx1;x++){
   let v=0
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(is(x+dx,y+dy))v+=(dx?1:2)*(dy?1:2)
   f[(y-gy0)*gw+(x-gx0)]=v/16
  }
  const path=new Path2D(),cx=(x:number)=>ox+(x+0.5)*cell,cy=(y:number)=>oy+(y+0.5)*cell
  for(let y=0;y<gh-1;y++)for(let x=0;x<gw-1;x++){
   const k=y*gw+x,v=[f[k],f[k+1],f[k+gw+1],f[k+gw]]
   if(v[0]<0.5&&v[1]<0.5&&v[2]<0.5&&v[3]<0.5)continue
   const X=gx0+x,Y=gy0+y,corner:[number,number][]=[[cx(X),cy(Y)],[cx(X+1),cy(Y)],[cx(X+1),cy(Y+1)],[cx(X),cy(Y+1)]]
   if(v[0]>=0.5&&v[1]>=0.5&&v[2]>=0.5&&v[3]>=0.5){path.rect(corner[0][0],corner[0][1],cell,cell);continue}
   // Walk the square's corners; keep the ones inside and add the crossing on each edge that changes.
   const poly:[number,number][]=[]
   for(let c=0;c<4;c++){
    const n=(c+1)%4,a0=v[c],a1=v[n]
    if(a0>=0.5)poly.push(corner[c])
    if((a0>=0.5)!==(a1>=0.5)){const t=(0.5-a0)/(a1-a0);poly.push([corner[c][0]+(corner[n][0]-corner[c][0])*t,corner[c][1]+(corner[n][1]-corner[c][1])*t])}
   }
   path.moveTo(poly[0][0],poly[0][1]);for(let q=1;q<poly.length;q++)path.lineTo(poly[q][0],poly[q][1]);path.closePath()
  }
  shapes.push({col:lands.get(o)??'#888',path})
 }
 // Each shape is filled and lightly outlined in its own color, so the pieces join without hairlines.
 g.lineWidth=1.2;g.lineJoin='round'
 for(const {col,path} of shapes){g.save();g.translate(0,side);g.fillStyle=g.strokeStyle=shade(col,-0.3);g.fill(path);g.stroke(path);g.restore()}
 for(const {col,path} of shapes){g.fillStyle=g.strokeStyle=col;g.fill(path);g.stroke(path)}
 // Trails: smooth lines from where each left its land to where it is now.
 g.lineCap='round';g.lineJoin='round'
 for(const p of a.players){
  if(!p.alive||!p.path.length)continue
  const h=pos(p.id,p.x,p.y)
  g.strokeStyle=shade(p.color,0.35);g.globalAlpha=0.85;g.lineWidth=cell*0.62
  g.beginPath();g.moveTo(ox+p.path[0][0]*cell,oy+p.path[0][1]*cell);for(const [x,y] of p.path)g.lineTo(ox+x*cell,oy+y*cell);g.lineTo(ox+h.x*cell,oy+h.y*cell);g.stroke()
  g.globalAlpha=1
 }
 // Players: a block a little bigger than a square, turned the way it's heading, with a face.
 for(const p of a.players){
  if(!p.alive)continue
  const q=pos(p.id,p.x,p.y),px=ox+q.x*cell,py=oy+q.y*cell,s=cell*1.25
  g.save();g.translate(px,py);g.rotate(p.angle+Math.PI/2)
  g.fillStyle=shade(p.color,-0.4);round(g,-s/2,-s/2+side*0.8,s,s,cell*0.28);g.fill()
  g.fillStyle=shade(p.color,0.15);round(g,-s/2,-s/2,s,s,cell*0.28);g.fill()
  g.fillStyle='rgba(255,255,255,.35)';round(g,-s/2+s*0.12,-s/2+s*0.1,s*0.76,s*0.28,cell*0.14);g.fill()
  if(p.id===1&&a.mode==='team'){g.lineWidth=Math.max(2,cell*0.12);g.strokeStyle='#fff';round(g,-s/2,-s/2,s,s,cell*0.28);g.stroke()}
  g.restore()
  if(p.id===1&&kono?.complete&&kono.naturalWidth)g.drawImage(kono,px-s*0.55,py-s*0.75,s*1.1,s*1.1)
  else if(p.face){g.font=Math.round(cell*0.9)+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(p.face,px,py-cell*0.1)}
  g.font='800 '+Math.round(cell*0.55)+'px system-ui';g.textAlign='center';g.textBaseline='bottom';g.lineWidth=4;g.strokeStyle='rgba(255,255,255,.95)';g.strokeText(p.name,px,py-s*0.75);g.fillStyle=shade(p.color,-0.35);g.fillText(p.name,px,py-s*0.75)
 }
 // Knock-outs: a white shockwave ringed in the player's color, and +1 ⭐ when it was your cut.
 for(const b of booms){
  const t=(now-b.at)/900,bx=ox+b.x*cell,by=oy+b.y*cell,rr=cell*(1+t*7)
  g.globalAlpha=Math.max(0,1-t)
  g.fillStyle='rgba(255,255,255,.75)';g.beginPath();g.arc(bx,by,rr,0,7);g.fill()
  g.lineWidth=cell*0.6*(1-t)+2;g.strokeStyle=b.color;g.beginPath();g.arc(bx,by,rr,0,7);g.stroke()
  g.lineWidth=cell*0.3*(1-t)+1;g.strokeStyle='#fff';g.beginPath();g.arc(bx,by,rr*0.55,0,7);g.stroke()
  if(b.text){g.font='900 '+Math.round(cell*1.1)+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.lineWidth=5;g.strokeStyle='#fff';g.strokeText(b.text,bx,by-rr*0.6);g.fillStyle='#ffb02e';g.fillText(b.text,bx,by-rr*0.6)}
  g.globalAlpha=1
 }
 // The joystick, where the finger is.
 if(stick){
  const k=c.width/rect.width,sx=(stick.x-rect.left)*k,sy=(stick.y-rect.top)*k,fx=(stick.fx-rect.left)*k,fy=(stick.fy-rect.top)*k
  g.fillStyle='rgba(30,40,80,.16)';g.beginPath();g.arc(sx,sy,60*k,0,7);g.fill()
  g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(fx,fy,24*k,0,7);g.fill()
 }
}
/** The round minimap: every square of the map, one pixel each, with a dot for you. */
function drawMini(c:HTMLCanvasElement|null,a:Arena){
 const g=c?.getContext('2d');if(!c||!g)return
 const img=g.createImageData(N,N),colors=new Map<number,[number,number,number]>()
 const rgb=(hex:string):[number,number,number]=>{const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255]}
 if(a.mode==='team')for(const t of TEAMS)colors.set(t.id,rgb(t.color));else for(const p of a.players)colors.set(p.id,rgb(p.color))
 for(let i=0;i<N*N;i++){const o=a.own[i],c3=o?colors.get(o):null,k=i*4;img.data[k]=c3?c3[0]:236;img.data[k+1]=c3?c3[1]:240;img.data[k+2]=c3?c3[2]:248;img.data[k+3]=255}
 g.putImageData(img,0,0)
 const me=a.players[0];if(me.alive){g.fillStyle='#fff';g.beginPath();g.arc(me.x,me.y,3.5,0,7);g.fill();g.fillStyle='#1a2a6a';g.beginPath();g.arc(me.x,me.y,2,0,7);g.fill()}
}
function round(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){g.beginPath();g.roundRect(x,y,w,h,r)}
/** A color made lighter (amount > 0) or darker (< 0). */
function shade(hex:string,amount:number){
 const n=parseInt(hex.slice(1),16),f=(v:number)=>Math.round(amount>0?v+(255-v)*amount:v*(1+amount))
 return 'rgb('+f(n>>16&255)+','+f(n>>8&255)+','+f(n&255)+')'
}
