/** The match-3 board behind Gem blitz and Candy crush (components/Match3): 8 × 8 pieces of six kinds. Swap
 * two side by side to line up three or more of a kind; they clear, the rest fall and new ones drop in, and
 * any new lines clear too (a cascade, worth more each time).
 *
 * Special pieces: lining up 4 makes a striped one (it clears its whole row when the line was across, its
 * column when it was down), an L or T of five makes a bomb (it clears the 3 × 3 around it), and 5 in a line
 * makes a rainbow orb: swap it with any piece to clear every piece of that kind. A special piece goes off
 * when it's cleared. When no swap would make a line, the board is shuffled. */
export const W=8
export type Special='row'|'col'|'bomb'|'color'
export type Piece={id:number;kind:number;special?:Special}
export type Board=(Piece|null)[]
/** A step of a move, for drawing: the board after it, the squares that cleared (with their kinds) and the
 * points it scored. */
export type Frame={board:Board;cleared:{at:number;kind:number}[];points:number;cascade:number}
export type Maker={kinds:number;roll:()=>number;next:()=>number}

export const maker=(kinds:number,roll:()=>number):Maker=>{let id=0;return {kinds,roll,next:()=>++id}}
const pick=(m:Maker)=>Math.floor(m.roll()*m.kinds)%m.kinds
const adjacent=(a:number,b:number)=>Math.abs(a-b)===W&&a>=0&&b>=0||Math.abs(a-b)===1&&Math.floor(a/W)===Math.floor(b/W)

