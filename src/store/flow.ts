/** KONO Flow (components/FlowGame): a falling-block puzzle. Seven shapes of four blocks fall into a well 10
 * wide and 20 tall; move and turn them as they fall, and fill a row from wall to wall to clear it. The game
 * speeds up every 10 lines, and it's over when a new shape has no room to come in.
 * - Shapes come in shuffled sets of seven, so every shape turns up once in each set. The next five are
 *   shown, and one can be put aside to hold (once per shape).
 * - A shape turns about its middle, and if it bumps into something it tries a few nudges (the standard
 *   wall kicks), so it can turn against a wall or twist into a gap.
 * - A shape that lands can still be slid and turned for half a second (each move restarts the wait, up to
 *   15 times) before it locks.
 * - Points: 100, 300, 500 or 800 for 1–4 rows at once (times the level); a T-shape twisted into a slot
 *   (a T-spin) scores more; clearing in a row builds a combo; two big clears back to back score half again;
 *   emptying the well altogether is a perfect clear. Dropping counts too (1 a row, 2 for a hard drop).
 * - Flow: clearing rows fills the Flow meter. Set it off (once it's a quarter full) and time stops: shapes
 *   don't fall, and every row you fill sinks to the bottom and waits there instead of clearing. When the
 *   meter runs out they all clear at once, for a big bonus. */
export const COLS=10,ROWS=20,HIDDEN=2,H=ROWS+HIDDEN
export const KINDS=['I','O','T','S','Z','J','L'] as const
export type Kind=typeof KINDS[number]
/** A cell: 0 is empty, 1–7 a shape's blocks (its kind + 1), 8 a row filled during Flow. */
export type Cell=number
export const FLOW_CELL=8
export type Active={kind:Kind;rot:number;x:number;y:number}
export type FlowEvent=
 |{t:'move'}|{t:'rotate';kicked:boolean}|{t:'hold'}|{t:'land'}
 |{t:'lock';cells:[number,number][];drop:number}
 |{t:'clear';rows:number[];count:number;tspin:'full'|'mini'|null;b2b:boolean;combo:number;perfect:boolean;points:number}
 |{t:'level';level:number}
 |{t:'flowOn';ms:number}|{t:'flowStack';rows:number[];total:number}|{t:'flowEnd';lines:number;points:number}
 |{t:'over'}|{t:'done'}|{t:'zen'}
/** How a game is played: Marathon (until the well fills, faster every 10 lines), Sprint (40 lines as fast as
 * you can), Ultra (as many points as you can in three minutes), Zen (no game over: a full well just clears,
 * and it never gets faster than level 5). */
export type Mode='marathon'|'sprint'|'ultra'|'zen'
export const SPRINT_LINES=40,ULTRA_MS=180_000
export type Game={
 board:Cell[];piece:Active|null;queue:Kind[];hold:Kind|null;canHold:boolean
 score:number;lines:number;level:number;combo:number;b2b:boolean
 fall:number;lockMs:number;resets:number;lowest:number;lastRotate:boolean;lastKick:number
 flow:number;flowMs:number;flowLines:number;flowRows:number;over:boolean;events:FlowEvent[];roll:()=>number
 mode:Mode;time:number
}

