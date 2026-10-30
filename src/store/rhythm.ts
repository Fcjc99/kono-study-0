/** KONO Beat (components/RhythmGame): the arcade's songs as a rhythm game on a track that runs off into the
 * distance. Floor notes come down four lanes (tap; holds stay pressed to the end); sky notes float above the
 * track (tap up high); ribbons wind through the sky with the melody (keep a finger on them). How close a hit is
 * decides Perfect, Great or Good, with Early or Late; holds and ribbons count Perfect for every moment they're
 * kept. The score is out of 1,000,000 (plus one for each dead-on hit), and a clear gauge decides if the song is
 * cleared: on Easy and Medium it fills from empty and needs 70% at the end; on Jeff tier it starts full and the
 * song is over if it runs out. The charts are made from the songs themselves (tools/make_rhythm_charts.py →
 * game/data/rhythmCharts.json). */
export type Level='easy'|'medium'|'jeff'
export const LEVELS:{id:Level;name:string;blurb:string}[]=[
 {id:'easy',name:'Easy',blurb:'About a note a second, on the beat; roomy timing and a gentle gauge.'},
 {id:'medium',name:'Medium',blurb:'About two a second, on the beat and the 8ths, with holds.'},
 {id:'jeff',name:'Jeff tier',blurb:'Every hit in the song down to the 16ths, chords, and the gauge drains.'},
]
export type Judge='perfect'|'great'|'good'|'miss'
/** How far off (ms) still counts, by level: Perfect, Great, Good. Half the Perfect window is dead on. */
export const WINDOWS:Record<Level,[number,number,number]>={easy:[60,110,160],medium:[45,90,135],jeff:[35,70,110]}
const WEIGHT:Record<Judge,number>={perfect:1,great:0.7,good:0.4,miss:0}
export const MAX_SCORE=1_000_000
export const judge=(offMs:number,level:Level):Judge=>{const a=Math.abs(offMs),[p,g,o]=WINDOWS[level];return a<=p?'perfect':a<=g?'great':a<=o?'good':'miss'}

/** Note speed (1-10, kept on this device): how long a note takes to come down the track. */
export const approachFor=(speed:number)=>Math.round(9000/(speed+1))

// The chart as stored: tap [ms,lane]; hold [ms,lane,endMs]; sky [ms,x 0-100]; ribbon piece [ms,endMs,x0,x1,hand].
export type Chart={tap:number[][];hold:number[][];sky:number[][];ribbon:number[][]}
/** A note to hit: floor (lane 0-3, `end` for a hold) or sky (x across the track, 0-1). */
export type Note={kind:'tap'|'hold'|'sky';t:number;lane:number;x:number;end?:number;hit?:Judge;off?:number}
/** One piece of a ribbon: it runs from x0 to x1 between t0 and t1, for one hand (0 left, 1 right). */
export type Ribbon={t0:number;t1:number;x0:number;x1:number;hand:0|1}
/** A moment of a hold or ribbon that has to be kept: `of` is the hold's note or the ribbon piece. */
export type Tick={t:number;kind:'hold'|'ribbon';of:number;hit?:Judge}
export type Play={notes:Note[];ribbons:Ribbon[];ticks:Tick[];total:number}
export const laneX=(lane:number)=>0.125+lane*0.25
/** Turns a stored chart into a play: notes in time order, ribbon pieces, and the ticks of holds and ribbons
 * (about every 8th note, so a long one is worth more than a tap). */
export function playOf(c:Chart,bpm:number):Play{
 const notes:Note[]=[...c.tap.map(([t,lane])=>({kind:'tap' as const,t,lane,x:laneX(lane)})),...c.hold.map(([t,lane,end])=>({kind:'hold' as const,t,lane,x:laneX(lane),end})),...c.sky.map(([t,x])=>({kind:'sky' as const,t,lane:-1,x:x/100}))].sort((a,b)=>a.t-b.t||a.x-b.x)
 const ribbons:Ribbon[]=c.ribbon.map(([t0,t1,x0,x1,hand])=>({t0,t1,x0:x0/100,x1:x1/100,hand:hand?1:0}))
 const step=Math.max(110,60000/bpm/2),ticks:Tick[]=[]
 notes.forEach((n,i)=>{if(n.end)for(let t=n.t+step;t<=n.end;t+=step)ticks.push({t,kind:'hold',of:i})})
 ribbons.forEach((r,i)=>{for(let t=r.t0+(i>0&&ribbons[i-1].t1===r.t0?0:step/2);t<r.t1;t+=step)ticks.push({t,kind:'ribbon',of:i})})
 ticks.sort((a,b)=>a.t-b.t)
 return {notes,ribbons,ticks,total:notes.length+ticks.length}
}
/** Where a ribbon piece is at `ms` (0-1 across the track). */
export const ribbonX=(r:Ribbon,ms:number)=>r.x0+(r.x1-r.x0)*Math.min(1,Math.max(0,(ms-r.t0)/(r.t1-r.t0)))

export type Tally={perfect:number;great:number;good:number;miss:number;early:number;late:number;exact:number;weight:number;combo:number;best:number;gauge:number;failed:boolean}
/** The gauge starts empty (Easy, Medium) or full (Jeff tier). */
export const freshTally=(level:Level):Tally=>({perfect:0,great:0,good:0,miss:0,early:0,late:0,exact:0,weight:0,combo:0,best:0,gauge:level==='jeff'?100:0,failed:false})
export const CLEAR_AT=70
/** Counts one judgement (`off` is how early (−) or late (+) a hit was; ticks have none). The gauge: on Easy and
 * Medium a perfect run fills it well past 70%, a miss takes a little; on Jeff tier hits top it up, a miss takes
 * a lot (less once it's low), and it running out ends the song. A missed tick of a hold or ribbon costs half. */
