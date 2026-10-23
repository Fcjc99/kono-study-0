import {useState} from 'react'
import Modal from './Modal'
import KonoFace from './KonoFace'
import KonoHouse from './KonoHouse'
import {uid,type AppData} from '../store/model'
import {addCareEvent,type Treat} from '../store/konoCare'
import {foodPrice} from '../store/konoCoins'
import {ownedPaints,paintPose,wornPaint} from '../store/konoLooks'
import {playSfx} from '../konoSounds'

const NO_FURNITURE=new Map<string,number>()

/** Visit family (KONO's corner): the other plans' KONOs. Pick one to look round its house (its KONO in its own
 * color and outfit) and leave a snack bought with your coins, with a note; it waits with their snacks like a
 * parent's gift. Loaded only when opened. */
export default function KonoVisit({data,profileId,coins,sound,save,close,onGave}:{
 data:AppData;profileId:string;coins:number;sound:boolean
 save:(update:(d:AppData)=>AppData)=>unknown
 close:()=>void
 /** After a gift: what KONO says about it in the KONO bar. */
 onGave:(line:string)=>void
}){
 const [visiting,setVisiting]=useState<string|null>(null)
 const me=data.profiles.find(p=>p.id===profileId),others=data.profiles.filter(p=>p.id!==profileId)
 const lookOf=(id:string)=>{const log=data.konoCare?.[id]?.log??[];return {paint:wornPaint(log,ownedPaints(log)),outfit:[...log].filter(e=>e.kind==='wear').sort((a,b)=>a.at.localeCompare(b.at)).at(-1)?.item||null}}
 const give=(id:string,treat:Treat,note:string)=>{
  const price=foodPrice(treat);if(price>coins)return
  const now=new Date(),them=data.profiles.find(p=>p.id===id)
  void save(d=>({...d,konoCare:{...d.konoCare,
   [profileId]:addCareEvent(d.konoCare[profileId],profileId,{id:uid('buy'),kind:'buy',at:now.toISOString(),item:'gift:'+treat.id,n:price},now),
   [id]:addCareEvent(d.konoCare[id],id,{id:uid('gift'),kind:'gift',at:now.toISOString(),item:treat.id,from:(me?.name??'Family').slice(0,60),...(note?{note:note.slice(0,140)}:{})},now)}}))
  playSfx('buy',sound)
  onGave('🎁 You left '+(them?.name??'them')+'’s KONO '+(treat.name==='boba tea'?'':'a ')+treat.name+' '+treat.emoji+'!')
 }
 const plan=visiting?data.profiles.find(p=>p.id===visiting):undefined
 if(plan){const look=lookOf(plan.id);return <KonoHouse close={close} room={data.konoCare?.[plan.id]?.room} visit={{name:plan.name,balance:Math.max(0,coins),price:foodPrice,onGive:(t,n)=>give(plan.id,t,n)}} house={data.konoCare?.[plan.id]?.house??[]} owned={NO_FURNITURE} paint={look.paint} outfit={look.outfit} night={false} onSave={()=>undefined} onPet={()=>undefined} onShop={()=>undefined}/>}
 return <Modal title="Visit family" close={close}><ul className="visit-list">{others.map(p=>{const look=lookOf(p.id);return <li key={p.id}><button type="button" onClick={()=>setVisiting(p.id)}><span className="kono-face-box"><KonoFace pose={paintPose('/garden/kono/happy.webp',look.paint)} outfit={look.outfit} size={48}/></span><strong>{p.name}’s KONO</strong><small>{(data.konoCare?.[p.id]?.house??[]).length?'Come see the house':'Say hi'}</small></button></li>})}</ul></Modal>
}
