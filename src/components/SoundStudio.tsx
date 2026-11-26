import {useEffect,useState} from 'react'
import {useLocalSetting} from '../hooks/useLocalSetting'
import {babble,BABBLE_SETTING} from '../konoBabble'
import {SCAPES,SOUND_EVENTS,SOUND_PACKS,readSoundPrefs,type ScapeKind,type SoundPrefs} from '../sound/prefs'
import {useSoundPrefs} from '../sound/useSoundPrefs'
import {readHaptics,saveHaptics,haptic} from '../game/haptics'
import DropZone from './DropZone'
import './sound-studio.css'

const engine=()=>import('../sound/engine')
const kb=(n:number)=>n>=1e6?(n/1e6).toFixed(1)+' MB':Math.max(1,Math.round(n/1e3))+' KB'

/** The soundscape mixer: each sound with its own level; tapping one turns it on or off. Shared by Settings and
 * Focus (`live`: what you change plays right away). */
export function ScapeMixer({live=true}:{live?:boolean}){
 const [p,set]=useSoundPrefs()
 const [on,setOn]=useState(false)
 const apply=(mix:SoundPrefs['scape'])=>{if(live&&on)void engine().then(m=>m.setScape(mix,p.volume))}
 const level=(k:ScapeKind,v:number)=>{const mix={...p.scape,[k]:v};if(!v)delete mix[k];set(x=>({...x,scape:mix}));apply(mix)}
 useEffect(()=>()=>{if(live)void engine().then(m=>m.stopScape())},[live])
 const any=Object.keys(p.scape).length>0
 return <div className="scape-mixer">
  <div className="scape-grid">{SCAPES.map(s=>{const v=p.scape[s.id]??0;return <div key={s.id} className={'scape-tile'+(v>0?' is-on':'')} style={{'--lv':v} as React.CSSProperties}>
   <button type="button" aria-pressed={v>0} aria-label={s.name} onClick={()=>level(s.id,v>0?0:.6)}><span aria-hidden="true">{s.icon}</span><b>{s.name}</b></button>
   <input type="range" min={0} max={100} value={Math.round(v*100)} aria-label={s.name+' level'} onChange={e=>level(s.id,Number(e.target.value)/100)}/>
  </div>})}</div>
  {live&&<div className="scape-actions">
   <button type="button" className={'scape-play'+(on?' is-on':'')} disabled={!any&&!on} onClick={()=>{const next=!on;setOn(next);void engine().then(m=>next?m.setScape(p.scape,p.volume):m.stopScape())}}>{on?'❚❚ Stop listening':'▶ Listen'}</button>
   {any&&<button type="button" className="scape-clear" onClick={()=>{set(x=>({...x,scape:{}}));void engine().then(m=>m.stopScape());setOn(false)}}>Clear mix</button>}
  </div>}
 </div>
}

/** One of your own sounds: upload (drop, paste or choose), play, replace or remove. */
function CustomSound({slot,label}:{slot:'done'|'timer'|'start';label:string}){
 const [p,set]=useSoundPrefs(),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
 const c=p.custom[slot]
 const take=async(files:File[])=>{const f=files[0];if(!f)return;setErr('');setBusy(true)
  try{const m=await engine();await m.saveClip(slot,f);set(x=>({...x,custom:{...x.custom,[slot]:{name:f.name,size:f.size}}}));void m.playEvent(slot,{...readSoundPrefs()})}
  catch(e){setErr(e instanceof Error?e.message:'That sound couldn’t be saved.')}finally{setBusy(false)}}
 return <div className="sound-custom">
  <div className="sound-custom-head"><b>{label}</b>{c&&<span className="sound-chip">🎵 {c.name} · {kb(c.size)}</span>}</div>
  {c?<div className="sound-custom-actions">
   <button type="button" onClick={()=>void engine().then(m=>m.playEvent(slot))}>▶ Play</button>
   <DropZone compact accept="audio/*" label="Replace" hint="" onFiles={take} busy={busy}/>
   <button type="button" className="sound-remove" onClick={()=>void engine().then(m=>m.deleteClip(slot)).then(()=>set(x=>{const custom={...x.custom};delete custom[slot];return {...x,custom}}))}>Remove</button>
  </div>:<DropZone accept="audio/*" icon="🎵" label={'Drop a sound for '+label.toLowerCase()} hint="MP3, M4A, WAV or OGG, up to 2 MB · kept on this device" onFiles={take} busy={busy}/>}
  {err&&<p className="sound-err" role="alert">{err}</p>}
 </div>
}

/** Settings › Sound: on or off, how loud, which sound pack, which moments make a sound, your own sounds, the
 * Focus soundscape, KONO's chatter and haptics. */
