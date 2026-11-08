import KonoIcon from './KonoIcon'
import './island-mini.css'

/** Home's island tucked away: a slim bar with KONO, the Arcade and "Show island". */
export default function IslandMini({pose,onArcade,onShow}:{pose:string;onArcade:()=>void;onShow:()=>void}){
 return <section className="wb-island-mini" aria-label="Your island (tucked away)"><img src={pose} alt="" aria-hidden="true"/><p><strong>KONO’s island</strong><small>Tucked away</small></p><button type="button" className="wb-island-mini-arcade" onClick={onArcade}><KonoIcon name="arcade"/><span>Arcade</span></button><button type="button" className="wb-island-mini-show" aria-expanded="false" onClick={onShow}>Show island <span aria-hidden="true">▾</span></button></section>
}
