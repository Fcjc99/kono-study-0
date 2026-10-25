import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {COLS,FLOW_CELL,H,HIDDEN,KINDS,ROWS,SPRINT_LINES,ULTRA_MS,cellsOf,ghostOf,hardDrop,holdPiece,move,musicPart,newGame,rotate,shapeCells,softDrop,startFlow,tick,type FlowEvent,type Game,type Kind,type Mode} from '../store/flow'
import {fx,musicSlow,startMusic,stopMusic} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

/** KONO Flow (the rules are in store/flow): falling blocks made of light, drawn on a canvas.
 * The well floats in a drifting field of light that takes on a new color every level; blocks are glowing
 * panes with a bright core; the ghost shows where a shape will land; a hard drop leaves a streak; rows that
 * clear flash and burst into sparks, with a word for the big ones (Double, Triple, Quad, T-spin, Combo,
 * Back to back, Perfect clear). Every move plays a note in the soundtrack's key, so playing adds to the
 * music: five recorded tracks, a new one every three levels (slowed and softened in Flow). In Flow the field stills and turns deep blue, the rows you fill pile up white at the bottom with a
 * count, and when it ends they all burst at once.
 * Modes (picked before each game, each with its own best on this device): Marathon, Sprint (40 lines against
 * the clock), Ultra (three minutes) and Zen (no game over). Every three levels the scene changes with the
 * music: Drift (floating motes), Tide (rolling waves), Pulse (rings on the beat), Aurora (curtains of light)
 * and Zenith (turning rays). Phones that can vibrate tap softly on a lock and harder on clears.
 * Controls: arrow keys (← → move, ↓ soft drop, ↑ or X turn, Z turn back, Space hard drop, C hold, F Flow);
 * on a phone, drag sideways to move, drag down to drop gently, flick down to drop, flick up to hold, tap to
 * turn, or use the buttons. */
