import {useEffect,useRef,useState} from 'react'
import type {TideLane,TideStatus} from '../store/tide'
import type {RevealMode} from '../store/bonusReveals'
import './tideDeliveryPanel.css'

export type TideDeliveryPanelProps={tide:TideStatus;collected:number;onChoose:(id:number,lane:TideLane)=>void;mode:RevealMode;reduced:boolean;paused:boolean;disabled:boolean;looking?:boolean}
const lanes:TideLane[]=['left','center','right']
/** Read-only lane preview. Delivery progress comes only from real falling medals. */
export function tideMechanismView(tide:TideStatus){
 return lanes.map((lane,i)=>{
  const active=lane===tide.lane
  return {lane,x:25+i*50,open:active?1:0,held:active?tide.held:0}
 })
}
export function tideStageLabel(tide:TideStatus){
 if(tide.blocked)return tide.waitReason==='shared-route'?'Waiting for tower':tide.waitReason==='capacity'?'Waiting for capacity':'Obstructed · keep pushing'
 if(tide.clearing)return 'Clearing · award unchanged'
 return ({idle:'Ready',choosing:'Choose placement · no timer',deploying:'Preparing shower',parking:'Finishing wave',loading:'Coin shower',ready:'Ready',opening:'Coin shower',draining:'Coins falling',closing:'Finishing wave',waiting:'Waiting for next wave'})[tide.stage]
}
export default function TideDeliveryPanel({tide,collected,onChoose,mode,reduced,paused,disabled,looking=false}:TideDeliveryPanelProps){
 const [hidden,setHidden]=useState(false),[preview,setPreview]=useState<TideLane|null>(null)
 const previous=useRef({id:tide.requestId,released:tide.requestReleased})
 const [release,setRelease]=useState(0)
 const choosing=tide.stage==='choosing',motion=paused||hidden||reduced?'off':mode
 useEffect(()=>{const sync=()=>setHidden(document.hidden);sync();document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync)},[])
 useEffect(()=>{setPreview(null)},[tide.requestId,choosing,disabled])
 useEffect(()=>{
  const before=previous.current;previous.current={id:tide.requestId,released:tide.requestReleased}
  if(motion==='off'||tide.blocked){setRelease(0);return}
  if(before.id===tide.requestId&&tide.requestReleased>before.released)setRelease(n=>n+1)
 },[tide.requestId,tide.requestReleased,tide.blocked,motion])
 const selected=choosing?preview:tide.lane,summary=`${tide.requestReleased} delivered · ${tide.total-tide.requestReleased} still owed · ${collected} collected${tide.waitingRequests?' · '+tide.waitingRequests+' Tide queued':''}`
 const status=looking?'Lock camera to choose':tideStageLabel(tide)
 return <section className="cove-tide-panel tide-mechanism-panel" aria-label="Sanctuary Tide jackpot delivery" data-effects={motion} data-stage={tide.stage} data-blocked={tide.blocked} data-preview={preview??''}>
  <div className="cove-tide-title"><b>{tide.practice?'PRACTICE ':''}TIDE</b><strong>{tide.total} fixed medals</strong></div>
  <div className="tide-mechanism-scene" data-selected={selected??''}>
   <svg className="tide-mechanism" viewBox="0 0 150 44" preserveAspectRatio="none" aria-hidden="true">
    <path className="tide-track" d="M25 5H125M25 5V35M75 5V35M125 5V35"/>
    <g className="tide-selector" style={{opacity:selected?1:0,transform:`translateX(${selected?25+lanes.indexOf(selected)*50:75}px)`}}><path d="M-5 1H5L0 7Z"/></g>
    {tideMechanismView(tide).map(part=><g key={part.lane} className={'tide-bay'+(selected===part.lane?' is-selected':'')} style={{transform:`translateX(${choosing?25+lanes.indexOf(part.lane)*50:part.x}px)`}}>
     <path className="tide-path" d="M0 24V36M-3 32L0 36L3 32"/>
     <path className="tide-path" d="M-8 9Q0 3 8 9"/>
     {selected===part.lane&&<g className="tide-cargo"><ellipse cx="-4" cy="12" rx="3" ry="1.4"/><ellipse cx="4" cy="18" rx="3" ry="1.4"/><ellipse cx="-1" cy="25" rx="3" ry="1.4"/></g>}
    </g>)}
   </svg>
   {choosing?<div className="tide-placement-targets" role="group" aria-label="Choose jackpot medal placement. Same award and odds. No timer.">
    {lanes.map(lane=><button key={lane} type="button" disabled={disabled||paused||hidden} aria-label={`Choose ${lane} feed. Same fixed award.`} title={`Preview ${lane} feed; activate to lock placement`} onPointerEnter={()=>{if(!disabled)setPreview(lane)}} onPointerLeave={()=>setPreview(null)} onFocus={()=>setPreview(lane)} onBlur={()=>setPreview(null)} onClick={()=>{if(!disabled&&!paused&&!hidden&&tide.requestId!==null&&tide.stage==='choosing')onChoose(tide.requestId,lane)}}>{lane}</button>)}
   </div>:<div className="tide-stage-readout" role="status" title={`${tide.lane} lane locked · ${status} · wave ${tide.wave||1} · ${tide.batchBuilt} entered`}><span>{tide.blocked?'Ⅱ ':''}{tide.lane} · {status}</span></div>}
   {release>0&&motion!=='off'&&!tide.blocked&&<i key={release} className="tide-release-confirmed" aria-hidden="true"/>}
  </div>
  <div className="tide-delivery-totals" title={summary} aria-label={summary}><span>{tide.requestReleased}/{tide.total} delivered</span><span>{collected} collected{tide.waitingRequests?' · +'+tide.waitingRequests+' queued':''}</span></div>
  <progress className="tide-delivery-progress" aria-label="Jackpot medals physically delivered" max={Math.max(1,tide.total)} value={tide.requestReleased}/>
 </section>
}
