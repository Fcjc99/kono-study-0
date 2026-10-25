import './kono-world.css'
import {useEffect,useState} from 'react'
import Modal from './Modal'
import KonoFace from './KonoFace'
import BreakGames from './BreakGames'
import LandGame from './LandGames'
import {LAND_GAMES} from '../store/landGames'
import type {CareEvent} from '../store/konoCare'
import {COIN_ICON,coinText,type GameId,type ShopItem} from '../store/konoCoins'
import {furnitureStock} from '../store/konoShops'
import {paintPose,type PaintId} from '../store/konoLooks'
import {HOME_SPOT,LANDS,findSrc,landFind,lookedToday,worldSrc,type Land,type LandId} from '../store/konoWorld'
import {playSfx} from '../konoSounds'

/** The land you were in, so the world map opens back there (this device only). */
const SPOT_KEY='kono-world-spot'
const readSpot=()=>{try{return localStorage.getItem(SPOT_KEY)??''}catch{return ''}}
const saveSpot=(spot:string)=>{try{if(spot)localStorage.setItem(SPOT_KEY,spot);else localStorage.removeItem(SPOT_KEY)}catch{/* storage unavailable */}}
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches

/** KONO's world map (the island's "World map" tab, or KONO's corner): KONO's island and the lands around it.
 * Tap an open land and KONO travels there (the map zooms into it). In a land KONO walks about, there's one
 * look around a day for a treasure, a market with furniture found nowhere else, the land's own game at its
 * booth (components/LandGames) and the arcade's games.
 * Lands open as KONO's bond grows. It opens back in the land you were last in. Loaded only when opened. */