// Each shape's light: I cyan, O gold, T violet, S green, Z pink-red, J blue, L orange; Flow rows white.
const COLORS=['#000','#5ef2ff','#ffd84a','#c37bff','#62f08a','#ff5f87','#5b8cff','#ffa14a','#ffffff']
type Spark={x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;color:string}
type Band={y:number;t:number;white?:boolean}
type Word={key:number;text:string;big?:boolean}
const DAS=170,ARR=45,SOFT=40
export default function FlowGame({ref,sound,onEnd}:{ref:Ref<GameHandle>;sound:boolean;onEnd:(r:FlowResult)=>void}){
 // The mode, picked first (the game starts once it's chosen).
 const [mode,setMode]=useState<Mode|null>(null)
 const canvas=useRef<HTMLCanvasElement>(null),game=useRef<Game|null>(null)
 const [hud,setHud]=useState({score:0,lines:0,level:1,flow:0,flowMs:0,flowLines:0,time:0}),[words,setWords]=useState<Word[]>([])
 // The well's size in pixels, from the space actually left on the screen: the full width (less the screen's
 // padding), and the height between the well's top and the meter and buttons below it (CSS alone left it
 // squeezed on some phones). Measured after layout, and again whenever the screen resizes or turns.
 const stage=useRef<HTMLDivElement>(null),below=useRef<HTMLDivElement>(null)
 const [size,setSize]=useState(stageSize)
 useEffect(()=>{
  let raf=0
  const fit=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const top=stage.current?.getBoundingClientRect().top??200,rest=below.current?.getBoundingClientRect().height??90;const next=stageSize(top,rest);setSize(s=>s.w===next.w&&s.h===next.h?s:next)})}
  fit()
  window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);window.addEventListener('orientationchange',fit)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit);window.removeEventListener('orientationchange',fit)}
 },[])
 const vis=useRef<Vis>(newVis())
 // The soundtrack playing (a big Flow can jump two levels, so this is what's compared, not the level before).
 const part=useRef(1)
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),keys=useRef(0)
 const held=useRef<{dir:number;t:number;next:number}|null>(null),soft=useRef(false)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 const result=(s:Game,done:boolean):FlowResult=>({mode:s.mode,score:s.score,lines:s.lines,level:s.level,time:Math.round(s.time),done,best:saveFlowBest(s.mode,done,s.mode==='sprint'?s.time:s.score)})
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;const s=game.current;if(!s){onEndRef.current({mode:'marathon',score:0,lines:0,level:1,time:0,done:false,best:false});return}onEndRef.current(result(s,false))}}),[])
 const say=(text:string,big=false)=>{const key=++keys.current;setWords(w=>[...w.slice(-3),{key,text,big}]);window.setTimeout(()=>setWords(w=>w.filter(x=>x.key!==key)),1400)}
 // What the game says happened: sounds, sparks, flashes and words.
 const onEvent=(e:FlowEvent)=>{
  const s=soundRef.current,p=game.current?.piece,v=vis.current
  if(e.t==='move'||e.t==='rotate')fx('note',s,(p?p.x+(p.rot*2):0)+3)
  else if(e.t==='zen'){say('Fresh start',true);fx('flowOn',s);v.pulse=1.5;buzz([20,40,20])}
  else if(e.t==='hold')fx('whoosh',s)
  else if(e.t==='lock'){
   fx('lock',s);v.shake=Math.max(v.shake,e.drop>2?5:2);buzz(e.drop>2?14:8)
   const color=COLORS[(game.current?.board[(e.cells[0][1])*COLS+e.cells[0][0]])||1]
   for(const [x,y] of e.cells)burst(v,x+0.5,y+0.9,color,4,0.6)
   if(e.drop>1){const xs=e.cells.map(c=>c[0]),ys=e.cells.map(c=>c[1]);v.streaks.push({x0:Math.min(...xs),x1:Math.max(...xs)+1,y0:Math.min(...ys)-e.drop,y1:Math.max(...ys)+1,t:0,color})}
  }else if(e.t==='clear'){
   if(e.count){fx('rows',s,e.count);v.pulse=1;v.shake=e.count>=4?10:4;buzz(e.count>=4?[30,40,60]:[18+e.count*8])
    for(const y of e.rows){v.bands.push({y,t:0});for(let x=0;x<COLS;x++)burst(v,x+0.5,y+0.5,COLORS[1+((x+y)%7)],e.count>=4?7:5,1.4)}}
   const name=['','Single','Double','Triple','Quad'][e.count]
   if(e.tspin)say((e.tspin==='mini'?'T-spin mini':'T-spin')+(name?' '+name.toLowerCase():''),true)
   else if(e.count>=2)say(name,e.count>=4)
   if(e.b2b)say('Back to back!')
   if(e.combo>=2)say('Combo '+e.combo)
   if(e.perfect){say('Perfect clear!',true);fx('mega',s)}
  }else if(e.t==='level'){
   fx('fanfare',s);const p=musicPart(e.level)
   // A new stretch of levels: a new scene and its song.
   if(p!==part.current){part.current=p;startMusic('flow',s,p);say(STAGES[p-1].name,true);v.pulse=2}
   say('Level '+e.level)
  }
  else if(e.t==='flowOn'){fx('flowOn',s);say('Flow',true);musicSlow(true)}
  else if(e.t==='flowStack'){fx('rows',s,Math.min(4,e.rows.length));for(let k=0;k<e.rows.length;k++)v.bands.push({y:H-1-(e.total-1-k),t:0,white:true})}
  else if(e.t==='flowEnd'){
   musicSlow(false)
   if(e.lines){fx('flowEnd',s);say(e.lines+' lines!',true);v.shake=14;v.pulse=1.5
    buzz([40,50,80])
    for(let k=0;k<e.lines;k++){const y=H-1-k;v.bands.push({y,t:0,white:true});for(let x=0;x<COLS;x++)burst(v,x+0.5,y+0.5,'#ffffff',6,1.8)}}
  }else if(e.t==='over'||e.t==='done'){
   stopMusic();fx(e.t==='done'?'fanfare':'thud',s);buzz(e.t==='done'?[30,60,30,60,90]:200)
   if(e.t==='done')say(game.current?.mode==='sprint'?'Finish!':'Time!',true)
   if(!ended.current){ended.current=true;const st=game.current!,r=result(st,e.t==='done');window.setTimeout(()=>onEndRef.current(r),1400)}
  }
 }
 // Doing something: the game moves, and anything it says is heard and seen at once.
 const act=(f:(s:Game)=>unknown)=>{const s=game.current;if(!s||s.over||ended.current)return;f(s);for(const e of s.events.splice(0))onEvent(e)}
 const actRef=useRef(act)
 useEffect(()=>{actRef.current=act})
 useEffect(()=>{
  if(!mode)return
  game.current=newGame(Math.random,mode)
  // Every game starts on the first song, so the songs change at the same levels again.
  part.current=1
  startMusic('flow',soundRef.current,1)
  const down=(e:KeyboardEvent)=>{
   const k=e.code,A=actRef.current
   if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space'].includes(k))e.preventDefault()
   if(e.repeat)return
   if(k==='ArrowLeft'||k==='ArrowRight'){const dir=k==='ArrowLeft'?-1:1;A(s=>move(s,dir));held.current={dir,t:0,next:DAS}}
   else if(k==='ArrowDown')soft.current=true
   else if(k==='ArrowUp'||k==='KeyX')A(s=>rotate(s,1))
   else if(k==='KeyZ'||k==='ControlLeft')A(s=>rotate(s,-1))
   else if(k==='Space')A(s=>hardDrop(s))
   else if(k==='KeyC'||k==='ShiftLeft')A(s=>holdPiece(s))
   else if(k==='KeyF'||k==='KeyE')A(s=>startFlow(s))
  }
  const up=(e:KeyboardEvent)=>{
   if((e.code==='ArrowLeft'&&held.current?.dir===-1)||(e.code==='ArrowRight'&&held.current?.dir===1))held.current=null
   if(e.code==='ArrowDown')soft.current=false
  }
  window.addEventListener('keydown',down);window.addEventListener('keyup',up)
  let raf=0,last=performance.now(),softT=0,shown=''
  const loop=(now:number)=>{
   const dt=Math.min(50,now-last);last=now
   const A=actRef.current
   // Held keys: auto-shift after a short wait, and soft drop while ↓ is down.
   const h=held.current
   if(h){h.t+=dt;while(h.t>=h.next){h.next+=ARR;A(s=>move(s,h.dir))}}
   if(soft.current){softT+=dt;while(softT>=SOFT){softT-=SOFT;A(s=>softDrop(s))}}else softT=0
   A(s=>tick(s,dt))
   const s=game.current!
   const next={score:s.score,lines:s.lines,level:s.level,flow:s.flow,flowMs:Math.ceil(Math.max(0,s.flowMs)/1000),flowLines:s.flowLines,time:Math.floor(s.time/100)},key=JSON.stringify(next)
   if(key!==shown){shown=key;setHud(next)}
   draw(canvas.current,s,dt,vis.current)
   // The falling shape's column, for the tests (no render).
   if(canvas.current&&s.piece)canvas.current.dataset.col=String(s.piece.x)
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);stopMusic()}
 },[mode])
 // ---- Touch: drag to move, drag down to drop gently, flick down to drop, flick up to hold, tap to turn ----
 const touch=useRef<{x:number;y:number;t:number;mx:number;my:number;moved:boolean;axis:'x'|'y'|null}|null>(null)
 const cellPx=()=>{const c=canvas.current;if(!c)return 30;const r=c.getBoundingClientRect();return Math.min(r.width/LAYOUT.w,r.height/LAYOUT.h)}
 const pdown=(e:React.PointerEvent)=>{e.currentTarget.setPointerCapture(e.pointerId);touch.current={x:e.clientX,y:e.clientY,t:performance.now(),mx:e.clientX,my:e.clientY,moved:false,axis:null}}
 const pmove=(e:React.PointerEvent)=>{
  const t=touch.current;if(!t)return
  const cell=cellPx(),c=cell*0.9
  // Small wobbles of a finger tapping don't count as a drag.
  if(!t.moved&&Math.hypot(e.clientX-t.x,e.clientY-t.y)<cell*0.5)return
  // A drag goes one way: sideways moves the piece between lanes, down drops it. Once it's going down, a finger
  // drifting sideways (as a flick does) never shifts the lane. A sideways drag can still turn into a drop.
  const dx=e.clientX-t.mx,dy=e.clientY-t.my
  if(!t.axis)t.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y'
  else if(t.axis==='x'&&dy>cell*1.5&&dy>Math.abs(dx)*2)t.axis='y'
  t.moved=true
  if(t.axis==='x'){
   while(e.clientX-t.mx>=c){t.mx+=c;act(s=>move(s,1))}
   while(t.mx-e.clientX>=c){t.mx-=c;act(s=>move(s,-1))}
  }else while(e.clientY-t.my>=c){t.my+=c;act(s=>softDrop(s))}
 }
 const pup=(e:React.PointerEvent)=>{
  const t=touch.current;touch.current=null;if(!t)return
  const dt=performance.now()-t.t,dy=e.clientY-t.y,dx=e.clientX-t.x,v=dy/Math.max(1,dt)
  if(dy>cellPx()*1.5&&v>0.9)act(s=>hardDrop(s))
  else if(-dy>cellPx()*1.5&&-dy>Math.abs(dx)*1.5)act(s=>holdPiece(s))
  // A tap (a short touch that hardly moved) turns the shape, wherever it lands on the well.
  else if(!t.moved&&Math.hypot(dx,dy)<cellPx()*0.6&&dt<450)act(s=>rotate(s,1))
 }
 const can=hud.flow>=0.25&&!hud.flowMs
 const secs=hud.time/10
 return <div className="break-game flow-game" style={{'--fw':size.w+'px'} as React.CSSProperties}>
  <div className="blast-top">
   <span className="blast-best">{mode==='sprint'?clockText(secs*1000,true):mode==='ultra'?'⏱ '+clockText(Math.max(0,ULTRA_MS-secs*1000)):mode==='zen'?'Zen · level '+hud.level:'Level '+hud.level}</span>
   <span className="blast-coins">{mode==='sprint'?hud.lines+' / '+SPRINT_LINES:hud.lines+' line'+(hud.lines===1?'':'s')}</span>
   <strong className="blast-score" aria-label={'Score '+hud.score}>{hud.score.toLocaleString()}</strong>
  </div>
  <div ref={stage} className="flow-stage" style={{width:size.w,height:size.h}}>
   <canvas ref={canvas} className="flow-canvas" style={{width:size.w,height:size.h}} aria-label="KONO Flow well" role="img" onPointerDown={pdown} onPointerMove={pmove} onPointerUp={pup} onPointerCancel={()=>{touch.current=null}}/>
   {hud.flowMs>0&&<p className="flow-count" aria-live="polite"><b>{hud.flowLines}</b><small>lines · {hud.flowMs}s</small></p>}
   {!mode&&<div className="flow-modes" role="group" aria-label="Choose a mode">
    <p>Choose a mode</p>
    {MODES.map(m=><button key={m.id} type="button" onClick={()=>setMode(m.id)}><b>{m.name}</b><small>{m.how}</small>{flowBestText(m.id)&&<i>{flowBestText(m.id)}</i>}</button>)}
   </div>}
   <div className="flow-words" aria-live="polite">{words.map(w=><p key={w.key} className={w.big?'is-big':''}>{w.text}</p>)}</div>
  </div>
  <div ref={below} className="flow-below">
  <div className="flow-meter" role="meter" aria-label="Flow" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.flow*100)}><span style={{width:(hud.flowMs?100:hud.flow*100)+'%'}} className={hud.flowMs?'is-on':can?'is-ready':''}/>{[0.25,0.5,0.75].map(q=><i key={q} style={{left:q*100+'%'}}/>)}</div>
  <div className="flow-pad">
   <button type="button" onClick={()=>act(s=>holdPiece(s))}>Hold</button>
   <button type="button" aria-label="Turn left" onClick={()=>act(s=>rotate(s,-1))}>↺</button>
   <button type="button" aria-label="Move left" onClick={()=>act(s=>move(s,-1))}>◀</button>
   <button type="button" aria-label="Drop" onClick={()=>act(s=>hardDrop(s))}>⤓</button>
   <button type="button" aria-label="Move right" onClick={()=>act(s=>move(s,1))}>▶</button>
   <button type="button" aria-label="Turn right" onClick={()=>act(s=>rotate(s,1))}>↻</button>
   <button type="button" className={'flow-go'+(can?' is-ready':'')} disabled={!can} onClick={()=>act(s=>startFlow(s))}>Flow</button>
  </div>
  <p className="blast-help">Drag to move · tap to turn · flick down to drop · flick up to hold. Keys: ← → ↓, ↑/X/Z turn, Space drop, C hold, F Flow.</p>
  </div>
 </div>
}
/** What the drawing keeps from frame to frame (outside React): sparks, flashes, streaks, the field of light,
 * the block images, the background's color, and how much the well is shaking or pulsing. */
