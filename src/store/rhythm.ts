/** KONO Beat (components/RhythmGame): the arcade's songs as a piano-tiles game. Black tiles come down four
 * columns, one on each note of the song's tune, held to its beat (higher notes to the right); tap a tile's column as
 * it reaches the line, and hold a long tile to its end. How close a tap is decides Perfect, Great or Good, with
 * Early or Late; a long tile counts Perfect for every moment it's held. (The rules still know sky notes and
 * ribbons from the old 3D track; the charts don't use them.) The score is out of 1,000,000 (plus one for each
 * dead-on hit), and a clear gauge decides if the song is cleared: on Easy and Medium it fills from empty and
 * needs 70% at the end; on Jeff tier it starts full and the song is over if it runs out. The charts are made
 * from the songs themselves (tools/make_rhythm_charts.py → game/data/rhythmCharts.json). Classic (an option):
 * the first missed tile, or a tap on the wrong column, ends the song, like the original piano-tiles games. */
export type Level='easy'|'medium'|'jeff'
export const LEVELS:{id:Level;name:string;blurb:string}[]=[
 {id:'easy',name:'Easy',blurb:'The tune’s main notes, on the beat; roomy timing and a gentle gauge.'},
 {id:'medium',name:'Medium',blurb:'More of the tune, down to the 16ths.'},
 {id:'jeff',name:'Jeff tier',blurb:'Every note the tune plays, and the gauge drains.'},
]
export type Judge='perfect'|'great'|'good'|'miss'
/** How far off (ms) still counts, by level: Perfect, Great, Good. Half the Perfect window is dead on. */
export const WINDOWS:Record<Level,[number,number,number]>={easy:[60,110,160],medium:[45,90,135],jeff:[35,70,110]}
const WEIGHT:Record<Judge,number>={perfect:1,great:0.75,good:0.5,miss:0}
export const MAX_SCORE=1_000_000
export const judge=(offMs:number,level:Level):Judge=>{const a=Math.abs(offMs),[p,g,o]=WINDOWS[level];return a<=p?'perfect':a<=g?'great':a<=o?'good':'miss'}
/** How late a note can still be hit: the Good window, or (Tiles board) as long as the tile is on the line. */
export const lateOf=(n:Pick<Note,'len'>,level:Level)=>Math.max(WINDOWS[level][2],n.len??0)
/** A hit on a note: Perfect and Great by how close it is, and on the Tiles board anything else while the tile is
 * still on the line is Good (it was pressed within the tile: it counts, for fewer points). */
export const judgeNote=(n:Pick<Note,'len'>,offMs:number,level:Level):Judge=>{const j=judge(offMs,level);return j==='miss'&&offMs>0&&offMs<=lateOf(n,level)?'good':j}

/** Note speed (1-10, kept on this device): how long a note takes to come down the track. */
export const approachFor=(speed:number)=>Math.round(9000/(speed+1))

// The chart as stored: tap [ms,lane,midi]; hold [ms,lane,endMs,midi]; sky [ms,x 0-100]; ribbon piece
// [ms,endMs,x0,x1,hand]. midi is the melody's pitch there (0: no note, in a sung song where the voice holds
// none or nobody sings; a hit there plays a tick).
export type Chart={tap:number[][];hold:number[][];sky:number[][];ribbon:number[][]}
/** A note to hit: floor (lane 0-3, `end` for a hold) or sky (x across the track, 0-1); `midi` is the melody's
 * pitch there (the note a tap plays). */
export type Note={kind:'tap'|'hold'|'sky';t:number;lane:number;x:number;end?:number;midi?:number;hit?:Judge;off?:number
 /** Tiles board: how long (ms) the tile sits on the line, so a tap that late still hits it. */
 len?:number}
