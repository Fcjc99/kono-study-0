import {useState} from 'react'
import {useAiHelper} from '../hooks/useAiHelper'
import type {StepDraft} from '../store/projectSteps'

/** Assignment editor › Steps › "Break into steps": dated steps from KONO's AI (or a template when
 * the AI isn't available), ready to change. Offered while the assignment has no steps; the note about
 * where they came from stays after. The planner code loads only when it's used. */
export default function BreakIntoSteps({hasSteps,profileId,title,notes,due,today,onSteps}:{hasSteps:boolean;profileId:string;title:string;notes:string;due:string;today:string;onSteps:(steps:StepDraft[])=>void}){
 const {provider,apiKey,ready}=useAiHelper(profileId)
 const [busy,setBusy]=useState(false),[note,setNote]=useState('')
 const make=async()=>{
  setBusy(true);setNote('')
  try{
   const {suggestSteps}=await import('../store/projectSteps')
   const result=await suggestSteps(title.trim()||'Assignment',notes,today,due,ready?{provider,apiKey}:null)
   onSteps(result.steps)
   setNote(result.byAi?'KONO’s AI suggested these steps. Change the days or remove any you don’t need.':'Here’s a starting plan. Change the days or remove any you don’t need.')
  }catch{setNote('Couldn’t make steps right now. Try again.')}
  finally{setBusy(false)}
 }
 if(hasSteps&&!note)return null
 return <div className="break-into-steps">{!hasSteps&&<button type="button" onClick={()=>void make()} disabled={busy||!due}>{busy?'Making steps…':'✨ Break into steps'}</button>}{note&&<p className="wb-muted" role="status">{note}</p>}</div>
}
