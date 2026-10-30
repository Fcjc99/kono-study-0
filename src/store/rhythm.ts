/** KONO Beat (components/RhythmGame): the arcade's songs as a four-lane rhythm game. Notes fall down
 * their lanes and are hit as they reach the line; how close decides Perfect, Great or Good. The charts are
 * made from the songs themselves (tools/make_rhythm_charts.py → game/data/rhythmCharts.json). */
export type Level='easy'|'medium'|'jeff'
export const LEVELS:{id:Level;name:string;blurb:string}[]=[
 {id:'easy',name:'Easy',blurb:'About a note a second, slower and roomier timing.'},
 {id:'medium',name:'Medium',blurb:'Twice as many notes, tighter timing.'},
 {id:'jeff',name:'Jeff tier',blurb:'Every hit in the song, chords, and no mercy.'},
]
export type Judge='perfect'|'great'|'good'|'miss'
/** How far off (ms) still counts, by level: Perfect, Great, Good. */
export const WINDOWS:Record<Level,[number,number,number]>={easy:[60,110,160],medium:[45,90,135],jeff:[35,70,110]}
/** How long a note is on screen before it reaches the line (ms). */
export const APPROACH:Record<Level,number>={easy:1900,medium:1450,jeff:1050}
export const POINTS:Record<Judge,number>={perfect:300,great:200,good:100,miss:0}
export const judge=(offMs:number,level:Level):Judge=>{const a=Math.abs(offMs),[p,g,o]=WINDOWS[level];return a<=p?'perfect':a<=g?'great':a<=o?'good':'miss'}

export type Note={t:number;lane:number;hit?:Judge;off?:number}
export type Tally={perfect:number;great:number;good:number;miss:number;score:number;combo:number;best:number;life:number;failed:boolean}
export const freshTally=():Tally=>({perfect:0,great:0,good:0,miss:0,score:0,combo:0,best:0,life:100,failed:false})
/** Counts one judgement: points grow a little with the combo (up to +40%); a miss costs life (Easy never
 * fails). */
export function count(t:Tally,j:Judge,level:Level):Tally{
 const combo=j==='miss'?0:t.combo+1,bonus=1+Math.min(4,Math.floor(combo/25))*0.1
 const life=level==='easy'?100:Math.max(0,Math.min(100,t.life+(j==='miss'?(level==='jeff'?-10:-7):j==='good'?0:1)))
 return {...t,[j]:t[j]+1,score:t.score+Math.round(POINTS[j]*bonus),combo,best:Math.max(t.best,combo),life,failed:t.failed||life<=0}
}
/** How much of the best possible: Perfect 100%, Great ⅔, Good ⅓. */
export const accuracy=(t:Pick<Tally,'perfect'|'great'|'good'|'miss'>)=>{const n=t.perfect+t.great+t.good+t.miss;return n?(t.perfect*3+t.great*2+t.good)/(n*3)*100:0}
export const grade=(acc:number)=>acc>=95?'S':acc>=90?'A':acc>=80?'B':acc>=70?'C':'D'

/** A key or tap in a lane at `ms`: the earliest note in that lane still waiting and close enough. A tap with
 * nothing near is ignored (no penalty for tapping along). */
export function hitIn(notes:Note[],lane:number,ms:number,level:Level):number{
 const far=WINDOWS[level][2]
 for(let i=0;i<notes.length;i++){const n=notes[i];if(n.hit||n.lane!==lane)continue;if(n.t-ms>far)return -1;if(Math.abs(n.t-ms)<=far)return i}
 return -1
}
/** Notes that went by the line unhit (past the Good window) by `ms`. */
export function missedBy(notes:Note[],ms:number,level:Level):number[]{
 const far=WINDOWS[level][2],out:number[]=[]
 for(let i=0;i<notes.length;i++){const n=notes[i];if(n.t>ms)break;if(!n.hit&&ms-n.t>far)out.push(i)}
 return out
}

const bestKey=(song:string,level:Level)=>'kono-beat-best:'+song+':'+level
export function readBeatBest(song:string,level:Level):{score:number;acc:number;grade:string}|null{try{const v=localStorage.getItem(bestKey(song,level));return v?JSON.parse(v):null}catch{return null}}
export function saveBeatBest(song:string,level:Level,score:number,acc:number):boolean{
 const old=readBeatBest(song,level);if(old&&old.score>=score)return false
 try{localStorage.setItem(bestKey(song,level),JSON.stringify({score,acc:Math.round(acc*10)/10,grade:grade(acc)}))}catch{/* this device only */}
 return true
}
/** Your timing nudge for this device (ms; + if the notes feel early): Bluetooth headphones need more. */
export const OFFSET_KEY='kono-beat-offset'
export const readOffset=()=>{try{return Math.max(-300,Math.min(300,Number(localStorage.getItem(OFFSET_KEY))||0))}catch{return 0}}
export const saveOffset=(ms:number)=>{try{localStorage.setItem(OFFSET_KEY,String(Math.max(-300,Math.min(300,Math.round(ms)))))}catch{/* this device only */}}
