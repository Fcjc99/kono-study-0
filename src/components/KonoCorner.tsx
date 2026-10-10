import {useState,type DragEvent,type ReactNode} from 'react'
import KonoFace from './KonoFace'
import Modal from './Modal'
import {lazyPanel} from '../lazyPanel'
import type {PantryItem,Treat} from '../store/konoCare'

const BreakGames=lazyPanel(()=>import('./BreakGames'))
const SNACK_TYPE='application/x-kono-snack'

export type CornerMeter={key:'full'|'rested'|'happy';icon:string;label:string;value:number;low:boolean;gain?:{n:number;at:number}}
export type CornerTile={id:string;icon:string;label:string;detail:string;ariaLabel?:string;onOpen:()=>void}

/** KONO's corner (tap KONO's face in the KONO bar): a big KONO to pat, how it's doing, the one care
 * action that fits right now, and everything that grows with KONO (stickers, stamp card, wardrobe,
 * bond hearts) in one place, so the KONO bar itself stays a single slim strip. */
export default function KonoCorner({close,pose,outfit,costume,line,faceClass,reaction,onPet,meters,action,extras,streak,week,tiles,notes,snacks,favorite,tried,allTreats,onFeed,asleep,playAt,onPlay,now}:{
 close:()=>void
 pose:string;outfit:string|null;costume?:string;line:string;faceClass:string;reaction:ReactNode
 onPet:(tapAt:number)=>void
 meters:CornerMeter[]
 action:ReactNode
 extras?:ReactNode
 streak:number;week:{done:number;total:number}
 tiles:CornerTile[]
 notes:ReactNode
 /** The snack tray: earned snacks (tap one, or drag it onto KONO), this week's favorite, and the snack book. */
 snacks:PantryItem[];favorite:Treat;tried:Set<string>;allTreats:Treat[];onFeed:(taskId:string)=>void
 /** Play time: a break game with KONO, once an hour (playAt is when it counts again). */
 asleep:boolean;playAt:number;onPlay:()=>void;now:number
}){
 const [playing,setPlaying]=useState<number|null>(null),[dropping,setDropping]=useState(false)
 // One button per kind of snack, the favorite first.
 const kinds=[...new Map(snacks.map(s=>[s.treat.id,{...s,count:snacks.filter(x=>x.treat.id===s.treat.id).length}])).values()].sort((a,b)=>Number(b.treat.id===favorite.id)-Number(a.treat.id===favorite.id))
 const drop=(e:DragEvent)=>{e.preventDefault();setDropping(false);const id=e.dataTransfer.getData(SNACK_TYPE);if(id)onFeed(id)}
 const canPlay=!asleep&&now>=playAt
 const play=()=>{setPlaying(Date.now());onPlay()}
 return <Modal title="KONO’s corner" close={close}>
  <div className="kono-corner">
   <div className="kono-corner-hero">
    <button type="button" className={'kono-mood-face kono-corner-face '+faceClass+(dropping?' is-drop-target':'')} data-costume={costume} aria-label="Pet KONO" onClick={e=>onPet(e.timeStamp)} onDragOver={e=>{if(e.dataTransfer.types.includes(SNACK_TYPE)){e.preventDefault();setDropping(true)}}} onDragLeave={()=>setDropping(false)} onDrop={drop}><span className="kono-face-box kono-corner-facebox"><KonoFace pose={pose} outfit={outfit} size={112}/></span>{reaction}</button>
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
   {!asleep&&<section className="kono-snack-tray" aria-label="Snacks">
    <h3>Snacks <small>Tap one, or drag it onto KONO</small></h3>
    {kinds.length?<div className="kono-snack-list">{kinds.map(k=><button type="button" key={k.treat.id} className={'kono-snack'+(k.treat.id===favorite.id?' is-favorite':'')} draggable onDragStart={e=>{e.dataTransfer.setData(SNACK_TYPE,k.taskId);e.dataTransfer.effectAllowed='move'}} onClick={()=>onFeed(k.taskId)} aria-label={'Feed KONO a '+k.treat.name+(k.treat.id===favorite.id?' (its favorite this week)':'')+(k.count>1?', '+k.count+' left':'')}><span aria-hidden="true">{k.treat.emoji}</span>{k.count>1&&<small aria-hidden="true">×{k.count}</small>}{k.treat.id===favorite.id&&<i aria-hidden="true">♥</i>}</button>)}</div>
     :<p className="kono-snack-empty">No snacks yet. Finish something to earn KONO one.</p>}
    <p className="kono-snack-book" aria-label={'Snack book: '+tried.size+' of '+allTreats.length+' snacks tried'}>{allTreats.map(t=><span key={t.id} className={tried.has(t.id)?'is-tried':''} title={tried.has(t.id)?t.name+(t.id===favorite.id?' · favorite this week':''):'Not tried yet'}>{tried.has(t.id)?t.emoji:'?'}</span>)}<small>{tried.size}/{allTreats.length} tried · favorite this week: {favorite.emoji}</small></p>
   </section>}
   <div className="kono-corner-play">{playing!==null?<BreakGames startedAt={playing} onClose={()=>setPlaying(null)}/>:<button type="button" className="kono-play" disabled={!canPlay} onClick={play}><span aria-hidden="true">🎮</span> {asleep?'KONO is sleeping':canPlay?'Play with KONO':'Play again at '+new Date(playAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</button>}</div>
   {extras}
   <p className="kono-corner-stats"><span>🔥 <strong>{streak}</strong> day streak</span><span>✓ {week.total?<><strong>{week.done}/{week.total}</strong> done this week</>:'Nothing due this week'}</span></p>
   <div className="kono-corner-tiles">{tiles.map(t=><button type="button" key={t.id} className="kono-corner-tile" aria-label={t.ariaLabel} onClick={()=>{close();t.onOpen()}}><span className="kono-corner-tile-icon" aria-hidden="true">{t.icon}</span><strong>{t.label}</strong><small>{t.detail}</small></button>)}</div>
   <div className="kono-corner-notes">{notes}</div>
  </div>
 </Modal>
}
