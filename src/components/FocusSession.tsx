import { useEffect, useRef, useState } from 'react'
import { nativeFocus } from '../native'
import {useDraftState} from '../hooks/useDraftState'
import type { Note, Task } from '../store/model'
import { lazyPanel } from '../lazyPanel'
import ModalOverlay from './ModalOverlay'
import './focus-mode.css'

// Break-time games with KONO (opened after a session finishes): loaded only when opened.
const BreakGames=lazyPanel(()=>import('./BreakGames'))

type WakeLockSentinelLike = { release: () => Promise<void> }
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }

/** `label` is for studying with no assignment behind it ("Study for Cell biology test"); taskId is then ''. */
export type FocusRequest={taskId:string;estimatedMinutes?:number;requestId:number;label?:string}
/** Focus: a full-screen timer over the page, with KONO studying beside you. The assignment (or what you're
 * studying), the length (quick choices or exact), Start; while it runs, Pause; "Finished it" ticks the
 * assignment off (only ever when you say so). Closing it (✕ or Escape) ends the session. Options: lock this
 * device to the timer (full screen, the screen kept awake) and a quick study note. When a session runs to the
 * end, KONO brings a find (onSessionComplete) and a break game is offered. */
export default function FocusSession({tasks,notes,onComplete,onSaveNote,onClose,subjectName=()=>'',draftKey='kono-focus-draft',focusRequest,onFocusActiveChange,onSessionComplete}:{draftKey?:string;tasks:Task[];notes:Note[];onComplete:(id:string)=>void;onSaveNote:(body:string)=>void|Promise<boolean>;onClose:()=>void;subjectName?:(id:string)=>string;focusRequest?:FocusRequest|null;onFocusActiveChange?:(active:boolean)=>void;onSessionComplete?:(minutes:number)=>void}){
 const [taskId,setTaskId]=useState(''),[studyLabel,setStudyLabel]=useState(''),[draft,setDraft]=useDraftState(draftKey,'')
 const [duration,setDuration]=useDraftState(draftKey+':duration',25*60)
 const [remaining,setRemaining]=useState(duration),[until,setUntil]=useState<number|null>(null),[now,setNow]=useState(0)
 const [lockPreferred,setLockPreferred]=useDraftState(draftKey+':lock',false)
 const [locked,setLocked]=useState(false),[interruptions,setInterruptions]=useState(0)
 const [breakGames,setBreakGames]=useState<number|null>(null)
 const wakeLockRef=useRef<WakeLockSentinelLike|null>(null)
 const rootRef=useRef<HTMLDivElement>(null)
 // A request (Up next's ▶ Focus, a time-block reminder) hands a specific task off here. Adjusted directly
 // during render (React's own pattern for "reset state when a prop changes") rather than in an effect, and
 // guarded by requestId so a fresh handoff is applied exactly once.
 const [handledRequestId,setHandledRequestId]=useState<number|null>(null)
 if(focusRequest&&handledRequestId!==focusRequest.requestId){
  setHandledRequestId(focusRequest.requestId)
  setTaskId(focusRequest.taskId)
  setStudyLabel(focusRequest.label??'')
  if(focusRequest.estimatedMinutes){const secs=focusRequest.estimatedMinutes*60;setDuration(secs);setRemaining(secs)}
 }
 const open=tasks.filter(t=>!t.done)
 const task=studyLabel?undefined:open.find(t=>t.id===taskId)??[...open].sort((a,b)=>a.due.localeCompare(b.due))[0]
 const seconds=until===null?remaining:Math.max(0,Math.ceil((until-now)/1000)),finished=until!==null&&seconds===0
 // In KONO's iPhone app the timer also counts down on the lock screen and Dynamic Island.
 const focusTitle=studyLabel||task?.title||'Focus session'
 useEffect(()=>{nativeFocus(until!==null&&!finished?{title:focusTitle,endsAt:until}:null)},[until,finished,focusTitle])
 useEffect(()=>()=>nativeFocus(null),[])
 const progress=duration>0?Math.min(1,Math.max(0,1-seconds/duration)):0
 // The running timer is what makes KONO sit with you on the island (GardenCard's focusCompanionActive): it
 // starts on Start and ends on pause, reset, the timer finishing, or closing Focus.
 const focusActive=until!==null&&!finished
 useEffect(()=>{onFocusActiveChange?.(focusActive)},[focusActive,onFocusActiveChange])
 // The timer ran all the way down (not paused or reset): KONO brings a find (store/konoFinds). Once per run.
 const reportedRef=useRef<number|null>(null)
 useEffect(()=>{if(finished&&until!==null&&reportedRef.current!==until){reportedRef.current=until;onSessionComplete?.(Math.round(duration/60))}},[finished,until,duration,onSessionComplete])
 const releaseLock=()=>{
  setLocked(false)
  void wakeLockRef.current?.release().catch(()=>undefined)
  wakeLockRef.current=null
  if(document.fullscreenElement&&document.fullscreenElement===rootRef.current)void document.exitFullscreen().catch(()=>undefined)
 }
 useEffect(()=>{if(until===null)return;const tick=window.setInterval(()=>{const timestamp=Date.now();setNow(timestamp);if(timestamp>=until)releaseLock()},1000);return()=>window.clearInterval(tick)},[until])
 const engageLock=async()=>{
  if(!lockPreferred)return
  try{await rootRef.current?.requestFullscreen?.()}catch{/* Fullscreen can be blocked by browser policy; the timer still runs without it. */}
  try{wakeLockRef.current=await (navigator as NavigatorWithWakeLock).wakeLock?.request('screen')??null}catch{/* Wake Lock isn't supported in every browser; the timer still runs without it. */}
  setInterruptions(0)
  setLocked(true)
 }
 useEffect(()=>{const onChange=()=>{if(!document.fullscreenElement&&locked)setLocked(false)};document.addEventListener('fullscreenchange',onChange);return()=>document.removeEventListener('fullscreenchange',onChange)},[locked])
 useEffect(()=>{if(!locked)return;const onVisibility=()=>{if(document.hidden)setInterruptions(n=>n+1)};document.addEventListener('visibilitychange',onVisibility);return()=>document.removeEventListener('visibilitychange',onVisibility)},[locked])
 useEffect(()=>()=>releaseLock(),[])
 // Closing Focus unmounts this mid-session without the focusActive effect's own "now false": say so here, or
 // KONO would be left sitting at the cherry tree.
 useEffect(()=>()=>{onFocusActiveChange?.(false)},[onFocusActiveChange])
 const start=()=>{setBreakGames(null);const timestamp=Date.now();setNow(timestamp);setUntil(timestamp+remaining*1000);void engageLock()}
 const pause=()=>{setRemaining(Math.max(0,Math.ceil(((until??Date.now())-Date.now())/1000)));setUntil(null);releaseLock()}
 const reset=()=>{setBreakGames(null);setUntil(null);setRemaining(duration);releaseLock()}
 const setCustomDuration=(minutes:number,secs:number)=>{const total=Math.max(0,Math.min(180*60,Math.round(minutes)*60+Math.round(secs)));setDuration(total);setRemaining(total)}
 const mm=String(Math.floor(seconds/60)).padStart(2,'0'),ss=String(seconds%60).padStart(2,'0')
 const idle=until===null,running=until!==null&&!finished
 const subject=task?.subjectId?subjectName(task.subjectId):''
 const presets=[15,25,45,60]
 const bubble=finished?'All done! Stretch, have some water. 🍵':running?(task?'KONO’s reading with you. 📖':'KONO’s studying with you. 📖'):'Ready when you are.'
 return <ModalOverlay label="Focus" onClose={onClose} className="focus-mode">
  <div className={'fm'+(running?' is-running':'')+(finished?' is-finished':'')} ref={rootRef}>
  {locked?<div className="fm-lock">
   <span className="fm-eyebrow">Focus lock</span>
   <h2>{focusTitle}</h2>
   <span role="timer" aria-label="Focus time remaining" className="fm-lock-time">{mm}:{ss}</span>
   {interruptions>0&&<p>You left this tab {interruptions} time{interruptions===1?'':'s'} during this session.</p>}
   <button type="button" className="fm-main" onClick={pause}>Pause &amp; exit focus lock</button>
  </div>:<>
  <div className="fm-top"><button type="button" className="fm-close" aria-label="Close focus" onClick={onClose}>✕</button><span className="fm-eyebrow">Focus{subject?' · '+subject:''}</span><span className="fm-spacer"/></div>
  <div className="fm-body">
   <h2>{focusTitle}</h2>
   {task&&idle&&open.length>1?<label className="fm-pick"><span>Change</span><select aria-label="Assignment" value={task.id} onChange={e=>{setStudyLabel('');setTaskId(e.target.value)}}>{open.map(t=><option key={t.id} value={t.id}>{t.title||'Untitled'}</option>)}</select></label>
    :<p className="fm-sub">{task?.notes?task.notes.replace(/<[^>]*>/g,'').slice(0,120):studyLabel?'Take it one page at a time.':!task?'No unfinished assignments: a free study session.':'Take the next small step.'}</p>}
   <div className="fm-ring" style={{'--p':progress} as React.CSSProperties}><div>
    <span role="timer" aria-label="Focus time remaining">{mm}:{ss}</span>
    <small>{running?'of '+Math.round(duration/60)+' min':finished?'done':'minutes'}</small>
   </div></div>
   {idle&&<div className="fm-lengths">
    <div className="fm-presets" role="group" aria-label="Quick lengths">{presets.map(m=><button type="button" key={m} aria-pressed={remaining===m*60} onClick={()=>setCustomDuration(m,0)}>{m} min</button>)}</div>
    <div className="fm-exact" role="group" aria-label="Session length"><input aria-label="Minutes" type="number" inputMode="numeric" min={0} max={180} value={Math.floor(remaining/60)} onChange={e=>setCustomDuration(Number(e.target.value)||0,remaining%60)}/><span aria-hidden="true">:</span><input aria-label="Seconds" type="number" inputMode="numeric" min={0} max={59} value={String(remaining%60).padStart(2,'0')} onChange={e=>setCustomDuration(Math.floor(remaining/60),Number(e.target.value)||0)}/></div>
   </div>}
   <div className="fm-kono"><img src={running?'/garden/kono/read.webp':finished?'/garden/kono/excited.webp':'/garden/kono/happy.webp'} alt="" width={64} height={64}/><p>{bubble}</p></div>
   {finished&&<p className="fm-status" role="status">Session complete. Take a short break.</p>}
   {breakGames!==null&&finished&&<BreakGames startedAt={breakGames} onClose={()=>setBreakGames(null)}/>}
  </div>
  <div className="fm-actions">
   {idle?<button type="button" className="fm-main focus-start" onClick={start} disabled={remaining===0}>Start timer</button>:running?<button type="button" className="fm-second" aria-label="Pause" onClick={pause}><span aria-hidden="true">❚❚</span> Pause</button>:breakGames===null&&<button type="button" className="fm-second" onClick={()=>setBreakGames(Date.now())}>🎮 Break game with KONO</button>}
   {task&&<button type="button" className={idle?'fm-second':'fm-main'} onClick={()=>{onComplete(task.id);onClose()}}>✓ Finished it</button>}
  </div>
  <div className="fm-foot">
   {!idle&&<button type="button" className="fm-link" onClick={reset}>Reset timer</button>}
   <details className="fm-more"><summary>More options</summary>
    <label className="fm-check"><input type="checkbox" checked={lockPreferred} onChange={e=>setLockPreferred(e.target.checked)}/>Lock this device to the timer</label>
    <p>Starting the timer goes full screen and keeps the screen awake until it ends (only this browser tab, not the whole phone or computer). Esc or Pause leaves.</p>
    <label className="fm-note">Quick study note<textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={100000}/></label>
    <button type="button" className="fm-link" disabled={!draft.trim()} onClick={async()=>{const saved=await onSaveNote(draft.trim());if(saved===true)setDraft('')}}>Save study note</button>
    {notes.slice(0,2).map(note=><article key={note.id} className="fm-recent"><strong>{note.title}</strong><p>{note.body.replace(/<[^>]*>/g,'').slice(0,250)}</p></article>)}
   </details>
  </div>
  </>}
  </div>
 </ModalOverlay>
}
