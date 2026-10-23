import {ALL_TREATS} from './konoCare'
import {FINDS,findHow,findSrc} from './konoFinds'
import {FRIENDS,friendHow,friendSrc} from './konoFriends'
import {GIFTS,giftHow,giftSrc} from './konoBond'
import {PRESENTS,presentHow,presentSrc} from './konoStamps'
import {STICKERS,stickerOffered} from './stickers'
import {OUTFITS,outfitHow,type OutfitId} from './konoWardrobe'
import {inSeasonWindow} from './seasonWindows'
import {PAINTS,paintSrc,type PaintId} from './konoLooks'
import {FURNITURE,furnitureSrc} from './konoFurniture'

/** KONO's album (KONO Town › Album): everything there is to collect, in one book. What's owned shows its
 * picture; what isn't shows as a shadow with how to get it. Seasonal things only show in their season,
 * or once owned. Nothing is saved for it: it's read from what each collection already keeps. */
export type AlbumItem={id:string;name:string;owned:boolean;how:string;emoji?:string;img?:string;outfit?:string}
export type AlbumSection={id:string;title:string;items:AlbumItem[]}
export type AlbumInput={paints:Set<PaintId>;furniture:Map<string,number>;today:string;outfits:Set<OutfitId>;found:Map<string,number>;met:Map<string,number>;tried:Set<string>;stickers:Set<string>;presents:Set<string>;gifts:Set<string>}

export function albumSections(a:AlbumInput):AlbumSection[]{
 return [
  {id:'outfits',title:'Outfits',items:OUTFITS.filter(o=>!o.season||a.outfits.has(o.id)||inSeasonWindow(o.season,a.today)).map(o=>({id:o.id,name:o.name,owned:a.outfits.has(o.id),how:outfitHow(o)+' Or buy it in the boutique.',outfit:o.id}))},
  {id:'finds',title:'Treasures',items:FINDS.filter(f=>!f.season||a.found.has(f.id)||inSeasonWindow(f.season,a.today)).map(f=>({id:f.id,name:f.name,owned:a.found.has(f.id),how:findHow(f)+' Or look for it in the treasure shop.',img:findSrc(f.id)}))},
  {id:'friends',title:'Friends',items:FRIENDS.map(f=>({id:f.id,name:f.name,owned:a.met.has(f.id),how:friendHow(f),img:friendSrc(f.id)}))},
  {id:'snacks',title:'Snacks',items:ALL_TREATS.map(t=>({id:t.id,name:t.name[0].toUpperCase()+t.name.slice(1),owned:a.tried.has(t.id),how:'Feed it to KONO once.',emoji:t.emoji}))},
  {id:'stickers',title:'Stickers',items:STICKERS.filter(t=>stickerOffered(t.id,a.stickers,a.today)).map(t=>({id:t.id,name:t.label,owned:a.stickers.has(t.id),how:t.how,emoji:t.emoji}))},
  {id:'colors',title:'Colors',items:PAINTS.map(p=>({id:p.id,name:p.name,owned:a.paints.has(p.id),how:'From the paint shop in KONO Town.',img:paintSrc(p.id)}))},
  {id:'furniture',title:'Furniture',items:FURNITURE.map(f=>({id:f.id,name:f.name,owned:a.furniture.has(f.id),how:f.land?'From the '+({beach:'beach',forest:'forest',snow:'snowy village'})[f.land]+' market on the world map.':'From the furniture shop in KONO Town.',img:furnitureSrc(f.id)}))},
  {id:'presents',title:'Presents',items:[...PRESENTS.map(p=>({id:p.id,name:p.name,owned:a.presents.has(p.id),how:presentHow(p),img:presentSrc(p.id)})),...GIFTS.map(g=>({id:g.id,name:g.name,owned:a.gifts.has(g.id),how:giftHow(g),img:giftSrc(g.id)}))]},
 ]
}
export const albumCount=(sections:AlbumSection[])=>({owned:sections.reduce((n,s)=>n+s.items.filter(i=>i.owned).length,0),total:sections.reduce((n,s)=>n+s.items.length,0)})