/** One piece of a ribbon: it runs from x0 to x1 between t0 and t1, for one hand (0 left, 1 right). */
export type Ribbon={t0:number;t1:number;x0:number;x1:number;hand:0|1}
/** A moment of a hold or ribbon that has to be kept: `of` is the hold's note or the ribbon piece. */
export type Tick={t:number;kind:'hold'|'ribbon';of:number;hit?:Judge}
export type Play={notes:Note[];ribbons:Ribbon[];ticks:Tick[];total:number}
export const laneX=(lane:number)=>0.125+lane*0.25
/** Turns a stored chart into a play: notes in time order, ribbon pieces, and the ticks of holds and ribbons
 * (about every 8th note, so a long one is worth more than a tap). */
export function playOf(c:Chart,bpm:number,{tiles=false}:{tiles?:boolean}={}):Play{
 const notes:Note[]=[...c.tap.map(([t,lane,midi])=>({kind:'tap' as const,t,lane,x:laneX(lane),midi})),...c.hold.map(([t,lane,end,midi])=>({kind:'hold' as const,t,lane,x:laneX(lane),end,midi})),...c.sky.map(([t,x])=>({kind:'sky' as const,t,lane:-1,x:x/100}))].sort((a,b)=>a.t-b.t||a.x-b.x)
 // Tiles board: each tile is as tall as the time to the next row of tiles (any column), up to 0.7 s, and it can
 // be hit for as long as it's on the line. A long tile is started within its first quarter (up to 0.4 s).
 if(tiles)notes.forEach((n,i)=>{if(n.kind==='sky')return;let gap=1000;for(let k=i+1;k<notes.length;k++){const d=notes[k].t-n.t;if(d>5&&notes[k].kind!=='sky'){gap=d;break}}
  n.len=n.kind==='hold'&&n.end?Math.min(400,(n.end-n.t)/4,gap-40):Math.max(0,Math.min(700,gap-40))})
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
export function count(t:Tally,j:Judge,level:Level,total:number,{off,tick=false,free=false}:{off?:number;tick?:boolean;free?:boolean}={}):Tally{
 const combo=j==='miss'?0:t.combo+1,n={...t,[j]:t[j]+1,combo,best:Math.max(t.best,combo),weight:t.weight+WEIGHT[j]}
 if(off!==undefined&&j!=='miss'){if(Math.abs(off)<=WINDOWS[level][0]/2)n.exact++;else if(j!=='perfect'){if(off<0)n.early++;else n.late++}}
 const gain=(level==='easy'?2:level==='medium'?1.4:1)*100/Math.max(1,total)*WEIGHT[j]
 // `free`: a miss while auto-sync is still finding this device's timing costs nothing.
 const loss=free?0:(level==='easy'?0.6:level==='medium'?1.6:t.gauge<30?4:7)*(tick?0.5:1)
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

/** A tap in a floor lane at `ms`: the earliest tap or hold there still waiting and close enough (from the Good
 * window before it until lateOf after it: on the Tiles board, while the tile is on the line). A tap with
 * nothing near is ignored (no penalty for tapping along). */
export function hitIn(notes:Note[],lane:number,ms:number,level:Level):number{
 const far=WINDOWS[level][2]
 for(let i=0;i<notes.length;i++){const n=notes[i];if(n.t-ms>far)return -1;if(n.hit||n.kind==='sky'||n.lane!==lane)continue;if(n.t-ms<=far&&ms-n.t<=lateOf(n,level))return i}
 return -1
}
/** Classic: a tap in a column with no tile near it while another column has one (the wrong tile). */
export function wrongColumn(notes:Note[],lane:number,ms:number,level:Level):boolean{
 const far=WINDOWS[level][2];let other=false
 for(const n of notes){if(n.t-ms>far)break;if(n.hit||n.kind==='sky'||n.t-ms>far||ms-n.t>lateOf(n,level))continue;if(n.lane===lane)return false;other=true}
 return other
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
 for(let i=0;i<notes.length;i++){const n=notes[i];if(n.t>ms)break;if(!n.hit&&ms-n.t>Math.max(far,n.len??0))out.push(i)}
 return out
}

/** The stars a song earned, as on the board's progress line: one for a third of the way, one for two thirds (how far
 * its tiles were played), the crown for clearing it. A warm-up earns none. */
export function starsEarned(r:{timeline:{t:number;j:Judge|null}[];ms:number;warmup?:boolean;failed?:boolean;ended?:boolean;clear:Clear}):[boolean,boolean,boolean]{
 if(r.warmup)return [false,false,false]
 const reached=r.timeline.reduce((m,x)=>x.j?Math.max(m,x.t):m,0)/Math.max(1,r.ms)
 return [reached>=1/3-0.02,reached>=2/3-0.02,!r.failed&&!r.ended&&r.clear!=='fail']
}
/** The most stars a song has earned on a level (0-3, this device), kept whether or not that run cleared it. */
const starsKey=(song:string,level:Level)=>'kono-beat-stars:'+song+':'+level
export function readBeatStars(song:string,level:Level):number{try{const v=Number(localStorage.getItem(starsKey(song,level)));return v>=0&&v<=3?Math.floor(v):0}catch{return 0}}
export function saveBeatStars(song:string,level:Level,stars:number){if(stars>readBeatStars(song,level))try{localStorage.setItem(starsKey(song,level),String(stars))}catch{/* this device only */}}
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
// Timing lives under a new key: the old one ('kono-beat-offset') could have drifted far off, since auto-sync
// used to change it during play and keep the change. That old value is left alone, just no longer read.
export const OFFSET_KEY='kono-beat-timing',OLD_OFFSET_KEY='kono-beat-offset'
/** True on a device that had a Timing saved the old way and hasn't set one since (so it says it was reset). */
export const timingWasReset=()=>{try{return localStorage.getItem(OLD_OFFSET_KEY)!==null&&localStorage.getItem(OFFSET_KEY)===null}catch{return false}}
/** After a song: how early (−) or late (+) the taps landed, in the middle, as a Timing change to suggest; null
 * when there are too few hits to tell (12) or they're already close (within 20 ms). Never applied by itself:
 * the results offer it and the player chooses. (Rhythm games learned this the hard way: a game that keeps
 * shifting its own timing from your taps follows your mistakes and drifts.) */
export function timingDrift(offs:number[]):number|null{
 const v=offs.filter(Number.isFinite).sort((a,b)=>a-b);if(v.length<12)return null
 const m=v.length%2?v[v.length>>1]:(v[v.length/2-1]+v[v.length/2])/2
 return Math.abs(m)<20?null:Math.max(-300,Math.min(300,Math.round(m/5)*5))
}
export const readOffset=()=>{try{return Math.max(-300,Math.min(300,Number(localStorage.getItem(OFFSET_KEY))||0))}catch{return 0}}
export const saveOffset=(ms:number)=>{try{localStorage.setItem(OFFSET_KEY,String(Math.max(-300,Math.min(300,Math.round(ms)))))}catch{/* this device only */}}
/** The board, on this device: flat piano tiles (straight columns, tap the tile itself) or the 3D road with pads. */
export type BoardStyle='tiles'|'road'
/** Speed-ups (Tiles board, on this device; on unless turned off): the tiles fall faster at each star on the progress
 * line (a third of the way, two thirds), easing in over a moment. Only how fast they scroll: the timing, the hit
 * windows and the score are the same. */
export const RAMP_KEY='kono-beat-ramp'
export const readRamp=()=>{try{return localStorage.getItem(RAMP_KEY)!=='0'}catch{return true}}
export const saveRamp=(on:boolean)=>{try{localStorage.setItem(RAMP_KEY,on?'1':'0')}catch{/* this device only */}}
export const RAMP_STEP=0.12
/** How much faster the tiles fall at `progress` (0-1 through the song): 1, then 1.12 from a third, 1.24 from two
 * thirds, each eased in over 2% of the song. */
export function rampAt(progress:number){const ease=(x:number)=>{const k=Math.max(0,Math.min(1,(progress-x)/0.02));return k*k*(3-2*k)};return 1+RAMP_STEP*(ease(1/3)+ease(2/3))}
export const BOARD_KEY='kono-beat-board'
export const readBoard=():BoardStyle=>{try{return localStorage.getItem(BOARD_KEY)==='road'?'road':'tiles'}catch{return 'tiles'}}
export const saveBoard=(v:BoardStyle)=>{try{localStorage.setItem(BOARD_KEY,v)}catch{/* this device only */}}
export const SPEED_KEY='kono-beat-speed'
export const readSpeed=()=>{try{const v=Number(localStorage.getItem(SPEED_KEY));return v>=1&&v<=10?v:5}catch{return 5}}
export const saveSpeed=(v:number)=>{try{localStorage.setItem(SPEED_KEY,String(v))}catch{/* this device only */}}
/** Note ticks (a soft click on every note), on this device. */
export const TICKS_KEY='kono-beat-ticks'
export const readTicks=()=>{try{return localStorage.getItem(TICKS_KEY)==='1'}catch{return false}}
export const saveTicks=(on:boolean)=>{try{localStorage.setItem(TICKS_KEY,on?'1':'0')}catch{/* this device only */}}
/** Tap notes (each tile you hit plays its melody note), on this device: on unless turned off. */
export const KEYS_KEY='kono-beat-keys'
export const readKeys=()=>{try{return localStorage.getItem(KEYS_KEY)!=='0'}catch{return true}}
export const saveKeys=(on:boolean)=>{try{localStorage.setItem(KEYS_KEY,on?'1':'0')}catch{/* this device only */}}
/** Classic (one missed or wrong tile ends the song), on this device. */
export const CLASSIC_KEY='kono-beat-classic'
export const readClassic=()=>{try{return localStorage.getItem(CLASSIC_KEY)==='1'}catch{return false}}
export const saveClassic=(on:boolean)=>{try{localStorage.setItem(CLASSIC_KEY,on?'1':'0')}catch{/* this device only */}}

/** The song and level last played, on this device: the song select opens on them (and Play again or a
 * "try the next level" from the results lands there). */
export const LAST_KEY='kono-beat-last'
export const readLast=():{song:string;level:Level}|null=>{try{const v=JSON.parse(localStorage.getItem(LAST_KEY)??'null');return v&&typeof v.song==='string'&&LEVELS.some(l=>l.id===v.level)?v:null}catch{return null}}
export const saveLast=(song:string,level:Level)=>{try{localStorage.setItem(LAST_KEY,JSON.stringify({song,level}))}catch{/* this device only */}}
/** What a hit plays, on this device: the tile's note (a soft tick where it has none), always a tick, or nothing.
 * Falls back to the older on/off Tap notes setting. */
export type HitSound='notes'|'ticks'|'off'
export const HITS_KEY='kono-beat-hits'
export const readHits=():HitSound=>{try{const v=localStorage.getItem(HITS_KEY);return v==='notes'||v==='ticks'||v==='off'?v:readKeys()?'notes':'off'}catch{return 'notes'}}
export const saveHits=(v:HitSound)=>{try{localStorage.setItem(HITS_KEY,v);localStorage.setItem(KEYS_KEY,v==='off'?'0':'1')}catch{/* this device only */}}
/** Whether this device has had its first timing check (run, or skipped) before a first song. A device that
 * already set a Timing counts as done. */
export const SYNCED_KEY='kono-beat-synced'
export const readSynced=()=>{try{return localStorage.getItem(SYNCED_KEY)==='1'||localStorage.getItem(OFFSET_KEY)!==null}catch{return true}}
export const saveSynced=()=>{try{localStorage.setItem(SYNCED_KEY,'1')}catch{/* this device only */}}
