import React,{useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {KonoCinema} from '../src/components/KonoCinema'
import {createBonusReveals} from '../src/store/bonusReveals'
import '../src/components/bonusConsole.css'
import '../src/standalone.css'
const reveals=createBonusReveals()
const model={frame:0,dish:null,chance:null,bonusResult:null,dishQueue:0,chanceQueue:0}
let running=true
function Panel({width}:{width:number}){const ref=useRef(null);useEffect(()=>{let id=0,last=0;const tick=(now:number)=>{const dt=last?Math.min((now-last)/1000,.05):0;last=now;ref.current?.(running?dt:0,model);id=requestAnimationFrame(tick)};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)},[]);return <div style={{width,maxWidth:'100%',margin:'14px 0'}}><div style={{font:'13px sans-serif',margin:'8px 0'}}>{width}px • live production component</div><section className="sanctuary-console"><KonoCinema reveals={reveals} frameRef={ref}/><button className="sanctuary-details-button cinema-details">Details</button></section></div>}
function Review(){const [paused,setPaused]=useState(false);return <main className="standalone" style={{display:"block",height:"auto",padding:24,background:'#e6f1ec',minHeight:'100vh'}}><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['tower','tide','ball','clear'].map(kind=><button key={kind} onClick={()=>reveals.emit({kind,phase:kind==='clear'?'complete':'award',magnitude:100})}>{kind}</button>)}<button onClick={()=>{running=!running;setPaused(!running)}}>{paused?'Resume':'Pause'}</button>{['full','subtle','off'].map(mode=><button onClick={()=>reveals.setMode(mode)} key={mode}>{mode}</button>)}</div>{[320,390,720].map(width=><Panel key={width} width={width}/>)}</main>}
createRoot(document.getElementById('review')!).render(<Review/>);