export default function KonoWorld({onBlastCoins,close,today,hearts,paint,outfit,log,found,balance,owned,onBuy,onLook,roundsLeft,onGame,sound,onOpenHouse}:{
 close:()=>void
 today:string
 /** KONO's bond hearts (store/konoBond): each land opens at a number of them. */
 hearts:number
 paint:PaintId|null;outfit:string|null
 log:CareEvent[];found:Map<string,number>
 balance:number;owned:Map<string,number>
 onBuy:(item:ShopItem)=>void
 /** Today's look around in a land found this treasure. */
 onLook:(land:LandId,findId:string)=>void
 roundsLeft:number
 onGame:(game:GameId,score:number)=>number|null
 /** KONO blast's coins for a clear (store/konoCoins › blastEvent): what was paid, or null at today's limit. */
 onBlastCoins:(lines:number,streak:number)=>number|null
 sound:boolean
 onOpenHouse:()=>void
}){
 const [view,setView]=useState<'map'|LandId>(()=>{const spot=readSpot();return LANDS.find(l=>l.id===spot&&l.hearts<=hearts)?.id??'map'}),[going,setGoing]=useState<Land|null>(null),[zoom,setZoom]=useState(false)
 const [panel,setPanel]=useState<'market'|'game'|'play'|null>(null),[note,setNote]=useState('')
 const [kono,setKono]=useState({x:0.5,y:0.75})
 const land=view==='map'?null:LANDS.find(l=>l.id===view)!
 // KONO strolls about the land now and then.
 useEffect(()=>{
  if(view==='map'||reducedMotion())return
  const t=window.setInterval(()=>setKono({x:0.28+Math.random()*0.44,y:0.58+Math.random()*0.28}),5200)
  return ()=>window.clearInterval(t)
 },[view])
 const travel=(l:Land)=>{
  if(l.hearts>hearts||going)return
  playSfx('door',sound)
  saveSpot(l.id)
  if(reducedMotion()){setView(l.id);setKono({x:0.5,y:0.75});return}
  setGoing(l)
  window.setTimeout(()=>setZoom(true),900)
  window.setTimeout(()=>{setView(l.id);setGoing(null);setZoom(false);setKono({x:0.5,y:0.98});window.setTimeout(()=>setKono({x:0.5,y:0.75}),80)},1600)
 }
 const back=()=>{saveSpot('');setView('map');setPanel(null);setNote('')}
 const looked=land?lookedToday(log,land.id,today):undefined
 const lookAround=()=>{
  if(!land||looked)return
  const f=landFind(land,found,Math.random())
  onLook(land.id,f.id);playSfx('win',sound)
  setNote('🔍 KONO found '+(/^[aeiou]/i.test(f.name)?'an ':'a ')+f.name.toLowerCase()+'! It’s in Decorate › Finds.')
 }
 const buy=(item:ShopItem)=>{if(item.price>balance)return;onBuy(item);playSfx('buy',sound);setNote('🏠 The '+item.name.toLowerCase()+' is in KONO’s house, ready to place.')}
 const konoAt=going?going.map:HOME_SPOT
 const pose=paintPose('/garden/kono/'+(going?'walk-down-01':'happy')+'.webp',paint)
 return <Modal title={land?land.name:'World map'} close={close}>
  <div className="kono-world">
   {!land?<div className={'world-map'+(zoom?' is-zooming':'')} style={{backgroundImage:`url(${worldSrc('world-map')})`,...(going?{['--to-x' as string]:going.map.x*100+'%',['--to-y' as string]:going.map.y*100+'%'}:{})}}>
    {LANDS.map(l=>{const open=l.hearts<=hearts;return <button type="button" key={l.id} className={'world-place'+(open?'':' is-locked')} style={{left:l.map.x*100+'%',top:l.map.y*100+'%'}} disabled={!open||!!going} aria-label={open?'Go to '+l.name:l.name+', opens at '+l.hearts+' bond hearts'} onClick={()=>travel(l)}>
     <span aria-hidden="true">{open?l.emoji:'🔒'}</span><small>{l.name}</small>{open?<small className="world-game">{LAND_GAMES[l.id].emoji} {LAND_GAMES[l.id].name}</small>:<small className="world-lock">Opens at {l.hearts} 💗</small>}
    </button>})}
    <span className="world-kono" style={{left:konoAt.x*100+'%',top:konoAt.y*100+'%'}} aria-hidden="true"><span className="kono-face-box" style={{width:44,height:44}}><KonoFace pose={pose} outfit={outfit} size={44}/></span></span>
   </div>
   :<div className="world-land is-entering" style={{backgroundImage:`url(${worldSrc('land-'+land.id)})`}}>
    <button type="button" className="world-stall" style={{left:land.stall.x*100+'%',top:land.stall.y*100+'%'}} aria-label={'The '+land.name+' market'} onClick={()=>setPanel(p=>p==='market'?null:'market')}><span aria-hidden="true">🛒</span><small>Market</small></button>
    <button type="button" className="world-stall is-game" style={{left:LAND_GAMES[land.id].booth.x*100+'%',top:LAND_GAMES[land.id].booth.y*100+'%'}} aria-label={'The '+LAND_GAMES[land.id].name+' booth'} aria-pressed={panel==='game'} onClick={()=>{setPanel(p=>p==='game'?null:'game');requestAnimationFrame(()=>document.querySelector('.world-play')?.scrollIntoView({block:'start',behavior:reducedMotion()?'auto':'smooth'}))}}><span aria-hidden="true">{LAND_GAMES[land.id].emoji}</span><small>{LAND_GAMES[land.id].name}</small></button>
    <span className="world-kono is-strolling" style={{left:kono.x*100+'%',top:kono.y*100+'%'}} aria-hidden="true"><span className="kono-face-box" style={{width:64,height:64}}><KonoFace pose={paintPose('/garden/kono/happy.webp',paint)} outfit={outfit} size={64}/></span></span>
   </div>}
   <p className="world-status" aria-live="polite">{note||(land?land.line:going?'KONO sets off for '+going.name+'…':'Where should KONO go? Tap a place on the map.')}</p>
   {land&&<div className="wb-toolbar world-tools">
    <button type="button" onClick={back}>← World map</button>
    <button type="button" className="primary" disabled={!!looked} onClick={lookAround}>{looked?'Looked around today ✓':'🔍 Look around'}</button>
    <button type="button" aria-pressed={panel==='play'} onClick={()=>setPanel(p=>p==='play'?null:'play')}>🎮 Arcade</button>
   </div>}
   {land&&looked&&!note&&<p className="world-found"><img src={findSrc(looked.item??'')} alt=""/>Today KONO found something here already. Come back tomorrow for another look.</p>}
   {land&&panel==='market'&&<section className="world-market" aria-label="Market">
    <h3>{land.emoji} Market <small>Furniture you’ll only find here, for KONO’s house · {COIN_ICON} {coinText(Math.max(0,balance))}</small></h3>
    <ul>{furnitureStock(land.id).map(item=>{const short=item.price-balance;return <li key={item.key}>
     <img src={item.img} alt=""/><strong>{item.name}</strong>
     <button type="button" disabled={short>0} aria-label={'Buy '+item.name+' for '+coinText(item.price)} onClick={()=>buy(item)}>{COIN_ICON} {item.price}</button>
     {owned.get(item.id)?<small>You have {owned.get(item.id)}</small>:short>0?<small>{coinText(short)} more</small>:null}
    </li>})}</ul>
    <p className="world-market-go"><button type="button" onClick={onOpenHouse}>🏠 Go to KONO’s house</button></p>
   </section>}
   {land&&panel==='game'&&<div className="world-play">
    <p>{roundsLeft?<><strong>{roundsLeft}</strong> coin rounds left today.</>:'Today’s coin rounds are used up. Play just for fun!'}</p>
    <LandGame key={land.id} land={land.id} sound={sound} kono={paintPose('/garden/kono/happy.webp',paint)} onScore={(game,score)=>{const n=onGame(game,score);if(n)playSfx('coin',sound);return n?'+'+coinText(n)+'! '+COIN_ICON:null}}/>
   </div>}
   {land&&panel==='play'&&<section className="world-play" aria-label="Play">
    <p>{roundsLeft?<><strong>{roundsLeft}</strong> coin rounds left today.</>:'Today’s coin rounds are used up. Play just for fun!'}</p>
    <BreakGames startedAt={0} arcade sound={sound} onBlastCoins={onBlastCoins} coins={{balance,onBuy}} onScore={(game,score)=>{const n=onGame(game,score);if(n)playSfx('coin',sound);return n?'+'+coinText(n)+'! '+COIN_ICON:null}}/>
   </section>}
  </div>
 </Modal>
}
