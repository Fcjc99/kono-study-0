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
