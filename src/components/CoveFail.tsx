import MechanismPreview from './MechanismPreview'
export type CoveFailure='webgl'|'physics'|'slow'|'crash'
const WHY:Record<CoveFailure,string>={
 webgl:'3D graphics (WebGL) aren’t available in this browser. Try another browser or enable hardware acceleration to play the original 3D game.',
 physics:'The physics engine didn’t load. Check the connection and try again.',
 slow:'The machine is taking too long to start. Try again when the device is less busy.',
 crash:'The 3D machine stopped. Restart begins a fresh round with 100 medals; the interrupted round is not resumed.',
}
export default function CoveFail({kind,onRetry,onLeave}:{kind:CoveFailure;onRetry:()=>void;onLeave?:()=>void}){
 return <div className="cove-fail">
  <div className="cove-fail-notice" role="alert"><span className="cove-fail-mark" aria-hidden="true">◇</span><div><strong>The 3D machine couldn’t start</strong><p>{WHY[kind]}</p></div><button type="button" onClick={onRetry}>{kind==='crash'?'Restart round':'Try again'}</button></div>
  <MechanismPreview compact/>
  {onLeave&&<button className="cove-preview-leave" type="button" onClick={onLeave}>Open mechanism review</button>}
 </div>
}
