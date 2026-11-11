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
 * balloon drifts down gently and lands softly, ice is slippery, jelly bounces and wobbles. */
export type Special='honey'|'stone'|'balloon'|'ice'|'jelly'
export const SPECIALS:Record<Special,{emoji:string;name:string;color:string}>={
 honey:{emoji:'🍯',name:'Honey block',color:'#ffc24a'},
 stone:{emoji:'🪨',name:'Stone block',color:'#a9a3b6'},
 balloon:{emoji:'🎈',name:'Balloon block',color:'#ff9fb4'},
 ice:{emoji:'🧊',name:'Ice block',color:'#bfe9ff'},
 jelly:{emoji:'🍮',name:'Jelly block',color:'#ff9ecf'},
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
 return Math.abs(rest.x-drop.x)<4.5&&Math.abs(rest.angle-drop.angle)<0.05
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

/** Block skins, bought with coins (a 'buy' entry "skin:<id>" in KONO's care log, owned for good). The chosen
 * one is remembered on this device. Special blocks keep their own look whatever the skin. */
export type SkinId='pastel'|'jelly'|'cookie'|'garden'|'starry'|'rainbow'
export const SKINS:{id:SkinId;emoji:string;name:string;price:number}[]=[
 {id:'pastel',emoji:'🍬',name:'Pastel',price:0},
 {id:'jelly',emoji:'🍮',name:'Jelly',price:60},
 {id:'cookie',emoji:'🍪',name:'Cookie',price:80},
 {id:'garden',emoji:'🌱',name:'Garden',price:80},
 {id:'starry',emoji:'🌌',name:'Starry',price:100},
 {id:'rainbow',emoji:'🌈',name:'Rainbow',price:120},
]
const SKIN_COLORS:Partial<Record<SkinId,Record<ShapeId,string>>>={
 cookie:{I:'#e2b27a',O:'#d79c5e',T:'#e8c193',L:'#c98a52',J:'#ddb07c',S:'#cf9660',Z:'#e6bb86'},
 garden:{I:'#9ad48a',O:'#7cc58a',T:'#b6dd8c',L:'#8fcf9f',J:'#a8d97a',S:'#6fbf7f',Z:'#c2e39a'},
 starry:{I:'#5a6bc4',O:'#6f5bbf',T:'#4f7cc9',L:'#7a62c9',J:'#5868b8',S:'#6a74d0',Z:'#8166c4'},
}
/** A piece's color in a skin (rainbow tiles each get their own color, see skinTile). */
export const skinColor=(skin:SkinId,shape:ShapeId)=>SKIN_COLORS[skin]?.[shape]??COLORS[shape]
export const skinTile=(skin:SkinId,base:string,tile:number,piece:number)=>skin==='rainbow'?['#ff9aa8','#ffc27a','#ffe27a','#8fe0a6','#8fc8f5','#c3a3f0'][(tile+piece)%6]:base
export const skinItem=(id:SkinId)=>{const s=SKINS.find(x=>x.id===id)!;return {key:'skin:'+s.id,kind:'skin' as const,id:s.id,name:s.name+' blocks',price:s.price,emoji:s.emoji}}
export const skinsOwned=(log:{kind:string;item?:string}[]):Set<SkinId>=>new Set<SkinId>(['pastel',...log.filter(e=>e.kind==='buy'&&e.item?.startsWith('skin:')).map(e=>e.item!.slice(5) as SkinId).filter(id=>SKINS.some(s=>s.id===id))])
const SKIN_KEY='kono-teeter-skin'
export const chosenSkin=(owned:Set<SkinId>):SkinId=>{try{const v=localStorage.getItem(SKIN_KEY) as SkinId|null;return v&&owned.has(v)?v:'pastel'}catch{return 'pastel'}}
export const saveSkin=(id:SkinId)=>{try{localStorage.setItem(SKIN_KEY,id)}catch{/* storage unavailable */}}

/** Today's tower, family board: each player's best today is one 'score' entry in their own KONO care log
 * (a fixed ID per day, replaced only by a better height), so everyone in the family plan sees it. */
export const dailyScoreId=(seed:string)=>'teeter-day-'+seed
export const dailyScoreEvent=(seed:string,height:number,now:Date)=>({id:dailyScoreId(seed),kind:'score' as const,at:now.toISOString(),item:'teeter:'+seed,n:Math.max(0,Math.min(999,Math.floor(height)))})
export type BoardRow={name:string;avatar?:string;height:number;me:boolean}
export function familyBoard(profiles:{id:string;name:string;avatar?:string}[],care:Record<string,{log:{id:string;kind:string;n?:number}[]}|undefined>,seed:string,me:string):BoardRow[]{
 return profiles.flatMap(p=>{const e=care[p.id]?.log.find(x=>x.kind==='score'&&x.id===dailyScoreId(seed));return e&&typeof e.n==='number'?[{name:p.name,...(p.avatar?{avatar:p.avatar}:{}),height:e.n,me:p.id===me}]:[]})
  .sort((a,b)=>b.height-a.height||a.name.localeCompare(b.name))
}
/** What the arcade needs from the family plan for Teeter Tower: skins owned, today's board, and a way to post a score. */
export type TeeterHub={skins:Set<SkinId>;board:BoardRow[];onDaily:(seed:string,height:number)=>void}

/** Tower events: now and then the next three blocks change. Big blocks are half as big again, slippery
 * blocks slide, and in a hurry KONO lets go after three seconds instead of eight. */
export type TowerEvent='big'|'slippery'|'hurry'
export const EVENTS:Record<TowerEvent,{emoji:string;name:string;line:string}>={
 big:{emoji:'🔍',name:'Big blocks',line:'The next blocks are big!'},
 slippery:{emoji:'💦',name:'Slippery blocks',line:'The next blocks are slippery!'},
 hurry:{emoji:'⏱️',name:'Hurry',line:'KONO’s in a hurry!'},
}
export const EVENT_BLOCKS=3
/** Whether a tower event starts with this block: not before the sixth block, at least eight blocks after the
 * last one, and then about one block in three. */
export function eventFor(rand:()=>number,blocks:number,lastAt:number):TowerEvent|null{
 if(blocks<6||blocks-lastAt<8||rand()>=0.35)return null
 const all=Object.keys(EVENTS) as TowerEvent[]
 return all[Math.floor(rand()*all.length)]
}
