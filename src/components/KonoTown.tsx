import './kono-town.css'
import {useState,type ReactNode} from 'react'
import Modal from './Modal'
import KonoFace from './KonoFace'
import BreakGames from './BreakGames'
import {playSfx} from '../konoSounds'
import {coinBurst} from '../delight'
import type {Treat} from '../store/konoCare'
import {COIN_ICON,COIN_ROUNDS,WHEEL,coinText,type GameId,type ShopItem} from '../store/konoCoins'
import {boughtLine,foodStock,furnitureStock,outfitStock,paintStock,roomStock,treasureStock} from '../store/konoShops'
import type {OutfitId} from '../store/konoWardrobe'
import {albumCount,albumSections,type AlbumInput} from '../store/konoAlbum'
import type {PaintId} from '../store/konoLooks'

export type TownTab='shops'|'home'|'wheel'|'arcade'|'album'
const TABS:{id:TownTab;icon:string;label:string}[]=[{id:'shops',icon:'🛍️',label:'Shops'},{id:'home',icon:'🎨',label:'Paint & home'},{id:'wheel',icon:'🎡',label:'Prize wheel'},{id:'arcade',icon:'🕹️',label:'Arcade'},{id:'album',icon:'📖',label:'Album'}]
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches

/** KONO Town (the coin button in the KONO bar, or KONO's corner): where coins are spent and won. Today's
 * quest sits on top; then the shops (food, outfits, treasures; colors for KONO and furniture for KONO's
 * house), the prize wheel (one free spin a day),
 * the arcade (the first few rounds a day win coins) and the album of everything there is to collect.
 * Loaded only when opened. */
