/** The match-3 board behind Candy crush and Gem blitz (components/Match3): 8 × 8 pieces. Swap two side by side
 * to line up three or more of a kind; they clear, the rest fall, new ones drop in, and any new lines clear
 * too (a cascade, worth more each time). When no swap would make a line, the board is shuffled.
 *
 * Each game has its own special pieces, as in the games they follow:
 * - Candy crush: 4 in a line makes a striped candy (a line across makes one striped down, which clears its
 *   column; a line down makes one that clears its row); an L or T makes a wrapped candy, which explodes
 *   (3 × 3) and then explodes again once the board has fallen; 5 in a line makes a color bomb.
 * - Gem blitz: 4 in a line makes a flame gem (it explodes, 3 × 3); an L or T makes a star gem (lightning
 *   along its row and column); 5 in a line makes a hypercube; 6 or more make a supernova (lightning three
 *   rows and three columns wide). New gems now and then carry +5 seconds, and a big cascade drops in a
 *   multiplier gem (×2, ×3 … up to ×8).
 * A special piece goes off when it's cleared, and can set off others. Swapping two specials together makes
 * a combination: two lines make a cross, a line and an explosion a three-wide cross, two explosions a 5 × 5
 * blast, a color bomb with a candy clears every one of that color, with a striped or wrapped one turns that
 * whole color into striped or wrapped ones and sets them all off, and two color bombs clear the board. */
export const W=8
export type Mode='candy'|'gems'
export type Special='row'|'col'|'area'|'cross'|'color'|'nova'
export type Piece={id:number;kind:number;special?:Special;bonus?:'time'|'mult';mult?:number}
export type Board=(Piece|null)[]
/** What a special piece did, for drawing: a beam along a row or column, an explosion, lightning from a
 * color bomb to every piece it took. */
export type Effect={type:Special|'board';at:number;cells:number[];kind?:number}
/** A step of a move, for drawing: the board after it, what cleared (with kinds), the points, the specials
 * that went off, the special pieces made, and blitz's +seconds and multiplier gems collected. */
export type Frame={board:Board;cleared:{at:number;kind:number}[];points:number;cascade:number;effects:Effect[];made:{at:number;special:Special}[];time:number;mult:number}
export type Maker={mode:Mode;kinds:number;roll:()=>number;next:()=>number;bonusOdds:number;mult:number}

export const maker=(mode:Mode,roll:()=>number):Maker=>{let id=0;return {mode,kinds:mode==='gems'?7:6,roll,next:()=>++id,bonusOdds:mode==='gems'?0.02:0,mult:1}}
const pick=(m:Maker)=>Math.floor(m.roll()*m.kinds)%m.kinds
const fresh=(m:Maker):Piece=>{const p:Piece={id:m.next(),kind:pick(m)};if(m.bonusOdds&&m.roll()<m.bonusOdds)p.bonus='time';return p}
export const adjacent=(a:number,b:number)=>a>=0&&b>=0&&a<W*W&&b<W*W&&(Math.abs(a-b)===W||(Math.abs(a-b)===1&&Math.floor(a/W)===Math.floor(b/W)))
const rc=(i:number)=>[Math.floor(i/W),i%W] as const
const inBox=(r0:number,c0:number,rad:number)=>{const out:number[]=[];for(let r=r0-rad;r<=r0+rad;r++)for(let c=c0-rad;c<=c0+rad;c++)if(r>=0&&c>=0&&r<W&&c<W)out.push(r*W+c);return out}
const rowOf=(r:number)=>Array.from({length:W},(_,k)=>r*W+k),colOf=(c:number)=>Array.from({length:W},(_,k)=>k*W+c)

