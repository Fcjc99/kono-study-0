/** KONO's chatter: when KONO says something, a little run of soft blips (one per syllable or so), made
 * with Web Audio so there's no sound file to download. Off unless turned on in Settings › Look & feel.
 * Browsers only allow sound after a tap, so it plays for KONO's replies to you, not on its own. */

export {BABBLE_SETTING} from './konoBabbleSetting'
let context:AudioContext|null=null

export function babble(text:string){
 const letters=text.replace(/[^a-zA-Z]/g,'')
 if(!letters)return
 try{context??=new AudioContext()}catch{return}
 const ctx=context
 if(ctx.state==='suspended')void ctx.resume().catch(()=>undefined)
 const count=Math.min(12,Math.max(3,Math.round(letters.length/4)))
 let at=ctx.currentTime+.02
 for(let i=0;i<count;i++){
  // Each blip's pitch comes from the text, so the same line always sounds the same.
  const code=letters.charCodeAt((i*3)%letters.length)
  const osc=ctx.createOscillator(),gain=ctx.createGain()
  osc.type='triangle'
  osc.frequency.setValueAtTime(560+(code%12)*28,at)
  osc.frequency.exponentialRampToValueAtTime(480+(code%7)*30,at+.07)
  gain.gain.setValueAtTime(0,at)
  gain.gain.linearRampToValueAtTime(.07,at+.012)
  gain.gain.exponentialRampToValueAtTime(.0001,at+.08)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at);osc.stop(at+.09)
  at+=.075+(code%3)*.012
 }
}
