import { useState } from 'react'
import GardenCard from './components/GardenCard'
import { createSanctuaryProgress } from './game/progression/progressionEngine'
import type { DayPhase } from './game/sanctuary/types'
import './sanctuary.css'
import { APP_VERSION } from './version'

export default function SanctuaryQA() {
 const [stage,setStage]=useState(5)
 const [phase,setPhase]=useState<DayPhase>('afternoon')
 const [narrow,setNarrow]=useState(false)
 const [reduced,setReduced]=useState(false)
 const progress=createSanctuaryProgress('local-sanctuary-qa')
 progress.unlockedStage=stage
 progress.featureStages={...progress.featureStages,tree:stage,home:stage,garden:stage,pond:stage,lanterns:stage}
 return <main style={{padding:16,background:'#f8f5ee',minHeight:'100vh'}}>
  <h1>Sanctuary QA — {APP_VERSION}</h1>
  <p>Isolated test progress. Original four-phase colors · stages 0–5. Your assignments are unchanged. Home/pond/tree styles are duplicable decorations now — use the Decorate palette in the real Sanctuary page to test those.</p>
  <label>Stage <select aria-label="QA stage" value={stage} onChange={e=>setStage(Number(e.target.value))}>{[0,1,2,3,4,5].map(s=><option key={s}>{s}</option>)}</select></label>
  <label>Phase <select aria-label="QA phase" value={phase} onChange={e=>setPhase(e.target.value as DayPhase)}>{(['morning','afternoon','evening','night'] as const).map(p=><option key={p}>{p}</option>)}</select></label>
  <button onClick={()=>setNarrow(!narrow)}>Toggle mobile width</button>
  <label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/> Reduced motion</label>
  <div style={{width:narrow?375:920,maxWidth:'100%',margin:'16px auto'}}><GardenCard phase={phase} weather="clear" reducedMotion={reduced} progress={progress}/></div>
 </main>
}
