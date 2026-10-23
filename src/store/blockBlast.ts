/** KONO blast (the arcade's block puzzle, components/BlockBlast): an 8 × 8 board and three pieces at a time.
 * Put every piece on the board (they don't turn); a full row or column clears. When all three are used,
 * three more come; when none of the ones left fits anywhere, the game is over.
 *
 * Score: 1 for each square put down, and for clearing, 10 × lines² (so two lines at once is 40), plus a
 * streak bonus of 10 × the number of clearing moves in a row before this one. */
export const SIZE=8
/** A square's color (an index into the component's colors), or null when it's empty; row by row. */
export type Grid=(number|null)[]
export type Shape={id:string;cells:[number,number][]}
export type Piece={shape:Shape;color:number}
export const COLORS=7

/** Pieces drawn as rows of # and . */
const DRAWN:Record<string,string>={
 dot:'#',two:'##',three:'###',four:'####',five:'#####',
 twoUp:'#/#',threeUp:'#/#/#',fourUp:'#/#/#/#',fiveUp:'#/#/#/#/#',
 square:'##/##',big:'###/###/###',
 l1:'#./#./##',l2:'###/#..',l3:'##/.#/.#',l4:'..#/###',
 j1:'.#/.#/##',j2:'#../###',
 corner1:'##/#.',corner2:'##/.#',corner3:'#./##',corner4:'.#/##',
 bigCorner:'###/#../#..',
 t1:'###/.#.',t2:'.#./###',t3:'#./##/#.',t4:'.#/##/.#',
 s1:'.##/##.',s2:'##./.##',s3:'#./##/.#',s4:'.#/##/#.',
}
export const SHAPES:Shape[]=Object.entries(DRAWN).map(([id,art])=>({id,cells:art.split('/').flatMap((row,r)=>[...row].flatMap((ch,c)=>ch==='#'?[[r,c] as [number,number]]:[]))}))
export const shapeSize=(s:Shape)=>({rows:Math.max(...s.cells.map(([r])=>r))+1,cols:Math.max(...s.cells.map(([,c])=>c))+1})

export const emptyGrid=():Grid=>Array(SIZE*SIZE).fill(null)
/** Whether the shape fits with its top-left corner at row r, column c. */
export function fits(grid:Grid,shape:Shape,r:number,c:number):boolean{
 return shape.cells.every(([dr,dc])=>{const y=r+dr,x=c+dc;return y>=0&&x>=0&&y<SIZE&&x<SIZE&&grid[y*SIZE+x]===null})
}
export function anyFits(grid:Grid,shape:Shape):boolean{
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(fits(grid,shape,r,c))return true
 return false
}
/** Puts a piece down: the new board (full rows and columns cleared), the squares cleared (with the colors
 * they had, for the burst) and how many lines. */
export function place(grid:Grid,piece:Piece,r:number,c:number):{grid:Grid;cleared:number[];colors:number[];lines:number}|null{
 if(!fits(grid,piece.shape,r,c))return null
 const next=[...grid]
 for(const [dr,dc] of piece.shape.cells)next[(r+dr)*SIZE+c+dc]=piece.color
 const cleared=new Set<number>()
 let lines=0
 for(let i=0;i<SIZE;i++){
  const row=Array.from({length:SIZE},(_,k)=>i*SIZE+k),col=Array.from({length:SIZE},(_,k)=>k*SIZE+i)
  if(row.every(j=>next[j]!==null)){lines++;row.forEach(j=>cleared.add(j))}
  if(col.every(j=>next[j]!==null)){lines++;col.forEach(j=>cleared.add(j))}
 }
 const order=[...cleared],colors=order.map(j=>next[j]??piece.color)
 for(const j of cleared)next[j]=null
 return {grid:next,cleared:order,colors,lines}
}
/** Points for one move: `streak` is how many clearing moves came just before it. */
export const movePoints=(squares:number,lines:number,streak:number)=>squares+(lines?10*lines*lines+10*streak:0)
/** What KONO cheers for a clear, by how many lines went at once. */
export const praise=(lines:number)=>['','Good!','Great!','Excellent!','Amazing!','Unbelievable!'][Math.min(lines,5)]
/** Three new pieces. `roll` gives 0–1 numbers (Math.random in the game). */
export function deal(roll:()=>number):Piece[]{
 return Array.from({length:3},()=>({shape:SHAPES[Math.floor(roll()*SHAPES.length)%SHAPES.length],color:Math.floor(roll()*COLORS)%COLORS}))
}
