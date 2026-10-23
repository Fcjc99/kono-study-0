/** Flappy KONO's rules (components/FlappyKono draws them). The world is 288 × 512 (scaled to fit):
 * KONO falls, a flap kicks it up, and jewel pipes slide in from the right with a gap to fly through.
 * Through a gap is a point; touching a pipe, the ground or the sky's top ends the run.
 * Everything moves per frame at 60 fps; `step` takes how many frames passed (so a slow phone keeps pace). */
export const FLAP={w:288,h:512,ground:448,x:78,r:12,gravity:0.38,kick:-6.6,maxFall:9,speed:2.1,pipeW:54,gap:122,spacing:168}
export type Pipe={x:number;gapY:number;scored:boolean;color:number}
export type Flight={y:number;vy:number;pipes:Pipe[];score:number;dead:boolean;frames:number;next:number}
export const newFlight=():Flight=>({y:FLAP.h*0.42,vy:0,pipes:[],score:0,dead:false,frames:0,next:FLAP.w+40})
export const flap=(f:Flight):Flight=>f.dead?f:{...f,vy:FLAP.kick}
/** Where a new pipe's gap sits: somewhere in the middle of the sky, never at the very top or bottom. */
const gapAt=(roll:()=>number)=>{const top=80,bottom=FLAP.ground-80;return top+roll()*(bottom-top)}
/** Moves the world on by `n` frames (fractions allowed). Returns the new flight and whether a point was scored. */
export function step(f0:Flight,n:number,roll:()=>number):{flight:Flight;scored:boolean;hit:boolean}{
 if(f0.dead){
  // KONO drops to the ground after a hit.
  const vy=Math.min(FLAP.maxFall*1.4,f0.vy+FLAP.gravity*n),y=Math.min(FLAP.ground-FLAP.r,f0.y+vy*n)
  return {flight:{...f0,vy,y},scored:false,hit:false}
 }
 const vy=Math.min(FLAP.maxFall,f0.vy+FLAP.gravity*n),y=f0.y+vy*n
 const move=FLAP.speed*n
 let pipes=f0.pipes.map(p=>({...p,x:p.x-move})).filter(p=>p.x>-FLAP.pipeW-4),next=f0.next-move,score=f0.score,scored=false
 if(next<=FLAP.w){pipes=[...pipes,{x:next,gapY:gapAt(roll),scored:false,color:(f0.score+pipes.length)%7}];next+=FLAP.spacing}
 for(const p of pipes)if(!p.scored&&p.x+FLAP.pipeW<FLAP.x-FLAP.r){p.scored=true;score++;scored=true}
 const hit=y+FLAP.r>=FLAP.ground||y-FLAP.r<=0||pipes.some(p=>crash(p,y))
 return {flight:{y:hit?Math.min(y,FLAP.ground-FLAP.r):y,vy:hit?Math.max(vy,0):vy,pipes,score,dead:hit,frames:f0.frames+n,next},scored,hit}
}
/** Whether KONO (a circle at FLAP.x, y) touches a pipe: the nearest point of each pipe half to its center. */
export function crash(p:Pipe,y:number):boolean{
 const cx=FLAP.x,r=FLAP.r-2,top=p.gapY-FLAP.gap/2,bottom=p.gapY+FLAP.gap/2
 const near=(x0:number,y0:number,x1:number,y1:number)=>{const nx=Math.max(x0,Math.min(cx,x1)),ny=Math.max(y0,Math.min(y,y1));return (nx-cx)**2+(ny-y)**2<r*r}
 return near(p.x,-100,p.x+FLAP.pipeW,top)||near(p.x,bottom,p.x+FLAP.pipeW,FLAP.h)
}
/** The medal for a run: bronze at 10, silver 20, gold 30, a diamond at 40. */
export const flapMedal=(score:number)=>score>=40?{emoji:'💎',name:'Diamond'}:score>=30?{emoji:'🥇',name:'Gold'}:score>=20?{emoji:'🥈',name:'Silver'}:score>=10?{emoji:'🥉',name:'Bronze'}:null