export function count(t:Tally,j:Judge,level:Level,total:number,{off,tick=false}:{off?:number;tick?:boolean}={}):Tally{
 const combo=j==='miss'?0:t.combo+1,n={...t,[j]:t[j]+1,combo,best:Math.max(t.best,combo),weight:t.weight+WEIGHT[j]}
 if(off!==undefined&&j!=='miss'){if(Math.abs(off)<=WINDOWS[level][0]/2)n.exact++;else if(j!=='perfect'){if(off<0)n.early++;else n.late++}}
 const gain=(level==='easy'?2:level==='medium'?1.4:1)*100/Math.max(1,total)*WEIGHT[j]
 const loss=(level==='easy'?0.6:level==='medium'?1.6:t.gauge<30?4:7)*(tick?0.5:1)
 n.gauge=Math.max(0,Math.min(100,t.gauge+(j==='miss'?-loss:gain)))
 n.failed=t.failed||(level==='jeff'&&n.gauge<=0)
 return n
}
export const scoreOf=(t:Pick<Tally,'weight'|'exact'>,total:number)=>total?Math.round(MAX_SCORE*t.weight/total)+t.exact:0
export const accuracy=(t:Pick<Tally,'weight'>,total:number)=>total?t.weight/total*100:0
export const grade=(score:number)=>score>=980_000?'S+':score>=950_000?'S':score>=900_000?'A':score>=800_000?'B':score>=700_000?'C':'D'
export type Clear='fail'|'clear'|'full'|'all'
/** How the song went: failed, cleared, a full combo (nothing missed) or all perfect. */
export function clearOf(t:Tally,level:Level,played:number,total:number):Clear{
 if(t.failed||played<total||(level!=='jeff'&&t.gauge<CLEAR_AT))return 'fail'
 return t.miss?'clear':t.great||t.good?'full':'all'
}
export const CLEAR_NAME:Record<Clear,string>={fail:'Song failed',clear:'Song clear!',full:'Full combo!',all:'All perfect!'}

/** A tap in a floor lane at `ms`: the earliest tap or hold there still waiting and close enough. A tap with
 * nothing near is ignored (no penalty for tapping along). */
export function hitIn(notes:Note[],lane:number,ms:number,level:Level):number{
 const far=WINDOWS[level][2]
 for(let i=0;i<notes.length;i++){const n=notes[i];if(n.t-ms>far)return -1;if(n.hit||n.kind==='sky'||n.lane!==lane)continue;if(Math.abs(n.t-ms)<=far)return i}
 return -1
}
/** A tap up in the sky at `x` (0-1; null from the keyboard, which takes the next one anywhere). */
export function skyHit(notes:Note[],x:number|null,ms:number,level:Level):number{
 const far=WINDOWS[level][2]
 for(let i=0;i<notes.length;i++){const n=notes[i];if(n.t-ms>far)return -1;if(n.hit||n.kind!=='sky')continue;if(Math.abs(n.t-ms)<=far&&(x===null||Math.abs(n.x-x)<=0.2))return i}
 return -1
}
/** Notes that went by the line unhit (past the Good window) by `ms`. */
export function missedBy(notes:Note[],ms:number,level:Level):number[]{
 const far=WINDOWS[level][2],out:number[]=[]
 for(let i=0;i<notes.length;i++){const n=notes[i];if(n.t>ms)break;if(!n.hit&&ms-n.t>far)out.push(i)}
 return out
}

const bestKey=(song:string,level:Level)=>'kono-beat-best:'+song+':'+level
export type Best={score:number;grade:string;clear:Clear}
export function readBeatBest(song:string,level:Level):Best|null{try{const v=localStorage.getItem(bestKey(song,level));const b=v?JSON.parse(v):null;return b&&b.score>10_000?b:null}catch{return null}}
const CLEAR_RANK:Clear[]=['fail','clear','full','all']
/** Keeps the better score and the better clear (each on its own); returns whether the score is a new best. */
export function saveBeatBest(song:string,level:Level,score:number,clear:Clear):boolean{
 const old=readBeatBest(song,level),better=!old||score>old.score
 const keep={score:better?score:old.score,grade:grade(better?score:old.score),clear:old&&CLEAR_RANK.indexOf(old.clear)>CLEAR_RANK.indexOf(clear)?old.clear:clear}
 try{localStorage.setItem(bestKey(song,level),JSON.stringify(keep))}catch{/* this device only */}
 return better
}
/** Your timing nudge for this device (ms; + if the notes feel early): Bluetooth headphones need more. */
export const OFFSET_KEY='kono-beat-offset'
export const readOffset=()=>{try{return Math.max(-300,Math.min(300,Number(localStorage.getItem(OFFSET_KEY))||0))}catch{return 0}}
export const saveOffset=(ms:number)=>{try{localStorage.setItem(OFFSET_KEY,String(Math.max(-300,Math.min(300,Math.round(ms)))))}catch{/* this device only */}}
export const SPEED_KEY='kono-beat-speed'
export const readSpeed=()=>{try{const v=Number(localStorage.getItem(SPEED_KEY));return v>=1&&v<=10?v:5}catch{return 5}}
export const saveSpeed=(v:number)=>{try{localStorage.setItem(SPEED_KEY,String(v))}catch{/* this device only */}}
/** Note ticks (a soft click on every note), on this device. */
export const TICKS_KEY='kono-beat-ticks'
export const readTicks=()=>{try{return localStorage.getItem(TICKS_KEY)==='1'}catch{return false}}
export const saveTicks=(on:boolean)=>{try{localStorage.setItem(TICKS_KEY,on?'1':'0')}catch{/* this device only */}}
