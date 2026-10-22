import {ALL_TREATS,favoriteSnack} from './konoCare'
import {FINDS,findSrc,type Find} from './konoFinds'
import {OUTFITS,type Outfit,type OutfitId} from './konoWardrobe'
import {inSeasonWindow} from './seasonWindows'
import {FURNITURE,PAINTS,furnitureSrc,paintSrc,type PaintId} from './konoLooks'
import {foodPrice,type ShopItem} from './konoCoins'

const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

/** KONO's shops (KONO Town; store/konoCoins has the coins). Food goes to KONO's snacks (store/konoCare › pantry), outfits to the wardrobe, treasures to
 * Decorate › Finds, colors to KONO and furniture to KONO's house (store/konoLooks), all for good. Stock
 * changes every day and is the same on every device. */
export function foodStock(today:string):ShopItem[]{
 const fav=favoriteSnack(today)
 const picks=[...ALL_TREATS].sort((a,b)=>hash(today+'food'+a.id)-hash(today+'food'+b.id)).filter(t=>t.id!==fav.id).slice(0,4)
 return [fav,...picks].map(t=>({key:'food:'+t.id,kind:'food',id:t.id,name:t.name,price:foodPrice(t),emoji:t.emoji}))
}
export function outfitPrice(o:Outfit):number{
 const raw=o.season?150:o.by==='finished'?60+o.count*12:60+o.count*40
 return Math.round(raw/5)*5
}
/** Outfits not yet owned (seasonal ones in their season), one of them a quarter off today. */
export function outfitStock(owned:Set<OutfitId>,today:string):ShopItem[]{
 const list=OUTFITS.filter(o=>!owned.has(o.id)&&(!o.season||inSeasonWindow(o.season,today)))
 const sale=list.length?list[hash(today+'sale')%list.length].id:null
 return list.map(o=>{const price=outfitPrice(o),off=o.id===sale;return {key:'outfit:'+o.id,kind:'outfit',id:o.id,name:o.name,price:off?Math.round(price*0.75/5)*5:price,...(off?{sale:true}:{})}})
}
export const findPrice=(f:Find)=>f.tier==='common'?40:f.tier==='uncommon'?90:f.tier==='rare'?220:120
/** Three treasures a day that KONO hasn't found yet (seasonal ones in their season). */
export function treasureStock(found:Map<string,number>,today:string):ShopItem[]{
 return FINDS.filter(f=>!found.has(f.id)&&(!f.season||inSeasonWindow(f.season,today))).sort((a,b)=>hash(today+'find'+a.id)-hash(today+'find'+b.id)).slice(0,3)
  .map(f=>({key:'find:'+f.id,kind:'find',id:f.id,name:f.name,price:findPrice(f),img:findSrc(f.id)}))
}
/** Every color, owned or not (owned ones are worn from the shop). */
export const paintStock=():ShopItem[]=>PAINTS.map(p=>({key:'paint:'+p.id,kind:'paint',id:p.id,name:p.name,price:p.price,img:paintSrc(p.id as PaintId)}))
/** Every piece of furniture, always in stock (buying one again gets another). */
export const furnitureStock=():ShopItem[]=>FURNITURE.map(f=>({key:'furn:'+f.id,kind:'furniture',id:f.id,name:f.name,price:f.price,img:furnitureSrc(f.id)}))
export const boughtLine=(item:ShopItem)=>item.kind==='paint'?'🎨 KONO can be '+item.name+' now! It’s wearing it.':item.kind==='furniture'?'🏠 The '+item.name.toLowerCase()+' is in KONO’s house, ready to place.':item.kind==='food'?'Yum! '+(item.emoji??'')+' A '+item.name+' for KONO. It’s with KONO’s snacks.':item.kind==='outfit'?'✨ The '+item.name.toLowerCase()+' is KONO’s now! Try it on in Decorate › Wardrobe.':'💎 The '+item.name.toLowerCase()+' is yours! Put it on the island from Decorate › Finds.'
