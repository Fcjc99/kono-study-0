/** The arcade's game covers (BreakGames' game list): a small moving scene for each game, drawn in CSS
 * (break-games.css › .game-cover), so the list looks like a shelf of games, not a list of emoji.
 * KONO blast's piece drops into place; Meowdoku's cats sit in their colors; the gems twinkle; a striped
 * candy wobbles; KONO Flow's shape falls through neon; KONO Beat's notes fall down four lanes; KONO flaps between pipes; KONO's tower climbs with a floor sliding in; medals pile up on a dock with the pusher sliding and a jackpot sign; garden things pile up in a jar with a bean dropping in; KONO.io's trail loops
 * home. Pictures only (the card's name and words say what each is). */
const BLAST=['','c0','c0','','c3','','c5','c1','c1','c2','c3','c3','c5','c5','c1','c2','c2','c4','c4','c6','c6','','c2','c4','c4','','c6','']
const MEOW=['a','a','b','b','a','c','c','b','d','c','e','e','d','d','e','e']
export default function GameCover({game}:{game:string}){
 return <span className={'game-cover is-'+game} aria-hidden="true">{
  game==='blast'?<><span className="gc-grid">{BLAST.map((c,i)=><i key={i} className={c}/>)}</span><span className="gc-drop"><i/><i/><i/></span></>
  :game==='meow'?<span className="gc-meow">{MEOW.map((c,i)=><i key={i} className={'is-'+c}>{i===1||i===6||i===12?'🐱':''}</i>)}</span>
  :game==='gems'?<span className="gc-gems">{['red','yellow','green','blue','purple'].map((c,i)=><i key={c} className={'is-'+c} style={{animationDelay:i*-0.4+'s'}}/>)}<b className="gc-twinkle"/></span>
  :game==='candy'?<span className="gc-candy">{['red','orange','blue','green'].map(c=><i key={c} className={'is-'+c}/>)}<i className="is-striped"/></span>
  :game==='flow'?<span className="gc-flow"><span className="gc-stack">{Array.from({length:14},(_,i)=><i key={i}/>)}</span><span className="gc-fall"><i/><i/><i/><i/></span></span>
  :game==='beat'?<span className="gc-beat">{[0,1,2,3].map(l=><span key={l} className={'gc-lane is-'+l}><i/><i/></span>)}<b className="gc-line"/></span>
  :game==='stack'?<span className="gc-stack-cakes">{[0,1,2,3,4].map(i=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}<b className="gc-cake-drop"/></span>
  :game==='cove'?<span className="gc-cove"><b className="gc-cove-pusher"/>{Array.from({length:14},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}<em>JP</em></span>
  :game==='bloom'?<span className="gc-bloom">{['🌳','🎃','🌻','🌷','🍀','🌱'].map((e,i)=><i key={i} className={'is-'+i}>{e}</i>)}<b className="gc-bloom-drop">🫘</b></span>
  :game==='flap'?<span className="gc-flap"><i className="gc-pipe is-top"/><i className="gc-pipe is-bottom"/><img src="/garden/kono/happy.webp" alt="" loading="lazy"/></span>
  :game==='paper'?<span className="gc-paper"><i className="is-blue"/><i className="is-red"/><b className="gc-trail"/></span>
  :null}</span>
}