// The shapes, each turn of them as the cells (x, y) it fills in its box (y down): the standard rotation system.
const SHAPES:Record<Kind,[number,number][][]>={
 I:[[[0,1],[1,1],[2,1],[3,1]],[[2,0],[2,1],[2,2],[2,3]],[[0,2],[1,2],[2,2],[3,2]],[[1,0],[1,1],[1,2],[1,3]]],
 O:[[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]]],
 T:[[[1,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[2,1],[1,2]],[[1,0],[0,1],[1,1],[1,2]]],
 S:[[[1,0],[2,0],[0,1],[1,1]],[[1,0],[1,1],[2,1],[2,2]],[[1,1],[2,1],[0,2],[1,2]],[[0,0],[0,1],[1,1],[1,2]]],
 Z:[[[0,0],[1,0],[1,1],[2,1]],[[2,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[1,2],[2,2]],[[1,0],[0,1],[1,1],[0,2]]],
 J:[[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[1,1],[1,2]],[[0,1],[1,1],[2,1],[2,2]],[[1,0],[1,1],[0,2],[1,2]]],
 L:[[[2,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[1,2],[2,2]],[[0,1],[1,1],[2,1],[0,2]],[[0,0],[1,0],[1,1],[1,2]]],
}
// Wall kicks (x right, y up, as the standard tables are written): the nudges tried, in order, for each turn.
const KICKS:Record<string,[number,number][]>={
 '0>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],'1>0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
 '1>2':[[0,0],[1,0],[1,-1],[0,2],[1,2]],'2>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
 '2>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],'3>2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
 '3>0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],'0>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
}
const KICKS_I:Record<string,[number,number][]>={
 '0>1':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],'1>0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
 '1>2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],'2>1':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
 '2>3':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'3>2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
 '3>0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],'0>3':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
}
export const LOCK_MS=500,MAX_RESETS=15,FLOW_MS_PER_QUARTER=5000
/** Which of the five soundtracks plays at a level: a new one every three levels (1–3, 4–6, 7–9, 10–12, 13 on). */
export const musicPart=(level:number)=>Math.min(5,Math.max(1,Math.floor((level-1)/3)+1))
/** How long a row takes to fall at a level (ms): the standard curve, faster each level. */
export const gravityMs=(level:number)=>1000*Math.pow(0.8-(level-1)*0.007,level-1)

export const cellsOf=(p:Active):[number,number][]=>SHAPES[p.kind][p.rot].map(([x,y])=>[p.x+x,p.y+y])
export const shapeCells=(k:Kind)=>SHAPES[k][0]
const at=(x:number,y:number)=>y*COLS+x
function fits(g:Game,p:Active):boolean{
 for(const [x,y] of cellsOf(p)){if(x<0||x>=COLS||y>=H)return false;if(y>=0&&g.board[at(x,y)])return false}
 return true
}
function bag(roll:()=>number):Kind[]{const b=[...KINDS];for(let i=b.length-1;i>0;i--){const j=Math.floor(roll()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function refill(g:Game){while(g.queue.length<7)g.queue.push(...bag(g.roll))}
/** A new shape at the top (from the queue, or `kind`); the game is over if it has no room. */
function spawn(g:Game,kind?:Kind){
 refill(g)
 const k=kind??g.queue.shift()!
 const p:Active={kind:k,rot:0,x:3,y:HIDDEN-2+(k==='I'?-1:0)+1}
 g.piece=p;g.lockMs=0;g.resets=0;g.lowest=p.y;g.fall=0;g.lastRotate=false
 if(!fits(g,p))topOut(g)
 refill(g)
}
/** No room left: the game is over, except in Zen, where the well clears and play goes on. */
function topOut(g:Game){
 if(g.mode!=='zen'){g.over=true;g.piece=null;g.events.push({t:'over'});return}
 g.board.fill(0);g.flowRows=0;g.events.push({t:'zen'})
 spawn(g)
}
export function newGame(roll:()=>number,mode:Mode='marathon'):Game{
 const g:Game={board:Array(COLS*H).fill(0),piece:null,queue:[],hold:null,canHold:true,score:0,lines:0,level:1,combo:-1,b2b:false,
  fall:0,lockMs:0,resets:0,lowest:0,lastRotate:false,lastKick:0,flow:0,flowMs:0,flowLines:0,flowRows:0,over:false,events:[],roll,mode,time:0}
 spawn(g)
 return g
}
/** Where the shape would land (its ghost). */
export function ghostOf(g:Game):Active|null{
 if(!g.piece)return null
 const p={...g.piece}
 while(fits(g,{...p,y:p.y+1}))p.y++
 return p
}
const grounded=(g:Game)=>!!g.piece&&!fits(g,{...g.piece,y:g.piece.y+1})
// A move or turn while on the ground restarts the lock wait (up to MAX_RESETS times).
function touched(g:Game){if(g.piece&&grounded(g)&&g.resets<MAX_RESETS){g.lockMs=0;g.resets++}}
export function move(g:Game,dx:number):boolean{
 if(!g.piece||g.over)return false
 const p={...g.piece,x:g.piece.x+dx}
 if(!fits(g,p))return false
 g.piece=p;g.lastRotate=false;touched(g);g.events.push({t:'move'})
 return true
}
/** Turns the shape (dir 1 clockwise, -1 the other way), trying the wall kicks. */
export function rotate(g:Game,dir:1|-1):boolean{
 if(!g.piece||g.over||g.piece.kind==='O')return false
 const from=g.piece.rot,to=(from+dir+4)%4,table=(g.piece.kind==='I'?KICKS_I:KICKS)[from+'>'+to]
 for(let k=0;k<table.length;k++){
  const [dx,dy]=table[k],p={...g.piece,rot:to,x:g.piece.x+dx,y:g.piece.y-dy}
  if(fits(g,p)){g.piece=p;g.lastRotate=true;g.lastKick=k;touched(g);g.events.push({t:'rotate',kicked:k>0});return true}
 }
 return false
}
export function holdPiece(g:Game):boolean{
 if(!g.piece||g.over||!g.canHold)return false
 const k=g.piece.kind,h=g.hold
 g.hold=k;g.canHold=false;g.events.push({t:'hold'})
 spawn(g,h??undefined)
 g.canHold=false
 return true
}
export function softDrop(g:Game):boolean{
 if(!g.piece||g.over||!fits(g,{...g.piece,y:g.piece.y+1}))return false
 g.piece={...g.piece,y:g.piece.y+1};g.fall=0;g.lastRotate=false;if(!g.flowMs)g.score+=1
 return true
}
export function hardDrop(g:Game){
 if(!g.piece||g.over)return
 let n=0
 while(fits(g,{...g.piece,y:g.piece.y+1})){g.piece={...g.piece,y:g.piece.y+1};n++}
 if(n)g.lastRotate=false
 g.score+=2*n
 lock(g,n)
}
// A T-spin: the T's last move was a turn and three of the four corners round its middle are filled; a
// "mini" if only one of the two corners it points at is (unless the last kick was the big one).
function tspin(g:Game,p:Active):'full'|'mini'|null{
 if(p.kind!=='T'||!g.lastRotate)return null
 const cx=p.x+1,cy=p.y+1,filled=(x:number,y:number)=>x<0||x>=COLS||y>=H||(y>=0&&!!g.board[at(x,y)])
 const corners=[[cx-1,cy-1],[cx+1,cy-1],[cx+1,cy+1],[cx-1,cy+1]].map(([x,y])=>filled(x,y))
 if(corners.filter(Boolean).length<3)return null
 const front=[[0,1],[1,2],[2,3],[3,0]][p.rot].filter(i=>corners[i]).length
 return front===2||g.lastKick===4?'full':'mini'
}
function lock(g:Game,drop=0){
 const p=g.piece!
 const spin=tspin(g,p),cells=cellsOf(p)
 for(const [x,y] of cells)if(y>=0)g.board[at(x,y)]=KINDS.indexOf(p.kind)+1
 g.events.push({t:'lock',cells,drop})
 // Locked entirely above the well: game over.
 if(cells.every(([,y])=>y<HIDDEN)){g.piece=null;topOut(g);return}
 g.piece=null;g.canHold=true
 const full:number[]=[]
 for(let y=0;y<H-g.flowRows;y++){let all=true;for(let x=0;x<COLS;x++)if(!g.board[at(x,y)]){all=false;break};if(all)full.push(y)}
 if(g.flowMs>0){
  // Flow: the full rows sink to the bottom (above the ones already there) and wait.
  if(full.length){
   const keep:Cell[][]=[]
   for(let y=0;y<H-g.flowRows;y++)if(!full.includes(y))keep.push(g.board.slice(at(0,y),at(0,y)+COLS))
   const flowRows:Cell[][]=[]
   for(let y=H-g.flowRows;y<H;y++)flowRows.push(g.board.slice(at(0,y),at(0,y)+COLS))
   const rows=[...keep,...full.map(()=>Array(COLS).fill(FLOW_CELL)),...flowRows]
   g.board=rows.flat();g.flowRows+=full.length;g.flowLines+=full.length
   g.events.push({t:'flowStack',rows:full,total:g.flowLines})
  }
  // No room for the next shape: Flow ends early (its rows clear), then the shape comes in.
  spawn(g)
  if(g.over){g.over=false;g.events.pop();endFlow(g);spawn(g)}
  return
 }
 if(full.length){
  for(const y of full){g.board.splice(at(0,y),COLS);g.board.unshift(...Array(COLS).fill(0))}
  const n=full.length,big=n===4||!!spin
  const base=spin==='full'?[400,800,1200,1600][n]:spin==='mini'?[100,200,400][Math.min(n,2)]:[0,100,300,500,800][n]
  const b2b=big&&g.b2b
  g.combo++
  const perfect=g.board.every(c=>!c)
  let points=Math.round(base*g.level*(b2b?1.5:1))+(g.combo>0?50*g.combo*g.level:0)+(perfect?[0,800,1200,1800,2000][n]*g.level:0)
  if(!points)points=0
  g.score+=points;g.b2b=big?true:n?false:g.b2b
  const was=g.level
  g.lines+=n;g.level=Math.floor(g.lines/10)+1
  // Flow fills a sixteenth a row (a full meter is 16 rows).
  g.flow=Math.min(1,g.flow+n/16)
  g.events.push({t:'clear',rows:full,count:n,tspin:spin,b2b,combo:Math.max(0,g.combo),perfect,points})
  if(g.level>was)g.events.push({t:'level',level:g.level})
  // Sprint is done at 40 lines.
  if(g.mode==='sprint'&&g.lines>=SPRINT_LINES){g.over=true;g.piece=null;g.events.push({t:'done'});return}
 }else{
  g.combo=-1
  if(spin){const points=(spin==='full'?400:100)*g.level;g.score+=points;g.events.push({t:'clear',rows:[],count:0,tspin:spin,b2b:false,combo:0,perfect:false,points})}
 }
 spawn(g)
}
/** Sets Flow off, if the meter is at least a quarter full: time stops for 5 s a quarter. */
export function startFlow(g:Game):boolean{
 if(g.over||g.flowMs>0||g.flow<0.25)return false
 g.flowMs=Math.round(g.flow*4*FLOW_MS_PER_QUARTER);g.flow=0;g.flowLines=0
 g.events.push({t:'flowOn',ms:g.flowMs})
 return true
}
/** Flow's end: the rows it stacked all clear at once, for a bonus that grows with how many. */
function endFlow(g:Game){
 const n=g.flowLines
 g.flowMs=0
 if(g.flowRows){g.board.splice(at(0,H-g.flowRows),g.flowRows*COLS);g.board.unshift(...Array(g.flowRows*COLS).fill(0));g.flowRows=0}
 const points=n?Math.round((n<=4?[0,100,300,500,800][n]:800+(n-4)*n*50)*g.level):0
 g.score+=points;g.lines+=n
 const was=g.level;g.level=Math.floor(g.lines/10)+1
 g.flowLines=0
 g.events.push({t:'flowEnd',lines:n,points})
 if(g.level>was)g.events.push({t:'level',level:g.level})
 // The shape in play stays where it is if it still fits (it was above the stacked rows).
 if(g.piece&&!fits(g,g.piece))spawn(g)
}
/** Moves time on by `dt` ms: the shape falls (faster on soft drop), and locks once it has sat on something
 * for LOCK_MS; Flow counts down. */
export function tick(g:Game,dt:number){
 if(g.over)return
 g.time+=dt
 // Ultra ends when its three minutes are up.
 if(g.mode==='ultra'&&g.time>=ULTRA_MS){g.time=ULTRA_MS;g.over=true;g.piece=null;g.events.push({t:'done'});return}
 if(g.flowMs>0){
  g.flowMs-=dt
  // In Flow the shape doesn't fall, but still locks if it's left on the ground.
  if(g.piece&&grounded(g)){g.lockMs+=dt;if(g.lockMs>=LOCK_MS*2)lock(g)}
  if(g.flowMs<=0)endFlow(g)
  return
 }
 if(!g.piece){spawn(g);return}
 if(grounded(g)){
  g.lockMs+=dt
  if(g.lockMs>=LOCK_MS||g.resets>=MAX_RESETS&&g.lockMs>=LOCK_MS/4){lock(g);return}
  return
 }
 g.fall+=dt
 const each=gravityMs(g.mode==='zen'?Math.min(5,g.level):g.level)
 while(g.fall>=each&&g.piece&&!grounded(g)){
  g.fall-=each;g.piece={...g.piece,y:g.piece.y+1};g.lastRotate=false
  // Reaching a new lowest row gives the lock wait back.
  if(g.piece.y>g.lowest){g.lowest=g.piece.y;g.resets=0}
  if(grounded(g))g.events.push({t:'land'})
 }
}
