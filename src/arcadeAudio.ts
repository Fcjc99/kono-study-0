/** The arcade's music and sound effects, all made with Web Audio (no files to download): a looping
 * soundtrack for each game and the effects the games play (swaps, matches that climb a scale down a
 * cascade, laser beams, explosions, lightning, fire, meows…). Loaded only with the games. Everything
 * follows Settings › Sounds (the caller passes it); the music also has its own on/off switch (🎵 in a
 * game's header), kept on this device. Browsers only allow sound after a tap, and every game starts
 * from one. */
export type Theme='candy'|'gems'|'meow'|'flap'|'paper'|'blast'
let ctx:AudioContext|null=null,master:GainNode|null=null,musicBus:GainNode|null=null,fxBus:GainNode|null=null,echo:GainNode|null=null,noise:AudioBuffer|null=null
function audio(){
 if(!ctx){
  try{ctx=new AudioContext()}catch{return null}
  const c=ctx
  const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.connect(c.destination)
  master=c.createGain();master.gain.value=0.9;master.connect(comp)
  musicBus=c.createGain();musicBus.gain.value=0.2;musicBus.connect(master)
  fxBus=c.createGain();fxBus.gain.value=0.55;fxBus.connect(master)
  // A soft echo for bells and pads (a feedback delay, darkened each time round).
  const delay=c.createDelay(1),fb=c.createGain(),tone=c.createBiquadFilter()
  delay.delayTime.value=0.27;fb.gain.value=0.32;tone.type='lowpass';tone.frequency.value=2400
  echo=c.createGain();echo.gain.value=0.5
  echo.connect(delay);delay.connect(tone);tone.connect(fb);fb.connect(delay);tone.connect(master)
  noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1
 }
 if(ctx.state==='suspended')void ctx.resume().catch(()=>undefined)
 return ctx
}
const hz=(midi:number)=>440*2**((midi-69)/12)
/** One note: an oscillator through a gain envelope (attack, then an exponential fade). */
function tone(c:AudioContext,out:AudioNode,{type='sine',freq,at,dur,vol=0.3,attack=0.005,to,detune=0,wet=false}:{type?:OscillatorType;freq:number;at:number;dur:number;vol?:number;attack?:number;to?:number;detune?:number;wet?:boolean}){
 const o=c.createOscillator(),g=c.createGain()
 o.type=type;o.frequency.setValueAtTime(freq,at);o.detune.value=detune
 if(to)o.frequency.exponentialRampToValueAtTime(Math.max(20,to),at+dur)
 g.gain.setValueAtTime(0.0001,at);g.gain.linearRampToValueAtTime(vol,at+attack);g.gain.exponentialRampToValueAtTime(0.0001,at+dur)
 o.connect(g).connect(out);if(wet&&echo)g.connect(echo)
 o.start(at);o.stop(at+dur+0.05)
}
/** A burst of noise through a filter (hats, snares, whooshes, explosions, crackle). */
function hiss(c:AudioContext,out:AudioNode,{at,dur,vol=0.3,type='highpass',freq=6000,to,q=0.8}:{at:number;dur:number;vol?:number;type?:BiquadFilterType;freq?:number;to?:number;q?:number}){
 const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain()
 s.buffer=noise;f.type=type;f.frequency.setValueAtTime(freq,at);f.Q.value=q
 if(to)f.frequency.exponentialRampToValueAtTime(to,at+dur)
 g.gain.setValueAtTime(0.0001,at);g.gain.linearRampToValueAtTime(vol,at+0.005);g.gain.exponentialRampToValueAtTime(0.0001,at+dur)
 s.connect(f).connect(g).connect(out);s.start(at,Math.random()*0.5);s.stop(at+dur+0.05)
}

