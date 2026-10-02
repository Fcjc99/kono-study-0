import type {CareEvent} from './konoCare'
import {inSeasonWindow,SEASON_WINDOWS,type SeasonId} from './seasonWindows'

/** KONO's finds (Decorate › Finds): while a focus session runs KONO reads beside you, and when the timer
 * runs out KONO shares something it found. Longer sessions find rarer things; each find can then go on
 * the island like a sticker. Saved as a 'find' entry in the care log (kept for good). Art is drawn by
 * tools/draw_kono_outfits.py into public/garden/finds. */
/** Seasonal finds turn up only in their season (store/seasonWindows). */
export type FindTier='common'|'uncommon'|'rare'|'seasonal'
export type Find={id:string;name:string;tier:FindTier;season?:SeasonId}

export const FINDS:Find[]=[
 {id:'pebble',name:'Smooth pebble',tier:'common'},
 {id:'acorn',name:'Acorn',tier:'common'},
 {id:'leaf',name:'Autumn leaf',tier:'common'},
 {id:'feather',name:'Feather',tier:'common'},
 {id:'shell',name:'Seashell',tier:'common'},
 {id:'clover',name:'Four-leaf clover',tier:'uncommon'},
 {id:'pinecone',name:'Pinecone',tier:'uncommon'},
 {id:'seaglass',name:'Sea glass',tier:'uncommon'},
 {id:'mushroom',name:'Spotted mushroom',tier:'uncommon'},
 {id:'crystal',name:'Crystal',tier:'rare'},
 {id:'golden-acorn',name:'Golden acorn',tier:'rare'},
 {id:'star',name:'Fallen star',tier:'rare'},
 {id:'pumpkin',name:'Tiny pumpkin',tier:'seasonal',season:'halloween'},
 {id:'snowflake',name:'Snowflake',tier:'seasonal',season:'winter'},
 {id:'candy-heart',name:'Candy heart',tier:'seasonal',season:'valentine'},
 {id:'blossom',name:'Cherry blossom',tier:'seasonal',season:'spring'},
 {id:'diploma',name:'Tiny diploma',tier:'seasonal',season:'semester'},
]
export const findSrc=(id:string)=>'/garden/finds/'+id+'.webp'
/** Sessions shorter than this don't bring a find (so tapping start and stop doesn't count). */
export const MIN_FIND_MINUTES=10
export const findHow=(f:Find)=>f.tier==='common'?'Found on focus sessions of 10+ minutes.':f.tier==='uncommon'?'Found on focus sessions of 25+ minutes.':f.tier==='rare'?'Found on focus sessions of 45+ minutes.':'Found on focus sessions '+(f.season?SEASON_WINDOWS[f.season].when:'')+'.'

/** How many of each find there are (the same one can turn up again). */
export function foundCounts(log:CareEvent[]):Map<string,number>{
 const counts=new Map<string,number>()
 for(const e of log)if(e.kind==='find'&&e.item)counts.set(e.item,(counts.get(e.item)??0)+1)
 return counts
}
/** Finds shown in Decorate: all of them, except seasonal ones outside their season unless found. */
export const findsOffered=(found:Map<string,number>,today:string)=>FINDS.filter(f=>!f.season||inSeasonWindow(f.season,today)||found.has(f.id))

/** What KONO finds after `minutes` of focus. `roll` (0–1, from the session's end time) decides the
 * tier; within a tier KONO prefers something not found yet. In season a seasonal find not found yet
 * can turn up (a tiny pumpkin in October, a snowflake in winter, a candy heart in Valentine's week, a cherry
 * blossom in spring, a tiny diploma at the end of the semester). */
export function findFor(minutes:number,roll:number,found:Map<string,number>,today:string):Find|null{
 if(minutes<MIN_FIND_MINUTES)return null
 const seasonal=FINDS.filter(f=>f.season&&inSeasonWindow(f.season,today)&&!found.has(f.id))
 if(seasonal.length&&roll<0.25)return seasonal[Math.floor(((roll*997)%1)*seasonal.length)]??seasonal[0]
 const tier:FindTier=minutes>=45&&roll>=0.5?'rare'
  :minutes>=25&&roll>=0.4?'uncommon'
  :'common'
 const options=FINDS.filter(f=>f.tier===tier)
 const fresh=options.filter(f=>!found.has(f.id)),pool=fresh.length?fresh:options
 return pool[Math.floor(((roll*997)%1)*pool.length)]??pool[0]
}
/** A steady 0–1 number from a time, so the same session always finds the same thing. */
export const rollFrom=(ms:number)=>{let h=2166136261;for(const c of String(ms)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967296}
export const foundLine=(f:Find,minutes:number)=>'KONO found '+(/^[aeiou]/i.test(f.name)?'an ':'a ')+f.name.toLowerCase()+' while you focused for '+minutes+' minutes! It’s in Decorate › Finds.'
