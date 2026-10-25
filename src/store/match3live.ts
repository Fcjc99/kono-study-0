/** Candy crush and Gem blitz played in real time (components/Match3). The rules are store/match3's; this is
 * the board as it moves, a few milliseconds at a time, the way the originals play:
 * - A swap slides the two pieces past each other (and back, if it makes nothing).
 * - Matched pieces clear: in Gem blitz they shrink away, in Candy crush they burst. When a match makes a
 *   special piece, the others slide into its spot first.
 * - A special goes off where it is: a striped candy's or star gem's beam travels out along the row or
 *   column, taking pieces one after another; an explosion takes its neighbors; a color bomb's or hypercube's
 *   lightning hits its pieces in turn. A wrapped candy explodes, falls with the board, and explodes again.
 * - Pieces fall under gravity (each lands with a little squash) and new ones drop in from above.
 * - New lines clear as soon as the pieces in them come to rest, and each wave of the cascade counts more.
 * Only pieces at rest match or can be swapped, so in Gem blitz you keep playing while the rest of the board
 * explodes and falls (Candy crush waits for the board to settle, as the original does). */
import {W,adjacent,canSwap,findMove,fresh,freshBoard,hasMove,lines,made,reach,type Board,type Effect,type Maker,type Piece,type Special} from './match3'

export const SWAP_MS=170,MERGE_MS=200,SHUFFLE_MS=520
/** A special charging up before it goes off (a color bomb or hypercube winds up longer), and two specials
 * swapped together pulling into each other before their combination. */
export const CHARGE_MS=190,BOMB_CHARGE_MS=300,COMBO_MS=320
export const BEAM_MS={gems:26,candy:34}
const CLEAR_MS={gems:230,candy:170},BOLT_MS=38,BLAST_MS=45,WRAP_WAIT=320
// Gravity and top speed, in squares per millisecond: a piece falls one square in about 0.13 s.
const G=0.00012,VMAX=0.03

/** A piece on the board as it moves. `y` is where it is drawn (rows, and above the board while it drops in);
 * the square it's in is its place in `cells`. `doom`: milliseconds until it starts clearing. `clear`:
 * milliseconds into clearing. `merge`: the square it slides into as it clears. `up`: what it turns into,
 * and when. `wrap`: a wrapped candy that has gone off once and goes off again when it lands. */
export type Bit={p:Piece;y:number;vy:number;level:number;swap?:Slide;doom?:number;clear?:number;charge?:number;pull?:{to:number;t:number};merge?:number;fired?:boolean;up?:{p:Piece;in:number;made:boolean};born?:number;landed?:number;wrap?:'armed'|'go';wait?:number;pts?:number}
type Slide={fx:number;fy:number;tx:number;ty:number;t:number;ms:number;back?:boolean}
/** What happened, for the game to draw and play: a match (its points and how deep in the cascade), a piece
 * starting to clear, a special going off (with when it reaches each square), a special made, the bonuses,
 * a swap that made nothing, and a shuffle when no move is left. */
export type Ev=
 |{t:'match';cells:number[];kind:number;points:number;level:number}
 |{t:'clear';at:number;kind:number;special?:Special;merge?:number;pts:number}
 |{t:'fire';e:Effect;delays:number[];points:number;combo?:boolean}
 |{t:'made';at:number;special:Special}
 |{t:'charge';at:number;special:Special;combo?:boolean}
 |{t:'time';n:number}|{t:'mult';n:number}|{t:'nope'}|{t:'shuffle'}
export type Live={m:Maker;cells:(Bit|null)[];chain:number;spots:number[];ignite:number[];taken:number;multNext:boolean;multGiven:boolean;events:Ev[];pend:{a:number;c:number;t:number}[];combos:{a:number;c:number;t:number}[]}
/** How a piece is drawn this moment: where (in squares), its scale (and squash), turn, opacity, brightness,
 * and how far a special has charged up (0–1, or 0 when it isn't). */
export type Look={id:number;p:Piece;at:number;x:number;y:number;sx:number;sy:number;rot:number;o:number;b:number;z:number;born:boolean;clearing:boolean;charge:number}