// ---- Instruments (for the music) ----
type Inst=(c:AudioContext,out:AudioNode,midi:number,at:number,len:number,vel:number)=>void
const I:Record<string,Inst>={
 bell:(c,o,m,at,len,v)=>{tone(c,o,{freq:hz(m),at,dur:Math.max(0.5,len*2),vol:0.16*v,wet:true});tone(c,o,{freq:hz(m+12),at,dur:0.4,vol:0.05*v,wet:true})},
 pluck:(c,o,m,at,len,v)=>{
  const osc=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain()
  osc.type='square';osc.frequency.value=hz(m);f.type='lowpass';f.frequency.setValueAtTime(3200,at);f.frequency.exponentialRampToValueAtTime(400,at+0.25)
  g.gain.setValueAtTime(0.0001,at);g.gain.linearRampToValueAtTime(0.07*v,at+0.004);g.gain.exponentialRampToValueAtTime(0.0001,at+Math.max(0.18,len))
  osc.connect(f).connect(g).connect(o);osc.start(at);osc.stop(at+len+0.3)
 },
 bass:(c,o,m,at,len,v)=>tone(c,o,{type:'triangle',freq:hz(m),at,dur:Math.max(0.15,len*0.95),vol:0.32*v,attack:0.008}),
 sub:(c,o,m,at,len,v)=>{tone(c,o,{type:'sawtooth',freq:hz(m),at,dur:len*0.9,vol:0.05*v});tone(c,o,{type:'sine',freq:hz(m),at,dur:len*0.9,vol:0.28*v})},
 keys:(c,o,m,at,len,v)=>{tone(c,o,{freq:hz(m),at,dur:Math.max(0.6,len*1.4),vol:0.1*v,attack:0.01,wet:true});tone(c,o,{type:'triangle',freq:hz(m)*2,at,dur:0.3,vol:0.02*v})},
 pad:(c,o,m,at,len,v)=>{
  for(const det of [-9,9]){
   const osc=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain()
   osc.type='sawtooth';osc.frequency.value=hz(m);osc.detune.value=det;f.type='lowpass';f.frequency.value=900
   g.gain.setValueAtTime(0.0001,at);g.gain.linearRampToValueAtTime(0.03*v,at+len*0.3);g.gain.linearRampToValueAtTime(0.0001,at+len*1.05)
   osc.connect(f).connect(g).connect(o);if(echo)g.connect(echo);osc.start(at);osc.stop(at+len*1.1)
  }
 },
 lead:(c,o,m,at,len,v)=>tone(c,o,{type:'square',freq:hz(m),at,dur:Math.max(0.1,len*0.9),vol:0.06*v,attack:0.004}),
 kick:(c,o,_m,at,_l,v)=>tone(c,o,{freq:140,to:42,at,dur:0.28,vol:0.55*v,attack:0.002}),
 snare:(c,o,_m,at,_l,v)=>{hiss(c,o,{at,dur:0.16,vol:0.16*v,type:'bandpass',freq:1900,q:0.7});tone(c,o,{type:'triangle',freq:190,to:120,at,dur:0.1,vol:0.12*v})},
 hat:(c,o,_m,at,_l,v)=>hiss(c,o,{at,dur:0.045,vol:0.07*v,freq:7500}),
 brush:(c,o,_m,at,_l,v)=>hiss(c,o,{at,dur:0.12,vol:0.05*v,type:'bandpass',freq:4200,q:0.5}),
}