export default function KonoTown({close,sound=true,balance,startTab='shops',quest,onGiveQuest,today,outfitsOwned,found,paints,furniture,rooms,onBuy,spin,onSpin,roundsLeft,onGame,album:albumInput}:{
 close:()=>void
 /** Settings › Sounds: KONO Town's little sounds. */
 sound?:boolean
 balance:number
 startTab?:TownTab
 quest:{treat:Treat;reward:number;done:boolean;canGive:boolean}
 onGiveQuest:()=>void
 /** For the day's stock: today, outfits KONO has, treasures found. */
 today:string;outfitsOwned:Set<OutfitId>;found:Map<string,number>
 /** Colors: all of them, which are owned, which KONO wears (null: classic), and wearing one. */
 paints:{owned:Set<PaintId>;worn:PaintId|null;onWear:(id:PaintId|null)=>void}
 /** Furniture: all of it, how many of each KONO has, and opening the house to place it. */
 furniture:{owned:Map<string,number>;onOpenHouse:()=>void}
 /** Room styles for KONO's house: which are owned, which is in use, and using one. */
 rooms:{owned:Set<string>;current:string;onUse:(id:string)=>void}
 onBuy:(item:ShopItem)=>void
 /** Today's spin, if already spun (the coins it won). onSpin spins and returns the slice won. */
 spin:number|null;onSpin:()=>number|null
 roundsLeft:number
 /** A finished arcade game: the coins it won (null when today's coin rounds are used up). */
 onGame:(game:GameId,score:number)=>number|null
 album:AlbumInput
}){
 const food=foodStock(today),outfits=outfitStock(outfitsOwned,today),treasures=treasureStock(found,today),album=albumSections(albumInput)
 const [tab,setTab]=useState<TownTab>(startTab),[note,setNote]=useState('')
 const buy=(item:ShopItem,el?:Element)=>{if(item.price>balance)return;onBuy(item);setNote(boughtLine(item));playSfx('buy',sound);coinBurst(el??null)}
 const shop=(title:string,blurb:string,items:ShopItem[],empty:string,owned?:(item:ShopItem)=>ReactNode,after?:ReactNode)=><section className="town-shop" aria-label={title}>
  <h3>{title} <small>{blurb}</small></h3>
  {items.length?<ul className="town-items">{items.map(item=>{const short=item.price-balance;return <li key={item.key} className={item.sale?'is-sale':undefined}>
   <span className={'town-item-art is-'+item.kind} aria-hidden="true">{item.kind==='outfit'?<span className="kono-face-box"><KonoFace pose="/garden/kono/happy.webp" outfit={item.id} size={56}/></span>:item.img?<img src={item.img} alt=""/>:<span>{item.emoji}</span>}</span>
   <strong>{item.name[0].toUpperCase()+item.name.slice(1)}</strong>
   {item.sale&&<em className="town-sale">Sale!</em>}
   {owned?.(item)??<><button type="button" disabled={short>0} aria-label={'Buy '+item.name+' for '+(item.price?coinText(item.price):'free')} onClick={e=>buy(item,e.currentTarget)}>{item.price?<>{COIN_ICON} {item.price}</>:'Free'}</button>
   {short>0&&<small className="town-short">{coinText(short)} more</small>}</>}
   {item.kind==='furniture'&&!!furniture.owned.get(item.id)&&<small className="town-short">You have {furniture.owned.get(item.id)}</small>}
  </li>})}</ul>:<p className="wb-muted">{empty}</p>}
  {after}
 </section>
 const useRoomButton=(item:ShopItem)=>{
  if(!rooms.owned.has(item.id))return null
  const on=rooms.current===item.id
  return <button type="button" aria-pressed={on} className={on?'primary':undefined} aria-label={on?item.name+' is in KONO’s house':'Use '+item.name+' in KONO’s house'} onClick={()=>{rooms.onUse(on?'classic':item.id);setNote(on?'KONO’s house is classic again.':'🏠 KONO’s house is '+item.name.toLowerCase()+' now!')}}>{on?'In the house ✓':'Use it'}</button>
 }
 const wearButton=(item:ShopItem)=>{
  const id=item.id as PaintId
  if(!paints.owned.has(id))return null
  const on=paints.worn===id
  return <button type="button" aria-pressed={on} className={on?'primary':undefined} aria-label={(on?'Take off ':'Paint KONO ')+item.name} onClick={()=>{paints.onWear(on?null:id);setNote(on?'KONO is back to classic.':'🎨 KONO is '+item.name+' now!')}}>{on?'Wearing ✓':'Paint KONO'}</button>
 }
 const count=albumCount(album)
 return <Modal title="KONO Town" close={close}>
  <div className="kono-town">
   <p className="town-purse" aria-live="polite"><span aria-hidden="true">{COIN_ICON}</span> <strong>{coinText(Math.max(0,balance))}</strong><small>Finish things, grant KONO’s wishes and play to earn more.</small></p>
   <section className={'town-quest'+(quest.done?' is-done':'')} aria-label="KONO’s quest">
    <span className="town-quest-snack" aria-hidden="true">{quest.treat.emoji}</span>
    <p>{quest.done?<><strong>Quest done!</strong> KONO loved the {quest.treat.name}. A new quest tomorrow.</>:<><strong>KONO’s quest:</strong> KONO is craving a {quest.treat.name}! Bring one today for {coinText(quest.reward)}.</>}</p>
    {!quest.done&&(quest.canGive?<button type="button" className="primary" onClick={e=>{onGiveQuest();playSfx('win',sound);coinBurst(e.currentTarget)}}>Give the {quest.treat.name}</button>:<button type="button" onClick={()=>setTab('shops')}>Find one</button>)}
   </section>
   <nav className="town-tabs" aria-label="KONO Town">{TABS.map(t=><button type="button" key={t.id} aria-current={tab===t.id?'page':undefined} onClick={()=>{setTab(t.id);setNote('')}}><span aria-hidden="true">{t.icon}</span> {t.label}</button>)}</nav>
   {note&&<p className="town-note" role="status">{note}</p>}
   {tab==='shops'&&<>
    {shop('Food shop','For KONO’s snacks. New stock every day.',food,'Sold out! Come back tomorrow.')}
    {shop('Boutique','Outfits to keep. One is on sale each day.',outfits,'KONO has every outfit there is right now!')}
    {shop('Treasure shop','Treasures KONO hasn’t found yet, for the island.',treasures,'KONO has found every treasure there is right now!')}
   </>}
   {tab==='home'&&<>
    {shop('Paint shop','Colors KONO keeps for good. Switch any time.',paintStock(),'',wearButton,paints.worn&&<p className="town-classic"><button type="button" onClick={()=>{paints.onWear(null);setNote('KONO is back to classic.')}}>Back to classic KONO</button></p>)}
    {shop('Walls & floors','The same room with new walls and floors. Furniture stays put.',roomStock(),'',useRoomButton)}
    {shop('Furniture shop','For KONO’s house. Place it in the room.',furnitureStock(),'',undefined,<p className="town-classic"><button type="button" className="primary" onClick={furniture.onOpenHouse}>🏠 Go to KONO’s house</button></p>)}
   </>}
   {tab==='wheel'&&<PrizeWheel spin={spin} onSpin={onSpin} sound={sound}/>}
   {tab==='arcade'&&<section className="town-arcade" aria-label="Arcade">
    <p className="town-rounds">{roundsLeft?<><strong>{roundsLeft} of {COIN_ROUNDS}</strong> coin rounds left today. After that, play just for fun.</>:<>Today’s coin rounds are used up. Play just for fun, or come back tomorrow!</>}</p>
    <BreakGames startedAt={0} arcade sound={sound} onScore={(game,score)=>{const n=onGame(game,score);if(n){playSfx('coin',sound);coinBurst(document.querySelector('.town-purse'))}return n?'+'+coinText(n)+'! '+COIN_ICON:null}}/>
   </section>}
   {tab==='album'&&<section className="town-album" aria-label="Album">
    <p className="town-album-count"><span><strong>{count.owned} of {count.total}</strong> collected</span><span className="town-album-bar" aria-hidden="true"><i style={{width:(count.total?count.owned/count.total*100:0)+'%'}}/></span></p>
    {album.map(s=>{const owned=s.items.filter(i=>i.owned).length;return <section key={s.id} aria-label={s.title}>
     <h3>{s.title} <small>{owned}/{s.items.length}</small></h3>
     <ul className="town-album-grid">{s.items.map(i=><li key={i.id} className={i.owned?'is-owned':'is-missing'} title={i.owned?i.name:i.how} aria-label={i.owned?i.name:i.name+', not yet. '+i.how}>
      <span className="town-item-art" aria-hidden="true">{i.outfit?<span className="kono-face-box"><KonoFace pose="/garden/kono/idle.webp" outfit={i.outfit} size={48}/></span>:i.img?<img src={i.img} alt=""/>:<span>{i.emoji}</span>}</span>
      <small>{i.owned?i.name:'?'}</small>
     </li>)}</ul>
    </section>})}
   </section>}
  </div>
 </Modal>
}

