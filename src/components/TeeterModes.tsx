import {dailyBest,dailySeed,teeterLevel} from '../store/teeter'
import './teeter-modes.css'

export type TeeterPick='classic'|'daily'|'puzzle'
/** KONO Teeter Tower's start card: the classic climb, today's tower (the same blocks for everyone today),
 * or the next puzzle level. */
export default function TeeterModes({pick,onPick}:{pick:TeeterPick;onPick:(p:TeeterPick)=>void}){
 const today=dailyBest(dailySeed()),level=teeterLevel()
 const modes:[TeeterPick,string,string,string][]=[
  ['classic','🗼','Classic','As high as you can'],
  ['daily','📅','Today’s tower',today!==null?'Your best today: '+today:'Same blocks for everyone'],
  ['puzzle','🚩','Puzzles','Level '+level+' is next'],
 ]
 return <div className="teeter-modes" role="radiogroup" aria-label="How to play">
  {modes.map(([id,emoji,name,sub])=><button key={id} type="button" role="radio" aria-checked={pick===id} className={pick===id?'is-on':undefined} onClick={()=>onPick(id)}>
   <span aria-hidden="true">{emoji}</span><b>{name}</b><small>{sub}</small>
  </button>)}
 </div>
}
