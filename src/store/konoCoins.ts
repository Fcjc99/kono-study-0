import {ALL_TREATS,foldable,monthOf,type CareEvent,type Treat} from './konoCare'
import type {OutfitId} from './konoWardrobe'

/** KONO's coins (Sanctuary › KONO Town): earned by finishing work and playing, spent in KONO's shops. Kind
 * like the rest of KONO's care: coins are only ever earned (never bought), nothing costs coins to keep,
 * and nothing is lost for being away.
 *
 * Coins from work are counted from what's kept for good (the island's lifetime count of things finished,
 * wishes granted, finds), so nothing new is saved for them. Coins won (the prize wheel, games, surprises,
 * quests) and things bought are entries in KONO's care log (store/konoCare), each with its own ID; the
 * daily ones have a fixed ID ('spin-<day>', 'game-<day>-<n>', 'event-<day>', 'quest-<day>'), so two
 * devices agree on what was won. */
export const COIN_ICON='🪙',COIN_NAME='coins'
export const coinText=(n:number)=>n.toLocaleString()+' '+(n===1?COIN_NAME.replace(/s$/,''):COIN_NAME)
/** Coins for each thing finished, each wish granted and each find from a focus session. */
export const PER_FINISHED=10,PER_WISH=15,PER_FIND=5

const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

/** Coins to spend: earned from work (finished is the island's lifetime count, which never goes down), plus
 * coins won, minus things bought. A month folded into a bank entry counts only through it. */
export function coinBalance(finished:number,log:CareEvent[]):number{
 const banked=new Set(log.filter(e=>e.kind==='bank').map(e=>e.id.slice(5)))
 const wishes=new Set(log.filter(e=>e.kind==='wish').map(e=>e.id)).size,finds=log.filter(e=>e.kind==='find').length
 let coins=Math.max(0,finished)*PER_FINISHED+wishes*PER_WISH+finds*PER_FIND
 for(const e of log){
  if(e.kind==='bank')coins+=e.n??0
  else if(foldable(e)&&banked.has(monthOf(e.at)))continue
  else if(e.kind==='coin')coins+=e.n??0
  else if(e.kind==='buy')coins-=e.n??0
 }
 return coins
}

/** What the shops sell (store/konoShops has the stock, loaded with KONO Town). */
export type ShopKind='food'|'outfit'|'find'|'paint'|'furniture'|'room'
export type ShopItem={key:string;kind:ShopKind;id:string;name:string;price:number;emoji?:string;img?:string;sale?:boolean}
export const foodPrice=(t:Treat)=>['bento','cake','boba'].includes(t.id)?30:12
/** Outfits bought in the boutique (owned for good, like ones earned). */
export const boughtOutfits=(log:CareEvent[])=>new Set(log.filter(e=>e.kind==='buy'&&e.item?.startsWith('outfit:')).map(e=>e.item!.slice(7) as OutfitId))
export const buyEvent=(id:string,item:ShopItem,now:Date):CareEvent=>({id,kind:'buy',at:now.toISOString(),item:item.key,n:item.price})

/** The prize wheel: one free spin a day, and every spin wins something. */
export const WHEEL=[10,25,15,50,20,100,30,40]
const WHEEL_WEIGHTS=[16,12,16,6,16,2,12,8]
export const spinEventId=(today:string)=>'spin-'+today
export const spunToday=(log:CareEvent[],today:string)=>log.find(e=>e.id===spinEventId(today))
/** Picks a slice of the wheel from a 0–1 number. */
export function wheelSlice(roll:number):number{
 const total=WHEEL_WEIGHTS.reduce((a,b)=>a+b,0)
 let at=roll*total
 for(let i=0;i<WHEEL.length;i++){at-=WHEEL_WEIGHTS[i];if(at<0)return i}
 return 0
}
export const spinEvent=(today:string,slice:number,now:Date):CareEvent=>({id:spinEventId(today),kind:'coin',at:now.toISOString(),item:'spin',n:WHEEL[slice]})

/** The arcade: any game, any time. The first few rounds a day win coins (by score); after that it's just
 * for fun. */
