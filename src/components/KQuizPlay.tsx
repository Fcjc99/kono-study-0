import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react'
import {shuffle,type PlayQuestion} from '../store/kquizRound'
import {COIN_ICON,quizCoins} from '../store/konoCoins'
import KonoSprite from './KonoSprite'
import './kquiz-play.css'

const HEARTS=3
const TILE=['coral','sky','mint','sun']

/** K-Quiz › Play: a study set as a game, one question at a time on big colored tiles. Right answers build
 * a streak and earn KONO coins (onCorrect pays them, and says how many, or null at today's limit); a
 * wrong one costs a heart, and three wrong ends the round. The end shows the score, the coins and what
 * to look at again. Number keys 1–4 pick an answer; Enter continues. */
export default function KQuizPlay({title,questions,onCorrect,onClose}:{title:string;questions:PlayQuestion[];onCorrect:(streak:number)=>number|null;onClose:()=>void}){
 const [round,setRound]=useState(questions)
 const [index,setIndex]=useState(0),[picked,setPicked]=useState<number|null>(null),[shown,setShown]=useState(false)
 const [streak,setStreak]=useState(0),[best,setBest]=useState(0),[hearts,setHearts]=useState(HEARTS),[coins,setCoins]=useState(0),[right,setRight]=useState(0)
 const [gain,setGain]=useState<{n:number;at:number}|null>(null),[capped,setCapped]=useState(false)
 const [missed,setMissed]=useState<PlayQuestion[]>([])
 const [react,setReact]=useState<{kind:string;at:number}|null>(null)
 const q=round[index],done=!q||hearts<=0
 const answered=q?.choices?picked!==null:shown&&picked!==null
 const wasRight=!!q&&picked!==null&&(q.choices?picked===q.correct:picked===1)
 const total=round.length
 const continueRef=useRef<HTMLButtonElement>(null)

 const score=(ok:boolean)=>{
  if(ok){const s=streak+1;setStreak(s);setBest(b=>Math.max(b,s));setRight(r=>r+1)
   const paid=onCorrect(s);if(paid){setCoins(c=>c+paid);setGain({n:paid,at:Date.now()})}else setCapped(true)
   setReact({kind:s>=3?'cheer':'pet',at:Date.now()})}
  else{setStreak(0);setHearts(h=>h-1);setMissed(m=>[...m,q!]);navigator.vibrate?.(60);setReact(null)}
 }
 const pick=(i:number)=>{if(!q?.choices||picked!==null)return;setPicked(i);score(i===q.correct)}
 const grade=(ok:boolean)=>{if(picked!==null)return;setPicked(ok?1:0);score(ok)}
 const next=()=>{setIndex(i=>i+1);setPicked(null);setShown(false);setGain(null)}
 const again=(list:PlayQuestion[])=>{setRound(list);setIndex(0);setPicked(null);setShown(false);setStreak(0);setHearts(HEARTS);setRight(0);setMissed([]);setGain(null)}
 useEffect(()=>{if(answered)continueRef.current?.focus()},[answered])
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){onClose();return}if(done)return
   if(answered&&e.key==='Enter'){e.preventDefault();next();return}
   const n=Number(e.key);if(q?.choices&&n>=1&&n<=q.choices.length)pick(n-1)}
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
 })
 const pct=useMemo(()=>total?Math.round(right/total*100):0,[right,total])

 return <div className="kq-play" role="dialog" aria-modal="true" aria-label={'Play: '+title}>
  <header className="kq-play-top">
   <button type="button" className="kq-play-close" aria-label="Stop playing" onClick={onClose}>✕</button>
   <div className="kq-play-progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index,total)}><i style={{width:Math.min(index+(answered?1:0),total)/Math.max(1,total)*100+'%'}}/></div>
   <span className={'kq-play-streak'+(streak>=3?' is-hot':'')} aria-label={'Streak '+streak}>🔥 {streak}</span>
   <span className="kq-play-hearts" aria-label={hearts+' hearts left'}>{Array.from({length:HEARTS},(_,i)=><b key={i} className={i<hearts?'':'is-lost'}>❤️</b>)}</span>
   <span className="kq-play-coins" aria-label={coins+' coins earned'}>{COIN_ICON} {coins}{gain&&<em key={gain.at} className="kq-play-gain">+{gain.n}</em>}</span>
  </header>

  {done?<section className="kq-play-end" aria-label="Round over">
   <div className="kq-play-kono"><KonoSprite size={120} pose="/garden/kono/excited.webp" react={pct>=60?'cheer':'pet'} reactAt={1} fallback={<img src="/garden/kono/excited.webp" alt="" width={120}/>}/></div>
   <h2>{hearts<=0?'Out of hearts':pct>=80?'Amazing!':pct>=50?'Nice work!':'Good practice!'}</h2>
   <div className="kq-play-ring" style={{'--pct':pct} as CSSProperties}><strong>{right}/{total}</strong><small>right</small></div>
   <ul className="kq-play-stats">
    <li><b>{COIN_ICON} {coins}</b><small>coins earned{capped?' (today’s limit reached)':''}</small></li>
    <li><b>🔥 {best}</b><small>best streak</small></li>
   </ul>
   {missed.length>0&&<details className="kq-play-missed"><summary>Look again at {missed.length} {missed.length===1?'question':'questions'}</summary><ul>{missed.map(m=><li key={m.id}><strong>{m.prompt}</strong><span>{m.choices?m.choices[m.correct!]:m.answer}</span></li>)}</ul></details>}
   <div className="kq-play-end-actions">
    {missed.length>0&&<button type="button" onClick={()=>again(missed)}>Practice the missed ones</button>}
    <button type="button" className="primary" onClick={()=>again(shuffle(questions,Date.now()))}>Play again</button>
    <button type="button" onClick={onClose}>Done</button>
   </div>
  </section>:<>
   <section className="kq-play-card" key={q.id}>
    <div className="kq-play-kono is-small"><KonoSprite size={64} pose="/garden/kono/happy.webp" react={react?.kind} reactAt={react?.at} fallback={<img src="/garden/kono/happy.webp" alt="" width={64}/>}/></div>
    <small className="kq-play-count">Question {index+1} of {total}</small>
    <h2 className="kq-play-prompt">{q.prompt}</h2>
   </section>
   {q.choices?<div className={'kq-play-tiles'+(q.choices.length>4?' is-many':'')} role="group" aria-label="Answers">
    {q.choices.map((c,i)=>{const state=picked===null?'':i===q.correct?' is-right':i===picked?' is-wrong':' is-dim'
     return <button type="button" key={i} className={'kq-tile is-'+TILE[i%4]+state} aria-disabled={picked!==null} onClick={()=>pick(i)}><span className="kq-tile-key" aria-hidden="true">{i+1}</span><span>{c}</span></button>})}
   </div>
   :<div className="kq-play-written">
    <textarea rows={3} aria-label="Your answer" placeholder="Type your answer, then check it" disabled={shown}/>
    {!shown?<button type="button" className="primary" onClick={()=>setShown(true)}>Check answer</button>
    :<><p className="kq-play-model"><b>Model answer:</b> {q.answer}</p>{picked===null&&<div className="kq-play-grade"><button type="button" className="is-right" onClick={()=>grade(true)}>✓ I got it</button><button type="button" className="is-wrong" onClick={()=>grade(false)}>✗ Not yet</button></div>}</>}
   </div>}
   {answered&&<footer className={'kq-play-feedback '+(wasRight?'is-right':'is-wrong')} role="status">
    <div><strong>{wasRight?['Nice!','Correct!','You got it!','Brilliant!'][index%4]+(streak>=3?' 🔥 '+streak+' in a row':''):'Not quite'}</strong>
     {wasRight?<span>{capped?'Today’s quiz coins are all earned.':'+'+quizCoins(streak)+' '+COIN_ICON}</span>:q.choices&&<span>Answer: {q.choices[q.correct!]}</span>}</div>
    <button ref={continueRef} type="button" onClick={next}>Continue</button>
   </footer>}
  </>}
 </div>
}
