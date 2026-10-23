/** KONO.io's rules, after Paper.io 2 (components/PaperKono draws them). The map is a square of N × N
 * squares. Every player is a block that never stops moving, and steers up, down, left or right (never
 * straight back). Inside your own land you move freely; outside it you leave a trail, and coming home
 * claims the trail and everything it closes in. Anyone who touches your trail cuts it, and you're out;
 * running into your own trail or off the map ends you too. Lose all your land and you're out. Bots roam
 * out in loops and hurry home when someone gets close; the bots that go out come back three seconds later.
 * The leaderboard is how much of the map each player owns. */
export const N=60
export type Dir=0|1|2|3 // up, right, down, left
const DX=[0,1,0,-1],DY=[-1,0,1,0]
export type Player={id:number;name:string;color:string;face:string;x:number;y:number;dir:Dir;want:Dir;trail:number[];alive:boolean;kills:number;back:number
 bot?:{plan:Dir[];brave:number}}
export type Arena={own:Int16Array;trail:Int16Array;players:Player[];ticks:number;roll:()=>number;log:{tick:number;text:string;by:number;who:number}[]}
export const BOTS=[
 {name:'Mochi',color:'#ef4b5c',face:'🍡'},{name:'Pebble',color:'#2fc2e8',face:'🪨'},{name:'Biscuit',color:'#f7922f',face:'🍪'},
 {name:'Nori',color:'#46c35a',face:'🍙'},{name:'Plum',color:'#a35be0',face:'🫐'},{name:'Sunny',color:'#f6cf33',face:'🌻'},{name:'Bubbles',color:'#ff7ad0',face:'🫧'},
]
const at=(x:number,y:number)=>y*N+x
const inside=(x:number,y:number)=>x>=0&&y>=0&&x<N&&y<N
/** A new arena: you (player 1, KONO's color) and `bots` bots, each starting on a small round patch. */
export function newArena(roll:()=>number,bots=6,color='#3e6fe6'):Arena{
 const a:Arena={own:new Int16Array(N*N),trail:new Int16Array(N*N),players:[],ticks:0,roll,log:[]}
 a.players.push({id:1,name:'You',color,face:'',x:0,y:0,dir:1,want:1,trail:[],alive:true,kills:0,back:0})
 BOTS.slice(0,bots).forEach((b,k)=>a.players.push({id:k+2,...b,x:0,y:0,dir:0,want:0,trail:[],alive:true,kills:0,back:0,bot:{plan:[],brave:0.4+roll()*0.6}}))
 for(const p of a.players)spawn(a,p)
 return a
}
/** Puts a player on a free round patch (radius 2), facing a random way. */
function spawn(a:Arena,p:Player){
 for(let tries=0;tries<400;tries++){
  const x=3+Math.floor(a.roll()*(N-6)),y=3+Math.floor(a.roll()*(N-6))
  let free=true
  for(let dy=-3;dy<=3&&free;dy++)for(let dx=-3;dx<=3;dx++){const i=at(x+dx,y+dy);if(a.own[i]||a.trail[i]){free=false;break}}
  if(!free&&tries<300)continue
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(dx*dx+dy*dy<=5)a.own[at(x+dx,y+dy)]=p.id
  p.x=x;p.y=y;p.dir=p.want=Math.floor(a.roll()*4) as Dir;p.trail=[];p.alive=true;if(p.bot)p.bot.plan=[]
  return
 }
}
/** Steers a player: any way but straight back. */
export function steer(p:Player,d:Dir){if((d+2)%4!==p.dir)p.want=d}
/** Squares each player owns, as a share of the map (0–100). */
export function shares(a:Arena):Map<number,number>{
 const n=new Map<number,number>();for(const id of a.own)if(id)n.set(id,(n.get(id)??0)+1)
 const out=new Map<number,number>();for(const p of a.players)out.set(p.id,(n.get(p.id)??0)*100/(N*N));return out
}
/** Ends a player: their trail goes, their land goes, and a bot comes back after three seconds (30 ticks). */
function knockOut(a:Arena,p:Player,by:number|null){
 if(!p.alive)return
 p.alive=false
 for(const i of p.trail)if(a.trail[i]===p.id)a.trail[i]=0
 p.trail=[]
 for(let i=0;i<N*N;i++)if(a.own[i]===p.id)a.own[i]=0
 if(by!==null&&by!==p.id){const k=a.players.find(q=>q.id===by);if(k)k.kills++}
 a.log.push({tick:a.ticks,text:by===null||by===p.id?p.name+' crashed':(a.players.find(q=>q.id===by)?.name??'')+' cut '+p.name,by:by??0,who:p.id})
 p.back=a.ticks+30
}
/** Coming home: the trail becomes land, and so does everything it closes in (squares the outside can't reach). */
function claim(a:Arena,p:Player){
 for(const i of p.trail){a.own[i]=p.id;if(a.trail[i]===p.id)a.trail[i]=0}
 p.trail=[]
 const seen=new Uint8Array(N*N),stack:number[]=[]
 for(let x=0;x<N;x++)for(const y of [0,N-1]){const i=at(x,y);if(a.own[i]!==p.id&&!seen[i]){seen[i]=1;stack.push(i)}}
 for(let y=0;y<N;y++)for(const x of [0,N-1]){const i=at(x,y);if(a.own[i]!==p.id&&!seen[i]){seen[i]=1;stack.push(i)}}
 while(stack.length){const i=stack.pop()!,x=i%N,y=(i-x)/N
  for(let d=0;d<4;d++){const nx=x+DX[d],ny=y+DY[d];if(!inside(nx,ny))continue;const j=at(nx,ny);if(!seen[j]&&a.own[j]!==p.id){seen[j]=1;stack.push(j)}}}
 const lost=new Set<number>()
 for(let i=0;i<N*N;i++)if(!seen[i]&&a.own[i]!==p.id){if(a.own[i])lost.add(a.own[i]);a.own[i]=p.id}
 // Anyone left with no land at all is out.
 for(const id of lost){const q=a.players.find(x=>x.id===id);if(q?.alive&&!a.own.includes(id))knockOut(a,q,p.id)}
}
/** A bot's next ways to go: a loop out of its land (out, across, back) or, in danger, straight home. */
function think(a:Arena,p:Player){
 const b=p.bot!,home=a.own[at(p.x,p.y)]===p.id
 // Danger: someone is near my trail, or the trail is getting long. Head for the nearest bit of my land.
 const near=a.players.some(q=>q.alive&&q.id!==p.id&&p.trail.some(i=>Math.abs(i%N-q.x)+Math.abs(Math.floor(i/N)-q.y)<5))
 if(!home&&(near||p.trail.length>14+b.brave*30)){b.plan=pathHome(a,p);return}
 if(b.plan.length)return
 if(home){
  // A loop: out `len` squares, across `side`, then back.
  const out=Math.floor(a.roll()*4) as Dir,len=3+Math.floor(a.roll()*(4+b.brave*8)),side=2+Math.floor(a.roll()*(3+b.brave*7)),turn=(a.roll()<0.5?1:3)
  const across=((out+turn)%4) as Dir,back=((out+2)%4) as Dir
  b.plan=[...Array(len).fill(out),...Array(side).fill(across),...Array(len+2).fill(back)]
 }else b.plan=pathHome(a,p)
}
/** Ways toward the nearest square of the player's own land (as the crow flies, then by the grid). */
function pathHome(a:Arena,p:Player):Dir[]{
 let best=-1,dist=1e9
 for(let i=0;i<N*N;i++)if(a.own[i]===p.id){const d=Math.abs(i%N-p.x)+Math.abs(Math.floor(i/N)-p.y);if(d<dist){dist=d;best=i}}
 if(best<0)return []
 const tx=best%N,ty=Math.floor(best/N),dx=tx-p.x,dy=ty-p.y,out:Dir[]=[]
 const h:Dir=dx>0?1:3,v:Dir=dy>0?2:0
 for(let k=0;k<Math.abs(dx);k++)out.push(h)
 for(let k=0;k<Math.abs(dy);k++)out.push(v)
 return out
}
/** A safe way for a bot: the planned one if it doesn't hit its own trail or the edge, else another. */
function safeDir(a:Arena,p:Player,want:Dir):Dir{
 const ok=(d:Dir)=>{if((d+2)%4===p.dir)return false;const x=p.x+DX[d],y=p.y+DY[d];return inside(x,y)&&a.trail[at(x,y)]!==p.id}
 if(ok(want))return want
 const others=([0,1,2,3] as Dir[]).filter(ok)
 return others.length?others[Math.floor(a.roll()*others.length)]:p.dir
}
/** One tick: everyone moves one square; trails, cuts, crashes and claims follow. */
export function tick(a:Arena){
 a.ticks++
 for(const p of a.players)if(!p.alive&&p.bot&&a.ticks>=p.back)spawn(a,p)
 for(const p of a.players){
  if(!p.alive)continue
  if(p.bot){think(a,p);const d=p.bot.plan.shift();p.want=safeDir(a,p,d??p.dir)}
  if((p.want+2)%4!==p.dir)p.dir=p.want
 }
 const moving=a.players.filter(p=>p.alive)
 for(const p of moving){
  if(!p.alive)continue
  const x=p.x+DX[p.dir],y=p.y+DY[p.dir]
  if(!inside(x,y)){knockOut(a,p,null);continue}
  const i=at(x,y),cut=a.trail[i]
  p.x=x;p.y=y
  if(cut===p.id){knockOut(a,p,null);continue}
  if(cut){const q=a.players.find(o=>o.id===cut);if(q)knockOut(a,q,p.id)}
  if(a.own[i]===p.id){if(p.trail.length){claim(a,p);if(p.bot)p.bot.plan=[]}}
  else{a.trail[i]=p.id;p.trail.push(i)}
 }
 // Two heads on one square: whoever is out in the open loses (both, if both are).
 for(const p of moving)for(const q of moving){
  if(p.id>=q.id||!p.alive||!q.alive||p.x!==q.x||p.y!==q.y)continue
  const pin=a.own[at(p.x,p.y)]===p.id,qin=a.own[at(q.x,q.y)]===q.id
  if(!pin)knockOut(a,p,qin?q.id:null)
  if(!qin)knockOut(a,q,pin?p.id:null)
 }
}
