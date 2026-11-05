import {useEffect,useId,useRef,useState,type RefObject} from 'react'
import type {RevealMode} from '../store/bonusReveals'
import './bonusDraw.css'
import {BonusCanvas} from './BonusCanvas'
import {CHANCE_FRAMES,CHANCE_POCKETS,DISH,DISH_FRAMES,isWinPocket,type Cove} from '../store/pusher'

export type BonusPresentation={kind:'dish'|'chance';resolved:boolean;labels:string[];selected:number;active:number;label:string;waiting:number;progress:number;armed?:boolean;launchId?:number;resultAge?:number}
/** Presentation of the already selected software result. There is deliberately
 * no stop control, extra random draw, near-miss bounce or physical-odds claim. */
export function bonusPresentation(c:Cove):BonusPresentation|null{
 const result=c.bonusResult,kind=result?.kind??(c.chance?'chance':c.dish?'dish':null)
 if(!kind)return null
 const draw=kind==='dish'?c.dish:c.chance,selected=result?.pocket??draw!.pocket
 const duration=kind==='dish'?DISH_FRAMES:CHANCE_FRAMES
 const progress=result?1:Math.min(1,Math.max(0,(c.frame-draw!.at)/duration))
 const labels=kind==='dish'?DISH.map(p=>p.label):Array.from({length:CHANCE_POCKETS},(_,i)=>isWinPocket(i,result?.winPockets??c.winPockets)?'JP':'+10')
 const steps=labels.length*3+selected,ease=1-(1-progress)**3
 return {kind,resolved:!!result,labels,selected,active:result?selected:Math.floor(steps*ease)%labels.length,
  label:result?.label??(kind==='dish'?'Captured ball → ball challenge':'Qualified → jackpot chance'),waiting:c.dishQueue+c.chanceQueue,progress,armed:!result&&c.frame<draw!.at,launchId:draw?.launchId,resultAge:result?c.frame-result.at:0}
}

/** Continuous pose from the authoritative rules frame. No timers or extra RNG.
 * Entry joins the orbit tangentially, then decelerates into the selected pocket. */
