import {useEffect,useRef,useState,type CSSProperties} from 'react'
import KonoSprite from './KonoSprite'
import './kids-planner.css'

const clockNow=()=>Date.now()
const PRESETS=[1,5,10,15,20,30,45,60]
const chime=()=>{try{const ctx=new AudioContext();[0,.25,.5].forEach((at,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=[660,880,990][i];g.gain.setValueAtTime(.0001,ctx.currentTime+at);g.gain.exponentialRampToValueAtTime(.25,ctx.currentTime+at+.02);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+at+.6);o.connect(g).connect(ctx.destination);o.start(ctx.currentTime+at);o.stop(ctx.currentTime+at+.7)})}catch{/* no sound here */}}

/** Kids view › ⏳ Timer: a big colored circle that shrinks as time runs out ("10 minutes until we
 * leave"), with KONO getting sleepier, and a chime (and buzz) at the end. Pause, +1 minute, reset. */
export default function VisualTimer({onClose}:{onClose:()=>void}){
 const [total,setTotal]=useState(0),[left,setLeft]=useState(0),[running,setRunning]=useState(false),[label,setLabel]=useState('')
 const end=useRef(0)
 useEffect(()=>{if(!running)return;const t=window.setInterval(()=>{const ms=end.current-clockNow();if(ms<=0){setLeft(0);setRunning(false);chime();navigator.vibrate?.([200,100,200])}else setLeft(ms)},250);return()=>window.clearInterval(t)},[running])
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose])
 const start=(min:number)=>{const ms=min*60000;setTotal(ms);setLeft(ms);end.current=clockNow()+ms;setRunning(true)}
 const pause=()=>{if(running){setRunning(false)}else if(left>0){end.current=clockNow()+left;setRunning(true)}}
 const more=()=>{setTotal(t=>t+60000);setLeft(l=>l+60000);end.current+=60000;if(!running&&left===0){end.current=clockNow()+60000;setRunning(true)}}
 const pct=total?left/total:0,secs=Math.ceil(left/1000),mm=Math.floor(secs/60),ss=secs%60
 const done=total>0&&left===0
 return <div className="visual-timer" role="dialog" aria-modal="true" aria-label="Timer">
  <button type="button" className="visual-timer-close" aria-label="Close timer" onClick={onClose}>✕</button>
  {!total?<div className="visual-timer-pick">
   <h2>⏳ How long?</h2>
   <input aria-label="What's the timer for?" placeholder="Until we leave, screen time, reading…" value={label} maxLength={60} onChange={e=>setLabel(e.target.value)}/>
   <div className="visual-timer-presets">{PRESETS.map(m=><button type="button" key={m} onClick={()=>start(m)}>{m<60?m+' min':'1 hour'}</button>)}</div>
  </div>:<div className="visual-timer-run">
   {label&&<p className="visual-timer-label">{label}</p>}
   <div className={'visual-timer-ring'+(done?' is-done':'')} style={{'--pct':pct} as CSSProperties} role="timer" aria-live="off" aria-label={done?'Time’s up':mm+' minutes '+ss+' seconds left'}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="track"/><circle cx="60" cy="60" r="52" className="left" pathLength={100} strokeDasharray={`${pct*100} 100`}/></svg>
    <div className="visual-timer-face">
     <KonoSprite size={88} pose={done?'/garden/kono/excited.webp':pct<.25?'/garden/kono/sleep.webp':'/garden/kono/happy.webp'} asleep={!done&&pct<.25} react={done?'cheer':undefined} reactAt={done?1:undefined} fallback={<img src={done?'/garden/kono/excited.webp':'/garden/kono/happy.webp'} alt="" width={88}/>}/>
     <strong>{done?'Time’s up!':mm+':'+String(ss).padStart(2,'0')}</strong>
    </div>
   </div>
   <div className="visual-timer-actions">
    {!done&&<button type="button" onClick={pause}>{running?'⏸ Pause':'▶ Go'}</button>}
    <button type="button" onClick={more}>＋1 min</button>
    <button type="button" onClick={()=>{setTotal(0);setLeft(0);setRunning(false)}}>↺ New timer</button>
   </div>
  </div>}
 </div>
}