/** Lines of three or more of a kind, across and down (color bombs don't line up). */
export function lines(b:Board):{cells:number[];across:boolean;kind:number}[]{
 const out:{cells:number[];across:boolean;kind:number}[]=[]
 for(const across of [true,false])for(let i=0;i<W;i++){
  let run:number[]=[]
  for(let k=0;k<=W;k++){
   const at=k<W?(across?i*W+k:k*W+i):-1,p=at>=0?b[at]:null,prev=run.length?b[run[0]]:null
   if(p&&prev&&p.kind===prev.kind&&p.special!=='color'&&prev.special!=='color')run.push(at)
   else{if(run.length>=3)out.push({cells:run,across,kind:b[run[0]]!.kind});run=p&&p.special!=='color'?[at]:[]}
  }
 }
 return out
}
export function hasMove(b:Board):boolean{return findMove(b)!==null}
/** A swap that works (for the hint), or null. */
export function findMove(b:Board):[number,number]|null{
 for(let i=0;i<W*W;i++){if(i%W<W-1&&canSwap(b,i,i+1))return [i,i+1];if(i<W*W-W&&canSwap(b,i,i+W))return [i,i+W]}
 return null
}
/** A fresh board with no lines in it yet, and at least one swap to make. */
export function freshBoard(m:Maker):Board{
 for(;;){
  const b:Board=[]
  for(let i=0;i<W*W;i++){
   let kind=pick(m),guard=0
   while(guard++<30&&((i%W>=2&&b[i-1]!.kind===kind&&b[i-2]!.kind===kind)||(i>=2*W&&b[i-W]!.kind===kind&&b[i-2*W]!.kind===kind)))kind=pick(m)
   b.push({id:m.next(),kind})
  }
  if(!lines(b).length&&hasMove(b))return b
 }
}
const swapped=(b:Board,a:number,c:number)=>{const n=[...b];[n[a],n[c]]=[n[c],n[a]];return n}
/** Whether swapping these two does anything: makes a line, or sets off a combination or a color bomb. */
export function canSwap(b:Board,a:number,c:number):boolean{
 if(!adjacent(a,c)||!b[a]||!b[c])return false
 if(b[a]!.special==='color'||b[c]!.special==='color')return true
 if(b[a]!.special&&b[c]!.special)return true
 return lines(swapped(b,a,c)).length>0
}

/** What a special piece takes when it goes off (a color bomb takes every piece of `kindFor`). */
function reach(b:Board,at:number,kindFor?:number):Effect{
 const p=b[at]!,[r,c]=rc(at),s=p.special!
 if(s==='row')return {type:s,at,cells:rowOf(r)}
 if(s==='col')return {type:s,at,cells:colOf(c)}
 if(s==='cross')return {type:s,at,cells:[...new Set([...rowOf(r),...colOf(c)])]}
 if(s==='area')return {type:s,at,cells:inBox(r,c,1)}
 if(s==='nova')return {type:s,at,cells:[...new Set([r-1,r,r+1].filter(y=>y>=0&&y<W).flatMap(rowOf).concat([c-1,c,c+1].filter(x=>x>=0&&x<W).flatMap(colOf)))]}
 const kind=kindFor??p.kind
 return {type:'color',at,kind,cells:b.flatMap((q,i)=>q&&q.kind===kind?[i]:[])}
}
/** Clears a set of squares, setting off the special pieces among them (which can set off more). */
function spread(b:Board,start:number[],effects:Effect[],skip=new Set<number>()):Set<number>{
 const gone=new Set<number>(),todo=[...start],fired=new Set<number>(skip)
 while(todo.length){
  const at=todo.pop()!
  if(gone.has(at)||!b[at])continue
  gone.add(at)
  if(b[at]!.special&&!fired.has(at)){fired.add(at);const e=reach(b,at);effects.push(e);todo.push(...e.cells)}
 }
 return gone
}
/** A swap of two specials (or a color bomb with anything): what it takes, as effects. */
function combo(b:Board,a:number,c:number,effects:Effect[]):{gone:Set<number>;after:number[]}{
 const A=b[a]!,C=b[c]!,[r,cc]=rc(c)
 const line=(s?:Special)=>s==='row'||s==='col'||s==='cross',blast=(s?:Special)=>s==='area'||s==='nova'
 if(A.special==='color'&&C.special==='color'){const all=b.flatMap((_,i)=>i);effects.push({type:'board',at:c,cells:all});return {gone:new Set(all),after:[]}}
 if(A.special==='color'||C.special==='color'){
  const bomb=A.special==='color'?a:c,other=bomb===a?c:a,O=b[other]!
  // With a plain piece: every one of its color. With a special: that whole color becomes that special,
  // then they all go off.
  const same=b.flatMap((q,i)=>q&&q.kind===O.kind&&i!==bomb?[i]:[])
  effects.push({type:'color',at:bomb,kind:O.kind,cells:same})
  if(!O.special)return {gone:spread(b,[bomb,...same],effects,new Set([bomb])),after:[]}
  const turned=[...b]
  for(const i of same)turned[i]={...turned[i]!,special:line(O.special)?(i%2?'row':'col'):O.special}
  const gone=spread(turned,same,effects)
  gone.add(bomb)
  return {gone,after:blast(O.special)?same:[]}
 }
 // Two specials together.
 let cells:number[],type:Special='cross'
 if(line(A.special)&&line(C.special))cells=[...new Set([...rowOf(r),...colOf(cc)])]
 else if(blast(A.special)&&blast(C.special)){cells=inBox(r,cc,2);type='area'}
 else{cells=[...new Set([r-1,r,r+1].filter(y=>y>=0&&y<W).flatMap(rowOf).concat([cc-1,cc,cc+1].filter(x=>x>=0&&x<W).flatMap(colOf)))];type='nova'}
 effects.push({type,at:c,cells})
 const gone=spread(b,cells,effects,new Set([a,c]))
 gone.add(a);gone.add(c)
 return {gone,after:type==='area'&&b[a]!.special==='area'&&b[c]!.special==='area'?[c]:[]}
}
/** The special a line (or crossing lines) makes, for this game. */
function made(m:Maker,length:number,across:boolean,crossing:boolean):Special|null{
 if(m.mode==='candy'){if(length>=5)return 'color';if(crossing)return 'area';if(length===4)return across?'col':'row';return null}
 if(length>=6)return 'nova';if(length===5)return 'color';if(crossing)return 'cross';if(length===4)return 'area';return null
}

