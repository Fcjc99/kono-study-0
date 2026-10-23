import type {LandId} from './konoWorld'

/** Each land's own game on the world map (components/LandGames): what it's called, where its booth sits on
 * the land's picture (shares of the picture), and Acorn tumble's board and rules. */
export type LandGameId='chase'|'tumble'|'sled'
export type Info={id:LandGameId;emoji:string;name:string;how:string;booth:{x:number;y:number};unit:(n:number)=>string}
export const LAND_GAMES:Record<LandId,Info>={
 beach:{id:'chase',emoji:'🐚',name:'Shell chase',how:'Steer KONO to the shells. Each one brings a baby crab along; don’t bump the edge or the crabs!',booth:{x:0.27,y:0.37},unit:n=>n+' shell'+(n===1?'':'s')},
 forest:{id:'tumble',emoji:'🌰',name:'Acorn tumble',how:'Tap 2 or more touching pieces that match to clear them. Bigger groups score much more!',booth:{x:0.2,y:0.42},unit:n=>n+' point'+(n===1?'':'s')},
 snow:{id:'sled',emoji:'🛷',name:'Sled dash',how:'KONO sleds downhill: dodge the trees and rocks and grab the stars.',booth:{x:0.8,y:0.6},unit:n=>n+' star'+(n===1?'':'s')},
}
/** Acorn tumble: 7 columns of 8 forest pieces, kept bottom-up so cleared pieces let the rest fall, and an
 * emptied column closes up. A group of n scores n × n. */
export type Tile={id:number;kind:number}
export const KINDS=[{emoji:'🌰',name:'Acorn'},{emoji:'🍄',name:'Mushroom'},{emoji:'🍀',name:'Clover'},{emoji:'🍂',name:'Leaf'}]
export const COLS=7,ROWS=8
export function tumbleBoard():Tile[][]{let id=0;return Array.from({length:COLS},()=>Array.from({length:ROWS},()=>({id:++id,kind:Math.floor(Math.random()*KINDS.length)})))}
/** The touching pieces of the same kind as the one at column c, row r (from the bottom). */
export function groupAt(cols:Tile[][],c:number,r:number):[number,number][]{
 const kind=cols[c]?.[r]?.kind,seen=new Set<string>(),out:[number,number][]=[],todo:[number,number][]=[[c,r]]
 if(kind===undefined)return out
 while(todo.length){
  const [x,y]=todo.pop()!,k=x+','+y
  if(seen.has(k)||cols[x]?.[y]?.kind!==kind)continue
  seen.add(k);out.push([x,y]);todo.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])
 }
 return out
}
export const hasMoves=(cols:Tile[][])=>cols.some((col,c)=>col.some((t,r)=>col[r+1]?.kind===t.kind||cols[c+1]?.[r]?.kind===t.kind))
/** Taps the piece at column c, row r: a group of 2 or more clears (and scores), anything less does nothing. */
export function clearGroup(cols:Tile[][],c:number,r:number):{cols:Tile[][];points:number}|null{
 const group=groupAt(cols,c,r)
 if(group.length<2)return null
 const gone=new Set(group.map(([x,y])=>cols[x][y].id))
 return {cols:cols.map(col=>col.filter(t=>!gone.has(t.id))).filter(col=>col.length),points:group.length*group.length}
}
