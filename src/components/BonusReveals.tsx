import {useEffect,useRef,useState,type CSSProperties} from 'react'
import {createBonusReveals,REVEAL_COLORS,type RevealMode,type BonusReveals,type EdgeReveal} from '../store/bonusReveals'
import './bonusReveals.css'
const STORAGE='kono-medal-cove.reveals.v1'
/** The mechanism's active clock drives every pose. No wall-clock animation can run through pause. */
export function celebrationPose(progress:number,index:number){
 const p=Math.max(0,Math.min(1,progress)), t=Math.max(0,Math.min(1,(p-index*.045)/.65))
 const ease=1-Math.pow(1-t,3)
 return {opacity:Math.min(1,t*7)*Math.max(0,Math.min(1,(1-p)/.22)),rise:34*ease,spread:.25+.75*ease,turn:(1-ease)*22}
}
function RewardStage({reveals,event}:{reveals:BonusReveals;event:EdgeReveal}){
 const root=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  const draw=()=>{
   if(!root.current||reveals.current?.id!==event.id)return
   const p=1-reveals.current.remaining/event.duration
   root.current.style.opacity=String(Math.min(1,p*8)*Math.min(1,(1-p)*5))
   root.current.querySelectorAll<SVGGElement>('[data-step]').forEach(node=>{
    const i=Number(node.dataset.step),pose=celebrationPose(p,i)
    node.style.opacity=String(pose.opacity)
    node.setAttribute('transform',event.kind==='tower'?`translate(0 ${-pose.rise})`:event.kind==='tide'?`translate(32 74) scale(${pose.spread}) rotate(${pose.turn*(i%2?1:-1)}) translate(-32 -74)`:`translate(0 ${-pose.rise*1.8})`)
   })
  }
  draw();return reveals.subscribeFrame(draw)
 },[reveals,event])
 return <div ref={root} aria-hidden="true" className={'cove-reveal-edge is-'+event.kind} style={{'--reveal-color':REVEAL_COLORS[event.kind]} as CSSProperties}>
  {[0,1].map(side=><svg key={side} className={'cove-ceremony-side side-'+side} viewBox="0 0 64 128" fill="none">
   {Array.from({length:6},(_,i)=><g key={i} data-step={i}>
    {event.kind==='tower'?<><path d={`M12 ${108-i*10}Q32 ${120-i*10} 52 ${108-i*10}M12 ${108-i*10}Q32 ${98-i*10} 52 ${108-i*10}`} stroke="currentColor" strokeWidth="1.7"/><path d={`M8 ${108-i*10}H3M56 ${108-i*10}H61`} stroke="currentColor"/></>:event.kind==='tide'?<path d={`M32 74 Q${-8+i*16} ${-4+Math.abs(i-2.5)*9} ${6+i*10} 34 Q${12+i*8} 59 32 74Z`} fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.3"/>:<path d={`M-5 ${95+i*8}Q17 ${72+i*8} 39 ${95+i*8}T75 ${95+i*8}`} stroke="currentColor" strokeWidth={i===0?2:1} opacity={1-i*.11}/>}
   </g>)}
  </svg>)}
 </div>
}
export function useBonusReveals(){
 const [reveals]=useState(()=>{let mode:RevealMode='full';try{const saved=window.localStorage.getItem(STORAGE);if(saved==='off'||saved==='subtle'||saved==='full')mode=saved}catch{}return createBonusReveals(mode)})
 const [,redraw]=useState(0)
 useEffect(()=>{
  const unsubscribe=reveals.subscribe(()=>redraw(n=>n+1)),media=window.matchMedia('(prefers-reduced-motion: reduce)')
  const sync=()=>reveals.setReduced(media.matches),hide=()=>{if(document.hidden)reveals.reset()}
  sync();media.addEventListener?.('change',sync);document.addEventListener('visibilitychange',hide)
  return ()=>{unsubscribe();media.removeEventListener?.('change',sync);document.removeEventListener('visibilitychange',hide);reveals.reset()}
 },[reveals])
 const change=(mode:RevealMode)=>{reveals.setMode(mode);try{window.localStorage.setItem(STORAGE,mode)}catch{}}
 const current=reveals.current
 return {reveals,
  overlay:current?<RewardStage key={current.id} reveals={reveals} event={current}/>:null,
  control:<label className="cove-reveal-setting">Bonus effects <select aria-label="Bonus visual effects" value={reveals.mode} onChange={event=>change(event.target.value as RevealMode)}><option value="off">Off</option><option value="subtle">Subtle</option><option value="full">Full</option></select></label>
 }
}
