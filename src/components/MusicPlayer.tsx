import type { useMusicController } from '../hooks/useComfort'
export default function MusicPlayer({controller,compact}:{controller:ReturnType<typeof useMusicController>;compact?:boolean}){
 const {enabled,playing,error,toggle}=controller
 const status=error||(!enabled?'Music is off':playing?'Your study soundtrack':'Press play to study')
 if(compact)return <div className={`kono-radio-mini ${playing?'is-playing':''}`}><button type="button" className="radio-play" disabled={!enabled} onClick={toggle} aria-label={playing?'Pause music':'Play music'} aria-pressed={playing}>{playing?'Ⅱ':'▶'}</button><span className="radio-mini-copy"><b>Coral Morning</b><small>{status}</small></span></div>
 return <aside className={`kono-radio ${playing?'is-playing':''}`} aria-label="KONO cassette player"><div className="cassette-shell" aria-hidden="true"><div className="cassette-label">KONO MIX</div><div className="cassette-window"><i/><span/><i/></div><div className="cassette-tape-line"/></div><div className="radio-copy"><small>CORAL BLOSSOM CASSETTE</small><strong>Coral Morning</strong><span>{status}</span></div><div className="radio-controls"><button type="button" className="radio-play" disabled={!enabled} onClick={toggle} aria-label={playing?'Pause music':'Play music'} aria-pressed={playing}>{playing?'Ⅱ':'▶'}</button></div></aside>
}
