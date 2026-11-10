/** KONO Teeter Tower's pieces and how high a tower counts as (the physics lives in the component). */
export type ShapeId='I'|'O'|'T'|'L'|'J'|'S'|'Z'
/** Each piece's blocks, as [column, row]. */
export const SHAPES:Record<ShapeId,[number,number][]>={
 I:[[0,0],[1,0],[2,0],[3,0]],
 O:[[0,0],[1,0],[0,1],[1,1]],
 T:[[0,0],[1,0],[2,0],[1,1]],
 L:[[0,0],[0,1],[0,2],[1,2]],
 J:[[1,0],[1,1],[1,2],[0,2]],
 S:[[1,0],[2,0],[0,1],[1,1]],
 Z:[[0,0],[1,0],[1,1],[2,1]],
}
/** KONO's pastels, one per piece. */
export const COLORS:Record<ShapeId,string>={I:'#7cc3ef',O:'#ffd36b',T:'#b9a0ea',L:'#ffb38a',J:'#8fb6f2',S:'#7fd1ae',Z:'#f59ac4'}
/** How many rows high the tower stands: the top of the highest block that has come to rest (a block still
 * moving doesn't count yet), in whole blocks above the island. */
export function towerHeight(blocks:{top:number;speed:number}[],islandTop:number,block:number):number{
 let top=islandTop
 for(const b of blocks)if(b.speed<0.25&&b.top<top)top=b.top
 return Math.max(0,Math.floor((islandTop-top)/block+0.15))
}

/** Special blocks that sometimes come up: honey sticks to the first thing it touches, stone is heavy, a
 * balloon drifts down gently and lands softly, ice is slippery. */
export type Special='honey'|'stone'|'balloon'|'ice'
export const SPECIALS:Record<Special,{emoji:string;name:string;color:string}>={
 honey:{emoji:'🍯',name:'Honey block',color:'#ffc24a'},
 stone:{emoji:'🪨',name:'Stone block',color:'#a9a3b6'},
 balloon:{emoji:'🎈',name:'Balloon block',color:'#ff9fb4'},
 ice:{emoji:'🧊',name:'Ice block',color:'#bfe9ff'},
}
/** Which block comes next: plain for the first few, then now and then a special one. */
export function specialFor(rand:()=>number,count:number):Special|null{
 if(count<4||rand()>=0.18)return null
 const all=Object.keys(SPECIALS) as Special[]
 return all[Math.floor(rand()*all.length)]
}
/** A repeatable random number source (the same seed gives everyone the same blocks). */
export function seeded(seed:string):()=>number{
 let h=1779033703^seed.length
 for(let i=0;i<seed.length;i++){h=Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19}
 let a=h>>>0
 return ()=>{a=a+0x6d2b79f5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}
}
/** Today's tower: one seed a day, the same for the whole family. */
export function dailySeed(d=new Date()):string{return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
/** A puzzle level: reach the flag at `goal` rows with at most `blocks` blocks. They get taller and tighter. */
export function puzzleLevel(n:number):{goal:number;blocks:number}{
 const level=Math.max(1,Math.floor(n)),goal=Math.min(30,3+Math.ceil(level*1.2))
 return {goal,blocks:Math.max(goal+1,Math.round(goal*2.2)-level)}
}
/** A drop counts as Perfect when the block settles where and how it was let go: it didn't slide or tip. */
export function isPerfect(drop:{x:number;angle:number},rest:{x:number;angle:number}):boolean{
 return Math.abs(rest.x-drop.x)<3&&Math.abs(rest.angle-drop.angle)<0.03
}
/** Every ten rows the lower part turns to stone (it can't topple any more); the top three rows stay loose. */
export const LOCK_EVERY=10,LOOSE_ROWS=3
export function lockLine(height:number,islandTop:number,block:number):number|null{
 if(height<LOCK_EVERY)return null
 return islandTop-(Math.floor(height/LOCK_EVERY)*LOCK_EVERY-LOOSE_ROWS)*block
}
export type TeeterMode={kind:'classic'}|{kind:'daily';seed:string}|{kind:'puzzle';level:number}
const LEVEL_KEY='kono-teeter-level',DAILY_KEY='kono-teeter-daily'
export const teeterLevel=()=>{try{return Math.max(1,Number(localStorage.getItem(LEVEL_KEY))||1)}catch{return 1}}
export const saveTeeterLevel=(n:number)=>{try{if(n>teeterLevel())localStorage.setItem(LEVEL_KEY,String(n))}catch{/* storage unavailable */}}
/** Today's best on this device (yesterday's is forgotten). */
export const dailyBest=(seed=dailySeed()):number|null=>{try{const v=JSON.parse(localStorage.getItem(DAILY_KEY)||'null');return v&&v.seed===seed?Number(v.best):null}catch{return null}}
export const saveDailyBest=(n:number,seed=dailySeed())=>{const was=dailyBest(seed);if(was!==null&&was>=n)return false;try{localStorage.setItem(DAILY_KEY,JSON.stringify({seed,best:n}))}catch{/* storage unavailable */}return true}
