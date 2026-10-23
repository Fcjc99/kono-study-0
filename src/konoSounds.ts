const WAVE:Partial<Record<Sfx,OscillatorType>>={tick:'square',pop:'square',place:'sine'}
/** Little sounds for KONO Town (coins coming in, buying, the prize wheel turning and winning, popping a
 * bubble, a door opening, KONO blast's pieces landing and the game ending), made with Web Audio so there's no sound file to download. They follow Settings ›
 * Sounds (the caller passes it). Browsers only allow sound after a tap, so they play for what you do. */
export type Sfx='coin'|'buy'|'tick'|'win'|'pop'|'door'|'place'|'over'
let context:AudioContext|null=null
const NOTES:Record<Sfx,[number,number,number][]>={
 // [frequency, start (s), length (s)]
 coin:[[988,0,.08],[1319,.07,.16]],
 buy:[[784,0,.07],[988,.06,.07],[1175,.12,.07],[1568,.18,.18]],
 tick:[[1800,0,.025]],
 win:[[659,0,.1],[784,.1,.1],[988,.2,.1],[1319,.3,.28]],
 pop:[[620,0,.05]],
 door:[[392,0,.18],[523,.14,.26]],
 place:[[330,0,.06],[196,.03,.1]],
 over:[[392,0,.18],[330,.17,.18],[262,.34,.4]],
}
/** `pitch` raises the whole sound. */
export function playSfx(kind:Sfx,enabled=true,pitch=1){
 if(!enabled)return
 try{context??=new AudioContext()}catch{return}
 const ctx=context
 if(ctx.state==='suspended')void ctx.resume().catch(()=>undefined)
 const now=ctx.currentTime+.01
 for(const [freq,start,length] of NOTES[kind]){
  const osc=ctx.createOscillator(),gain=ctx.createGain(),at=now+start
  osc.type=WAVE[kind]??'triangle'
  osc.frequency.setValueAtTime(freq*pitch,at)
  if(kind==='pop')osc.frequency.exponentialRampToValueAtTime(freq*pitch*2.2,at+length)
  if(kind==='place')osc.frequency.exponentialRampToValueAtTime(freq*.6,at+length)
  gain.gain.setValueAtTime(0,at)
  gain.gain.linearRampToValueAtTime(kind==='tick'?.04:kind==='place'?.14:.08,at+.01)
  gain.gain.exponentialRampToValueAtTime(.0001,at+length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at);osc.stop(at+length+.02)
 }
}
