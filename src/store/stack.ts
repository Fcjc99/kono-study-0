/** KONO Stack (components/KonoStack): KONO's tower, built floor by floor and seen at an angle (isometric).
 * Each new floor slides across the top, one way then the other way (along x, then along z); tap to set
 * it down. Whatever hangs past the floor below breaks off and falls, so the tower narrows unless you're
 * exact. A drop close enough to line up is "Perfect" (nothing falls off), and three Perfects in a row
 * grow the next floor back a little. Miss the tower completely and it's done. Sizes are in floor units
 * (the base is 40 × 40, centered on 0, 0); speed is units per frame at 60 frames a second. Pure, so it
 * can be tested. */
export type Axis = 'x' | 'z'
export type Floor = { x: number; z: number; w: number; d: number; tint: number }
export type Moving = Floor & { axis: Axis; dir: 1 | -1 }
export type Chip = Floor & { at: number; side: 1 | -1; axis: Axis }
export type Tower = { floors: Floor[]; moving: Moving; speed: number; streak: number; perfects: number; over: boolean; chips: Chip[] }

export const STACK = { base: 40, reach: 58, perfect: 1.4, grow: 3, speed: 0.55, speedUp: 0.02, top: 1.5 }
export const score = (t: Tower) => t.floors.length - 1

const tintFor = (n: number) => (n * 23) % 360
/** The next floor comes in from one side, sliding along the axis it alternates to. */
function enter(below: Floor, n: number): Moving {
  const axis: Axis = n % 2 ? 'x' : 'z', from = (n >> 1) % 2 ? 1 : -1
  return { ...below, tint: tintFor(n), axis, dir: from === 1 ? -1 : 1, [axis]: from * STACK.reach } as Moving
}

export function newTower(): Tower {
  const base: Floor = { x: 0, z: 0, w: STACK.base, d: STACK.base, tint: 0 }
  return { floors: [base], moving: enter(base, 1), speed: STACK.speed, streak: 0, perfects: 0, over: false, chips: [] }
}

/** Slides the floor `n` frames, turning back at the far side. */
export function slide(t: Tower, n = 1): Tower {
  if (t.over) return t
  const m = t.moving, a = m.axis
  let v = m[a] + m.dir * t.speed * n, dir = m.dir
  if (v > STACK.reach) { v = 2 * STACK.reach - v; dir = -1 }
  if (v < -STACK.reach) { v = -2 * STACK.reach - v; dir = 1 }
  return { ...t, moving: { ...m, [a]: v, dir } as Moving }
}

/** Sets the sliding floor down: trimmed to the floor below (or whole on a Perfect). */
export function drop(t: Tower): { tower: Tower; result: 'perfect' | 'trim' | 'miss' } {
  if (t.over) return { tower: t, result: 'miss' }
  const below = t.floors[t.floors.length - 1], m = t.moving, a = m.axis, size = a === 'x' ? 'w' : 'd'
  const lo = Math.max(m[a] - m[size] / 2, below[a] - below[size] / 2), hi = Math.min(m[a] + m[size] / 2, below[a] + below[size] / 2)
  const n = t.floors.length
  const floor = (f: Moving): Floor => ({ x: f.x, z: f.z, w: f.w, d: f.d, tint: f.tint })
  if (hi - lo <= 0.4) return { tower: { ...t, over: true, chips: [...t.chips.slice(-6), { ...floor(m), at: n, side: m[a] < below[a] ? -1 : 1, axis: a }] }, result: 'miss' }
  const speed = Math.min(STACK.top, t.speed + STACK.speedUp)
  if (Math.abs(m[a] - below[a]) <= STACK.perfect) {
    const streak = t.streak + 1, grow = streak >= 3 ? STACK.grow : 0
    const landed: Floor = { ...floor(m), [a]: below[a], w: Math.min(STACK.base, below.w + grow), d: Math.min(STACK.base, below.d + grow) }
    return { tower: { ...t, floors: [...t.floors, landed], moving: enter(landed, n + 1), speed, streak, perfects: t.perfects + 1 }, result: 'perfect' }
  }
  const landed: Floor = { ...floor(m), [a]: (lo + hi) / 2, [size]: hi - lo }
  const side: 1 | -1 = m[a] < below[a] ? -1 : 1, cutSize = m[size] - (hi - lo)
  const chip: Chip = { ...floor(m), [a]: side < 0 ? lo - cutSize / 2 : hi + cutSize / 2, [size]: cutSize, at: n, side, axis: a }
  return { tower: { ...t, floors: [...t.floors, landed], moving: enter(landed, n + 1), speed, streak: 0, chips: [...t.chips.slice(-6), chip] }, result: 'trim' }
}
