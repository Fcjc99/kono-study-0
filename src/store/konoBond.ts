import type {CareEvent} from './konoCare'

/** KONO's bond hearts (Decorate › Presents): how close you and KONO are, from 1 to 10 hearts. It only
 * ever grows, because it's counted from things that are kept for good: everything finished (the
 * Sanctuary's credits), days KONO was cared for (a 'bond' entry with the day's first feeding, pat or
 * tuck-in), wishes granted, finds, and friends' visits. From 2 hearts a pat sends up a little heart,
 * and each heart from 3 on brings a friendship gift for the island. Art is drawn by
 * tools/draw_kono_outfits.py into public/garden/gifts. */
export type BondLevel={level:number;title:string;points:number;floor:number;next:number|null}
export type Gift={id:string;name:string;level:number}

const THRESHOLDS=[0,10,30,60,100,150,210,280,360,450]
const TITLES=['New friends','Buddies','Pals','Good friends','Close friends','Best friends','Very best friends','Inseparable','Kindred spirits','Friends forever']
export const MAX_HEARTS=THRESHOLDS.length
export const HEART_PATS_AT=2
export const GIFTS:Gift[]=[
 {id:'cushion',name:'Heart cushion',level:3},
 {id:'lantern',name:'Heart lantern',level:4},
 {id:'plushie',name:'KONO plushie',level:5},
 {id:'bench',name:'Friendship bench',level:6},
 {id:'wishjar',name:'Wish jar',level:7},
 {id:'frame',name:'Photo of you two',level:8},
 {id:'arch',name:'Heart arch',level:9},
 {id:'golden',name:'Golden heart',level:10},
]
export const giftSrc=(id:string)=>'/garden/gifts/'+id+'.webp'
export const giftHow=(g:Gift)=>'A friendship gift at '+g.level+' hearts.'

/** Points: 1 for each thing finished, 3 for each day KONO was cared for, 3 for each wish granted,
 * 2 for each find and 3 for each friend's visit. */
export function bondPoints(credits:number,log:CareEvent[]):number{
 const count=(kind:CareEvent['kind'])=>new Set(log.filter(e=>e.kind===kind).map(e=>e.id)).size
 return Math.max(0,credits)+3*count('bond')+3*count('wish')+2*count('find')+3*count('visit')
}
export function bondLevel(points:number):BondLevel{
 const level=THRESHOLDS.filter(t=>points>=t).length
 return {level,title:TITLES[level-1],points,floor:THRESHOLDS[level-1],next:THRESHOLDS[level]??null}
}
export const giftsAt=(level:number)=>GIFTS.filter(g=>g.level<=level)
/** What KONO says on reaching a new heart. */
export function bondLine(b:BondLevel):string{
 const gift=GIFTS.find(g=>g.level===b.level)
 const head='💗 You and KONO are now '+b.title+'!'
 if(gift)return head+' KONO made you a '+gift.name.toLowerCase().replace('kono','KONO')+'. It’s in Decorate › Presents.'
 if(b.level===HEART_PATS_AT)return head+' Now a pat sends up a little heart.'
 return head
}
export const PAT_HEART_LINES=['💗 KONO snuggles closer.','💗 KONO beams at you.','💗 A happy little heart floats up!']