type Vis={sparks:Spark[];bands:Band[];streaks:{x0:number;x1:number;y0:number;y1:number;t:number;color:string}[];sprites:HTMLCanvasElement[];spriteSize:number;field:{x:number;y:number;z:number}[];hue:number;clock:number;shake:number;pulse:number}
const newVis=():Vis=>({sparks:[],bands:[],streaks:[],sprites:[],spriteSize:0,field:[],hue:220,clock:0,shake:0,pulse:0})
function burst(v:Vis,x:number,y:number,color:string,n:number,speed:number){
 for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,sp=(0.02+Math.random()*0.06)*speed;v.sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.02*speed,life:0,max:30+Math.random()*30,size:0.08+Math.random()*0.14,color})}
 if(v.sparks.length>1400)v.sparks.splice(0,v.sparks.length-1400)
}
/** Draws a frame: the field of light, the well and its blocks, the ghost, effects, hold and next. */
function draw(c:HTMLCanvasElement|null,s:Game,dt:number,v:Vis){
  if(!c)return
  const r=c.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr)
  if(c.width!==w||c.height!==h){c.width=w;c.height=h}
  const x=c.getContext('2d');if(!x)return
  v.clock+=dt
  // Cells fit whatever box the canvas is given (the whole layout always shows), centred across it.
  const cs=Math.min(w/LAYOUT.w,h/LAYOUT.h),ox=(w-LAYOUT.w*cs)/2+LAYOUT.side*cs,oy=LAYOUT.top*cs
  if(v.spriteSize!==Math.round(cs)){v.spriteSize=Math.round(cs);v.sprites=COLORS.map(col=>blockSprite(Math.round(cs),col))}
  // The field of light: points drifting toward you, faster with each level; it stills and turns deep blue in Flow.
  const inFlow=s.flowMs>0,stg=STAGES[musicPart(s.level)-1],target=inFlow?225:stg.hue
  v.hue+=((target-v.hue+540)%360-180)*0.02
  const bg=x.createRadialGradient(w/2,h*0.45,0,w/2,h*0.45,Math.max(w,h)*0.75)
  bg.addColorStop(0,'hsl('+v.hue+' 70% '+(inFlow?14:18+v.pulse*10)+'%)');bg.addColorStop(1,'hsl('+(v.hue+40)+' 80% 4%)')
  x.fillStyle=bg;x.fillRect(0,0,w,h)
  if(!v.field.length)v.field=Array.from({length:140},()=>({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random()}))
  const speed=inFlow?0.00002:0.00008+s.level*0.00002
  x.globalCompositeOperation='lighter'
  for(const p of v.field){
   p.z-=speed*dt*(1+v.pulse*3);if(p.z<=0.02){p.x=Math.random()*2-1;p.y=Math.random()*2-1;p.z=1}
   const px=w/2+p.x/p.z*w*0.25,py=h*0.45+p.y/p.z*h*0.25,size=(1-p.z)*3*dpr
   x.fillStyle='hsla('+(v.hue+p.x*60)+' 90% 75% / '+(1-p.z)*0.8+')';x.fillRect(px,py,size,size)
  }
  if(!inFlow)scene(x,stg.motif,w,h,dpr,v)
  x.globalCompositeOperation='source-over'
  v.pulse=Math.max(0,v.pulse-dt/700)
  // The well (shaken a little by hard drops and big clears).
  const sk=v.shake*dpr;v.shake=Math.max(0,v.shake-dt/40)
  x.save();x.translate((Math.random()-0.5)*sk,(Math.random()-0.5)*sk)
  x.fillStyle='rgba(4,6,20,.55)';x.fillRect(ox,oy,COLS*cs,ROWS*cs)
  x.strokeStyle='hsla('+v.hue+' 90% 75% / .7)';x.lineWidth=2*dpr;x.shadowColor='hsl('+v.hue+' 90% 65%)';x.shadowBlur=14*dpr
  x.strokeRect(ox-dpr,oy-dpr,COLS*cs+2*dpr,ROWS*cs+2*dpr);x.shadowBlur=0
  x.strokeStyle='rgba(255,255,255,.04)';x.lineWidth=1
  for(let i=1;i<COLS;i++){x.beginPath();x.moveTo(ox+i*cs,oy);x.lineTo(ox+i*cs,oy+ROWS*cs);x.stroke()}
  for(let j=1;j<ROWS;j++){x.beginPath();x.moveTo(ox,oy+j*cs);x.lineTo(ox+COLS*cs,oy+j*cs);x.stroke()}
  const cell=(cx:number,cy:number,kv:number,alpha=1)=>{if(cy<HIDDEN)return;x.globalAlpha=alpha;x.drawImage(v.sprites[kv],ox+cx*cs,oy+(cy-HIDDEN)*cs,cs,cs);x.globalAlpha=1}
  for(let cy=HIDDEN;cy<H;cy++)for(let cx=0;cx<COLS;cx++){const kv=s.board[cy*COLS+cx];if(kv)cell(cx,cy,kv,s.over?0.35:kv===FLOW_CELL?0.75+0.25*Math.sin(v.clock/120+cy):1)}
  if(s.piece){
   const gh=ghostOf(s),kv=KINDS.indexOf(s.piece.kind)+1
   if(gh){x.strokeStyle=COLORS[kv];x.globalAlpha=0.55;x.lineWidth=2*dpr;for(const [gx,gy] of cellsOf(gh))if(gy>=HIDDEN)x.strokeRect(ox+gx*cs+3*dpr,oy+(gy-HIDDEN)*cs+3*dpr,cs-6*dpr,cs-6*dpr);x.globalAlpha=1}
   for(const [px,py] of cellsOf(s.piece))cell(px,py,kv)
  }
  // Hard-drop streaks, cleared-row flashes, sparks.
  x.globalCompositeOperation='lighter'
  for(const st of v.streaks){st.t+=dt;const k=1-st.t/260;if(k<=0)continue;const g=x.createLinearGradient(0,oy+(st.y0-HIDDEN)*cs,0,oy+(st.y1-HIDDEN)*cs);g.addColorStop(0,'transparent');g.addColorStop(1,st.color);x.globalAlpha=k*0.6;x.fillStyle=g;x.fillRect(ox+st.x0*cs,oy+Math.max(0,st.y0-HIDDEN)*cs,(st.x1-st.x0)*cs,(st.y1-Math.max(HIDDEN,st.y0))*cs)}
  v.streaks=v.streaks.filter(st=>st.t<260)
  for(const b of v.bands){b.t+=dt;const k=1-b.t/380;if(k<=0)continue;x.globalAlpha=k;x.fillStyle=b.white?'#fff':'hsl('+v.hue+' 100% 85%)';const grow=(1-k)*cs*0.6;x.fillRect(ox-grow,oy+(b.y-HIDDEN)*cs+cs*0.5*(1-k),COLS*cs+grow*2,cs*k)}
  v.bands=v.bands.filter(b=>b.t<380)
  x.globalAlpha=1
  const list=v.sparks
  for(let i=list.length-1;i>=0;i--){
   const p=list[i];p.life+=dt/16;if(p.life>=p.max){list.splice(i,1);continue}
   p.vy+=0.0025;p.x+=p.vx*dt/16;p.y+=p.vy*dt/16
   const k=1-p.life/p.max;x.globalAlpha=k;x.fillStyle=p.color
   const sz=p.size*cs*(0.5+k*0.5);x.fillRect(ox+p.x*cs-sz/2,oy+(p.y-HIDDEN)*cs-sz/2,sz,sz)
  }
  x.globalAlpha=1;x.globalCompositeOperation='source-over'
  x.restore()
  // Hold (left) and the next five (right).
  const mini=(k:Kind|null,bx:number,by:number,size:number,dim=false)=>{
   if(!k)return
   const cellsK=shapeCells(k),minX=Math.min(...cellsK.map(c=>c[0])),maxX=Math.max(...cellsK.map(c=>c[0])),minY=Math.min(...cellsK.map(c=>c[1])),maxY=Math.max(...cellsK.map(c=>c[1]))
   const cx=bx-(maxX-minX+1)*size/2,cy=by-(maxY-minY+1)*size/2
   x.globalAlpha=dim?0.35:1
   for(const [a,b] of cellsK)x.drawImage(v.sprites[KINDS.indexOf(k)+1],cx+(a-minX)*size,cy+(b-minY)*size,size,size)
   x.globalAlpha=1
  }
  x.fillStyle='rgba(255,255,255,.75)';x.font=Math.round(cs*0.42)+'px system-ui, sans-serif';x.textAlign='center'
  x.fillText('HOLD',ox-LAYOUT.side*cs/2,oy+cs*0.5);mini(s.hold,ox-LAYOUT.side*cs/2,oy+cs*1.6,cs*0.5,!s.canHold)
  const rx=ox+COLS*cs+LAYOUT.side*cs/2
  x.fillText('NEXT',rx,oy+cs*0.5)
  s.queue.slice(0,5).forEach((k,i)=>mini(k,rx,oy+cs*(1.6+i*2.1),cs*(i?0.4:0.52)))
 }
