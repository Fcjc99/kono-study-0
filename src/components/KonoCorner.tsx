import type {ReactNode} from 'react'
import KonoFace from './KonoFace'
import Modal from './Modal'

export type CornerMeter={key:'full'|'rested'|'happy';icon:string;label:string;value:number;low:boolean;gain?:{n:number;at:number}}
export type CornerTile={id:string;icon:string;label:string;detail:string;ariaLabel?:string;onOpen:()=>void}

/** KONO's corner (tap KONO's face in the KONO bar): a big KONO to pat, how it's doing, the one care
 * action that fits right now, and everything that grows with KONO (stickers, stamp card, wardrobe,
 * bond hearts) in one place, so the KONO bar itself stays a single slim strip. */
export default function KonoCorner({close,pose,outfit,costume,line,faceClass,reaction,onPet,meters,action,extras,streak,week,tiles,notes}:{
 close:()=>void
 pose:string;outfit:string|null;costume?:string;line:string;faceClass:string;reaction:ReactNode
 onPet:(tapAt:number)=>void
 meters:CornerMeter[]
 action:ReactNode
 extras?:ReactNode
 streak:number;week:{done:number;total:number}
 tiles:CornerTile[]
 notes:ReactNode
}){
 return <Modal title="KONO’s corner" close={close}>
  <div className="kono-corner">
   <div className="kono-corner-hero">
    <button type="button" className={'kono-mood-face kono-corner-face '+faceClass} data-costume={costume} aria-label="Pet KONO" onClick={e=>onPet(e.timeStamp)}><span className="kono-face-box kono-corner-facebox"><KonoFace pose={pose} outfit={outfit} size={112}/></span>{reaction}</button>
    {/* The same line is announced by the KONO bar's live line, so here it's only drawn. */}
    <p className="kono-corner-line" data-line={line} aria-hidden="true"/>
   </div>
   <div className="kono-corner-meters" role="group" aria-label="KONO’s needs">
    {meters.map(m=><div key={m.key} className={'kono-corner-meter is-'+m.key+(m.low?' is-low':'')+(m.gain?' is-up':'')}>
     <span className="kono-corner-meter-label"><span aria-hidden="true">{m.icon}</span> {m.label}</span>
     <span className="kono-care-bar" role="meter" aria-label={m.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.value}><i style={{width:m.value+'%'}}/></span>
     <span className="kono-corner-meter-value">{m.value}%</span>
     {m.gain&&<b key={m.gain.at} className="kono-care-gain" aria-hidden="true">+{m.gain.n}</b>}
    </div>)}
   </div>
   {action&&<div className="kono-corner-action">{action}</div>}
   {extras}
   <p className="kono-corner-stats"><span>🔥 <strong>{streak}</strong> day streak</span><span>✓ {week.total?<><strong>{week.done}/{week.total}</strong> done this week</>:'Nothing due this week'}</span></p>
   <div className="kono-corner-tiles">{tiles.map(t=><button type="button" key={t.id} className="kono-corner-tile" aria-label={t.ariaLabel} onClick={()=>{close();t.onOpen()}}><span className="kono-corner-tile-icon" aria-hidden="true">{t.icon}</span><strong>{t.label}</strong><small>{t.detail}</small></button>)}</div>
   <div className="kono-corner-notes">{notes}</div>
  </div>
 </Modal>
}
