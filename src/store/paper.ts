/** KONO.io's rules, after Paper.io 2 (components/PaperKono draws them). The map is a square of N × N small
 * squares. Every player is a block that never stops moving and steers freely: it turns toward the way you
 * point (swipe, drag or the arrow keys) at a steady rate, so paths curve the way Paper.io's do. Inside your
 * own land you move freely; outside it you leave a trail, and coming home claims the trail and everything
 * it closes in. Anyone who touches your trail cuts it, and you're out; running into your own trail or off
 * the map ends you too. Lose all your land and you're out. Bots roam out in loops and hurry home when
 * someone gets close; the bots that go out come back three seconds later. The leaderboard is how much of
 * the map each player owns.
 * Team battle (like Paper.io 2's): two teams of four, Blue (you and three bots) and Red. A team shares its
 * land (`own` holds the team, not the player), teammates pass over each other's trails, anyone cut comes
 * back three seconds later on the team's land, and after two minutes the team with more of the map wins.
 * The world moves in ticks (TICK_MS each); positions are in squares. */
export const N=100,TICK_MS=50,SPEED=0.5,TURN=0.24
export type Mode='solo'|'team'
export type Player={id:number;name:string;color:string;face:string;team:number
 x:number;y:number;angle:number;want:number;trail:number[];path:[number,number][];alive:boolean;kills:number;back:number
 bot?:{goals:[number,number][];brave:number}}
export type Arena={mode:Mode;own:Int16Array;trail:Int16Array;players:Player[];ticks:number;roll:()=>number;log:{tick:number;text:string;by:number;who:number;x:number;y:number}[]}
export const BOTS=[
 {name:'Mochi',color:'#ef4b5c',face:'🍡'},{name:'Pebble',color:'#2fc2e8',face:'🪨'},{name:'Biscuit',color:'#f7922f',face:'🍪'},
 {name:'Nori',color:'#46c35a',face:'🍙'},{name:'Plum',color:'#a35be0',face:'🫐'},{name:'Sunny',color:'#f6cf33',face:'🌻'},{name:'Bubbles',color:'#ff7ad0',face:'🫧'},
]
/** Team battle's teams (their number is what `own` holds), and how long a battle lasts (2 minutes of ticks). */
export const TEAMS=[{id:1,name:'Blue',color:'#3e6fe6'},{id:2,name:'Red',color:'#ef4b5c'}]
export const TEAM_TICKS=Math.round(120_000/TICK_MS)
const at=(x:number,y:number)=>y*N+x
const inside=(x:number,y:number)=>x>=0&&y>=0&&x<N&&y<N
const cellOf=(x:number,y:number)=>[Math.floor(x),Math.floor(y)] as const
/** Whose land a player's moves claim: their team's in team battle, their own otherwise. */
export const landOf=(p:Player)=>p.team||p.id
const friends=(p:Player,q:Player)=>p.id===q.id||(p.team>0&&p.team===q.team)
/** A new arena: you (player 1, KONO's color) and `bots` bots, each on a small round patch. In team battle
 * it's always four a side: you and the first three bots are Blue, the other four are Red. */
export function newArena(roll:()=>number,bots=6,color='#3e6fe6',mode:Mode='solo'):Arena{
 const a:Arena={mode,own:new Int16Array(N*N),trail:new Int16Array(N*N),players:[],ticks:0,roll,log:[]}
 a.players.push({id:1,name:'You',color,face:'',team:mode==='team'?1:0,x:0,y:0,angle:0,want:0,trail:[],path:[],alive:true,kills:0,back:0})
 BOTS.slice(0,mode==='team'?7:bots).forEach((b,k)=>{const team=mode==='team'?(k<3?1:2):0
  a.players.push({id:k+2,...b,color:team?TEAMS[team-1].color:b.color,team,x:0,y:0,angle:0,want:0,trail:[],path:[],alive:true,kills:0,back:0,bot:{goals:[],brave:0.4+roll()*0.6}})})
 for(const p of a.players)spawn(a,p)
 return a
}
const R=3
/** Puts a player on a free round patch (radius 3), facing a random way. In team battle a player whose team
 * still has land comes back on it instead. */
