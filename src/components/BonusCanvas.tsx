import {useEffect,useRef,type RefObject} from 'react'
import {CINEMA_ASSETS,paintSanctuaryScene} from './machineEventScreen'
import type {BonusPresentation} from './BonusDraw'
import type {RevealMode,RevealEvent} from '../store/bonusReveals'

export function bonusCanvasStory(draw:BonusPresentation){
 const result=draw.labels[draw.selected]??''
 const kind:RevealEvent['kind']=!draw.resolved?'ball':result.includes('Tower')?'tower':result.includes('JP')?'tide':'ball'
 return {kind,age:draw.resolved?Math.max(0,draw.resultAge??0)/60:draw.armed?0:draw.progress*1.4,
 reward:draw.resolved?(result.includes('JP')?'portal':result.includes('Tower')?'tower':'coins'):undefined} as const
}
export function BonusCanvas({draw,motion,paintRef}:{draw:BonusPresentation;motion:RevealMode;paintRef:RefObject<((d:BonusPresentation,m:RevealMode)=>void)|null>}){
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({draw,motion});latest.current={draw,motion}
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx)return
  const scene=document.createElement('canvas');scene.width=1024;scene.height=320;const art=scene.getContext('2d')!
  const sprites=new Map<string,HTMLImageElement>();let disposed=false
  const paint=(d:BonusPresentation,m:RevealMode)=>{
   latest.current={draw:d,motion:m};const s=bonusCanvasStory(d)
   paintSanctuaryScene(art,{kind:s.kind,phase:'award',magnitude:0},s.age,m,false,sprites,false,s.reward)
   ctx.drawImage(scene,0,0,1024,320,0,0,440,140)
  }
  paintRef.current=paint
  for(const [name,url] of Object.entries(CINEMA_ASSETS)){const img=new Image();img.onload=()=>{if(!disposed)paint(latest.current.draw,latest.current.motion)};sprites.set(name,img);img.src=url}
  paint(draw,motion)
  return()=>{disposed=true;for(const img of sprites.values())img.onload=null;if(paintRef.current===paint)paintRef.current=null}
 },[paintRef])
 useEffect(()=>{paintRef.current?.(draw,motion)},[draw,motion,paintRef])
 return <canvas ref={canvas} width={440} height={140} className="cove-draw-scene" aria-hidden="true"/>
}
