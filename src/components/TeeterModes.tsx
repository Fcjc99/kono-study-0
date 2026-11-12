import {dailyBest,dailySeed,teeterLevel,SKINS,type BoardRow,type SkinId,type TeeterControl} from '../store/teeter'
import './teeter-modes.css'

export type TeeterPick='classic'|'daily'|'puzzle'|'race'
type Skins={owned:Set<SkinId>;chosen:SkinId;onChoose:(id:SkinId)=>void;balance?:number;onBuy?:(id:SkinId)=>void}
/** KONO Teeter Tower's start card: the classic climb, today's tower (the same blocks for everyone today, with
 * the family's board) or the next puzzle level, and the block skins (bought with coins). */
export default function TeeterModes({pick,onPick,skins,board,control,onControl}:{pick:TeeterPick;onPick:(p:TeeterPick)=>void;skins?:Skins;board?:BoardRow[];control?:TeeterControl;onControl?:(c:TeeterControl)=>void}){
 const today=dailyBest(dailySeed()),level=teeterLevel()
 const modes:[TeeterPick,string,string,string][]=[
  ['classic','🗼','Classic','As high as you can'],
  ['daily','📅','Today’s tower',today!==null?'Your best today: '+today:'Same blocks for everyone'],
  ['puzzle','🚩','Puzzles','Level '+level+' is next'],
  ['race','🏁','Race KONO','First to row 15'],
 ]
 return <div className="teeter-start">
  <div className="teeter-modes" role="radiogroup" aria-label="How to play">
   {modes.map(([id,emoji,name,sub])=><button key={id} type="button" role="radio" aria-checked={pick===id} className={pick===id?'is-on':undefined} onClick={()=>onPick(id)}>
    <span aria-hidden="true">{emoji}</span><b>{name}</b><small>{sub}</small>
   </button>)}
  </div>
  {control&&onControl&&<div className="teeter-control" role="radiogroup" aria-label="How blocks come">
   {([['fall','⬇️','Falling','Steer them as they fall'],['hold','🤲','Hold & drop','KONO holds, you let go']] as const).map(([id,emoji,name,sub])=><button key={id} type="button" role="radio" aria-checked={control===id} className={control===id?'is-on':undefined} onClick={()=>onControl(id)}><span aria-hidden="true">{emoji}</span><b>{name}</b><small>{sub}</small></button>)}
  </div>}
  {pick==='daily'&&board&&<TeeterBoard rows={board}/>}
  {skins&&<div className="teeter-skins" role="group" aria-label="Block skins">
   {SKINS.map(s=>{const own=skins.owned.has(s.id),on=skins.chosen===s.id,short=!own&&(skins.balance===undefined||skins.balance<s.price)
    return <button key={s.id} type="button" aria-pressed={own?on:undefined} disabled={!own&&(!skins.onBuy||short)} className={'is-'+s.id+(on?' is-on':'')+(own?'':' is-for-sale')}
     aria-label={own?s.name+' blocks'+(on?', in use':''):'Buy '+s.name+' blocks for '+s.price+' coins'+(short?' (not enough coins yet)':'')}
     onClick={()=>own?skins.onChoose(s.id):skins.onBuy?.(s.id)}>
     <span className="teeter-swatch" aria-hidden="true"/><small>{own?s.name:'🪙 '+s.price}</small>
    </button>})}
  </div>}
 </div>
}

/** Today's tower: how high everyone in the family got today. */
export function TeeterBoard({rows}:{rows:BoardRow[]}){
 return <section className="teeter-board" aria-label="Today’s family board">
  <h3>Today’s family board</h3>
  {rows.length?<ol>{rows.map((r,i)=><li key={r.name+i} className={r.me?'is-me':undefined}><span aria-hidden="true">{i===0?'👑':r.avatar??'🙂'}</span><b>{r.name}{r.me?' (you)':''}</b><em>{r.height} row{r.height===1?'':'s'}</em></li>)}</ol>
   :<p>No one has played today’s tower yet. Be the first!</p>}
 </section>
}