const rc=(i:number)=>[Math.floor(i/W),i%W] as const
const base=(m:Maker)=>m.mode==='gems'?250/3:20
const ease=(t:number)=>t<0.5?2*t*t:1-(-2*t+2)**2/2
const inBox=(r0:number,c0:number,rad:number)=>{const out:number[]=[];for(let r=r0-rad;r<=r0+rad;r++)for(let c=c0-rad;c<=c0+rad;c++)if(r>=0&&c>=0&&r<W&&c<W)out.push(r*W+c);return out}
const rowOf=(r:number)=>Array.from({length:W},(_,k)=>r*W+k),colOf=(c:number)=>Array.from({length:W},(_,k)=>k*W+c)
const band=(r:number,c:number)=>[...new Set([r-1,r,r+1].filter(y=>y>=0&&y<W).flatMap(rowOf).concat([c-1,c,c+1].filter(x=>x>=0&&x<W).flatMap(colOf)))]

/** A board to play. With `intro`, every piece starts above the board and rains in, column by column. */
export function live(m:Maker,b:Board,intro=true):Live{
 const cells=b.map((p,i)=>{const [r,c]=rc(i);return p?{p,y:intro?r-W-1-c*0.45:r,vy:0,level:1}:null})
 return {m,cells,chain:0,spots:[],ignite:[],taken:0,multNext:false,multGiven:false,events:[],pend:[],combos:[]}
}
const rests=(x:Bit|null,i:number):x is Bit=>!!x&&!x.swap&&x.doom===undefined&&x.clear===undefined&&x.charge===undefined&&!x.pull&&!x.up&&!x.wrap&&x.vy===0&&x.y===Math.floor(i/W)
const movable=(x:Bit|null)=>!!x&&!x.swap&&x.doom===undefined&&x.clear===undefined&&x.charge===undefined&&!x.pull&&!x.up
export const boardOf=(rt:Live):Board=>rt.cells.map(x=>x?x.p:null)
/** The pieces at rest (the rest left out): what can match and what can be swapped. */
const still=(rt:Live):Board=>rt.cells.map((x,i)=>rests(x,i)?x.p:null)
/** Nothing moving, clearing or waiting: the board has settled. */
export const settled=(rt:Live)=>!rt.pend.length&&!rt.combos.length&&rt.cells.every((x,i)=>rests(x,i))
/** A move to hint at (only once the board has settled). */
export const hintFor=(rt:Live)=>settled(rt)?findMove(boardOf(rt)):null

/** A swap of two side by side, if both are at rest: 'swap' (it does something), 'nope' (they slide over and
 * back), or null (not now). */
export function trySwap(rt:Live,a:number,c:number,force=false):'swap'|'nope'|null{
 const A=rt.cells[a],C=rt.cells[c]
 if(!adjacent(a,c)||!rests(A,a)||!rests(C,c))return null
 const [ar,ac]=rc(a),[cr,cc]=rc(c)
 // Candy crush here: moving a striped or wrapped candy is always a move; it goes off where it lands, even
 // if it lines nothing up.
 const lit=rt.m.mode==='candy'&&!!(A.p.special||C.p.special)
 // (`force`: Candy crush's free-swap booster swaps any two, line or not.)
 if(!force&&!lit&&!canSwap(still(rt),a,c)){
  A.swap={fx:ac,fy:ar,tx:cc,ty:cr,t:0,ms:SWAP_MS*2+60,back:true};C.swap={fx:cc,fy:cr,tx:ac,ty:ar,t:0,ms:SWAP_MS*2+60,back:true}
  rt.events.push({t:'nope'});return 'nope'
 }
 rt.cells[a]=C;rt.cells[c]=A;A.y=cr;C.y=ar
 A.swap={fx:ac,fy:ar,tx:cc,ty:cr,t:0,ms:SWAP_MS};C.swap={fx:cc,fy:cr,tx:ac,ty:ar,t:0,ms:SWAP_MS}
 rt.pend.push({a,c,t:SWAP_MS});rt.taken=0;rt.multGiven=false
 return 'swap'
}

