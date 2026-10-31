import {useEffect,useImperativeHandle,useRef,useState,type CSSProperties,type Ref} from 'react'
import {drop,newTower,score,slide,toppingAt,type Tower} from '../store/stack'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

const H=22 // a pancake's height, px
const SHOWN=11 // pancakes in view before the view climbs
const pancake=(tint:number)=>{const h=26+tint%16,l=54+(tint%3)*4;return 'linear-gradient(180deg,hsl('+(h+6)+' 78% '+(l+14)+'%) 0 22%,hsl('+h+' 72% '+l+'%) 22% 78%,hsl('+(h-4)+' 60% '+(l-14)+'%) 78%)'}

/** KONO Stack (rules in store/stack): pancakes slide in from either side; tap, click or press Space to drop
 * one on the stack. KONO rides on top, hopping on a Perfect; the overhang drops off the plate; every ten
 * pancakes gets a topping; and the sky behind climbs from morning to sunset to a starry night as the stack
 * grows. */
export default function KonoStack({ref,best,sound,onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(score:number,perfects:number)=>void}){
 const [view,setView]=useState<Tower>(newTower)
 const tower=useRef<Tower>(view),moving=useRef<HTMLSpanElement>(null)
 const [call,setCall]=useState<{text:string;at:number}|null>(null),[hop,setHop]=useState(0)
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 const finish=()=>{if(ended.current)return;ended.current=true;const t=tower.current;window.setTimeout(()=>onEndRef.current(score(t),t.perfects),900)}
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(score(tower.current),tower.current.perfects)}}),[])
 const press=()=>{
  if(ended.current||tower.current.over)return
  const {tower:next,result}=drop(tower.current);tower.current=next;setView(next)
  if(result==='miss'){fx('thud',soundRef.current);gameSound('lose',soundRef.current);finish();return}
  if(result==='perfect'){fx('star',soundRef.current,Math.min(8,next.streak));setHop(h=>h+1);setCall({text:next.streak>=3?'Perfect ×'+next.streak+'! Bigger!':'Perfect!',at:Date.now()})}
  else fx('land',soundRef.current)
 }
 const pressRef=useRef(press)
 useEffect(()=>{pressRef.current=press})
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.code==='Space'||e.code==='Enter'||e.code==='ArrowDown'){if((e.target as HTMLElement)?.closest?.('button')&&e.code!=='Space')return;e.preventDefault();pressRef.current()}}
  window.addEventListener('keydown',key)
  let raf=0,last=performance.now()
  const loop=(now:number)=>{
   const n=Math.min(3,(now-last)/(1000/60));last=now
   tower.current=slide(tower.current,n)
   const el=moving.current;if(el){el.style.left=tower.current.moving.x+'%';el.style.width=tower.current.moving.w+'%'}
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',key)}
 },[])
 useEffect(()=>{if(!call)return;const t=window.setTimeout(()=>setCall(null),900);return()=>window.clearTimeout(t)},[call])
 const n=view.layers.length,climb=Math.max(0,n-SHOWN+3)*H,s=score(view),top=view.layers[n-1]
 // The sky: morning blue, then sunset, then night (0 → 1 over the first 60 pancakes).
 const sky=Math.min(1,s/60)
 return <div className="break-game kono-stack">
  <div className="blast-top"><span className="blast-best">{best!==null?'Best '+best:'KONO Stack'}</span><span className="blast-coins">{view.streak>=2?'🔥 '+view.streak+' in a row':''}</span></div>
  <div className={'stack-frame'+(view.over?' is-over':'')} style={{'--sky':sky} as CSSProperties} onPointerDown={e=>{e.preventDefault();press()}} role="img" aria-label={'KONO Stack, '+s+' pancake'+(s===1?'':'s')}>
   <span className="stack-stars" aria-hidden="true"/>
   <strong key={s} className="stack-score" aria-live="polite">{s}</strong>
   <div className="stack-world" style={{transform:'translateY('+climb+'px)'}}>
    <span className="stack-plate" aria-hidden="true"/>
    {view.layers.map((l,i)=><span key={i} className={'stack-cake'+(i===0?' is-base':'')} style={{left:l.x+'%',width:l.w+'%',bottom:28+i*H,background:pancake(l.tint)}}>{toppingAt(i)&&<i aria-hidden="true">{toppingAt(i)}</i>}</span>)}
    {view.cuts.map(c=><span key={c.at+':'+c.side} className={'stack-cake is-cut is-'+c.side} style={{left:c.x+'%',width:c.w+'%',bottom:28+c.at*H,background:pancake(c.tint)}}/>)}
    {!view.over&&<span ref={moving} className="stack-cake is-moving" style={{left:view.moving.x+'%',width:view.moving.w+'%',bottom:28+n*H+H*1.4,background:pancake(view.moving.tint)}}/>}
    <img key={hop} className={'stack-kono'+(hop?' is-hop':'')+(view.over?' is-oops':'')} src={view.over?'/garden/kono/question.webp':'/garden/kono/happy.webp'} alt="" aria-hidden="true" style={{left:'calc('+(top.x+top.w/2)+'% - 22px)',bottom:28+n*H-4}}/>
   </div>
   {call&&<span key={call.at} className="stack-call" aria-hidden="true">{call.text}</span>}
   {s===0&&!view.over&&<p className="stack-hint"><b>Tap to drop</b><span>Line it up with the pancake below</span></p>}
  </div>
  <p className="blast-help">Tap, click or press Space to drop. Line it up exactly for a Perfect; three Perfects in a row make the pancakes bigger again.</p>
 </div>
}