/** Lines of three or more of a kind, across and down. */
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
/** A fresh board with no lines in it yet, and at least one swap to make. */
export function freshBoard(m:Maker):Board{
 for(;;){
  const b:Board=[]
  for(let i=0;i<W*W;i++){
   let kind=pick(m),guard=0
   while(guard++<20&&((i%W>=2&&b[i-1]!.kind===kind&&b[i-2]!.kind===kind)||(i>=2*W&&b[i-W]!.kind===kind&&b[i-2*W]!.kind===kind)))kind=pick(m)
   b.push({id:m.next(),kind})
  }
  if(!lines(b).length&&hasMove(b))return b
 }
}
const swapped=(b:Board,a:number,c:number)=>{const n=[...b];[n[a],n[c]]=[n[c],n[a]];return n}
/** Whether swapping these two makes a line (or sets off a rainbow orb). */
export function canSwap(b:Board,a:number,c:number):boolean{
 if(!adjacent(a,c)||!b[a]||!b[c])return false
 if(b[a]!.special==='color'||b[c]!.special==='color')return true
 return lines(swapped(b,a,c)).length>0
}
export function hasMove(b:Board):boolean{
 for(let i=0;i<W*W;i++){if(i%W<W-1&&canSwap(b,i,i+1))return true;if(i<W*W-W&&canSwap(b,i,i+W))return true}
 return false
}
/** What a special piece clears when it goes off. */
function blast(b:Board,at:number,kindFor?:number):number[]{
 const p=b[at]!,r=Math.floor(at/W),c=at%W
 if(p.special==='row')return Array.from({length:W},(_,k)=>r*W+k)
 if(p.special==='col')return Array.from({length:W},(_,k)=>k*W+c)
 if(p.special==='bomb'){const out:number[]=[];for(let y=r-1;y<=r+1;y++)for(let x=c-1;x<=c+1;x++)if(y>=0&&x>=0&&y<W&&x<W)out.push(y*W+x);return out}
 if(p.special==='color'){const kind=kindFor??p.kind;return b.flatMap((q,i)=>q&&q.kind===kind?[i]:[])}
 return []
}
/** Clears a set of squares (setting off any special pieces among them, which can set off more). */
function spread(b:Board,start:number[]):Set<number>{
 const gone=new Set<number>(),todo=[...start]
 while(todo.length){const at=todo.pop()!;if(gone.has(at)||!b[at])continue;gone.add(at);if(b[at]!.special)todo.push(...blast(b,at))}
 return gone
}
/** Plays a swap: every step until the board settles (each clear, then the fall), or null if it isn't a move. */
export function play(b0:Board,a:number,c:number,m:Maker):Frame[]|null{
 if(!canSwap(b0,a,c))return null
 let b=swapped(b0,a,c)
 const frames:Frame[]=[]
 // A rainbow orb swapped with a piece clears every piece of that kind (two orbs: the whole board).
 const orb=b[c]!.special==='color'?c:b[a]!.special==='color'?a:-1
 if(orb>=0){
  const other=orb===c?a:c,both=b[other]!.special==='color'
  const gone=spread(b,both?b.flatMap((_,i)=>i):[orb,...blast(b,orb,b[other]!.kind)])
  b=settle(b,gone,new Map(),m,frames,1)
 }
 for(let cascade=orb>=0?2:1;;cascade++){
  const found=lines(b)
  if(!found.length)break
  // New special pieces: where the swap landed if it's in the line, otherwise the line's middle.
  const made=new Map<number,Piece>(),count=new Map<number,number>()
  for(const l of found)for(const at of l.cells)count.set(at,(count.get(at)??0)+1)
  for(const l of found){
   const spot=cascade===1&&l.cells.includes(c)?c:cascade===1&&l.cells.includes(a)?a:l.cells[Math.floor(l.cells.length/2)]
   const cross=l.cells.find(at=>(count.get(at)??0)>1)
   if(l.cells.length>=5)made.set(spot,{id:m.next(),kind:l.kind,special:'color'})
   else if(cross!==undefined&&!made.has(cross))made.set(cross,{id:m.next(),kind:l.kind,special:'bomb'})
   else if(l.cells.length===4&&!made.has(spot))made.set(spot,{id:m.next(),kind:l.kind,special:l.across?'row':'col'})
  }
  const gone=spread(b,found.flatMap(l=>l.cells))
  b=settle(b,gone,made,m,frames,cascade)
 }
 // No moves left: shuffle (keeping the same pieces) until there are.
 for(let guard=0;!hasMove(b)&&guard<50;guard++){
  const pieces=b.filter(Boolean) as Piece[]
  for(let i=pieces.length-1;i>0;i--){const j=Math.floor(m.roll()*(i+1));[pieces[i],pieces[j]]=[pieces[j],pieces[i]]}
  b=pieces
  if(lines(b).length){b=freshBoard(m);break}
 }
 if(!hasMove(b))b=freshBoard(m)
 frames.push({board:b,cleared:[],points:0,cascade:0})
 return frames
}
/** Clears `gone` (leaving the new special pieces in their spots), then drops everything down and fills the top. */
function settle(b:Board,gone:Set<number>,made:Map<number,Piece>,m:Maker,frames:Frame[],cascade:number):Board{
 const cleared=[...gone].filter(at=>!made.has(at)).map(at=>({at,kind:b[at]!.kind}))
 const points=gone.size*10*cascade+[...made.values()].length*30
 const after=b.map((p,i)=>made.get(i)??(gone.has(i)?null:p))
 frames.push({board:after,cleared,points,cascade})
 const fallen:Board=Array(W*W).fill(null)
 for(let x=0;x<W;x++){
  const col=[] as Piece[]
  for(let y=W-1;y>=0;y--){const p=after[y*W+x];if(p)col.push(p)}
  for(let y=W-1,k=0;y>=0;y--,k++)fallen[y*W+x]=col[k]??{id:m.next(),kind:pick(m)}
 }
 frames.push({board:fallen,cleared:[],points:0,cascade})
 return fallen
}

/** Candy crush's levels: a score to reach in a number of moves, a little harder each level. */
export const candyLevel=(level:number)=>({moves:18+(level%3),target:600+level*350})
/** The Candy crush level you're on, kept on this device. */
const CANDY_KEY='kono-candy-level'
export const candyLevelNow=()=>{try{return Math.max(1,Number(localStorage.getItem(CANDY_KEY))||1)}catch{return 1}}
export const saveCandyLevel=(n:number)=>{try{localStorage.setItem(CANDY_KEY,String(n))}catch{/* storage unavailable */}}
