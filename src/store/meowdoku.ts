/** Meowdoku (the arcade's cat puzzle, components/Meowdoku): an n × n board split into n colored patches. Put
 * one cat in every row, every column and every patch, and no two cats may touch, not even corner to corner.
 * Every puzzle has exactly one answer: a hidden answer is laid out first, each patch grows from one of its
 * cats, and the board is kept only if a solver finds that answer and no other.
 *
 * Levels make the board bigger: 5 × 5 for the first three, then 6 × 6, and from level 7 on 7 × 7 (bigger
 * boards rarely grow a one-answer layout quickly enough to make on a phone). */
export type Puzzle={n:number;regions:number[]}
export const sizeFor=(level:number)=>level<=3?5:level<=6?6:7

/** A small seeded random number generator (0–1), so tests can make the same puzzle every time. */
export function seeded(seed:number){let a=seed>>>0;return ()=>{a=a+0x6d2b79f5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}

/** One cat a row, each in its own column, none touching the one in the row above. */
function layCats(n:number,roll:()=>number):number[]|null{
 const cols:number[]=[]
 const place=(r:number):boolean=>{
  if(r===n)return true
  const order=[...Array(n).keys()].sort(()=>roll()-0.5)
  for(const c of order){if(cols.includes(c)||(r>0&&Math.abs(cols[r-1]-c)<=1))continue;cols.push(c);if(place(r+1))return true;cols.pop()}
  return false
 }
 return place(0)?cols:null
}
/** Patches grow from the cats one square at a time, in random order, until they cover the board. */
function growRegions(n:number,cols:number[],roll:()=>number):number[]{
 const regions=Array(n*n).fill(-1)
 cols.forEach((c,r)=>{regions[r*n+c]=r})
 let left=n*n-n
 while(left>0){
  const edge:[number,number][]=[]
  for(let i=0;i<n*n;i++){if(regions[i]>=0)continue;const r=Math.floor(i/n),c=i%n;for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const y=r+dr,x=c+dc;if(y>=0&&x>=0&&y<n&&x<n&&regions[y*n+x]>=0)edge.push([i,regions[y*n+x]])}}
  const [i,reg]=edge[Math.floor(roll()*edge.length)]
  regions[i]=reg;left--
 }
 return regions
}
/** How many answers the puzzle has (counting stops at `limit`). */
export function countSolutions(p:Puzzle,limit=2):number{
 const {n,regions}=p,cols=new Set<number>(),regs=new Set<number>(),at:number[]=[]
 let found=0
 const go=(r:number)=>{
  if(found>=limit)return
  if(r===n){found++;return}
  for(let c=0;c<n;c++){
   const reg=regions[r*n+c]
   if(cols.has(c)||regs.has(reg)||(r>0&&Math.abs(at[r-1]-c)<=1))continue
   cols.add(c);regs.add(reg);at.push(c);go(r+1);at.pop();cols.delete(c);regs.delete(reg)
  }
 }
 go(0)
 return found
}
export function makePuzzle(n:number,roll:()=>number):Puzzle{
 for(let tries=0;tries<1500;tries++){
  const cols=layCats(n,roll)
  if(!cols)continue
  const p={n,regions:growRegions(n,cols,roll)}
  if(countSolutions(p,2)===1)return p
 }
 // Hardly ever reached: a smaller board always comes quickly.
 return makePuzzle(Math.max(4,n-1),roll)
}
/** The cats that break a rule (same row, column or patch, or touching), and whether the puzzle is solved. */
export function check(p:Puzzle,cats:Set<number>):{wrong:Set<number>;solved:boolean}{
 const {n,regions}=p,list=[...cats],wrong=new Set<number>()
 for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){
  const i=list[a],j=list[b],ri=Math.floor(i/n),ci=i%n,rj=Math.floor(j/n),cj=j%n
  if(ri===rj||ci===cj||regions[i]===regions[j]||(Math.abs(ri-rj)<=1&&Math.abs(ci-cj)<=1)){wrong.add(i);wrong.add(j)}
 }
 return {wrong,solved:cats.size===n&&wrong.size===0}
}

/** The answer: one cat square for each row (the puzzle has just one answer). */
export function solve(p:Puzzle):number[]{
 const {n,regions}=p,at:number[]=[]
 const go=(r:number):boolean=>{
  if(r===n)return true
  for(let c=0;c<n;c++){
   if(at.some((x,y)=>x===c||regions[y*n+x]===regions[r*n+c])||(r>0&&Math.abs(at[r-1]-c)<=1))continue
   at.push(c);if(go(r+1))return true;at.pop()
  }
  return false
 }
 go(0)
 return at.map((c,r)=>r*n+c)
}
/** Squares a placed cat rules out: its row, column and patch, and the eight around it. */
export function ruledOut(p:Puzzle,cats:Set<number>):Set<number>{
 const {n,regions}=p,out=new Set<number>()
 for(const i of cats){const r=Math.floor(i/n),c=i%n
  for(let j=0;j<n*n;j++){const rj=Math.floor(j/n),cj=j%n;if(j!==i&&(rj===r||cj===c||regions[j]===regions[i]||(Math.abs(rj-r)<=1&&Math.abs(cj-c)<=1)))out.add(j)}}
 for(const i of cats)out.delete(i)
 return out
}
/** The cats that share a row, column or patch with another: those rows, columns and patches light up. */
export function clashes(p:Puzzle,cats:Set<number>):Set<number>{
 const {n,regions}=p,list=[...cats],hot=new Set<number>()
 for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){
  const i=list[a],j=list[b],ri=Math.floor(i/n),ci=i%n,rj=Math.floor(j/n),cj=j%n
  for(let k=0;k<n*n;k++){const rk=Math.floor(k/n),ck=k%n
   if((ri===rj&&rk===ri)||(ci===cj&&ck===ci)||(regions[i]===regions[j]&&regions[k]===regions[i]))hot.add(k)}
 }
 return hot
}

/** Your fastest time for each board size, kept on this device. */
const BEST_KEY='kono-meow-best'
const bests=():Record<string,number>=>{try{return JSON.parse(localStorage.getItem(BEST_KEY)||'{}')}catch{return {}}}
export const meowBest=(n:number):number|null=>bests()[n]??null
/** Saves a time; true when it's a new best for that size. */
export const saveMeowBest=(n:number,seconds:number)=>{const all=bests(),was=all[n];if(was!==undefined&&was<=seconds)return false;all[n]=seconds;try{localStorage.setItem(BEST_KEY,JSON.stringify(all))}catch{/* storage unavailable */}return true}

/** The level you're on, kept on this device. */
const LEVEL_KEY='kono-meow-level'
export const meowLevel=()=>{try{return Math.max(1,Number(localStorage.getItem(LEVEL_KEY))||1)}catch{return 1}}
export const saveMeowLevel=(n:number)=>{try{localStorage.setItem(LEVEL_KEY,String(n))}catch{/* storage unavailable */}}
export const newMeowPuzzle=(level:number)=>makePuzzle(sizeFor(level),Math.random)
/** Whether Meowdoku marks the squares a cat rules out by itself (Auto ✕), kept on this device. */
const AUTO_KEY='kono-meow-auto'
export const meowAuto=()=>{try{return localStorage.getItem(AUTO_KEY)==='1'}catch{return false}}
export const saveMeowAuto=(on:boolean)=>{try{localStorage.setItem(AUTO_KEY,on?'1':'0')}catch{/* storage unavailable */}}