export default function SoundStudio({on,setOn,ambient,setAmbient}:{on:boolean;setOn:(v:boolean)=>void;ambient:boolean;setAmbient:(v:boolean)=>void}){
 const [p,set]=useSoundPrefs()
 const [chatter,setChatter]=useLocalSetting(BABBLE_SETTING,'off')
 const [buzz,setBuzz]=useState(readHaptics)
 return <div className={'sound-studio'+(on?'':' is-muted')}>
  <section className="wb-panel sound-hero">
   <div className="sound-hero-top">
    <span className="sound-hero-icon" aria-hidden="true">{!on||p.volume===0?'🔇':p.volume<.4?'🔈':p.volume<.75?'🔉':'🔊'}</span>
    <div><h2>Sound</h2><p>{on?'KONO plays sounds for the moments you pick.':'All of KONO’s sounds are off.'}</p></div>
    <label className="sound-switch"><input type="checkbox" role="switch" checked={on} aria-label="Sounds on" onChange={e=>setOn(e.target.checked)}/><span aria-hidden="true"/></label>
   </div>
   <label className="sound-volume"><span>Volume</span><input type="range" min={0} max={100} value={Math.round(p.volume*100)} disabled={!on} aria-label="Volume" onChange={e=>set(x=>({...x,volume:Number(e.target.value)/100}))} onPointerUp={()=>void engine().then(m=>m.playEvent('add'))}/><b>{Math.round(p.volume*100)}%</b></label>
  </section>

  <section className="wb-panel">
   <h2>Sound pack</h2><p className="wb-muted">How every sound in the app feels. Tap one to hear it.</p>
   <div className="sound-packs" role="radiogroup" aria-label="Sound pack">{SOUND_PACKS.map(pk=><button type="button" role="radio" key={pk.id} aria-checked={p.pack===pk.id} className={'sound-pack is-'+pk.id} disabled={!on} onClick={()=>{set(x=>({...x,pack:pk.id}));void engine().then(m=>m.previewPack(pk.id,p.volume))}}>
    <span className="sound-pack-wave" aria-hidden="true"><i/><i/><i/><i/><i/></span><b>{pk.name}</b><small>{pk.note}</small>
   </button>)}</div>
  </section>

  <section className="wb-panel">
   <h2>When to play a sound</h2>
   <ul className="sound-events">{SOUND_EVENTS.map(ev=><li key={ev.id}>
    <button type="button" className="sound-try" aria-label={'Hear: '+ev.name} disabled={!on} onClick={()=>void engine().then(m=>m.playEvent(ev.id,{...p,events:{...p.events,[ev.id]:true}}))}>▶</button>
    <span><b>{ev.name}</b><small>{ev.note}</small></span>
    <label className="sound-switch is-small"><input type="checkbox" role="switch" checked={p.events[ev.id]} disabled={!on} aria-label={ev.name} onChange={e=>set(x=>({...x,events:{...x.events,[ev.id]:e.target.checked}}))}/><span aria-hidden="true"/></label>
   </li>)}</ul>
  </section>

  <section className="wb-panel">
   <h2>Your own sounds</h2><p className="wb-muted">Use any short sound you like: a song clip, your pet, a voice memo. It stays on this device.</p>
   <CustomSound slot="done" label="Finish a task"/>
   <CustomSound slot="timer" label="Focus timer ends"/>
   <CustomSound slot="start" label="Start a focus session"/>
  </section>

  <section className="wb-panel">
   <h2>Focus soundscape</h2><p className="wb-muted">Mix your own background to study to. Turn up what you like.</p>
   <ScapeMixer/>
   <label className="sound-row"><span><b>Play it with the Focus timer</b><small>It starts with the timer and fades out when the timer ends</small></span><span className="sound-switch is-small"><input type="checkbox" role="switch" checked={p.scapeWithFocus} aria-label="Play the soundscape with the Focus timer" onChange={e=>set(x=>({...x,scapeWithFocus:e.target.checked}))}/><span aria-hidden="true"/></span></label>
  </section>

  <section className="wb-panel">
   <h2>KONO, the island and your phone</h2>
   <label className="sound-row"><span><b>Island sounds</b><small>Soft piano and sanctuary ambience on KONO’s island</small></span><span className="sound-switch is-small"><input type="checkbox" role="switch" checked={ambient} aria-label="Island sounds" onChange={e=>setAmbient(e.target.checked)}/><span aria-hidden="true"/></span></label>
   <label className="sound-row"><span><b>KONO’s chatter</b><small>Soft little blips when KONO says something to you</small></span><span className="sound-switch is-small"><input type="checkbox" role="switch" checked={chatter==='on'} aria-label="KONO’s chatter" onChange={e=>{setChatter(e.target.checked?'on':'off');if(e.target.checked)babble('Hi there, friend!')}}/><span aria-hidden="true"/></span></label>
   <label className="sound-row"><span><b>Haptics</b><small>A little tap you can feel in games and when you finish things</small></span><span className="sound-switch is-small"><input type="checkbox" role="switch" checked={buzz} aria-label="Haptics" onChange={e=>{saveHaptics(e.target.checked);setBuzz(e.target.checked);if(e.target.checked)haptic('success')}}/><span aria-hidden="true"/></span></label>
  </section>
 </div>
}