/** Plays a swap: every step until the board settles (each clear, then the fall), or null if it isn't a move. */
export function play(b0:Board,a:number,c:number,m:Maker):Frame[]|null{
 if(!canSwap(b0,a,c))return null
 let b=swapped(b0,a,c)
 const frames:Frame[]=[]
 let after:number[]=[]
 const A=b[a]!,C=b[c]!
 if(A.special==='color'||C.special==='color'||(A.special&&C.special)){
  const effects:Effect[]=[],res=combo(b,a,c,effects)
  b=settle(b,res.gone,new Map(),m,frames,1,effects);after=res.after
 }
 return [...frames,...cascade(b,m,a,c,frames.length?2:1,after)]
}
/** Lines clearing, specials made and going off, and wrapped candies' second explosions, until nothing moves. */
function cascade(b0:Board,m:Maker,a:number,c:number,first:number,after0:number[]):Frame[]{
 let b=b0,after=after0
 const frames:Frame[]=[]
 // (Capped, so even a run of bad luck can't cascade forever.)
 for(let n=first;n<first+40;n++){
  const found=lines(b),effects:Effect[]=[]
  if(!found.length&&!after.length)break
  const make=new Map<number,Piece>(),count=new Map<number,number>()
  for(const l of found)for(const at of l.cells)count.set(at,(count.get(at)??0)+1)
  for(const l of found){
   const cross=l.cells.find(at=>(count.get(at)??0)>1)
   const spot=n===1&&l.cells.includes(c)?c:n===1&&l.cells.includes(a)?a:cross??l.cells[Math.floor(l.cells.length/2)]
   const sp=made(m,l.cells.length,l.across,cross!==undefined)
   if(sp&&!make.has(spot))make.set(spot,{id:m.next(),kind:l.kind,special:sp})
  }
  // A wrapped candy's second explosion, where it was.
  const start=[...found.flatMap(l=>l.cells),...after.flatMap(at=>{effects.push({type:'area',at,cells:inBox(...rc(at),1)});return inBox(...rc(at),1)})]
  const gone=spread(b,start,effects)
  // In Candy crush a wrapped candy that went off goes off once more after the fall.
  const next=m.mode==='candy'?effects.filter(e=>e.type==='area'&&b[e.at]?.special==='area'&&!after.includes(e.at)).map(e=>e.at):[]
  b=settle(b,gone,make,m,frames,n,effects)
  after=next
  // A big cascade in Gem blitz drops in a multiplier gem.
  if(m.mode==='gems'&&n===4){const spots=b.flatMap((p,i)=>p&&!p.special&&!p.bonus?[i]:[]);const at=spots[Math.floor(m.roll()*spots.length)];if(at!==undefined){m.mult=Math.min(8,m.mult+1);b=[...b];b[at]={...b[at]!,bonus:'mult',mult:m.mult}}}
 }
 // No moves left: shuffle (keeping the pieces) until there are.
 for(let guard=0;!hasMove(b)&&guard<50;guard++){
  const pieces=b.filter(Boolean) as Piece[]
  for(let i=pieces.length-1;i>0;i--){const j=Math.floor(m.roll()*(i+1));[pieces[i],pieces[j]]=[pieces[j],pieces[i]]}
  b=lines(pieces).length?b:pieces
 }
 if(!hasMove(b))b=freshBoard(m)
 frames.push({board:b,cleared:[],points:0,cascade:0,effects:[],made:[],time:0,mult:0})
 return frames
}
/** Clears `gone` (leaving the new special pieces in their spots), then drops everything down and fills the top. */
function settle(b:Board,gone:Set<number>,make:Map<number,Piece>,m:Maker,frames:Frame[],cascade:number,effects:Effect[]):Board{
 const cleared=[...gone].filter(at=>!make.has(at)&&b[at]).map(at=>({at,kind:b[at]!.kind}))
 const time=[...gone].filter(at=>b[at]?.bonus==='time').length*5
 const mult=Math.max(0,...[...gone].map(at=>b[at]?.bonus==='mult'?b[at]!.mult??0:0))
 const points=cleared.length*20*cascade+make.size*60+effects.length*40
 const after=b.map((p,i)=>make.get(i)??(gone.has(i)?null:p))
 frames.push({board:after,cleared,points,cascade,effects,made:[...make].map(([at,p])=>({at,special:p.special!})),time,mult})
 const fallen:Board=Array(W*W).fill(null)
 for(let x=0;x<W;x++){
  const col=[] as Piece[]
  for(let y=W-1;y>=0;y--){const p=after[y*W+x];if(p)col.push(p)}
  for(let y=W-1,k=0;y>=0;y--,k++)fallen[y*W+x]=col[k]??fresh(m)
 }
 frames.push({board:fallen,cleared:[],points:0,cascade,effects:[],made:[],time:0,mult:0})
 return fallen
}
/** The big finish: Candy crush's Sugar crush (each move left turns a candy striped) or Gem blitz's Last
 * hurrah; then every special on the board goes off, and the board settles. */