/** Candy crush's lollipop hammer: smashes the candy at rest in a square (a special one goes off). True if it did. */
export function smash(rt:Live,at:number):boolean{
 const x=rt.cells[at]
 if(!rests(x,at))return false
 rt.chain=Math.max(1,rt.chain)
 return mark(rt,at,0,1,Math.round(base(rt.m)))
}

/** Marks a piece to clear in `delay` ms (sooner if it's already marked); true if it wasn't marked yet. */
function mark(rt:Live,i:number,delay:number,level:number,pts=0):boolean{
 const x=rt.cells[i]
 // (A special still forming, or just formed, isn't taken by the clear that made it.)
 if(!x||x.clear!==undefined||x.charge!==undefined||x.pull||x.up?.made||(x.born!==undefined&&x.p.special))return false
 // A wrapped candy waiting to go off again goes off now.
 if(x.wrap==='armed'){x.wrap='go';x.fired=false}
 const fresh=x.doom===undefined
 x.doom=fresh?delay:Math.min(x.doom!,delay);x.level=Math.max(x.level,level);if(fresh)x.pts=pts
 return fresh
}
/** When a special's reach gets to each square: a beam travels out along its line, an explosion spreads from
 * the middle, lightning hits one piece after another (nearest first). */
function delaysFor(e:Effect,mode:'gems'|'candy'):number[]{
 const [r,c]=rc(e.at),beam=BEAM_MS[mode]
 if(e.type==='color'){const order=[...e.cells].sort((x,y)=>dist(x,e.at)-dist(y,e.at));return e.cells.map(i=>order.indexOf(i)*BOLT_MS+60)}
 return e.cells.map(i=>{
  const [y,x]=rc(i),dr=Math.abs(y-r),dc=Math.abs(x-c),wide=e.type==='nova'?1:0
  if(e.type==='area'||e.type==='board')return Math.max(dr,dc)*BLAST_MS+20
  if(e.type==='row')return dc*beam
  if(e.type==='col')return dr*beam
  return Math.min(dr<=wide?dc*beam:1e9,dc<=wide?dr*beam:1e9)
 })
}
const dist=(a:number,b:number)=>{const [r,c]=rc(a),[y,x]=rc(b);return Math.hypot(r-y,c-x)}
/** A special effect taking its squares, with its points. */
function hit(rt:Live,e:Effect,level:number,skip:Set<number>,combo=false){
 const delays=delaysFor(e,rt.m.mode),b=base(rt.m)
 let n=0
 e.cells.forEach((i,k)=>{if(!skip.has(i)&&mark(rt,i,delays[k],level,Math.round(b*level)))n++})
 const points=Math.round(n*b*level)+(rt.m.mode==='gems'?250:40)
 rt.events.push({t:'fire',e,delays,points,combo})
}
/** A special piece going off as it clears. */
function fire(rt:Live,i:number){
 const x=rt.cells[i]!
 x.fired=true
 const e=reach(boardOf(rt),i)
 // A wrapped candy's first explosion: it stays, falls with the board and goes off again once it lands.
 if(rt.m.mode==='candy'&&x.p.special==='area'&&x.wrap!=='go'){x.clear=undefined;x.wrap='armed';x.wait=0}
 else x.wrap=undefined
 hit(rt,e,x.level,new Set([i]))
}
/** Two specials swapped together (or a color bomb with anything), as in store/match3's combinations. */
function combo(rt:Live,a:number,c:number){
 const A=rt.cells[a]!.p,C=rt.cells[c]!.p,[r,cc]=rc(c),level=Math.max(1,rt.chain)
 const line=(s?:Special)=>s==='row'||s==='col'||s==='cross',blast=(s?:Special)=>s==='area'||s==='nova'
 const spend=(i:number)=>{const x=rt.cells[i]!;x.fired=true;x.doom=0;x.wrap=undefined}
 if(A.special==='color'&&C.special==='color'){spend(a);spend(c);hit(rt,{type:'board',at:c,cells:rt.cells.map((_,i)=>i)},level,new Set([a,c]),true);return}
 if(A.special==='color'||C.special==='color'){
  const bomb=A.special==='color'?a:c,other=bomb===a?c:a,O=rt.cells[other]!.p
  const same=rt.cells.flatMap((x,i)=>x&&x.p.kind===O.kind&&i!==bomb&&x.clear===undefined?[i]:[])
  spend(bomb)
  const e:Effect={type:'color',at:bomb,kind:O.kind,cells:same},delays=delaysFor(e,rt.m.mode)
  if(!O.special){hit(rt,e,level,new Set([bomb]),true);return}
  // With a special: the lightning turns that whole color into that special, then they all go off.
  rt.events.push({t:'fire',e,delays,points:rt.m.mode==='gems'?500:120,combo:true})
  const last=Math.max(0,...delays)
  same.forEach((i,k)=>{
   const x=rt.cells[i]!
   if(i!==other)x.up={p:{...x.p,special:line(O.special)?(i%2?'row':'col'):O.special},in:delays[k]+40,made:false}
   x.doom=last+260+k*70;x.fired=false;x.level=level+1
  })
  return
 }
 let cells:number[],type:Special='cross'
 if(line(A.special)&&line(C.special))cells=[...new Set([...rowOf(r),...colOf(cc)])]
 else if(blast(A.special)&&blast(C.special)){cells=inBox(r,cc,2);type='area'}
 else{cells=band(r,cc);type='nova'}
 spend(a);spend(c)
 hit(rt,{type,at:c,cells},level+1,new Set([a,c]),true)
}
/** A piece starting to clear: its bonus, and its special going off. */
function startClear(rt:Live,i:number){
 const x=rt.cells[i]!
 x.clear=0;x.doom=undefined
 if(x.p.bonus==='time')rt.events.push({t:'time',n:5})
 if(x.p.bonus==='mult')rt.events.push({t:'mult',n:x.p.mult??2})
 rt.taken++
 // Gem blitz, as in Bejeweled Blitz: a move that takes 12 gems or more drops in a multiplier gem (×2), and
 // after that each move of 16 or more drops in the next one (up to ×8).
 if(rt.m.mode==='gems'&&!rt.multGiven&&rt.m.mult<8&&rt.taken>=(rt.m.mult===1?12:16)){rt.multNext=true;rt.multGiven=true}
 // A special charges up first (it swells and glows), then goes off.
 if(x.p.special&&!x.fired){x.clear=undefined;x.charge=0;rt.events.push({t:'charge',at:i,special:x.p.special});return}
 rt.events.push({t:'clear',at:i,kind:x.p.kind,special:x.p.special,merge:x.merge,pts:x.pts??0})
}
/** Lines among the pieces at rest: they clear (sliding into the special they make, if they make one). */
function matches(rt:Live){
 const found=lines(still(rt))
 if(!found.length)return
 const fromSwap=found.some(l=>l.cells.some(at=>rt.spots.includes(at)))
 const level=fromSwap&&rt.chain===0?1:rt.chain+1
 rt.chain=level
 const count=new Map<number,number>(),make=new Map<number,Piece>(),b=base(rt.m)
 for(const l of found)for(const at of l.cells)count.set(at,(count.get(at)??0)+1)
 for(const l of found){
  const cross=l.cells.find(at=>(count.get(at)??0)>1)
  const sp=made(rt.m,l.cells.length,l.across,cross!==undefined)
  let spot=l.cells.find(at=>rt.spots.includes(at))??cross??l.cells[Math.floor(l.cells.length/2)]
  // A special in the line goes off rather than becoming the new one.
  if(rt.cells[spot]!.p.special)spot=l.cells.find(at=>!rt.cells[at]!.p.special)??-1
  if(sp&&spot>=0&&!make.has(spot))make.set(spot,{id:rt.m.next(),kind:l.kind,special:sp})
  const to=sp&&spot>=0?spot:undefined
  for(const at of l.cells){
   const x=rt.cells[at]!
   if(make.has(at))continue
   if(mark(rt,at,0,level)&&to!==undefined&&l.cells.includes(to))x.merge=to
   x.pts=Math.round(b*level)
  }
  rt.events.push({t:'match',cells:l.cells,kind:l.kind,level,points:Math.round(l.cells.length*b*level)+(sp?rt.m.mode==='gems'?500:60:0)})
 }
 for(const [at,p] of make){const x=rt.cells[at]!;x.up={p,in:MERGE_MS-30,made:true};x.level=level}
 // Blazing speed: each match bursts like a flame gem, around its middle.
 if(rt.m.blazing)for(const l of found){const mid=l.cells[Math.floor(l.cells.length/2)];hit(rt,{type:'area',at:mid,cells:inBox(...rc(mid),1)},level,new Set([...make.keys(),...l.cells]))}
}
/** Everything above a gap moves down into it (a piece clearing or turning special holds its square, and
 * holds up what's above it); gaps left at the top fill with new pieces from above the board. */