// ---- The soundtracks ----
// A song: its tempo, its bars' chords, and tracks. A track's pattern is one string a bar (16 steps):
// a digit picks a note of the bar's chord (0 = root, 1, 2…, higher digits climb octaves), '.' rests,
// 'x' hits a drum; or a melody as note names spaced out over the steps ("E5 . G5 . ...").
type Track={inst:string;oct?:number;vel?:number;len?:number;bars:string[];melody?:boolean}
type Song={bpm:number;chords:number[][];tracks:Track[]}
const C=(...n:string[])=>n.map(note)
function note(s:string){const m=/^([A-G])(#|b)?(\d)$/.exec(s);if(!m)return 60;const base={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1] as 'C'];return 12*(Number(m[3])+1)+base+(m[2]==='#'?1:m[2]==='b'?-1:0)}
const SONGS:Record<Theme,Song>={
 // Candy crush: bouncy and sweet, C – Am – F – G.
 candy:{bpm:118,chords:[C('C3','E3','G3'),C('A2','C3','E3'),C('F2','A2','C3'),C('G2','B2','D3')],tracks:[
  {inst:'bass',bars:['0...0.2.0...4.2.']},
  {inst:'pluck',oct:12,bars:['....012.....012.']},
  {inst:'bell',melody:true,bars:['E5 . G5 . C6 . G5 . A5 . G5 . E5 . . .','C5 . E5 . A5 . . . G5 . E5 . C5 . . .','F5 . A5 . C6 . A5 . G5 . F5 . A5 . . .','G5 . B5 . D6 . B5 . G5 . . . D5 . . .']},
  {inst:'kick',bars:['x.......x.......']},{inst:'snare',vel:0.7,bars:['....x.......x...']},{inst:'hat',bars:['..x...x...x...x.']},
 ]},
 // Gem blitz: shimmering and a little mysterious, Am – F – C – G, arpeggios over a pad.
 gems:{bpm:96,chords:[C('A2','C3','E3'),C('F2','A2','C3'),C('C3','E3','G3'),C('G2','B2','D3')],tracks:[
  {inst:'pad',oct:12,len:16,bars:['0...............','0...............','0...............','0...............']},
  {inst:'pad',oct:12,len:16,vel:0.8,bars:['2...............']},
  {inst:'bell',oct:24,vel:0.7,bars:['0.1.2.3.4.3.2.1.']},
  {inst:'sub',bars:['0.......0.....0.']},
  {inst:'kick',vel:0.7,bars:['x.........x.....']},{inst:'hat',vel:0.6,bars:['..x...x...x...xx']},
 ]},
 // Meowdoku: cozy lo-fi, Fmaj7 – Em7 – Dm7 – Cmaj7, soft keys and brushes.
 meow:{bpm:78,chords:[C('F3','A3','C4','E4'),C('E3','G3','B3','D4'),C('D3','F3','A3','C4'),C('C3','E3','G3','B3')],tracks:[
  {inst:'keys',len:6,bars:['0123......0123..']},
  {inst:'bass',oct:-12,bars:['0.......0..2....']},
  {inst:'bell',melody:true,vel:0.6,bars:['. . . . A5 . . . G5 . . . E5 . . .','. . . . G5 . . . . . D5 . . . . .','. . . . F5 . . . E5 . . . C5 . . .','. . . . E5 . . . D5 . . . . . . .']},
  {inst:'kick',vel:0.6,bars:['x.........x.....']},{inst:'brush',bars:['....x.......x...']},{inst:'hat',vel:0.5,bars:['x.x.x.x.x.x.x.x.']},
 ]},
 // Flappy KONO: chiptune, C – G – Am – F.
 flap:{bpm:148,chords:[C('C3','E3','G3'),C('G2','B2','D3'),C('A2','C3','E3'),C('F2','A2','C3')],tracks:[
  {inst:'lead',melody:true,bars:['C5 . E5 . G5 . E5 . C6 . G5 . E5 . G5 .','B4 . D5 . G5 . D5 . B5 . G5 . D5 . G5 .','A4 . C5 . E5 . C5 . A5 . E5 . C5 . E5 .','F4 . A4 . C5 . A4 . F5 . C5 . A4 . C5 .']},
  {inst:'bass',bars:['0.0.0.0.0.0.0.0.']},{inst:'hat',bars:['x.x.x.x.x.x.x.x.']},{inst:'kick',bars:['x...x...x...x...']},
 ]},
 // KONO.io: upbeat electro, Em – C – G – D.
 paper:{bpm:124,chords:[C('E2','G2','B2'),C('C2','E2','G2'),C('G2','B2','D3'),C('D2','F#2','A2')],tracks:[
  {inst:'sub',bars:['0.0.0.0.0.0.0.0.']},
  {inst:'pluck',oct:24,bars:['0.1.2.1.0.1.2.4.']},
  {inst:'kick',bars:['x...x...x...x...']},{inst:'snare',vel:0.6,bars:['....x.......x...']},{inst:'hat',bars:['..x...x...x...x.']},
 ]},
 // KONO blast: steady and bright, F – C – Dm – Bb.
 blast:{bpm:108,chords:[C('F2','A2','C3'),C('C3','E3','G3'),C('D3','F3','A3'),C('Bb2','D3','F3')],tracks:[
  {inst:'bass',bars:['0...0...0.2.0...']},
  {inst:'keys',oct:12,len:2,bars:['..012.....012...']},
  {inst:'bell',oct:24,vel:0.5,bars:['0...2...1...4...']},
  {inst:'kick',bars:['x.......x.......']},{inst:'snare',vel:0.6,bars:['....x.......x...']},{inst:'hat',vel:0.7,bars:['x.x.x.x.x.x.x.x.']},
 ]},
}

const MUSIC_KEY='kono-arcade-music'
export const musicOn=()=>{try{return localStorage.getItem(MUSIC_KEY)!=='0'}catch{return true}}
let playing:{theme:Theme;timer:number;stop:boolean}|null=null,wanted:Theme|null=null
/** Starts a game's soundtrack (if Sounds and 🎵 are on); a soundtrack already playing gives way to it. */
export function startMusic(theme:Theme,enabled:boolean){
 wanted=theme
 stopTimer()
 if(!enabled||!musicOn())return
 const c=audio();if(!c||!musicBus)return
 const song=SONGS[theme],step=60/song.bpm/4,bars=song.chords.length
 let n=0,next=c.currentTime+0.08
 musicBus.gain.cancelScheduledValues(c.currentTime);musicBus.gain.setValueAtTime(0.0001,c.currentTime);musicBus.gain.linearRampToValueAtTime(0.2,c.currentTime+0.6)
 const me={theme,timer:0,stop:false}
 // Looks a little ahead every 25 ms and books the notes that fall in it (so the beat stays steady).
 const book=()=>{
  if(me.stop||!musicBus)return
  while(next<c.currentTime+0.15){
   const bar=Math.floor(n/16)%bars,s=n%16,chord=song.chords[bar]
   for(const t of song.tracks){
    const pat=t.bars[bar%t.bars.length]
    if(t.melody){const notes=pat.split(' ');const tok=notes[s];if(tok&&tok!=='.')I[t.inst](c,musicBus,note(tok),next,step*2,t.vel??1)}
    else{const ch=pat[s];if(!ch||ch==='.')continue
     if(ch==='x'){I[t.inst](c,musicBus,0,next,step,t.vel??1);continue}
     const k=Number(ch),m=chord[k%chord.length]+12*Math.floor(k/chord.length)+(t.oct??0)
     I[t.inst](c,musicBus,m,next,step*(t.len??1),t.vel??1)}
   }
   n++;next+=step
  }
 }
 book();me.timer=window.setInterval(book,25);playing=me
}
function stopTimer(){if(playing){playing.stop=true;window.clearInterval(playing.timer);playing=null}}
/** Fades the soundtrack out (leaving a game, or the round is over). */
export function stopMusic(){
 wanted=null
 if(ctx&&musicBus&&playing){const t=ctx.currentTime;musicBus.gain.cancelScheduledValues(t);musicBus.gain.setValueAtTime(musicBus.gain.value,t);musicBus.gain.linearRampToValueAtTime(0.0001,t+0.4)}
 const p=playing;window.setTimeout(()=>{if(playing===p)stopTimer()},450)
}
/** The 🎵 switch: off stops the music now; on starts the game's soundtrack again. */
export function setMusicOn(on:boolean,enabled:boolean){
 try{localStorage.setItem(MUSIC_KEY,on?'1':'0')}catch{/* storage unavailable */}
 const theme=wanted
 if(!on){stopTimer();wanted=theme}
 else if(theme)startMusic(theme,enabled)
}

// ---- Sound effects ----
export type Fx='swap'|'nope'|'land'|'match'|'make'|'laser'|'boom'|'zap'|'mega'|'squish'|'time'|'mult'|'blaze'|'tick'|'timeup'|'fanfare'|'star'
 |'meow'|'purr'|'paw'|'hiss'|'heart'|'flap'|'ding'|'thud'|'claim'|'cut'|'whoosh'
const PENTA=[0,2,4,7,9,12,14,16,19,21,24]
/** Plays an effect. `level` climbs: a match further down a cascade rings higher. */
export function fx(kind:Fx,enabled:boolean,level=0){
 if(!enabled)return
 const c=audio();if(!c||!fxBus)return
 const o=fxBus,t=c.currentTime+0.005
 switch(kind){
  case 'swap':hiss(c,o,{at:t,dur:0.16,vol:0.18,type:'bandpass',freq:900,to:3800,q:1.2});break
  case 'whoosh':hiss(c,o,{at:t,dur:0.3,vol:0.2,type:'bandpass',freq:500,to:2500,q:0.8});break
  case 'nope':tone(c,o,{type:'triangle',freq:300,to:180,at:t,dur:0.12,vol:0.22});tone(c,o,{type:'triangle',freq:240,to:150,at:t+0.11,dur:0.14,vol:0.18});break
  case 'land':tone(c,o,{freq:180,to:90,at:t,dur:0.08,vol:0.18});break
  case 'match':{const base=72+PENTA[Math.min(level,PENTA.length-1)];for(const [k,d] of [[0,0],[4,0.03],[7,0.06]])tone(c,o,{freq:hz(base+k),at:t+d,dur:0.35,vol:0.12,wet:true});hiss(c,o,{at:t,dur:0.08,vol:0.06,freq:8000});break}
  case 'make':[0,4,7,12,16].forEach((k,i)=>tone(c,o,{freq:hz(79+k),at:t+i*0.045,dur:0.3,vol:0.09,wet:true}));break
  case 'laser':tone(c,o,{type:'sawtooth',freq:2400,to:180,at:t,dur:0.35,vol:0.12});hiss(c,o,{at:t,dur:0.35,vol:0.12,type:'bandpass',freq:5000,to:600});break
  case 'boom':tone(c,o,{freq:120,to:35,at:t,dur:0.5,vol:0.6});hiss(c,o,{at:t,dur:0.55,vol:0.35,type:'lowpass',freq:2600,to:200});break
  case 'zap':for(let k=0;k<6;k++)hiss(c,o,{at:t+k*0.05+Math.random()*0.03,dur:0.06,vol:0.22,type:'highpass',freq:2500+Math.random()*3000});tone(c,o,{type:'sawtooth',freq:90,to:60,at:t,dur:0.4,vol:0.1});break
  case 'mega':tone(c,o,{type:'sawtooth',freq:110,to:880,at:t,dur:0.5,vol:0.1});tone(c,o,{freq:90,to:30,at:t+0.45,dur:0.9,vol:0.7});hiss(c,o,{at:t+0.45,dur:0.9,vol:0.4,type:'lowpass',freq:3000,to:150});[0,4,7,12].forEach((k,i)=>tone(c,o,{freq:hz(84+k),at:t+0.5+i*0.06,dur:0.8,vol:0.08,wet:true}));break
  case 'squish':tone(c,o,{freq:520,to:240,at:t,dur:0.14,vol:0.14});hiss(c,o,{at:t,dur:0.12,vol:0.08,type:'lowpass',freq:1200});break
  case 'time':[0,7,12].forEach((k,i)=>tone(c,o,{freq:hz(84+k),at:t+i*0.07,dur:0.25,vol:0.1,wet:true}));break
  case 'mult':[0,4,7,11,14].forEach((k,i)=>tone(c,o,{type:'triangle',freq:hz(72+k),at:t+i*0.06,dur:0.4,vol:0.12,wet:true}));break
  case 'blaze':hiss(c,o,{at:t,dur:1.1,vol:0.3,type:'bandpass',freq:300,to:2400,q:0.6});tone(c,o,{type:'sawtooth',freq:80,to:320,at:t,dur:1,vol:0.08});break
  case 'tick':tone(c,o,{type:'square',freq:1400,at:t,dur:0.03,vol:0.06});break
  case 'timeup':tone(c,o,{type:'square',freq:220,at:t,dur:0.5,vol:0.1});tone(c,o,{type:'square',freq:165,at:t+0.25,dur:0.6,vol:0.1});break
  case 'fanfare':[[0,0],[4,0.12],[7,0.24],[12,0.36],[7,0.5],[12,0.62]].forEach(([k,d])=>{tone(c,o,{type:'square',freq:hz(72+k),at:t+d,dur:0.22,vol:0.07});tone(c,o,{freq:hz(60+k),at:t+d,dur:0.3,vol:0.1})});break
  case 'star':tone(c,o,{freq:hz(96),at:t,dur:0.6,vol:0.12,wet:true});tone(c,o,{freq:hz(103),at:t+0.05,dur:0.6,vol:0.08,wet:true});break
  case 'meow':{
   // A little "mew": a glide up and down with a touch of vibrato, through a vowel-ish filter.
   const osc=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain(),lfo=c.createOscillator(),lg=c.createGain(),p=1+(level%4)*0.06
   osc.type='sawtooth';osc.frequency.setValueAtTime(520*p,t);osc.frequency.linearRampToValueAtTime(820*p,t+0.12);osc.frequency.linearRampToValueAtTime(600*p,t+0.32)
   lfo.frequency.value=22;lg.gain.value=12;lfo.connect(lg).connect(osc.frequency)
   f.type='bandpass';f.frequency.setValueAtTime(1100,t);f.frequency.linearRampToValueAtTime(1800,t+0.12);f.frequency.linearRampToValueAtTime(900,t+0.32);f.Q.value=3
   g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.22,t+0.04);g.gain.exponentialRampToValueAtTime(0.0001,t+0.36)
   osc.connect(f).connect(g).connect(o);osc.start(t);lfo.start(t);osc.stop(t+0.4);lfo.stop(t+0.4);break}
  case 'purr':for(let k=0;k<14;k++)hiss(c,o,{at:t+k*0.05,dur:0.04,vol:0.12,type:'lowpass',freq:300});break
  case 'paw':tone(c,o,{freq:900,to:1400,at:t,dur:0.07,vol:0.08});break
  case 'hiss':hiss(c,o,{at:t,dur:0.35,vol:0.18,type:'highpass',freq:3000});tone(c,o,{type:'triangle',freq:200,to:120,at:t,dur:0.2,vol:0.12});break
  case 'heart':tone(c,o,{type:'triangle',freq:440,to:220,at:t,dur:0.3,vol:0.16});tone(c,o,{type:'triangle',freq:330,to:165,at:t+0.18,dur:0.4,vol:0.14});break
  case 'flap':hiss(c,o,{at:t,dur:0.1,vol:0.14,type:'bandpass',freq:1200,to:500,q:1});break
  case 'ding':tone(c,o,{freq:hz(88),at:t,dur:0.25,vol:0.12});tone(c,o,{freq:hz(95),at:t+0.07,dur:0.35,vol:0.12,wet:true});break
  case 'thud':tone(c,o,{freq:160,to:40,at:t,dur:0.35,vol:0.5});hiss(c,o,{at:t,dur:0.2,vol:0.2,type:'lowpass',freq:900});break
  case 'claim':[0,4,7,12].forEach((k,i)=>tone(c,o,{type:'triangle',freq:hz(67+k+Math.min(level,7)),at:t+i*0.05,dur:0.3,vol:0.1,wet:true}));break
  case 'cut':tone(c,o,{type:'sawtooth',freq:1800,to:200,at:t,dur:0.25,vol:0.12});hiss(c,o,{at:t,dur:0.2,vol:0.2,freq:4000});break
 }
}
