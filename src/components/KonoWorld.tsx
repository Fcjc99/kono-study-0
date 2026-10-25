import './kono-world.css'
import {useEffect,useRef,useState,type MouseEvent} from 'react'
import Modal from './Modal'
import KonoFace from './KonoFace'
import BreakGames from './BreakGames'
import LandGame from './LandGames'
import {LAND_GAMES} from '../store/landGames'
import type {CareEvent} from '../store/konoCare'
import {COIN_ICON,coinText,type GameId,type ShopItem} from '../store/konoCoins'
import {furnitureStock} from '../store/konoShops'
import {paintPose,type PaintId} from '../store/konoLooks'
import {FRIENDS,HOME_SPOT,LANDS,SEA_SPOTS,findSrc,landFind,lightAt,lookedToday,worldSrc,type Friend,type Land,type LandId} from '../store/konoWorld'
import {LandFx,MapFx} from './WorldFx'
import {playSfx} from '../konoSounds'

/** The land you were in, so the world map opens back there (this device only). */
const SPOT_KEY='kono-world-spot'
const readSpot=()=>{try{return localStorage.getItem(SPOT_KEY)??''}catch{return ''}}
const saveSpot=(spot:string)=>{try{if(spot)localStorage.setItem(SPOT_KEY,spot);else localStorage.removeItem(SPOT_KEY)}catch{/* storage unavailable */}}
/** The lands KONO has been to and the friends it has met (this device only): the explorer's passport. */
const readSet=(key:string)=>{try{return new Set<string>(JSON.parse(localStorage.getItem(key)??'[]'))}catch{return new Set<string>()}}
const saveSet=(key:string,set:Set<string>)=>{try{localStorage.setItem(key,JSON.stringify([...set]))}catch{/* storage unavailable */}}
const VISITED_KEY='kono-world-visited',FRIENDS_KEY='kono-world-friends'
const SEA_FRIENDS=FRIENDS.filter(f=>!f.land)
const hourNow=()=>new Date().getHours()
type Dir='down'|'up'|'left'|'right'
/** The way from KONO's island to a land: a gentle curve (control point beside the middle). */
function route(l:Land){
 const a=HOME_SPOT,b=l.map,mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1
 const c={x:mx-dy/len*0.05,y:my+dx/len*0.05}
 const at=(t:number)=>({x:(1-t)**2*a.x+2*(1-t)*t*c.x+t*t*b.x,y:(1-t)**2*a.y+2*(1-t)*t*c.y+t*t*b.y})
 return {d:`M${a.x*100} ${a.y*75} Q${c.x*100} ${c.y*75} ${b.x*100} ${b.y*75}`,at}
}
const facing=(dx:number,dy:number):Dir=>Math.abs(dx*1.33)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down')
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
 const [light]=useState(()=>lightAt(hourNow()))
 const [visited,setVisited]=useState(()=>readSet(VISITED_KEY)),[met,setMet]=useState(()=>readSet(FRIENDS_KEY))
 const [sea,setSea]=useState<{friend:Friend;at:{x:number;y:number};key:number}|null>(null)
 const [marks,setMarks]=useState<{key:number;x:number;y:number;step?:boolean}[]>([])
 const [hop,setHop]=useState(0),[step,setStep]=useState(0)
 // KONO in a land: where it stands, which way it faces, and whether it's walking (and for how long).
 const [kono,setKono]=useState({x:0.5,y:0.75,dir:'down' as Dir,ms:0,moving:false})
 const konoRef=useRef<HTMLSpanElement>(null),walkTimer=useRef(0),tapped=useRef(0),markKey=useRef(0)
 const land=view==='map'?null:LANDS.find(l=>l.id===view)!
 const walkTo=(x:number,y:number,l=land)=>{
  if(!l)return
  const w=l.walk,tx=Math.min(w.x1,Math.max(w.x0,x)),ty=Math.min(w.y1,Math.max(w.y0,y))
  setKono(k=>{
   const dx=tx-k.x,dy=ty-k.y,ms=reducedMotion()?0:Math.round(Math.min(2600,Math.max(450,Math.hypot(dx*1.33,dy)*3200)))
   window.clearTimeout(walkTimer.current)
   walkTimer.current=window.setTimeout(()=>setKono(n=>({...n,moving:false})),ms)
   return {x:tx,y:ty,dir:Math.hypot(dx,dy)<0.01?k.dir:facing(dx,dy),ms,moving:ms>0}
  })
 }
 useEffect(()=>()=>window.clearTimeout(walkTimer.current),[])
 // KONO strolls about the land now and then (not right after you've sent it somewhere).
 useEffect(()=>{
  if(view==='map'||reducedMotion())return
  const l=LANDS.find(n=>n.id===view)!
  const t=window.setInterval(()=>{if(Date.now()-tapped.current<9000)return;const w=l.walk;walkTo(w.x0+Math.random()*(w.x1-w.x0),w.y0+(0.3+Math.random()*0.7)*(w.y1-w.y0),l)},5200)
  return ()=>window.clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[view])
 // Walking feet: the walk frames take turns while KONO moves.
 useEffect(()=>{
  if(!kono.moving&&!going)return
  const t=window.setInterval(()=>setStep(s=>s+1),170)
  return ()=>window.clearInterval(t)
 },[kono.moving,going])
 // Sea friends surface somewhere on the open sea now and then (ones not met yet first).
 useEffect(()=>{
  if(view!=='map')return
  let hide=0
  const show=()=>{
   const fresh=SEA_FRIENDS.filter(f=>!readSet(FRIENDS_KEY).has(f.id)),pool=fresh.length&&Math.random()<0.7?fresh:SEA_FRIENDS
   setSea({friend:pool[Math.floor(Math.random()*pool.length)],at:SEA_SPOTS[Math.floor(Math.random()*SEA_SPOTS.length)],key:Date.now()})
   hide=window.setTimeout(()=>setSea(null),5200)
  }
  const first=window.setTimeout(show,1800),t=window.setInterval(show,8000)
  return ()=>{window.clearTimeout(first);window.clearInterval(t);window.clearTimeout(hide)}
 },[view])
 const mark=(x:number,y:number,stepMark=false)=>{
  const key=++markKey.current
  setMarks(m=>[...m.slice(-5),{key,x,y,step:stepMark}])
  window.setTimeout(()=>setMarks(m=>m.filter(n=>n.key!==key)),900)
 }
 const share=(e:MouseEvent<HTMLElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}}
 const meet=(f:Friend)=>{
  setHop(h=>h+1)
  playSfx(met.has(f.id)?'pop':'win',sound,met.has(f.id)?1.3:1)
  if(!met.has(f.id)){const next=new Set(met).add(f.id);setMet(next);saveSet(FRIENDS_KEY,next)}
  setNote(f.emoji+' '+f.line+(met.has(f.id)?'':' New friend in your passport!'))
 }
 const travel=(l:Land)=>{
  if(l.hearts>hearts||going)return
  playSfx('door',sound)
  saveSpot(l.id)
  if(!visited.has(l.id)){const next=new Set(visited).add(l.id);setVisited(next);saveSet(VISITED_KEY,next)}
  setNote('')
  const arrive=()=>{setView(l.id);setGoing(null);setZoom(false);setKono({x:0.5,y:0.98,dir:'up',ms:0,moving:false});window.setTimeout(()=>walkTo(0.5,0.72,l),80)}
  if(reducedMotion()){arrive();return}
  setGoing(l)
  // KONO walks along the dotted way to the land, then the map zooms in.
  const r=route(l)
  konoRef.current?.animate(Array.from({length:21},(_,i)=>{const p=r.at(i/20*0.86);return {left:p.x*100+'%',top:p.y*100+'%'}}),{duration:1500,easing:'ease-in-out',fill:'forwards'})
  window.setTimeout(()=>setZoom(true),1500)
  window.setTimeout(arrive,2200)
 }
 const back=()=>{saveSpot('');setView('map');setPanel(null);setNote('')}
 const looked=land?lookedToday(log,land.id,today):undefined
 const lookAround=()=>{
  if(!land||looked)return
  const f=landFind(land,found,Math.random())
  onLook(land.id,f.id);playSfx('win',sound);setHop(h=>h+1)
  setNote('🔍 KONO found '+(/^[aeiou]/i.test(f.name)?'an ':'a ')+f.name.toLowerCase()+'! It’s in Decorate › Finds.')
 }
 const buy=(item:ShopItem)=>{if(item.price>balance)return;onBuy(item);playSfx('buy',sound);setNote('🏠 The '+item.name.toLowerCase()+' is in KONO’s house, ready to place.')}
 const goDir:Dir=going?facing(going.map.x-HOME_SPOT.x,going.map.y-HOME_SPOT.y):'down'
 const mapPose=paintPose('/garden/kono/'+(going?'walk-'+goDir+'-0'+(step%2+1):'happy')+'.webp',paint)
 const landPose=paintPose('/garden/kono/'+(kono.moving?'walk-'+kono.dir+'-0'+(step%2+1):'happy')+'.webp',paint)
 const critter=land?FRIENDS.find(f=>f.land===land.id):undefined
 const nextLand=LANDS.find(l=>l.hearts>hearts)
 return <Modal title={land?land.name:'World map'} close={close}>
  <div className={'kono-world is-'+light}>
   {!land?<div className={'world-map'+(zoom?' is-zooming':'')+(going?' is-going':'')} style={{backgroundImage:`url(${worldSrc('world-map')})`,...(going?{['--to-x' as string]:going.map.x*100+'%',['--to-y' as string]:going.map.y*100+'%'}:{})}} onClick={e=>{if(e.target!==e.currentTarget||going)return;const p=share(e);mark(p.x,p.y);playSfx('pop',sound,0.7+Math.random()*0.6)}}>
    <svg className="world-routes" viewBox="0 0 100 75" preserveAspectRatio="none" aria-hidden="true">
     {LANDS.map(l=><path key={l.id} d={route(l).d} className={l.hearts<=hearts?(going?.id===l.id?'is-going':'is-open'):'is-locked'}/>)}
    </svg>
    <MapFx light={light}/>
    {LANDS.filter(l=>l.hearts>hearts).map(l=><span key={l.id} className="world-fog" style={{left:l.map.x*100+'%',top:l.map.y*100+'%'}} aria-hidden="true"/>)}
    {marks.map(m=><i key={m.key} className="world-ripple" style={{left:m.x*100+'%',top:m.y*100+'%'}} aria-hidden="true"/>)}
    {sea&&!going&&<button type="button" key={sea.key} className={'world-friend is-sea'+(met.has(sea.friend.id)?'':' is-new')} style={{left:sea.at.x*100+'%',top:sea.at.y*100+'%'}} aria-label={'A '+sea.friend.name.toLowerCase()+'! Say hello'} onClick={()=>{meet(sea.friend);mark(sea.at.x,sea.at.y);setSea(null)}}><span aria-hidden="true">{sea.friend.emoji}</span></button>}
    {LANDS.map((l,i)=>{const open=l.hearts<=hearts,treasure=open&&!lookedToday(log,l.id,today);return <button type="button" key={l.id} className={'world-place'+(open?'':' is-locked')+(going?.id===l.id?' is-target':'')} style={{left:l.map.x*100+'%',top:l.map.y*100+'%',['--i' as string]:i,['--sx' as string]:l.map.x>0.75?'-72%':l.map.x<0.25?'-35%':'-50%'}} disabled={!open||!!going} aria-label={open?'Go to '+l.name:l.name+', opens at '+l.hearts+' bond hearts'} onClick={()=>travel(l)}>
     <span className="world-thumb" aria-hidden="true" style={{backgroundImage:`url(${worldSrc('land-'+l.id)})`}}><b>{open?l.emoji:'🔒'}</b></span><small>{l.name}</small>{open?<small className="world-game">{LAND_GAMES[l.id].emoji} {LAND_GAMES[l.id].name}</small>:<small className="world-lock">Opens at {l.hearts} 💗<span className="world-hearts" style={{['--p' as string]:Math.min(1,hearts/l.hearts)}}/></small>}
     {treasure&&<small className="world-treasure" aria-hidden="true">✨ Treasure today</small>}
    </button>})}
    <span ref={konoRef} className={'world-kono'+(hop%2?' is-hop':hop?' is-hop2':'')} style={{left:HOME_SPOT.x*100+'%',top:HOME_SPOT.y*100+'%'}} aria-hidden="true"><span className="kono-face-box" style={{width:48,height:48}}><KonoFace pose={mapPose} outfit={outfit} size={48}/></span></span>
   </div>
   :<div className={'world-land is-entering is-'+land.id} style={{backgroundImage:`url(${worldSrc('land-'+land.id)})`}} onClick={e=>{if(e.target!==e.currentTarget)return;const p=share(e);tapped.current=Date.now();mark(p.x,p.y,true);walkTo(p.x,p.y)}}>
    <LandFx land={land.id} light={light}/>
    {marks.map(m=><i key={m.key} className="world-ripple is-step" style={{left:m.x*100+'%',top:m.y*100+'%'}} aria-hidden="true"/>)}
    <button type="button" className="world-stall" style={{left:land.stall.x*100+'%',top:land.stall.y*100+'%'}} aria-label={'The '+land.name+' market'} onClick={()=>setPanel(p=>p==='market'?null:'market')}><span aria-hidden="true">🛒</span><small>Market</small></button>
    <button type="button" className="world-stall is-game" style={{left:LAND_GAMES[land.id].booth.x*100+'%',top:LAND_GAMES[land.id].booth.y*100+'%'}} aria-label={'The '+LAND_GAMES[land.id].name+' booth'} aria-pressed={panel==='game'} onClick={()=>{setPanel(p=>p==='game'?null:'game');requestAnimationFrame(()=>document.querySelector('.world-play')?.scrollIntoView({block:'start',behavior:reducedMotion()?'auto':'smooth'}))}}><span aria-hidden="true">{LAND_GAMES[land.id].emoji}</span><small>{LAND_GAMES[land.id].name}</small></button>
    {critter&&<button type="button" className={'world-friend is-'+critter.id+(met.has(critter.id)?'':' is-new')} aria-label={'A '+critter.name.toLowerCase()+'! Say hello'} onClick={e=>{const r=(e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(),b=e.currentTarget.getBoundingClientRect();tapped.current=Date.now();walkTo((b.left+b.width/2-r.left)/r.width,(b.top+b.height-r.top)/r.height+0.06);meet(critter)}}><span aria-hidden="true">{critter.emoji}</span></button>}
    <span className={'world-kono is-strolling'+(hop%2?' is-hop':hop?' is-hop2':'')} style={{left:kono.x*100+'%',top:kono.y*100+'%',transitionDuration:kono.ms+'ms'}} aria-hidden="true"><span className="kono-face-box" style={{width:64,height:64}}><KonoFace pose={landPose} outfit={outfit} size={64}/></span></span>
   </div>}
   <p className="world-status" aria-live="polite">{note||(land?land.line+' Tap the ground and KONO walks there.':going?'KONO sets off for '+going.name+'…':'Where should KONO go? Tap a place on the map, or say hello to the sea friends.')}</p>
   {!land&&<section className="world-passport" aria-label="Explorer’s passport">
    <h3>🧭 Explorer’s passport <small>{visited.size} of {LANDS.length} lands · {met.size} of {FRIENDS.length} friends</small></h3>
    <ul className="world-stamps">{LANDS.map(l=>{const open=l.hearts<=hearts,been=visited.has(l.id);return <li key={l.id} className={been?'is-stamped':open?'is-open':'is-locked'}><span aria-hidden="true">{open?l.emoji:'🔒'}</span><small>{been?'Visited':open?'Not yet visited':l.hearts+' 💗 to open'}</small><strong>{l.name}</strong></li>})}</ul>
    <ul className="world-friends" aria-label="Friends met">{FRIENDS.map(f=><li key={f.id} className={met.has(f.id)?'is-met':''} title={met.has(f.id)?f.name:'Not met yet'}><span aria-hidden="true">{f.emoji}</span><span className="sr-only">{met.has(f.id)?f.name:'Not met yet'}</span></li>)}</ul>
    {nextLand&&<p className="world-next">💗 {nextLand.hearts-hearts} more bond {nextLand.hearts-hearts===1?'heart':'hearts'} opens {nextLand.name}. Care for KONO to grow your bond.</p>}
   </section>}
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
