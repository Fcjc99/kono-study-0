import {useEffect,useRef,useState} from 'react'
import KonoIcon from './KonoIcon'
import './island-mini.css'

/** Home's island tucked away: a strip of meadow where KONO walks back and forth by itself, stops now and then
 * to wave, cheer, snack or take a breath, and sleeps at night. Tap KONO and it stops, waves and asks what
 * you'd like: talk (KONO's corner), ask a question, or a pat. The Arcade and "Show island" sit at the side.
 * Reduced motion: KONO stands still (still tappable). It only moves while the strip is on screen. */
type Act='wave'|'cheer'|'eat'|'breathe'|'blink'
const FRAME_MS:Record<Act|'sleep',number>={wave:160,cheer:150,eat:260,breathe:420,blink:120,sleep:900}
const ACTS:Act[]=['wave','cheer','eat','breathe','blink','breathe']
const SPEED=34 // px a second: an amble
const SIZE=64
const walkSrc=(dir:'left'|'right',f:number)=>'/garden/kono/walk-'+dir+'-0'+(f+1)+'.webp'
const animSrc=(a:string)=>'/garden/kono/anim/'+a+'.webp'

export default function IslandMini({asleep=false,onArcade,onShow,onTalk,onAsk,onPat}:{asleep?:boolean;onArcade:()=>void;onShow:()=>void;onTalk:()=>void;onAsk:()=>void;onPat:()=>void}){
 const stage=useRef<HTMLDivElement>(null),kono=useRef<HTMLButtonElement>(null),walkImg=useRef<HTMLImageElement>(null)
 const [act,setAct]=useState<Act|null>(null),[menu,setMenu]=useState(false),[dir,setDir]=useState<'left'|'right'>('right'),[bubbleX,setBubbleX]=useState(0)
 const st=useRef({x:40,dir:'right' as 'left'|'right',until:0,frame:0,frameAt:0,acting:false,stopped:false})
 // The time of day sets the sky (and the night versions of the trees, lantern and cottage).
 const [phase]=useState(()=>{const h=new Date().getHours();return h>=5&&h<11?'morning':h>=11&&h<17?'afternoon':h>=17&&h<20?'evening':'night'})
 const night=asleep||phase==='night',art=(n:string)=>'/garden/strip/'+n+'-'+(night?'night':'afternoon')+'.webp'
 const reduced=typeof matchMedia==='function'&&(matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced')
 // The walk: one requestAnimationFrame loop that moves KONO (no re-render a frame), only while on screen.
 useEffect(()=>{
  const el=stage.current;if(!el)return
  let raf=0,last=0,visible=true,gone=false,timer=0
  const s=st.current
  const place=()=>{if(kono.current)kono.current.style.transform=`translateX(${Math.round(s.x)}px)`}
  const startAct=()=>{const a=ACTS[Math.floor(Math.random()*ACTS.length)];s.acting=true;setAct(a);timer=window.setTimeout(()=>{if(gone)return;s.acting=false;setAct(null);s.until=performance.now()+2500+Math.random()*4000},FRAME_MS[a]*4*(a==='wave'||a==='eat'?2:1)+600)}
  const tick=(t:number)=>{
   if(gone)return
   const dt=last?Math.min(0.1,(t-last)/1000):0;last=t
   if(visible&&!s.acting&&!s.stopped&&!asleep&&!reduced){
    const max=Math.max(0,el.clientWidth-SIZE)
    s.x+=(s.dir==='right'?1:-1)*SPEED*dt
    if(s.x>=max){s.x=max;s.dir='left';setDir('left')}else if(s.x<=0){s.x=0;s.dir='right';setDir('right')}
    if(t-s.frameAt>220){s.frame=1-s.frame;s.frameAt=t;if(walkImg.current)walkImg.current.src=walkSrc(s.dir,s.frame)}
    place()
    if(!s.until)s.until=t+3000+Math.random()*3000
    else if(t>s.until){s.until=0;startAct()}
   }
   raf=requestAnimationFrame(tick)
  }
  const io=typeof IntersectionObserver==='function'?new IntersectionObserver(e=>{visible=e.some(x=>x.isIntersecting)}):null
  io?.observe(el)
  const hidden=()=>{visible=!document.hidden}
  document.addEventListener('visibilitychange',hidden)
  // Start somewhere in the middle, facing a random way.
  s.x=Math.max(0,(el.clientWidth-SIZE)*(0.25+Math.random()*0.5));s.dir=Math.random()<0.5?'left':'right';setDir(s.dir);place()
  raf=requestAnimationFrame(tick)
  return()=>{gone=true;cancelAnimationFrame(raf);window.clearTimeout(timer);io?.disconnect();document.removeEventListener('visibilitychange',hidden)}
 },[asleep,reduced])
 // Sheets load once, so a stop never shows a blank frame.
 useEffect(()=>{for(const a of [...ACTS,'sleep'])new Image().src=animSrc(a);for(const d of ['left','right'] as const)for(const f of [0,1])new Image().src=walkSrc(d,f)},[])
 // Tapped: KONO stops and waves while the choices are open.
 const tap=()=>{const s=st.current;if(menu){close();return}s.stopped=true;setBubbleX(Math.min(Math.max(0,s.x-40),(stage.current?.clientWidth??300)-230));setMenu(true);if(!asleep)setAct('wave')}
 const close=()=>{st.current.stopped=false;st.current.acting=false;setMenu(false);setAct(null)}
 useEffect(()=>{if(!menu)return;const t=window.setTimeout(close,8000);const out=(e:PointerEvent)=>{if(!stage.current?.contains(e.target as Node))close()};document.addEventListener('pointerdown',out);return()=>{window.clearTimeout(t);document.removeEventListener('pointerdown',out)}},[menu])
 const choose=(go:()=>void)=>()=>{close();go()}
 const showing:Act|'sleep'|null=asleep?'sleep':act??(reduced?'breathe':null)
 return <section className={'wb-island-mini is-walk is-'+(night?'night':phase)+(night?' is-night':'')} aria-label="Your island (tucked away)">
  <div className="wb-island-mini-stage" ref={stage}>
   <div className="wim-scene" aria-hidden="true">
    <img className="wim-cloud is-a" src="/garden/strip/cloud-a.webp" alt=""/><img className="wim-cloud is-b" src="/garden/strip/cloud-b.webp" alt=""/>
    <svg className="wim-hills" viewBox="0 0 400 60" preserveAspectRatio="none"><path className="is-far" d="M0 60V34Q40 14 80 30T170 24T260 32T340 18T400 28V60Z"/><path className="is-near" d="M0 60V44Q50 30 110 42T220 38T320 46T400 40V60Z"/></svg>
    <img className="wim-prop is-cottage" src={art('cottage')} alt=""/>
    <img className="wim-prop is-tree-round" src={art('tree-round')} alt=""/>
    <img className="wim-prop is-bench" src={art('bench')} alt=""/>
    <img className="wim-prop is-lantern" src={art('lantern')} alt=""/>
    <img className="wim-prop is-tree-cherry" src={art('tree-cherry')} alt=""/>
    <img className="wim-prop is-sign" src={art('sign')} alt=""/>
    <span className="wim-ground"/>
   </div>
   <button type="button" ref={kono} className={'wb-island-mini-kono'+(menu?' is-talking':'')} aria-label={asleep?'KONO is asleep. Tap to say hi':'KONO. Tap to talk, ask or pat'} aria-expanded={menu} onClick={tap}>
    {showing?<span className={'wb-island-mini-anim'+(showing==='breathe'&&reduced?' is-still':'')} style={{backgroundImage:`url(${animSrc(showing)})`,['--ms' as string]:FRAME_MS[showing]*4+'ms'}} aria-hidden="true"/>
     :<img ref={walkImg} src={walkSrc(dir,0)} alt="" draggable={false}/>}
    {asleep&&<span className="wb-island-mini-z" aria-hidden="true">z</span>}
   </button>
   <div className="wim-front" aria-hidden="true"><img className="is-a" src="/garden/strip/flower-grass.webp" alt=""/><img className="is-b" src="/garden/strip/grass-tall.webp" alt=""/><img className="is-c" src="/garden/strip/flower-grass-b.webp" alt=""/></div>
   {menu&&<div className="wb-island-mini-bubble" role="group" aria-label="With KONO" style={{left:bubbleX}}>
    <button type="button" onClick={choose(onTalk)}>💬 Talk</button>
    <button type="button" onClick={choose(onAsk)}>❓ Ask</button>
    <button type="button" onClick={()=>{close();onPat();if(!asleep){st.current.acting=true;setAct('cheer');window.setTimeout(()=>{st.current.acting=false;setAct(null)},1400)}}}>🤚 Pat</button>
   </div>}
  </div>
  <div className="wb-island-mini-tools">
   <button type="button" className="wb-island-mini-arcade" onClick={onArcade}><KonoIcon name="arcade"/><span>Arcade</span></button>
   <button type="button" className="wb-island-mini-show" aria-expanded="false" onClick={onShow}>Show island <span aria-hidden="true">▾</span></button>
  </div>
 </section>
}
