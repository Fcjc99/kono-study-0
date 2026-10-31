import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {JAR,canPour,deal,done,levelShape,pour,sortStars,sorted,type Jars} from '../store/snackSort'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

/** Snack sort (rules in store/snackSort): KONO's pantry jars, mixed up. Tap a jar to lift its top snacks
 * (they hop up), tap another to tip them in; a jar that's full of one snack gets its lid and a sparkle.
 * Undo takes back a move; ＋ Jar adds one empty jar, once a level (it costs a star). Sorting them all
 * finishes the level, with stars for few moves. */
export default function SnackSort({ref,level,sound,onEnd}:{ref:Ref<GameHandle>;level:number;sound:boolean;onEnd:(solved:boolean,moves:number,stars:number)=>void}){
 const [jars,setJars]=useState<Jars>(()=>deal(level)),[history,setHistory]=useState<Jars[]>([]),[held,setHeld]=useState<number|null>(null)
 const [moves,setMoves]=useState(0),[extra,setExtra]=useState(false),[shake,setShake]=useState<{jar:number;at:number}|null>(null),[won,setWon]=useState(false)
 const ended=useRef(false),onEndRef=useRef(onEnd)
 useEffect(()=>{onEndRef.current=onEnd},[onEnd])
 const kinds=levelShape(level).kinds
 const movesRef=useRef(0)
 useEffect(()=>{movesRef.current=moves},[moves])
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(false,movesRef.current,0)}}),[])
 const tap=(i:number)=>{
  if(won)return
  if(held===null){if(!jars[i].length||done(jars[i]))return;setHeld(i);fx('tick',sound);return}
  if(held===i){setHeld(null);return}
  const n=canPour(jars,held,i)
  if(!n){setShake(x=>({jar:i,at:(x?.at??0)+1}));fx('nope',sound);if(jars[i].length&&!done(jars[i]))setHeld(i);else setHeld(null);return}
  const next=pour(jars,held,i)
  setHistory(h=>[...h.slice(-50),jars]);setJars(next);setHeld(null);setMoves(m=>m+1)
  fx(done(next[i])?'match':'land',sound,done(next[i])?3:0)
  if(sorted(next)){setWon(true);gameSound('win',sound);const stars=sortStars(moves+1,kinds,extra);window.setTimeout(()=>{if(ended.current)return;ended.current=true;onEndRef.current(true,moves+1,stars)},1100)}
 }
 const undo=()=>{const last=history[history.length-1];if(!last||won)return;setJars(last);setHistory(h=>h.slice(0,-1));setHeld(null);setMoves(m=>m+1)}
 const addJar=()=>{if(extra||won)return;setExtra(true);setHistory(h=>[...h,jars]);setJars(j=>[...j,[]])}
 const cols=jars.length<=5?jars.length:Math.ceil(jars.length/2)
 return <div className="break-game snack-sort">
  <div className="blast-top"><span className="blast-best">Level {level}</span><span className="blast-coins">{moves} move{moves===1?'':'s'}</span></div>
  <div className={'sort-shelf'+(won?' is-won':'')} style={{gridTemplateColumns:'repeat('+cols+',minmax(0,1fr))'}} role="group" aria-label="Pantry jars">
   {jars.map((jar,i)=>{const full=done(jar),lifted=held===i?Math.min(jar.length,(()=>{let n=0;for(let k=jar.length-1;k>=0&&jar[k]===jar[jar.length-1];k--)n++;return n})()):0
    return <button type="button" key={i+':'+(shake?.jar===i?shake.at:0)} className={'sort-jar'+(held===i?' is-held':'')+(full?' is-full':'')+(shake?.jar===i?' is-shake':'')} aria-pressed={held===i} aria-label={'Jar '+(i+1)+': '+(jar.length?jar.join(' '):'empty')+(full?', sorted':'')} onClick={()=>tap(i)}>
     <span className="sort-lid" aria-hidden="true"/>
     <span className="sort-glass" aria-hidden="true">{Array.from({length:JAR},(_,k)=><span key={k} className={'sort-slot'+(k>=jar.length-lifted&&k<jar.length?' is-up':'')}>{jar[k]??''}</span>)}</span>
    </button>})}
  </div>
  {won&&<p className="sort-won" role="status">🎉 All sorted!</p>}
  <div className="sort-tools">
   <button type="button" onClick={undo} disabled={!history.length||won}>↶ Undo</button>
   <button type="button" onClick={addJar} disabled={extra||won}>＋ Jar</button>
  </div>
  <p className="blast-help">Tap a jar to lift its top snacks, then tap a jar to tip them in: onto the same snack, or into an empty jar. Four to a jar. Fill each jar with one snack!</p>
 </div>
}
