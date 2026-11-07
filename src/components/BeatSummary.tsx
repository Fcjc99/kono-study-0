import type {BeatResult} from './RhythmGame'
import type {Judge} from '../store/rhythm'
import './beat-summary.css'

const ROWS:{j:Judge;name:string}[]=[{j:'perfect',name:'Perfect'},{j:'great',name:'Great'},{j:'good',name:'Good'},{j:'miss',name:'Miss'}]
const CLEAR:Record<BeatResult['clear'],string>={fail:'',clear:'Clear',full:'Full combo',all:'All perfect'}
/** KONO Beat's results, under the score: the grade, how the hits went (a bar for each kind), the best combo,
 * whether you lean early or late, and the song as a strip with a mark for every tile (where you missed shows
 * up red, so you can see the hard part). */
export default function BeatSummary({r}:{r:BeatResult}){
 const t=r.tally,judged=t.perfect+t.great+t.good+t.miss,most=Math.max(1,...ROWS.map(x=>t[x.j]))
 const lean=t.early+t.late>=4?(t.early>t.late*1.5?'You tap a little early':t.late>t.early*1.5?'You tap a little late':'Early and late, evenly'):null
 const W=300,end=Math.max(1,r.ms)
 return <div className="beat-summary" style={{'--grade':r.failed?'#ff6b81':r.grade.startsWith('S')?'#ffd34d':r.grade==='A'?'#7ee0ff':'#b9ff9e'} as React.CSSProperties}>
  <div className="beat-summary-head">
   <span className="beat-summary-grade" aria-label={'Grade '+r.grade}>{r.grade}</span>
   <dl>
    <div><dt>Accuracy</dt><dd>{r.acc.toFixed(1)}%</dd></div>
    <div><dt>Best combo</dt><dd>{t.best}</dd></div>
    <div><dt>Tiles</dt><dd>{r.tiles} / {r.of}</dd></div>
   </dl>
   {(r.warmup||CLEAR[r.clear])&&<span className="beat-summary-clear">{r.warmup?'Warm-up':CLEAR[r.clear]}{r.classic&&!r.warmup?' · Classic':''}</span>}
  </div>
  <ul className="beat-summary-bars" aria-label="Hits">{ROWS.map(x=><li key={x.j} className={'is-'+x.j}><span>{x.name}</span><i style={{width:(t[x.j]/most*100)+'%'}}/><b>{t[x.j]}</b></li>)}</ul>
  {lean&&<p className="beat-summary-lean">{lean}: {t.early} early, {t.late} late. The Sync check can fix it.</p>}
  {judged>0&&<svg className="beat-summary-strip" viewBox={`0 0 ${W} 22`} preserveAspectRatio="none" role="img" aria-label={'The song, tile by tile: '+t.miss+' missed'}>
   <rect x="0" y="9" width={W} height="4" rx="2" className="is-track"/>
   {r.timeline.map((n,i)=><rect key={i} x={n.t/end*W-0.6} y={n.j==='miss'?2:n.j?6:9} width="1.2" height={n.j==='miss'?18:n.j?10:4} className={'is-'+(n.j??'none')}/>)}
  </svg>}
 </div>
}
