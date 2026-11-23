import {useState} from 'react'
import type {BeatResult} from './RhythmGame'
import {LEVELS,WINDOWS,readOffset,saveLast,saveOffset} from '../store/rhythm'
import type {Judge,Level} from '../store/rhythm'
import './beat-summary.css'
import {starsEarned} from '../store/rhythm'

const ROWS:{j:Judge;name:string}[]=[{j:'perfect',name:'Perfect'},{j:'great',name:'Great'},{j:'good',name:'Good'},{j:'miss',name:'Miss'}]
const CLEAR:Record<BeatResult['clear'],string>={fail:'',clear:'Clear',full:'Full combo',all:'All perfect'}
/** KONO Beat's results, under the score: the grade and accuracy (a ring), how the hits went (a bar for each
 * kind), the best combo; your timing (where your hits landed, early to late, with a one-tap Timing fix when
 * they lean one way); the song as a strip with a mark for every tile (where you missed shows up red); and
 * what to try next (`onNext` opens the song select on that level). */
export default function BeatSummary({r,onNext}:{r:BeatResult;onNext?:()=>void}){
 const t=r.tally,judged=t.perfect+t.great+t.good+t.miss,most=Math.max(1,...ROWS.map(x=>t[x.j]))
 const lean=t.early+t.late>=4?(t.early>t.late*1.5?'You tap a little early':t.late>t.early*1.5?'You tap a little late':'Early and late, evenly'):null
 const W=300,end=Math.max(1,r.ms)
 // Hits landing early or late in the middle: offer to shift the Timing by that much (only if you choose).
 const [shifted,setShifted]=useState<number|null>(null)
 const shift=()=>{if(r.drift===null)return;const v=Math.max(-300,Math.min(300,readOffset()+r.drift));saveOffset(v);setShifted(v)}
 // Where the hits landed: a bar for each 10 ms from the level's outer window early to late.
 const win=WINDOWS[r.level][2],bins=Array.from({length:Math.round(win*2/10)},()=>0)
 for(const o of r.offs??[]){const i=Math.floor((Math.max(-win,Math.min(win-0.01,o))+win)/10);if(bins[i]!==undefined)bins[i]++}
 const binMax=Math.max(1,...bins)
 // What next: the next level up after a clear (or an easier one after a fail).
 const idx=LEVELS.findIndex(l=>l.id===r.level),next:Level|null=r.warmup||r.ended?null:!r.failed&&!r.ended&&idx<2?LEVELS[idx+1].id:r.failed&&idx>0?LEVELS[idx-1].id:null
 const nextName=next&&LEVELS.find(l=>l.id===next)!.name
 // Stars, as on the board's progress line: one for a third of the song, one for two thirds, the crown for clearing
 // it (played to the end). A warm-up earns none.
 const earned=starsEarned(r)
 return <div className="beat-summary" style={{'--grade':r.failed?'#ff6b81':r.grade.startsWith('S')?'#ffb800':r.grade==='A'?'#7b5cff':'#2fbf8f','--acc':Math.max(0,Math.min(100,r.acc))+'%'} as React.CSSProperties}>
  <p className="beat-summary-stars" role="img" aria-label={earned.filter(Boolean).length+' of 3: '+(earned[2]?'cleared':earned[1]?'two thirds of the way':earned[0]?'a third of the way':'not a third of the way yet')}>{earned.map((on,i)=><span key={i} className={on?'is-on':''} style={{'--i':i} as React.CSSProperties}>{i===2?'♛':'★'}</span>)}</p>
  <div className="beat-summary-head">
   <span className="beat-summary-grade" aria-label={'Grade '+r.grade}>{r.grade}</span>
   <span className="beat-summary-ring" role="img" aria-label={'Accuracy '+r.acc.toFixed(1)+'%'}><span><b>{r.acc.toFixed(1)}%</b><small>accuracy</small></span></span>
   {(r.warmup||CLEAR[r.clear])&&<span className="beat-summary-clear">{r.warmup?'Warm-up':CLEAR[r.clear]}{r.classic&&!r.warmup?' · Classic':''}</span>}
  </div>
  <ul className="beat-summary-bars" aria-label="Hits">{ROWS.map(x=><li key={x.j} className={'is-'+x.j}><span>{x.name}</span><i style={{width:(t[x.j]/most*100)+'%'}}/><b>{t[x.j]}</b></li>)}</ul>
  <dl className="beat-summary-stats">
   <div><dt>Best combo</dt><dd>{t.best}</dd></div>
   <div><dt>Tiles</dt><dd>{r.tiles} / {r.of}</dd></div>
  </dl>
  {(r.offs?.length??0)>=6&&<div className="beat-summary-timing">
   <h4>Your timing</h4>
   <div className="beat-summary-hist" role="img" aria-label={'Where your hits landed: '+t.early+' early, '+t.late+' late'}>{bins.map((n,i)=><i key={i} className={Math.abs((i+0.5)*10-win)<=10?'is-mid':''} style={{height:Math.max(3,n/binMax*100)+'%'}}/>)}<u/></div>
   <div className="beat-summary-axis"><span>early</span><span>on time</span><span>late</span></div>
  </div>}
  {r.drift!==null?<p className="beat-summary-lean beat-summary-drift">{shifted===null?<>Your hits landed about {Math.abs(r.drift)} ms {r.drift>0?'late':'early'}. If the tiles felt off from the music, shift the Timing to match. <button type="button" onClick={shift}>Shift Timing {r.drift>0?'+':'−'}{Math.abs(r.drift)} ms</button></>:<>Timing is now {shifted>0?'+':''}{shifted} ms. Play again to try it.</>}</p>
   :lean&&<p className="beat-summary-lean">{lean}: {t.early} early, {t.late} late.</p>}
  {judged>0&&<svg className="beat-summary-strip" viewBox={`0 0 ${W} 22`} preserveAspectRatio="none" role="img" aria-label={'The song, tile by tile: '+t.miss+' missed'}>
   <rect x="0" y="9" width={W} height="4" rx="2" className="is-track"/>
   {r.timeline.map((n,i)=><rect key={i} x={n.t/end*W-0.6} y={n.j==='miss'?2:n.j?6:9} width="1.2" height={n.j==='miss'?18:n.j?10:4} className={'is-'+(n.j??'none')}/>)}
  </svg>}
  {next&&onNext&&<button type="button" className="beat-summary-next" onClick={()=>{saveLast(r.song,next);onNext()}}>{r.failed?'Try it on '+nextName:'Try '+nextName}<span>{r.title} ›</span></button>}
 </div>
}
