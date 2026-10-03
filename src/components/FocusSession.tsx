import { useEffect, useRef, useState } from 'react'
import {useDraftState} from '../hooks/useDraftState'
import type { Note, Task } from '../store/model'
import { lazyPanel } from '../lazyPanel'

// Break-time games with KONO (opened after a session finishes): loaded only when opened.
const BreakGames=lazyPanel(()=>import('./BreakGames'))

type WakeLockSentinelLike = { release: () => Promise<void> }
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }

/** `label` is for studying with no assignment behind it ("Study for Cell biology test"); taskId is then ''. */
export type FocusRequest={taskId:string;estimatedMinutes?:number;requestId:number;label?:string}
export default function FocusSession({tasks,notes,onComplete,onSaveNote,draftKey='kono-focus-draft',focusRequest,onFocusActiveChange,onSessionComplete}:{draftKey?:string;tasks:Task[];notes:Note[];onComplete:(id:string)=>void;onSaveNote:(body:string)=>void|Promise<boolean>;focusRequest?:FocusRequest|null;onFocusActiveChange?:(active:boolean)=>void;onSessionComplete?:(minutes:number)=>void}){
 const [taskId,setTaskId]=useState(''),[studyLabel,setStudyLabel]=useState(''),[draft,setDraft]=useDraftState(draftKey,'')
 const [duration,setDuration]=useDraftState(draftKey+':duration',25*60)
 const [remaining,setRemaining]=useState(duration),[until,setUntil]=useState<number|null>(null),[now,setNow]=useState(0)
 const [lockPreferred,setLockPreferred]=useDraftState(draftKey+':lock',false)
 const [locked,setLocked]=useState(false),[interruptions,setInterruptions]=useState(0)
 const [breakGames,setBreakGames]=useState<number|null>(null)
 const wakeLockRef=useRef<WakeLockSentinelLike|null>(null)
 const rootRef=useRef<HTMLDetailsElement>(null)
 // A time-block notification (or its "Start now" button) hands a specific task off here. Adjusted
 // directly during render (React's own pattern for "reset state when a prop changes") rather than in an
 // effect, and guarded by requestId so a fresh handoff is applied exactly once no matter how many times
 // this re-renders in between.
 const [handledRequestId,setHandledRequestId]=useState<number|null>(null)
 if(focusRequest&&handledRequestId!==focusRequest.requestId){
  setHandledRequestId(focusRequest.requestId)
  setTaskId(focusRequest.taskId)
  setStudyLabel(focusRequest.label??'')
  if(focusRequest.estimatedMinutes){const secs=focusRequest.estimatedMinutes*60;setDuration(secs);setRemaining(secs)}
 }
 // Opening the <details> is a real DOM side effect (and needs the ref committed), so it stays in an
 // effect rather than joining the state adjustment above.
 useEffect(()=>{if(focusRequest&&rootRef.current)rootRef.current.open=true},[focusRequest])
 const task=studyLabel?undefined:tasks.find(t=>t.id===taskId&&!t.done)??tasks.filter(t=>!t.done).sort((a,b)=>a.due.localeCompare(b.due))[0]
 const seconds=until===null?remaining:Math.max(0,Math.ceil((until-now)/1000)),finished=until!==null&&seconds===0
 const progress=duration>0?Math.min(1,Math.max(0,1-seconds/duration)):0
 // The running timer, not the locked overlay, is what makes KONO sit with you on the island (see
 // GardenCard's focusCompanionActive prop) -- so it starts on "Start timer" and ends on pause, reset
 // or the timer simply finishing, matching this component's own definition of an active session.
 const focusActive=until!==null&&!finished
 useEffect(()=>{onFocusActiveChange?.(focusActive)},[focusActive,onFocusActiveChange])
 // The timer ran all the way down (not paused or reset): KONO brings a find (store/konoFinds). Once per
 // run of the timer, for the minutes it was set to.
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
 // Leaving this page mid-session (switching notebook tabs) unmounts this component without ever
 // running the focusActive effect's own "now false" transition -- without this, KONO would be left
 // stuck sitting at the cherry tree indefinitely.
 useEffect(()=>()=>{onFocusActiveChange?.(false)},[onFocusActiveChange])
 const start=()=>{setBreakGames(null);const timestamp=Date.now();setNow(timestamp);setUntil(timestamp+remaining*1000);void engageLock()}
 const pause=()=>{setRemaining(Math.max(0,Math.ceil(((until??Date.now())-Date.now())/1000)));setUntil(null);releaseLock()}
 const reset=()=>{setBreakGames(null);setUntil(null);setRemaining(duration);releaseLock()}
 const setCustomDuration=(minutes:number,secs:number)=>{const total=Math.max(0,Math.min(180*60,Math.round(minutes)*60+Math.round(secs)));setDuration(total);setRemaining(total)}
 const mm=String(Math.floor(seconds/60)).padStart(2,'0'),ss=String(seconds%60).padStart(2,'0')
 return <details className="card focus-session" ref={rootRef}><summary>Focus session · one task at a time</summary>
  {locked?<div className="focus-lock-overlay">
   <span className="eyebrow">Focus lock</span>
   <h2>{task?.title??(studyLabel||'Focus session')}</h2>
   <span role="timer" aria-label="Focus time remaining" className="focus-lock-timer">{mm}:{ss}</span>
   <div className="focus-progress-track" aria-hidden="true"><i style={{width:`${progress*100}%`}}/></div>
   <p>{task?.notes||'Take the next small step.'}</p>
   {interruptions>0&&<p className="wb-muted">You left this tab {interruptions} time{interruptions===1?'':'s'} during this session.</p>}
   <button className="primary" onClick={pause}>Pause &amp; exit focus lock</button>
  </div>:<>
  <p>A quiet task-and-notes space. The optional timer stays on this device and stops when you leave the Sanctuary. It never completes assignments for you.</p>
  {breakGames!==null&&finished&&<BreakGames startedAt={breakGames} onClose={()=>setBreakGames(null)}/>}<div className="focus-session-grid"><div><label>Assignment<select value={task?.id??''} onChange={e=>{setStudyLabel('');setTaskId(e.target.value)}}>{!task&&<option value="">{studyLabel||'No unfinished assignments'}</option>}{tasks.filter(t=>!t.done).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>{!task&&studyLabel&&<h3>{studyLabel}</h3>}{task&&<><h3>{task.title}</h3><p>{task.notes||'Take the next small step.'}</p><button onClick={()=>onComplete(task.id)}>Complete this assignment</button></>}<div className="focus-timer"><span role="timer" aria-label="Focus time remaining">{mm}:{ss}</span><div className="focus-progress-track" aria-hidden="true"><i style={{width:`${progress*100}%`}}/></div>{until===null&&<div className="focus-timer-set"><label>Minutes<input type="number" min={0} max={180} value={Math.floor(remaining/60)} onChange={e=>setCustomDuration(Number(e.target.value)||0,remaining%60)}/></label><label>Seconds<input type="number" min={0} max={59} value={remaining%60} onChange={e=>setCustomDuration(Math.floor(remaining/60),Number(e.target.value)||0)}/></label></div>}{until===null?<button onClick={start} disabled={remaining===0}>Start timer</button>:!finished?<button onClick={pause}>Pause</button>:<><p role="status">Session complete. Take a short break.</p>{breakGames===null&&<button type="button" className="break-games-open" onClick={()=>setBreakGames(Date.now())}>🎮 Break game with KONO</button>}</>}<button onClick={reset}>Reset timer</button></div><label className="wb-check"><input type="checkbox" checked={lockPreferred} onChange={e=>setLockPreferred(e.target.checked)}/>Lock this device to the timer</label><p className="wb-muted">Can't lock your phone or computer itself — only this browser tab. Starting the timer goes full screen and keeps the screen from sleeping until it ends. Press Esc or the pause button any time to leave.</p></div><div><label>Quick study note<textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={100000}/></label><button disabled={!draft.trim()} onClick={async()=>{const saved=await onSaveNote(draft.trim());if(saved===true)setDraft('')}}>Save study note</button>{notes.slice(0,2).map(note=><article key={note.id}><strong>{note.title}</strong><p>{note.body.replace(/<[^>]*>/g,'').slice(0,250)}</p></article>)}</div></div>
  </>}
 </details>
}
