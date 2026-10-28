import {useEffect,useRef,useState,type ReactNode} from 'react'
import {KONO_RIVE,RIVE_MOODS,RIVE_TRIGGER} from '../game/data/konoRive'

type Inputs={mood?:string;asleep:boolean;react?:string;reactAt?:number}
type Runtime={setNumber:(name:string,value:number)=>void;setBoolean:(name:string,value:boolean)=>void;fire:(name:string)=>void;stop:()=>void}

/** The animated KONO (game/data/konoRive.ts) in a `size` px square, or `fallback` (the pose picture)
 * when there's no Rive file yet, motion is reduced, or the file can't play here. Inputs follow KONO's
 * mood, bedtime and reactions; KONO's eyes follow the pointer. */
export default function KonoRive({size,fallback,...inputs}:Inputs&{size:number;fallback:ReactNode}){
 const canvas=useRef<HTMLCanvasElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(inputs)
 const reduced=typeof matchMedia==='function'&&(matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced')
 const [failed,setFailed]=useState(false),[ready,setReady]=useState(false)
 const on=!!KONO_RIVE&&!reduced&&!failed
 useEffect(()=>{latest.current=inputs})
 useEffect(()=>{
  if(!on||!canvas.current||!KONO_RIVE)return
  let gone=false,stopLook=()=>{}
  void startRive(canvas.current,KONO_RIVE).then(r=>{
   if(gone){r.stop();return}
   runtime.current=r;apply(r,latest.current);setReady(true)
   const look=(e:PointerEvent)=>{const box=canvas.current?.getBoundingClientRect();if(!box)return;const k=(v:number)=>Math.max(-100,Math.min(100,v))
    r.setNumber('lookX',k((e.clientX-(box.left+box.width/2))/4));r.setNumber('lookY',k((e.clientY-(box.top+box.height/2))/4))}
   window.addEventListener('pointermove',look,{passive:true});stopLook=()=>window.removeEventListener('pointermove',look)
  }).catch(()=>{if(!gone)setFailed(true)})
  return()=>{gone=true;stopLook();runtime.current?.stop();runtime.current=null}
 },[on])
 useEffect(()=>{if(runtime.current)apply(runtime.current,inputs)},[inputs.mood,inputs.asleep]) // eslint-disable-line react-hooks/exhaustive-deps -- only these change the state
 useEffect(()=>{const t=inputs.react&&RIVE_TRIGGER[inputs.react];if(t&&runtime.current)runtime.current.fire(t)},[inputs.reactAt]) // eslint-disable-line react-hooks/exhaustive-deps -- once per reaction
 if(!on)return <>{fallback}</>
 return <span className={'kono-rive'+(ready?' is-ready':'')} style={{width:size,height:size}}>
  {!ready&&fallback}
  <canvas ref={canvas} width={size*2} height={size*2} style={{width:size,height:size}} aria-hidden="true"/>
 </span>
}

function apply(r:Runtime,{mood,asleep}:Inputs){
 const i=RIVE_MOODS.indexOf((mood??'calm') as typeof RIVE_MOODS[number])
 r.setNumber('mood',i<0?0:i);r.setBoolean('asleep',asleep)
}

/** Loads the Rive player (its own download, with its WebAssembly from this site) and starts the file. */
async function startRive(el:HTMLCanvasElement,file:{src:string;stateMachine:string}):Promise<Runtime>{
 const [{Rive,RuntimeLoader},{default:wasm}]=await Promise.all([import('@rive-app/canvas-lite'),import('@rive-app/canvas-lite/rive.wasm?url')])
 RuntimeLoader.setWasmUrl(wasm)
 return await new Promise<Runtime>((resolve,reject)=>{
  const rive=new Rive({src:file.src,canvas:el,stateMachines:file.stateMachine,autoplay:true,
   onLoad:()=>{
    rive.resizeDrawingSurfaceToCanvas()
    const input=(name:string)=>rive.stateMachineInputs(file.stateMachine)?.find(x=>x.name===name)
    resolve({
     setNumber:(name,value)=>{const x=input(name);if(x)x.value=value},
     setBoolean:(name,value)=>{const x=input(name);if(x)x.value=value},
     fire:name=>input(name)?.fire(),
     stop:()=>rive.cleanup(),
    })
   },
   onLoadError:()=>{rive.cleanup();reject(Error('Rive file could not load'))},
  })
 })
}
