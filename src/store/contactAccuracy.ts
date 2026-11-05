import RAPIER from '@dimforge/rapier3d-compat'
import {BOARD_BACKSTOP} from './motion'

import {setBodySolverBoost,pruneSolverBoosts} from './tower'

/** Activated only in interactive physics, after the canonical eight-iteration
 * startup settle. The margin covers an ordinary medal's extent plus approach
 * clearance. Every dynamic medal is treated identically, regardless of origin. */
export function updateRearContactAccuracy(world:RAPIER.World,pieces:Iterable<{body:RAPIER.RigidBody;ball?:boolean}>,radius:number){
 pruneSolverBoosts(world) // retired pocket/collection bodies must not retain requests
 const B=BOARD_BACKSTOP,verticalMargin=radius+.09,approachMargin=radius*2+.18
 for(const piece of pieces){
  const body=piece.body,at=body.translation()
  const near=!piece.ball&&body.isDynamic()&&at.z<B.z+approachMargin&&at.y>B.bottom-verticalMargin&&at.y<B.top+verticalMargin
  setBodySolverBoost(world,body,'rear-apron',near?24:0)
 }
}