export function bowlPose(draw:BonusPresentation,motion:RevealMode,lag=0){
 const p=Math.max(0,draw.progress-lag),moving=motion!=='off',selected=draw.selected*Math.PI*2/draw.labels.length-Math.PI/2
 if(draw.resolved)return {x:110+72*Math.cos(selected),y:110+72*Math.sin(selected),angle:selected*180/Math.PI,scale:1}
 if(!moving||draw.armed)return {x:110,y:25,angle:0,scale:1}
 const entry=Math.min(1,p/.12),t=Math.min(1,Math.max(0,(p-.12)/.80)),turns=motion==='full'?3:1
 const angle=-Math.PI/2+(turns*Math.PI*2+selected+Math.PI/2)*(1-(1-t)**3)
 const radius=72+12*Math.sin(Math.PI*t)
 return {x:110+radius*Math.cos(angle),y:p<.12?25+13*entry*entry:110+radius*Math.sin(angle),angle:angle*180/Math.PI,scale:p>.92?1-.16*Math.sin((p-.92)/.08*Math.PI):1}
}
export function DrawBowl({draw,large=false,motion='off',svgRef}:{draw:BonusPresentation;large?:boolean;motion?:RevealMode;svgRef?:RefObject<SVGSVGElement|null>}){
 const id=useId().replace(/:/g,'')
 const pose=bowlPose(draw,motion)
 return <svg ref={svgRef} className={'cove-draw-bowl'+(large?' is-large':'')} viewBox="0 0 220 220" aria-hidden="true">
  <defs><radialGradient id={id+'b'}><stop stopColor="#715785"/><stop offset=".65" stopColor="#382b51"/><stop offset="1" stopColor="#15293b"/></radialGradient><radialGradient id={id+'o'} cx="30%" cy="25%"><stop stopColor="#fff7ff"/><stop offset=".3" stopColor="#ddc5fc"/><stop offset="1" stopColor="#8b5ebd"/></radialGradient></defs>
  <circle cx="110" cy="110" r="104" fill="#c19b5c"/><circle cx="110" cy="110" r="99" fill={'url(#'+id+'b)'} stroke="#ffe6a3" strokeWidth="2"/>
  <g data-bowl-rotor="" transform={`rotate(${pose.angle} 110 110)`}><path d="M110 59V67M161 110H153M110 161V153M59 110H67" stroke="#ffdd92" strokeWidth="4" strokeLinecap="round"/></g><circle cx="110" cy="110" r="46" fill="#152b3c" stroke="#bca06d" strokeWidth="2"/><path d="M97 100Q110 88 123 100L119 120H101Z" fill="#e6b3b2" stroke="#ffe4b7" strokeWidth="2"/><path d="M110 94V119M101 97L106 120M119 97L114 120" stroke="#986a7d" strokeWidth="2"/>
  {draw.labels.map((label,i)=>{const a=i*Math.PI*2/draw.labels.length-Math.PI/2,px=110+72*Math.cos(a),py=110+72*Math.sin(a),chosen=draw.resolved&&i===draw.selected;return <g key={i}><circle cx={px} cy={py} r={draw.labels.length===8?23:19} fill={chosen?'#f9d87d':label.includes('JP')?'#6c517b':'#294759'} stroke={chosen?'#fff2bc':'#ad916a'} strokeWidth={chosen?3:1}/>{large&&<text x={px} y={py+3} textAnchor="middle" fill={chosen?'#49372c':'#fff0d2'} fontSize={label.length>5?8:11} fontWeight="750">{label}</text>}</g>})}
  {!large&&<>{[.018,.036,.054].map((lag,i)=>{const trail=bowlPose(draw,motion,lag);return <circle key={lag} data-bowl-trail={i} cx={trail.x} cy={trail.y} r={8-i*2} fill="#f4c9ff" opacity={motion==='off'||draw.armed||draw.resolved?0:.22-i*.05}/>})}<g data-bowl-ball="" transform={`translate(${pose.x} ${pose.y}) scale(${pose.scale})`}><ellipse cy="9" rx="11" ry="5" fill="#100e27" opacity=".55"/><circle r="12" fill={'url(#'+id+'o)'} stroke="#fff1ff" strokeWidth="2"/><path d="M-6-4Q-3-9 2-8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></g></>}

 </svg>
}
/** Wide, frame-driven animation stage. Decorative reward travel never adds medals. */
export function drawScenePose(draw:BonusPresentation,motion:RevealMode){
 const moving=motion!=='off',p=draw.progress,entry=Math.min(1,p/.18),b=bowlPose({...draw,progress:.12+Math.max(0,(p-.18)/.82)*.88},motion)
 const orbit={x:238+(b.x-110)*.53,y:53+(b.y-110)*.53}
 const x=draw.armed?47:p<.18?47+191*entry:orbit.x
 const y=draw.armed?67:p<.18?67-52*Math.sin(entry*Math.PI/2):orbit.y
 const age=moving?Math.min(1,(draw.resultAge??0)/75):1
 return {x:moving||draw.resolved?x:47,y:moving||draw.resolved?y:67,rot:moving&&!draw.armed?b.angle:0,
  gate:!moving||draw.armed?0:Math.min(1,p/.08),reveal:draw.resolved?age:0}
}
/** KONO acts out the captured-ball reward. Sprite frames follow simulation time,
 * not an independent video clock; this scene cannot award or reroll anything. */
export function konoScenePose(draw:BonusPresentation,motion:RevealMode){
 const active=motion!=='off',p=draw.armed?0:active?draw.progress:.5,t=draw.resolved?1:Math.min(1,p/.65)
 const age=draw.resultAge??0,frame=active?Math.floor((draw.resolved?age:p*180)/12)%4:0
 return {x:draw.resolved?250:210+40*t,y:active&&!draw.armed&&!draw.resolved?Math.sin(p*40)*2:0,
 frame,sprite:draw.resolved?'cheer':draw.armed?'wave':'breathe',lid:draw.resolved?1:Math.max(0,(p-.7)/.3),
 ball:!draw.resolved,celebrate:draw.resolved&&active?Math.sin(Math.min(age/60,1)*Math.PI)*7:0}
}
/** Bounded, deterministic story choreography. The label chooses the scene,
 * never the reverse: illustrated medals are not physical delivery or wallet credit. */
export function rewardStory(draw:BonusPresentation,motion:RevealMode){
 const label=draw.labels[draw.selected]??'',kind=label.includes('JP')?'portal':label.includes('Tower')?'tower':'coins'
 const age=motion==='off'?75:Math.max(0,draw.resultAge??0),q=Math.min(1,age/75)
 return {kind,q,age,visible:draw.resolved,beam:draw.resolved?Math.min(1,q*4):0,
  rings:draw.resolved?Math.min(6,Math.floor(q*7)+1):0,
  boatX:draw.resolved?305+Math.sin(q*Math.PI)*10:305,
  particles:Array.from({length:8},(_,i)=>{const t=Math.max(0,Math.min(1,(q-i*.045)/.6));return {x:322+(i-3.5)*10*t,y:59-55*Math.sin(t*Math.PI)+24*t,scale:.35+Math.abs(Math.cos(t*9+i))*.65,opacity:draw.resolved&&q>i*.045?1:0}})}
}
export function DrawScene({draw,motion,svgRef}:{draw:BonusPresentation;motion:RevealMode;svgRef:RefObject<SVGSVGElement|null>}){
 const pose=konoScenePose(draw,motion),story=rewardStory(draw,motion)
 return <svg ref={svgRef} className="cove-draw-scene" viewBox="0 0 440 104" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
 <defs><linearGradient id="kono-scene-sky" x2="0" y2="1"><stop stopColor="#34405e"/><stop offset="1" stopColor="#746887"/></linearGradient></defs>
 <path d="M0 0H440V104H0Z" fill="url(#kono-scene-sky)"/>
 <circle cx="365" cy="22" r="13" fill="#f8dfb4" opacity=".7"/>
 <path d="M0 70L68 22L126 65L192 32L275 76L336 42L440 78V104H0Z" fill="#98acb8" opacity=".18"/>
 <path d="M0 85Q110 77 220 85T440 85V104H0Z" fill="#477c7c"/>
 <path d="M0 97Q120 87 240 96T440 96" stroke="#b4aa9a" strokeWidth="5" fill="none" opacity=".5"/>
 <g data-story-beam="" opacity={story.beam*.4}><path d="M306 78L279 6H366L338 78Z" fill="#ffe6a8"/></g>
 <g data-story-portal="" opacity={draw.resolved&&story.kind==='portal'?1:0} transform="translate(322 45)"><ellipse rx="29" ry="36" fill="#8b74be" stroke="#efcaff" strokeWidth="3"/><ellipse rx="19" ry="27" fill="#404577"/><path d="M0-16L5-5L17 0L5 5L0 16L-5 5L-17 0L-5-5Z" fill="#ffe3a0"/><g data-story-orbit=""><circle cx="29" r="4" fill="#fff3c2"/><circle cx="-29" r="4" fill="#fff3c2"/></g></g>
 <g data-story-tower="" opacity={draw.resolved&&story.kind==='tower'?1:0}>{Array.from({length:6},(_,i)=><g key={i} data-story-ring={i} opacity={i<story.rings?1:0} transform={`translate(322 ${76-i*8})`}><path d="M-24-3V3Q0 12 24 3V-3Z" fill="#b9823e"/><ellipse rx="24" ry="7" fill="#f5ce76" stroke="#fff1bb"/><ellipse rx="9" ry="3" fill="#8c6539"/></g>)}</g>
 <g data-story-chest="" opacity={draw.resolved&&story.kind!=='coins'?0:1} transform="translate(322 64)"><path d="M-20 1H20V26H-20Z" fill="#a36c4e" stroke="#f4ca7b" strokeWidth="2"/><path d="M-13 1V25M13 1V25" stroke="#e9bd6c" strokeWidth="4"/><g data-kono-lid="" transform={`translate(0 ${-pose.lid*15}) rotate(${-pose.lid*15})`}><path d="M-21 0Q-21-20 0-20Q21-20 21 0Z" fill="#b87d57" stroke="#f4ca7b" strokeWidth="3"/></g><rect x="-4" y="1" width="8" height="10" rx="2" fill="#ffe2a0"/></g>
 <g data-kono-body="" transform={`translate(${pose.x} ${pose.y})`}><ellipse cx="0" cy="91" rx="33" ry="5" fill="#24394a" opacity=".5"/><svg data-kono-sprite="" x="-42" y="12" width="84" height="84" viewBox={`${pose.frame*240} 0 240 240`}><image data-kono-image="" href={'/garden/kono/anim/'+pose.sprite+'.webp'} width="960" height="240"/></svg></g>
 <g data-kono-ball="" opacity={pose.ball?1:0} transform={`translate(${pose.x+38} ${78+pose.y})`}><circle r="12" fill="#e7b5f0" stroke="#fff0ff" strokeWidth="2"/><circle cx="-4" cy="-4" r="3" fill="white"/></g>
 <g data-kono-prize="" opacity={draw.resolved&&story.kind==='coins'?1:0} transform={`translate(322 ${40-pose.celebrate})`}><path d="M0-16L5-5L17-3L8 5L10 17L0 11L-10 17L-8 5L-17-3L-5-5Z" fill="#ffe29a" stroke="#fff3d1"/><text data-kono-value="" y="5" textAnchor="middle" fill="#66445f" fontWeight="900" fontSize="11">★</text></g>
 {story.particles.map((p,i)=><g key={'coin'+i} data-story-coin={i} opacity={story.kind==='coins'?p.opacity:0} transform={`translate(${p.x} ${p.y}) scale(${p.scale} 1)`}><ellipse rx="5" ry="7" fill="#ffd378" stroke="#fff0bb"/><path d="M0-3V3" stroke="#ab763e"/></g>)}
 {[0,1,2,3].map(i=><circle key={i} data-kono-spark={i} r="2" fill="#fff2bf" opacity="0"/>)}
 </svg>
}
export function updateDrawScene(root:SVGSVGElement|null,draw:BonusPresentation,motion:RevealMode){
 const p=konoScenePose(draw,motion),story=rewardStory(draw,motion)
 root?.querySelector('[data-kono-body]')?.setAttribute('transform',`translate(${p.x} ${p.y-p.celebrate})`)
 root?.querySelector('[data-kono-sprite]')?.setAttribute('viewBox',`${p.frame*240} 0 240 240`)
 root?.querySelector('[data-kono-image]')?.setAttribute('href',`/garden/kono/anim/${p.sprite}.webp`)
 root?.querySelector('[data-kono-lid]')?.setAttribute('transform',`translate(0 ${-p.lid*15}) rotate(${-p.lid*15})`)
 const ball=root?.querySelector('[data-kono-ball]');ball?.setAttribute('opacity',p.ball?'1':'0');ball?.setAttribute('transform',`translate(${p.x+38} ${78+p.y})`)
 const prize=root?.querySelector('[data-kono-prize]');prize?.setAttribute('opacity',draw.resolved&&story.kind==='coins'?'1':'0');prize?.setAttribute('transform',`translate(322 ${40-p.celebrate})`)
 root?.querySelector('[data-story-beam]')?.setAttribute('opacity',String(story.beam*.4))
 root?.querySelector('[data-story-chest]')?.setAttribute('opacity',draw.resolved&&story.kind!=='coins'?'0':'1')
 root?.querySelector('[data-story-portal]')?.setAttribute('opacity',draw.resolved&&story.kind==='portal'?'1':'0')
 root?.querySelector('[data-story-orbit]')?.setAttribute('transform',`rotate(${story.q*270})`)
 root?.querySelector('[data-story-tower]')?.setAttribute('opacity',draw.resolved&&story.kind==='tower'?'1':'0')
 root?.querySelectorAll('[data-story-ring]').forEach((n,i)=>{n.setAttribute('opacity',i<story.rings?'1':'0');n.setAttribute('transform',`translate(322 ${76-i*8-(motion==='off'?0:Math.max(0,1-(story.q*7-i))*10)})`)})
 root?.querySelectorAll('[data-story-coin]').forEach((n,i)=>{const c=story.particles[i];n.setAttribute('opacity',String(story.kind==='coins'?c.opacity:0));n.setAttribute('transform',`translate(${c.x} ${c.y}) scale(${c.scale} 1)`)})
 const label=draw.labels[draw.selected]??'';const value=root?.querySelector('[data-kono-value]');if(value)value.textContent=label.includes('JP')?'JP':label.includes('Tower')?'T':label.replace('+','')
 root?.querySelectorAll('[data-kono-spark]').forEach((n,i)=>{const angle=i*Math.PI/2+(draw.resultAge??0)/30;n.setAttribute('cx',String(322+Math.cos(angle)*25));n.setAttribute('cy',String(40+Math.sin(angle)*23));n.setAttribute('opacity',draw.resolved&&motion==='full'?'1':'0')})
}
export default function BonusDraw({draw,mode='subtle',reduced=false,paused=false,onDetailsOpenChange,onLaunch,onFrameRef,controlsOnly=false}:{controlsOnly?:boolean;draw:BonusPresentation;mode?:RevealMode;reduced?:boolean;paused?:boolean;onDetailsOpenChange?:(open:boolean)=>void;onLaunch?:(kind:'dish'|'chance',id:number)=>void;onFrameRef?:RefObject<((c:Cove)=>void)|null>}){
 const modal=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement>(null),[hidden,setHidden]=useState(false),title=useId()
 useEffect(()=>{const sync=()=>setHidden(document.hidden);sync();document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync)},[])
 const detailsOpen=useRef(false),detailsCallback=useRef(onDetailsOpenChange)
 detailsCallback.current=onDetailsOpenChange
 useEffect(()=>()=>{if(detailsOpen.current)detailsCallback.current?.(false)},[])
 const motion=reduced?'off':mode,svg=useRef<SVGSVGElement>(null),paint=useRef<((d:BonusPresentation,m:RevealMode)=>void)|null>(null)
 useEffect(()=>{updateDrawScene(svg.current,draw,motion)},[draw,motion])
 useEffect(()=>{
  if(!onFrameRef)return
  const update=(c:Cove)=>{if(paused||hidden)return;const current=bonusPresentation(c);if(!current||current.kind!==draw.kind)return
   paint.current?.(current,motion)
  };onFrameRef.current=update;return()=>{if(onFrameRef.current===update)onFrameRef.current=null}
 },[onFrameRef,draw.kind,motion,paused,hidden])
 const resultTitle=draw.kind==='dish'?(draw.labels[draw.selected]==='JP CHANCE'?'JP chance next':draw.labels[draw.selected].startsWith('Tower')?'Tower · '+draw.labels[draw.selected].replace('Tower ','')+' medals':draw.labels[draw.selected].replace('+','')+' medals to field'):draw.label.startsWith('JACKPOT!')?'JP · '+(draw.label.match(/\d+/)?.[0]??'')+' medals':'10 medals to field'
 return <section className="cove-bonus-draw" data-effects={paused||hidden?'off':motion} data-phase={draw.resolved?'result':draw.armed?'armed':draw.progress<.12?'entry':draw.progress>.92?'settling':'orbit'} data-resolved={draw.resolved} aria-label={draw.kind==='dish'?'Ball qualification draw':'Jackpot chance draw'}>
  {!controlsOnly&&<BonusCanvas draw={draw} motion={motion} paintRef={paint}/>}
  <button type="button" ref={opener} className="cove-draw-map-button" aria-label="Inspect complete draw outcome map" aria-haspopup="dialog" onClick={()=>{modal.current?.showModal();detailsOpen.current=true;onDetailsOpenChange?.(true)}}><span>Map ↗</span></button>
  <div className="cove-draw-copy"><span className="cove-draw-kicker">{draw.kind==='dish'?'KONO’S ISLAND':'KONO’S JACKPOT'}{draw.waiting?' · '+draw.waiting+' waiting':''}</span><b role="status" aria-label={draw.resolved?draw.label:undefined}>{draw.resolved?resultTitle:draw.armed?'KONO found a ball':draw.progress>.7?'Reaching the island…':'KONO carries your ball'}</b><small>{draw.resolved?(draw.kind==='dish'&&draw.label==='JACKPOT CHANCE next'?'Result fixed · jackpot chance next':'Result fixed · physical reward'):draw.armed?'Auto-launch in a moment':'Software chance draw'}</small></div>
  {draw.armed&&draw.launchId!==undefined&&onLaunch&&<button type="button" className="cove-draw-launch" aria-label="Launch ball now" title="Launch now, or let the ball start automatically" disabled={paused||hidden} onClick={()=>onLaunch(draw.kind,draw.launchId!)}>Launch ↗</button>}
  {draw.resolved&&<span className="cove-draw-reward-badge" aria-hidden="true">{draw.kind==='chance'?(draw.label.startsWith('JACKPOT!')?'JP '+(draw.label.match(/\d+/)?.[0]??''):'+10'):draw.labels[draw.selected]}</span>}
  <dialog ref={modal} className="sanctuary-details cove-draw-details" aria-labelledby={title} onClose={()=>{detailsOpen.current=false;onDetailsOpenChange?.(false);opener.current?.focus()}}><header><h2 id={title}>{draw.kind==='dish'?'Ball challenge':'Jackpot chance'}</h2><button type="button" aria-label="Close outcome map" onClick={()=>modal.current?.close()}>×</button></header><DrawBowl draw={draw} large/><p>Software chance draw. Each numbered pocket is equally likely. This bowl illustrates the selected result; it does not simulate physical odds. Launch starts the draw early without changing its result.</p><ol className="cove-outcome-map" aria-label="Complete outcome map">{draw.labels.map((label,i)=><li key={i} className={draw.resolved&&i===draw.selected?'is-result':''} aria-current={draw.resolved&&i===draw.selected?'true':undefined}><span>{i+1}</span><b>{label}</b>{draw.resolved&&i===draw.selected&&<small>Actual result</small>}</li>)}</ol><p>{draw.resolved?draw.label:'One captured ball, one draw · launch does not change odds'}</p></dialog>
 </section>
}