/** The well's box: the full width (up to 520 px), and as tall as its proportions want or the room between
 * `top` (where the well starts) and the controls below (`rest` tall) allows, whichever is less. The drawing
 * fits its cells to the box and centres them, so a short screen still shows the whole well. */
function stageSize(top=200,rest=90){
 const vw=window.visualViewport?.width??window.innerWidth,vh=window.visualViewport?.height??window.innerHeight
 // The screen's body has 12 px of padding each side (and the phone's safe area at the bottom).
 const w=Math.round(Math.max(240,Math.min(520,vw-28)))
 const room=vh-top-rest-20
 return {w,h:Math.round(Math.max(260,Math.min(w*LAYOUT.h/LAYOUT.w,room)))}
}
/** How a game went, for the results card: the mode, score, lines, level, time played (ms), whether it was
 * finished (Sprint's 40 lines, Ultra's three minutes) and whether it's a new best for the mode. */
export type FlowResult={mode:Mode;score:number;lines:number;level:number;time:number;done:boolean;best:boolean}
const MODES:{id:Mode;name:string;how:string}[]=[
 {id:'marathon',name:'Marathon',how:'Play until the well fills. Faster every 10 lines.'},
 {id:'sprint',name:'Sprint',how:'Clear '+SPRINT_LINES+' lines as fast as you can.'},
 {id:'ultra',name:'Ultra',how:'As many points as you can in 3 minutes.'},
 {id:'zen',name:'Zen',how:'No game over. Just play.'},
]
/** The five scenes, one for each soundtrack (every three levels): a color, and what moves in the background. */
const STAGES:{name:string;hue:number;motif:'drift'|'tide'|'pulse'|'aurora'|'zenith'}[]=[
 {name:'Drift',hue:225,motif:'drift'},{name:'Tide',hue:190,motif:'tide'},{name:'Pulse',hue:300,motif:'pulse'},{name:'Aurora',hue:150,motif:'aurora'},{name:'Zenith',hue:28,motif:'zenith'},
]
/** A stage's moving background, drawn over the field of light (adding light). */
function scene(x:CanvasRenderingContext2D,motif:string,w:number,h:number,dpr:number,v:Vis){
 const t=v.clock/1000
 if(motif==='tide'){
  // Rolling waves across the lower half.
  for(let k=0;k<4;k++){x.beginPath();const y0=h*(0.55+k*0.11);x.moveTo(0,h);for(let px=0;px<=w;px+=8*dpr)x.lineTo(px,y0+Math.sin(px/(w/3)+t*(0.6+k*0.25)+k)*h*0.03);x.lineTo(w,h);x.closePath();x.fillStyle='hsla('+(185+k*8)+' 90% 60% / '+(0.05+k*0.02)+')';x.fill()}
 }else if(motif==='pulse'){
  // Rings from the middle on the beat (the third track runs at about 112 beats a minute).
  const beat=60/112
  for(let k=0;k<3;k++){const ph=((t/beat)+k/3)%1;x.beginPath();x.arc(w/2,h*0.45,ph*Math.max(w,h)*0.7,0,Math.PI*2);x.strokeStyle='hsla(305 100% 70% / '+(1-ph)*0.35+')';x.lineWidth=(3+v.pulse*4)*dpr;x.stroke()}
 }else if(motif==='aurora'){
  // Curtains of light swaying across the top.
  for(let k=0;k<3;k++){const g=x.createLinearGradient(0,0,0,h*0.6);g.addColorStop(0,'hsla('+(140+k*45)+' 90% 60% / 0)');g.addColorStop(0.5,'hsla('+(140+k*45)+' 90% 60% / .16)');g.addColorStop(1,'hsla('+(140+k*45)+' 90% 60% / 0)');x.fillStyle=g
   x.beginPath();x.moveTo(0,0);for(let px=0;px<=w;px+=10*dpr)x.lineTo(px,h*(0.25+0.12*Math.sin(px/(w/2.2)+t*0.5+k*1.7)));x.lineTo(w,0);x.closePath();x.fill()}
 }else if(motif==='zenith'){
  // Rays turning slowly about the middle.
  x.save();x.translate(w/2,h*0.45);x.rotate(t*0.15)
  for(let k=0;k<12;k++){x.rotate(Math.PI/6);x.beginPath();x.moveTo(0,0);x.lineTo(Math.max(w,h),-w*0.05);x.lineTo(Math.max(w,h),w*0.05);x.closePath();x.fillStyle='hsla(45 100% 70% / '+(0.04+v.pulse*0.03)+')';x.fill()}
  x.restore()
 }
}
/** A short vibration, on phones that can (an Android phone; iPhones' browsers don't let pages vibrate). */
function buzz(pattern:number|number[]){try{navigator.vibrate?.(pattern)}catch{/* not allowed */}}
const clockText=(ms:number,tenths=false)=>{const s=Math.max(0,ms)/1000,m=Math.floor(s/60),r=s-m*60;return m+':'+(tenths?r.toFixed(1).padStart(4,'0'):String(Math.ceil(r)===60?59:Math.floor(r)).padStart(2,'0'))}
/** Each mode's best on this device: the fastest finished Sprint, else the highest score. */
const bestKey=(m:Mode)=>'kono-flow-best:'+m
function readFlowBest(m:Mode):number|null{try{const v=localStorage.getItem(bestKey(m));return v===null?null:Number(v)}catch{return null}}
function saveFlowBest(m:Mode,done:boolean,value:number):boolean{
 if(m==='sprint'&&!done)return false
 const old=readFlowBest(m),better=old===null||(m==='sprint'?value<old:value>old)
 if(better&&value>0)try{localStorage.setItem(bestKey(m),String(Math.round(value)))}catch{/* storage unavailable */}
 return better&&value>0
}
function flowBestText(m:Mode){const b=readFlowBest(m);return b===null?'':'Best: '+(m==='sprint'?clockText(b,true):b.toLocaleString())}
/** The canvas in cells: the well (10 × 20) with a column for hold on the left and the queue on the right. */
const LAYOUT={side:3.2,top:0.4,w:COLS+6.4,h:ROWS+0.8}
/** A block of light: a rounded pane, darker at the rim and bright in the middle, with a glint. */
function blockSprite(size:number,color:string):HTMLCanvasElement{
 const c=document.createElement('canvas');c.width=c.height=size
 const x=c.getContext('2d');if(!x)return c
 const p=Math.max(1,size*0.06),r=size*0.18
 x.beginPath();x.roundRect(p,p,size-2*p,size-2*p,r)
 const g=x.createRadialGradient(size*0.45,size*0.4,size*0.05,size/2,size/2,size*0.7)
 g.addColorStop(0,'#ffffff');g.addColorStop(0.25,color);g.addColorStop(1,shade(color,-0.55))
 x.fillStyle=g;x.shadowColor=color;x.shadowBlur=size*0.35;x.fill();x.shadowBlur=0
 x.lineWidth=Math.max(1,size*0.06);x.strokeStyle=shade(color,0.35);x.stroke()
 x.globalAlpha=0.55;x.fillStyle='#fff';x.beginPath();x.roundRect(size*0.2,size*0.16,size*0.42,size*0.12,size*0.06);x.fill()
 return c
}
function shade(hex:string,k:number){const n=parseInt(hex.slice(1),16),f=(v:number)=>Math.round(k<0?v*(1+k):v+(255-v)*k);return 'rgb('+f((n>>16)&255)+','+f((n>>8)&255)+','+f(n&255)+')'}
