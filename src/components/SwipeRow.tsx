import {useRef,useState,type ReactNode,type TouchEvent} from 'react'

const THRESHOLD=90

/** Phones: swipe an assignment right to finish it, left to move it to tomorrow. Only a clearly sideways
 * swipe counts (touch-action: pan-y keeps vertical scrolling with the browser); the card's own buttons
 * still do the same things for anyone who doesn't swipe. */
export default function SwipeRow({children,onRight,onLeft,rightLabel='✓ Done',leftLabel='Tomorrow →'}:{children:ReactNode;onRight:()=>void;onLeft?:()=>void;rightLabel?:string;leftLabel?:string}){
 const start=useRef<{x:number;y:number;sideways:boolean|null}|null>(null)
 const [dx,setDx]=useState(0),last=useRef(0) // last: the distance itself, as touch events can outrun renders
 const begin=(e:TouchEvent)=>{if(e.touches.length!==1)return;const t=e.touches[0];start.current={x:t.clientX,y:t.clientY,sideways:null}}
 const move=(e:TouchEvent)=>{
  const s=start.current;if(!s)return
  const t=e.touches[0],x=t.clientX-s.x,y=t.clientY-s.y
  if(s.sideways===null&&(Math.abs(x)>12||Math.abs(y)>12))s.sideways=Math.abs(x)>Math.abs(y)*1.5
  if(!s.sideways)return
  last.current=Math.max(onLeft?-140:0,Math.min(140,x));setDx(last.current)
 }
 const end=()=>{
  const s=start.current;start.current=null
  const moved=last.current;last.current=0
  if(s?.sideways){if(moved>=THRESHOLD)onRight();else if(moved<=-THRESHOLD&&onLeft)onLeft()}
  setDx(0)
 }
 const side=dx>0?'right':dx<0?'left':''
 return <div className={'swipe-row'+(side?' is-swiping-'+side:'')+(Math.abs(dx)>=THRESHOLD?' is-armed':'')} onTouchStart={begin} onTouchMove={move} onTouchEnd={end} onTouchCancel={()=>{start.current=null;last.current=0;setDx(0)}}>
  <div className="swipe-row-hint" aria-hidden="true"><span>{rightLabel}</span>{onLeft&&<span>{leftLabel}</span>}</div>
  <div className="swipe-row-card" style={dx?{transform:`translateX(${dx}px)`}:undefined}>{children}</div>
 </div>
}
