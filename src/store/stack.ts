/** KONO Stack (components/KonoStack): a pancake slides back and forth over the stack; tap to drop it.
 * Whatever hangs over the edge of the one below falls off, so the stack narrows unless you're exact. A
 * drop close enough to line up is "Perfect" (nothing falls off), and three Perfects in a row grow the
 * next pancake back a little. Miss the stack completely and the tower's done. Widths and positions are in
 * percent of the plate; speed in percent per frame (at 60 frames a second). Pure, so it can be tested. */
export type Layer = { x: number; w: number; tint: number }
export type Cut = { x: number; w: number; tint: number; side: 'left' | 'right'; at: number }
export type Tower = { layers: Layer[]; moving: Layer & { dir: 1 | -1 }; speed: number; streak: number; perfects: number; over: boolean; cuts: Cut[] }

export const STACK = { start: 56, perfect: 2.2, grow: 5, max: 64, speed: 0.55, speedUp: 0.022, top: 1.7 }
export const score = (t: Tower) => t.layers.length - 1

const tintFor = (n: number) => (n * 37) % 360
const enter = (w: number, n: number): Tower['moving'] => n % 2 ? { x: 100 - w, w, tint: tintFor(n), dir: -1 } : { x: 0, w, tint: tintFor(n), dir: 1 }

export function newTower(): Tower {
  const base = { x: (100 - STACK.start) / 2, w: STACK.start, tint: 0 }
  return { layers: [base], moving: enter(STACK.start, 1), speed: STACK.speed, streak: 0, perfects: 0, over: false, cuts: [] }
}

/** Slides the pancake `n` frames, turning back at each edge of the plate. */
export function slide(t: Tower, n = 1): Tower {
  if (t.over) return t
  let { x, dir } = t.moving
  x += dir * t.speed * n
  const right = 100 - t.moving.w
  if (x > right) { x = right - (x - right); dir = -1 }
  if (x < 0) { x = -x; dir = 1 }
  return { ...t, moving: { ...t.moving, x: Math.max(0, Math.min(right, x)), dir } }
}

/** Drops the sliding pancake: it lands trimmed to the one below (or whole on a Perfect). */
export function drop(t: Tower): { tower: Tower; result: 'perfect' | 'trim' | 'miss' } {
  if (t.over) return { tower: t, result: 'miss' }
  const below = t.layers[t.layers.length - 1], m = t.moving
  const left = Math.max(m.x, below.x), right = Math.min(m.x + m.w, below.x + below.w)
  const n = t.layers.length
  if (right - left <= 0.5) return { tower: { ...t, over: true, cuts: [...t.cuts, { x: m.x, w: m.w, tint: m.tint, side: m.x < below.x ? 'left' : 'right', at: n }] }, result: 'miss' }
  const speed = Math.min(STACK.top, t.speed + STACK.speedUp)
  if (Math.abs(m.x - below.x) <= STACK.perfect) {
    const streak = t.streak + 1, w = streak >= 3 ? Math.min(STACK.max, below.w + STACK.grow) : below.w
    const x = Math.max(0, Math.min(100 - w, below.x - (w - below.w) / 2))
    const landed = { x, w, tint: m.tint }
    return { tower: { ...t, layers: [...t.layers, landed], moving: enter(w, n + 1), speed, streak, perfects: t.perfects + 1 }, result: 'perfect' }
  }
  const landed = { x: left, w: right - left, tint: m.tint }
  const cut: Cut = m.x < below.x ? { x: m.x, w: left - m.x, tint: m.tint, side: 'left', at: n } : { x: right, w: m.x + m.w - right, tint: m.tint, side: 'right', at: n }
  return { tower: { ...t, layers: [...t.layers, landed], moving: enter(landed.w, n + 1), speed, streak: 0, cuts: [...t.cuts.slice(-6), cut] }, result: 'trim' }
}

/** A topping every 10 pancakes, for the stack's look. */
export const TOPPINGS = ['🍓', '🧈', '🫐', '🍌', '🍯', '🍒']
export const toppingAt = (i: number) => i > 0 && i % 10 === 0 ? TOPPINGS[(i / 10 - 1) % TOPPINGS.length] : ''
