import {useEffect,useRef,useState} from 'react'
import {click,heardNow} from '../game/audioClock'

const BEAT=0.6,COUNT=16,WARMUP=4
/** KONO Beat's Sync check, as rhythm games do it: a steady click, and you tap along (anywhere on the pad, or
 * any key). How late your taps land, past the warm-up clicks, is this device's own delay (the speakers or
 * Bluetooth, the screen, the finger) that the browser can't know; the middle of them becomes the Timing. */
export default function BeatSync({onDone,onClose}:{onDone:(ms:number)=>void;onClose:()=>void}){
 const [phase,setPhase]=useState<'ready'|'tapping'|'done'>('ready'),[taps,setTaps]=useState(0),[result,setResult]=useState<number|null>(null)
 const ctxRef=useRef<AudioContext|null>(null),clicks=useRef<number[]>([]),offs=useRef<number[]>([]),pad=useRef<HTMLButtonElement>(null)
 const finish=()=>{
  const o=[...offs.current].sort((a,b)=>a-b)
  if(o.length>=6){const mid=o[Math.floor(o.length/2)],ms=Math.max(-300,Math.min(300,Math.round(mid*1000/5)*5));setResult(ms);onDone(ms)}else setResult(null)
  setPhase('done');void ctxRef.current?.close().catch(()=>undefined);ctxRef.current=null
 }
 const finishRef=useRef(finish);useEffect(()=>{finishRef.current=finish})
 useEffect(()=>()=>{void ctxRef.current?.close().catch(()=>undefined)},[])
 const start=async()=>{
  const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext
  const ctx=new Ctx();ctxRef.current=ctx;await ctx.resume().catch(()=>undefined)
  const t0=ctx.currentTime+0.8;clicks.current=Array.from({length:COUNT},(_,i)=>t0+i*BEAT)
  clicks.current.forEach((c,i)=>click(ctx,c,{accent:i%4===0}))
  offs.current=[];setTaps(0);setResult(null);setPhase('tapping')
  // For the tests: the clicks and this clock, so taps can be made at a known moment.
  if(pad.current)Object.assign(pad.current,{syncInfo:{clicks:clicks.current,now:()=>heardNow(ctx)}})
  window.setTimeout(()=>finishRef.current(),(t0-ctx.currentTime+COUNT*BEAT+0.4)*1000)
 }
 const tap=()=>{
  const ctx=ctxRef.current;if(phase!=='tapping'||!ctx)return
  const now=heardNow(ctx),near=clicks.current.reduce((b,c)=>Math.abs(c-now)<Math.abs(b-now)?c:b,clicks.current[0])
  const i=clicks.current.indexOf(near)
  if(i>=WARMUP&&Math.abs(now-near)<BEAT*0.4)offs.current.push(now-near)
  setTaps(n=>n+1)
 }
 useEffect(()=>{if(phase!=='tapping')return;const k=(e:KeyboardEvent)=>{if(!e.repeat){e.preventDefault();tap()}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)})
 return <section className="beat-sync" aria-label="Sync check">
  <h3>Sync check</h3>
  {phase==='ready'&&<p>Use the speakers or headphones you play with. You’ll hear a steady click: tap along with it ({COUNT} clicks). KONO sets Timing to match this device.</p>}
  {phase==='tapping'&&<p role="status">Tap on every click… {taps}</p>}
  {phase==='done'&&<p role="status">{result===null?'Not enough taps landed on the clicks. Try again?':result===0?'Right on time: Timing stays at 0 ms.':`You hear the music ${Math.abs(result)} ms ${result>0?'late':'early'} on this device: Timing is now ${result>0?'+':''}${result} ms.`}</p>}
  <button ref={pad} type="button" className="beat-sync-pad" aria-label={phase==='tapping'?'Tap on the click':'Start the sync check'} onPointerDown={e=>{if(phase==='tapping'){e.preventDefault();tap()}}} onClick={()=>{if(phase!=='tapping')void start()}}>{phase==='tapping'?'Tap':phase==='done'?'Again':'Start'}</button>
  <button type="button" className="beat-sync-close" onClick={onClose}>Done</button>
 </section>
}
