import { useEffect, useRef, useState } from 'react'
import {useDraftState} from '../hooks/useDraftState'
import type { Note, Task } from '../store/model'

type WakeLockSentinelLike = { release: () => Promise<void> }
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }

export default function FocusSession({tasks,notes,onComplete,onSaveNote,draftKey='kono-focus-draft'}:{draftKey?:string;tasks:Task[];notes:Note[];onComplete:(id:string)=>void;onSaveNote:(body:string)=>void|Promise<boolean>}){
 const [taskId,setTaskId]=useState(''),[draft,setDraft]=useDraftState(draftKey,'')
 const [duration,setDuration]=useDraftState(draftKey+':duration',25*60)
 const [remaining,setRemaining]=useState(duration),[until,setUntil]=useState<number|null>(null),[now,setNow]=useState(0)
 const [lockPreferred,setLockPreferred]=useDraftState(draftKey+':lock',false)
 const [locked,setLocked]=useState(false),[interruptions,setInterruptions]=useState(0)
 const wakeLockRef=useRef<WakeLockSentinelLike|null>(null)
 const rootRef=useRef<HTMLDetailsElement>(null)
 const task=tasks.find(t=>t.id===taskId&&!t.done)??tasks.filter(t=>!t.done).sort((a,b)=>a.due.localeCompare(b.due))[0]
 const seconds=until===null?remaining:Math.max(0,Math.ceil((until-now)/1000)),finished=until!==null&&seconds===0
 const progress=duration>0?Math.min(1,Math.max(0,1-seconds/duration)):0
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
 const start=()=>{const timestamp=Date.now();setNow(timestamp);setUntil(timestamp+remaining*1000);void engageLock()}
 const pause=()=>{setRemaining(Math.max(0,Math.ceil(((until??Date.now())-Date.now())/1000)));setUntil(null);releaseLock()}
 const reset=()=>{setUntil(null);setRemaining(duration);releaseLock()}
 const setCustomDuration=(minutes:number,secs:number)=>{const total=Math.max(0,Math.min(180*60,Math.round(minutes)*60+Math.round(secs)));setDuration(total);setRemaining(total)}
 const mm=String(Math.floor(seconds/60)).padStart(2,'0'),ss=String(seconds%60).padStart(2,'0')
 return <details className="card focus-session" ref={rootRef}><summary>Focus session · one task at a time</summary>
  {locked?<div className="focus-lock-overlay">
   <span className="eyebrow">Focus lock</span>
   <h2>{task?.title??'Focus session'}</h2>
   <span role="timer" aria-label="Focus time remaining" className="focus-lock-timer">{mm}:{ss}</span>
   <div className="focus-progress-track" aria-hidden="true"><i style={{width:`${progress*100}%`}}/></div>
   <p>{task?.notes||'Take the next small step.'}</p>
   {interruptions>0&&<p className="wb-muted">You left this tab {interruptions} time{interruptions===1?'':'s'} during this session.</p>}
   <button className="primary" onClick={pause}>Pause &amp; exit focus lock</button>
  </div>:<>
  <p>A quiet task-and-notes space. The optional timer stays on this device and stops when you leave the Sanctuary. It never completes assignments for you.</p>
  <div className="focus-session-grid"><div><label>Assignment<select value={task?.id??''} onChange={e=>setTaskId(e.target.value)}>{!task&&<option value="">No unfinished assignments</option>}{tasks.filter(t=>!t.done).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>{task&&<><h3>{task.title}</h3><p>{task.notes||'Take the next small step.'}</p><button onClick={()=>onComplete(task.id)}>Complete this assignment</button></>}<div className="focus-timer"><span role="timer" aria-label="Focus time remaining">{mm}:{ss}</span><div className="focus-progress-track" aria-hidden="true"><i style={{width:`${progress*100}%`}}/></div>{until===null&&<div className="focus-timer-set"><label>Minutes<input type="number" min={0} max={180} value={Math.floor(remaining/60)} onChange={e=>setCustomDuration(Number(e.target.value)||0,remaining%60)}/></label><label>Seconds<input type="number" min={0} max={59} value={remaining%60} onChange={e=>setCustomDuration(Math.floor(remaining/60),Number(e.target.value)||0)}/></label></div>}{until===null?<button onClick={start} disabled={remaining===0}>Start timer</button>:!finished?<button onClick={pause}>Pause</button>:<p role="status">Session complete. Take a short break.</p>}<button onClick={reset}>Reset timer</button></div><label className="wb-check"><input type="checkbox" checked={lockPreferred} onChange={e=>setLockPreferred(e.target.checked)}/>Lock this device to the timer</label><p className="wb-muted">Can't lock your phone or computer itself — only this browser tab. Starting the timer goes full screen and keeps the screen from sleeping until it ends. Press Esc or the pause button any time to leave.</p></div><div><label>Quick study note<textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={100000}/></label><button disabled={!draft.trim()} onClick={async()=>{const saved=await onSaveNote(draft.trim());if(saved===true)setDraft('')}}>Save study note</button>{notes.slice(0,2).map(note=><article key={note.id}><strong>{note.title}</strong><p>{note.body.replace(/<[^>]*>/g,'').slice(0,250)}</p></article>)}</div></div>
  </>}
 </details>
}
