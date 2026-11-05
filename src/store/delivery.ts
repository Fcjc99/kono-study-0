import {busy,type Cove} from './pusher'

/** Medal values only: ball tokens and player inputs are never folded into this
 * ledger. `awarded` means committed to field delivery, not returned to the hand.
 * A tower is delivered only when the same supported bodies are handed to physics. */
export type DeliveryRoute={source:string;pending:number;stage:string;reason:string}
export type DeliveryLedger={awarded:number;delivered:number;pending:number;live:number;collected:number;lost:number}
export function deliveryLedger(awarded:number,delivered:number,collected:number,lost:number):DeliveryLedger{
 return {awarded,delivered,pending:awarded-delivered,live:delivered-collected-lost,collected,lost}
}
/** Fail closed on an internal bookkeeping defect, rather than showing a false
 * completion or silently evicting material. Rendering catches runtime failures. */
export function assertDeliveryConserved(ledger:DeliveryLedger,actualPending:number,actualLive:number){
 if(ledger.pending!==actualPending||ledger.live!==actualLive||Object.values(ledger).some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Field delivery accounting mismatch; pending material must not be discarded.')
}
/** Sum actual holding locations independently; do not use the award subtraction
 * to decide whether the renderer may end a round. Held tower coins still await
 * handoff, while ordinary stationary field coins have already been delivered. */
export function pendingMedals(c:Cove,runtime:{hoppers:number;tower:number;bucket:number;tide?:number}):number{
 return (c.rain??0)+c.medals.filter(m=>!m.ball&&m.y>=0).length+c.towers.reduce((n,t)=>n+t.n,0)+(c.tides??[]).reduce((n,t)=>n+t.n,0)+runtime.hoppers+runtime.tower+runtime.bucket+(runtime.tide??0)
}
export type PendingWork={input:number;medals:number;balls:number;towerBusy:boolean;bucketBusy:boolean;trayBusy:boolean;inFlight:boolean}
export function hasPendingWork(c:Cove,w:PendingWork):boolean{
 return busy(c)||!!(w.input||w.medals||w.balls||w.towerBusy||w.bucketBusy||w.trayBusy||w.inFlight)
}
export function ballProgress(c:Cove){
 const waiting=c.dishQueue+c.chanceQueue,phase=c.bonusResult?c.bonusResult.label:c.chance?'JACKPOT CHANCE drawing':c.dish?'Ball challenge drawing':waiting?'Challenge queued':'Push a ball to the catcher'
 return {starting:c.ballsStartingSupply??0,awarded:c.ballsAwarded??0,captured:c.ballsCaptured??0,waiting,phase,result:!!c.bonusResult}
}
