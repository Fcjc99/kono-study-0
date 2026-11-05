/** Small, deterministic contracts shared by the 3D mechanism and its regression tests.
 * A reward is queued for the playfield, not credited to the hand. Only tray capture
 * is a collection. Nothing is discarded when a release channel is blocked. */
export type Dispenser = { queued: number; lastFrame: number; gapFrames: number }

const whole = (n: number) => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0

export function createDispenser(gapFrames = 9): Dispenser {
  return { queued: 0, lastFrame: -Infinity, gapFrames: Math.max(1, whole(gapFrames)) }
}

export function enqueueDispense(state: Dispenser, count: number): Dispenser {
  return { ...state, queued: state.queued + whole(count) }
}

/** At most one physical piece leaves this gate in any call/frame. A full body
 * budget pauses the gate; it never deletes a live coin to make another fit.
 * Large time jumps do not cause a burst of overlapping release bodies. */
export function releaseDispense(state: Dispenser, frame: number, room: number): { state: Dispenser; released: 0 | 1 } {
  if (!Number.isFinite(frame) || room < 1 || state.queued < 1 || frame - state.lastFrame < state.gapFrames) {
    return { state, released: 0 }
  }
  return { state: { ...state, queued: state.queued - 1, lastFrame: frame }, released: 1 }
}

// Simulated medal contacts, not measured material constants. Medal/medal is .16;
// the ordinary Average combine rule with the .58 wood deck gives .37 on wood.
// This lets ordinary released medals slide instead of locking into tall rows.
export const COIN_MOTION = { friction: 0.16, restitution: 0.02, linearDamping: 0.18, angularDamping: 0.8 } as const
export const BALL_MOTION = { friction: 0.22, restitution: 0.24, linearDamping: 0.04, angularDamping: 0.08 } as const

/** Center thresholds include the different piece radii. A ball rests at -1.56,
 * so testing its center at -1.8 would make ball prizes impossible to collect. */
export const TRAY = {
  halfWidth: 4.1, back: 2.1, front: 4.6, center: 3.4, top: -2,
  coinHalfHeight: 0.055, ballRadius: 0.44, contactSkin: 0.07,
  lossY: -2.3, cleanupY: -3.5,
} as const
export type Position = { x: number; y: number; z: number }
export type Capture = 'medal' | 'ball' | 'lost' | null

/** Call only for an uncounted body, after the physics step. Keep collected bodies
 * visible in the tray until their later cleanup; this function never removes one.
 * The original rules send side-exit balls to the lottery too: preserve that rule,
 * but only once the ball actually reaches the side return below the playfield. */
export function capturePiece(p: Position, ball: boolean, touchingTray?: boolean): Capture {
  if (![p.x, p.y, p.z].every(Number.isFinite)) return null
  // Prefer the real top-facing collider contact when the renderer supplies it.
  // This includes an upright medal or a partly overhanging rim catch, without
  // mistaking a medal supported by another coin for direct tray arrival.
  if (touchingTray === true && p.y >= TRAY.cleanupY) return ball ? 'ball' : 'medal'
  const inTray = Math.abs(p.x) <= TRAY.halfWidth && p.z >= TRAY.back && p.z <= TRAY.front
  const contactY = TRAY.top + (ball ? TRAY.ballRadius : TRAY.coinHalfHeight) + TRAY.contactSkin
  if (touchingTray === undefined && inTray && p.y <= contactY && p.y >= TRAY.cleanupY) return ball ? 'ball' : 'medal'
  // Falling behind the machine or past the catcher never becomes a medal win.
  if ((!inTray && p.y < TRAY.lossY) || p.y < TRAY.cleanupY) return ball ? 'ball' : 'lost'
  return null
}

export type TowerSlot = { x: number; y: number; z: number; medals: number; layer: number; column: number }

/** Each large visible medal represents at most five banked medals. Grow upward,
 * then into adjacent columns instead of silently capping the display at 100.
 * Existing slots never shift as another column is added. The exact bank total
 * must still be displayed in the HUD. Coordinates are relative to the plinth. */
export function towerSlots(bank: number, medalsPer = 5, maxRows = 20): TowerSlot[] {
  const total = whole(bank), per = Math.max(1, whole(medalsPer)), rows = Math.max(1, whole(maxRows))
  return Array.from({ length: Math.ceil(total / per) }, (_, layer) => {
    const column = Math.floor(layer / rows), lane = column % 5
    const x = lane === 0 ? 0 : (lane % 2 ? -1 : 1) * Math.ceil(lane / 2) * 1.48
    return { x, y: (layer % rows) * 0.17, z: -Math.floor(column / 5) * 1.48,
      medals: Math.min(per, total - layer * per), layer, column }
  })
}

/** The reserve is a diagram, not physical medals. Keep its three short columns
 * bounded regardless of entitlement; the HUD always states the exact bank and
 * any medals stored beyond the sample. No award is capped or discarded. */
export const RESERVE_DISPLAY={medalsPerRing:5,rows:5,columns:3,capacity:75,baseY:6.05,baseZ:-6.65} as const
export function reserveDisplay(bank:number){
 const total=whole(bank),visible=Math.min(total,RESERVE_DISPLAY.capacity)
 const slots=towerSlots(visible,RESERVE_DISPLAY.medalsPerRing,RESERVE_DISPLAY.rows)
 return {total,visible,stored:total-visible,slots}
}
