import {useMemo,useState,useSyncExternalStore} from 'react'
import type {AppData} from '../store/model'
import type {PlannerRepository} from '../store/repository'
import {canvasSnapshot,connectCanvas,onCanvasChange,parseCanvas,syncCanvas,writeCanvas} from '../store/canvasSync'

/** Settings › Import & export › Canvas, two-way (store/canvasSync.ts): connect with the school's Canvas
 * address and an access token; then the to-do list comes in by itself and ticks go back to Canvas. */
export default function CanvasConnect({data,save}:{data:AppData;save:PlannerRepository['update']}){
 const profileId=data.activeProfileId
 const raw=useSyncExternalStore(onCanvasChange,()=>canvasSnapshot(profileId),()=>''),link=useMemo(()=>parseCanvas(raw),[raw])
 const [base,setBase]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('')
 const run=async(job:()=>Promise<string>)=>{setBusy(true);setError('');setStatus('');try{setStatus(await job())}catch(e){setError(e instanceof Error?e.message:'Couldn’t reach Canvas.')}finally{setBusy(false)}}
 const count=link?[...data.tasks,...data.exams].filter(x=>x.profileId===profileId&&x.canvasRef).length:0
 return <section className="canvas-connect" aria-label="Canvas, two-way">
  <h4>Canvas, two-way</h4>
  {link?<>
   <p><strong>Connected{link.name?' as '+link.name:''}</strong> · {link.base.replace(/^https?:\/\//,'')}<br/><small className="wb-muted">{count} Canvas item{count===1?'':'s'} in your plan · {link.lastSynced?'Checked '+new Date(link.lastSynced).toLocaleString()+(link.lastResult?' · '+link.lastResult:''):'Not checked yet'}</small></p>
   <p className="wb-muted">Ticking a Canvas assignment done here ticks it done on your Canvas to-do list too. Things you hand in on Canvas come back as done.</p>
   <div className="wb-toolbar"><button type="button" disabled={busy} onClick={()=>void run(()=>syncCanvas(profileId,()=>data,save))}>{busy?'Checking…':'Check now'}</button><button type="button" disabled={busy} onClick={()=>{writeCanvas(profileId,null);setStatus('Canvas is disconnected on this device. Your assignments stay in your plan. Delete the token in Canvas (Account › Settings) too.')}}>Disconnect</button></div>
  </>:<>
   <p>Bring in your Canvas to-do list and keep it in sync both ways: tick homework done in KONO and it’s ticked in Canvas.</p>
   <form className="canvas-connect-form" onSubmit={e=>{e.preventDefault();void run(()=>connectCanvas(profileId,base,token,()=>data,save)).then(()=>setToken(''))}}>
    <label>Your school’s Canvas address<input value={base} onChange={e=>setBase(e.target.value)} placeholder="myschool.instructure.com" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} required/></label>
    <label>Canvas access token<input type="password" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required/></label>
    <button type="submit" className="primary" disabled={busy||!base.trim()||!token.trim()}>{busy?'Connecting…':'Connect Canvas'}</button>
   </form>
   <details><summary>How to get a Canvas access token</summary><ol><li>In Canvas on the website, open <strong>Account</strong> › <strong>Settings</strong>.</li><li>Under Approved Integrations, choose <strong>+ New Access Token</strong>. Name it KONO and pick an expiry date if you like.</li><li>Copy the token Canvas shows (it only shows it once) and paste it above.</li></ol><p className="wb-muted">The token stays on this device. KONO’s server passes it to your school’s Canvas for each check and doesn’t keep it. Anyone with the token can see and change your Canvas, so don’t share it. Some schools turn tokens off; then use the Canvas calendar link below (it only brings things in).</p></details>
  </>}
  {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
 </section>
}
