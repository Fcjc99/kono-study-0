/** What the medal pusher shows when its 3D machine can't start (instead of waiting forever): what went
 * wrong in plain words, Try again, and Leave. Shared by KONO Medal Cove and its machine prototype. */
export type CoveFailure='webgl'|'physics'|'slow'|'crash'
const WHY:Record<CoveFailure,string>={
 webgl:'This browser or device has 3D graphics (WebGL) turned off or unavailable. Turning on hardware acceleration in the browser’s settings, or using a different browser, usually fixes it.',
 physics:'The physics engine didn’t load. That can happen on a weak or interrupted connection.',
 slow:'The machine is taking too long to start. The device may be busy or low on memory.',
 crash:'Something went wrong while setting up the machine.',
}
export default function CoveFail({kind,onRetry,onLeave}:{kind:CoveFailure;onRetry:()=>void;onLeave?:()=>void}){
 return <div className="cove-fail" role="alert">
  <strong>The medal machine couldn’t start</strong>
  <p>{WHY[kind]}</p>
  <span><button type="button" onClick={onRetry}>Try again</button>{onLeave&&<button type="button" onClick={onLeave}>Back to the games</button>}</span>
 </div>
}