function gravity(rt:Live){
 for(let c=0;c<W;c++){
  for(let r=W-1;r>=0;r--){
   if(rt.cells[r*W+c])continue
   let k=r-1
   while(k>=0&&!rt.cells[k*W+c])k--
   if(k>=0){const x=rt.cells[k*W+c];if(movable(x)){rt.cells[r*W+c]=x;rt.cells[k*W+c]=null}else r=k;continue}
   // Nothing above: new pieces, stacked above the board (and above any still dropping in).
   let top=W
   for(let y=r+1;y<W;y++){const x=rt.cells[y*W+c];if(x){top=x.y;break}}
   const start=Math.min(-1,top-1)
   for(let y=r,n=0;y>=0;y--,n++){
    const p=fresh(rt.m)
    if(rt.multNext&&!p.bonus){rt.m.mult++;p.bonus='mult';p.mult=rt.m.mult;rt.multNext=false}
    rt.cells[y*W+c]={p,y:start-n,vy:0,level:1}
   }
   break
  }
 }
}
/** Pieces dropping, bottom up in each column: they speed up as they fall, never pass the one below, and land
 * with a squash. */
function fall(rt:Live,dt:number):boolean{
 let moving=false
 for(let c=0;c<W;c++){
  let below:Bit|null=null
  for(let r=W-1;r>=0;r--){
   const x=rt.cells[r*W+c]
   if(!x){below=null;continue}
   if(x.y<r){
    moving=true
    x.vy=Math.min(VMAX,x.vy+G*dt);x.y+=x.vy*dt
    const lim=below&&below.y<r+1?below.y-1:r
    if(x.y>=lim){
     if(lim>=r){x.y=r;x.vy=0;x.landed=0}
     else{x.y=lim;x.vy=Math.min(x.vy,below!.vy)}
    }
   }
   below=x
  }
 }
 return moving
}
/** No move left: the pieces shuffle (sliding to their new squares) until there is one. */
function shuffle(rt:Live){
 const bits=rt.cells.filter(Boolean) as Bit[],from=new Map(rt.cells.map((x,i)=>[x,i] as const))
 let order=bits
 for(let guard=0;guard<50;guard++){
  order=[...bits]
  for(let i=order.length-1;i>0;i--){const j=Math.floor(rt.m.roll()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
  const b=order.map(x=>x.p)
  if(!lines(b).length&&hasMove(b))break
 }
 if(!hasMove(order.map(x=>x.p))){const nb=freshBoard(rt.m);rt.cells=nb.map((p,i)=>({p:p!,y:Math.floor(i/W)-W-1,vy:0,level:1}));rt.events.push({t:'shuffle'});return}
 rt.cells=order.map((x,i)=>{const [r,c]=rc(i),[fr,fc]=rc(from.get(x)!);x.y=r;x.swap={fx:fc,fy:fr,tx:c,ty:r,t:0,ms:SHUFFLE_MS};return x})
 rt.events.push({t:'shuffle'})
}

/** Moves the board on by `dt` milliseconds. True while anything is moving (so there's something to draw). */
export function step(rt:Live,dt:number):boolean{
 let moving=false
 for(const x of rt.cells)if(x?.swap){moving=true;x.swap.t+=dt;if(x.swap.t>=x.swap.ms)x.swap=undefined}
 for(const s of [...rt.pend]){
  s.t-=dt
  if(s.t>0)continue
  rt.pend.splice(rt.pend.indexOf(s),1)
  const A=rt.cells[s.a],C=rt.cells[s.c]
  if(!A||!C)continue
  rt.spots=[s.a,s.c]
  if(rt.m.mode==='candy')rt.ignite=[s.a,s.c].filter(at=>rt.cells[at]?.p.special)
  // Two specials (or a color bomb and anything): they pull into each other, then the combination goes off.
  if(A.clear===undefined&&C.clear===undefined&&A.doom===undefined&&C.doom===undefined&&A.charge===undefined&&C.charge===undefined&&(A.p.special==='color'||C.p.special==='color'||(A.p.special&&C.p.special))){
   A.pull={to:s.c,t:0};C.pull={to:s.a,t:0};rt.combos.push({a:s.a,c:s.c,t:COMBO_MS});rt.events.push({t:'charge',at:s.c,special:C.p.special??A.p.special!,combo:true})
  }
 }
 for(const k of [...rt.combos]){
  k.t-=dt;moving=true
  for(const at of [k.a,k.c]){const x=rt.cells[at];if(x?.pull)x.pull.t+=dt}
  if(k.t>0)continue
  rt.combos.splice(rt.combos.indexOf(k),1)
  const A=rt.cells[k.a],C=rt.cells[k.c]
  if(A)A.pull=undefined
  if(C)C.pull=undefined
  if(A&&C)combo(rt,k.a,k.c)
 }
 rt.cells.forEach((x,i)=>{
  if(!x)return
  if(x.up){moving=true;x.up.in-=dt;if(x.up.in<=0){if(x.up.made)rt.events.push({t:'made',at:i,special:x.up.p.special!});x.p=x.up.p;x.up=undefined;x.born=0}}
  if(x.doom!==undefined){moving=true;x.doom-=dt;if(x.doom<=0&&!x.up)startClear(rt,i)}
 })
 rt.cells.forEach((x,i)=>{
  if(!x)return
  if(x.charge!==undefined){
   moving=true;x.charge+=dt
   if(x.charge>=(x.p.special==='color'?BOMB_CHARGE_MS:CHARGE_MS)){
    x.charge=undefined;x.clear=0;fire(rt,i)
    if(x.clear!==undefined)rt.events.push({t:'clear',at:i,kind:x.p.kind,special:x.p.special,merge:x.merge,pts:x.pts??0})
    return
   }
  }
  if(x.clear!==undefined){moving=true;x.clear+=dt;if(x.clear>=(x.merge!==undefined?MERGE_MS:CLEAR_MS[rt.m.mode]))rt.cells[i]=null}
  if(x.born!==undefined){moving=true;x.born+=dt;if(x.born>400)x.born=undefined}
  if(x.landed!==undefined){moving=true;x.landed+=dt;if(x.landed>240)x.landed=undefined}
  if(x.wrap==='armed'){moving=true;if(!x.swap&&x.vy===0&&x.y===Math.floor(i/W)){x.wait=(x.wait??0)+dt;if(x.wait>=WRAP_WAIT){x.wrap='go';x.fired=false;x.doom=0}}else x.wait=0}
 })
 gravity(rt)
 if(fall(rt,dt))moving=true
 matches(rt)
 // A moved special that lined nothing up (and isn't part of a combination) goes off now.
 for(const at of rt.ignite){const x=rt.cells[at];if(rests(x,at))mark(rt,at,0,Math.max(1,rt.chain))}
 rt.ignite=[]
 rt.spots=[]
 if(settled(rt)){
  rt.chain=0
  if(!hasMove(boardOf(rt))){shuffle(rt);moving=true}
 }
 return moving||rt.events.length>0
}

/** The finale (Sugar crush, Last hurrah): `extra` plain pieces turn striped one after another, then every
 * special on the board goes off in turn. The number of specials set off. */
export function blowAll(rt:Live,extra:number):number{
 const plain=rt.cells.flatMap((x,i)=>rests(x,i)&&!x.p.special?[i]:[])
 let k=0
 for(;k<extra&&plain.length;k++){
  const i=plain.splice(Math.floor(rt.m.roll()*plain.length),1)[0],x=rt.cells[i]!
  x.up={p:{...x.p,special:rt.m.roll()<0.5?'row':'col'},in:k*110,made:false}
 }
 const t0=k*110+350
 const all=rt.cells.flatMap((x,i)=>x&&x.clear===undefined&&x.doom===undefined&&(x.p.special||x.up?.p.special)?[i]:[])
 all.forEach((i,k)=>{const x=rt.cells[i]!;x.doom=t0+k*150;x.fired=false;x.level=2})
 return all.length
}
/** Whether any special that the finale sets off is still on the board. */
export const specialsLeft=(rt:Live)=>rt.cells.some(x=>x?.p.special)

/** How every piece is drawn right now. */
export function view(rt:Live):Look[]{
 const out:Look[]=[]
 rt.cells.forEach((x,i)=>{
  if(!x)return
  const [r,c]=rc(i)
  let px=c,py=x.y,sx=1,sy=1,o=1,b=1,z=1,rot=0,charge=0
  if(x.swap){
   const s=x.swap,k=Math.min(1,s.t/s.ms),e=s.back?ease(k<0.5?k*2:(1-k)*2):ease(k)
   // From the old square to the new one (a swap that makes nothing goes there and comes back).
   px=s.fx+(s.tx-s.fx)*e;py=s.fy+(s.ty-s.fy)*e
   // Stretching along the way it slides, then settling back.
   const st=Math.sin(Math.PI*(s.back?(k<0.5?k*2:(1-k)*2):k))*0.14
   if(s.fy===s.ty){sx=1+st;sy=1-st*0.7}else{sy=1+st;sx=1-st*0.7}
   z=3
  }
  if(x.clear!==undefined){
   z=2
   if(x.merge!==undefined){
    // Sliding into the special being made, shrinking a little on the way.
    const k=Math.min(1,x.clear/MERGE_MS),e=ease(k),[mr,mc]=rc(x.merge)
    px=c+(mc-c)*e;py=r+(mr-r)*e;sx=sy=1-0.35*e;b=1+0.5*k;o=k>0.85?(1-k)/0.15:1
   }else if(rt.m.mode==='gems'){
    // Bejeweled: the gem shrinks evenly to a point, brightening.
    const k=Math.min(1,x.clear/CLEAR_MS.gems);sx=sy=Math.max(0.02,1-k*k*(3-2*k)*0.98);b=1+0.6*k
   }else{
    // Candy crush: the candy swells and lights up, then bursts (into the pieces the game throws out).
    const k=Math.min(1,x.clear/CLEAR_MS.candy);sx=sy=1+0.18*Math.min(1,k/0.45);b=1+1.2*Math.min(1,k/0.45);o=k<0.45?1:0
   }
  }
  if(x.charge!==undefined){
   // Charging up: it swells, brightens and trembles (a color bomb or hypercube spins up); a wrapped candy
   // about to go off a second time does the same.
   const k=Math.min(1,x.charge/(x.p.special==='color'?BOMB_CHARGE_MS:CHARGE_MS)),q=ease(k)
   charge=Math.max(0.01,k);z=4;sx=sy=1+0.32*q;b=1+1.1*q
   if(x.p.special==='color')rot=q*q*540
   else{const t=Math.sin(x.charge*0.09)*3*q;px+=t*0.012;rot=t}
  }
  if(x.pull){
   // Two specials swapped together pull into each other, glowing.
   const k=Math.min(1,x.pull.t/COMBO_MS),q=ease(k),[tr,tc]=rc(x.pull.to)
   px=c+(tc-c)*0.5*q;py=r+(tr-r)*0.5*q;sx=sy=1+0.25*q;b=1+q;z=4;charge=Math.max(0.01,k);rot=x.p.special==='color'?q*q*720:Math.sin(x.pull.t*0.08)*6*q
  }
  if(x.landed!==undefined){const k=x.landed/240,q=Math.sin(Math.PI*Math.min(1,k*1.5))*(1-k)*0.2;sx*=1+q;sy*=1-q}
  out.push({id:x.p.id,p:x.p,at:i,x:px,y:py,sx,sy,rot,o,b,z,born:x.born!==undefined,clearing:x.clear!==undefined,charge})
 })
 return out.sort((a,b)=>a.id-b.id)
}
