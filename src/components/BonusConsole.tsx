import {useEffect,useRef,useState,type Ref,type ReactNode} from 'react'
import {CHANCE_POCKETS,LAMPS} from '../store/pusher'
import type {RevealMode} from '../store/bonusReveals'
import './bonusConsole.css'

type Hud={jp:number;steps:number;bank:number;pockets:number;queue:number;reels:string[];spinning:boolean}
type Delivery={awarded:number;delivered:number;pending:number;live:number;collected:number;lost:number;tray:number;ballWaiting:number;ballArriving:number;ballField:number;captured:number;phase:string;tower:string;routes?:{source:string;pending:number;stage:string;reason:string}[]}
export type BonusConsoleProps={hud:Hud;delivery:Delivery;best:number|null;practice:boolean;bigWin:number|null;deliveredRef?:Ref<HTMLElement>;event?:string;mode:RevealMode;reduced:boolean;paused:boolean;onDetailsOpenChange?:(open:boolean)=>void;cinema?:ReactNode}
const names:Record<string,string>={'🪙':'medal','🗼':'tower','🔮':'prize ball','⭐':'star','🐚':'shell','🌺':'flower'}
/** Original vector emblems, not separate controls or simulated outcomes. */
export function ConsoleEmblem({kind,className='',cue,onAnimationEnd}:{kind:string;className?:string;cue?:string;onAnimationEnd?:()=>void}){
 return <svg className={'sanctuary-emblem '+className} data-cue={cue} onAnimationEnd={onAnimationEnd} viewBox="0 0 64 64" fill="none" aria-hidden="true">
  {kind==='shell'?<><path d="M16 49C1 31 8 13 18 15C20 3 30 5 32 13C36 3 47 7 47 16C60 13 64 34 48 49L40 55H24Z" fill="#e8b7ad" stroke="#fff0d1" strokeWidth="2"/><path d="M12 23L26 48M23 15L30 48M40 15L35 48M52 23L39 48" stroke="#9d536e" strokeWidth="2"/><path d="M22 49Q32 42 42 49L39 56H25Z" fill="#d5a45d" stroke="#ffe7a8" strokeWidth="2"/></>:kind==='tower'?<><path d="M14 53H50M18 45H46M20 35H44M22 25H42" stroke="#e4ab56" strokeWidth="6" strokeLinecap="round"/><path d="M18 42L22 20H42L46 42" fill="#b57b3f"/><ellipse cx="32" cy="20" rx="12" ry="5" fill="#ffe5a0" stroke="#d6a052" strokeWidth="2"/><ellipse cx="32" cy="20" rx="5" ry="2" fill="#5f4563"/><path d="M19 30Q32 36 45 30M18 39Q32 45 46 39M16 49Q32 56 48 49" stroke="#fff0b1" strokeWidth="2"/></>:kind==='lantern'?<><path d="M32 3V11M26 11H38M26 49H38M32 49V59M27 58H37" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M23 14Q13 31 23 47H41Q51 31 41 14Z" fill="currentColor"/><path d="M28 16Q23 31 28 45M36 16Q41 31 36 45M20 25H44M20 36H44" stroke="#493449" strokeWidth="1.5" opacity=".5"/></>:kind==='prize ball'?<><circle cx="32" cy="31" r="22" fill="#b98ce5" stroke="#f0dcff" strokeWidth="2"/><path d="M18 30A14 14 0 0 1 29 17" stroke="#fff4f9" strokeWidth="5" strokeLinecap="round"/><path d="M39 36L42 41M39 41L42 36" stroke="#f3dbff" strokeWidth="2"/><ellipse cx="32" cy="55" rx="14" ry="3" fill="#d5a45d"/></>:kind==='star'?<path d="M32 7L39 23L57 25L44 37L47 55L32 46L17 55L20 37L7 25L25 23Z" fill="#ffd780" stroke="#fff3c9" strokeWidth="2"/>:kind==='flower'?<><path d="M32 28C12 3 4 24 22 34C-1 47 23 64 32 42C40 65 65 47 43 34C61 20 47 4 32 28Z" fill="#e899ad" stroke="#ffe3d1" strokeWidth="2"/><circle cx="32" cy="34" r="7" fill="#ffdd83"/></>:<><circle cx="32" cy="32" r="24" fill="#ddb064" stroke="#fff0b4" strokeWidth="2"/><circle cx="32" cy="32" r="17" stroke="#a16b3c" strokeWidth="2"/><path d="M32 20L36 28L45 30L38 36L39 45L32 40L24 45L26 36L19 30L28 28Z" fill="#fff0ba"/></>}
 </svg>
}

export default function BonusConsole({hud,delivery,best,practice,bigWin,deliveredRef,event,mode,reduced,paused,onDetailsOpenChange,cinema}:BonusConsoleProps){
 // Only real changes trigger decoration. Initial values and starting stock do not.
 const [hidden,setHidden]=useState(false)
 useEffect(()=>{const sync=()=>setHidden(document.hidden);sync();document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync)},[])
 const phase=delivery.phase==='Push a ball to the catcher'?(delivery.ballField?delivery.ballField+' on field':delivery.ballArriving?delivery.ballArriving+' arriving':'Push to catcher'):delivery.phase
 const motion=paused||hidden||reduced?'off':mode
 const modal=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement>(null)
 const detailsOpen=useRef(false),detailsCallback=useRef(onDetailsOpenChange)
 detailsCallback.current=onDetailsOpenChange
 useEffect(()=>()=>{if(detailsOpen.current)detailsCallback.current?.(false)},[])
 const routes=delivery.routes?.filter(r=>r.pending>0||r.reason)||[]
 const openDetails=()=>{modal.current?.showModal();detailsOpen.current=true;onDetailsOpenChange?.(true)}
 const closeDetails=()=>modal.current?.close()
 return <section className="sanctuary-console" aria-label="Sanctuary bonus console" data-effects={motion}>
  {cinema}
  <button ref={opener} type="button" className="sanctuary-details-button cinema-details" onClick={openDetails} aria-haspopup="dialog" aria-label="Open reward totals and delivery details">Details</button>
  <dialog ref={modal} className="sanctuary-details" aria-labelledby="sanctuary-ledger-title" onClose={()=>{detailsOpen.current=false;onDetailsOpenChange?.(false);opener.current?.focus()}}>
   <header><h2 id="sanctuary-ledger-title">{practice?'Practice accounting':'Reward details'}</h2><button type="button" onClick={closeDetails} aria-label="Close reward details">×</button></header>
   <div className="sanctuary-ledger">
    <p role="status">{event}</p>
    <p>{delivery.tray} tray collected. {phase}.</p>
    {bigWin!==null&&<p>{practice?'Practice tower':'Tower bonus'}: {bigWin} awarded · <strong ref={deliveredRef}>0</strong> delivered.</p>}

    <div className="sanctuary-marquee"><div><span className="sanctuary-kicker">JACKPOT</span><strong>{hud.jp.toLocaleString()} medals</strong></div><div><span className="sanctuary-kicker">TOWER RESERVE</span><strong>{hud.bank.toLocaleString()} medals</strong></div></div>
    <div className="sanctuary-lantern-path" aria-label={hud.steps+' of '+LAMPS+' lanterns lit for tower release'}><div className="sanctuary-lanterns">{Array.from({length:LAMPS},(_,i)=><ConsoleEmblem key={i} kind="lantern" className={i<hud.steps?'is-lit':''}/>)}</div><span>{hud.steps}/{LAMPS} to release</span></div>
    <div className="sanctuary-lottery"><div className="sanctuary-reel-windows" aria-label={'Lottery symbols: '+hud.reels.map(r=>names[r]??r).join(', ')}>{hud.reels.map((r,i)=><ConsoleEmblem key={i} kind={names[r]??'medal'}/>)}</div><span className="sanctuary-reel-state">{hud.spinning?'Drawing':'Reel lottery'} · {hud.queue} queued</span></div>
    <p className="sanctuary-tower-status"><b>Right tower bay</b> {delivery.tower}</p>
    {routes.map((r,i)=><p key={i}><b>{r.source}: {r.pending} still owed.</b> {r.stage}{r.reason?' · '+r.reason:''}</p>)}
    <dl><div><dt>{practice?'Sample supply':'Awarded'}</dt><dd>{delivery.awarded}</dd></div><div><dt>Delivered to field</dt><dd>{delivery.delivered}</dd></div><div><dt>Still delivering</dt><dd>{delivery.pending}</dd></div><div><dt>Rewards on field</dt><dd>{delivery.live}</dd></div><div><dt>Rewards collected</dt><dd>{delivery.collected}</dd></div><div><dt>Rewards lost</dt><dd>{delivery.lost}</dd></div></dl>
    <p>Tray total includes starting stock, player drops and rewards. Starting stock is not an award. Only real tray collection counts.</p>
    <p>Balls: {delivery.ballArriving} arriving · {delivery.ballField} on field · {delivery.captured} captured · {delivery.ballWaiting} challenges queued. One captured ball earns one challenge.</p>
    <p>JP pockets: {hud.pockets}/{CHANCE_POCKETS}{best!==null?' · Best '+best:''}. Reel outcomes are software-selected.</p>
   </div>
  </dialog>
 </section>
}
