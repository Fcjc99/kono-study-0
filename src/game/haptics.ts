/** Haptics: a tap you can feel. One place for every game (and the app) to ask for one, by what happened, so the
 * feel is the same everywhere and one setting turns it all off.
 * - Phones whose browser can vibrate (Android, Chrome) get navigator.vibrate with the pattern below.
 * - iPhones' Safari can't vibrate a page, but it plays the system's light tick when a switch control is flipped
 *   (iOS 17.4 and later): a hidden one is flipped for a short tick. That only works inside a tap (a touch or
 *   click handler), which is where most of these come from; elsewhere it quietly does nothing.
 * Kept on this device (localStorage), on by default. */
export type Haptic='select'|'tap'|'perfect'|'great'|'good'|'miss'|'success'|'warn'|'heavy'|'hold'

const PATTERNS:Record<Haptic,number|number[]>={
 // (Under about 15 ms many phones' motors don't spin up enough to feel: every hit is at least that.)
 select:10,tap:14,good:16,great:20,perfect:26,hold:12,miss:[30,40,30],warn:40,heavy:45,success:[20,60,30],
}
export const HAPTICS_KEY='kono-haptics'
export const readHaptics=()=>{try{return localStorage.getItem(HAPTICS_KEY)!=='0'}catch{return true}}
export const saveHaptics=(on:boolean)=>{try{localStorage.setItem(HAPTICS_KEY,on?'1':'0')}catch{/* this device only */}}

let iosSwitch:HTMLLabelElement|null=null
const canVibrate=()=>typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'
const isIOS=()=>typeof navigator!=='undefined'&&/iP(hone|ad|od)/.test(navigator.userAgent)||(typeof navigator!=='undefined'&&navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
function iosTick(){
 if(!iosSwitch){
  const label=document.createElement('label'),input=document.createElement('input')
  input.type='checkbox';input.setAttribute('switch','');input.tabIndex=-1
  label.setAttribute('aria-hidden','true');label.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'
  label.appendChild(input);document.body.appendChild(label);iosSwitch=label
 }
 iosSwitch.click()
}
let last=0
/** Feel `kind` (nothing if haptics are off or the device can't). A burst of them within 25 ms plays once. */
export function haptic(kind:Haptic){
 if(!readHaptics())return
 const now=performance.now();if(now-last<25&&kind!=='miss')return;last=now
 try{
  if(canVibrate()){navigator.vibrate(PATTERNS[kind]);return}
  if(isIOS())iosTick()
 }catch{/* not allowed here */}
}
/** A game's own vibration pattern, through the same switch (and the iPhone tick where a page can't vibrate). */
export function vibrate(pattern:number|number[]){
 if(!readHaptics())return
 try{if(canVibrate()){navigator.vibrate(pattern);return}if(isIOS())iosTick()}catch{/* not allowed here */}
}
