import './kono-house.css'
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react'
import Modal from './Modal'
import KonoFace from './KonoFace'
import {uid} from '../store/model'
import type {HouseItem} from '../store/konoCare'
import {ALL_TREATS,type Treat} from '../store/konoCare'
import {paintPose,type PaintId} from '../store/konoLooks'
import {FURNITURE,ROOM_STYLES,roomSrc,SIZES,clampSpot,furnitureSrc,inStorage,spotFor,type FurnitureUse} from '../store/konoFurniture'

const byId=new Map(FURNITURE.map(f=>[f.id,f]))
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches

/** KONO's house (the island's "KONO's house" tab, KONO's corner, or KONO Town's furniture shop): a room KONO
 * potters about in, furnished with what was bought in the furniture shop. Arrange lets you place pieces
 * from storage, drag them around, make them bigger or smaller, flip them and put them away; each change
 * is saved straight away. Tap KONO for a pat. KONO uses the furniture now and then (naps in the bed, reads at
 * the desk, dances to the music…), and at night it sleeps (in its bed, if there is one).
 * Loaded only when opened. */
export default function KonoHouse({close,visit,room='classic',rooms=[],onRoom,entering=false,homes=[],home=null,onHome,house,owned,paint,outfit,night,onSave,onPet,onShop}:{
 close:()=>void
 /** Visiting someone else's KONO (another plan in the family): their house to look round, nothing to
  * arrange, and a gift to leave: a snack bought with your coins (`price`) and a note, for their KONO's snacks. */
 visit?:{name:string;balance:number;price:(t:Treat)=>number;onGive:(t:Treat,note:string)=>void}
 /** The room's style (its walls and floor), the styles owned, and switching (store/konoFurniture). */
 room?:string;rooms?:string[];onRoom?:(id:string)=>void
 /** Opened by KONO walking in through the door of its house on the island: the room swings into view and
  * KONO walks in from the front. */
 entering?:boolean
 /** The houses on the island, and which one KONO lives in (picked here when there are several). */
 homes?:{id:string;label:string}[];home?:string|null;onHome?:(id:string)=>void
 house:HouseItem[]
 owned:Map<string,number>
 paint:PaintId|null;outfit:string|null
 night:boolean
 onSave:(items:HouseItem[])=>void
 onPet:()=>void
 onShop:()=>void
}){
 const roomRef=useRef<HTMLDivElement>(null)
 const [width,setWidth]=useState(0),[arranging,setArranging]=useState(false),[selected,setSelected]=useState<string|null>(null)
 const [drag,setDrag]=useState<{id:string;x:number;y:number;dx:number;dy:number;moved:boolean}|null>(null)
 const [kono,setKono]=useState(()=>entering?{x:0.5,y:0.99}:{x:0.5,y:0.72}),[happy,setHappy]=useState(false)
 useEffect(()=>{const el=roomRef.current;if(!el)return;const ro=new ResizeObserver(()=>setWidth(el.clientWidth));ro.observe(el);setWidth(el.clientWidth);return ()=>ro.disconnect()},[])
 const bed=house.find(h=>h.item==='bed')
 // Coming in through the door: KONO walks in from the front of the room.
 useEffect(()=>{if(!entering)return;const t=window.setTimeout(()=>setKono({x:0.5,y:0.72}),250);return ()=>window.clearTimeout(t)},[entering])
 // What KONO is doing: walking to a piece of furniture, then using it once it's there (`at`).
 const [doing,setDoing]=useState<{id:string;use:FurnitureUse;settled:boolean}|null>(null)
 const houseRef=useRef(house)
 useEffect(()=>{houseRef.current=house},[house])
 // Now and then KONO goes off to use something in the room, or wanders the floor (not while asleep, while
 // you arrange, or with reduced motion).
 useEffect(()=>{
  if(night||arranging||reducedMotion())return
  let arrive=0
  const t=window.setInterval(()=>{
   window.clearTimeout(arrive)
   const usable=houseRef.current.filter(h=>byId.get(h.item)?.use)
   const pick=usable.length&&Math.random()<0.7?usable[Math.floor(Math.random()*usable.length)]:null
   if(!pick){setDoing(null);setKono({x:0.2+Math.random()*0.6,y:0.55+Math.random()*0.35});return}
   const f=byId.get(pick.item)!
   setKono(spotFor(pick,f));setDoing({id:pick.id,use:f.use!,settled:false})
   arrive=window.setTimeout(()=>setDoing(d=>d&&d.id===pick.id?{...d,settled:true}:d),2500)
  },7000)
  return ()=>{window.clearInterval(t);window.clearTimeout(arrive)}
 },[night,arranging])
 // A piece put away (or moved) while KONO uses it: KONO stops.
 const using=doing&&house.some(h=>h.id===doing.id)?doing:null
 const usingSpot=using?(()=>{const h=house.find(x=>x.id===using.id)!;return spotFor(h,byId.get(h.item)!)})():null
 const spot=night&&bed?{x:bed.x,y:bed.y-0.05}:usingSpot??kono
 const active=using?.settled&&!happy&&!night?using.use:null
 const pose=paintPose('/garden/kono/'+(night?'sleep':happy?'excited':active?active.pose:'idle')+'.webp',paint)
 // On a piece (the bed, a chair), KONO sits in front of it in the picture.
 const onPiece=using?.use.on?house.find(h=>h.id===using.id):undefined
 const konoSize=Math.max(48,Math.round(width*0.15))
 const shown=house.map(h=>drag&&drag.id===h.id?{...h,x:drag.x,y:drag.y}:h)
 const order=[...shown].sort((a,b)=>Number(!!byId.get(b.item)?.rug)-Number(!!byId.get(a.item)?.rug)||a.y-b.y)
 const storage=inStorage(owned,house)
 const point=(e:PointerEvent)=>{const r=roomRef.current!.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}}
 const down=(e:PointerEvent,h:HouseItem)=>{
  if(!arranging)return
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId)
  const p=point(e);setSelected(h.id);setDrag({id:h.id,x:h.x,y:h.y,dx:p.x-h.x,dy:p.y-h.y,moved:false})
 }
 const move=(e:PointerEvent)=>{if(!drag)return;const p=point(e),s=clampSpot(byId.get(house.find(h=>h.id===drag.id)?.item??''),p.x-drag.dx,p.y-drag.dy);setDrag({...drag,...s,moved:true})}
 const up=()=>{if(!drag)return;if(drag.moved)onSave(house.map(h=>h.id===drag.id?{...h,x:drag.x,y:drag.y}:h));setDrag(null)}
 const change=(id:string,f:(h:HouseItem)=>HouseItem|null)=>onSave(house.flatMap(h=>{if(h.id!==id)return [h];const next=f(h);return next?[next]:[]}))
 const place=(item:string)=>{const f=byId.get(item),s=clampSpot(f,0.5,f?.wall?0.24:0.7),id=uid('furn');onSave([...house,{id,item,...s}]);setSelected(id)}
 const pet=()=>{if(night||arranging)return;setHappy(true);window.setTimeout(()=>setHappy(false),1400);onPet()}
 const sel=house.find(h=>h.id===selected)
 const resize=(step:number)=>sel&&change(sel.id,h=>{const i=SIZES.indexOf(h.size??1),next=SIZES[Math.min(SIZES.length-1,Math.max(0,(i<0?2:i)+step))];return {...h,size:next}})
 // Arrow keys move the selected piece a little.
 const key=(e:KeyboardEvent,h:HouseItem)=>{
  if(!arranging)return
  const d=({ArrowLeft:[-0.02,0],ArrowRight:[0.02,0],ArrowUp:[0,-0.02],ArrowDown:[0,0.02]} as Record<string,number[]>)[e.key]
  if(!d)return
  e.preventDefault();const s=clampSpot(byId.get(h.item),h.x+d[0],h.y+d[1]);change(h.id,x=>({...x,...s}))
 }
 const [gift,setGift]=useState(ALL_TREATS[0].id),[giftNote,setGiftNote]=useState(''),[gave,setGave]=useState('')
 const giftTreat=ALL_TREATS.find(t=>t.id===gift)??ALL_TREATS[0]
 return <Modal title={visit?visit.name+'’s KONO':'KONO’s house'} close={close}>
  <div className={'kono-house'+(arranging?' is-arranging':'')+(night?' is-night':'')+(entering?' is-entering':'')}>
   <div ref={roomRef} className="house-room" style={{backgroundImage:`url(${roomSrc(room)})`}} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
    {order.map(h=>{const f=byId.get(h.item);if(!f)return null;// Not <button>s: the app's button styles (background, padding, hover lift) would change how pieces sit.
     return <div role={arranging?'button':'img'} tabIndex={arranging?0:undefined} key={h.id} className={'house-piece'+(f.rug?' is-rug':'')+(h.id===selected&&arranging?' is-selected':'')} aria-label={f.name+(arranging?', drag to move':'')} aria-pressed={arranging?h.id===selected:undefined}
     style={{left:h.x*100+'%',top:h.y*100+'%',width:f.width*(h.size??1)*100+'%',zIndex:f.rug?1:10+Math.round(h.y*1000)}}
     onPointerDown={e=>down(e,h)} onKeyDown={e=>key(e,h)} onFocus={()=>arranging&&setSelected(h.id)}>
     <img src={furnitureSrc(h.item)} alt="" draggable={false} style={h.flip?{transform:'scaleX(-1)'}:undefined}/>
    </div>})}
    {width>0&&<div role="button" tabIndex={arranging||night?-1:0} aria-disabled={arranging||night} className={'house-kono'+(happy?' is-happy':'')} aria-label={night?'KONO is asleep':'Pet KONO'}
     style={{left:spot.x*100+'%',top:spot.y*100+'%',width:konoSize,height:konoSize,zIndex:onPiece?11+Math.round(onPiece.y*1000):12+Math.round(spot.y*1000)}}
     onClick={pet} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pet()}}}>
     <span className="kono-face-box"><KonoFace pose={pose} outfit={night?null:outfit} size={konoSize}/></span>
     {happy&&<span className="house-heart" aria-hidden="true">💗</span>}
     {active?.emoji&&<span key={using!.id} className="house-doing" aria-hidden="true">{active.emoji}</span>}
    </div>}
   </div>
   <p className="house-status" aria-live="polite">{night?'KONO is fast asleep. 🌙':active?active.line:arranging?'Arranging KONO’s house.':visit?visit.name+'’s KONO is so happy you came to visit!':'KONO is pottering about.'}</p>
   {visit&&<section className="house-gift" aria-label="Leave a gift">
    <h3>Leave a gift <small>A snack for {visit.name}’s KONO, from your coins</small></h3>
    {gave?<p role="status">🎁 {gave}</p>:<div className="house-gift-form">
     <label>Snack<select value={gift} onChange={e=>setGift(e.target.value)}>{ALL_TREATS.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.name} · 🪙 {visit.price(t)}</option>)}</select></label>
     <label>Note<input value={giftNote} maxLength={140} placeholder="Hi from me!" onChange={e=>setGiftNote(e.target.value)}/></label>
     <button type="button" className="primary" disabled={visit.price(giftTreat)>visit.balance} onClick={()=>{visit.onGive(giftTreat,giftNote.trim());setGave('Sent! '+visit.name+'’s KONO will find the '+giftTreat.name+' '+giftTreat.emoji+' with its snacks.')}}>Give {giftTreat.emoji}</button>
     {visit.price(giftTreat)>visit.balance&&<small>You need {visit.price(giftTreat)-visit.balance} more coins.</small>}
    </div>}
   </section>}
   {visit?null:<>
   {!house.length&&!arranging&&<p className="house-empty">KONO’s house is empty! {storage.length?'Tap Arrange to put your furniture in.':'Get furniture in KONO Town’s furniture shop (the rug is free).'}</p>}
   {rooms.length>1&&onRoom&&<label className="house-home-pick">Walls & floor<select value={room} onChange={e=>onRoom(e.target.value)}>{ROOM_STYLES.filter(r=>rooms.includes(r.id)).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
   {homes.length>1&&onHome&&<label className="house-home-pick">KONO lives in<select value={home??homes[0].id} onChange={e=>onHome(e.target.value)}>{homes.map(h=><option key={h.id} value={h.id}>{h.label}{homes.filter(x=>x.label===h.label).length>1?' '+(homes.filter(x=>x.label===h.label).indexOf(h)+1):''}</option>)}</select></label>}
   {!homes.length&&<p className="house-hint">Put a house on the island (Decorate › Homes), then tap it: KONO walks over and goes in.</p>}
   <div className="wb-toolbar house-tools">
    <button type="button" className={arranging?'primary':undefined} aria-pressed={arranging} onClick={()=>{setArranging(a=>!a);setSelected(null)}}>{arranging?'Done arranging':'🪑 Arrange'}</button>
    <button type="button" onClick={onShop}>🛋️ Furniture shop</button>
   </div>
   {arranging&&sel&&<div className="house-selected" role="group" aria-label={'Change the '+(byId.get(sel.item)?.name??'piece').toLowerCase()}>
    <strong>{byId.get(sel.item)?.name}</strong>
    <button type="button" onClick={()=>resize(-1)} disabled={(sel.size??1)<=SIZES[0]}>Smaller</button>
    <button type="button" onClick={()=>resize(1)} disabled={(sel.size??1)>=SIZES.at(-1)!}>Bigger</button>
    <button type="button" onClick={()=>change(sel.id,h=>({...h,flip:!h.flip}))}>Flip</button>
    <button type="button" onClick={()=>{change(sel.id,()=>null);setSelected(null)}}>Put away</button>
   </div>}
   {arranging&&<section className="house-storage" aria-label="Storage">
    <h3>Storage <small>{storage.length?'Tap a piece to put it in the room. Drag pieces to move them.':'Everything you have is in the room.'}</small></h3>
    {storage.length>0&&<ul>{storage.map(({furniture:f,count})=><li key={f.id}><button type="button" aria-label={'Place the '+f.name.toLowerCase()} onClick={()=>place(f.id)}><img src={furnitureSrc(f.id)} alt=""/><small>{f.name}{count>1?' ×'+count:''}</small></button></li>)}</ul>}
   </section>}
   </>}
  </div>
 </Modal>
}
