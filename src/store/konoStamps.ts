/** KONO's stamp card (Decorate › Presents): a stamp for every day something gets finished, and every
 * 7 stamps KONO opens a present that can go on the island. Missed days never break it: a stamp is
 * just a day with something done, whenever it comes. Stamps come from the Sanctuary's own record of
 * the days work was finished (sanctuaryProgress.completionDates, kept for good), so nothing new is
 * saved. Art is drawn by tools/draw_kono_outfits.py into public/garden/presents. */
export type Present={id:string;name:string}
export const PRESENTS:Present[]=[
 {id:'kite',name:'Kite'},
 {id:'balloons',name:'Balloons'},
 {id:'teddy',name:'Teddy bear'},
 {id:'musicbox',name:'Music box'},
 {id:'snowglobe',name:'Snow globe'},
 {id:'basket',name:'Picnic basket'},
 {id:'sailboat',name:'Toy sailboat'},
 {id:'telescope',name:'Telescope'},
]
export const CARD_SIZE=7
export const presentSrc=(id:string)=>'/garden/presents/'+id+'.webp'

export type StampCard={
 /** Every day with a stamp, oldest first. */
 days:string[]
 /** Stamps on the card being filled (1-7; a full card stays full until the next stamp starts a new one). */
 stamped:string[]
 /** Presents opened so far (in PRESENTS order). */
 presents:Present[]
 /** The present the card being filled leads to (none once every present is opened: cards still fill, for a hug). */
 next:Present|null
 stampedToday:boolean
}
export function stampCard(completionDates:Record<string,number>,today:string):StampCard{
 const days=Object.keys(completionDates).filter(day=>(completionDates[day]??0)>0&&day<=today).sort()
 const full=Math.floor(days.length/CARD_SIZE)
 const onCard=days.length===0?0:days.length-CARD_SIZE*Math.floor((days.length-1)/CARD_SIZE)
 const presents=PRESENTS.slice(0,Math.min(full,PRESENTS.length))
 return {days,stamped:days.slice(days.length-onCard),presents,next:PRESENTS[full]??null,stampedToday:days.at(-1)===today}
}
/** What KONO says when a card fills up. */
export const presentLine=(present:Present|undefined)=>!present?'🐾 Another full stamp card! KONO gives you the biggest hug. ♡':'🎁 Your stamp card is full! KONO wrapped a present for you: '+(present.name==='Balloons'?'balloons':'a '+present.name.toLowerCase())+'. It’s in Decorate › Presents.'
export const presentHow=(present:Present)=>'Opens with stamp card '+(PRESENTS.indexOf(present)+1)+'.'