export const COIN_ROUNDS=3
/** The arcade's games, and each land's own game on the world map (components/LandGames). */
export type GameId='catch'|'memory'|'peekaboo'|'bubbles'|'blast'|'meow'|'gems'|'candy'|'chase'|'tumble'|'sled'
const gamePrefix=(today:string)=>'game-'+today+'-'
export const roundsLeft=(log:CareEvent[],today:string)=>Math.max(0,COIN_ROUNDS-log.filter(e=>e.kind==='coin'&&e.id.startsWith(gamePrefix(today))).length)
export function gameCoins(game:GameId,score:number):number{
 const n=game==='memory'?60-score*2:game==='peekaboo'||game==='chase'?score*3:game==='tumble'?score/8:game==='blast'?score/12:game==='meow'?score*5:game==='gems'?score/120:game==='candy'?score/60:score*2
 return Math.max(score>0?5:0,Math.min(50,Math.round(n)))
}
/** The next coin round's entry, or null when today's coin rounds are used up. */
export function gameEvent(log:CareEvent[],today:string,game:GameId,score:number,now:Date):CareEvent|null{
 const used=new Set(log.map(e=>e.id)),n=gameCoins(game,score)
 if(!n)return null
 for(let k=1;k<=COIN_ROUNDS;k++)if(!used.has(gamePrefix(today)+k))return {id:gamePrefix(today)+k,kind:'coin',at:now.toISOString(),item:'game:'+game,n}
 return null
}

/** KONO blast pays as you play: each move that clears lines banks coins straight away (so leaving a game
 * keeps them): lines × lines (1, 4, 9…), times the combo (the clearing moves in a row, up to ×5), up to
 * BLAST_DAILY a day. Each payout is its own entry, 'blast-<day>-<n>'. */
export const BLAST_DAILY=75
export const blastCoins=(lines:number,streak:number)=>lines*lines*(1+Math.min(streak,4))
const blastPrefix=(today:string)=>'blast-'+today+'-'
export const blastToday=(log:CareEvent[],today:string)=>log.filter(e=>e.kind==='coin'&&e.id.startsWith(blastPrefix(today))).reduce((n,e)=>n+(e.n??0),0)
/** The entry for a clear's coins (less if it would pass today's limit), or null once the limit is reached. */
export function blastEvent(log:CareEvent[],today:string,lines:number,streak:number,now:Date):CareEvent|null{
 const n=Math.min(blastCoins(lines,streak),BLAST_DAILY-blastToday(log,today))
 if(n<=0)return null
 const k=log.filter(e=>e.id.startsWith(blastPrefix(today))).length+1
 return {id:blastPrefix(today)+k+'-'+now.getTime().toString(36),kind:'coin',at:now.toISOString(),item:'game:blast',n}
}

/** Something has happened! About every other day a little surprise turns up on the island: a few coins to
 * collect. Which days (and what) is worked out from the plan and the date, so every device agrees. */
export type Surprise={text:string;n:number;emoji:string}
const SURPRISES:Surprise[]=[
 {emoji:'🍃',text:'A gust of wind blew {n} onto the island!',n:25},
 {emoji:'🐦',text:'A friendly bird dropped a little purse with {n} in it!',n:40},
 {emoji:'🧰',text:'KONO dug up a tiny treasure chest: {n}!',n:50},
 {emoji:'🚪',text:'You found {n} under the welcome mat!',n:15},
 {emoji:'🌈',text:'A rainbow appeared and {n} rolled down it!',n:30},
 {emoji:'🧚',text:'The island fairy left {n} in the flower bed!',n:35},
 {emoji:'🐟',text:'KONO went fishing and reeled in a boot full of {n}!',n:20},
 {emoji:'🎈',text:'A balloon floated by with {n} tied to its string!',n:30},
]
export const surpriseEventId=(today:string)=>'event-'+today
export function surpriseToday(profileId:string,today:string):Surprise|null{
 const h=hash(profileId+today+'surprise')
 return h%2===0?SURPRISES[(h>>>1)%SURPRISES.length]:null
}
export const surpriseText=(s:Surprise)=>s.text.replace('{n}',coinText(s.n))
export const surpriseEvent=(today:string,s:Surprise,now:Date):CareEvent=>({id:surpriseEventId(today),kind:'coin',at:now.toISOString(),item:'event',n:s.n})

/** KONO's quest: each day KONO craves one snack. Bring it (earned or bought) that day for a reward. */
export type Quest={treat:Treat;reward:number}
export const questEventId=(today:string)=>'quest-'+today
export function questToday(profileId:string,today:string):Quest{
 const treat=ALL_TREATS[hash(profileId+today+'quest')%ALL_TREATS.length]
 return {treat,reward:foodPrice(treat)*3}
}
export const questEvent=(today:string,q:Quest,now:Date):CareEvent=>({id:questEventId(today),kind:'coin',at:now.toISOString(),item:'quest',n:q.reward})
export const questLine=(q:Quest)=>'🗺️ Quest complete! KONO gobbles up the '+q.treat.name+' '+q.treat.emoji+' and hands you '+coinText(q.reward)+'.'