function spawn(a:Arena,p:Player){
 const ready=(x:number,y:number)=>{p.x=x+0.5;p.y=y+0.5;p.angle=p.want=a.roll()*Math.PI*2;p.trail=[];p.path=[];p.alive=true;if(p.bot)p.bot.goals=[]}
 if(p.team){
  const land:number[]=[];for(let i=0;i<N*N;i++)if(a.own[i]===p.team&&!a.trail[i])land.push(i)
  if(land.length){const i=land[Math.floor(a.roll()*land.length)];ready(i%N,Math.floor(i/N));return}
 }
 for(let tries=0;tries<400;tries++){
  const x=R+2+Math.floor(a.roll()*(N-2*R-4)),y=R+2+Math.floor(a.roll()*(N-2*R-4))
  let free=true
  for(let dy=-R-1;dy<=R+1&&free;dy++)for(let dx=-R-1;dx<=R+1;dx++){const i=at(x+dx,y+dy);if(a.own[i]||a.trail[i]){free=false;break}}
  if(!free&&tries<300)continue
  for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++)if(dx*dx+dy*dy<=R*R+1)a.own[at(x+dx,y+dy)]=landOf(p)
  ready(x,y);return
 }
}
/** Steers a player: it turns toward `angle` (radians, 0 = right, π/2 = down) a little each tick. */
export function steer(p:Player,angle:number){p.want=angle}
/** Squares each player owns, as a share of the map (0–100). In team battle a player's share is their team's. */
export function shares(a:Arena):Map<number,number>{
 const n=new Map<number,number>();for(const id of a.own)if(id)n.set(id,(n.get(id)??0)+1)
 const out=new Map<number,number>();for(const p of a.players)out.set(p.id,(n.get(landOf(p))??0)*100/(N*N));return out
}
/** Each team's share of the map (0–100), by team number. */
export function teamShares(a:Arena):Map<number,number>{
 const n=new Map<number,number>(TEAMS.map(t=>[t.id,0]))
 for(const id of a.own)if(n.has(id))n.set(id,n.get(id)!+1)
 return new Map([...n].map(([id,k])=>[id,k*100/(N*N)]))
}
/** Whether a team battle's two minutes are up. */
export const battleOver=(a:Arena)=>a.mode==='team'&&a.ticks>=TEAM_TICKS
/** Ends a player: their trail goes, their land goes (a team keeps its land), and a bot (in team battle,
 * anyone) comes back after three seconds. */