export function finale(b0:Board,m:Maker,extra:number):Frame[]{
 let b=[...b0]
 const plain=b.flatMap((p,i)=>p&&!p.special?[i]:[])
 for(let k=0;k<extra&&plain.length;k++){const i=plain.splice(Math.floor(m.roll()*plain.length),1)[0];b[i]={...b[i]!,special:m.roll()<0.5?'row':'col'}}
 const frames:Frame[]=[{board:b,cleared:[],points:0,cascade:1,effects:[],made:[],time:0,mult:0}]
 const specials=b.flatMap((p,i)=>p?.special&&p.special!=='color'?[i]:[])
 if(!specials.length)return frames
 const effects:Effect[]=[],gone=spread(b,specials,effects)
 b=settle(b,gone,new Map(),m,frames,2,effects)
 return [...frames,...cascade(b,m,-1,-1,3,[])]
}

/** Candy crush's levels: odd ones are a score to reach, even ones have jelly to clear too; a level is
 * a little harder each time. Stars at the target, half as much again, and twice. */
export const candyLevel=(level:number)=>({moves:20+(level%3)*2,target:1200+level*500,jelly:level%2===0?Math.min(28,8+level*2):0})
export const candyStars=(score:number,target:number)=>score>=target*2?3:score>=target*1.5?2:score>=target?1:0
/** Jelly squares for a level: the middle of the board first, spreading out. */
export function jellyFor(level:number,roll:()=>number):Set<number>{
 const n=candyLevel(level).jelly,order=Array.from({length:W*W},(_,i)=>i).sort((x,y)=>{const d=(i:number)=>Math.abs(Math.floor(i/W)-3.5)+Math.abs(i%W-3.5);return d(x)-d(y)+(roll()-0.5)*2})
 return new Set(order.slice(0,n))
}
/** The Candy crush level you're on, kept on this device. */
const CANDY_KEY='kono-candy-level'
export const candyLevelNow=()=>{try{return Math.max(1,Number(localStorage.getItem(CANDY_KEY))||1)}catch{return 1}}
export const saveCandyLevel=(n:number)=>{try{localStorage.setItem(CANDY_KEY,String(n))}catch{/* storage unavailable */}}
