import type {CareEvent} from './konoCare'
import {addDays} from './studyScheduler'
import {inSeasonWindow,SEASON_IDS,SEASON_WINDOWS,type SeasonId} from './seasonWindows'

/** KONO's wardrobe (Decorate › Wardrobe) and daily wish. Outfits are earned two ways: finishing
 * assignments (the island's lifetime count, so it never goes down) and granting KONO's daily wishes.
 * KONO wears one outfit at a time, on the island and in the KONO today card; the art and how it sits
 * on every pose come from tools/draw_kono_outfits.py. */
export type OutfitId='beanie'|'bow'|'sunhat'|'chef'|'flowers'|'gradcap'|'wizard'|'crown'|'witch'|'ghost'|'frankenstein'|'earmuffs'|'heartband'
/** How an outfit is earned: assignments finished or wishes granted, ever, or (seasonal outfits: the
 * Halloween costumes, winter earmuffs, the Valentine's heart headband) during that season, any year.
 * Seasonal outfits only show in the wardrobe in their season, or once earned (store/seasonWindows). */
export type Outfit={id:OutfitId;name:string;by:'finished'|'wishes';count:number;season?:SeasonId}
export type WardrobeStats={finished:number;wishes:number;seasonFinished:Record<SeasonId,number>;seasonWishes:Record<SeasonId,number>}

export const OUTFITS:Outfit[]=[
 {id:'beanie',name:'Cozy beanie',by:'wishes',count:1},
 {id:'bow',name:'Pink bow',by:'finished',count:5},
 {id:'sunhat',name:'Sun hat',by:'wishes',count:3},
 {id:'chef',name:'Chef’s hat',by:'finished',count:12},
 {id:'flowers',name:'Flower crown',by:'wishes',count:7},
 {id:'gradcap',name:'Graduation cap',by:'finished',count:25},
 {id:'wizard',name:'Wizard hat',by:'wishes',count:14},
 {id:'crown',name:'Golden crown',by:'finished',count:50},
 {id:'witch',name:'Witch hat',by:'finished',count:2,season:'halloween'},
 {id:'ghost',name:'Ghost costume',by:'finished',count:6,season:'halloween'},
 {id:'frankenstein',name:'Frankenstein',by:'wishes',count:3,season:'halloween'},
 {id:'earmuffs',name:'Fluffy earmuffs',by:'finished',count:3,season:'winter'},
 {id:'heartband',name:'Heart headband',by:'wishes',count:2,season:'valentine'},
]
export const outfitHow=(o:Outfit)=>{
 const when=o.season?' '+SEASON_WINDOWS[o.season].when:''
 return o.by==='finished'?'Finish '+o.count+' assignments'+when+'.':o.count===1?'Grant KONO’s wish once'+when+'.':'Grant '+o.count+' of KONO’s wishes'+when+'.'
}
const progressOf=(o:Outfit,s:WardrobeStats)=>o.season?(o.by==='finished'?s.seasonFinished[o.season]:s.seasonWishes[o.season])??0:(o.by==='finished'?s.finished:s.wishes)
export const outfitProgress=(o:Outfit,s:WardrobeStats)=>Math.min(o.count,progressOf(o,s))
export function unlockedOutfits(s:WardrobeStats):Set<OutfitId>{
 return new Set(OUTFITS.filter(o=>progressOf(o,s)>=o.count).map(o=>o.id))
}
/** What the wardrobe shows: everything, except seasonal outfits outside their season unless earned. */
export const outfitsOffered=(unlocked:Set<OutfitId>,today:string)=>OUTFITS.filter(o=>!o.season||inSeasonWindow(o.season,today)||unlocked.has(o.id))
/** The counts outfits are earned by. `finished` is the island's lifetime count (it never goes down). */
export function wardrobeStats(finished:number,tasks:Item[],log:CareEvent[]):WardrobeStats{
 const wishDays=[...new Set(log.filter(e=>e.kind==='wish').map(e=>e.id.slice(5)))]
 const doneDays=tasks.filter(t=>t.done&&t.completedAt).map(t=>localDay(t.completedAt!))
 const per=(days:string[])=>Object.fromEntries(SEASON_IDS.map(id=>[id,days.filter(d=>inSeasonWindow(id,d)).length])) as Record<SeasonId,number>
 return {finished,wishes:wishDays.length,seasonFinished:per(doneDays),seasonWishes:per(wishDays)}
}
/** The outfit KONO has on: the latest pick ("" means none), if it's still unlocked. */
export function wornOutfit(log:CareEvent[],unlocked:Set<OutfitId>):OutfitId|null{
 const last=[...log].filter(e=>e.kind==='wear').sort((a,b)=>a.at.localeCompare(b.at)).at(-1)
 const id=last?.item as OutfitId|undefined
 return id&&unlocked.has(id)?id:null
}

/** One wish a day, fitting the day: finish today's work (up to three things), get ahead when nothing
 * is due today, or (with nothing to do at all) be tucked in tonight. */
export type Wish={kind:'finish';goal:number}|{kind:'ahead';goal:1}|{kind:'bedtime';goal:1}
type Item={due:string;done:boolean;completedAt?:string}
const localDay=(iso:string)=>{const d=new Date(iso);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

export function todaysWish(tasks:Item[],exams:Item[],today:string):Wish{
 const dueToday=[...tasks,...exams].filter(t=>t.due===today).length
 if(dueToday)return {kind:'finish',goal:Math.min(3,dueToday)}
 if(tasks.some(t=>!t.done&&t.due>today&&t.due<=addDays(today,7)))return {kind:'ahead',goal:1}
 return {kind:'bedtime',goal:1}
}
/** How far along today's wish is (finished today = completed today, whatever it was due). */
export function wishProgress(wish:Wish,tasks:Item[],log:CareEvent[],today:string):number{
 const doneToday=tasks.filter(t=>t.done&&t.completedAt&&localDay(t.completedAt)===today)
 if(wish.kind==='finish')return Math.min(wish.goal,doneToday.length)
 if(wish.kind==='ahead')return doneToday.some(t=>t.due>today)?1:0
 return log.some(e=>e.kind==='sleep'&&localDay(e.at)===today)?1:0
}
export const wishText=(wish:Wish)=>wish.kind==='finish'?(wish.goal===1?'finish one thing today':'finish '+wish.goal+' things today'):wish.kind==='ahead'?'get ahead on something due later this week':'be tucked in tonight'
/** A granted wish is saved once per day with a fixed ID and time, so two devices granting the same
 * day's wish save the very same entry. */
export const wishEvent=(today:string):CareEvent=>({id:'wish-'+today,kind:'wish',at:today+'T12:00:00.000Z'})
export const wishGrantedOn=(log:CareEvent[],today:string)=>log.some(e=>e.kind==='wish'&&e.id==='wish-'+today)
export const wishesGranted=(log:CareEvent[])=>new Set(log.filter(e=>e.kind==='wish').map(e=>e.id)).size
