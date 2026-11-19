import {useEffect,useRef,useState} from 'react'
import {click,heardNow,inputLag} from '../game/audioClock'

const BEAT=0.6,COUNT=16,WARMUP=4
/** KONO Beat's timing check, as rhythm games do it: a steady click, and you tap along (on the big circle, or any
 * key). How late your taps land, past the warm-up clicks, is this device's own delay (the speakers or Bluetooth,
 * the screen, the finger) that the browser can't know; the middle of them becomes the Timing. `first`: shown
 * before a device's first song (with Skip for now), so a late tap later reads as your timing, not a broken game. */
export default function BeatSync({onDone,onClose,first=false}:{onDone:(ms:number)=>void;onClose:()=>void;first?:boolean}){
 const [phase,setPhase]=useState<'ready'|'tapping'|'done'>('ready'),[taps,setTaps]=useState(0),[result,setResult]=useState<number|null>(null)
 const [heard,setHeard]=useState(0),[sofar,setSofar]=useState<number|null>(null)
 const ctxRef=useRef<AudioContext|null>(null),clicks=useRef<number[]>([]),offs=useRef<number[]>([]),pad=useRef<HTMLButtonElement>(null)
 const middle=(o:number[])=>{const s=[...o].sort((a,b)=>a-b);return Math.max(-300,Math.min(300,Math.round(s[Math.floor(s.length/2)]*1000/5)*5))}
 const finish=()=>{
  if(offs.current.length>=6){const ms=middle(offs.current);setResult(ms);onDone(ms)}else setResult(null)
  setPhase('done');void ctxRef.current?.close().catch(()=>undefined);ctxRef.current=null
 }
 const finishRef=useRef(finish);useEffect(()=>{finishRef.current=finish})
 useEffect(()=>()=>{void ctxRef.current?.close().catch(()=>undefined)},[])
 const start=async()=>{
  const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext
  const ctx=new Ctx();ctxRef.current=ctx;await ctx.resume().catch(()=>undefined)
  const t0=ctx.currentTime+0.8;clicks.current=Array.from({length:COUNT},(_,i)=>t0+i*BEAT)
  clicks.current.forEach((c,i)=>click(ctx,c,{accent:i%4===0}))
  offs.current=[];setTaps(0);setResult(null);setSofar(null);setHeard(0);setPhase('tapping')
  // For the tests: the clicks and this clock, so taps can be made at a known moment.
  if(pad.current)Object.assign(pad.current,{syncInfo:{clicks:clicks.current,now:()=>heardNow(ctx)}})
  window.setTimeout(()=>finishRef.current(),(t0-ctx.currentTime+COUNT*BEAT+0.4)*1000)
 }
 // The circle pulses on each click as you hear it, and a dot fills for each one.
 useEffect(()=>{
  if(phase!=='tapping')return
  let raf=0
  const tick=()=>{raf=requestAnimationFrame(tick);const ctx=ctxRef.current;if(!ctx)return
   const now=heardNow(ctx),n=clicks.current.filter(c=>c<=now).length;setHeard(n)
   const last=clicks.current[n-1];if(pad.current)pad.current.style.setProperty('--pulse',String(last!==undefined?Math.max(0,1-(now-last)/0.25):0))}
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)
 },[phase])
 const tap=(lag=0)=>{
  const ctx=ctxRef.current;if(phase!=='tapping'||!ctx)return
  const now=heardNow(ctx)-lag/1000,near=clicks.current.reduce((b,c)=>Math.abs(c-now)<Math.abs(b-now)?c:b,clicks.current[0])
  const i=clicks.current.indexOf(near)
  if(i>=WARMUP&&Math.abs(now-near)<BEAT*0.4){offs.current.push(now-near);if(offs.current.length>=3)setSofar(middle(offs.current))}
  setTaps(n=>n+1)
 }
 useEffect(()=>{if(phase!=='tapping')return;const k=(e:KeyboardEvent)=>{if(!e.repeat&&e.key!=='Escape'){e.preventDefault();tap(inputLag(e))}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)})
 const fmt=(ms:number)=>(ms>0?'+':ms<0?'−':'')+Math.abs(ms)+' ms'
 return <section className="beat-sync" role="dialog" aria-label="Timing check">
  <p className="beat-sync-kicker">{first?'Before your first song · 20 seconds':'Timing check · 20 seconds'}</p>
  <h3>Tap with the beat</h3>
  {phase==='ready'&&<p>Every phone and pair of headphones has its own delay. Use the speakers or headphones you play with, press Start, and tap the circle (or any key) on each click. KONO learns your delay.</p>}
  {phase==='tapping'&&<p role="status">Tap on every click… {taps}</p>}
  {phase==='done'&&<p role="status">{result===null?'Not enough taps landed on the clicks. Try again?':result===0?'Right on time: Timing stays at 0 ms.':`You hear the music ${Math.abs(result)} ms ${result>0?'late':'early'} on this device: Timing is now ${result>0?'+':''}${result} ms.`}</p>}
  <button ref={pad} type="button" className={'beat-sync-pad is-'+phase} aria-label={phase==='tapping'?'Tap on the click':phase==='done'?'Check again':'Start the timing check'} onPointerDown={e=>{if(phase==='tapping'){e.preventDefault();tap(inputLag(e))}}} onClick={()=>{if(phase!=='tapping')void start()}}><span>{phase==='tapping'?'Tap':phase==='done'?'Again':'Start'}</span></button>
  <ol className="beat-sync-dots" aria-hidden="true">{Array.from({length:COUNT},(_,i)=><li key={i} className={(i<heard?'is-on':'')+(i<WARMUP?' is-warm':'')}/>)}</ol>
  <div className="beat-sync-readout"><span>{phase==='done'?'Your timing':'Your delay so far'}</span><b>{phase==='done'&&result!==null?fmt(result):sofar!==null?fmt(sofar):'—'}</b></div>
  <button type="button" className="beat-sync-close" onClick={onClose}>{first?(phase==='done'&&result!==null?'▶ Play':'Skip for now'):'Done'}</button>
 </section>
}