/** One free spin a day. The slice is picked when the button is pressed (and saved straight away); the wheel
 * then turns to it. */
function PrizeWheel({spin,onSpin,sound}:{spin:number|null;onSpin:()=>number|null;sound:boolean}){
 const at=(slice:number)=>-(slice*45+22.5)
 const [angle,setAngle]=useState(()=>spin===null?0:at(Math.max(0,WHEEL.indexOf(spin))))
 const [spinning,setSpinning]=useState(false),[won,setWon]=useState<number|null>(null)
 const go=()=>{
  const slice=onSpin();if(slice===null)return
  setSpinning(true);setAngle(360*6+at(slice))
  // Ticks that slow down with the wheel, then a little tune for the win.
  const quick=reducedMotion()
  if(!quick)for(let i=0,t=0;i<26;i++){t+=60+i*i*0.9;if(t>3200)break;window.setTimeout(()=>playSfx('tick',sound),t)}
  window.setTimeout(()=>{setSpinning(false);setWon(WHEEL[slice]);playSfx('win',sound);coinBurst(document.querySelector('.town-wheel-frame'))},quick?0:3400)
 }
 const done=spin!==null&&!spinning
 return <section className="town-wheel-box" aria-label="Prize wheel">
  <div className="town-wheel-frame"><span className="town-wheel-pointer" aria-hidden="true">▼</span>
   <div className="town-wheel" style={{transform:`rotate(${angle}deg)`}} aria-hidden="true">{WHEEL.map((n,i)=><span key={i} style={{transform:`rotate(${i*45+22.5}deg) translateY(-78px)`}}>{n}</span>)}</div>
  </div>
  <p role="status">{spinning?'Round and round it goes…':won!==null?'🎉 You won '+coinText(won)+'!':done?'You won '+coinText(spin)+' today. Come back tomorrow for another spin!':'One free spin a day. Every spin wins!'}</p>
  <button type="button" className="primary" disabled={spin!==null||spinning} onClick={go}>{spin!==null||spinning?'Spun today':'Spin the wheel'}</button>
 </section>
}
