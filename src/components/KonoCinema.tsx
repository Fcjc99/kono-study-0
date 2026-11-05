import {useEffect,useRef,type RefObject} from 'react'
import {CINEMA_ASSETS,createScreenTimeline,paintSanctuaryScene} from './machineEventScreen'
import {bonusPresentation} from './BonusDraw'
import {bonusCanvasStory} from './BonusCanvas'
import type {BonusReveals} from '../store/bonusReveals'
import type {Cove} from '../store/pusher'

/** One continuously present cinema, driven by simulation time, not a second game clock. */
export function KonoCinema({reveals,frameRef}:{reveals:BonusReveals;frameRef:RefObject<((dt:number,c:Cove)=>void)|null>}){
 const canvas=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx)return
  const timeline=createScreenTimeline(),sprites=new Map<string,HTMLImageElement>()
  let idle=0,paintAge=0,disposed=false,dirty=true,latest:Cove|null=null,lastState=''
  const viewport={width:1024,height:320}
  const draw=()=>{
   const bonus=latest?bonusPresentation(latest):null
   const story=bonus?bonusCanvasStory(bonus):null
   paintSanctuaryScene(ctx,story?{kind:story.kind,phase:'award'}:timeline.current,story?story.age:timeline.current?timeline.age:idle,reveals.mode,reveals.reduced,sprites,false,story?.reward,viewport)
   dirty=false
  }
  const offEvent=reveals.subscribeEvent(e=>{timeline.emit(e);dirty=true})
  const offMode=reveals.subscribe(()=>{dirty=true})
  const update=(dt:number,c:Cove)=>{
   latest=c
   const bonus=bonusPresentation(c),state=JSON.stringify([bonus?.kind,bonus?.resolved,bonus?.selected,bonus?.label])
   if(state!==lastState){dirty=true;lastState=state}
   if(dt>0){const previous=timeline.current;timeline.update(dt);if(previous!==timeline.current)dirty=true;idle+=Math.min(dt,.05);paintAge+=Math.min(dt,.05)}
   const motion=reveals.mode!=='off'&&!reveals.reduced
   if(dirty||dt>0&&motion&&paintAge>=1/24){draw();paintAge=0}
  }
  frameRef.current=update
  for(const [name,url] of Object.entries(CINEMA_ASSETS)){const img=new Image();img.onload=()=>{if(!disposed){dirty=true;draw()}};sprites.set(name,img);img.src=url}
  const resize=()=>{const node=canvas.current;if(!node)return;const rect=node.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;viewport.height=Math.round(1024*rect.height/rect.width);node.height=viewport.height;dirty=true;draw()}
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null
  if(canvas.current)observer?.observe(canvas.current)
  resize();draw()
  return()=>{disposed=true;observer?.disconnect();offEvent();offMode();for(const img of sprites.values())img.onload=null;if(frameRef.current===update)frameRef.current=null}
 },[reveals,frameRef])
 return <canvas ref={canvas} className="kono-running-cinema" width={1024} height={320} role="img" aria-label="KONO’s Sanctuary adventure. Animations react to ball challenges, towers and jackpots; reward details are available separately."/>
}
