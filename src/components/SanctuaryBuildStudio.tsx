import {useRef,useState} from 'react'

/**
 * Internal art-iteration tool — not part of the student app. Opened via ?page=build.
 * Shows the "clean island" reference (terrace stage 0, which is map-painted and never
 * evolves) for each time of day, and lets you drag a candidate overlay PNG (a new door,
 * window, chimney, tree, pond or terrace item) on top to find its anchor point before
 * wiring it into a real evolution/decor system. Nothing here touches student data.
 */
const PHASES=['morning','afternoon','evening','night'] as const
type Phase=typeof PHASES[number]
const cleanIslandSrc=(phase:Phase)=>`/garden/terrace-22.8.7/${phase}/stage-0.png`

export default function SanctuaryBuildStudio(){
 const [phase,setPhase]=useState<Phase>('afternoon')
 const [overlayUrl,setOverlayUrl]=useState('')
 const [anchor,setAnchor]=useState({x:0.5,y:0.5})
 const [scale,setScale]=useState(1)
 const [opacity,setOpacity]=useState(1)
 const stageRef=useRef<HTMLDivElement>(null)
 const dragging=useRef(false)
 const setFromPointer=(e:{clientX:number;clientY:number})=>{
  const box=stageRef.current?.getBoundingClientRect();if(!box)return
  const x=Math.min(1,Math.max(0,(e.clientX-box.left)/box.width))
  const y=Math.min(1,Math.max(0,(e.clientY-box.top)/box.height))
  setAnchor({x:Math.round(x*1000)/1000,y:Math.round(y*1000)/1000})
 }
 const onFile=(file:File|null)=>{
  if(!file)return
  if(overlayUrl)URL.revokeObjectURL(overlayUrl)
  setOverlayUrl(URL.createObjectURL(file))
 }
 return <div className="wb-panel" style={{maxWidth:960,margin:'24px auto',padding:24}}>
  <h1 style={{marginTop:0}}>Sanctuary Build Studio</h1>
  <p className="wb-muted">Internal tool for testing new decoration art against the clean island reference. Not linked from the main app — nothing here is saved to any student's plan.</p>
  <div className="wb-toolbar" role="group" aria-label="Time of day">
   {PHASES.map(p=><button key={p} aria-pressed={phase===p} onClick={()=>setPhase(p)}>{p[0].toUpperCase()+p.slice(1)}</button>)}
  </div>
  <div className="wb-form-grid" style={{marginTop:12}}>
   <label>Candidate overlay image (PNG, transparent background)
    <input type="file" accept="image/png" onChange={e=>onFile(e.target.files?.[0]??null)}/>
   </label>
   <label>Scale<input type="range" min={0.2} max={2.5} step={0.02} value={scale} onChange={e=>setScale(Number(e.target.value))}/></label>
   <label>Opacity<input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label>
  </div>
  <p className="wb-muted">Click or drag on the island to place the overlay's anchor point. Coordinates are fractions of the island image, the same way KONO's existing landmark hotspots are positioned — so they carry straight over into real system code.</p>
  <div
   ref={stageRef}
   onPointerDown={e=>{dragging.current=true;setFromPointer(e)}}
   onPointerMove={e=>{if(dragging.current)setFromPointer(e)}}
   onPointerUp={()=>{dragging.current=false}}
   onPointerLeave={()=>{dragging.current=false}}
   style={{position:'relative',width:'100%',aspectRatio:'4/3',border:'1px solid var(--wb-line)',borderRadius:12,overflow:'hidden',cursor:overlayUrl?'crosshair':'default',background:'#eee',touchAction:'none'}}
  >
   <img src={cleanIslandSrc(phase)} alt={'Clean island — '+phase} draggable={false} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',pointerEvents:'none'}}/>
   {overlayUrl&&<img src={overlayUrl} alt="Overlay candidate" draggable={false} style={{position:'absolute',left:(anchor.x*100)+'%',top:(anchor.y*100)+'%',transform:`translate(-50%,-50%) scale(${scale})`,opacity,pointerEvents:'none',maxWidth:'none'}}/>}
  </div>
  <p><strong>Anchor:</strong> <code>{JSON.stringify({phase,x:anchor.x,y:anchor.y,scale,opacity})}</code></p>
  <p className="wb-muted">This tool doesn't persist anything between reloads. Note down anchors you like before closing the tab.</p>
 </div>
}