function knockOut(a:Arena,p:Player,by:number|null){
 if(!p.alive)return
 p.alive=false
 for(const i of p.trail)if(a.trail[i]===p.id)a.trail[i]=0
 p.trail=[];p.path=[]
 if(!p.team)for(let i=0;i<N*N;i++)if(a.own[i]===p.id)a.own[i]=0
 if(by!==null&&by!==p.id){const k=a.players.find(q=>q.id===by);if(k)k.kills++}
 a.log.push({tick:a.ticks,text:by===null||by===p.id?p.name+' crashed':(a.players.find(q=>q.id===by)?.name??'')+' cut '+p.name,by:by??0,who:p.id,x:p.x,y:p.y})
 p.back=a.ticks+Math.round(3000/TICK_MS)
}
/** Coming home: the trail becomes land, and so does everything it closes in (squares the outside can't reach). */
function claim(a:Arena,p:Player){
 const L=landOf(p)
 for(const i of p.trail){a.own[i]=L;if(a.trail[i]===p.id)a.trail[i]=0}
 p.trail=[];p.path=[]
 const seen=new Uint8Array(N*N),stack:number[]=[]
 const seed=(i:number)=>{if(a.own[i]!==L&&!seen[i]){seen[i]=1;stack.push(i)}}
 for(let k=0;k<N;k++){seed(at(k,0));seed(at(k,N-1));seed(at(0,k));seed(at(N-1,k))}
 while(stack.length){const i=stack.pop()!,x=i%N,y=(i-x)/N
  if(x>0)seed(i-1);if(x<N-1)seed(i+1);if(y>0)seed(i-N);if(y<N-1)seed(i+N)}
 const lost=new Set<number>()
 for(let i=0;i<N*N;i++)if(!seen[i]&&a.own[i]!==L){if(a.own[i])lost.add(a.own[i]);a.own[i]=L}
 // Anyone left with no land at all is out.
 for(const id of lost)if(!a.own.includes(id))for(const q of a.players)if(q.alive&&landOf(q)===id)knockOut(a,q,p.id)
}
const turnToward=(from:number,to:number,max:number)=>{let d=((to-from)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI;if(d>max)d=max;if(d<-max)d=-max;return from+d}
/** The nearest square of a player's own land. */
function nearestHome(a:Arena,p:Player):[number,number]|null{
 const L=landOf(p),cx=Math.floor(p.x),cy=Math.floor(p.y)
 for(let r=1;r<N;r++){
  let best:[number,number]|null=null,dist=1e9
  for(let y=Math.max(0,cy-r);y<=Math.min(N-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(N-1,cx+r);x++){
   if(Math.max(Math.abs(x-cx),Math.abs(y-cy))!==r||a.own[at(x,y)]!==L)continue
   const d=(x-cx)**2+(y-cy)**2;if(d<dist){dist=d;best=[x+0.5,y+0.5]}
  }
  if(best)return best
 }
 return null
}
/** A bot's next aim: a loop out of its land (out, across, home) or, in danger, straight home. Near its own
 * trail or the edge it turns away. */
function think(a:Arena,p:Player){
 const b=p.bot!,home=a.own[at(Math.floor(p.x),Math.floor(p.y))]===landOf(p)
 const near=a.players.some(q=>q.alive&&!friends(p,q)&&Math.hypot(q.x-p.x,q.y-p.y)<14&&p.trail.length>0)
 if(!home&&(near||p.trail.length>24+b.brave*50)){const h=nearestHome(a,p);b.goals=h?[h]:[]}
 if(!b.goals.length){
  if(home){
   const out=a.roll()*Math.PI*2,len=6+a.roll()*(6+b.brave*16),turn=(a.roll()<0.5?1:-1)*(Math.PI/2),side=4+a.roll()*(4+b.brave*12)
   const g1:[number,number]=[p.x+Math.cos(out)*len,p.y+Math.sin(out)*len],g2:[number,number]=[g1[0]+Math.cos(out+turn)*side,g1[1]+Math.sin(out+turn)*side]
   const clamp=(g:[number,number]):[number,number]=>[Math.max(2,Math.min(N-2,g[0])),Math.max(2,Math.min(N-2,g[1]))]
   b.goals=[clamp(g1),clamp(g2),[p.x,p.y]]
  }else{const h=nearestHome(a,p);b.goals=h?[h]:[]}
 }
 const g=b.goals[0]
 if(g&&Math.hypot(g[0]-p.x,g[1]-p.y)<1.2)b.goals.shift()
 const goal=b.goals[0]
 if(goal)p.want=Math.atan2(goal[1]-p.y,goal[0]-p.x)
 // Look a few squares ahead: the edge or its own trail means turn away.
 const danger=(ang:number)=>{for(const d of [1.5,3]){const x=p.x+Math.cos(ang)*d,y=p.y+Math.sin(ang)*d;if(!inside(Math.floor(x),Math.floor(y)))return true;const i=at(Math.floor(x),Math.floor(y));if(a.trail[i]===p.id&&!p.trail.slice(-6).includes(i))return true}return false}
 if(danger(p.want)){for(const off of [0.6,-0.6,1.2,-1.2,1.8,-1.8,2.6,-2.6]){if(!danger(p.want+off)){p.want+=off;break}}}
}
/** One tick: everyone moves a step; trails, cuts, crashes and claims follow. */
export function tick(a:Arena){
 a.ticks++
 for(const p of a.players)if(!p.alive&&(p.bot||p.team)&&a.ticks>=p.back)spawn(a,p)
 for(const p of a.players){
  if(!p.alive)continue
  if(p.bot)think(a,p)
  p.angle=turnToward(p.angle,p.want,TURN)
 }
 const moving=a.players.filter(p=>p.alive)
 for(const p of moving){
  if(!p.alive)continue
  const [ox,oy]=cellOf(p.x,p.y)
  p.x+=Math.cos(p.angle)*SPEED;p.y+=Math.sin(p.angle)*SPEED
  const [nx,ny]=cellOf(p.x,p.y)
  if(nx===ox&&ny===oy)continue
  // A diagonal step also passes through a side square, so a trail is never just corner-to-corner.
  const steps:[number,number][]=nx!==ox&&ny!==oy?[[nx,oy],[nx,ny]]:[[nx,ny]]
  for(const [x,y] of steps){if(p.alive)enter(a,p,x,y)}
 }
 // Two heads meeting: whoever is out in the open loses (both, if both are).
 for(const p of moving)for(const q of moving){
  if(p.id>=q.id||!p.alive||!q.alive||friends(p,q)||Math.hypot(p.x-q.x,p.y-q.y)>0.9)continue
  const pin=a.own[at(Math.floor(p.x),Math.floor(p.y))]===landOf(p),qin=a.own[at(Math.floor(q.x),Math.floor(q.y))]===landOf(q)
  if(!pin)knockOut(a,p,qin?q.id:null)
  if(!qin)knockOut(a,q,pin?p.id:null)
 }
}
/** A player moving onto a square. */
function enter(a:Arena,p:Player,x:number,y:number){
 if(!inside(x,y)){knockOut(a,p,null);return}
 const i=at(x,y),cut=a.trail[i]
 // Its own trail (but not the squares it has only just left, which a tight turn can brush).
 if(cut===p.id&&!p.trail.slice(-3).includes(i)){knockOut(a,p,null);return}
 if(cut&&cut!==p.id){const q=a.players.find(o=>o.id===cut);if(q&&!friends(p,q))knockOut(a,q,p.id)}
 if(a.own[i]===landOf(p)){if(p.trail.length){claim(a,p);if(p.bot)p.bot.goals=[]}}
 else if(!a.trail[i]){a.trail[i]=p.id;p.trail.push(i);p.path.push([p.x,p.y])}
 else if(cut!==p.id){p.trail.push(i);p.path.push([p.x,p.y])} // over a teammate's trail: it stays theirs, and this one passes through
}
