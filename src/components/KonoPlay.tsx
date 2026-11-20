import Icon from './Icon'

/** KONO's page (the Sanctuary), under the island: everything to play, four big tiles. KONO Town (shops, the
 * prize wheel), the Arcade (KONO Beat and the rest), Decorate (the island and KONO's things) and the World map. */
export default function KonoPlay({onTown,onArcade,onDecorate,onWorld,coins}:{onTown:()=>void;onArcade:()=>void;onDecorate:()=>void;onWorld:()=>void;coins:number}){
 const tiles:[string,string,string,string,()=>void][]=[
  ['town','KONO Town','Shops & prize wheel · 🪙 '+Math.max(0,coins).toLocaleString(),'town',onTown],
  ['arcade','Arcade','KONO Beat and more','arcade',onArcade],
  ['decorate','Decorate','The island, furniture, stickers','decorate',onDecorate],
  ['world','World map','The beach, the forest, the village','world',onWorld],
 ]
 return <section className="kono-play" aria-label="Play">
  <h2>Play</h2>
  <div className="kono-play-grid">{tiles.map(([id,name,detail,emoji,open])=><button type="button" key={id} className={'kono-play-tile is-'+id} onClick={open}><b>{name}</b><small>{detail}</small><span><Icon name={emoji} size={44}/></span></button>)}</div>
 </section>
}
