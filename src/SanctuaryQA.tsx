import { useState } from 'react'
import GardenCard from './components/GardenCard'
import { createSanctuaryProgress } from './game/progression/progressionEngine'
import type { DayPhase } from './game/sanctuary/types'
import { HOME_STYLES } from './game/data/homeStyles'
import { POND_STYLES } from './game/data/pondStyles'
import './sanctuary.css'
import { APP_VERSION } from './version'

export default function SanctuaryQA() {
 const [stage,setStage]=useState(5)
 const [phase,setPhase]=useState<DayPhase>('afternoon')
 const [narrow,setNarrow]=useState(false)
 const [reduced,setReduced]=useState(false)
 const [homeStyle,setHomeStyle]=useState<string|null>(null)
 const [pondStyle,setPondStyle]=useState<string|null>(null)
 const [homeStyleScale,setHomeStyleScale]=useState(1)
 const [homeStyleFlipX,setHomeStyleFlipX]=useState(false)
 const [pondStyleScale,setPondStyleScale]=useState(1)
 const [pondStyleFlipX,setPondStyleFlipX]=useState(false)
 const progress=createSanctuaryProgress('local-sanctuary-qa')
 progress.unlockedStage=stage
 progress.featureStages={...progress.featureStages,tree:stage,home:stage,garden:stage,pond:stage,lanterns:stage}
 return <main style={{padding:16,background:'#f8f5ee',minHeight:'100vh'}}>
  <h1>Sanctuary QA — {APP_VERSION}</h1>
  <p>Isolated test progress. Original four-phase colors · stages 0–5. Your assignments are unchanged.</p>
  <label>Stage <select aria-label="QA stage" value={stage} onChange={e=>setStage(Number(e.target.value))}>{[0,1,2,3,4,5].map(s=><option key={s}>{s}</option>)}</select></label>
  <label>Phase <select aria-label="QA phase" value={phase} onChange={e=>setPhase(e.target.value as DayPhase)}>{(['morning','afternoon','evening','night'] as const).map(p=><option key={p}>{p}</option>)}</select></label>
  <label>Home style <select aria-label="QA home style" value={homeStyle??''} onChange={e=>setHomeStyle(e.target.value||null)}><option value="">Default cottage</option>{HOME_STYLES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
  <label>Pond style <select aria-label="QA pond style" value={pondStyle??''} onChange={e=>setPondStyle(e.target.value||null)}><option value="">No pond (empty)</option>{POND_STYLES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
  <label>Home size <input aria-label="QA home style scale" type="range" min={0.5} max={2} step={0.05} value={homeStyleScale} onChange={e=>setHomeStyleScale(Number(e.target.value))}/></label>
  <label><input aria-label="QA home style mirror" type="checkbox" checked={homeStyleFlipX} onChange={e=>setHomeStyleFlipX(e.target.checked)}/> Mirror home</label>
  <label>Pond size <input aria-label="QA pond style scale" type="range" min={0.5} max={2} step={0.05} value={pondStyleScale} onChange={e=>setPondStyleScale(Number(e.target.value))}/></label>
  <label><input aria-label="QA pond style mirror" type="checkbox" checked={pondStyleFlipX} onChange={e=>setPondStyleFlipX(e.target.checked)}/> Mirror pond</label>
  <button onClick={()=>setNarrow(!narrow)}>Toggle mobile width</button>
  <label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/> Reduced motion</label>
  <div style={{width:narrow?375:920,maxWidth:'100%',margin:'16px auto'}}><GardenCard phase={phase} weather="clear" reducedMotion={reduced} progress={progress} homeStyle={homeStyle} pondStyle={pondStyle} homeStyleScale={homeStyleScale} homeStyleFlipX={homeStyleFlipX} pondStyleScale={pondStyleScale} pondStyleFlipX={pondStyleFlipX}/></div>
 </main>
}

