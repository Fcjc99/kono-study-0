import {useEffect,useRef,useState,type ReactNode} from 'react'

/** The animated KONO: flip-book frames (public/garden/kono/anim, 4 frames a sheet). At rest KONO breathes
 * and blinks now and then; a pat, a hello or a high five plays its own little animation, then KONO goes
 * back to resting. A mood with its own picture (tea, a book, asleep: `pose`, `asleep`) shows `fallback` at
 * rest and only animates for reactions. Reduced motion shows `fallback` always. */
export type SpriteAnim='breathe'|'blink'|'pet'|'wave'|'cheer'
const FRAME_MS:Record<SpriteAnim,number>={breathe:420,blink:70,pet:150,wave:160,cheer:150}
const PLAYS:Partial<Record<SpriteAnim,number>>={wave:2}
/** KONO's reactions (Workspace's careMoment.react) → the animation for them. */
const SPRITE_FOR:Record<string,SpriteAnim>={wave:'wave',heart:'pet',tickle:'pet',pet:'pet',highfive:'cheer',cheer:'cheer'}
/** Poses the animation draws (KONO standing, happy); the others (tea, a book, asleep…) keep their picture at rest. */
const resting=(pose:string)=>/\/(idle|happy|excited)\.webp$/.test(pose)
const src=(a:SpriteAnim)=>'/garden/kono/anim/'+a+'.webp'

export default function KonoSprite({size,fallback,pose,asleep=false,react,reactAt}:{size:number;fallback:ReactNode;pose:string;asleep?:boolean;react?:string;reactAt?:number}){
 const still=asleep||!resting(pose)
 const reduced=typeof matchMedia==='function'&&(matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced')
 const [anim,setAnim]=useState<SpriteAnim|null>(null),[frame,setFrame]=useState(0)
 const timer=useRef(0),animRef=useRef<SpriteAnim|null>(null)
 useEffect(()=>{animRef.current=anim})
 // Sheets load once, so the first frame of a reaction is never blank.
 useEffect(()=>{if(reduced)return;for(const a of Object.keys(FRAME_MS) as SpriteAnim[]){const i=new Image();i.src=src(a)}},[reduced])
 const play=(a:SpriteAnim,after?:()=>void)=>{
  window.clearTimeout(timer.current)
  const total=4*(PLAYS[a]??1);let i=0
  setAnim(a);setFrame(0)
  const step=()=>{i++;if(i>=total){setAnim(null);setFrame(0);after?.();return}setFrame(i%4);timer.current=window.setTimeout(step,FRAME_MS[a])}
  timer.current=window.setTimeout(step,FRAME_MS[a])
 }
 // A reaction plays when one comes in.
 useEffect(()=>{const a=react&&SPRITE_FOR[react];if(reduced||!a||!reactAt)return;const t=window.setTimeout(()=>play(a));return()=>window.clearTimeout(t)},[reactAt]) // eslint-disable-line react-hooks/exhaustive-deps -- once per reaction
 // At rest: breathing, with a blink every few seconds.
 useEffect(()=>{
  if(reduced||still)return
  let gone=false,t=0,breath=0,b=0
  const tick=()=>{if(gone)return;b=(b+1)%4;setFrame(f=>animRef.current?f:b);breath=window.setTimeout(tick,FRAME_MS.breathe)}
  const blink=()=>{if(gone)return;if(!animRef.current)play('blink');t=window.setTimeout(blink,2600+Math.random()*3400)}
  breath=window.setTimeout(tick,FRAME_MS.breathe);t=window.setTimeout(blink,1800+Math.random()*2000)
  return()=>{gone=true;window.clearTimeout(t);window.clearTimeout(breath)}
 },[reduced,still])
 useEffect(()=>()=>window.clearTimeout(timer.current),[])
 if(reduced||(still&&!anim))return <>{fallback}</>
 const sheet=anim??'breathe'
 return <span className={'kono-sprite is-'+sheet} aria-hidden="true" style={{width:size,height:size,backgroundImage:`url(${src(sheet)})`,backgroundPosition:`${frame*100/3}% 0`}}/>
}
